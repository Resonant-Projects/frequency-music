import { docketAudioUrlZ } from "./shared/docketTools";
import { makeFunctionReference } from "convex/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { HOUSE_VOICE_KEY, readSetting, writeSetting } from "./settings";
import { RENDERER_VERSION_FOR_JOBS } from "./shared/mediaJobs";
import { voiceById } from "./shared/voices";
import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireHumanIdentity } from "./decisionIdentity";
import { feedProposalZ } from "./shared/feedProposals";
import { isGeneralFeedbackAudio } from "./shared/audioRatingKeys";
import { isHumanListeningSession } from "./shared/listeningPredicates";
import { stableContentDigest } from "./shared/decisionIntents";
import {
  DOCKET_LIST_LIMIT,
  DOCKET_REBUILD_MS,
  DOCKET_REBUILD_LEASE_MS,
  DOCKET_PROMPT_VERSION,
  docketBlurbZ,
  docketBlurbValidator,
  docketRebuildStateZ,
  DOCKET_WEEKLY_LIMIT,
  DELIVERY_POSTED_MS,
  DELIVERY_POSTING_MS,
  docketCandidateValidator,
  docketCardReturnValidator,
  type DocketCandidate,
} from "./shared/docket";

/** Every persisted recipe field except identity and timestamps. The docket card
 * version and signed recipe decisions share it, so neither can miss an edit. */
export function recipeDecisionContent(row: Doc<"recipes">) {
  const {
    _id: _rowId,
    _creationTime: _rowCreated,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...content
  } = row;
  return content;
}
function unratedAudioSemantic(row: Doc<"audioArtifacts">) {
  return { title: row.title, contentHash: row.contentHash };
}
/** The `unratedAudio` card content hash, so Listen can defer what it shows. */
export async function unratedAudioCardHash(
  row: Doc<"audioArtifacts">,
): Promise<string> {
  return await stableContentDigest(unratedAudioSemantic(row));
}

