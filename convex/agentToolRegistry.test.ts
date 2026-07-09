import { describe, expect, test } from "bun:test";
import * as agentTools from "./agentTools";
import { AGENT_TOOL_REGISTRY, agentToolByName } from "./agentToolRegistry";
import { AGENT_RUN_EVENT_KINDS } from "./shared/agentContract";
import { AGENT_TOOL_MANIFEST } from "./shared/agentToolManifest";

const field = (fieldType: unknown, optional = false) => ({
  fieldType,
  optional,
});
const string = { type: "string" };
const number = { type: "number" };
const any = { type: "any" };
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
  listRecentExtractions: frozenArgs({ limit: field(number, true) }),
  getExtraction: frozenArgs({ id: field(id("extractions")) }),
  listRecentHypotheses: frozenArgs({ limit: field(number, true) }),
  listActiveTheses: frozenArgs({ limit: field(number, true) }),
  listFailureArchive: frozenArgs({ limit: field(number, true) }),
  getEditorialSignals: frozenArgs({ limit: field(number, true) }),
  getRecentRecipes: frozenArgs({ limit: field(number, true) }),
  getRecommendedActions: frozenArgs({}),
  searchSourcesByConcept: frozenArgs({
    conceptName: field(string),
    limit: field(number, true),
  }),
  getSelfImprovementStats: frozenArgs({ daysBack: field(number, true) }),
  createAgentRun: frozenArgs({
    graphName: field(string),
    input: field(any, true),
    traceUrl: field(string, true),
  }),
  appendAgentRunEvent: frozenArgs({
    runId,
    kind: field(union(...AGENT_RUN_EVENT_KINDS.map((kind) => literal(kind)))),
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
};

describe("agent tool registry", () => {
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

  test("action args match the frozen hand-written validators", () => {
    for (const definition of AGENT_TOOL_REGISTRY) {
      const registered = agentTools[
        definition.name as keyof typeof agentTools
      ] as { exportArgs: () => string };
      expect(registered.exportArgs()).toBe(FROZEN_ARGS[definition.name]);
    }
  });
});
