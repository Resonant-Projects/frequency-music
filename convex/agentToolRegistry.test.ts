import { describe, expect, test, vi } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { renderAgentToolDocs } from "../scripts/lib/agentToolDocs";
import * as agentTools from "./agentTools";
import { AGENT_TOOL_REGISTRY, agentToolByName } from "./agentToolRegistry";
import { AGENT_TOOL_MANIFEST } from "./shared/agentToolManifest";

const field = (fieldType: unknown, optional = false) => ({
  fieldType,
  optional,
});
const string = { type: "string" };
const number = { type: "number" };
const any = { type: "any" };
const nullValue = { type: "null" };
const array = (value: unknown) => ({ type: "array", value });
const object = (value: Record<string, unknown>) => ({ type: "object", value });
const id = (tableName: string) => ({ type: "id", tableName });
const literal = (value: string) => ({ type: "literal", value });
const union = (...value: unknown[]) => ({ type: "union", value });
const frozenArgs = (value: Record<string, unknown>) =>
  JSON.stringify({
    type: "object",
    value: { agentSecret: field(string), ...value },
  });
const runId = field(id("agentRuns"));

const FROZEN_ARGS: Record<string, string> = {
  reportCaptureFailure: frozenArgs({
    agentRunId: runId,
    input: field(
      object({
        url: field(string),
        title: field(string, true),
        publishedAt: field(number, true),
        query: field(string),
        rationale: field(string),
        rawText: field(string, true),
        contentProvider: field(
          union(literal("crawl4ai"), literal("firecrawl"), literal("openalex")),
          true,
        ),
      }),
    ),
    stage: field(union(literal("capture"), literal("intake"))),
    diagnostic: field(string, true),
  }),
  getFailureInvestigation: frozenArgs({ agentRunId: runId }),
  submitFailureDiagnosis: frozenArgs({
    agentRunId: runId,
    result: field(
      object({ diagnosis: field(string), recover: field({ type: "boolean" }) }),
    ),
  }),
  getCaptureRecovery: frozenArgs({ agentRunId: runId }),
  finishCaptureRecovery: frozenArgs({
    agentRunId: runId,
    failureId: field(id("operationFailures")),
    success: field({ type: "boolean" }),
  }),
  listRecentExtractions: frozenArgs({ limit: field(number, true) }),
  getExtraction: frozenArgs({ id: field(id("extractions")) }),
  listRecentHypotheses: frozenArgs({ limit: field(number, true) }),
  listActiveTheses: frozenArgs({ limit: field(number, true) }),
  listFailureArchive: frozenArgs({ limit: field(number, true) }),
  countPendingDrafts: frozenArgs({
    kind: field(union(literal("hypothesis_draft"), literal("recipe_draft"))),
  }),
  listDraftableCorrespondences: frozenArgs({ limit: field(number, true) }),
  getEditorialSignals: frozenArgs({ limit: field(number, true) }),
  getRecentRecipes: frozenArgs({ limit: field(number, true) }),
  getRecommendedActions: frozenArgs({}),
  searchSourcesByConcept: frozenArgs({
    conceptName: field(string),
    limit: field(number, true),
  }),
  getSelfImprovementStats: frozenArgs({ daysBack: field(number, true) }),
  listCorrespondenceCandidates: frozenArgs({
    limit: field(number, true),
    seedConceptId: field(id("concepts"), true),
  }),
  searchClaimsSemantic: frozenArgs({
    text: field(string),
    limit: field(number, true),
  }),
  searchSourcePassages: frozenArgs({
    query: field(string),
    limit: field(number, true),
    types: field(
      array(
        union(
          literal("notion"),
          literal("rss"),
          literal("url"),
          literal("youtube"),
          literal("pdf"),
          literal("podcast"),
        ),
      ),
      true,
    ),
  }),
  listCorrespondenceTargets: frozenArgs({ limit: field(number, true) }),
  getScoutTargets: frozenArgs({}),
  listTranscriptBacklog: frozenArgs({
    cursor: field(union(string, nullValue), true),
  }),
  recordTranscriptCapture: frozenArgs({
    sourceId: field(id("sources")),
    expectedUpdatedAt: field(number, true),
    agentRunId: runId,
    outcome: field(
      union(
        literal("captured"),
        literal("unavailable"),
        literal("attempted"),
        literal("rate_limited"),
      ),
    ),
    transcript: field(string, true),
    language: field(string, true),
    model: field(string, true),
    detail: field(string, true),
  }),
  listScoutCaptureBacklog: frozenArgs({
    cursor: field(union(string, nullValue), true),
  }),
  findExistingSourceUrls: frozenArgs({ urls: field(array(string)) }),
  ingestScoutedSource: frozenArgs({
    url: field(string),
    title: field(string, true),
    publishedAt: field(number, true),
    rawText: field(string, true),
    contentProvider: field(
      union(literal("crawl4ai"), literal("firecrawl"), literal("openalex")),
      true,
    ),
    query: field(string),
    rationale: field(string),
    agentRunId: field(id("agentRuns")),
  }),
  proposeFeed: frozenArgs({
    name: field(string),
    url: field(string),
    type: field(union(literal("rss"), literal("podcast"), literal("youtube"))),
    rationale: field(string),
    sampleItems: field(
      array(
        object({
          title: field(string),
          url: field(string),
          snippet: field(string),
          publishedAt: field(string, true),
        }),
      ),
    ),
    agentRunId: field(id("agentRuns")),
  }),
  upsertCorrespondence: frozenArgs({
    conceptAId: field(id("concepts")),
    conceptBId: field(id("concepts")),
    statement: field(string),
    rationaleMd: field(string),
    relationship: field(string, true),
    similarityScore: field(number, true),
    noveltyScore: field(number, true),
    agentRunId: field(id("agentRuns"), true),
    traceUrl: field(string, true),
  }),
  addCorrespondenceEvidence: frozenArgs({
    correspondenceId: field(id("correspondences")),
    claimId: field(id("claims")),
    stance: field(union(literal("supports"), literal("contradicts"))),
    note: field(string, true),
    agentRunId: field(id("agentRuns"), true),
  }),
  getCorrespondence: frozenArgs({ pairKey: field(string) }),
  listCorrespondences: frozenArgs({
    status: field(
      union(
        literal("conjectured"),
        literal("evidenced"),
        literal("contradicted"),
        literal("retired"),
      ),
    ),
    limit: field(number, true),
  }),
  listConceptCorrespondences: frozenArgs({
    conceptId: field(id("concepts")),
    limit: field(number, true),
  }),
  createAgentRun: frozenArgs({
    graphName: field(string),
    input: field(any, true),
    traceUrl: field(string, true),
  }),
  appendAgentRunEvent: frozenArgs({
    deliveryId: field(string, true),
    runId,
    kind: field(
      union(
        literal("tool_call"),
        literal("decision"),
        literal("draft_write"),
        literal("error"),
        literal("review_request"),
        literal("status"),
        literal("node"),
        literal("memory_recall"),
        literal("model_call"),
      ),
    ),
    message: field(string),
    payload: field(any, true),
  }),
  markAgentRunCompleted: frozenArgs({
    runId,
    summary: field(string, true),
    traceUrl: field(string, true),
  }),
  markAgentRunNeedsReview: frozenArgs({
    runId,
    summary: field(string, true),
    reviewDraft: field(any, true),
  }),
  createAgentReviewDraft: frozenArgs({
    agentRunId: runId,
    draft: field(any),
  }),
  markAgentRunFailed: frozenArgs({
    runId,
    summary: field(string, true),
    error: field(any, true),
    traceUrl: field(string, true),
  }),
  claimNextPendingRun: frozenArgs({
    workerId: field(string),
    graphName: field(string, true),
  }),
  getAgentRun: frozenArgs({ runId }),
  claimNextMediaJob: frozenArgs({
    workerId: field(string),
    kinds: field(array(string)),
    rendererVersion: field(string, true),
  }),
  renewMediaJobLease: frozenArgs({
    jobId: field(id("mediaJobs")),
    leaseToken: field(string),
  }),
  generateAudioUploadUrl: frozenArgs({
    jobId: field(id("mediaJobs")),
    leaseToken: field(string),
    artifact: field(any),
  }),
  attachAudioStorage: frozenArgs({
    jobId: field(id("mediaJobs")),
    leaseToken: field(string),
    artifactId: field(id("audioArtifacts")),
    storageId: field(id("_storage")),
  }),
  completeMediaJob: frozenArgs({
    jobId: field(id("mediaJobs")),
    leaseToken: field(string),
    result: field(any),
  }),
  failMediaJob: frozenArgs({
    jobId: field(id("mediaJobs")),
    leaseToken: field(string),
    error: field(string),
  }),
  beginTournamentRun: frozenArgs({
    agentRunId: runId,
    leaseDurationMs: field(number),
  }),
  completeTournamentRun: frozenArgs({
    agentRunId: runId,
    leaseToken: field(string),
    result: field(any),
  }),
  recordHypothesisCandidates: frozenArgs({
    agentRunId: runId,
    leaseToken: field(string),
    stage: field(
      union(
        literal("duplicates"),
        literal("finalists"),
        literal("self_check"),
        literal("submitted"),
        literal("terminal"),
      ),
    ),
    candidates: field(any),
    pairs: field(any),
  }),
  submitTournamentDraft: frozenArgs({
    agentRunId: runId,
    leaseToken: field(string),
    draft: field(any),
    result: field(any),
  }),
  listTournamentSeeds: frozenArgs({
    family: field(
      union(literal("correspondence"), literal("claim"), literal("inversion")),
    ),
  }),
  hydrateClaims: frozenArgs({ claimIds: field(array(string)) }),
  searchTournamentEvidence: frozenArgs({
    text: field(string),
    maxTotalTokens: field(number),
  }),
  embedTournamentStatement: frozenArgs({
    text: field(string),
    maxTotalTokens: field(number),
  }),
  findTournamentNeighbors: frozenArgs({
    agentRunId: runId,
    statement: field(string),
    embedding: field(array(number)),
    maxTotalTokens: field(number),
  }),
  finalizeTournamentRun: frozenArgs({
    agentRunId: runId,
    leaseToken: field(string, true),
    summary: field(string),
  }),
  requestTournamentRun: frozenArgs({ seedHint: field(string, true) }),
};

