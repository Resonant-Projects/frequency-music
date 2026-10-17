import { scheduleSignerDelivery } from "./decisionSignerRuntime";
import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { z } from "zod";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireAgentToolSecret } from "./auth";
import { requireDecisionUser, requireHumanIdentity } from "./decisionIdentity";
import { applyDraftDecision } from "./agentDrafts";
import { applyFeedProposal } from "./feeds";
import { createSignedListeningSession } from "./listening";
import {
  AUDIO_RATING_UNAVAILABLE,
  createAudioRating,
  rateableArtifact,
} from "./audioFeedback";
import { reconcileDocket, recipeDecisionContent } from "./docket";
import { feedProposalZ } from "./shared/feedProposals";
import {
  DECISION_TTL_MS,
  DOCKET_DEFERRAL_MS,
  currentRevision,
  decisionCommandZ,
  decisionCommandValidator,
  decisionProposalZ,
  decisionProposalValidator,
  decisionPayloadDigest,
  decisionEventZ,
  decisionEventValidator,
  decisionResultValidator,
  decisionIntentReturnValidator,
  signerCardValidator,
  stableContentDigest,
  type DecisionCommand,
  type DecisionEvent,
  type DecisionTarget,
  type DecisionResult,
} from "./shared/decisionIntents";

async function targetState(
  ctx: MutationCtx,
  command: DecisionCommand,
): Promise<{ targetRevision?: number; targetContentHash?: string }> {
  const target = command.target;
  switch (target.kind) {
    case "agentReviewDraft": {
      const row = await ctx.db.get(target.id);
      if (!row || row.status !== "pending_review")
        throw new ConvexError("Draft is not pending review");
      return { targetRevision: currentRevision(row) };
    }
    case "feedProposal": {
      const row = await ctx.db.get(target.id);
      if (
        !row ||
        row.enabled ||
        !feedProposalZ.safeParse(row.metadata?.proposal).success
      )
        throw new ConvexError("Feed is not a disabled proposal");
      return { targetRevision: currentRevision(row) };
    }
    case "composition":
      if (!(await ctx.db.get(target.id)))
        throw new ConvexError("Composition not found");
      return {};
    case "recipe": {
      const row = await ctx.db.get(target.id);
      if (!row) throw new ConvexError("Recipe not found");
      return { targetContentHash: await recipeDecisionDigest(row) };
    }
    case "audioArtifact": {
      const row = await rateableArtifact(ctx, target.id);
      if (!row) throw new ConvexError(AUDIO_RATING_UNAVAILABLE);
      return { targetContentHash: row.contentHash };
    }
  }
}

/** Recipes have no revision counter; their decision staleness is content-based. */
export async function recipeDecisionDigest(
  row: Doc<"recipes">,
): Promise<string> {
  return await stableContentDigest(recipeDecisionContent(row));
}

/** Null when the target still matches what the proposal described. */
async function targetChange(
  ctx: MutationCtx,
  intent: Doc<"decisionIntents">,
): Promise<string | null> {
  const target = intent.target;
  switch (target.kind) {
    case "composition":
      return null;
    case "recipe": {
      const row = await ctx.db.get(target.id);
      if (!row) return "Target changed: missing";
      return intent.targetContentHash !== undefined &&
        (await recipeDecisionDigest(row)) === intent.targetContentHash
        ? null
        : "Target changed: content";
    }
    case "audioArtifact": {
      const row = await rateableArtifact(ctx, target.id);
      if (!row) return "Target changed: unavailable";
      return row.contentHash === intent.targetContentHash
        ? null
        : "Target changed: content";
    }
    case "agentReviewDraft":
    case "feedProposal": {
      const row = await ctx.db.get(target.id);
      if (row && currentRevision(row) === intent.targetRevision) return null;
      return `Target changed: ${row && "status" in row ? row.status : row && "enabled" in row ? (row.enabled ? "enabled" : "disabled") : "missing"}`;
    }
  }
}

