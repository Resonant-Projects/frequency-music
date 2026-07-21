/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireAuth, type AppIdentity } from "./auth";
import { pairKey } from "./shared/correspondenceKey";
import { correspondenceStatusValidator } from "./shared/correspondences";
import { correspondenceReturnValidator } from "./validators";

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const MOVEMENT_LIMIT_PER_STATUS = 1000;
const AUTO_RETIRE_PAGE_SIZE = 500;
const SCOUT_DOMAIN_SCAN_LIMIT = 50;
const SCOUT_CONCEPTS_PER_DOMAIN_LIMIT = 50;
const SCOUT_TOTAL_CONCEPT_LIMIT = 200;
const SCOUT_SOURCE_EDGES_PER_CONCEPT_LIMIT = 100;
const SCOUT_CONJECTURE_SCAN_LIMIT = 100;
const SCOUT_TARGET_LIMIT = 5;
export const AUTO_RETIRE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

export function scoutConceptLimitPerDomain(domainCount: number): number {
  return Math.max(
    1,
    Math.min(
      SCOUT_CONCEPTS_PER_DOMAIN_LIMIT,
      Math.floor(SCOUT_TOTAL_CONCEPT_LIMIT / Math.max(1, domainCount)),
    ),
  );
}

type CorrespondenceStatus = Doc<"correspondences">["status"];
type Evidence = Doc<"correspondences">["evidence"][number];

type UpsertInput = {
  conceptAId: Id<"concepts">;
  conceptBId: Id<"concepts">;
  statement: string;
  rationaleMd: string;
  relationship?: string;
  similarityScore?: number;
  noveltyScore?: number;
  agentRunId?: Id<"agentRuns">;
  traceUrl?: string;
};

type AddEvidenceInput = {
  correspondenceId: Id<"correspondences">;
  claimId: Id<"claims">;
  stance: Evidence["stance"];
  note?: string;
  agentRunId?: Id<"agentRuns">;
};

function correspondenceError(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIST_LIMIT;
  return Math.max(1, Math.min(Math.floor(limit), MAX_LIST_LIMIT));
}

