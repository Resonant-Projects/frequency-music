import { describe, expect, test } from "bun:test";
import { AGENT_TOOL_MANIFEST } from "../../convex/shared/agentToolManifest";
import { convexTools } from "../src/tools/convexTools.js";

function toSnake(name: string): string {
  return name.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`);
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
});
