import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalQuery,
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireAuth } from "./auth";
import { assertWhyThisMatters } from "./hypotheses";
import { projectFailureArchiveHitsForHypotheses } from "./failures";
import {
  assertDecisionNote,
  assertDraftPending,
  assertRecipeHypothesisId,
  buildHypothesisInsertFromPayload,
  buildRecipeInsertFromPayload,
} from "./agentDraftPromotion";
import { completeReviewedRunIfReady } from "./agentRuns";
import { PENDING_DRAFT_CAP } from "./shared/agentContract";
import { compareDraftableCorrespondences } from "./shared/correspondenceCandidates";
import { describeConcept } from "./shared/conceptProjection";
import { agentReviewDraftPayloadValidator } from "./shared/draftPayloads";

const draftKinds = new Set(["hypothesis_draft", "recipe_draft"]);
const DRAFTABLE_CORRESPONDENCE_SCAN_LIMIT = 100;
const REVIEW_EVIDENCE_LIMIT = 20;
const REVIEW_CORRESPONDENCE_LIMIT_PER_INDEX = 20;
const REVIEW_HYPOTHESES_LIMIT_PER_CORRESPONDENCE = 5;
const REVIEW_RELATED_HYPOTHESES_LIMIT = 20;
const REVIEW_HYPOTHESIS_EDGES_PER_CONCEPT = 20;

type AgentReviewDraftKind = "hypothesis_draft" | "recipe_draft";

async function listPendingDraftsByKind(
  ctx: Pick<QueryCtx, "db">,
  kind: AgentReviewDraftKind,
) {
  return await ctx.db
    .query("agentReviewDrafts")
    .withIndex("by_status_kind_updatedAt", (q) =>
      q.eq("status", "pending_review").eq("kind", kind),
    )
    .collect();
}