/** Text-only census: no age cutoff and no recipe-level collapse of listening debt. */
async function eligible(
  ctx: QueryCtx | MutationCtx,
): Promise<DocketCandidate[]> {
  const [
    drafts,
    recipes,
    compositions,
    sessions,
    artifacts,
    ratings,
    audioRatings,
    blindGroups,
    feeds,
  ] = await Promise.all([
    ctx.db
      .query("agentReviewDrafts")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "pending_review"))
      .collect(),
    ctx.db.query("recipes").collect(),
    ctx.db.query("compositions").collect(),
    ctx.db.query("listeningSessions").collect(),
    ctx.db
      .query("audioArtifacts")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "ready"))
      .collect(),
    ctx.db.query("voiceRatings").collect(),
    ctx.db.query("audioRatings").collect(),
    ctx.db.query("blindGroups").collect(),
    ctx.db
      .query("feeds")
      .withIndex("by_enabled", (q) => q.eq("enabled", false))
      .collect(),
  ]);
  const composed = new Set(compositions.map((row) => row.recipeId));
  const heard = new Set(
    sessions.filter(isHumanListeningSession).map((row) => row.compositionId),
  );
  const rated = new Set(
    ratings
      .filter((row) => row.createdBy !== "system" && row.createdBy !== "agent")
      .map((row) => row.artifactId),
  );
  // General ratings count only for the content version that was heard.
  const ratedVersions = new Set(
    audioRatings.map((row) => `${row.artifactId}:${row.artifactContentHash}`),
  );
  // Check both membership directions so a missing artifact back-reference cannot leak.
  const hidden = new Set(
    blindGroups
      .filter((group) => group.revealedAt === undefined)
      .flatMap((group) => group.members.map((member) => member.artifactId)),
  );
  const groups = new Map(blindGroups.map((group) => [group._id, group]));
  const rows: DocketCandidate[] = [];
  const add = async (
    kind: DocketCandidate["kind"],
    targetId: string,
    title: string,
    text: string,
    pageUrl: string,
    decisions: string[],
    debtSince: number,
    semantic: unknown,
  ) => {
    // This content identity is deterministic and excludes operational timestamps.
    // Blurb generation/narration is a separate follow-up; existing source text is usable now.
    rows.push({
      kind,
      targetId,
      title,
      blurbMd: text,
      spokenBlurb: "",
      pageUrl,
      decisions,
      contentHash: await stableContentDigest(semantic),
      rank: 0,
      debtSince,
    });
  };
  for (const row of drafts)
    await add(
      "pendingDraft",
      row._id,
      row.title,
      row.summary,
      `/agent-drafts?draft=${row._id}`,
      row.payload
        ? ["approve", "reject", "supersede", "defer"]
        : ["reject", "supersede", "defer"],
      row.createdAt,
      { title: row.title, summary: row.summary, payload: row.payload },
    );
  for (const row of recipes)
    if (
      (row.status === "draft" || row.status === "in_use") &&
      !composed.has(row._id)
    )
      await add(
        "recipeNoComposition",
        row._id,
        row.title,
        row.bodyMd,
        `/recipes/${row._id}`,
        ["defer"],
        row.createdAt,
        recipeDecisionContent(row),
      );
  for (const row of compositions)
    if (row.status === "rendered" && !heard.has(row._id))
      await add(
        "compositionNoListening",
        row._id,
        row.title,
        row.projectNotesMd ?? "Human listening feedback is pending.",
        `/compositions/${row._id}`,
        ["createListeningSession", "defer"],
        row.createdAt,
        { title: row.title, notes: row.projectNotesMd, version: row.version },
      );
  for (const row of artifacts)
    if (
      // Masters share the render's kind; only the delivery is listening debt.
      isGeneralFeedbackAudio(row) &&
      !rated.has(row._id) &&
      !ratedVersions.has(`${row._id}:${row.contentHash}`) &&
      !hidden.has(row._id) &&
      (!row.blindGroupId ||
        groups.get(row.blindGroupId)?.revealedAt !== undefined)
    )
      await add(
        "unratedAudio",
        row._id,
        row.title,
        "Human audio rating is pending.",
        `/listen?audio=${row._id}`,
        ["rateAudio", "defer"],
        row.createdAt,
        unratedAudioSemantic(row),
      );
  for (const row of feeds) {
    const proposal = feedProposalZ.safeParse(row.metadata?.proposal);
    if (proposal.success)
      await add(
        "feedProposal",
        row._id,
        row.name,
        proposal.data.rationale,
        "/admin",
        ["enableFeed", "defer"],
        row.createdAt,
        { name: row.name, url: row.url, proposal: proposal.data },
      );
  }
  rows.sort(
    (a, b) =>
      Number(b.kind === "pendingDraft") - Number(a.kind === "pendingDraft") ||
      a.debtSince - b.debtSince ||
      a.targetId.localeCompare(b.targetId),
  );
  return [...new Map(rows.map((row) => [row.targetId, row])).values()].map(
    (row, rank) => ({ ...row, rank }),
  );
}
export const currentState = internalQuery({
  args: {},
  returns: v.array(docketCandidateValidator),
  handler: eligible,
});

/** Refresh text immediately; inference is admitted separately and never blocks reads.
 * Returns the eligible, currently undeferred cards. */
