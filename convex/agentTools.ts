// Secret-auth bridge for the agent-tool surface. Convex requires static named
// exports, so each registry entry has one export line; all behavior and args
// derive from the shared registry.
import { zodToConvexFields } from "convex-helpers/server/zod4";
import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { agentToolByName } from "./agentToolRegistry";
import { requireAgentToolSecret } from "./auth";
import type { AgentToolName } from "./shared/agentToolArgs";

export function makeAgentToolAction(name: AgentToolName) {
  const definition = agentToolByName[name];
  return action({
    args: {
      agentSecret: v.string(),
      ...zodToConvexFields(definition.args.shape),
    },
    handler: async (ctx, args) => {
      const { agentSecret, ...rest } = args as Record<string, unknown> & {
        agentSecret: string;
      };
      requireAgentToolSecret(agentSecret);
      return await definition.run(ctx, rest);
    },
  });
}

export const listRecentExtractions = makeAgentToolAction(
  "listRecentExtractions",
);
export const getExtraction = makeAgentToolAction("getExtraction");
export const listRecentHypotheses = makeAgentToolAction("listRecentHypotheses");
export const listActiveTheses = makeAgentToolAction("listActiveTheses");
export const listFailureArchive = makeAgentToolAction("listFailureArchive");
export const countPendingDrafts = makeAgentToolAction("countPendingDrafts");
export const listDraftableCorrespondences = makeAgentToolAction(
  "listDraftableCorrespondences",
);
export const getEditorialSignals = makeAgentToolAction("getEditorialSignals");
export const getRecentRecipes = makeAgentToolAction("getRecentRecipes");
export const getRecommendedActions = makeAgentToolAction(
  "getRecommendedActions",
);
export const searchSourcesByConcept = makeAgentToolAction(
  "searchSourcesByConcept",
);
export const getSelfImprovementStats = makeAgentToolAction(
  "getSelfImprovementStats",
);
export const listCorrespondenceCandidates = makeAgentToolAction(
  "listCorrespondenceCandidates",
);
export const searchClaimsSemantic = makeAgentToolAction("searchClaimsSemantic");
export const listCorrespondenceTargets = makeAgentToolAction(
  "listCorrespondenceTargets",
);
export const upsertCorrespondence = makeAgentToolAction("upsertCorrespondence");
export const addCorrespondenceEvidence = makeAgentToolAction(
  "addCorrespondenceEvidence",
);
export const getCorrespondence = makeAgentToolAction("getCorrespondence");
export const listCorrespondences = makeAgentToolAction("listCorrespondences");
export const listConceptCorrespondences = makeAgentToolAction(
  "listConceptCorrespondences",
);
export const createAgentRun = makeAgentToolAction("createAgentRun");
export const appendAgentRunEvent = makeAgentToolAction("appendAgentRunEvent");
export const markAgentRunCompleted = makeAgentToolAction(
  "markAgentRunCompleted",
);
export const markAgentRunNeedsReview = makeAgentToolAction(
  "markAgentRunNeedsReview",
);
export const createAgentReviewDraft = makeAgentToolAction(
  "createAgentReviewDraft",
);
export const markAgentRunFailed = makeAgentToolAction("markAgentRunFailed");
export const claimNextPendingRun = makeAgentToolAction("claimNextPendingRun");
export const getAgentRun = makeAgentToolAction("getAgentRun");

// ============================================================================
// SELF-IMPROVEMENT STATS - weekly brief "what the system learned" section
// (plan 05 task 5). Read-only aggregate of edit-capture volume, human draft
// review decisions, and auditable memory-recall events over a trailing
// window. Prompt promotions are intentionally NOT included here: they have
// no queryable store yet (they live in docs/eval-baselines.md plus the
// decision log via scripts/langsmith/promote.ts). Once promotions land
// somewhere queryable, wire a fourth field here rather than building a
// parallel store.
// ============================================================================

const selfImprovementStatsReturnValidator = v.object({
  windowStart: v.number(),
  windowEnd: v.number(),
  editCaptures: v.object({ count: v.number() }),
  drafts: v.object({
    approved: v.number(),
    rejected: v.number(),
    // Rejection notes are required at reject-time (see agentDrafts:reject), so
    // every rejected draft in the window contributes a note here. Capped so a
    // busy window can't blow out the agent's context.
    rejectionNotes: v.array(v.string()),
  }),
  memoryRecalls: v.object({
    count: v.number(),
    // Raw event messages (e.g. "skipped Schumann×D-root: contradicted in run
    // ..."), capped for the same reason. The memory store itself (plan 05
    // task 3) is gated on Proxmox soak, so this is usually empty today.
    notes: v.array(v.string()),
  }),
});

