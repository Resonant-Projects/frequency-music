import { describe, expect, test } from "vite-plus/test";
import { readFile } from "node:fs/promises";
import { constantTimeEqual } from "./auth";

describe("concept graph write authorization", () => {
  test("does not export public write functions", async () => {
    const source = await readFile("convex/graph.ts", "utf8");

    expect(source).not.toContain("= mutation(");
    expect(source).not.toContain("= action(");
  });
});

describe("agent-tool HTTP authorization", () => {
  test("uses constant-time secret comparison", async () => {
    const source = await readFile("convex/agentToolsHttp.ts", "utf8");

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
