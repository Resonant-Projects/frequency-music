import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import {
  postSignerCard,
  renderSignerCard,
  updateSignerCard,
  type SignerCardDisplay,
} from "./decisionSignerDelivery";
import { discordId, object, telegramId } from "./decisionSignerParsing";
import { withSignerDeadline } from "./decisionSignerTransport";
import { createDiscordInteractionHandler } from "./discordInteractions";
import { createTelegramWebhookHandler } from "./telegramWebhook";
import {
  signerCardZ,
  signerCardValidator,
  decisionEventValidator,
  decisionEventZ,
  type DecisionEvent,
} from "./shared/decisionIntents";

type Platform = "discord" | "telegram";
type Binding = { platform: Platform; chatId: string; messageId: string };
type Config = {
  platform: Platform;
  chatId: string;
  token: string;
  publicKey?: string;
  applicationId?: string;
  pathSecret?: string;
  headerSecret?: string;
};
const processRef = makeFunctionReference<
  "mutation",
  { admissionId: Id<"settings"> },
  null
>("decisionSignerRuntime:processAdmission");
const intentArgs = { intentId: v.id("decisionIntents") };
const deliverRef = makeFunctionReference<
  "action",
  { intentId: Id<"decisionIntents"> },
  null
>("decisionSignerRuntime:deliver");
const refreshRef = makeFunctionReference<
  "action",
  { intentId: Id<"decisionIntents">; attempt?: number; watch?: boolean },
  null
>("decisionSignerRuntime:refresh");
const claimRef = makeFunctionReference<
  "mutation",
  { intentId: Id<"decisionIntents"> },
  boolean
>("decisionSignerRuntime:claimDelivery");
const finishRef = makeFunctionReference<
  "mutation",
  { intentId: Id<"decisionIntents">; state: string; binding?: Binding },
  null
>("decisionSignerRuntime:finishDelivery");
const bindDeliveredRef = makeFunctionReference<
  "mutation",
  { intentId: Id<"decisionIntents">; binding: Binding },
  null
>("decisionSignerRuntime:bindDelivered");
const deliveredBindingRef = makeFunctionReference<
  "query",
  { intentId: Id<"decisionIntents"> },
  Binding | null
>("decisionSignerRuntime:deliveredBinding");
export const deliveredBinding = internalQuery({
  args: intentArgs,
  returns: v.union(signerCardValidator, v.null()),
  handler: async (ctx, { intentId }) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", deliveryKey(intentId)))
      .unique();
    const binding = signerCardZ.safeParse(
      row && object(parseJson(row.value))?.binding,
    );
    return binding.success ? binding.data : null;
  },
});
const displayRef = makeFunctionReference<
  "query",
  { intentId: Id<"decisionIntents"> },
  SignerCardDisplay | null
>("decisionSignerRuntime:display");
const admitRef = makeFunctionReference<
  "mutation",
  { event: Omit<DecisionEvent, "intentId"> & { intentId: string } },
  "queued" | "signers_only"
>("decisionSignerRuntime:admit");