export async function reconcileDocket(ctx: MutationCtx) {
  const candidates = await eligible(ctx);
  const existing = await ctx.db.query("docketCards").collect();
  const byTarget = new Map(existing.map((card) => [card.targetId, card]));
  const now = Date.now();
  const cards = [];
  for (const { debtSince: _debtSince, ...candidate } of candidates) {
    const old = byTarget.get(candidate.targetId);
    if (old) {
      if (old.contentHash !== candidate.contentHash) {
        await ctx.db.patch(old._id, {
          ...candidate,
          blurbArtifactId: undefined,
          updatedAt: now,
        });
        await markDocketStale(ctx);
      } else if (
        old.rank !== candidate.rank ||
        old.pageUrl !== candidate.pageUrl ||
        old.decisions.join() !== candidate.decisions.join()
      ) {
        // Links and decision vocabularies can change without a semantic change.
        await ctx.db.patch(old._id, {
          rank: candidate.rank,
          pageUrl: candidate.pageUrl,
          decisions: candidate.decisions,
        });
      }
      const card = await ctx.db.get(old._id);
      if (card) cards.push(card);
    } else {
      const id = await ctx.db.insert("docketCards", {
        ...candidate,
        createdAt: now,
        updatedAt: now,
      });
      await markDocketStale(ctx);
      const card = await ctx.db.get(id);
      if (card) cards.push(card);
    }
  }
  // Keep inactive cards and their receipts for audit/deferral continuity. Reads
  // intersect with the live eligibility census, so they cannot resurface stale debt.
  return cards.filter(
    (card) => !card.deferredUntil || card.deferredUntil <= now,
  );
}
export const list = internalMutation({
  args: { weekly: v.optional(v.boolean()) },
  returns: v.array(docketCardReturnValidator),
  handler: async (ctx, args) => {
    const cards = await reconcileDocket(ctx);
    await admitRebuild(ctx);
    return await Promise.all(
      cards
        .slice(0, args.weekly ? DOCKET_WEEKLY_LIMIT : DOCKET_LIST_LIMIT)
        .map((card) => safePlaybackCard(ctx, card)),
    );
  },
});
export const card = internalQuery({
  args: { cardId: v.id("docketCards") },
  returns: v.union(docketCardReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card || (card.deferredUntil ?? 0) > Date.now()) return null;
    const candidate = (await eligible(ctx)).find(
      (candidate) => candidate.targetId === card.targetId,
    );
    if (!candidate) return null;
    return await safePlaybackCard(ctx, currentCard(card, candidate));
  },
});
export const listWeb = query({
  args: {},
  returns: v.array(docketCandidateValidator),
  handler: async (ctx) => {
    await requireHumanIdentity(ctx);
    const cards = await ctx.db.query("docketCards").collect();
    const deferred = new Set(
      cards
        .filter((card) => (card.deferredUntil ?? 0) > Date.now())
        .map((card) => card.targetId),
    );
    const byTarget = new Map(cards.map((card) => [card.targetId, card]));
    return (await eligible(ctx))
      .filter((card) => !deferred.has(card.targetId))
      .slice(0, DOCKET_LIST_LIMIT)
      .map((candidate) => {
        const stored = byTarget.get(candidate.targetId);
        return stored?.contentHash === candidate.contentHash
          ? {
              ...candidate,
              blurbMd: stored.blurbMd,
              spokenBlurb: stored.spokenBlurb,
            }
          : candidate;
      });
  },
});

/** Posting admission is atomic; callers must send ONLY when admitted is true. */
export const recordDelivery = internalMutation({
  args: {
    cardId: v.id("docketCards"),
    channel: v.string(),
    contentHash: v.string(),
    phase: v.union(v.literal("posting"), v.literal("posted")),
    deliveryId: v.optional(v.id("docketDeliveries")),
    messageRef: v.optional(v.string()),
  },
  returns: v.object({
    admitted: v.boolean(),
    deliveryId: v.id("docketDeliveries"),
    updated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) throw new ConvexError("Docket card not found");
    const now = Date.now();
    if (args.phase === "posted") {
      if (!args.deliveryId || !args.messageRef?.trim())
        throw new ConvexError("Posting receipt and message reference required");
      const receipt = await ctx.db.get(args.deliveryId);
      if (
        !receipt ||
        receipt.cardId !== args.cardId ||
        receipt.channel !== args.channel ||
        receipt.contentHash !== args.contentHash
      )
        throw new ConvexError("Delivery receipt mismatch");
      if (receipt.phase === "posted") {
        if (receipt.messageRef !== args.messageRef)
          throw new ConvexError(
            "Delivery already completed with another message",
          );
      } else
        await ctx.db.patch(receipt._id, {
          phase: "posted",
          postedAt: now,
          messageRef: args.messageRef,
        });
      return { admitted: false, deliveryId: receipt._id, updated: false };
    }
    if (
      card.contentHash !== args.contentHash ||
      (card.deferredUntil ?? 0) > now ||
      !(await eligible(ctx)).some(
        (row) =>
          row.targetId === card.targetId &&
          row.contentHash === args.contentHash,
      )
    )
      throw new ConvexError("Docket card changed or is no longer eligible");
    const receipts = await ctx.db
      .query("docketDeliveries")
      .withIndex("by_card_channel", (q) =>
        q.eq("cardId", args.cardId).eq("channel", args.channel),
      )
      .collect();
    const suppressed = receipts.find((receipt) =>
      receipt.phase === "posting"
        ? receipt.postingAt > now - DELIVERY_POSTING_MS
        : receipt.contentHash === args.contentHash &&
          (receipt.postedAt ?? 0) > now - DELIVERY_POSTED_MS,
    );
    if (suppressed)
      return { admitted: false, deliveryId: suppressed._id, updated: false };
    const deliveryId = await ctx.db.insert("docketDeliveries", {
      cardId: args.cardId,
      channel: args.channel,
      contentHash: args.contentHash,
      phase: "posting",
      postingAt: now,
    });
    return {
      admitted: true,
      deliveryId,
      updated: receipts.some(
        (receipt) =>
          receipt.phase === "posted" &&
          receipt.contentHash !== args.contentHash,
      ),
    };
  },
});

