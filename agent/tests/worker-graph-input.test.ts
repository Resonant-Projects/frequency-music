import { describe, expect, test, vi } from "vite-plus/test";
import {
  HEARTBEAT_INTERVAL_MS,
  STALE_RUN_MS,
  TERMINAL_STATUS_OWNER as CONTRACT_OWNER,
} from "../../convex/shared/agentContract";

import {
  buildGraphInvocation,
  buildWeeklyBriefMessages,
  type ClaimedRun,
  DEFAULT_RESEARCH_LIMIT,
  DEFAULT_WEEKLY_BRIEF_SEED,
  isKnownGraphName,
  redactError,
  resolveResearchLimit,
  summarizeNodeUpdate,
  TERMINAL_STATUS_OWNER,
} from "../src/worker/graphInput";
import { claimedAgentRunZ } from "../../convex/shared/agentRunClaim";

function claimedRun(
  overrides: Pick<ClaimedRun, "runId" | "graphName"> & Partial<ClaimedRun>,
): ClaimedRun {
  return {
    input: null,
    status: "running",
    workerId: "worker-a",
    startedAt: 123,
    ...overrides,
  };
}

describe("worker graph-input mapping", () => {
  test("shared claimed-run contract round-trips worker provenance", () => {
    expect(
      claimedAgentRunZ.parse({
        runId: "run_contract",
        graphName: "correspondence-miner",
        input: { limit: 20 },
        traceUrl: "https://trace.example/run_contract",
        status: "running",
        workerId: "worker-a",
        startedAt: 123,
      }),
    ).toMatchObject({
      runId: "run_contract",
      traceUrl: "https://trace.example/run_contract",
      status: "running",
    });

    expect(() =>
      claimedAgentRunZ.parse({
        runId: "run_unknown",
        graphName: "unknown-graph",
        input: null,
        status: "running",
        workerId: "worker-a",
        startedAt: 123,
      }),
    ).toThrow();
  });

  test("recognizes the five registered graphs", () => {
    expect(isKnownGraphName("research-pipeline")).toBe(true);
    expect(isKnownGraphName("weekly-brief")).toBe(true);
    expect(isKnownGraphName("correspondence-miner")).toBe(true);
    expect(isKnownGraphName("evidence-hunter")).toBe(true);
    expect(isKnownGraphName("hypothesis-drafter")).toBe(true);
    expect(isKnownGraphName("source-intake-triage")).toBe(false);
    expect(isKnownGraphName("")).toBe(false);
  });

  test("threads the claimed runId into research-pipeline input as agentRunId (no double-create)", () => {
    const invocation = buildGraphInvocation(
      claimedRun({
        runId: "run_abc123",
        graphName: "research-pipeline",
        input: { limit: 5 },
      }),
    );

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
    const invocation = buildGraphInvocation(
      claimedRun({
        runId: "run_x",
        graphName: "research-pipeline",
      }),
    );
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
    const invocation = buildGraphInvocation(
      claimedRun({
        runId: "run_w",
        graphName: "weekly-brief",
        input: { messages: ["hello brief"] },
      }),
    );
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
    const invocation = buildGraphInvocation(
      claimedRun({
        runId: "run_miner",
        graphName: "correspondence-miner",
        traceUrl: "https://trace.example/miner",
        input: { limit: 12, traceUrl: "https://stale.example/miner" },
      }),
    );
    if (invocation.graphName !== "correspondence-miner")
      throw new Error("narrowing");
    expect(invocation.input).toEqual({
      agentRunId: "run_miner",
      limit: 12,
      traceUrl: "https://trace.example/miner",
    });

    const oversized = buildGraphInvocation(
      claimedRun({
        runId: "run_miner_oversized",
        graphName: "correspondence-miner",
        input: { limit: 500 },
      }),
    );
    if (oversized.graphName !== "correspondence-miner")
      throw new Error("narrowing");
    expect(oversized.input.limit).toBe(20);
  });

  test("drops and warns on a non-URL trace from claimed input", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const invocation = buildGraphInvocation(
      claimedRun({
        runId: "run_invalid_trace",
        graphName: "correspondence-miner",
        input: { traceUrl: "not a URL" },
      }),
    );

    if (invocation.graphName !== "correspondence-miner")
      throw new Error("narrowing");
    expect(invocation.input.traceUrl).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "[worker] Ignoring invalid traceUrl at graph boundary",
    );
    warn.mockRestore();
  });

  test("evidence-hunter caps each run at five targets", () => {
    const invocation = buildGraphInvocation(
      claimedRun({
        runId: "run_hunter",
        graphName: "evidence-hunter",
        input: { limit: 99 },
      }),
    );
    if (invocation.graphName !== "evidence-hunter")
      throw new Error("narrowing");
    expect(invocation.input).toEqual({
      agentRunId: "run_hunter",
      limit: 5,
    });
  });

  test("hypothesis-drafter receives claimed-run provenance", () => {
    const invocation = buildGraphInvocation(
      claimedRun({
        runId: "run_drafter",
        graphName: "hypothesis-drafter",
        traceUrl: "https://trace.example/drafter",
      }),
    );
    if (invocation.graphName !== "hypothesis-drafter")
      throw new Error("narrowing");
    expect(invocation.input).toEqual({
      agentRunId: "run_drafter",
      traceUrl: "https://trace.example/drafter",
    });
  });

  test("terminal-status ownership is split correctly", () => {
    expect(TERMINAL_STATUS_OWNER["research-pipeline"]).toBe("graph");
    expect(TERMINAL_STATUS_OWNER["weekly-brief"]).toBe("runner");
    expect(TERMINAL_STATUS_OWNER["correspondence-miner"]).toBe("graph");
    expect(TERMINAL_STATUS_OWNER["evidence-hunter"]).toBe("graph");
    expect(TERMINAL_STATUS_OWNER["hypothesis-drafter"]).toBe("graph");
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
    expect(redactError(new Error('{"API_KEY":"sk-supersecret"}'))).toBe(
      '{"API_KEY":"[REDACTED]"}',
    );
    expect(redactError(new Error("API_KEY='sk-supersecret'"))).toBe(
      "API_KEY='[REDACTED]'",
    );
    expect(redactError(new Error(`API_KEY='sk-"mixed-quotes"'`))).toBe(
      "API_KEY='[REDACTED]'",
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
