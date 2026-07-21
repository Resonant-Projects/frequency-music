import { describe, expect, test } from "vite-plus/test";
import { AGENT_TOOL_MANIFEST } from "../../convex/shared/agentToolManifest";
import {
  agentModelSchema,
  bindAgentRunContext,
  convexTools,
} from "../src/tools/convexTools.js";

function toSnake(name: string): string {
  return name.replaceAll(
    /[A-Z]/g,
    (character) => `_${character.toLowerCase()}`,
  );
}

describe("convexTools derive from the manifest", () => {
  test("exposes exactly the langchain tools in manifest order", () => {
    const expected = AGENT_TOOL_MANIFEST.filter(
      (definition) => definition.langchain,
    ).map((definition) => toSnake(definition.name));

    expect(convexTools.map((toolDefinition) => toolDefinition.name)).toEqual(
      expected,
    );
  });

  test("keeps queue claiming worker-only", () => {
    expect(
      convexTools.some(
        (toolDefinition) => toolDefinition.name === "claim_next_pending_run",
      ),
    ).toBe(false);
  });

  test("exposes the binding source-scout read name in snake case", () => {
    expect(
      convexTools.some(
        (toolDefinition) => toolDefinition.name === "get_scout_targets",
      ),
    ).toBe(true);
  });

  test("binds research-write provenance from run context, not model args", () => {
    const definition = AGENT_TOOL_MANIFEST.find(
      (candidate) => candidate.name === "upsertCorrespondence",
    );
    if (!definition) throw new Error("upsertCorrespondence is missing");
    expect(Object.keys(definition.args.shape)).toContain("agentRunId");
    expect(Object.keys(agentModelSchema(definition).shape)).not.toContain(
      "agentRunId",
    );
    expect(() => bindAgentRunContext(definition, {}, undefined)).toThrow(
      /requires agentRunId in run context/,
    );
    expect(
      bindAgentRunContext(
        definition,
        { statement: "test", agentRunId: "model-controlled" },
        { agentRunId: "run-context", traceUrl: "https://trace.example/run" },
      ),
    ).toMatchObject({
      statement: "test",
      agentRunId: "run-context",
      traceUrl: "https://trace.example/run",
    });
  });

  test("keeps source-scout write provenance out of model-controlled args", () => {
    for (const name of ["ingestScoutedSource", "proposeFeed"] as const) {
      const definition = AGENT_TOOL_MANIFEST.find(
        (candidate) => candidate.name === name,
      );
      if (!definition) throw new Error(`${name} is missing`);
      expect(Object.keys(definition.args.shape)).toContain("agentRunId");
      expect(Object.keys(agentModelSchema(definition).shape)).not.toContain(
        "agentRunId",
      );
    }
  });
});