// Read paths never expose generated copy or audio for an obsolete semantic version.
function currentCard(
  card: Doc<"docketCards">,
  candidate: DocketCandidate,
): Doc<"docketCards"> {
  if (card.contentHash === candidate.contentHash)
    return { ...card, rank: candidate.rank };
  const { debtSince: _debtSince, ...fresh } = candidate;
  return { ...card, ...fresh, blurbArtifactId: undefined };
}

export const DOCKET_REBUILD_KEY = "docketRebuildState.v1";
export function docketPreparationEnabled(): boolean {
  return process.env.DOCKET_PREPARATION_ENABLED === "true";
}
async function rebuildState(ctx: Pick<QueryCtx, "db">) {
  const value = await readSetting(ctx, DOCKET_REBUILD_KEY);
  return docketRebuildStateZ.parse(value ? JSON.parse(value) : {});
}

/** Call in the same mutation as a new draft or completed media result. */
export async function markDocketStale(ctx: MutationCtx): Promise<void> {
  const state = await rebuildState(ctx);
  await writeSetting(
    ctx,
    DOCKET_REBUILD_KEY,
    JSON.stringify({ ...state, revision: state.revision + 1 }),
  );
}

const rebuildAction = makeFunctionReference<"action", { token: number }, null>(
  "docketBlurbs:rebuild",
);
async function admitRebuild(ctx: MutationCtx): Promise<boolean> {
  if (!docketPreparationEnabled()) return false;
  const state = await rebuildState(ctx);
  const now = Date.now();
  if (
    state.startedAt !== undefined &&
    now - state.startedAt < DOCKET_REBUILD_LEASE_MS
  )
    return false;
  if (
    state.completedRevision === state.revision &&
    state.completedAt !== undefined &&
    now - state.completedAt < DOCKET_REBUILD_MS
  )
    return false;
  const token = state.token + 1;
  await writeSetting(
    ctx,
    DOCKET_REBUILD_KEY,
    JSON.stringify({
      ...state,
      token,
      startedAt: now,
      admittedRevision: state.revision,
    }),
  );
  await ctx.scheduler.runAfter(0, rebuildAction, { token });
  return true;
}

// Preparation only: neither this cron entry nor the action posts to a channel.
export const prepare = internalMutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    await reconcileDocket(ctx);
    return await admitRebuild(ctx);
  },
});

export const rebuildCards = internalQuery({
  args: { token: v.number() },
  returns: v.array(docketCardReturnValidator),
  handler: async (ctx, { token }) => {
    const state = await rebuildState(ctx);
    if (
      !docketPreparationEnabled() ||
      state.token !== token ||
      state.startedAt === undefined
    )
      return [];
    const candidates = new Map(
      (await eligible(ctx)).map((row) => [row.targetId, row]),
    );
    return (await ctx.db.query("docketCards").collect())
      .filter(
        (card) =>
          (card.deferredUntil ?? 0) <= Date.now() &&
          candidates.has(card.targetId),
      )
      .map((card) => currentCard(card, candidates.get(card.targetId)!))
      .toSorted((a, b) => a.rank - b.rank)
      .slice(0, DOCKET_LIST_LIMIT);
  },
});