const MAX_NOTES = 10;

/**
 * Pure aggregation over raw rows: window-filters and summarizes edit
 * captures, decided agent-review drafts, and memory_recall run events. Kept
 * DB-free and exported so it is unit-testable without a Convex harness.
 */
export function summarizeSelfImprovementWindow(input: {
  editCaptures: Array<{ editedAt: number }>;
  decidedDrafts: Array<{
    status: string;
    updatedAt: number;
    decisionNote?: string;
  }>;
  runEvents: Array<{ kind: string; createdAt: number; message: string }>;
  windowStart: number;
  windowEnd: number;
}) {
  const { editCaptures, decidedDrafts, runEvents, windowStart, windowEnd } =
    input;
  const inWindow = (time: number) => time >= windowStart && time <= windowEnd;

  const editCapturesCount = editCaptures.filter((row) =>
    inWindow(row.editedAt),
  ).length;

  const draftsInWindow = decidedDrafts.filter((draft) =>
    inWindow(draft.updatedAt),
  );
  const approved = draftsInWindow.filter(
    (draft) => draft.status === "approved",
  ).length;
  const rejectedDrafts = draftsInWindow.filter(
    (draft) => draft.status === "rejected",
  );
  const rejectionNotes = rejectedDrafts
    .map((draft) => draft.decisionNote?.trim())
    .filter((note): note is string => Boolean(note))
    .slice(0, MAX_NOTES);

  const memoryRecallEvents = runEvents.filter(
    (event) => event.kind === "memory_recall" && inWindow(event.createdAt),
  );
  const memoryRecallNotes = memoryRecallEvents
    .map((event) => event.message)
    .slice(0, MAX_NOTES);

  return {
    windowStart,
    windowEnd,
    editCaptures: { count: editCapturesCount },
    drafts: {
      approved,
      rejected: rejectedDrafts.length,
      rejectionNotes,
    },
    memoryRecalls: {
      count: memoryRecallEvents.length,
      notes: memoryRecallNotes,
    },
  };
}

const MAX_DAYS_BACK = 90;
const DEFAULT_DAYS_BACK = 7;
const RECENT_ROWS_LIMIT = 500;

/**
 * Backing query for the `getSelfImprovementStats` agent tool. Fetches a
 * bounded set of recent rows from each source table (no new indexes needed:
 * editCaptures/agentRunEvents scan in creation order, agentReviewDrafts uses
 * the existing by_status_updatedAt index) and delegates all window logic to
 * the pure `summarizeSelfImprovementWindow` above.
 */
export const selfImprovementStats = internalQuery({
  args: { daysBack: v.optional(v.number()) },
  returns: selfImprovementStatsReturnValidator,
  handler: async (ctx, args) => {
    const windowEnd = Date.now();
    const daysBack = Math.max(
      1,
      Math.min(Math.floor(args.daysBack ?? DEFAULT_DAYS_BACK), MAX_DAYS_BACK),
    );
    const windowStart = windowEnd - daysBack * 24 * 60 * 60 * 1000;

    const [editCaptureRows, approvedDrafts, rejectedDrafts, runEventRows] =
      await Promise.all([
        ctx.db.query("editCaptures").order("desc").take(RECENT_ROWS_LIMIT),
        ctx.db
          .query("agentReviewDrafts")
          .withIndex("by_status_updatedAt", (queryBuilder) =>
            queryBuilder.eq("status", "approved"),
          )
          .order("desc")
          .take(RECENT_ROWS_LIMIT),
        ctx.db
          .query("agentReviewDrafts")
          .withIndex("by_status_updatedAt", (queryBuilder) =>
            queryBuilder.eq("status", "rejected"),
          )
          .order("desc")
          .take(RECENT_ROWS_LIMIT),
        ctx.db.query("agentRunEvents").order("desc").take(RECENT_ROWS_LIMIT),
      ]);

    return summarizeSelfImprovementWindow({
      editCaptures: editCaptureRows,
      decidedDrafts: [...approvedDrafts, ...rejectedDrafts],
      runEvents: runEventRows,
      windowStart,
      windowEnd,
    });
  },
});
