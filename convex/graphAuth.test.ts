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
  test("uses the shared constant-time secret check", async () => {
    const source = await readFile("convex/agentToolsHttp.ts", "utf8");

    expect(source).toContain("agentToolSecretRejection(");
    expect(source).not.toContain("process.env.AGENT_TOOL_SECRET");
    const auth = await readFile("convex/auth.ts", "utf8");
    const check = auth.slice(
      auth.indexOf("export function agentToolSecretRejection"),
    );
    expect(check.slice(0, check.indexOf("\n}\n"))).toContain(
      "constantTimeEqual(provided, expected)",
    );
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
