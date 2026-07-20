// Convex-only bindings from the pure manifest to backing function references
// and behavior. Cross-workspace consumers import the manifest, not this file.
import { makeFunctionReference } from "convex/server";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { AgentToolName } from "./shared/agentToolArgs";
import {
  AGENT_TOOL_MANIFEST,
  type AgentToolManifestEntry,
} from "./shared/agentToolManifest";

export type AgentToolDef = AgentToolManifestEntry & {
  run: (ctx: ActionCtx, args: Record<string, unknown>) => Promise<unknown>;
};

const queryRef = (name: string) => makeFunctionReference<"query">(name);
const mutationRef = (name: string) => makeFunctionReference<"mutation">(name);
const actionRef = (name: string) => makeFunctionReference<"action">(name);

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => child !== undefined),
  ) as T;
}

const runs: Record<AgentToolName, AgentToolDef["run"]> = {
  listRecentExtractions: (ctx, args) =>
    ctx.runQuery(queryRef("extractions:listRecent"), {
      limit: (args.limit as number) ?? 20,
    }),
  getExtraction: (ctx, args) =>
    ctx.runQuery(queryRef("extractions:get"), { id: args.id }),
  listRecentHypotheses: (ctx, args) =>
    ctx.runQuery(queryRef("hypotheses:listByStatus"), {
      limit: (args.limit as number) ?? 20,
    }),
  listActiveTheses: (ctx, args) =>
    ctx.runQuery(queryRef("theses:list"), {
      status: "active",
      limit: (args.limit as number) ?? 20,
    }),
  listFailureArchive: (ctx, args) =>
    ctx.runQuery(queryRef("failures:listArchive"), {
      limit: (args.limit as number) ?? 20,
    }),
  getEditorialSignals: (ctx, args) =>
    ctx.runQuery(queryRef("dashboard:editorialSignals"), {
      limit: (args.limit as number) ?? 24,
    }),
  getRecentRecipes: (ctx, args) =>
    ctx.runQuery(queryRef("recipes:listByStatus"), {
      limit: (args.limit as number) ?? 20,
    }),
  getRecommendedActions: (ctx) =>
    ctx.runQuery(queryRef("campaigns:getRecommendedActions"), {}),
  searchSourcesByConcept: (ctx, args) =>
    ctx.runQuery(queryRef("graph:searchSourcesByConcept"), {
      conceptName: args.conceptName,
      limit: (args.limit as number) ?? 20,
    }),
  getSelfImprovementStats: (ctx, args) =>
    ctx.runQuery(internal.agentTools.selfImprovementStats, {
      daysBack: args.daysBack as number | undefined,
    }),
  listCorrespondenceCandidates: (ctx, args) =>
    ctx.runAction(
      actionRef("correspondenceCandidates:listForAgent"),
      omitUndefined({
        limit: args.limit,
        seedConceptId: args.seedConceptId,
      }),
    ),
  searchClaimsSemantic: (ctx, args) =>
    ctx.runAction(
      actionRef("correspondenceCandidates:searchClaimsSemantic"),
      omitUndefined({ text: args.text, limit: args.limit }),
    ),
  listCorrespondenceTargets: (ctx, args) =>
    ctx.runQuery(
      queryRef("correspondenceCandidates:listEvidenceTargets"),
      omitUndefined({ limit: args.limit }),
    ),
  getCorrespondence: (ctx, args) =>
    ctx.runQuery(queryRef("correspondences:getByPairKey"), {
      pairKey: args.pairKey,
    }),
  listCorrespondences: (ctx, args) =>
    ctx.runQuery(queryRef("correspondences:listByStatus"), {
      status: args.status,
      limit: (args.limit as number) ?? 20,
    }),
  listConceptCorrespondences: (ctx, args) =>
    ctx.runQuery(queryRef("correspondences:listForConcept"), {
      conceptId: args.conceptId,
      limit: (args.limit as number) ?? 20,
    }),
  upsertCorrespondence: (ctx, args) =>
    ctx.runMutation(
      mutationRef("correspondences:upsertConjectureFromAgent"),
      omitUndefined({
        conceptAId: args.conceptAId,
        conceptBId: args.conceptBId,
        statement: args.statement,
        rationaleMd: args.rationaleMd,
        relationship: args.relationship,
        similarityScore: args.similarityScore,
        noveltyScore: args.noveltyScore,
        agentRunId: args.agentRunId,
        traceUrl: args.traceUrl,
      }),
    ),
  addCorrespondenceEvidence: (ctx, args) =>
    ctx.runMutation(
      mutationRef("correspondences:addEvidenceFromAgent"),
      omitUndefined({
        correspondenceId: args.correspondenceId,
        claimId: args.claimId,
        stance: args.stance,
        note: args.note,
        agentRunId: args.agentRunId,
      }),
    ),
  createAgentRun: async (ctx, args) => {
    const created = (await ctx.runMutation(
      mutationRef("agentRuns:create"),
      omitUndefined({
        graphName: args.graphName,
        input: args.input,
        traceUrl: args.traceUrl,
      }),
    )) as { runId: string; createdAt: number };
    const running = (await ctx.runMutation(
      mutationRef("agentRuns:markRunning"),
      { runId: created.runId },
    )) as { status: string; startedAt: number; updatedAt: number };
    return {
      runId: created.runId,
      status: running.status,
      createdAt: created.createdAt,
      startedAt: running.startedAt,
      updatedAt: running.updatedAt,
    };
  },
  appendAgentRunEvent: (ctx, args) =>
    ctx.runMutation(
      mutationRef("agentRuns:appendEvent"),
      omitUndefined({
        runId: args.runId,
        kind: args.kind,
        message: args.message,
        payload: args.payload,
      }),
    ),
  markAgentRunCompleted: (ctx, args) =>
    ctx.runMutation(
      mutationRef("agentRuns:markCompleted"),
      omitUndefined({
        runId: args.runId,
        summary: args.summary,
        traceUrl: args.traceUrl,
      }),
    ),
  markAgentRunNeedsReview: (ctx, args) =>
    ctx.runMutation(
      mutationRef("agentRuns:markNeedsReview"),
      omitUndefined({
        runId: args.runId,
        summary: args.summary,
        reviewDraft: args.reviewDraft,
      }),
    ),
  createAgentReviewDraft: (ctx, args) =>
    ctx.runMutation(mutationRef("agentDrafts:createFromAgentRun"), {
      agentRunId: args.agentRunId,
      draft: args.draft,
    }),
  markAgentRunFailed: (ctx, args) =>
    ctx.runMutation(
      mutationRef("agentRuns:markFailed"),
      omitUndefined({
        runId: args.runId,
        summary: args.summary,
        error: args.error,
        traceUrl: args.traceUrl,
      }),
    ),
  claimNextPendingRun: (ctx, args) =>
    ctx.runMutation(
      mutationRef("agentRuns:claimNextPending"),
      omitUndefined({
        workerId: args.workerId,
        graphName: args.graphName,
      }),
    ),
  getAgentRun: (ctx, args) =>
    ctx.runQuery(queryRef("agentRuns:getForWorker"), { runId: args.runId }),
};

export const AGENT_TOOL_REGISTRY: readonly AgentToolDef[] =
  AGENT_TOOL_MANIFEST.map((entry) => ({
    ...entry,
    run: runs[entry.name],
  }));

export const agentToolByName = Object.fromEntries(
  AGENT_TOOL_REGISTRY.map((definition) => [definition.name, definition]),
) as Record<AgentToolName, AgentToolDef>;
