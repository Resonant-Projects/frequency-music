import { describe, expect, test } from "bun:test";
import { buildAgentRunStatusCounts, clampAgentRunLimit, safeTraceUrl, summarizeRun } from "./agentRuns";

describe("agent run observability helpers", () => {
  test("clamps recent run limits for UI queries", () => {
    expect(clampAgentRunLimit(undefined)).toBe(25);
    expect(clampAgentRunLimit(0)).toBe(25);
    expect(clampAgentRunLimit(3.8)).toBe(3);
    expect(clampAgentRunLimit(500)).toBe(100);
  });

  test("summarizes status counts for the observability header", () => {
    const counts = buildAgentRunStatusCounts([
      { status: "completed" },
      { status: "completed" },
      { status: "running" },
      { status: "failed" },
      { status: "needs_review" },
    ]);

    expect(counts).toEqual({
      queued: 0,
      running: 1,
      needs_review: 1,
      completed: 2,
      failed: 1,
      cancelled: 0,
    });
  });

  test("keeps only http trace URLs safe for rendering", () => {
    expect(safeTraceUrl("https://smith.langchain.com/o/trace")).toBe(
      "https://smith.langchain.com/o/trace",
    );
    expect(safeTraceUrl("http://localhost:3000/trace")).toBe("http://localhost:3000/trace");
    expect(safeTraceUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeTraceUrl("not a url")).toBeUndefined();
  });

  test("summarizes runs without exposing raw input", () => {
    const summary = summarizeRun({
      _id: "run1",
      _creationTime: 1,
      graphName: "research-pipeline",
      status: "completed",
      summary: "done",
      traceUrl: "javascript:alert(1)",
      input: { smokeMode: true, prompt: "private" },
      createdAt: 10,
      startedAt: 20,
      finishedAt: 30,
      updatedAt: 40,
    } as never);

    expect(summary._creationTime).toBe(1);
    expect(summary.graphName).toBe("research-pipeline");
    expect(summary.status).toBe("completed");
    expect(summary.summary).toBe("done");
    expect(summary.traceUrl).toBeUndefined();
    expect(summary.createdAt).toBe(10);
    expect(summary.startedAt).toBe(20);
    expect(summary.finishedAt).toBe(30);
    expect(summary.updatedAt).toBe(40);
    expect(summary.smokeMode).toBe(true);
    expect("input" in summary).toBe(false);
  });
});
