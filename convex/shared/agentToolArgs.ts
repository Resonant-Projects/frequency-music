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

const limit = z.number().int().positive().max(100).optional();

export const agentToolArgs = {
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
  listCorrespondenceTargets: z.object({ limit }),
  getScoutTargets: z.object({}),
  listTranscriptBacklog: z.object({
    cursor: z.string().nullable().optional(),
  }),
  recordTranscriptCapture: z.object({
    sourceId: zid("sources"),
    agentRunId: zid("agentRuns"),
    outcome: z.enum(["captured", "unavailable", "attempted"]),
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
} as const;

export type AgentToolName = keyof typeof agentToolArgs;