async function activeVersion(
  ctx: MutationCtx,
  token: number,
  cardId: Doc<"docketCards">["_id"],
  contentHash: string,
) {
  const state = await rebuildState(ctx);
  if (
    !docketPreparationEnabled() ||
    state.token !== token ||
    state.startedAt === undefined ||
    Date.now() - state.startedAt >= DOCKET_REBUILD_LEASE_MS
  )
    return null;
  const card = await ctx.db.get(cardId);
  if (
    !card ||
    card.contentHash !== contentHash ||
    (card.deferredUntil ?? 0) > Date.now()
  )
    return null;
  return (await eligible(ctx)).some(
    (row) => row.targetId === card.targetId && row.contentHash === contentHash,
  )
    ? card
    : null;
}

const versionArgs = {
  token: v.number(),
  cardId: v.id("docketCards"),
  contentHash: v.string(),
};
export const claimBlurb = internalMutation({
  args: versionArgs,
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const card = await activeVersion(
      ctx,
      args.token,
      args.cardId,
      args.contentHash,
    );
    if (!card || card.spokenBlurb) return false;
    const key = `docketBlurbAttempt:${card._id}`;
    if ((await readSetting(ctx, key)) === args.contentHash) return false;
    // One inference attempt per semantic version, even across an action crash.
    await writeSetting(ctx, key, args.contentHash);
    return true;
  },
});
export const saveBlurb = internalMutation({
  args: { ...versionArgs, blurb: docketBlurbValidator },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const card = await activeVersion(
      ctx,
      args.token,
      args.cardId,
      args.contentHash,
    );
    if (!card) return false;
    const blurb = docketBlurbZ.parse(args.blurb);
    await ctx.db.patch(card._id, {
      ...blurb,
      blurbArtifactId: undefined,
      updatedAt: Date.now(),
    });
    return true;
  },
});
export const narrateCard = internalMutation({
  args: versionArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const card = await activeVersion(
      ctx,
      args.token,
      args.cardId,
      args.contentHash,
    );
    const voiceId = await readSetting(ctx, HOUSE_VOICE_KEY);
    if (!card?.spokenBlurb || !voiceId) return null;
    voiceById(voiceId);
    // Remember admission independently of generated text. A failed/parked media job
    // is an operator retry, not permission for every hourly rebuild to spend again.
    const key = `docketNarration:${card._id}`;
    const signature = JSON.stringify([card.contentHash, voiceId]);
    if ((await readSetting(ctx, key)) === signature) return null;
    await ctx.runMutation(internal.mediaJobs.enqueue, {
      input: {
        kind: "narrate",
        script: {
          paragraphs: [card.spokenBlurb],
          chapters: [{ title: "Docket card", startParagraph: 0 }],
        },
        voiceId,
        promptVersion: `${DOCKET_PROMPT_VERSION}:${card.contentHash}`,
        target: "spoken",
        title: card.title,
        access: "private",
        refs: { docketCardId: card._id },
        assembleOnDone: false,
        rendererVersion: RENDERER_VERSION_FOR_JOBS,
      },
    });
    await writeSetting(ctx, key, signature);
    return null;
  },
});
export const finishRebuild = internalMutation({
  args: { token: v.number() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const state = await rebuildState(ctx);
    if (state.token !== token || state.startedAt === undefined) return null;
    await writeSetting(
      ctx,
      DOCKET_REBUILD_KEY,
      JSON.stringify({
        ...state,
        startedAt: undefined,
        completedAt: Date.now(),
        completedRevision: state.admittedRevision,
      }),
    );
    return null;
  },
});