/** Internal service boundary. HTTP wrappers authenticate AGENT_TOOL_SECRET. */
export const proposeInternal = internalMutation({
  args: {
    command: decisionCommandValidator,
    proposal: decisionProposalValidator,
  },
  returns: decisionIntentReturnValidator,
  handler: async (ctx, args) => createProposal(ctx, args),
});
export const propose = mutation({
  args: {
    secret: v.string(),
    command: decisionCommandValidator,
    proposal: decisionProposalValidator,
  },
  returns: decisionIntentReturnValidator,
  handler: async (ctx, args) => {
    requireAgentToolSecret(args.secret, "mutation:decisionIntents.propose");
    return await createProposal(ctx, args);
  },
});
async function createProposal(
  ctx: MutationCtx,
  args: {
    command: DecisionCommand;
    proposal: z.infer<typeof decisionProposalZ>;
  },
  // Web decisions are signed in the same request; they never reach a platform.
  deliver = true,
) {
  const command = decisionCommandZ.parse(args.command);
  const proposal = decisionProposalZ.parse(args.proposal);
  const state = await targetState(ctx, command);
  const now = Date.now();
  const counter = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "decisionIntentSequence"))
    .unique();
  const sequence = counter ? Number(counter.value) + 1 : 1;
  if (!Number.isSafeInteger(sequence) || sequence < 1)
    throw new ConvexError("Invalid decision sequence");
  if (counter)
    await ctx.db.patch(counter._id, {
      value: String(sequence),
      updatedAt: now,
    });
  else
    await ctx.db.insert("settings", {
      key: "decisionIntentSequence",
      value: String(sequence),
      updatedAt: now,
    });
  const id = await ctx.db.insert("decisionIntents", {
    ...command,
    proposal,
    code: `D-${sequence}`,
    ...state,
    payloadDigest: await decisionPayloadDigest(command.action, command.payload),
    status: "proposed",
    createdAt: now,
    expiresAt: now + DECISION_TTL_MS,
  });
  const intent = await ctx.db.get(id);
  if (!intent) throw new Error("Inserted intent missing");
  if (deliver) await scheduleSignerDelivery(ctx, intent);
  return intent;
}

export const get = query({
  args: { intentId: v.id("decisionIntents") },
  returns: v.union(decisionIntentReturnValidator, v.null()),
  handler: async (ctx, args) => {
    await requireHumanIdentity(ctx);
    return await ctx.db.get(args.intentId);
  },
});
export const getInternal = internalQuery({
  args: { intentId: v.id("decisionIntents") },
  returns: v.union(decisionIntentReturnValidator, v.null()),
  handler: async (ctx, args) => ctx.db.get(args.intentId),
});
export const getByCode = internalQuery({
  args: { code: v.string() },
  returns: v.union(decisionIntentReturnValidator, v.null()),
  handler: async (ctx, args) =>
    ctx.db
      .query("decisionIntents")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique(),
});
export const bindSignerCard = internalMutation({
  args: { intentId: v.id("decisionIntents"), signerCard: signerCardValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId);
    if (
      !intent ||
      intent.status !== "proposed" ||
      intent.expiresAt <= Date.now()
    )
      throw new ConvexError("Intent is not active");
    if (intent.signerCard) {
      if (
        intent.signerCard.platform !== args.signerCard.platform ||
        intent.signerCard.chatId !== args.signerCard.chatId ||
        intent.signerCard.messageId !== args.signerCard.messageId
      )
        throw new ConvexError("Signer card is already bound");
      return null;
    }
    await ctx.db.patch(intent._id, { signerCard: args.signerCard });
    return null;
  },
});

/** Invoked exclusively by platform handlers AFTER transport verification. */
export const apply = internalMutation({
  args: { event: decisionEventValidator },
  returns: decisionResultValidator,
  handler: async (ctx, args): Promise<DecisionResult> =>
    applyEvent(ctx, decisionEventZ.parse(args.event)),
});
export const applyWeb = mutation({
  args: {
    intentId: v.id("decisionIntents"),
    digest8: v.string(),
    eventId: v.string(),
  },
  returns: decisionResultValidator,
  handler: async (ctx, args): Promise<DecisionResult> => {
    const userId = await requireDecisionUser(ctx);
    return await applyEvent(
      ctx,
      {
        ...args,
        platform: "web",
        signerId: userId,
        verb: "confirm",
        chatId: "web",
        messageId: args.intentId,
      },
      userId,
    );
  },
});
export const cancelWeb = mutation({
  args: { intentId: v.id("decisionIntents"), eventId: v.string() },
  returns: decisionResultValidator,
  handler: async (ctx, args): Promise<DecisionResult> => {
    const userId = await requireDecisionUser(ctx);
    return await applyEvent(
      ctx,
      {
        ...args,
        platform: "web",
        signerId: userId,
        verb: "cancel",
        chatId: "web",
        messageId: args.intentId,
      },
      userId,
    );
  },
});

