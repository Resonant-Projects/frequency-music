import { describe, expect, test } from "vite-plus/test";
import {
  HEARTBEAT_INTERVAL_MS,
  STALE_RUN_MS,
  TERMINAL_STATUS_OWNER as CONTRACT_OWNER,
} from "../../convex/shared/agentContract";

import {
  buildGraphInvocation,
  buildWeeklyBriefMessages,
  DEFAULT_RESEARCH_LIMIT,
  DEFAULT_WEEKLY_BRIEF_SEED,
  isKnownGraphName,
  redactError,
  resolveResearchLimit,
  summarizeNodeUpdate,
  TERMINAL_STATUS_OWNER,
} from "../src/worker/graphInput";

describe("worker graph-input mapping", () => {
  test("recognizes the four registered graphs", () => {
    expect(isKnownGraphName("research-pipeline")).toBe(true);
    expect(isKnownGraphName("weekly-brief")).toBe(true);
    expect(isKnownGraphName("correspondence-miner")).toBe(true);
    expect(isKnownGraphName("evidence-hunter")).toBe(true);
    expect(isKnownGraphName("source-intake-triage")).toBe(false);
    expect(isKnownGraphName("")).toBe(false);
  });

  test("threads the claimed runId into research-pipeline input as agentRunId (no double-create)", () => {
    const invocation = buildGraphInvocation({
      runId: "run_abc123",
      graphName: "research-pipeline",
      input: { limit: 5 },
    });

    expect(invocation.graphName).toBe("research-pipeline");
    if (invocation.graphName !== "research-pipeline")
      throw new Error("narrowing");
    expect(invocation.input.agentRunId).toBe("run_abc123");
    expect(invocation.input.dryRun).toBe(false);
    expect(invocation.input.smokeMode).toBe(false);
    expect(invocation.input.limit).toBe(5);
    expect(invocation.input.runId).toContain("run_abc123");
  });

  test("research-pipeline falls back to the default limit when input omits it", () => {
    const invocation = buildGraphInvocation({
      runId: "run_x",
      graphName: "research-pipeline",
    });
    if (invocation.graphName !== "research-pipeline")
      throw new Error("narrowing");
    expect(invocation.input.limit).toBe(DEFAULT_RESEARCH_LIMIT);
  });

  test("resolveResearchLimit clamps and validates", () => {
    expect(resolveResearchLimit(undefined)).toBe(DEFAULT_RESEARCH_LIMIT);
    expect(resolveResearchLimit({})).toBe(DEFAULT_RESEARCH_LIMIT);
    expect(resolveResearchLimit({ limit: 0 })).toBe(DEFAULT_RESEARCH_LIMIT);
    expect(resolveResearchLimit({ limit: -3 })).toBe(DEFAULT_RESEARCH_LIMIT);
    expect(resolveResearchLimit({ limit: 7 })).toBe(7);
    expect(resolveResearchLimit({ limit: 7.9 })).toBe(7);
    expect(resolveResearchLimit({ limit: 9999 })).toBe(100);
  });

  test("weekly-brief passes provided messages through, normalizing strings", () => {
    const invocation = buildGraphInvocation({
      runId: "run_w",
      graphName: "weekly-brief",
      input: { messages: ["hello brief"] },
    });
    if (invocation.graphName !== "weekly-brief") throw new Error("narrowing");
    expect(invocation.input.messages).toEqual([
      { role: "user", content: "hello brief" },
    ]);
  });

  test("weekly-brief seeds a default message when none provided", () => {
    expect(buildWeeklyBriefMessages(undefined)).toEqual([
      { role: "user", content: DEFAULT_WEEKLY_BRIEF_SEED },
    ]);
    expect(buildWeeklyBriefMessages({ messages: [] })).toEqual([
      { role: "user", content: DEFAULT_WEEKLY_BRIEF_SEED },
    ]);
  });

  test("weekly-brief keeps structured message objects intact", () => {
    const msg = { role: "system", content: "seed" };
    expect(buildWeeklyBriefMessages({ messages: [msg] })).toEqual([msg]);
  });

  test("correspondence-miner receives claimed-run provenance and bounded input", () => {
    const invocation = buildGraphInvocation({
      runId: "run_miner",
      graphName: "correspondence-miner",
      input: { limit: 12, traceUrl: "https://trace.example/miner" },
    });
    if (invocation.graphName !== "correspondence-miner")
      throw new Error("narrowing");
    expect(invocation.input).toEqual({
      agentRunId: "run_miner",
      limit: 12,
      traceUrl: "https://trace.example/miner",
    });
  });

  test("evidence-hunter caps each run at five targets", () => {
    const invocation = buildGraphInvocation({
      runId: "run_hunter",
      graphName: "evidence-hunter",
      input: { limit: 99 },
    });
    if (invocation.graphName !== "evidence-hunter")
      throw new Error("narrowing");
    expect(invocation.input).toEqual({
      agentRunId: "run_hunter",
      limit: 5,
    });
  });

  test("unknown graph name throws in buildGraphInvocation", () => {
    expect(() =>
      buildGraphInvocation({ runId: "r", graphName: "nope" }),
    ).toThrow(/Unknown graphName/);
  });

  test("terminal-status ownership is split correctly", () => {
    expect(TERMINAL_STATUS_OWNER["research-pipeline"]).toBe("graph");
    expect(TERMINAL_STATUS_OWNER["weekly-brief"]).toBe("runner");
    expect(TERMINAL_STATUS_OWNER["correspondence-miner"]).toBe("graph");
    expect(TERMINAL_STATUS_OWNER["evidence-hunter"]).toBe("graph");
  });

  test("summarizeNodeUpdate reports node name and update keys", () => {
    expect(
      summarizeNodeUpdate("finalize_run", { draft: {}, auditEvents: [] }),
    ).toEqual({
      node: "finalize_run",
      keys: ["draft", "auditEvents"],
    });
    expect(summarizeNodeUpdate("x", null)).toEqual({ node: "x", keys: [] });
  });

  test("redactError strips secret-looking material", () => {
    expect(redactError(new Error("boom api_key=sk-supersecret trailing"))).toBe(
      "boom api_key=[REDACTED] trailing",
    );
    expect(redactError(new Error("PVEAPIToken=user!id=abcdef"))).toBe(
      "PVEAPIToken=[REDACTED]",
    );
  });
});

describe("agentContract wiring", () => {
  test("graphInput re-exports the contract's terminal-status owner", () => {
    expect(TERMINAL_STATUS_OWNER).toBe(CONTRACT_OWNER);
  });

  test("worker heartbeat is faster than the queue's stale sweep", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(STALE_RUN_MS);
  });
});
