import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
let scratch: string;
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { runOnce } from "../src/runner";
import { LEASE_MS } from "../../convex/shared/mediaJobs";

// The runner logs claim/failure lines; keep test output quiet.
beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "media-runner-test-"));
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("runOnce", () => {
  test("a failed completion write reuses the persisted result on the next lease", async () => {
    let attempt = 0;
    const tool = vi.fn(async (name: string) => {
      if (name === "claimNextMediaJob")
        return {
          jobId: "retained-job",
          kind: "probe",
          input: { kind: "probe", rendererVersion: "0.1.0" },
          leaseToken: `lease-${attempt}`,
          attempts: attempt,
        };
      if (name === "completeMediaJob" && attempt === 0)
        throw new Error("connection lost");
      if (name === "failMediaJob") attempt++;
      return null;
    });
    const handler = vi.fn(async () => ({ kind: "probe", artifacts: [] }));
    const config = {
      workerId: "w",
      kinds: ["probe"],
      workDir: scratch,
      rendererVersion: "0.1.0",
    };
    expect(
      await runOnce(config, tool as never, { probe: handler as never }),
    ).toBe("failed");
    expect(
      await runOnce(config, tool as never, { probe: handler as never }),
    ).toBe("done");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(readdirSync(join(scratch, "retained"))).toEqual([]);
  });

  test.each([false, true])(
    "a transient renewal failure survives, consecutive failures abort=%s",
    async (repeatFailure) => {
      vi.useFakeTimers();
      let calls = 0;
      const tool = vi.fn(async (name: string) => {
        if (name === "claimNextMediaJob")
          return { ...claimedJob({}), leaseExpiresAt: Date.now() + LEASE_MS };
        if (name === "renewMediaJobLease") {
          if (++calls === 1 || repeatFailure)
            throw new Error("transient network error");
          return { leaseExpiresAt: Date.now() + LEASE_MS };
        }
        return null;
      });
      let resolve!: (value: { kind: "probe"; artifacts: [] }) => void;
      let signal!: AbortSignal;
      let started!: () => void;
      const ready = new Promise<void>((done) => {
        started = done;
      });
      const running = runOnce(
        {
          workerId: "w",
          kinds: ["probe"],
          workDir: scratch,
          rendererVersion: "0.1.0",
        },
        tool as never,
        {
          probe: (ctx) => {
            signal = ctx.signal;
            started();
            return new Promise((done, reject) => {
              resolve = done;
              signal.addEventListener("abort", () => reject(signal.reason));
            });
          },
        },
      );
      try {
        await ready;
        await vi.advanceTimersByTimeAsync(Math.floor(LEASE_MS / 3));
        expect(signal.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(Math.floor(LEASE_MS / 3));
        expect(signal.aborted).toBe(repeatFailure);
        if (!repeatFailure) resolve({ kind: "probe", artifacts: [] });
        expect(await running).toBe(repeatFailure ? "failed" : "done");
      } finally {
        vi.useRealTimers();
      }
    },
  );

  test.each([true, false])(
    "a server-confirmed pre-render failure can start without a paid-work checkpoint, allowed=%s",
    async (freshStartAllowed) => {
      const tool = vi.fn(async (name: string) =>
        name === "claimNextMediaJob"
          ? {
              jobId: "rollout",
              kind: "probe",
              input: { kind: "probe", rendererVersion: "new" },
              leaseToken: "lease",
              attempts: 1,
              freshStartAllowed,
            }
          : null,
      );
      const handler = vi.fn(async () => ({ kind: "probe", artifacts: [] }));
      const outcome = await runOnce(
        {
          workerId: "new",
          kinds: ["probe"],
          workDir: scratch,
          rendererVersion: "new",
        },
        tool as never,
        { probe: handler as never },
      );
      expect(outcome).toBe(freshStartAllowed ? "done" : "failed");
      expect(handler).toHaveBeenCalledTimes(freshStartAllowed ? 1 : 0);
    },
  );

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
        workDir: scratch,
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
        workDir: scratch,
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
        workDir: scratch,
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

  test("a handler that never settles is aborted and failed at the deadline", async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const tool = vi.fn(async (name: string, body: Record<string, unknown>) => {
      calls.push([name, body]);
      if (name === "claimNextMediaJob") return claimedJob({});
      return { status: "queued", attempts: 1 };
    });
    let observedAbort = false;
    const outcome = await runOnce(
      {
        workerId: "w",
        kinds: ["probe"],
        workDir: scratch,
        rendererVersion: "0.1.0",
        deadlineMs: 50,
      },
      tool as never,
      {
        // Settles only when the runner's signal fires, as a killed ffmpeg would.
        probe: (ctx) =>
          new Promise((_, reject) => {
            ctx.signal.addEventListener("abort", () => {
              observedAbort = ctx.signal.aborted;
              reject(new Error("aborted"));
            });
          }),
      },
    );
    expect(outcome).toBe("failed");
    expect(observedAbort).toBe(true);
    const fail = calls.find(([name]) => name === "failMediaJob");
    expect(fail?.[1]).toMatchObject({ jobId: "j1", leaseToken: "L" });
    expect(String(fail?.[1].error)).toMatch(/deadline/);
  });

  test("a handler that ignores the abort signal is failed after the grace window", async () => {
    const calls: string[] = [];
    const tool = vi.fn(async (name: string) => {
      calls.push(name);
      if (name === "claimNextMediaJob") return claimedJob({});
      return { status: "queued", attempts: 1 };
    });
    const outcome = await runOnce(
      {
        workerId: "w",
        kinds: ["probe"],
        workDir: scratch,
        rendererVersion: "0.1.0",
        deadlineMs: 20,
        deadlineGraceMs: 20,
      },
      tool as never,
      { probe: () => new Promise(() => {}) },
    );
    expect(outcome).toBe("failed");
    expect(calls).toContain("failMediaJob");
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
