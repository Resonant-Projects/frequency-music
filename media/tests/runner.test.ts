import { describe, expect, test, vi } from "vite-plus/test";
import { runOnce } from "../src/runner";

describe("runOnce", () => {
  test("idle when nothing is claimed", async () => {
    const calls: string[] = [];
    const tool = vi.fn(async (name: string) => {
      calls.push(name);
      return null;
    });
    const outcome = await runOnce(
      {
        workerId: "w",
        kinds: ["probe"],
        workDir: "/tmp",
        rendererVersion: "0.1.0",
      },
      tool as never,
      {},
    );
    expect(outcome).toBe("idle");
    expect(calls).toEqual(["claimNextMediaJob"]);
  });

  test("a handler error fails the job with a redacted message", async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const tool = vi.fn(async (name: string, body: Record<string, unknown>) => {
      calls.push([name, body]);
      if (name === "claimNextMediaJob") {
        return {
          jobId: "j1",
          kind: "probe",
          input: {
            kind: "probe",
            toneHz: 440,
            seconds: 1,
            rendererVersion: "0.1.0",
          },
          leaseToken: "L",
          leaseExpiresAt: Date.now() + 60_000,
          attempts: 0,
        };
      }
      return { status: "queued", attempts: 1 };
    });
    const outcome = await runOnce(
      {
        workerId: "w",
        kinds: ["probe"],
        workDir: "/tmp",
        rendererVersion: "0.1.0",
      },
      tool as never,
      {
        probe: async () => {
          throw new Error("boom secret=abc");
        },
      },
    );
    expect(outcome).toBe("failed");
    const fail = calls.find(([name]) => name === "failMediaJob");
    expect(fail?.[1]).toMatchObject({ jobId: "j1", leaseToken: "L" });
    expect(String(fail?.[1].error)).not.toContain("abc");
  });
});
