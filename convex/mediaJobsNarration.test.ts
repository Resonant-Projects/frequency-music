import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOnce } from "../media/src/runner";
import type { JobHandler } from "../media/src/jobs/types";
import type { callTool } from "../media/src/convex";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { LEASE_MS, type MediaJobInput } from "./shared/mediaJobs";
import {
  probe,
  pendingArtifact,
  measured,
  insertBrief,
  narrationInput,
} from "../harness/mediaJobFixtures";

describe("mediaJobs narration and operator publication", () => {
  test("assembly claims refresh from the lossless master rather than its delivery", async () => {
    const t = convexTest(schema, modules);
    const job = await t.mutation(internal.mediaJobs.enqueue, { input: probe });
    const master = await pendingArtifact(t, job.jobId, "masterNormalized");
    const delivery = await pendingArtifact(t, job.jobId, "delivery", master);
    const expected = await t.run(async (ctx) =>
      ctx.storage.getUrl((await ctx.db.get(master))!.storageId!),
    );
    await t.mutation(internal.mediaJobs.enqueue, {
      input: {
        kind: "assembleEpisode",
        narrationArtifactId: delivery,
        narrationStorageUrl: "https://expired.example/master",
        title: "episode",
        chapters: [],
        rendererVersion: "0.1.0",
      },
    });
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w",
      kinds: ["assembleEpisode"],
    });
    expect(claim?.input).toMatchObject({ narrationStorageUrl: expected });
  });

  test("competing narration scripts for one brief admit only one job", async () => {
    const t = convexTest(schema, modules);
    const briefId = await insertBrief(t);
    const outcomes = await Promise.all([
      t.mutation(internal.mediaJobs.enqueue, {
        input: narrationInput(briefId, "First generated script."),
      }),
      t.mutation(internal.mediaJobs.enqueue, {
        input: narrationInput(briefId, "Different generated script."),
      }),
    ]);
    expect(outcomes.filter((outcome) => outcome.created)).toHaveLength(1);
    expect(outcomes[0]?.jobId).toBe(outcomes[1]?.jobId);
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w1",
      kinds: ["narrate"],
    });
    expect(claim?.jobId).toBe(outcomes[0]?.jobId);
    expect(
      await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "w2",
        kinds: ["narrate"],
      }),
    ).toBeNull();
  });

  test.each(["claimed", "done"] as const)(
    "a %s narration blocks a different script for the same brief",
    async (status) => {
      const t = convexTest(schema, modules);
      const briefId = await insertBrief(t);
      const first = await t.mutation(internal.mediaJobs.enqueue, {
        input: narrationInput(briefId, "First script."),
      });
      await t.run((ctx) => ctx.db.patch(first.jobId, { status }));
      expect(
        await t.mutation(internal.mediaJobs.enqueue, {
          input: narrationInput(briefId, "Different script."),
        }),
      ).toEqual({ jobId: first.jobId, created: false });
      expect(
        await t.query(internal.mediaJobs.narrateJobStateForBrief, { briefId }),
      ).toBe(status);
    },
  );

  test("a parked narration stays blocked until its job is marked failed", async () => {
    const t = convexTest(schema, modules);
    const briefId = await insertBrief(t);
    const input = narrationInput(briefId, "First script.");
    const first = await t.mutation(internal.mediaJobs.enqueue, { input });
    for (let attempt = 1; attempt <= 3; attempt++) {
      const claim = await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "w1",
        kinds: ["narrate"],
      });
      if (!claim) throw new Error("expected a narration job");
      await t.mutation(internal.mediaJobs.fail, {
        jobId: first.jobId,
        leaseToken: claim.leaseToken,
        error: "voice unavailable",
      });
    }
    expect(
      await t.query(internal.mediaJobs.narrateJobStateForBrief, { briefId }),
    ).toBe("parked");
    expect(
      await t.mutation(internal.mediaJobs.enqueue, {
        input: narrationInput(briefId, "Different script."),
      }),
    ).toEqual({ jobId: first.jobId, created: false });
    // A failed row represents a retryable operator-resolved job.
    await t.run((ctx) => ctx.db.patch(first.jobId, { status: "failed" }));
    expect(
      await t.query(internal.mediaJobs.narrateJobStateForBrief, { briefId }),
    ).toBeNull();
    const retry = await t.mutation(internal.mediaJobs.enqueue, { input });
    expect(retry.created).toBe(true);
    expect(retry.jobId).not.toBe(first.jobId);
    expect(
      await t.mutation(internal.mediaJobs.enqueue, {
        input: narrationInput(briefId, "Another script."),
      }),
    ).toEqual({ jobId: retry.jobId, created: false });
  });

  test("brief narration keeps the indexed priority even if a caller supplies another", async () => {
    const t = convexTest(schema, modules);
    const briefId = await insertBrief(t);
    const first = await t.mutation(internal.mediaJobs.enqueue, {
      input: narrationInput(briefId, "First script."),
      priority: 7,
    });
    expect(
      await t.query(internal.mediaJobs.narrateJobStateForBrief, { briefId }),
    ).toBe("queued");
    expect(
      await t.mutation(internal.mediaJobs.enqueue, {
        input: narrationInput(briefId, "Different script."),
      }),
    ).toEqual({ jobId: first.jobId, created: false });
  });

  test("narration without a brief retains snapshot dedupe", async () => {
    const t = convexTest(schema, modules);
    const input = narrationInput(undefined, "First script.");
    const first = await t.mutation(internal.mediaJobs.enqueue, {
      input,
      priority: 7,
    });
    const different = await t.mutation(internal.mediaJobs.enqueue, {
      input: narrationInput(undefined, "Different script."),
    });
    expect(different.created).toBe(true);
    expect(different.jobId).not.toBe(first.jobId);
    expect(await t.mutation(internal.mediaJobs.enqueue, { input })).toEqual({
      jobId: first.jobId,
      created: false,
    });
    await t.run((ctx) => ctx.db.patch(first.jobId, { status: "parked" }));
    const rerun = await t.mutation(internal.mediaJobs.enqueue, { input });
    expect(rerun.created).toBe(true);
    expect(rerun.jobId).not.toBe(first.jobId);
  });

  test.each(["parked", "failed"] as const)(
    "operator publication resumes its %s snapshot without replacing retained artifacts",
    async (status) => {
      const t = convexTest({ schema, modules, transactionLimits: true });
      const input: MediaJobInput = {
        ...narrationInput(undefined, "Essay"),
        rendererVersion: "essay-test",
        assembleOnDone: false,
      };
      const first = await t.mutation(internal.mediaJobs.enqueue, { input });
      const master = await pendingArtifact(
        t,
        first.jobId,
        "masterNormalized",
        undefined,
        "narration",
      );
      const delivery = await pendingArtifact(
        t,
        first.jobId,
        "delivery",
        master,
        "narration",
      );
      await t.run((ctx) =>
        ctx.db.patch(first.jobId, {
          status,
          attempts: 2,
          error: "Upload interrupted",
          finishedAt: 1,
          resultArtifactIds: [master, delivery],
        }),
      );
      const failureId = await t.run((ctx) =>
        ctx.db.insert("operationFailures", {
          operationId: `media:${first.jobId}`,
          causeKey: "operator",
          target: { kind: "audioUpload", jobId: first.jobId },
          message: "Upload interrupted",
          status: "needsReview",
          attempts: 3,
          createdAt: 1,
          updatedAt: 1,
          nextAttemptAt: 1,
        }),
      );
      const resumed = await t.mutation(internal.mediaJobs.enqueue, {
        input,
        resumeOperatorPublication: true,
      });
      expect(resumed).toEqual({ jobId: first.jobId, created: false });
      expect(await t.run((ctx) => ctx.db.get(first.jobId))).toMatchObject({
        status: "queued",
        attempts: 2,
        resultArtifactIds: [master, delivery],
      });
      expect(
        (await t.run((ctx) => ctx.db.query("mediaJobs").collect())).length,
      ).toBe(1);
      const claim = await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "operator",
        kinds: ["narrate"],
        rendererVersion: "essay-test",
      });
      expect(claim?.jobId).toBe(first.jobId);
      await t.mutation(internal.mediaJobs.complete, {
        jobId: first.jobId,
        leaseToken: claim!.leaseToken,
        result: {
          kind: "narrate",
          artifacts: [
            { ...measured, artifactId: master, mimeType: "audio/wav" },
            { ...measured, artifactId: delivery, mimeType: "audio/mpeg" },
          ],
          chapters: [],
        },
      });
      expect((await t.run((ctx) => ctx.db.get(failureId)))?.status).toBe(
        "resolved",
      );
      expect((await t.run((ctx) => ctx.db.get(master)))?.status).toBe("ready");
      expect((await t.run((ctx) => ctx.db.get(delivery)))?.status).toBe(
        "ready",
      );
    },
  );

  test("a parked operator publication reuses its retained completion without another upload", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const root = await mkdtemp(join(tmpdir(), "operator-publication-"));
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      const input: MediaJobInput = {
        ...narrationInput(undefined, "Essay"),
        rendererVersion: "essay-test",
        assembleOnDone: false,
      };
      const first = await t.mutation(internal.mediaJobs.enqueue, {
        input,
        resumeOperatorPublication: true,
      });
      let denyCompletion = true;
      const tool = vi.fn(
        async (name: string, args: Record<string, unknown>) => {
          if (name === "claimNextMediaJob")
            return t.mutation(internal.mediaJobs.claimNext, args as never);
          if (name === "completeMediaJob") {
            if (denyCompletion) throw new Error("Completion unavailable");
            return t.mutation(internal.mediaJobs.complete, args as never);
          }
          if (name === "failMediaJob")
            return t.mutation(internal.mediaJobs.fail, args as never);
          if (name === "renewMediaJobLease")
            return t.mutation(internal.mediaJobs.renewLease, args as never);
          throw new Error(`Unexpected tool ${name}`);
        },
      ) as typeof callTool;
      const upload = vi.fn(async ({ job }: Parameters<JobHandler>[0]) => {
        await vi.advanceTimersByTimeAsync(Math.floor(LEASE_MS / 3));
        const renewal = vi
          .mocked(tool)
          .mock.calls.findIndex(([name]) => name === "renewMediaJobLease");
        expect(renewal).toBeGreaterThanOrEqual(0);
        await expect(
          vi.mocked(tool).mock.results[renewal]!.value,
        ).resolves.toEqual({ leaseExpiresAt: expect.any(Number) });
        const master = await pendingArtifact(
          t,
          first.jobId,
          "masterNormalized",
          undefined,
          "narration",
        );
        const delivery = await pendingArtifact(
          t,
          first.jobId,
          "delivery",
          master,
          "narration",
        );
        return {
          kind: "narrate" as const,
          artifacts: [
            { ...measured, artifactId: master, mimeType: "audio/wav" },
            { ...measured, artifactId: delivery, mimeType: "audio/mpeg" },
          ],
          chapters: [],
        };
      });
      const config = {
        workerId: "operator",
        kinds: ["narrate"],
        workDir: root,
        rendererVersion: "essay-test",
      };
      expect(await runOnce(config, tool, { narrate: upload })).toBe("failed");
      await t.mutation(internal.mediaJobs.deferOperatorPublication, {
        jobId: first.jobId,
        rendererVersion: "essay-test",
        title: input.title,
      });
      const resumed = await t.mutation(internal.mediaJobs.enqueue, {
        input,
        resumeOperatorPublication: true,
      });
      expect(resumed).toEqual({ jobId: first.jobId, created: false });
      denyCompletion = false;
      expect(await runOnce(config, tool, { narrate: upload })).toBe("done");
      expect(upload).toHaveBeenCalledTimes(1);
      expect(
        (await t.run((ctx) => ctx.db.query("audioArtifacts").collect())).length,
      ).toBe(2);
      expect(
        (await t.run((ctx) => ctx.db.query("operationFailures").first()))
          ?.status,
      ).toBe("resolved");
      expect(await readdir(join(root, "retained"))).toEqual([]);
    } finally {
      vi.useRealTimers();
      await rm(root, { recursive: true, force: true });
    }
  });

  test("operator resume leaves an existing live lease intact and concurrent resumes share the job", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const input: MediaJobInput = {
      ...narrationInput(undefined, "Essay"),
      rendererVersion: "essay-test",
      assembleOnDone: false,
    };
    const first = await t.mutation(internal.mediaJobs.enqueue, { input });
    await t.run((ctx) =>
      ctx.db.patch(first.jobId, { status: "parked", attempts: 2 }),
    );
    const results = await Promise.all(
      [1, 2].map(() =>
        t.mutation(internal.mediaJobs.enqueue, {
          input,
          resumeOperatorPublication: true,
        }),
      ),
    );
    expect(results).toEqual(
      [first, first].map((row) => ({ jobId: row.jobId, created: false })),
    );
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "operator",
      kinds: ["narrate"],
      rendererVersion: "essay-test",
    });
    await t.mutation(internal.mediaJobs.enqueue, {
      input,
      resumeOperatorPublication: true,
    });
    expect((await t.run((ctx) => ctx.db.get(first.jobId)))?.leaseToken).toBe(
      claim?.leaseToken,
    );
    expect((await t.run((ctx) => ctx.db.get(first.jobId)))?.attempts).toBe(2);
  });

  // ~1 s locally, but slow CI runners passed 5 s.
  test("operator lookup is bounded with a backlog of large parked snapshots", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const input: MediaJobInput = {
      ...narrationInput(undefined, "x".repeat(900_000)),
      rendererVersion: "essay-test",
      assembleOnDone: false,
    };
    let latest: Id<"mediaJobs"> | undefined;
    for (let i = 0; i < 20; i++) {
      const row = await t.mutation(internal.mediaJobs.enqueue, { input });
      latest = row.jobId;
      await t.run((ctx) => ctx.db.patch(row.jobId, { status: "parked" }));
    }
    expect(
      await t.mutation(internal.mediaJobs.enqueue, {
        input,
        resumeOperatorPublication: true,
      }),
    ).toEqual({ jobId: latest, created: false });
  }, 20_000);

  test("standard renderer jobs cannot opt into operator publication resume", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    await expect(
      t.mutation(internal.mediaJobs.enqueue, {
        input: probe,
        resumeOperatorPublication: true,
      }),
    ).rejects.toThrow("Only operator essay");
  });

  test("operator assembly resumes the same narration-linked job", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const parentInput = {
      ...narrationInput(undefined, "Essay"),
      rendererVersion: "essay-test",
      assembleOnDone: false,
    };
    const parent = await t.mutation(internal.mediaJobs.enqueue, {
      input: parentInput,
    });
    const narration = await pendingArtifact(
      t,
      parent.jobId,
      "delivery",
      undefined,
      "narration",
    );
    await t.run((ctx) => ctx.db.patch(parent.jobId, { status: "done" }));
    const input: MediaJobInput = {
      kind: "assembleEpisode",
      narrationArtifactId: narration,
      narrationStorageUrl: "https://example.org/audio",
      title: "Essay",
      chapters: [],
      refs: {},
      rendererVersion: "essay-test",
    };
    const assembly = await t.mutation(internal.mediaJobs.enqueue, { input });
    await t.run((ctx) =>
      ctx.db.patch(assembly.jobId, { status: "parked", attempts: 2 }),
    );
    expect(
      await t.mutation(internal.mediaJobs.enqueue, {
        input,
        resumeOperatorPublication: true,
      }),
    ).toEqual({ jobId: assembly.jobId, created: false });
    expect((await t.run((ctx) => ctx.db.get(assembly.jobId)))?.input).toEqual(
      input,
    );
    expect(
      (
        await t.mutation(internal.mediaJobs.claimNext, {
          workerId: "operator",
          kinds: ["assembleEpisode"],
          rendererVersion: "essay-test",
        })
      )?.jobId,
    ).toBe(assembly.jobId);
  });
});
