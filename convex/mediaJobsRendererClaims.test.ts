import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOnce } from "../media/src/runner";
import type { callTool } from "../media/src/convex";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";
import { agentToolByName } from "./agentToolRegistry";
import { agentToolArgs } from "./shared/agentToolArgs";
import { probe, narrationInput, probePair } from "../harness/mediaJobFixtures";

describe("mediaJobs renderer claims", () => {
  test("compatible runner finishes after repeated old-worker claims without repeating its handler", async () => {
    const t = convexTest(schema, modules);
    const root = await mkdtemp(join(tmpdir(), "media-rollout-"));
    try {
      const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
        input: probe,
      });
      const { result } = await probePair(t, jobId);
      const handler = vi.fn(async () => result);
      const tool = async (name: string, args: Record<string, unknown>) => {
        if (name === "claimNextMediaJob") {
          // Simulate a legacy caller that claimed before compatibility filtering.
          const { rendererVersion: _version, ...legacyArgs } = args;
          return t.mutation(internal.mediaJobs.claimNext, legacyArgs as never);
        }
        if (name === "failMediaJob")
          return t.mutation(internal.mediaJobs.fail, args as never);
        if (name === "completeMediaJob")
          return t.mutation(internal.mediaJobs.complete, args as never);
        throw new Error(`Unexpected tool ${name}`);
      };
      const config = {
        workerId: "old",
        kinds: ["probe"],
        rendererVersion: "old",
        workDir: root,
      };
      for (let i = 0; i < 5; i++)
        expect(
          await runOnce(config, tool as typeof callTool, { probe: handler }),
        ).toBe("failed");
      expect(handler).not.toHaveBeenCalled();
      expect(
        await runOnce(
          {
            ...config,
            workerId: "current",
            rendererVersion: probe.rendererVersion,
          },
          tool as typeof callTool,
          { probe: handler },
        ),
      ).toBe("done");
      expect(handler).toHaveBeenCalledTimes(1);
      expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe("done");
      expect(await readdir(join(root, "retained"))).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test.each([false, true])(
    "renderer-only mismatches preserve the ordinary attempt budget and checkpoint guard, prior failure=%s",
    async (priorFailure) => {
      const t = convexTest(schema, modules);
      const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
        input: probe,
      });
      if (priorFailure) {
        const claim = await t.mutation(internal.mediaJobs.claimNext, {
          workerId: "current",
          kinds: ["probe"],
        });
        await t.mutation(internal.mediaJobs.fail, {
          jobId,
          leaseToken: claim!.leaseToken,
          error: "network failed after synthesis",
        });
      }
      for (let i = 0; i < 5; i++) {
        const claim = await t.mutation(internal.mediaJobs.claimNext, {
          workerId: "old",
          kinds: ["probe"],
        });
        expect(claim?.jobId).toBe(jobId);
        await t.mutation(internal.mediaJobs.fail, {
          jobId,
          leaseToken: claim!.leaseToken,
          error: `renderer version mismatch: job requested ${probe.rendererVersion}, worker is old`,
        });
      }
      const claim = await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "current",
        kinds: ["probe"],
      });
      expect(claim?.attempts).toBe(priorFailure ? 1 : 0);
      expect(claim?.freshStartAllowed).toBe(!priorFailure);
      expect(
        await t.run((ctx) => ctx.db.query("operationFailures").collect()),
      ).toHaveLength(0);
      await t.mutation(internal.mediaJobs.fail, {
        jobId,
        leaseToken: claim!.leaseToken,
        error: "network failure",
      });
      expect((await t.run((ctx) => ctx.db.get(jobId)))?.attempts).toBe(
        priorFailure ? 2 : 1,
      );
    },
  );

  test("renderer-aware runners skip incompatible higher-priority snapshots and continue compatible work", async () => {
    const t = convexTest(schema, modules);
    const root = await mkdtemp(join(tmpdir(), "media-version-filter-"));
    try {
      const older = await t.mutation(internal.mediaJobs.enqueue, {
        input: { ...probe, rendererVersion: "old" },
        priority: 0,
      });
      const newer = await t.mutation(internal.mediaJobs.enqueue, {
        input: probe,
        priority: 10,
      });
      const { result } = await probePair(t, newer.jobId);
      const handler = vi.fn(async () => result);
      const tool = async (name: string, args: Record<string, unknown>) => {
        if (name === "claimNextMediaJob")
          return agentToolByName.claimNextMediaJob.run(
            { runMutation: t.mutation.bind(t) } as never,
            agentToolArgs.claimNextMediaJob.parse(args),
          );
        if (name === "completeMediaJob")
          return t.mutation(internal.mediaJobs.complete, args as never);
        if (name === "failMediaJob")
          return t.mutation(internal.mediaJobs.fail, args as never);
        throw new Error(`Unexpected tool ${name}`);
      };
      const config = {
        workerId: "current",
        kinds: ["probe"],
        rendererVersion: probe.rendererVersion,
        workDir: root,
      };
      expect(
        await runOnce(config, tool as typeof callTool, { probe: handler }),
      ).toBe("done");
      expect(handler).toHaveBeenCalledTimes(1);
      expect((await t.run((ctx) => ctx.db.get(older.jobId)))?.status).toBe(
        "queued",
      );
      expect((await t.run((ctx) => ctx.db.get(older.jobId)))?.attempts).toBe(0);
      expect(
        await runOnce(config, tool as typeof callTool, { probe: handler }),
      ).toBe("idle");
      expect(
        (
          await t.mutation(internal.mediaJobs.claimNext, {
            workerId: "old",
            kinds: ["probe"],
            rendererVersion: "old",
          })
        )?.jobId,
      ).toBe(older.jobId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("renderer-specific claims stay within transaction limits behind large incompatible jobs", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    for (let i = 0; i < 20; i++) {
      await t.run((ctx) =>
        ctx.db.insert("mediaJobs", {
          kind: "narrate",
          input: {
            ...narrationInput(undefined, "x".repeat(900_000)),
            rendererVersion: "old",
          },
          dedupeKey: `incompatible-${i}`,
          status: "queued",
          priority: 0,
          attempts: 0,
          createdAt: i,
        }),
      );
    }
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: narrationInput(undefined, "compatible"),
    });
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "current",
      kinds: ["narrate"],
      rendererVersion: "0.2.0",
    });
    expect(claim?.jobId).toBe(jobId);
    expect(claim?.input.rendererVersion).toBe("0.2.0");
  });
});
