import { describe, expect, test, vi } from "vite-plus/test";
import { appendRemoteAuditEvent } from "../src/graphs/shared/audit";

describe("graph audit events", () => {
  test("keeps a local redacted error event when the remote append fails", async () => {
    const callTool = vi.fn(
      async (_name: string, _args: Record<string, unknown>) => {
        throw new Error("secret=do-not-log");
      },
    );

    const events = await appendRemoteAuditEvent(
      callTool,
      "run-1",
      "decision",
      "Discarded candidate",
      { pairKey: "a:b" },
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      kind: "decision",
      message: "Discarded candidate",
    });
    expect(events[1]).toMatchObject({
      kind: "error",
      payload: { message: "secret=[REDACTED]" },
    });
  });
});
