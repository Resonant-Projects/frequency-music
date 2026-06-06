import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";

const draftKinds = new Set(["hypothesis_draft", "recipe_draft"]);

type AgentReviewDraftKind = "hypothesis_draft" | "recipe_draft";

function redactOperationalSecrets(value: string) {
  return value
    .replaceAll(
      /((?:api[_-]?key|secret|token|password|passwd)\s*[=:]\s*)[^\s"'}]+/gi,
      "$1[REDACTED]",
    )
    .replaceAll(/(PVEAPIToken=)[^\s"'}]+/gi, "$1[REDACTED]");
}

export function safeAgentReviewDraft(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const draft = value as {
    kind?: unknown;
    title?: unknown;
    summary?: unknown;
    candidateIds?: unknown;
    needsReview?: unknown;
  };
  if (typeof draft.kind !== "string" || !draftKinds.has(draft.kind))
    return undefined;
  if (typeof draft.title !== "string" || !draft.title.trim()) return undefined;
  if (typeof draft.summary !== "string" || !draft.summary.trim())
    return undefined;
  if (!Array.isArray(draft.candidateIds) || draft.candidateIds.length === 0)
    return undefined;
  if (
    !draft.candidateIds.every(
      (id) => typeof id === "string" && id.trim().length > 0,
    )
  ) {
    return undefined;
  }
  if (draft.needsReview !== true) return undefined;

  return {
    kind: draft.kind as AgentReviewDraftKind,
    title: redactOperationalSecrets(draft.title).slice(0, 240),
    summary: redactOperationalSecrets(draft.summary).slice(0, 4000),
    candidateIds: draft.candidateIds.map((id) =>
      redactOperationalSecrets(id).slice(0, 160),
    ),
    needsReview: true,
  };
}

export function buildAgentReviewDraftInsert(input: {
  agentRunId: Id<"agentRuns">;
  graphName: string;
  draft: unknown;
  now?: number;
}) {
  const draft = safeAgentReviewDraft(input.draft);
  if (!draft) return undefined;
  const now = input.now ?? Date.now();
  return {
    agentRunId: input.agentRunId,
    graphName: input.graphName,
    kind: draft.kind,
    title: draft.title,
    summary: draft.summary,
    candidateIds: draft.candidateIds,
    status: "pending_review" as const,
    createdBy: "agent" as const,
    createdAt: now,
    updatedAt: now,
  };
}

export function summarizeAgentReviewDraft(draft: Doc<"agentReviewDrafts">) {
  return {
    _id: draft._id,
    _creationTime: draft._creationTime,
    agentRunId: draft.agentRunId,
    graphName: draft.graphName,
    kind: draft.kind,
    title: draft.title,
    summary: draft.summary,
    candidateIds: draft.candidateIds,
    status: draft.status,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

export const createFromAgentRun = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    draft: v.any(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.agentRunId);
    if (!run) throw new Error("Agent run not found");

    const row = buildAgentReviewDraftInsert({
      agentRunId: args.agentRunId,
      graphName: run.graphName,
      draft: args.draft,
    });
    if (!row) throw new Error("Invalid human-review draft");

    const draftId = await ctx.db.insert("agentReviewDrafts", row);
    const now = Date.now();
    await ctx.db.insert("agentRunEvents", {
      runId: args.agentRunId,
      kind: "draft_write",
      message: "Persisted agent human-review draft",
      payload: {
        draftId,
        draftKind: row.kind,
        title: row.title,
        candidateIds: row.candidateIds,
      },
      createdAt: now,
    });
    await ctx.db.patch(args.agentRunId, { updatedAt: now });

    return {
      draftId,
      agentRunId: args.agentRunId,
      status: row.status,
      updatedAt: now,
    };
  },
});

export const listByRunPublic = query({
  args: {
    agentRunId: v.id("agentRuns"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 10), 25));
    const rows = await ctx.db
      .query("agentReviewDrafts")
      .withIndex("by_agentRunId_updatedAt", (q) =>
        q.eq("agentRunId", args.agentRunId),
      )
      .order("desc")
      .take(limit);
    return rows.map(summarizeAgentReviewDraft);
  },
});