export const scoutTargets = query({
  args: {},
  returns: v.object({
    thinDomains: v.array(
      v.object({
        domain: v.string(),
        onMissionConceptCount: v.number(),
        sourceCount: v.number(),
      }),
    ),
    starvedConjectures: v.array(
      v.object({
        correspondenceId: v.id("correspondences"),
        statement: v.string(),
        conceptA: v.string(),
        conceptB: v.string(),
        evidenceCount: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const domainRows = await ctx.db
      .query("conceptDomains")
      .take(SCOUT_DOMAIN_SCAN_LIMIT);
    const activeDomains = domainRows
      .filter((domain) => domain.status !== "deprecated")
      .toSorted((left, right) => left.name.localeCompare(right.name));

    const conceptLimitPerDomain = scoutConceptLimitPerDomain(
      activeDomains.length,
    );
    const domainCounts: Array<{
      domain: string;
      onMissionConceptCount: number;
      sourceCount: number;
    }> = [];
    for (const domain of activeDomains) {
      const domainConcepts = await ctx.db
        .query("concepts")
        .withIndex("by_domain", (q) => q.eq("domain", domain.name))
        .take(conceptLimitPerDomain);
      const concepts = domainConcepts.filter(
        (concept) => concept.missionRelevance === "on",
      );
      if (concepts.length === 0) continue;

      const sourceIds = new Set<string>();
      for (const concept of concepts) {
        const edges = await ctx.db
          .query("edges")
          .withIndex("by_to_fromType", (q) =>
            q
              .eq("toType", "concept")
              .eq("toId", concept.name)
              .eq("fromType", "source"),
          )
          .take(SCOUT_SOURCE_EDGES_PER_CONCEPT_LIMIT);
        for (const edge of edges) sourceIds.add(edge.fromId);
      }
      domainCounts.push({
        domain: domain.name,
        onMissionConceptCount: concepts.length,
        sourceCount: sourceIds.size,
      });
    }

    const conjectures = await ctx.db
      .query("correspondences")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "conjectured"))
      .order("asc")
      .take(SCOUT_CONJECTURE_SCAN_LIMIT);
    const rankedConjectures = conjectures.toSorted(
      (left, right) =>
        left.evidence.length - right.evidence.length ||
        left.updatedAt - right.updatedAt ||
        left._id.localeCompare(right._id),
    );
    const hydratedConjectures = await Promise.all(
      rankedConjectures.map(async (correspondence) => {
        const [conceptA, conceptB] = await Promise.all([
          ctx.db.get("concepts", correspondence.conceptAId),
          ctx.db.get("concepts", correspondence.conceptBId),
        ]);
        if (!conceptA || !conceptB) return null;
        return {
          correspondenceId: correspondence._id,
          statement: correspondence.statement,
          conceptA: conceptA.name,
          conceptB: conceptB.name,
          evidenceCount: correspondence.evidence.length,
        };
      }),
    );

    return {
      thinDomains: domainCounts
        .toSorted(
          (left, right) =>
            left.sourceCount - right.sourceCount ||
            left.domain.localeCompare(right.domain),
        )
        .slice(0, SCOUT_TARGET_LIMIT),
      starvedConjectures: hydratedConjectures
        .filter(
          (target): target is NonNullable<typeof target> => target !== null,
        )
        .slice(0, SCOUT_TARGET_LIMIT),
    };
  },
});

function normalizedDomains(concept: Doc<"concepts">): string[] {
  if (
    !concept.domains?.length ||
    !concept.missionRelevance ||
    concept.missionRelevance === "unreviewed"
  ) {
    correspondenceError(
      "UNCLASSIFIED_CONCEPT",
      `Concept ${concept._id} must have classified missionRelevance and domains`,
    );
  }
  return [...new Set(concept.domains)].toSorted();
}

async function validateConceptPair(
  ctx: MutationCtx,
  conceptAId: Id<"concepts">,
  conceptBId: Id<"concepts">,
) {
  if (conceptAId === conceptBId) {
    correspondenceError(
      "SAME_DOMAIN_PAIR",
      "A correspondence requires two different cross-domain concepts",
    );
  }

  const [conceptA, conceptB] = await Promise.all([
    ctx.db.get("concepts", conceptAId),
    ctx.db.get("concepts", conceptBId),
  ]);
  if (!conceptA || !conceptB) {
    correspondenceError(
      "CONCEPT_NOT_FOUND",
      "Correspondence concept not found",
    );
  }
  if (
    conceptA.missionRelevance === "off" ||
    conceptB.missionRelevance === "off"
  ) {
    correspondenceError(
      "OFF_MISSION_CONCEPT",
      "Correspondences require both concepts to be on-mission",
    );
  }

  const domainsA = normalizedDomains(conceptA);
  const domainsB = normalizedDomains(conceptB);
  if (
    domainsA.length === domainsB.length &&
    domainsA.every((domain, index) => domain === domainsB[index])
  ) {
    correspondenceError(
      "SAME_DOMAIN_PAIR",
      "Correspondence concepts must have different domain sets",
    );
  }
}

async function validateAgentRun(
  ctx: MutationCtx,
  agentRunId: Id<"agentRuns"> | undefined,
) {
  if (agentRunId && !(await ctx.db.get("agentRuns", agentRunId))) {
    correspondenceError("AGENT_RUN_NOT_FOUND", "Agent run not found");
  }
}

function mergeHigherScore(
  previous: number | undefined,
  candidate: number | undefined,
): number | undefined {
  if (candidate === undefined) return previous;
  if (previous === undefined) return candidate;
  return Math.max(previous, candidate);
}

function mergedRationale(previous: string, addendum: string): string {
  if (
    previous === addendum ||
    previous.includes(`\n\nAddendum:\n${addendum}`)
  ) {
    return previous;
  }
  return `${previous}\n\nAddendum:\n${addendum}`;
}

async function upsertConjectureImpl(
  ctx: MutationCtx,
  input: UpsertInput,
  identity: AppIdentity,
) {
  await validateConceptPair(ctx, input.conceptAId, input.conceptBId);
  await validateAgentRun(ctx, input.agentRunId);

  const key = pairKey(input.conceptAId, input.conceptBId);
  const existing = await ctx.db
    .query("correspondences")
    .withIndex("by_pairKey", (q) => q.eq("pairKey", key))
    .first();
  const now = Date.now();
  if (existing) {
    await ctx.db.patch("correspondences", existing._id, {
      rationaleMd: mergedRationale(existing.rationaleMd, input.rationaleMd),
      similarityScore: mergeHigherScore(
        existing.similarityScore,
        input.similarityScore,
      ),
      noveltyScore: mergeHigherScore(existing.noveltyScore, input.noveltyScore),
      updatedAt: now,
    });
    return { id: existing._id, created: false };
  }

  const [conceptAId, conceptBId] =
    input.conceptAId < input.conceptBId
      ? [input.conceptAId, input.conceptBId]
      : [input.conceptBId, input.conceptAId];
  const id = await ctx.db.insert("correspondences", {
    conceptAId,
    conceptBId,
    pairKey: key,
    statement: input.statement,
    rationaleMd: input.rationaleMd,
    relationship: input.relationship,
    evidence: [],
    status: "conjectured",
    similarityScore: input.similarityScore,
    noveltyScore: input.noveltyScore,
    origin: input.agentRunId ? "agent" : undefined,
    agentRunId: input.agentRunId,
    traceUrl: input.traceUrl,
    createdBy:
      identity.subject === "system"
        ? "system"
        : (identity.subject as Id<"users">),
    createdAt: now,
    updatedAt: now,
  });
  return { id, created: true };
}

function recomputeEvidenceStatus(
  status: CorrespondenceStatus,
  evidence: Evidence[],
): CorrespondenceStatus {
  if (status === "retired") return status;
  const supporting = evidence.filter(
    (citation) => citation.stance === "supports",
  ).length;
  const contradicting = evidence.length - supporting;
  if (contradicting > supporting) return "contradicted";
  if (supporting > 0) return "evidenced";
  return "conjectured";
}

async function addEvidenceImpl(
  ctx: MutationCtx,
  input: AddEvidenceInput,
  addedBy: Evidence["addedBy"],
) {
  await validateAgentRun(ctx, input.agentRunId);
  const [correspondence, claim] = await Promise.all([
    ctx.db.get("correspondences", input.correspondenceId),
    ctx.db.get("claims", input.claimId),
  ]);
  if (!correspondence) {
    correspondenceError("CORRESPONDENCE_NOT_FOUND", "Correspondence not found");
  }
  if (!claim) correspondenceError("CLAIM_NOT_FOUND", "Claim not found");

  const duplicate = correspondence.evidence.some(
    (citation) =>
      citation.claimId === input.claimId && citation.stance === input.stance,
  );
  if (duplicate) {
    return { added: false, status: correspondence.status };
  }

  const now = Date.now();
  const evidence: Evidence[] = [
    ...correspondence.evidence,
    {
      claimId: input.claimId,
      stance: input.stance,
      note: input.note,
      addedBy,
      addedAt: now,
    },
  ];
  const status = recomputeEvidenceStatus(correspondence.status, evidence);
  await ctx.db.patch("correspondences", correspondence._id, {
    evidence,
    status,
    statusChangedAt:
      status === correspondence.status ? correspondence.statusChangedAt : now,
    statusReason:
      status === correspondence.status
        ? correspondence.statusReason
        : undefined,
    updatedAt: now,
  });
  return { added: true, status };
}

const upsertArgs = {
  conceptAId: v.id("concepts"),
  conceptBId: v.id("concepts"),
  statement: v.string(),
  rationaleMd: v.string(),
  relationship: v.optional(v.string()),
  similarityScore: v.optional(v.number()),
  noveltyScore: v.optional(v.number()),
  agentRunId: v.optional(v.id("agentRuns")),
  traceUrl: v.optional(v.string()),
};

const addEvidenceArgs = {
  correspondenceId: v.id("correspondences"),
  claimId: v.id("claims"),
  stance: v.union(v.literal("supports"), v.literal("contradicts")),
  note: v.optional(v.string()),
  agentRunId: v.optional(v.id("agentRuns")),
};

export const upsertConjecture = mutation({
  args: { ...upsertArgs, devBypassSecret: v.optional(v.string()) },
  returns: v.object({ id: v.id("correspondences"), created: v.boolean() }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    const { devBypassSecret: _devBypassSecret, ...input } = args;
    return await upsertConjectureImpl(ctx, input, identity);
  },
});

export const upsertConjectureFromAgent = internalMutation({
  args: upsertArgs,
  returns: v.object({ id: v.id("correspondences"), created: v.boolean() }),
  handler: async (ctx, args) => {
    if (!args.agentRunId) {
      correspondenceError(
        "AGENT_RUN_REQUIRED",
        "Agent correspondence writes require an agentRunId",
      );
    }
    return await upsertConjectureImpl(ctx, args, {
      subject: "system",
      tokenIdentifier: "agent-tool",
      isBypass: true,
    });
  },
});

export const addEvidence = mutation({
  args: { ...addEvidenceArgs, devBypassSecret: v.optional(v.string()) },
  returns: v.object({
    added: v.boolean(),
    status: correspondenceStatusValidator,
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const { devBypassSecret: _devBypassSecret, ...input } = args;
    return await addEvidenceImpl(
      ctx,
      input,
      input.agentRunId ? "agent" : "human",
    );
  },
});

export const addEvidenceFromAgent = internalMutation({
  args: addEvidenceArgs,
  returns: v.object({
    added: v.boolean(),
    status: correspondenceStatusValidator,
  }),
  handler: async (ctx, args) => {
    if (!args.agentRunId) {
      correspondenceError(
        "AGENT_RUN_REQUIRED",
        "Agent evidence writes require an agentRunId",
      );
    }
    return await addEvidenceImpl(ctx, args, "agent");
  },
});

export const setStatus = mutation({
  args: {
    correspondenceId: v.id("correspondences"),
    status: correspondenceStatusValidator,
    statusReason: v.string(),
    agentRunId: v.optional(v.id("agentRuns")),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    if (!args.statusReason.trim()) {
      correspondenceError("STATUS_REASON_REQUIRED", "statusReason is required");
    }
    const correspondence = await ctx.db.get(
      "correspondences",
      args.correspondenceId,
    );
    if (!correspondence) {
      correspondenceError(
        "CORRESPONDENCE_NOT_FOUND",
        "Correspondence not found",
      );
    }
    // Agent-provenanced calls (agentRunId present) may only auto-retire a
    // conjectured row — they can never force any other transition. Humans get
    // full transitions: this includes CLI callers, who authenticate via
    // devBypass and are mapped to subject "system" (see auth.ts), so we key the
    // restriction on agent provenance, NOT on the system subject — otherwise
    // the documented CLI path (the only manual surface until plan 07's UI) could
    // never un-retire or override a status.
    const isAgentCaller = args.agentRunId !== undefined;
    if (
      isAgentCaller &&
      !(correspondence.status === "conjectured" && args.status === "retired")
    ) {
      correspondenceError(
        "INVALID_STATUS_TRANSITION",
        "Agent callers may only retire conjectured correspondences",
      );
    }
    await validateAgentRun(ctx, args.agentRunId);
    const now = Date.now();
    await ctx.db.patch("correspondences", correspondence._id, {
      status: args.status,
      statusReason: args.statusReason.trim(),
      statusChangedAt:
        args.status === correspondence.status
          ? correspondence.statusChangedAt
          : now,
      updatedAt: now,
    });
    return null;
  },
});

export const getByPairKey = query({
  args: { pairKey: v.string() },
  returns: v.union(correspondenceReturnValidator, v.null()),
  handler: async (ctx, args) =>
    await ctx.db
      .query("correspondences")
      .withIndex("by_pairKey", (q) => q.eq("pairKey", args.pairKey))
      .first(),
});

export const listByStatus = query({
  args: {
    status: correspondenceStatusValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(correspondenceReturnValidator),
  handler: async (ctx, args) =>
    await ctx.db
      .query("correspondences")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", args.status))
      .order("desc")
      .take(clampLimit(args.limit)),
});

export const listForConcept = query({
  args: { conceptId: v.id("concepts"), limit: v.optional(v.number()) },
  returns: v.array(correspondenceReturnValidator),
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit);
    const [asConceptA, asConceptB] = await Promise.all([
      ctx.db
        .query("correspondences")
        .withIndex("by_conceptAId", (q) => q.eq("conceptAId", args.conceptId))
        .take(limit),
      ctx.db
        .query("correspondences")
        .withIndex("by_conceptBId", (q) => q.eq("conceptBId", args.conceptId))
        .take(limit),
    ]);
    return [...asConceptA, ...asConceptB]
      .toSorted((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit);
  },
});

export const listRecentMovement = query({
  args: { since: v.number() },
  returns: v.array(correspondenceReturnValidator),
  handler: async (ctx, args) => {
    const statuses: CorrespondenceStatus[] = [
      "conjectured",
      "evidenced",
      "contradicted",
      "retired",
    ];
    const rows = await Promise.all(
      statuses.map((status) =>
        ctx.db
          .query("correspondences")
          .withIndex("by_status_updatedAt", (q) =>
            q.eq("status", status).gte("updatedAt", args.since),
          )
          // Descending so the cap keeps the NEWEST movements, not the oldest —
          // an ascending take() would silently drop the most recent rows when a
          // status has more than the cap of movements in the window.
          .order("desc")
          .take(MOVEMENT_LIMIT_PER_STATUS),
      ),
    );
    return rows
      .flat()
      .filter(
        (row) =>
          (row.statusChangedAt !== undefined &&
            row.statusChangedAt >= args.since) ||
          row.evidence.some((citation) => citation.addedAt >= args.since),
      )
      .toSorted((left, right) => right.updatedAt - left.updatedAt);
  },
});

const autoRetireStaleRef = makeFunctionReference<"mutation">(
  "correspondences:autoRetireStale",
);

export const autoRetireStale = internalMutation({
  args: { now: v.optional(v.number()), cursor: v.optional(v.string()) },
  returns: v.object({ retired: v.number(), continued: v.boolean() }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const staleBefore = now - AUTO_RETIRE_AFTER_MS;
    const page = await ctx.db
      .query("correspondences")
      .withIndex("by_status_updatedAt", (q) =>
        q.eq("status", "conjectured").lte("updatedAt", staleBefore),
      )
      .paginate({
        numItems: AUTO_RETIRE_PAGE_SIZE,
        cursor: args.cursor ?? null,
      });
    const stale = page.page.filter((row) => row.evidence.length === 0);
    await Promise.all(
      stale.map((row) =>
        ctx.db.patch("correspondences", row._id, {
          status: "retired",
          statusReason: "stale conjecture (auto)",
          statusChangedAt: now,
          updatedAt: now,
        }),
      ),
    );
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, autoRetireStaleRef, {
        now,
        cursor: page.continueCursor,
      });
    }
    return { retired: stale.length, continued: !page.isDone };
  },
});
