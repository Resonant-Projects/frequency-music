import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { LEASE_MS } from "../../convex/shared/mediaJobs";
import { runOnce } from "../src/runner";

const roots: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("scoped media lease renewal", () => {
  test.each(["complete", "expire"])(
    "a pending renewal does not overlap and is stopped after %s",
    async (finish) => {
      vi.useFakeTimers();
      vi.spyOn(console, "log").mockImplementation(() => {});
      const workDir = await mkdtemp(join(tmpdir(), "effect-media-lease-"));
      roots.push(workDir);
      let renewalSignal: AbortSignal | undefined;
      const tool = vi.fn(
        async (name: string, _args: unknown, signal?: AbortSignal) => {
          if (name === "claimNextMediaJob")
            return {
              jobId: "synthetic-job",
              kind: "probe",
              attempts: 0,
              input: { kind: "probe", rendererVersion: "test" },
              leaseToken: "synthetic-lease",
              leaseExpiresAt: Date.now() + LEASE_MS,
            };
          if (name === "renewMediaJobLease") {
            renewalSignal = signal;
            return await new Promise((_, reject) => {
              signal!.addEventListener("abort", () => reject(signal!.reason), {
                once: true,
              });
            });
          }
          return null;
        },
      );
      let complete!: () => void;
      let started!: () => void;
      const ready = new Promise<void>((resolve) => {
        started = resolve;
      });
      let jobSignal: AbortSignal | undefined;
      const running = runOnce(
        {
          workerId: "test",
          kinds: ["probe"],
          workDir,
          rendererVersion: "test",
        },
        tool as never,
        {
          probe: ({ signal }) =>
            new Promise((resolve, reject) => {
              jobSignal = signal;
              complete = () => resolve({ kind: "probe", artifacts: [] });
              signal.addEventListener("abort", () => reject(signal.reason), {
                once: true,
              });
              started();
            }),
        },
      );
      await ready;
      await vi.advanceTimersByTimeAsync(Math.floor(LEASE_MS / 3) * 2);
      expect(
        tool.mock.calls.filter(([name]) => name === "renewMediaJobLease"),
      ).toHaveLength(1);
      if (finish === "complete") complete();
      else await vi.advanceTimersByTimeAsync(LEASE_MS);
      expect(await running).toBe(finish === "complete" ? "done" : "failed");
      expect(jobSignal?.aborted).toBe(finish === "expire");
      expect(renewalSignal?.aborted).toBe(true);
      await vi.advanceTimersByTimeAsync(LEASE_MS);
      expect(
        tool.mock.calls.filter(([name]) => name === "renewMediaJobLease"),
      ).toHaveLength(1);
    },
  );
});
