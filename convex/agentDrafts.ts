import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireAuth } from "./auth";
import { assertWhyThisMatters } from "./hypotheses";
import {
  assertDecisionNote,
  assertDraftPending,
  assertRecipeHypothesisId,
  buildHypothesisInsertFromPayload,
  buildRecipeInsertFromPayload,
} from "./agentDraftPromotion";
import { completeReviewedRunIfReady } from "./agentRuns";

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

// Recursively redact secret-shaped substrings in a structured payload. IDs and
// ordinary strings pass through unchanged (the regex only touches key=secret
// patterns), so this is safe to run over the whole payload object.
function redactDeep(value: unknown): unknown {
  if (typeof value === "string") return redactOperationalSecrets(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, val]) => [
        k,
        redactDeep(val),
      ]),
    );
  }
  return value;
}

export function safeAgentReviewDraft(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const draft = value as {
    kind?: unknown;
    title?: unknown;
    summary?: unknown;
    candidateIds?: unknown;
    needsReview?: unknown;
    payload?: unknown;
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

  const base = {
    kind: draft.kind as AgentReviewDraftKind,
    title: redactOperationalSecrets(draft.title).slice(0, 240),
    summary: redactOperationalSecrets(draft.summary).slice(0, 4000),
    candidateIds: draft.candidateIds.map((id) =>
      redactOperationalSecrets(id).slice(0, 160),
    ),
    needsReview: true as const,
  };

  // Structured promotion payload is optional; Convex's schema validator enforces
  // its exact shape on insert. Attach only when present so legacy payload-less
  // dry-run drafts round-trip unchanged.
  if (draft.payload && typeof draft.payload === "object") {
    return { ...base, payload: redactDeep(draft.payload) };
  }
  return base;
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
  const row = {
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

  if (
    "payload" in draft &&
    draft.payload &&
    typeof draft.payload === "object"
  ) {
    // Enforce the musical stake at draft-creation time, not just at promotion.
    const whyThisMatters = (draft.payload as { whyThisMatters?: unknown })
      .whyThisMatters;
    if (typeof whyThisMatters !== "string") {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "payload.whyThisMatters is required",
        field: "payload.whyThisMatters",
      });
    }
    assertWhyThisMatters(whyThisMatters, "payload.whyThisMatters");
    return {
      ...row,
      payload: draft.payload as Doc<"agentReviewDrafts">["payload"],
    };
  }
  return row;
}

export function summarizeAgentReviewDraftPublic(
  draft: Doc<"agentReviewDrafts">,
) {
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

export function summarizeAgentReviewDraft(draft: Doc<"agentReviewDrafts">) {
  return {
    ...summarizeAgentReviewDraftPublic(draft),
    // Decision + payload fields only appear once set, so legacy drafts and the
    // existing exact-equality summary tests round-trip unchanged.
    ...(draft.payload !== undefined ? { payload: draft.payload } : {}),
    ...(draft.decidedAt !== undefined ? { decidedAt: draft.decidedAt } : {}),
    ...(draft.decidedBy !== undefined ? { decidedBy: draft.decidedBy } : {}),
    ...(draft.decisionNote !== undefined
      ? { decisionNote: draft.decisionNote }
      : {}),
    ...(draft.promotedId !== undefined ? { promotedId: draft.promotedId } : {}),
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
    return rows.map(summarizeAgentReviewDraftPublic);
  },
});

/** Persisted draft records for the authenticated human review UI. */
export const listByRun = query({
  args: {
    agentRunId: v.id("agentRuns"),
    limit: v.optional(v.number()),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
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

async function listPendingDrafts(ctx: QueryCtx, args: { limit?: number }) {
  const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 25), 100));
  const rows = await ctx.db
    .query("agentReviewDrafts")
    .withIndex("by_status_updatedAt", (q) => q.eq("status", "pending_review"))
    .order("desc")
    .take(limit);
  return rows.map(summarizeAgentReviewDraft);
}

/** Pending-review queue for the authenticated human review UI. */
export const listPending = query({
  args: {
    limit: v.optional(v.number()),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return listPendingDrafts(ctx, args);
  },
});

/** Deprecated compatibility name; still authenticated because the queue is human-only. */
export const listPendingPublic = query({
  args: {
    limit: v.optional(v.number()),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return listPendingDrafts(ctx, args);
  },
});

/** Lightweight public count for navigation badges; does not expose draft content. */
export const countPendingPublic = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("agentReviewDrafts")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "pending_review"))
      .collect();
    return rows.length;
  },
});

// ============================================================================
// HUMAN DECISION MUTATIONS
// ============================================================================
// These are Clerk-authenticated human mutations. They are intentionally NOT
// exposed through the /agent-tools/* surface: agents must never approve, reject,
// or promote their own drafts. Approval promotes the draft into a real
// hypothesis/recipe row (full whyThisMatters enforcement + provenance).