/** Backend-only configuration. No credential is returned from a Convex function. */
function configuration(platform: string): Config | null {
  if (process.env.DECISION_SIGNERS_ENABLED !== "true") return null;
  const mapping = object(parseJson(process.env.DECISION_SIGNERS ?? "{}"));
  if (
    !mapping ||
    !Object.entries(mapping).some(
      ([key, value]) =>
        key.startsWith(`${platform}:`) &&
        typeof value === "string" &&
        value.length > 0,
    )
  )
    return null;
  if (platform === "discord") {
    const token = process.env.DECISION_DISCORD_BOT_TOKEN;
    const chatId = discordId(process.env.DECISION_DISCORD_CHANNEL_ID);
    const applicationId = discordId(
      process.env.DECISION_DISCORD_APPLICATION_ID,
    );
    const publicKey = process.env.DECISION_DISCORD_PUBLIC_KEY;
    return token &&
      chatId &&
      applicationId &&
      publicKey &&
      /^[a-fA-F0-9]{64}$/.test(publicKey)
      ? { platform, token, chatId, applicationId, publicKey }
      : null;
  }
  if (platform === "telegram") {
    const token = process.env.DECISION_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.DECISION_TELEGRAM_CHAT_ID;
    const pathSecret = process.env.DECISION_TELEGRAM_PATH_SECRET;
    const headerSecret = process.env.DECISION_TELEGRAM_HEADER_SECRET;
    return token &&
      /^[0-9]+:[A-Za-z0-9_-]+$/.test(token) &&
      chatId &&
      telegramId(Number(chatId), true) === chatId &&
      pathSecret &&
      headerSecret &&
      [pathSecret, headerSecret].every((value) =>
        /^[A-Za-z0-9_-]{1,256}$/.test(value),
      )
      ? { platform, token, chatId, pathSecret, headerSecret }
      : null;
  }
  return null;
}
function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Only a configured destination matching the immutable proposal can receive it. */
export function signerDeliveryEnabled(proposal: {
  channel: string;
  conversationId: string;
}): boolean {
  const config = configuration(proposal.channel);
  return config !== null && config.chatId === proposal.conversationId;
}
export async function scheduleSignerDelivery(
  ctx: MutationCtx,
  intent: Doc<"decisionIntents">,
) {
  if (signerDeliveryEnabled(intent.proposal))
    await ctx.scheduler.runAfter(0, deliverRef, { intentId: intent._id });
}

async function setting(ctx: MutationCtx, key: string) {
  return await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}
const deliveryKey = (id: string) => `decisionSigner.delivery:${id}`;