type ApplyEvent = Omit<DecisionEvent, "platform"> & {
  platform: "discord" | "telegram" | "web";
};
async function applyEvent(
  ctx: MutationCtx,
  event: ApplyEvent,
  webUserId?: Id<"users">,
): Promise<DecisionResult> {
  // Replay deliberately precedes state, card and signer checks.
  const eventId =
    event.platform === "web" ? `${webUserId}:${event.eventId}` : event.eventId;
  const replay = await ctx.db
    .query("webhookEvents")
    .withIndex("by_platform_eventId", (q) =>
      q.eq("platform", event.platform).eq("eventId", eventId),
    )
    .unique();
  if (replay) return replay.result;
  const intent = await ctx.db.get(event.intentId);
  const record = async (result: DecisionResult) => {
    await ctx.db.insert("webhookEvents", {
      platform: event.platform,
      eventId,
      intentId: event.intentId,
      result,
      createdAt: Date.now(),
    });
    return result;
  };
  const reject = async (
    error: string,
    terminal = false,
  ): Promise<DecisionResult> => {
    const result: DecisionResult = { status: "rejected", error };
    if (terminal && intent)
      await ctx.db.patch(intent._id, {
        status: "rejected",
        result,
        decidedAt: Date.now(),
      });
    return await record(result);
  };
  if (!intent) return await reject("Intent not found");
  if (intent.status !== "proposed")
    return await record(intent.result ?? { status: intent.status });
  if (intent.expiresAt <= Date.now()) {
    const result: DecisionResult = {
      status: "expired",
      error: "Intent expired",
    };
    await ctx.db.patch(intent._id, {
      status: "expired",
      result,
      decidedAt: Date.now(),
    });
    return await record(result);
  }
  if (
    event.platform !== "web" &&
    (!intent.signerCard ||
      intent.signerCard.platform !== event.platform ||
      intent.signerCard.chatId !== event.chatId ||
      intent.signerCard.messageId !== event.messageId)
  )
    return await reject("Signer card mismatch");
  let userId = webUserId;
  if (event.platform !== "web") {
    let mapping: Record<string, string>;
    try {
      mapping = z
        .record(z.string(), z.string())
        .parse(JSON.parse(process.env.DECISION_SIGNERS ?? "{}"));
    } catch {
      return await reject("Signer configuration unavailable");
    }
    const mapped = mapping[`${event.platform}:${event.signerId}`];
    userId = mapped
      ? (ctx.db.normalizeId("users", mapped) ?? undefined)
      : undefined;
  }
  if (!userId || !(await ctx.db.get(userId)))
    return await reject("Signers only");
  const signature = {
    source: event.platform,
    signerId: event.signerId,
    userId,
    eventId: event.eventId,
    messageRef: event.messageId,
    receivedAt: Date.now(),
  };
  if (event.verb === "cancel") {
    const result: DecisionResult = { status: "cancelled" };
    await ctx.db.patch(intent._id, {
      status: "cancelled",
      signature,
      result,
      decidedAt: Date.now(),
    });
    return await record(result);
  }
  if (event.digest8 !== intent.payloadDigest.slice(0, 8))
    return await reject("Payload digest mismatch");
  const changed = await targetChange(ctx, intent);
  if (changed) return await reject(changed, true);
  // A nested mutation rolls back ALL domain writes on failure while retaining
  // the rejection receipt in this outer serializable transaction.
  let appliedRecordId: string;
  try {
    appliedRecordId = await ctx.runMutation(
      makeFunctionReference<
        "mutation",
        {
          intentId: Id<"decisionIntents">;
          userId: Id<"users">;
          source: "web" | "discord" | "telegram";
        },
        string
      >("decisionIntents:applyDomain"),
      { intentId: intent._id, userId, source: event.platform },
    );
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    return await reject(
      typeof error.data === "string"
        ? error.data
        : "Decision failed domain validation",
      true,
    );
  }
  const result: DecisionResult = { status: "applied", appliedRecordId };
  await ctx.db.patch(intent._id, {
    status: "applied",
    signature,
    result,
    decidedAt: Date.now(),
  });
  return await record(result);
}