/** Only the current private narration may become the card's playback reference. */
export async function attachDocketNarration(
  ctx: MutationCtx,
  job: Doc<"mediaJobs">,
  delivery: Doc<"audioArtifacts">,
): Promise<void> {
  const input = job.input;
  if (input.kind !== "narrate" || !input.refs.docketCardId) return;
  if (
    input.access !== "private" ||
    input.assembleOnDone ||
    delivery.access !== "private" ||
    delivery.kind !== "narration" ||
    delivery.role !== "delivery" ||
    delivery.refs.docketCardId !== input.refs.docketCardId ||
    delivery.refs.mediaJobId !== job._id ||
    delivery.blindGroupId
  )
    throw new ConvexError("Invalid docket narration result");
  const cardId = ctx.db.normalizeId("docketCards", input.refs.docketCardId);
  if (!cardId) return;
  const card = await ctx.db.get(cardId);
  if (
    !card ||
    input.promptVersion !== `${DOCKET_PROMPT_VERSION}:${card.contentHash}` ||
    input.script.paragraphs.join(" ") !== card.spokenBlurb ||
    (await readSetting(ctx, HOUSE_VOICE_KEY)) !== input.voiceId ||
    (card.deferredUntil ?? 0) > Date.now()
  )
    return;
  const hidden = (await ctx.db.query("blindGroups").collect()).some(
    (group) =>
      group.revealedAt === undefined &&
      group.members.some((member) => member.artifactId === delivery._id),
  );
  if (
    hidden ||
    !(await eligible(ctx)).some(
      (row) =>
        row.targetId === card.targetId && row.contentHash === card.contentHash,
    )
  )
    return;
  await ctx.db.patch(card._id, {
    blurbArtifactId: delivery._id,
    updatedAt: Date.now(),
  });
}

async function safePlaybackCard(
  ctx: QueryCtx | MutationCtx,
  card: Doc<"docketCards">,
): Promise<Doc<"docketCards">> {
  if (!card.blurbArtifactId) return card;
  const artifact = await ctx.db.get(card.blurbArtifactId);
  const groups = await ctx.db.query("blindGroups").collect();
  const hidden = groups.some(
    (group) =>
      group.revealedAt === undefined &&
      (group._id === artifact?.blindGroupId ||
        group.members.some(
          (member) => member.artifactId === card.blurbArtifactId,
        )),
  );
  if (
    !artifact ||
    artifact.status !== "ready" ||
    artifact.kind !== "narration" ||
    artifact.role !== "delivery" ||
    artifact.access !== "private" ||
    artifact.refs.docketCardId !== card._id ||
    hidden ||
    (artifact.blindGroupId &&
      !groups.some(
        (group) =>
          group._id === artifact.blindGroupId && group.revealedAt !== undefined,
      ))
  )
    return { ...card, blurbArtifactId: undefined };
  return card;
}

/** Resolve only this card's current narration, never an arbitrary artifact ID. */
export const playbackForCard = internalQuery({
  args: { cardId: v.id("docketCards"), contentHash: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const stored = await ctx.db.get(args.cardId);
    if (
      !stored ||
      stored.contentHash !== args.contentHash ||
      (stored.deferredUntil ?? 0) > Date.now()
    )
      return null;
    const candidate = (await eligible(ctx)).find(
      (row) => row.targetId === stored.targetId,
    );
    if (!candidate || candidate.contentHash !== args.contentHash) return null;
    const card = await safePlaybackCard(ctx, stored);
    if (!card.blurbArtifactId) return null;
    const artifact = await ctx.db.get(card.blurbArtifactId);
    const jobId =
      artifact?.refs.mediaJobId &&
      ctx.db.normalizeId("mediaJobs", artifact.refs.mediaJobId);
    const job = jobId ? await ctx.db.get(jobId) : null;
    if (
      !job ||
      job.status !== "done" ||
      job.input.kind !== "narrate" ||
      !job.resultArtifactIds?.includes(card.blurbArtifactId)
    )
      return null;
    const input = job.input;
    if (
      input.access !== "private" ||
      input.assembleOnDone ||
      input.refs.docketCardId !== card._id ||
      input.promptVersion !== `${DOCKET_PROMPT_VERSION}:${card.contentHash}` ||
      input.script.paragraphs.join(" ") !== card.spokenBlurb ||
      (await readSetting(ctx, HOUSE_VOICE_KEY)) !== input.voiceId
    )
      return null;
    const playback = await ctx.runQuery(
      internal.audioArtifacts.playbackInternal,
      { artifactId: card.blurbArtifactId },
    );
    const url = docketAudioUrlZ.safeParse(playback?.url);
    return url.success ? url.data : null;
  },
});