/** A permanent send claim. Neither timeout nor action retry grants another post. */
export const claimDelivery = internalMutation({
  args: intentArgs,
  returns: v.boolean(),
  handler: async (ctx, { intentId }) => {
    const intent = await ctx.db.get(intentId);
    if (
      !intent ||
      intent.status !== "proposed" ||
      intent.expiresAt <= Date.now() ||
      intent.signerCard ||
      !signerDeliveryEnabled(intent.proposal)
    )
      return false;
    const key = deliveryKey(intentId);
    if (await setting(ctx, key)) return false;
    await ctx.db.insert("settings", {
      key,
      value: JSON.stringify({ state: "posting" }),
      updatedAt: Date.now(),
    });
    return true;
  },
});
export const finishDelivery = internalMutation({
  args: {
    ...intentArgs,
    state: v.string(),
    binding: v.optional(
      v.object({
        platform: v.union(v.literal("discord"), v.literal("telegram")),
        chatId: v.string(),
        messageId: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { intentId, state, binding }) => {
    const row = await setting(ctx, deliveryKey(intentId));
    if (!row) throw new Error("Missing signer delivery claim");
    // Retaining the verified provider binding and starting cleanup commit together.
    if (binding && !object(parseJson(row.value))?.binding)
      await ctx.scheduler.runAfter(0, refreshRef, { intentId, watch: true });
    await ctx.db.patch(row._id, {
      value: JSON.stringify({ state, binding }),
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Binding grants authority only while active. The delivery receipt owns cleanup. */
export const bindDelivered = internalMutation({
  args: {
    ...intentArgs,
    binding: v.object({
      platform: v.union(v.literal("discord"), v.literal("telegram")),
      chatId: v.string(),
      messageId: v.string(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { intentId, binding }) => {
    const row = await setting(ctx, deliveryKey(intentId));
    if (!row) throw new Error("Missing signer delivery claim");
    const receipt = object(parseJson(row.value));
    const saved = object(receipt?.binding);
    if (
      !saved ||
      saved.platform !== binding.platform ||
      saved.chatId !== binding.chatId ||
      saved.messageId !== binding.messageId
    )
      throw new Error("Signer delivery binding mismatch");
    if (receipt?.state === "posted") return null;
    await ctx.runMutation(internal.decisionIntents.bindSignerCard, {
      intentId,
      signerCard: binding,
    });
    await ctx.db.patch(row._id, {
      value: JSON.stringify({ state: "posted", binding }),
      updatedAt: Date.now(),
    });
    return null;
  },
});

const labels = {
  approve: "Approve",
  reject: "Reject",
  supersede: "Supersede",
  defer: "Defer",
  enableFeed: "Enable feed",
  createListeningSession: "Save listening session",
};
/** Full payload values are retained. Oversize displays fail closed to web review. */
export const display = internalQuery({
  args: intentArgs,
  returns: v.union(
    v.null(),
    v.object({
      intentId: v.string(),
      code: v.string(),
      actionLabel: v.string(),
      targetTitle: v.string(),
      note: v.string(),
      payloadSummary: v.string(),
      payloadDigest: v.string(),
    }),
  ),
  handler: async (ctx, { intentId }) => {
    const intent = await ctx.db.get(intentId);
    if (!intent) return null;
    const target = await ctx.db.get(intent.target.id);
    if (!target) return null;
    const title =
      "title" in target && typeof target.title === "string"
        ? target.title
        : "name" in target && typeof target.name === "string"
          ? target.name
          : `${intent.target.kind} ${intent.target.id}`;
    const lines = Object.entries(intent.payload)
      .filter(([key]) => key !== "note")
      .map(
        ([key, value]) =>
          `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
      );
    if (intent.action === "createListeningSession") {
      const ratings =
        "ratings" in intent.payload ? intent.payload.ratings : undefined;
      for (const name of [
        "bodilyPleasantness",
        "goosebumps",
        "perceivedConsonance",
        "musicality",
        "easeOfComposability",
        "expandability",
      ] as const) {
        if (ratings?.[name] === undefined) lines.push(`${name}: Not given`);
      }
    }
    return {
      intentId,
      code: intent.code,
      actionLabel: labels[intent.action],
      targetTitle: title,
      note: "note" in intent.payload ? (intent.payload.note ?? "") : "",
      payloadSummary: lines.join("\n") || "No additional payload.",
      payloadDigest: intent.payloadDigest,
    };
  },
});

/** Fixed provider origins, no redirect following, bounded streamed reads. Errors
 * never include a URL, token, response body or upstream exception. */
class SignerProviderError extends Error {
  constructor(readonly permanent = false) {
    super("Signer provider request failed");
  }
}
function permanentStatus(status: number) {
  return status >= 400 && status < 500 && status !== 429;
}
async function providerRequest(
  config: Config,
  operation: "post" | "edit" | "ack",
  payload: unknown,
  signal: AbortSignal,
  messageId?: string,
) {
  const path =
    config.platform === "discord"
      ? `https://discord.com/api/v10/channels/${config.chatId}/messages${operation === "edit" ? `/${messageId}` : ""}`
      : `https://api.telegram.org/bot${config.token}/${operation === "post" ? "sendMessage" : operation === "edit" ? "editMessageText" : "answerCallbackQuery"}`;
  try {
    const response = await fetch(path, {
      method:
        config.platform === "discord" && operation === "edit"
          ? "PATCH"
          : "POST",
      redirect: "error",
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(config.platform === "discord"
          ? { Authorization: `Bot ${config.token}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });
    if (permanentStatus(response.status)) {
      await response.body?.cancel();
      throw new SignerProviderError(true);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65_536) {
          await reader.cancel();
          throw new Error();
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (!response.ok) throw new Error();
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const result = object(
      parseJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
    if (!result || (config.platform === "telegram" && result.ok !== true))
      throw new SignerProviderError(
        typeof result?.error_code === "number" &&
          permanentStatus(result.error_code),
      );
    return result;
  } catch (error) {
    if (error instanceof SignerProviderError) throw error;
    throw new SignerProviderError();
  }
}

export const deliver = internalAction({
  args: intentArgs,
  returns: v.null(),
  handler: async (ctx, { intentId }) => {
    const intent = await ctx.runQuery(internal.decisionIntents.getInternal, {
      intentId,
    });
    if (!intent || !signerDeliveryEnabled(intent.proposal)) return null;
    const config = configuration(intent.proposal.channel)!;
    const card = await ctx.runQuery(displayRef, { intentId });
    if (!card) return null;
    // Validate before consuming a permanent claim; no truncated approval cards.
    try {
      renderSignerCard(config.platform, card);
    } catch {
      return null;
    }
    if (!(await ctx.runMutation(claimRef, { intentId }))) return null;
    const result = await postSignerCard({
      destination: { platform: config.platform, chatId: config.chatId },
      card,
      post: (_destination, rendered, signal) =>
        providerRequest(
          config,
          "post",
          {
            ...rendered.payload,
            ...(config.platform === "telegram"
              ? { chat_id: config.chatId }
              : {}),
          },
          signal,
        ),
      persistBinding: async (_id, binding) => {
        // Save the actual response binding before attempting canonical bind.
        await ctx.runMutation(finishRef, {
          intentId,
          state: "binding_pending",
          binding,
        });
        await ctx.runMutation(bindDeliveredRef, { intentId, binding });
      },
    });
    if (result.status !== "posted")
      await ctx.runMutation(finishRef, {
        intentId,
        state: result.status,
        ...("binding" in result ? { binding: result.binding } : {}),
      });

    return null;
  },
});

/** Only admission runs before HTTP ACK. The scheduled mutation owns domain
 * processing and replay; card edits run after its transaction commits. */
export const admit = internalMutation({
  args: {
    event: v.object({ ...decisionEventValidator.fields, intentId: v.string() }),
  },
  returns: v.union(v.literal("queued"), v.literal("signers_only")),
  handler: async (ctx, { event: wireEvent }) => {
    const config = configuration(wireEvent.platform);
    if (!config) throw new Error("Signer is disabled");
    const intentId = ctx.db.normalizeId("decisionIntents", wireEvent.intentId);
    if (!intentId) return "signers_only";
    const event = { ...wireEvent, intentId };
    const key = `decisionSigner.event:${event.platform}:${event.eventId}`;
    const previous = await setting(ctx, key);
    if (previous)
      return object(parseJson(previous.value))?.admission === "signers_only"
        ? "signers_only"
        : "queued";
    const mapping = object(parseJson(process.env.DECISION_SIGNERS ?? "{}"));
    const mapped = mapping?.[`${event.platform}:${event.signerId}`];
    const userId =
      typeof mapped === "string" ? ctx.db.normalizeId("users", mapped) : null;
    const admission =
      !userId || !(await ctx.db.get(userId))
        ? ("signers_only" as const)
        : ("queued" as const);
    // Unknown senders still get canonical rejection receipts. This path cannot
    // authorize a new decision, and never changes an active card's controls.
    if (admission === "signers_only")
      await ctx.runMutation(internal.decisionIntents.apply, { event });
    const admissionId = await ctx.db.insert("settings", {
      key,
      value: JSON.stringify({
        admission,
        event,
        processed: admission === "signers_only",
      }),
      updatedAt: Date.now(),
    });
    if (admission === "queued")
      await ctx.scheduler.runAfter(0, processRef, { admissionId });
    return admission;
  },
});

export const processAdmission = internalMutation({
  args: { admissionId: v.id("settings") },
  returns: v.null(),
  handler: async (ctx, { admissionId }) => {
    const row = await ctx.db.get(admissionId);
    if (!row?.key.startsWith("decisionSigner.event:")) return null;
    const job = object(parseJson(row.value));
    if (!job || job.processed === true || job.admission !== "queued")
      return null;
    const event = decisionEventZ.parse(job.event);
    if (!configuration(event.platform)) return null;
    await ctx.runMutation(internal.decisionIntents.apply, { event });
    await ctx.db.patch(row._id, {
      value: JSON.stringify({ ...job, processed: true }),
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, refreshRef, { intentId: event.intentId });
    return null;
  },
});

// The budget belongs to the delivered message, not a scheduler invocation.
const cleanupKey = (intentId: string, binding: Binding) =>
  `decisionSigner.cleanup:${intentId}:${binding.platform}:${binding.chatId}:${binding.messageId}`;
const cleanupArgs = { ...intentArgs, binding: signerCardValidator };
const reserveCleanupRef = makeFunctionReference<
  "mutation",
  { intentId: Id<"decisionIntents">; binding: Binding },
  number | null
>("decisionSignerRuntime:reserveCleanup");
const finishCleanupRef = makeFunctionReference<
  "mutation",
  { intentId: Id<"decisionIntents">; binding: Binding; updated: boolean },
  null
>("decisionSignerRuntime:finishCleanup");
const MAX_CLEANUP_ATTEMPTS = 4;

export const reserveCleanup = internalMutation({
  args: cleanupArgs,
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, { intentId, binding }) => {
    const intent = await ctx.db.get(intentId);
    if (
      !intent ||
      (intent.status === "proposed" && intent.expiresAt > Date.now())
    )
      return null;
    const delivery = await setting(ctx, deliveryKey(intentId));
    const retained = signerCardZ.safeParse(
      delivery && object(parseJson(delivery.value))?.binding,
    );
    const permitted = [
      intent.signerCard,
      retained.success ? retained.data : undefined,
    ].some(
      (saved) =>
        saved &&
        saved.platform === binding.platform &&
        saved.chatId === binding.chatId &&
        saved.messageId === binding.messageId,
    );
    if (!permitted) return null;
    const key = cleanupKey(intentId, binding);
    const row = await setting(ctx, key);
    const job = row && object(parseJson(row.value));
    if (
      row &&
      (!job ||
        job.done ||
        typeof job.attempts !== "number" ||
        job.attempts >= MAX_CLEANUP_ATTEMPTS)
    )
      return null;
    const attempts = (typeof job?.attempts === "number" ? job.attempts : 0) + 1;
    const value = JSON.stringify({ attempts, done: false, updated: false });
    if (row) await ctx.db.patch(row._id, { value, updatedAt: Date.now() });
    else await ctx.db.insert("settings", { key, value, updatedAt: Date.now() });
    return attempts;
  },
});
export const finishCleanup = internalMutation({
  args: { ...cleanupArgs, updated: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { intentId, binding, updated }) => {
    const row = await setting(ctx, cleanupKey(intentId, binding));
    const job = row && object(parseJson(row.value));
    if (
      !row ||
      !job ||
      typeof job.attempts !== "number" ||
      job.updated === true
    )
      return null;
    const done = updated || job.attempts >= MAX_CLEANUP_ATTEMPTS;
    await ctx.db.patch(row._id, {
      value: JSON.stringify({ ...job, done, updated }),
      updatedAt: Date.now(),
    });
    if (!done)
      await ctx.scheduler.runAfter(5_000 * job.attempts, refreshRef, {
        intentId,
      });
    return null;
  },
});

export const refresh = internalAction({
  args: {
    ...intentArgs,
    // Accept legacy scheduled arguments; they no longer control the budget.
    attempt: v.optional(v.number()),
    watch: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { intentId, watch = false }) => {
    const intent = await ctx.runQuery(internal.decisionIntents.getInternal, {
      intentId,
    });
    if (!intent) return null;
    // A late send may never become an authorized signer card. Its verified
    // delivery address may still be used to remove obsolete controls.
    const binding =
      intent.signerCard ??
      (await ctx.runQuery(deliveredBindingRef, { intentId }));
    if (!binding) return null;
    const config = configuration(binding.platform);
    if (!config || config.chatId !== binding.chatId) return null;
    if (intent.status === "proposed" && intent.expiresAt > Date.now()) {
      // Covers web decisions without changing canonical apply. Ends at expiry.
      if (watch)
        await ctx.scheduler.runAfter(
          Math.min(60_000, intent.expiresAt - Date.now()),
          refreshRef,
          { intentId, watch: true },
        );
      return null;
    }
    if (
      (await ctx.runMutation(reserveCleanupRef, { intentId, binding })) === null
    )
      return null;
    const result = await updateSignerCard({
      binding,
      result: intent.status === "proposed" ? "expired" : intent.status,
      edit: async (_binding, rendered, signal) => {
        await providerRequest(
          config,
          "edit",
          {
            ...rendered.payload,
            ...(binding.platform === "telegram"
              ? {
                  chat_id: binding.chatId,
                  message_id: Number(binding.messageId),
                }
              : {}),
          },
          signal,
          binding.messageId,
        );
      },
    });
    await ctx.runMutation(finishCleanupRef, {
      intentId,
      binding,
      updated: result.status === "updated",
    });
    return null;
  },
});

export async function discordSignerHttp(ctx: ActionCtx, request: Request) {
  const config = configuration("discord");
  if (!config) return new Response("Not found", { status: 404 });
  return await createDiscordInteractionHandler({
    publicKey: config.publicKey!,
    applicationId: config.applicationId!,
    now: Date.now,
    enqueue: (event) =>
      ctx.runMutation(admitRef, {
        event,
      }),
  })(request);
}
export async function telegramSignerHttp(ctx: ActionCtx, request: Request) {
  const config = configuration("telegram");
  if (!config) return new Response("Not found", { status: 404 });
  return await createTelegramWebhookHandler({
    pathSecret: config.pathSecret!,
    headerSecret: config.headerSecret!,
    resolveCode: async (code) => {
      const intent = await ctx.runQuery(internal.decisionIntents.getByCode, {
        code,
      });
      return intent
        ? {
            intentId: intent._id,
            payloadDigest: intent.payloadDigest,
            signerCard: intent.signerCard,
          }
        : null;
    },
    apply: async (event) => {
      await ctx.runMutation(admitRef, {
        event,
      });
    },
    acknowledgeCallback: async (callbackQueryId) => {
      await ctx.runMutation(enqueueAckRef, { callbackQueryId });
    },
  })(request);
}

const ackArgs = { callbackQueryId: v.string() };
const enqueueAckRef = makeFunctionReference<
  "mutation",
  { callbackQueryId: string },
  null
>("decisionSignerRuntime:enqueueCallbackAck");
const ackRef = makeFunctionReference<
  "action",
  { callbackQueryId: string },
  null
>("decisionSignerRuntime:callbackAck");
const reserveAckRef = makeFunctionReference<
  "mutation",
  { callbackQueryId: string },
  number | null
>("decisionSignerRuntime:reserveCallbackAck");
const finishAckRef = makeFunctionReference<
  "mutation",
  { callbackQueryId: string; done: boolean },
  null
>("decisionSignerRuntime:finishCallbackAck");
const ackKey = (id: string) => `decisionSigner.ack:${id}`;
const MAX_ACK_ATTEMPTS = 3;

export const enqueueCallbackAck = internalMutation({
  args: ackArgs,
  returns: v.null(),
  handler: async (ctx, { callbackQueryId }) => {
    if (
      !configuration("telegram") ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(callbackQueryId)
    )
      return null;
    if (await setting(ctx, ackKey(callbackQueryId))) return null;
    await ctx.db.insert("settings", {
      key: ackKey(callbackQueryId),
      value: JSON.stringify({ attempts: 0, done: false }),
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, ackRef, { callbackQueryId });
    return null;
  },
});
export const reserveCallbackAck = internalMutation({
  args: ackArgs,
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, { callbackQueryId }) => {
    const row = await setting(ctx, ackKey(callbackQueryId));
    const job = row && object(parseJson(row.value));
    if (
      !row ||
      !job ||
      job.done ||
      typeof job.attempts !== "number" ||
      job.attempts >= MAX_ACK_ATTEMPTS
    )
      return null;
    const attempts = job.attempts + 1;
    await ctx.db.patch(row._id, {
      value: JSON.stringify({ ...job, attempts }),
      updatedAt: Date.now(),
    });
    return attempts;
  },
});
export const finishCallbackAck = internalMutation({
  args: { ...ackArgs, done: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { callbackQueryId, done }) => {
    const row = await setting(ctx, ackKey(callbackQueryId));
    const job = row && object(parseJson(row.value));
    if (!row || !job || job.done || typeof job.attempts !== "number")
      return null;
    const finished = done || job.attempts >= MAX_ACK_ATTEMPTS;
    await ctx.db.patch(row._id, {
      value: JSON.stringify({ ...job, done: finished }),
      updatedAt: Date.now(),
    });
    if (!finished)
      await ctx.scheduler.runAfter(1_000 * job.attempts, ackRef, {
        callbackQueryId,
      });
    return null;
  },
});
export const callbackAck = internalAction({
  args: ackArgs,
  returns: v.null(),
  handler: async (ctx, { callbackQueryId }) => {
    const config = configuration("telegram");
    if (
      !config ||
      (await ctx.runMutation(reserveAckRef, { callbackQueryId })) === null
    )
      return null;
    let done = false;
    try {
      await withSignerDeadline((signal) =>
        providerRequest(
          config,
          "ack",
          { callback_query_id: callbackQueryId },
          signal,
        ),
      );
      done = true;
    } catch (error) {
      done = error instanceof SignerProviderError && error.permanent;
    }
    await ctx.runMutation(finishAckRef, { callbackQueryId, done });
    return null;
  },
});
