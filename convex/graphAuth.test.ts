import { describe, expect, test } from "bun:test";
import { constantTimeEqual } from "./auth";

describe("concept graph write authorization", () => {
  test("does not export public write functions", async () => {
    const source = await Bun.file("convex/graph.ts").text();

    expect(source).not.toContain("= mutation(");
    expect(source).not.toContain("= action(");
  });
});

describe("agent-tool HTTP authorization", () => {
  test("uses constant-time secret comparison", async () => {
    const source = await Bun.file("convex/agentToolsHttp.ts").text();

    expect(source).toContain("constantTimeEqual");
    expect(source).not.toContain("!== process.env.AGENT_TOOL_SECRET");
  });
});

describe("constantTimeEqual", () => {
  test("compares equal, different, and empty strings", () => {
    expect(constantTimeEqual("shared-secret", "shared-secret")).toBe(true);
    expect(constantTimeEqual("shared-secret", "shared-secreu")).toBe(false);
    expect(constantTimeEqual("short", "longer")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});
