import { agentToolArgs } from "./shared/agentToolArgs";
import {
  assertBoundedProposal,
  projectDocketCard,
  projectProposal,
  docketListResultZ,
  deliveryRecordResultZ,
} from "./shared/docketTools";
// Convex-only bindings from the pure manifest to backing function references
// and behavior. Cross-workspace consumers import the manifest, not this file.
import { makeFunctionReference } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import type { ScoutedContentProvider } from "./shared/agentContract";
import type { AgentToolName } from "./shared/agentToolArgs";
import { correspondenceSeed, inversionSeeds } from "./hypothesisTournament";
import { tournamentSeedZ } from "./shared/hypothesisTournament";
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

async function projectPlayableCard(
  ctx: ActionCtx,
  row: { _id: string; contentHash: string; blurbArtifactId?: string },
) {
  const playback = row.blurbArtifactId
    ? await ctx.runQuery(queryRef("docket:playbackForCard"), {
        cardId: row._id,
        contentHash: row.contentHash,
      })
    : null;
  return projectDocketCard(row, playback);
}

const runs: Record<AgentToolName, AgentToolDef["run"]> = {
  listDocket: async (ctx, args) => {
    const rows = await ctx.runMutation(
      mutationRef("docket:list"),
      agentToolArgs.listDocket.parse(args),
    );
    return docketListResultZ.parse(
      await Promise.all(
        rows.map((row: Parameters<typeof projectPlayableCard>[1]) =>
          projectPlayableCard(ctx, row),
        ),
      ),
    );
  },
  getDocketCard: async (ctx, args) => {
    const row = await ctx.runQuery(
      queryRef("docket:card"),
      agentToolArgs.getDocketCard.parse(args),
    );
    return row === null ? null : projectPlayableCard(ctx, row);
  },
  proposeDecision: async (ctx, args) => {
    assertBoundedProposal(args);
    return projectProposal(
      await ctx.runMutation(
        mutationRef("decisionIntents:proposeInternal"),
        agentToolArgs.proposeDecision.parse(args),
      ),
    );
  },
  proposeListening: async (ctx, args) => {
    assertBoundedProposal(args);
    return projectProposal(
      await ctx.runMutation(
        mutationRef("decisionIntents:proposeInternal"),
        agentToolArgs.proposeListening.parse(args),
      ),
    );
  },
  recordDocketDelivery: async (ctx, args) =>
    deliveryRecordResultZ.parse(
      await ctx.runMutation(
        mutationRef("docket:recordDelivery"),
        agentToolArgs.recordDocketDelivery.parse(args),
      ),
    ),
  reportCaptureFailure: (ctx, args) =>
    ctx.runMutation(
      mutationRef("operationFailures:reportCaptureFailure"),
      args,
    ),
  getFailureInvestigation: (ctx, args) =>
    ctx.runQuery(queryRef("operationFailures:getInvestigation"), args),
  submitFailureDiagnosis: (ctx, args) =>
    ctx.runMutation(mutationRef("operationFailures:submitDiagnosis"), args),
  getCaptureRecovery: (ctx, args) =>
    ctx.runQuery(queryRef("operationFailures:getCaptureRecovery"), args),
  finishCaptureRecovery: (ctx, args) =>
    ctx.runMutation(
      mutationRef("operationFailures:finishCaptureRecovery"),
      args,
    ),
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
  countPendingDrafts: (ctx, args) =>
    ctx.runQuery(internal.agentDrafts.countPending, {
      kind: args.kind as "hypothesis_draft" | "recipe_draft",
    }),
  listDraftableCorrespondences: (ctx, args) =>
    ctx.runQuery(
      internal.agentDrafts.listDraftableCorrespondences,
      omitUndefined({ limit: args.limit as number | undefined }),
    ),
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
  getScoutTargets: (ctx) =>
    ctx.runQuery(queryRef("correspondences:scoutTargets"), {}),
  listTranscriptBacklog: (ctx, args) =>
    ctx.runQuery(
      internal.transcriptCapture.listTranscriptBacklog,
      omitUndefined({ cursor: args.cursor as string | null | undefined }),
    ),
  recordTranscriptCapture: (ctx, args) =>
    ctx.runMutation(
      internal.transcriptCapture.recordTranscriptCapture,
      omitUndefined({
        sourceId: args.sourceId as Id<"sources">,
        expectedUpdatedAt: args.expectedUpdatedAt as number | undefined,
        agentRunId: args.agentRunId as Id<"agentRuns">,
        outcome: args.outcome as
          | "captured"
          | "unavailable"
          | "attempted"
          | "rate_limited",
        transcript: args.transcript as string | undefined,
        language: args.language as string | undefined,
        model: args.model as string | undefined,
        detail: args.detail as string | undefined,
      }),
    ),
  listScoutCaptureBacklog: (ctx, args) =>
    ctx.runQuery(
      internal.sources.listScoutCaptureBacklog,
      omitUndefined({ cursor: args.cursor as string | null | undefined }),
    ),
  findExistingSourceUrls: (ctx, args) =>
    ctx.runQuery(internal.sources.existingScoutedUrls, {
      urls: args.urls as string[],
    }),
  ingestScoutedSource: (ctx, args) =>
    ctx.runMutation(
      internal.sources.createScoutedSource,
      omitUndefined({
        url: args.url as string,
        title: args.title as string | undefined,
        publishedAt: args.publishedAt as number | undefined,
        rawText: args.rawText as string | undefined,
        contentProvider: args.contentProvider as
          | ScoutedContentProvider
          | undefined,
        query: args.query as string,
        rationale: args.rationale as string,
        agentRunId: args.agentRunId as Id<"agentRuns">,
      }),
    ),
  proposeFeed: (ctx, args) =>
    ctx.runMutation(
      internal.feeds.proposeFeed,
      omitUndefined({
        name: args.name as string,
        url: args.url as string,
        type: args.type as "rss" | "podcast" | "youtube",
        rationale: args.rationale as string,
        sampleItems: args.sampleItems as Array<{
          title: string;
          url: string;
          snippet: string;
          publishedAt?: string;
        }>,
        agentRunId: args.agentRunId as Id<"agentRuns">,
      }),
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
  createAgentRun: (ctx, args) =>
    ctx.runMutation(
      mutationRef("agentRuns:createRunning"),
      omitUndefined({
        graphName: args.graphName,
        input: args.input,
        traceUrl: args.traceUrl,
      }),
    ),
  appendAgentRunEvent: (ctx, args) =>
    ctx.runMutation(
      mutationRef("agentRuns:appendEvent"),
      omitUndefined({
        deliveryId: args.deliveryId,
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
  claimNextMediaJob: (ctx, args) =>
    ctx.runMutation(
      internal.mediaJobs.claimNext,
      omitUndefined({
        workerId: args.workerId as string,
        kinds: args.kinds as string[],
        rendererVersion: args.rendererVersion as string | undefined,
      }),
    ),
  renewMediaJobLease: (ctx, args) =>
    ctx.runMutation(internal.mediaJobs.renewLease, {
      jobId: args.jobId as Id<"mediaJobs">,
      leaseToken: args.leaseToken as string,
    }),
  generateAudioUploadUrl: (ctx, args) =>
    ctx.runMutation(internal.mediaToolsInternal.generateAudioUploadUrl, {
      jobId: args.jobId as Id<"mediaJobs">,
      leaseToken: args.leaseToken as string,
      artifact: args.artifact,
    }),
  attachAudioStorage: (ctx, args) =>
    ctx.runMutation(internal.mediaToolsInternal.attachAudioStorage, {
      jobId: args.jobId as Id<"mediaJobs">,
      leaseToken: args.leaseToken as string,
      artifactId: args.artifactId as Id<"audioArtifacts">,
      storageId: args.storageId as Id<"_storage">,
    }),
  completeMediaJob: (ctx, args) =>
    ctx.runMutation(internal.mediaJobs.complete, {
      jobId: args.jobId as Id<"mediaJobs">,
      leaseToken: args.leaseToken as string,
      result: args.result as never,
    }),
  failMediaJob: (ctx, args) =>
    ctx.runMutation(internal.mediaJobs.fail, {
      jobId: args.jobId as Id<"mediaJobs">,
      leaseToken: args.leaseToken as string,
      error: args.error as string,
    }),
  beginTournamentRun: (ctx, args) =>
    ctx.runMutation(internal.hypothesisTournament.beginRun, {
      agentRunId: args.agentRunId as Id<"agentRuns">,
      leaseDurationMs: args.leaseDurationMs as number,
    }),
  completeTournamentRun: (ctx, args) =>
    ctx.runMutation(internal.hypothesisTournament.completeRun, {
      agentRunId: args.agentRunId as Id<"agentRuns">,
      leaseToken: args.leaseToken as string,
      result: args.result,
    }),
  recordHypothesisCandidates: (ctx, args) =>
    ctx.runMutation(internal.hypothesisTournament.recordCandidates, {
      agentRunId: args.agentRunId as Id<"agentRuns">,
      leaseToken: args.leaseToken as string,
      stage: args.stage as string,
      candidates: args.candidates,
      pairs: args.pairs,
    }),
  submitTournamentDraft: (ctx, args) =>
    ctx.runMutation(internal.hypothesisTournament.submitDraft, {
      agentRunId: args.agentRunId as Id<"agentRuns">,
      leaseToken: args.leaseToken as string,
      draft: args.draft,
      result: args.result,
    }),
  listTournamentSeeds: async (ctx, args) => {
    const family = args.family as "correspondence" | "claim" | "inversion";
    const seeds =
      family === "correspondence"
        ? (
            await ctx.runQuery(
              internal.agentDrafts.listDraftableCorrespondences,
              { limit: 2 },
            )
          ).map(correspondenceSeed)
        : family === "claim"
          ? await ctx.runQuery(
              internal.hypothesisTournament.listUnhypothesizedClaimSeeds,
              {},
            )
          : inversionSeeds(
              await ctx.runQuery(queryRef("failures:listArchive"), {
                limit: 20,
              }),
            );
    return tournamentSeedZ.array().max(2).parse(seeds.slice(0, 2));
  },
  hydrateClaims: (ctx, args) =>
    ctx.runQuery(internal.hypothesisTournament.hydrateClaims, {
      claimIds: args.claimIds as string[],
    }),
  searchTournamentEvidence: (ctx, args) =>
    ctx.runAction(internal.hypothesisTournamentNode.searchEvidence, {
      text: args.text as string,
      maxTotalTokens: args.maxTotalTokens as number,
    }),
  embedTournamentStatement: (ctx, args) =>
    ctx.runAction(internal.hypothesisTournamentNode.embedStatement, {
      text: args.text as string,
      maxTotalTokens: args.maxTotalTokens as number,
    }),
  findTournamentNeighbors: (ctx, args) =>
    ctx.runAction(internal.hypothesisTournamentNode.findNeighbors, {
      agentRunId: args.agentRunId as string,
      statement: args.statement as string,
      embedding: args.embedding as number[],
      maxTotalTokens: args.maxTotalTokens as number,
    }),
  finalizeTournamentRun: (ctx, args) =>
    ctx.runMutation(
      internal.hypothesisTournament.finalizeRun,
      omitUndefined({
        agentRunId: args.agentRunId as Id<"agentRuns">,
        leaseToken: args.leaseToken as string | undefined,
        summary: args.summary as string,
      }),
    ),
  requestTournamentRun: (ctx, args) =>
    ctx.runMutation(
      internal.hypothesisTournament.request,
      omitUndefined({
        seedHint: args.seedHint as string | undefined,
        requestedBy: "freq" as const,
      }),
    ),
};

export const AGENT_TOOL_REGISTRY: readonly AgentToolDef[] =
  AGENT_TOOL_MANIFEST.map((entry) => ({
    ...entry,
    run: runs[entry.name],
  }));

export const agentToolByName = Object.fromEntries(
  AGENT_TOOL_REGISTRY.map((definition) => [definition.name, definition]),
) as Record<AgentToolName, AgentToolDef>;
