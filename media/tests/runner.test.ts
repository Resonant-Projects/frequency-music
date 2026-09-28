import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { runOnce } from "../src/runner";

// The runner logs claim/failure lines; keep test output quiet.
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

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

  test("a job for another renderer version is failed without running the handler", async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const tool = vi.fn(async (name: string, body: Record<string, unknown>) => {
      calls.push([name, body]);
      if (name === "claimNextMediaJob") {
        return claimedJob({ rendererVersion: "0.0.9" });
      }
      return { status: "queued", attempts: 1 };
    });
    const probe = vi.fn(async () => {
      throw new Error("should not run");
    });
    const outcome = await runOnce(
      {
        workerId: "w",
        kinds: ["probe"],
        workDir: "/tmp",
        rendererVersion: "0.1.0",
      },
      tool as never,
      { probe },
    );
    expect(outcome).toBe("failed");
    expect(probe).not.toHaveBeenCalled();
    const fail = calls.find(([name]) => name === "failMediaJob");
    expect(String(fail?.[1].error)).toMatch(/renderer version/);
  });

  test("a handler that never settles is failed at the deadline", async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const tool = vi.fn(async (name: string, body: Record<string, unknown>) => {
      calls.push([name, body]);
      if (name === "claimNextMediaJob") return claimedJob({});
      return { status: "queued", attempts: 1 };
    });
    const outcome = await runOnce(
      {
        workerId: "w",
        kinds: ["probe"],
        workDir: "/tmp",
        rendererVersion: "0.1.0",
        deadlineMs: 50,
      },
      tool as never,
      { probe: () => new Promise(() => {}) },
    );
    expect(outcome).toBe("failed");
    const fail = calls.find(([name]) => name === "failMediaJob");
    expect(fail?.[1]).toMatchObject({ jobId: "j1", leaseToken: "L" });
    expect(String(fail?.[1].error)).toMatch(/deadline/);
  });
});

function claimedJob(overrides: { rendererVersion?: string }) {
  return {
    jobId: "j1",
    kind: "probe",
    input: {
      kind: "probe",
      toneHz: 440,
      seconds: 1,
      rendererVersion: overrides.rendererVersion ?? "0.1.0",
    },
    leaseToken: "L",
    leaseExpiresAt: Date.now() + 60_000,
    attempts: 0,
  };
}