/** Internal subtransaction, never register as an agent tool. */
export const applyDomain = internalMutation({
  args: {
    intentId: v.id("decisionIntents"),
    userId: v.id("users"),
    source: v.union(
      v.literal("web"),
      v.literal("discord"),
      v.literal("telegram"),
    ),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId);
    if (!intent || intent.status !== "proposed")
      throw new ConvexError("Intent is not proposed");
    return await applyDomainDecision(ctx, intent, args.userId, args.source);
  },
});
async function applyDomainDecision(
  ctx: MutationCtx,
  intent: Doc<"decisionIntents">,
  userId: Id<"users">,
  source: "web" | "discord" | "telegram",
): Promise<string> {
  const command = decisionCommandZ.parse({
    action: intent.action,
    target: intent.target,
    payload: intent.payload,
  });
  const actor = {
    userId,
    source,
    intentId: intent._id,
    transcript: intent.proposal.transcript,
  };
  switch (command.action) {
    case "approve": {
      const result = await applyDraftDecision(ctx, {
        draftId: command.target.id,
        action: "approve",
        decisionNote: command.payload.note,
        amendedPayload: command.payload.amendedPayload,
        actor,
      });
      return result.promotedId;
    }
    case "reject":
      await applyDraftDecision(ctx, {
        draftId: command.target.id,
        action: "reject",
        decisionNote: command.payload.note,
        actor,
      });
      return command.target.id;
    case "supersede":
      await applyDraftDecision(ctx, {
        draftId: command.target.id,
        action: "supersede",
        byDraftId: command.payload.byDraftId,
        decisionNote: command.payload.note,
        actor,
      });
      return command.target.id;
    case "enableFeed":
      return await applyFeedProposal(ctx, command.target.id);
    case "createListeningSession":
      return await createSignedListeningSession(ctx, {
        compositionId: command.target.id,
        payload: command.payload,
        transcript: intent.proposal.transcript,
        userId,
        intentId: intent._id,
      });
    case "rateAudio":
      return await createAudioRating(ctx, {
        artifactId: command.target.id,
        expectedContentHash: intent.targetContentHash ?? "",
        payload: command.payload,
        userId,
        source,
        requestKey: `intent:${intent._id}`,
        decisionIntentId: intent._id,
      });
    case "defer": {
      const card = await ctx.db
        .query("docketCards")
        .withIndex("by_targetId", (q) => q.eq("targetId", command.target.id))
        .unique();
      if (!card) throw new ConvexError("Docket card not found");
      await ctx.db.patch(card._id, {
        deferredUntil: Date.now() + DOCKET_DEFERRAL_MS,
        updatedAt: Date.now(),
      });
      return card._id;
    }
  }
}

function docketTarget(
  ctx: MutationCtx,
  card: Doc<"docketCards">,
): DecisionTarget | null {
  const { db } = ctx;
  let target: DecisionTarget | null = null;
  switch (card.kind) {
    case "pendingDraft": {
      const id = db.normalizeId("agentReviewDrafts", card.targetId);
      target = id && { kind: "agentReviewDraft", id };
      break;
    }
    case "recipeNoComposition": {
      const id = db.normalizeId("recipes", card.targetId);
      target = id && { kind: "recipe", id };
      break;
    }
    case "compositionNoListening": {
      const id = db.normalizeId("compositions", card.targetId);
      target = id && { kind: "composition", id };
      break;
    }
    case "unratedAudio": {
      const id = db.normalizeId("audioArtifacts", card.targetId);
      target = id && { kind: "audioArtifact", id };
      break;
    }
    case "feedProposal": {
      const id = db.normalizeId("feeds", card.targetId);
      target = id && { kind: "feedProposal", id };
      break;
    }
  }
  return target;
}

const webEventIdZ = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/);
export const DOCKET_CARD_CHANGED =
  "Docket card changed or is no longer eligible";

/** The click is the human signature: a canonical defer intent is created and
 * applied in one transaction, never delivered to a platform signer. */
export const deferWeb = mutation({
  args: {
    targetId: v.string(),
    contentHash: v.string(),
    eventId: v.string(),
    note: v.optional(v.string()),
  },
  returns: decisionResultValidator,
  handler: async (ctx, args): Promise<DecisionResult> => {
    const userId = await requireDecisionUser(ctx);
    const eventId = webEventIdZ.safeParse(args.eventId);
    if (!eventId.success) throw new ConvexError("Invalid event ID");
    const replay = await ctx.db
      .query("webhookEvents")
      .withIndex("by_platform_eventId", (q) =>
        q.eq("platform", "web").eq("eventId", `${userId}:${eventId.data}`),
      )
      .unique();
    if (replay) return replay.result;
    const card = (await reconcileDocket(ctx)).find(
      (row) => row.targetId === args.targetId,
    );
    if (!card || card.contentHash !== args.contentHash)
      throw new ConvexError(DOCKET_CARD_CHANGED);
    const target = card.decisions.includes("defer")
      ? docketTarget(ctx, card)
      : null;
    if (!target) throw new ConvexError("This docket card cannot be deferred");
    const note = args.note?.trim() || undefined;
    const command = decisionCommandZ.parse({
      action: "defer",
      target,
      payload: note ? { note } : {},
    });
    const intent = await createProposal(
      ctx,
      {
        command,
        proposal: {
          channel: "web",
          conversationId: userId,
          messageRef: card._id,
          transcript: note ?? "Deferred for two weeks from the web docket.",
        },
      },
      false,
    );
    return await applyEvent(
      ctx,
      {
        intentId: intent._id,
        eventId: eventId.data,
        platform: "web",
        signerId: userId,
        verb: "confirm",
        chatId: "web",
        messageId: intent._id,
        digest8: intent.payloadDigest.slice(0, 8),
      },
      userId,
    );
  },
});
