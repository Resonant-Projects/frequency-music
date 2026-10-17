import {
  docketListArgsZ,
  docketCardArgsZ,
  decisionProposeArgsZ,
  listeningProposeArgsZ,
  deliveryRecordArgsZ,
} from "./docketTools";
import { captureInputZ, diagnosisZ } from "./operationRecovery";
// Zod-first argument schemas for the agent-tool surface. The transport owns
// agentSecret, so it never appears in these cross-workspace schemas.
import { zid } from "convex-helpers/server/zod4";
import { z } from "zod";
import {
  AGENT_RUN_EVENT_KINDS,
  SCOUTED_CONTENT_PROVIDERS,
  SCOUTED_TEXT_MAX_CHARS,
  SCOUTED_TEXT_MIN_CHARS,
  TRANSCRIPT_MAX_CHARS,
  TRANSCRIPT_MIN_CHARS,
} from "./agentContract";
import {
  addCorrespondenceEvidenceArgsZ,
  getCorrespondenceArgsZ,
  listConceptCorrespondencesArgsZ,
  listCorrespondencesArgsZ,
  upsertCorrespondenceArgsZ,
} from "./correspondences";
import {
  archiveStageZ,
  TOURNAMENT_MAX_EVIDENCE,
  TOURNAMENT_SEED_HINT_MAX_CHARS,
  TOURNAMENT_STATEMENT_MAX_CHARS,
} from "./hypothesisTournament";
import { PASSAGE_QUERY_MAX_CHARS, PASSAGE_SOURCE_TYPES } from "./passages";

const limit = z.number().int().positive().max(100).optional();

