import { describe, expect, test } from "bun:test";
import { agentRunEventKindValidator, agentRunStatusValidator } from "../schema";
import {
  AGENT_RUN_EVENT_KINDS,
  AGENT_RUN_STATUSES,
  HEARTBEAT_INTERVAL_MS,
  KNOWN_GRAPH_NAMES,
  STALE_RUN_MS,
  TERMINAL_STATUS_OWNER,
} from "./agentContract";
import { AGENT_RUN_STATUSES as STATUS_SOURCE } from "./statuses";

describe("agentContract", () => {
  test("event kinds match the canonical nine-member contract", () => {
    expect(AGENT_RUN_EVENT_KINDS).toEqual([
      "tool_call",
      "decision",
      "draft_write",
      "error",
      "review_request",
      "status",
      "node",
      "memory_recall",
      "model_call",
    ]);
  });

  test("run statuses come from shared statuses", () => {
    expect(AGENT_RUN_STATUSES).toBe(STATUS_SOURCE);
    expect(AGENT_RUN_STATUSES).toEqual([
      "queued",
      "running",
      "needs_review",
      "completed",
      "failed",
      "cancelled",
    ]);
  });

  test("a healthy worker can never be swept", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(STALE_RUN_MS);
    expect(STALE_RUN_MS / HEARTBEAT_INTERVAL_MS).toBeGreaterThanOrEqual(2);
  });

  test("every known graph has a terminal-status owner", () => {
    for (const name of KNOWN_GRAPH_NAMES) {
      expect(["graph", "runner"]).toContain(TERMINAL_STATUS_OWNER[name]);
    }
  });
});

describe("schema validators derive from agentContract", () => {
  test("event-kind members equal the shared contract", () => {
    const members = (
      agentRunEventKindValidator as unknown as {
        members: Array<{ value: string }>;
      }
    ).members.map((member) => member.value);

    expect(members).toEqual([...AGENT_RUN_EVENT_KINDS]);
  });

  test("run-status members equal the shared contract", () => {
    const members = (
      agentRunStatusValidator as unknown as {
        members: Array<{ value: string }>;
      }
    ).members.map((member) => member.value);

    expect(members).toEqual([...AGENT_RUN_STATUSES]);
  });
});
