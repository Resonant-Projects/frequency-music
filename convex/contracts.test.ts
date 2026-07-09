import { afterEach, describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import schema, { agentRunEventKindValidator } from "./schema";
import { modules } from "./harness/modules";

// Contract tests pin copies that must agree across seams. When one of these
// fails, fix the drifted copy rather than widening the test.
const EXPECTED_EVENT_KINDS = [
  "decision",
  "draft_write",
  "error",
  "memory_recall",
  "model_call",
  "node",
  "review_request",
  "status",
  "tool_call",
].toSorted();

const originalAgentToolSecret = process.env.AGENT_TOOL_SECRET;

afterEach(() => {
  if (originalAgentToolSecret === undefined) {
    delete process.env.AGENT_TOOL_SECRET;
  } else {
    process.env.AGENT_TOOL_SECRET = originalAgentToolSecret;
  }
});

describe("agent run event kinds", () => {
  test("schema validator carries exactly the canonical kinds", () => {
    const members = (
      agentRunEventKindValidator as unknown as {
        members: Array<{ value: string }>;
      }
    ).members.map((member) => member.value);

    expect(members.toSorted()).toEqual(EXPECTED_EVENT_KINDS);
  });

  test("HTTP surface accepts and persists memory_recall", async () => {
    process.env.AGENT_TOOL_SECRET = "contract-test-secret";
    const t = convexTest(schema, modules);
    const runId = await t.run((ctx) =>
      ctx.db.insert("agentRuns", {
        graphName: "research-pipeline",
        status: "running",
        input: null,
        createdAt: 1000,
        updatedAt: 1000,
      }),
    );

    const response = await t.fetch("/agent-tools/appendAgentRunEvent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: "contract-test-secret",
        runId,
        kind: "memory_recall",
        message: "Prior failed path changed this run's decision.",
      }),
    });

    expect(response.status).toBe(200);
    const events = await t.run((ctx) =>
      ctx.db
        .query("agentRunEvents")
        .withIndex("by_runId_createdAt", (query) => query.eq("runId", runId))
        .collect(),
    );
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("memory_recall");
  });
});

// Heartbeat/stale timing contract: HEARTBEAT_INTERVAL_MS < DEFAULT_STALE_RUN_MS.
// BLOCKED until plan 2026-07-03-05 lands convex/shared/agentContract.ts; the
// worker constant lives in a separate workspace today. Enable after plan 05.
test.todo(
  "heartbeat fits inside the stale threshold (needs plan 05 shared contract)",
);