export const agentToolArgs = {
  listDocket: docketListArgsZ,
  getDocketCard: docketCardArgsZ,
  proposeDecision: decisionProposeArgsZ,
  proposeListening: listeningProposeArgsZ,
  recordDocketDelivery: deliveryRecordArgsZ,
  reportCaptureFailure: z.object({
    agentRunId: zid("agentRuns"),
    input: captureInputZ,
    stage: z.enum(["capture", "intake"]),
    diagnostic: z.string().max(1000).optional(),
  }),
  getFailureInvestigation: z.object({ agentRunId: zid("agentRuns") }),
  submitFailureDiagnosis: z.object({
    agentRunId: zid("agentRuns"),
    result: diagnosisZ,
  }),
  getCaptureRecovery: z.object({ agentRunId: zid("agentRuns") }),
  finishCaptureRecovery: z.object({
    agentRunId: zid("agentRuns"),
    failureId: zid("operationFailures"),
    success: z.boolean(),
  }),
  listRecentExtractions: z.object({ limit }),
  getExtraction: z.object({ id: zid("extractions") }),
  listRecentHypotheses: z.object({ limit }),
  listActiveTheses: z.object({ limit }),
  listFailureArchive: z.object({ limit }),
  countPendingDrafts: z.object({
    kind: z.union([z.literal("hypothesis_draft"), z.literal("recipe_draft")]),
  }),
  listDraftableCorrespondences: z.object({ limit }),
  getEditorialSignals: z.object({ limit }),
  getRecentRecipes: z.object({ limit }),
  getRecommendedActions: z.object({}),
  searchSourcesByConcept: z.object({
    conceptName: z.string().min(1),
    limit,
  }),
  getSelfImprovementStats: z.object({
    daysBack: z.number().int().positive().max(90).optional(),
  }),
  listCorrespondenceCandidates: z.object({
    limit,
    seedConceptId: zid("concepts").optional(),
  }),
  searchClaimsSemantic: z.object({
    text: z.string().trim().min(1),
    limit,
  }),
  // limit is clamped to 1..8 by the backing action rather than rejected.
  searchSourcePassages: z.object({
    query: z.string().trim().min(1).max(PASSAGE_QUERY_MAX_CHARS),
    limit,
    types: z.array(z.enum(PASSAGE_SOURCE_TYPES)).max(6).optional(),
  }),
  listCorrespondenceTargets: z.object({ limit }),
  getScoutTargets: z.object({}),
  listTranscriptBacklog: z.object({
    cursor: z.string().nullable().optional(),
  }),
  recordTranscriptCapture: z.object({
    sourceId: zid("sources"),
    expectedUpdatedAt: z.number().finite().optional(),
    agentRunId: zid("agentRuns"),
    outcome: z.enum(["captured", "unavailable", "attempted", "rate_limited"]),
    transcript: z
      .string()
      .trim()
      .min(TRANSCRIPT_MIN_CHARS)
      .max(TRANSCRIPT_MAX_CHARS)
      .optional(),
    language: z.string().trim().min(1).max(40).optional(),
    model: z.string().trim().min(1).max(100).optional(),
    detail: z.string().trim().min(1).max(500).optional(),
  }),
  listScoutCaptureBacklog: z.object({
    cursor: z.string().nullable().optional(),
  }),
  findExistingSourceUrls: z.object({
    urls: z.array(z.string().url()).min(1).max(20),
  }),
  ingestScoutedSource: z.object({
    url: z.string().url(),
    title: z.string().trim().min(1).optional(),
    publishedAt: z.number().optional(),
    rawText: z
      .string()
      .trim()
      .min(SCOUTED_TEXT_MIN_CHARS)
      .max(SCOUTED_TEXT_MAX_CHARS)
      .optional(),
    contentProvider: z.enum(SCOUTED_CONTENT_PROVIDERS).optional(),
    query: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
    agentRunId: zid("agentRuns"),
  }),
  proposeFeed: z.object({
    name: z.string().trim().min(1),
    url: z.string().url(),
    type: z.enum(["rss", "podcast", "youtube"]),
    rationale: z.string().trim().min(1),
    // Model-controlled input — keep the tool payload bounded.
    sampleItems: z
      .array(
        z.object({
          title: z.string(),
          url: z.string().url(),
          snippet: z.string(),
          publishedAt: z.string().optional(),
        }),
      )
      .max(10),
    agentRunId: zid("agentRuns"),
  }),
  upsertCorrespondence: upsertCorrespondenceArgsZ,
  addCorrespondenceEvidence: addCorrespondenceEvidenceArgsZ,
  getCorrespondence: getCorrespondenceArgsZ,
  listCorrespondences: listCorrespondencesArgsZ,
  listConceptCorrespondences: listConceptCorrespondencesArgsZ,
  createAgentRun: z.object({
    graphName: z.string().min(1),
    input: z.any().optional(),
    traceUrl: z.string().optional(),
  }),
  appendAgentRunEvent: z.object({
    deliveryId: z.string().uuid().optional(),
    runId: zid("agentRuns"),
    kind: z.enum(AGENT_RUN_EVENT_KINDS),
    message: z.string().min(1),
    payload: z.any().optional(),
  }),
  markAgentRunCompleted: z.object({
    runId: zid("agentRuns"),
    summary: z.string().optional(),
    traceUrl: z.string().optional(),
  }),
  markAgentRunNeedsReview: z.object({
    runId: zid("agentRuns"),
    summary: z.string().optional(),
    reviewDraft: z.any().optional(),
  }),
  createAgentReviewDraft: z.object({
    agentRunId: zid("agentRuns"),
    draft: z.any(),
  }),
  markAgentRunFailed: z.object({
    runId: zid("agentRuns"),
    summary: z.string().optional(),
    error: z.any().optional(),
    traceUrl: z.string().optional(),
  }),
  claimNextPendingRun: z.object({
    workerId: z.string().min(1),
    graphName: z.string().min(1).optional(),
  }),
  getAgentRun: z.object({ runId: zid("agentRuns") }),
  // Media lifecycle (wave 0). Artifact fields and results are validated by
  // their zod contracts inside the backing mutations; the transport passes any.
  claimNextMediaJob: z.object({
    workerId: z.string().min(1),
    kinds: z.array(z.string().min(1)).min(1),
    rendererVersion: z.string().min(1).optional(),
  }),
  renewMediaJobLease: z.object({
    jobId: zid("mediaJobs"),
    leaseToken: z.string().min(1),
  }),
  generateAudioUploadUrl: z.object({
    jobId: zid("mediaJobs"),
    leaseToken: z.string().min(1),
    artifact: z.any(),
  }),
  attachAudioStorage: z.object({
    jobId: zid("mediaJobs"),
    leaseToken: z.string().min(1),
    artifactId: zid("audioArtifacts"),
    storageId: zid("_storage"),
  }),
  completeMediaJob: z.object({
    jobId: zid("mediaJobs"),
    leaseToken: z.string().min(1),
    result: z.any(),
  }),
  failMediaJob: z.object({
    jobId: zid("mediaJobs"),
    leaseToken: z.string().min(1),
    error: z.string().min(1),
  }),
  // Hypothesis tournament (wave 4). Graph-only; results and archives are
  // validated by the shared tournament zod schemas inside the mutations.
  beginTournamentRun: z.object({
    agentRunId: zid("agentRuns"),
    leaseDurationMs: z.number().int().positive(),
  }),
  completeTournamentRun: z.object({
    agentRunId: zid("agentRuns"),
    leaseToken: z.string().min(1).max(200),
    result: z.any(),
  }),
  recordHypothesisCandidates: z.object({
    agentRunId: zid("agentRuns"),
    leaseToken: z.string().min(1).max(200),
    stage: archiveStageZ,
    candidates: z.any(),
    pairs: z.any(),
  }),
  submitTournamentDraft: z.object({
    agentRunId: zid("agentRuns"),
    leaseToken: z.string().min(1).max(200),
    draft: z.any(),
    result: z.any(),
  }),
  listTournamentSeeds: z.object({
    family: z.enum(["correspondence", "claim", "inversion"]),
  }),
  hydrateClaims: z.object({
    claimIds: z.array(z.string().min(1).max(200)).max(TOURNAMENT_MAX_EVIDENCE),
  }),
  searchTournamentEvidence: z.object({
    text: z.string().trim().min(1).max(TOURNAMENT_STATEMENT_MAX_CHARS),
    maxTotalTokens: z.number().int().min(0),
  }),
  embedTournamentStatement: z.object({
    text: z.string().trim().min(1).max(TOURNAMENT_STATEMENT_MAX_CHARS),
    maxTotalTokens: z.number().int().min(0),
  }),
  findTournamentNeighbors: z.object({
    agentRunId: zid("agentRuns"),
    statement: z.string().trim().min(1).max(TOURNAMENT_STATEMENT_MAX_CHARS),
    embedding: z.array(z.number()).max(4_096),
    maxTotalTokens: z.number().int().min(0),
  }),
  finalizeTournamentRun: z.object({
    agentRunId: zid("agentRuns"),
    leaseToken: z.string().min(1).max(200).optional(),
    summary: z.string().min(1).max(2_000),
  }),
  requestTournamentRun: z.object({
    seedHint: z
      .string()
      .trim()
      .min(1)
      .max(TOURNAMENT_SEED_HINT_MAX_CHARS)
      .optional(),
  }),
} as const;

export type AgentToolName = keyof typeof agentToolArgs;