async function countPendingDraftsByKind(
  ctx: Pick<QueryCtx, "db">,
  kind: AgentReviewDraftKind,
) {
  return (await listPendingDraftsByKind(ctx, kind)).length;
}

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
    ...(draft.amendedPayload !== undefined
      ? { amendedPayload: draft.amendedPayload }
      : {}),
    ...(draft.decidedAt !== undefined ? { decidedAt: draft.decidedAt } : {}),
    ...(draft.decidedBy !== undefined ? { decidedBy: draft.decidedBy } : {}),
    ...(draft.decisionNote !== undefined
      ? { decisionNote: draft.decisionNote }
      : {}),
    ...(draft.promotedId !== undefined ? { promotedId: draft.promotedId } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Deterministic dot-path diff for promotion provenance. Arrays are one field. */
export function diffDraftPayloadFields(
  original: unknown,
  amended: unknown,
  prefix = "",
): string[] {
  if (Object.is(original, amended)) return [];
  if (Array.isArray(original) || Array.isArray(amended)) {
    return JSON.stringify(original) === JSON.stringify(amended) ? [] : [prefix];
  }
  if (isRecord(original) && isRecord(amended)) {
    return Array.from(
      new Set([...Object.keys(original), ...Object.keys(amended)]),
    )
      .toSorted()
      .flatMap((key) =>
        diffDraftPayloadFields(
          original[key],
          amended[key],
          prefix ? `${prefix}.${key}` : key,
        ),
      );
  }
  return [prefix];
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
    if (
      row.kind === "hypothesis_draft" &&
      "payload" in row &&
      row.payload &&
      "statement" in row.payload &&
      row.payload.correspondenceId
    ) {
      const correspondenceId = row.payload.correspondenceId;
      const pendingDrafts = await listPendingDraftsByKind(ctx, row.kind);
      const pendingTarget = pendingDrafts.find(
        (draft) =>
          draft.payload &&
          "statement" in draft.payload &&
          draft.payload.correspondenceId === correspondenceId,
      );
      if (pendingTarget?.agentRunId === args.agentRunId) {
        return {
          draftId: pendingTarget._id,
          agentRunId: args.agentRunId,
          status: pendingTarget.status,
          updatedAt: pendingTarget.updatedAt,
        };
      }
      if (pendingTarget) {
        throw new ConvexError({
          code: "DraftTargetUnavailable",
          message:
            "Correspondence already has a hypothesis or pending hypothesis draft",
        });
      }
      if (pendingDrafts.length >= PENDING_DRAFT_CAP) {
        throw new ConvexError({
          code: "DraftCapExceeded",
          message: `Pending hypothesis drafts are capped at ${PENDING_DRAFT_CAP}`,
        });
      }
      const existingHypothesis = await ctx.db
        .query("hypotheses")
        .withIndex("by_correspondenceId", (q) =>
          q.eq("correspondenceId", correspondenceId),
        )
        .first();
      if (existingHypothesis) {
        throw new ConvexError({
          code: "DraftTargetUnavailable",
          message:
            "Correspondence already has a hypothesis or pending hypothesis draft",
        });
      }
    } else if (
      row.kind === "hypothesis_draft" &&
      (await countPendingDraftsByKind(ctx, row.kind)) >= PENDING_DRAFT_CAP
    ) {
      throw new ConvexError({
        code: "DraftCapExceeded",
        message: `Pending hypothesis drafts are capped at ${PENDING_DRAFT_CAP}`,
      });
    }

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
    .order("asc")
    .take(limit);
  return await Promise.all(
    rows.map(async (draft) => {
      const summary = summarizeAgentReviewDraft(draft);
      const correspondenceId =
        draft.kind === "hypothesis_draft" &&
        draft.payload &&
        "statement" in draft.payload
          ? draft.payload.correspondenceId
          : undefined;
      if (!correspondenceId) return summary;
      const correspondence = await ctx.db.get(correspondenceId);
      if (!correspondence) return summary;
      const [conceptA, conceptB] = await Promise.all([
        ctx.db.get(correspondence.conceptAId),
        ctx.db.get(correspondence.conceptBId),
      ]);
      if (!conceptA || !conceptB) return summary;
      return {
        ...summary,
        reviewPair: {
          conceptA: conceptA.displayName,
          conceptB: conceptB.displayName,
        },
      };
    }),
  );
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

async function listReviewCorrespondencesForConcept(
  ctx: Pick<QueryCtx, "db">,
  conceptId: Id<"concepts">,
) {
  const [asConceptA, asConceptB] = await Promise.all([
    ctx.db
      .query("correspondences")
      .withIndex("by_conceptAId", (q) => q.eq("conceptAId", conceptId))
      .take(REVIEW_CORRESPONDENCE_LIMIT_PER_INDEX),
    ctx.db
      .query("correspondences")
      .withIndex("by_conceptBId", (q) => q.eq("conceptBId", conceptId))
      .take(REVIEW_CORRESPONDENCE_LIMIT_PER_INDEX),
  ]);
  return [...asConceptA, ...asConceptB];
}

function projectReviewConcept(concept: Doc<"concepts">) {
  const description = describeConcept(concept);
  return {
    displayName: description.displayName,
    domains: description.domains,
    description: description.description,
  };
}

async function listRelatedHypotheses(
  ctx: Pick<QueryCtx, "db">,
  correspondence: Doc<"correspondences">,
) {
  const correspondenceRows = await Promise.all([
    listReviewCorrespondencesForConcept(ctx, correspondence.conceptAId),
    listReviewCorrespondencesForConcept(ctx, correspondence.conceptBId),
  ]);
  const conceptNames = await Promise.all([
    ctx.db.get(correspondence.conceptAId),
    ctx.db.get(correspondence.conceptBId),
  ]);
  const graphEdges = (
    await Promise.all(
      conceptNames.flatMap((concept) =>
        concept
          ? [
              ctx.db
                .query("edges")
                .withIndex("by_to_fromType", (q) =>
                  q
                    .eq("toType", "concept")
                    .eq("toId", concept.name)
                    .eq("fromType", "hypothesis"),
                )
                .take(REVIEW_HYPOTHESIS_EDGES_PER_CONCEPT),
            ]
          : [],
      ),
    )
  ).flat();
  const uniqueCorrespondenceIds = Array.from(
    new Set(
      correspondenceRows
        .flat()
        .map((row) => row._id)
        .concat(correspondence._id),
    ),
  );
  const rows = await Promise.all(
    uniqueCorrespondenceIds.map((correspondenceId) =>
      ctx.db
        .query("hypotheses")
        .withIndex("by_correspondenceId", (q) =>
          q.eq("correspondenceId", correspondenceId),
        )
        .order("desc")
        .take(REVIEW_HYPOTHESES_LIMIT_PER_CORRESPONDENCE),
    ),
  );
  const graphHypotheses = await Promise.all(
    graphEdges.map((edge) =>
      ctx.db.get("hypotheses", edge.fromId as Id<"hypotheses">),
    ),
  );
  const seen = new Set<string>();
  return [...rows.flat(), ...graphHypotheses]
    .filter(
      (hypothesis): hypothesis is Doc<"hypotheses"> => hypothesis !== null,
    )
    .filter((hypothesis) => {
      if (seen.has(String(hypothesis._id))) return false;
      seen.add(String(hypothesis._id));
      return true;
    })
    .toSorted((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, REVIEW_RELATED_HYPOTHESES_LIMIT);
}

/** One-round-trip context for the authenticated draft-review surface. */
export const getReviewContext = query({
  args: {
    draftId: v.id("agentReviewDrafts"),
    devBypassSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Draft not found" });
    }
    const run = await ctx.db.get(draft.agentRunId);
    const runTrace = {
      runId: draft.agentRunId,
      traceUrl: run?.traceUrl ?? null,
      summary: run?.summary ?? draft.summary,
    };
    const payloadCorrespondenceId =
      draft.kind === "hypothesis_draft" &&
      draft.payload &&
      "statement" in draft.payload
        ? draft.payload.correspondenceId
        : undefined;
    const correspondence = payloadCorrespondenceId
      ? await ctx.db.get(payloadCorrespondenceId)
      : null;

    if (!correspondence) {
      return {
        draft: summarizeAgentReviewDraft(draft),
        correspondence: null,
        related: { priorHypotheses: [], failures: [] },
        runTrace,
      };
    }

    const [conceptA, conceptB, evidenceRows, relatedHypotheses] =
      await Promise.all([
        ctx.db.get(correspondence.conceptAId),
        ctx.db.get(correspondence.conceptBId),
        Promise.all(
          correspondence.evidence
            .slice(0, REVIEW_EVIDENCE_LIMIT)
            .map(async (entry) => {
              const claim = await ctx.db.get(entry.claimId);
              if (!claim) return null;
              const source = await ctx.db.get(claim.sourceId);
              return {
                claim: {
                  text: claim.text,
                  evidenceLevel: claim.evidenceLevel,
                  truthConfidence: claim.truthConfidence ?? null,
                },
                stance: entry.stance,
                sourceTitle: source?.title ?? "Untitled source",
                sourceUrl: source?.canonicalUrl ?? null,
              };
            }),
        ),
        listRelatedHypotheses(ctx, correspondence),
      ]);
    const failureHits = await projectFailureArchiveHitsForHypotheses(
      ctx.db,
      relatedHypotheses,
    );
    return {
      draft: summarizeAgentReviewDraft(draft),
      correspondence:
        conceptA && conceptB
          ? {
              row: correspondence,
              conceptA: projectReviewConcept(conceptA),
              conceptB: projectReviewConcept(conceptB),
              evidence: evidenceRows.filter(
                (row): row is NonNullable<typeof row> => row !== null,
              ),
            }
          : null,
      related: {
        priorHypotheses: relatedHypotheses.map((hypothesis) => ({
          title: hypothesis.title,
          status: hypothesis.status,
          resolution: hypothesis.resolution ?? null,
        })),
        failures: failureHits,
      },
      runTrace,
    };
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

/** Exact hypothesis count for the review queue's WIP-cap signal. */
export const countPendingHypothesesPublic = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("agentReviewDrafts")
      .withIndex("by_status_kind_updatedAt", (q) =>
        q.eq("status", "pending_review").eq("kind", "hypothesis_draft"),
      )
      .collect();
    return rows.length;
  },
});

/** Kind-specific pending count used by WIP-capped agent graphs. */
export const countPending = internalQuery({
  args: {
    kind: v.union(v.literal("hypothesis_draft"), v.literal("recipe_draft")),
  },
  handler: async (ctx, args) => countPendingDraftsByKind(ctx, args.kind),
});

/**
 * Bounded, hydrated correspondence candidates for the hypothesis drafter.
 * Existing hypotheses, pending drafts, and evidence-less correspondences are
 * excluded at the read boundary.
 */
export const listDraftableCorrespondences = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 20), 100));
    const pendingDrafts = await ctx.db
      .query("agentReviewDrafts")
      .withIndex("by_status_kind_updatedAt", (q) =>
        q.eq("status", "pending_review").eq("kind", "hypothesis_draft"),
      )
      .collect();
    const pendingCorrespondenceIds = new Set(
      pendingDrafts.flatMap((draft) => {
        if (
          draft.kind !== "hypothesis_draft" ||
          !draft.payload ||
          !("statement" in draft.payload) ||
          !draft.payload.correspondenceId
        ) {
          return [];
        }
        return [String(draft.payload.correspondenceId)];
      }),
    );
    const [evidenced, conjectured] = await Promise.all([
      ctx.db
        .query("correspondences")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", "evidenced"))
        .take(DRAFTABLE_CORRESPONDENCE_SCAN_LIMIT),
      ctx.db
        .query("correspondences")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", "conjectured"))
        .take(DRAFTABLE_CORRESPONDENCE_SCAN_LIMIT),
    ]);
    const ranked = [...evidenced, ...conjectured]
      .filter((row) => row.evidence.length > 0)
      .toSorted(compareDraftableCorrespondences);
    const selected = [];
    for (const row of ranked) {
      if (selected.length >= limit) break;
      if (pendingCorrespondenceIds.has(String(row._id))) continue;
      // Lazy membership check: only rows that survive the cheaper filters and
      // are still needed pay the by_correspondenceId read (avoids an up-front
      // query per ranked row).
      const existingHypothesis = await ctx.db
        .query("hypotheses")
        .withIndex("by_correspondenceId", (q) =>
          q.eq("correspondenceId", row._id),
        )
        .first();
      if (existingHypothesis !== null) continue;
      const [conceptA, conceptB, evidenceClaims] = await Promise.all([
        ctx.db.get("concepts", row.conceptAId),
        ctx.db.get("concepts", row.conceptBId),
        Promise.all(
          row.evidence.map(async (entry) => {
            const claim = await ctx.db.get("claims", entry.claimId);
            return claim
              ? {
                  claimId: claim._id,
                  text: claim.text,
                  sourceId: claim.sourceId,
                  extractionId: claim.extractionId,
                  stance: entry.stance,
                  ...(entry.note ? { note: entry.note } : {}),
                }
              : null;
          }),
        ),
      ]);
      if (!conceptA || !conceptB) continue;
      selected.push({
        correspondenceId: row._id,
        pairKey: row.pairKey,
        statement: row.statement,
        rationaleMd: row.rationaleMd,
        status: row.status,
        similarityScore: row.similarityScore,
        noveltyScore: row.noveltyScore,
        conceptA: { id: conceptA._id, ...describeConcept(conceptA) },
        conceptB: { id: conceptB._id, ...describeConcept(conceptB) },
        evidenceClaims: evidenceClaims.filter(
          (claim): claim is NonNullable<typeof claim> => claim !== null,
        ),
      });
    }
    return selected;
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
    amendedPayload: v.optional(agentReviewDraftPayloadValidator),
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

    const promotionPayload = args.amendedPayload ?? draft.payload;
    const amendmentMatchesKind =
      (draft.kind === "hypothesis_draft" && "statement" in promotionPayload) ||
      (draft.kind === "recipe_draft" && "parameters" in promotionPayload);
    if (!amendmentMatchesKind) {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: `${draft.kind} amended payload shape mismatch`,
        field: "amendedPayload",
      });
    }
    const editedFields = args.amendedPayload
      ? diffDraftPayloadFields(draft.payload, args.amendedPayload)
      : [];
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
      ...(editedFields.length > 0
        ? { approvedWithEdits: true as const, editedFields }
        : {}),
    };

    let promotedId: Id<"hypotheses"> | Id<"recipes">;
    let promotedKind: "hypothesis" | "recipe";
    let promotedCorrespondenceId: Id<"correspondences"> | undefined;
    if (draft.kind === "hypothesis_draft") {
      if (!("statement" in promotionPayload)) {
        throw new ConvexError({
          code: "INVALID_STATE",
          message: "hypothesis_draft payload shape mismatch",
          field: "payload",
        });
      }
      const hypothesisId = await ctx.db.insert(
        "hypotheses",
        buildHypothesisInsertFromPayload({
          payload: promotionPayload,
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
      promotedCorrespondenceId = promotionPayload.correspondenceId;
    } else {
      if (!("parameters" in promotionPayload)) {
        throw new ConvexError({
          code: "INVALID_STATE",
          message: "recipe_draft payload shape mismatch",
          field: "payload",
        });
      }
      const hypothesisId = assertRecipeHypothesisId(promotionPayload);
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
          payload: promotionPayload,
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
      ...(args.amendedPayload ? { amendedPayload: args.amendedPayload } : {}),
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