export const approve = mutation({
  args: {
    draftId: v.id("agentReviewDrafts"),
    decisionNote: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    draftId: v.id("agentReviewDrafts"),
    promotedId: v.union(v.id("hypotheses"), v.id("recipes")),
    promotedKind: v.union(v.literal("hypothesis"), v.literal("recipe")),
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    const draft = await ctx.db.get(args.draftId);
    if (!draft)
      throw new ConvexError({ code: "NOT_FOUND", message: "Draft not found" });
    assertDraftPending(draft.status);
    if (!draft.payload) {
      throw new ConvexError({
        code: "INVALID_STATE",
        message:
          "Draft has no structured payload and is acknowledge-only (not promotable)",
        field: "payload",
      });
    }

    const now = Date.now();
    const createdBy =
      identity.subject === "system"
        ? "system"
        : (identity.subject as Id<"users">);
    const run = await ctx.db.get(draft.agentRunId);
    const provenance = {
      agentRunId: draft.agentRunId,
      agentDraftId: draft._id,
      ...(run?.traceUrl ? { traceUrl: run.traceUrl } : {}),
    };

    let promotedId: Id<"hypotheses"> | Id<"recipes">;
    let promotedKind: "hypothesis" | "recipe";
    let promotedCorrespondenceId: Id<"correspondences"> | undefined;
    if (draft.kind === "hypothesis_draft") {
      if (!("statement" in draft.payload)) {
        throw new ConvexError({
          code: "INVALID_STATE",
          message: "hypothesis_draft payload shape mismatch",
          field: "payload",
        });
      }
      const hypothesisId = await ctx.db.insert(
        "hypotheses",
        buildHypothesisInsertFromPayload({
          payload: draft.payload,
          provenance,
          createdBy,
          now,
        }),
      );
      // Concept linking is an action; schedule it (mutations cannot await actions).
      await ctx.scheduler.runAfter(0, internal.graph.linkHypothesisConcepts, {
        hypothesisId,
      });
      promotedId = hypothesisId;
      promotedKind = "hypothesis";
      promotedCorrespondenceId = draft.payload.correspondenceId;
    } else {
      if (!("parameters" in draft.payload)) {
        throw new ConvexError({
          code: "INVALID_STATE",
          message: "recipe_draft payload shape mismatch",
          field: "payload",
        });
      }
      const hypothesisId = assertRecipeHypothesisId(draft.payload);
      const hypothesis = await ctx.db.get(hypothesisId);
      if (!hypothesis) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Referenced hypothesis not found",
          field: "payload.hypothesisId",
        });
      }
      const recipeId = await ctx.db.insert(
        "recipes",
        buildRecipeInsertFromPayload({
          payload: draft.payload,
          provenance,
          createdBy,
          now,
        }),
      );
      promotedId = recipeId;
      promotedKind = "recipe";
    }

    await ctx.db.patch(args.draftId, {
      status: "approved",
      promotedId,
      decidedAt: now,
      decidedBy: "human",
      ...(args.decisionNote?.trim()
        ? { decisionNote: args.decisionNote.trim() }
        : {}),
      updatedAt: now,
    });
    await ctx.db.insert("agentRunEvents", {
      runId: draft.agentRunId,
      kind: "draft_write",
      message: `Approved ${draft.kind}; promoted to ${promotedKind} ${promotedId}`,
      payload: { draftId: args.draftId, promotedId, promotedKind },
      createdAt: now,
    });
    if (promotedCorrespondenceId) {
      await ctx.db.insert("agentRunEvents", {
        runId: draft.agentRunId,
        kind: "decision",
        message: "Promoted correspondence-linked hypothesis",
        payload: {
          draftId: args.draftId,
          hypothesisId: promotedId,
          correspondenceId: promotedCorrespondenceId,
        },
        createdAt: now,
      });
    }
    await completeReviewedRunIfReady(ctx, draft.agentRunId, now);
    return { draftId: args.draftId, promotedId, promotedKind };
  },
});

export const reject = mutation({
  args: {
    draftId: v.id("agentReviewDrafts"),
    decisionNote: v.string(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    draftId: v.id("agentReviewDrafts"),
    status: v.literal("rejected"),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    // Rejections are learning signal for plan 05 — a note is always required.
    const note = assertDecisionNote(args.decisionNote);
    const draft = await ctx.db.get(args.draftId);
    if (!draft)
      throw new ConvexError({ code: "NOT_FOUND", message: "Draft not found" });
    assertDraftPending(draft.status);

    const now = Date.now();
    await ctx.db.patch(args.draftId, {
      status: "rejected",
      decidedAt: now,
      decidedBy: "human",
      decisionNote: note,
      updatedAt: now,
    });
    await ctx.db.insert("agentRunEvents", {
      runId: draft.agentRunId,
      kind: "decision",
      message: "Rejected agent draft",
      payload: { draftId: args.draftId, note },
      createdAt: now,
    });
    await completeReviewedRunIfReady(ctx, draft.agentRunId, now);
    return { draftId: args.draftId, status: "rejected" as const };
  },
});

export const supersede = mutation({
  args: {
    draftId: v.id("agentReviewDrafts"),
    byDraftId: v.id("agentReviewDrafts"),
    decisionNote: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    draftId: v.id("agentReviewDrafts"),
    status: v.literal("superseded"),
    byDraftId: v.id("agentReviewDrafts"),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const draft = await ctx.db.get(args.draftId);
    if (!draft)
      throw new ConvexError({ code: "NOT_FOUND", message: "Draft not found" });
    assertDraftPending(draft.status);
    const superseding = await ctx.db.get(args.byDraftId);
    if (!superseding) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Superseding draft not found",
      });
    }
    if (args.draftId === args.byDraftId) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "A draft cannot supersede itself",
        field: "byDraftId",
      });
    }
    assertDraftPending(superseding.status);

    const now = Date.now();
    await ctx.db.patch(args.draftId, {
      status: "superseded",
      promotedId: args.byDraftId,
      decidedAt: now,
      decidedBy: "human",
      ...(args.decisionNote?.trim()
        ? { decisionNote: args.decisionNote.trim() }
        : {}),
      updatedAt: now,
    });
    await completeReviewedRunIfReady(ctx, draft.agentRunId, now);
    return {
      draftId: args.draftId,
      status: "superseded" as const,
      byDraftId: args.byDraftId,
    };
  },
});
