// Zod-first argument schemas for the agent-tool surface. The transport owns
// agentSecret, so it never appears in these cross-workspace schemas.
import { zid } from "convex-helpers/server/zod4";
import { z } from "zod";
import { AGENT_RUN_EVENT_KINDS } from "./agentContract";
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
  ingestScoutedSource: z.object({
    url: z.string().url(),
    title: z.string().trim().min(1).optional(),
    publishedAt: z.number().optional(),
    query: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
    agentRunId: zid("agentRuns"),
  }),
  proposeFeed: z.object({
    name: z.string().trim().min(1),
    url: z.string().url(),
    type: z.enum(["rss", "podcast", "youtube"]),
    rationale: z.string().trim().min(1),
    sampleItems: z.array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        snippet: z.string(),
        publishedAt: z.string().optional(),
      }),
    ),
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
} as const;

export type AgentToolName = keyof typeof agentToolArgs;