describe("agent tool registry", () => {
  test("audit delivery identity reaches the backing mutation", async () => {
    const runMutation = vi.fn(async () => null);
    await agentToolByName.appendAgentRunEvent.run({ runMutation } as never, {
      runId: "run",
      kind: "status",
      message: "done",
      deliveryId: "stable",
    });
    expect(runMutation).toHaveBeenCalledWith(expect.anything(), {
      runId: "run",
      kind: "status",
      message: "done",
      deliveryId: "stable",
    });
  });
  test("registry covers the manifest one-to-one", () => {
    expect(AGENT_TOOL_REGISTRY.map((tool) => tool.name)).toEqual(
      AGENT_TOOL_MANIFEST.map((tool) => tool.name),
    );
    for (const definition of AGENT_TOOL_REGISTRY) {
      expect(typeof definition.run).toBe("function");
      expect(agentToolByName[definition.name]).toBe(definition);
    }
  });

  test("every manifest tool is statically exported as an action", () => {
    for (const definition of AGENT_TOOL_MANIFEST) {
      expect(
        agentTools[definition.name as keyof typeof agentTools],
      ).toBeDefined();
    }
  });

  test("self-improvement stats stays behind the secret-guarded action", () => {
    const backingQuery = agentTools.selfImprovementStats as {
      isInternal: boolean;
    };
    expect(backingQuery.isInternal).toBe(true);
    expect(agentToolByName.getSelfImprovementStats.backing).toBe(
      "internal.agentTools:selfImprovementStats",
    );
  });

  test("action args match the frozen hand-written validators", () => {
    expect(Object.keys(FROZEN_ARGS).toSorted()).toEqual(
      AGENT_TOOL_REGISTRY.filter(
        (tool) =>
          ![
            "listDocket",
            "getDocketCard",
            "proposeDecision",
            "proposeListening",
            "recordDocketDelivery",
          ].includes(tool.name),
      )
        .map((tool) => tool.name)
        .toSorted(),
    );
    for (const definition of AGENT_TOOL_REGISTRY.filter(
      (tool) => tool.name in FROZEN_ARGS,
    )) {
      const registered = agentTools[
        definition.name as keyof typeof agentTools
      ] as unknown as { exportArgs: () => string };
      expect(registered.exportArgs()).toBe(FROZEN_ARGS[definition.name]);
    }
  });

  test("generated agent-tool documentation is fresh", () => {
    const current = readFileSync(
      new URL("../docs/agent-tool-surface.md", import.meta.url),
      "utf8",
    );
    expect(renderAgentToolDocs(current)).toBe(current);
  });
});
