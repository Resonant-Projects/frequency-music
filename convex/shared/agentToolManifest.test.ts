import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { AGENT_RUN_EVENT_KINDS } from "./agentContract";
import { agentToolArgs } from "./agentToolArgs";
import { AGENT_TOOL_MANIFEST, AGENT_TOOL_NAMES } from "./agentToolManifest";

describe("agent tool manifest", () => {
  test("covers all 18 current tools with unique names and schemas", () => {
    expect(AGENT_TOOL_MANIFEST).toHaveLength(18);
    expect(new Set(AGENT_TOOL_NAMES).size).toBe(18);
    for (const entry of AGENT_TOOL_MANIFEST) {
      expect(entry.description.length).toBeGreaterThan(10);
      expect(entry.args).toBeInstanceOf(z.ZodObject);
      expect(entry.args).toBe(agentToolArgs[entry.name]);
    }
  });

  test("agentSecret remains transport-owned", () => {
    for (const entry of AGENT_TOOL_MANIFEST) {
      expect(Object.keys(entry.args.shape)).not.toContain("agentSecret");
    }
  });

  test("only the production queue claim is hidden from LangChain", () => {
    expect(
      AGENT_TOOL_MANIFEST.filter((tool) => !tool.langchain).map(
        (tool) => tool.name,
      ),
    ).toEqual(["claimNextPendingRun"]);
  });

  test("human decision mutations never enter the surface", () => {
    for (const forbidden of ["approve", "reject", "supersede"]) {
      expect(
        AGENT_TOOL_NAMES.some((name) => name.toLowerCase().includes(forbidden)),
      ).toBe(false);
    }
  });

  test("appendAgentRunEvent kinds match the shared contract", () => {
    expect(agentToolArgs.appendAgentRunEvent.shape.kind.options).toEqual([
      ...AGENT_RUN_EVENT_KINDS,
    ]);
  });
});
