import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOnce } from "../media/src/runner";
import type { callTool } from "../media/src/convex";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { agentToolByName } from "./agentToolRegistry";
import { agentToolArgs } from "./shared/agentToolArgs";
import { LEASE_MS, type MediaJobInput } from "./shared/mediaJobs";

const probe = {
  kind: "probe" as const,
  toneHz: 440,
  seconds: 1,
  rendererVersion: "0.1.0",
};

type Role = "masterNormalized" | "delivery";

// A pending artifact with a blob attached, as the worker leaves it before
// completing the job. The delivery carries its master's id.
async function pendingArtifact(
  t: ReturnType<typeof convexTest>,
  jobId: string,
  role: Role,
  masterArtifactId?: Id<"audioArtifacts">,
  kind: "probe" | "narration" = "probe",
) {
  const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
    fields: {
      kind,
      role,
      masterArtifactId,
      metadataStripped: false,
      status: "pending",
      encoding:
        role === "masterNormalized"
          ? { codec: "wav", sampleRate: 48000, channels: 1 }
          : { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 },
      normalization: "applied",
      access: "private",
      title: "probe",
      refs: { mediaJobId: jobId as never },
      contentHash: `c-${role}`,
      createdBy: "system",
    },
  });
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
  await t.mutation(internal.audioArtifacts.attachStorage, {
    artifactId,
    storageId,
  });
  return artifactId;
}

const measured = { durationSecs: 1, loudnessLufs: -16, truePeakDbtp: -1.5 };

async function insertBrief(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) =>
    ctx.db.insert("weeklyBriefs", {
      weekOf: "2026-09-21",
      model: "m",
      promptVersion: "v",
      bodyMd: "brief",
      sourceIds: [],
      recommendedHypothesisIds: [],
      recommendedRecipeIds: [],
      visibility: "private",
      createdBy: "system",
      createdAt: Date.now(),
    }),
  );
}

function narrationInput(
  briefId: Id<"weeklyBriefs"> | undefined,
  paragraph: string,
): Extract<MediaJobInput, { kind: "narrate" }> {
  return {
    kind: "narrate",
    script: { paragraphs: [paragraph], chapters: [] },
    voiceId: "breeze-2",
    promptVersion: "narration.v1",
    target: "spoken",
    title: "Weekly turn",
    access: "feed",
    refs: briefId ? { weeklyBriefId: briefId } : {},
    assembleOnDone: true,
    rendererVersion: "0.2.0",
  };
}

// The pair a probe job produces, ready to be submitted as its result.
async function probePair(t: ReturnType<typeof convexTest>, jobId: string) {
  const masterId = await pendingArtifact(t, jobId, "masterNormalized");
  const deliveryId = await pendingArtifact(t, jobId, "delivery", masterId);
  const result = {
    kind: "probe" as const,
    artifacts: [
      { ...measured, artifactId: masterId, mimeType: "audio/wav" },
      { ...measured, artifactId: deliveryId, mimeType: "audio/mpeg" },
    ],
  };
  return { masterId, deliveryId, result };
}

describe("mediaJobs lifecycle", () => {
  test.each([false, true])(
    "lost completion response is acknowledged without repeating rendering, cached=%s",
    async (cached) => {
      const t = convexTest(schema, modules);
      const root = await mkdtemp(join(tmpdir(), "media-completion-"));
      try {
        const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
          input: probe,
        });
        const { result, masterId, deliveryId } = await probePair(t, jobId);
        let denyCompletion = cached;
        let loseResponse = true;
        const completionBodies: unknown[] = [];
        const tool = vi.fn(
          async (name: string, args: Record<string, unknown>) => {
            if (name === "claimNextMediaJob")
              return t.mutation(internal.mediaJobs.claimNext, args as never);
            if (name === "completeMediaJob") {
              completionBodies.push(args);
              if (denyCompletion)
                throw new Error("Completion unavailable before commit");
              const completed = await t.mutation(
                internal.mediaJobs.complete,
                args as never,
              );
              if (loseResponse) {
                loseResponse = false;
                expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe(
                  "done",
                );
                throw new Error("Response lost after committed completion");
              }
              return completed;
            }
            if (name === "failMediaJob")
              return t.mutation(internal.mediaJobs.fail, args as never);
            throw new Error(`Unexpected tool ${name}`);
          },
        );
        const handler = vi.fn(async () => result);
        const config = {
          workerId: "test",
          kinds: ["probe"],
          rendererVersion: probe.rendererVersion,
          workDir: root,
        };
        if (cached) {
          expect(
            await runOnce(config, tool as typeof callTool, { probe: handler }),
          ).toBe("failed");
          expect(await readdir(join(root, "retained"))).toHaveLength(1);
          denyCompletion = false;
        }
        expect(
          await runOnce(config, tool as typeof callTool, { probe: handler }),
        ).toBe("done");
        expect(handler).toHaveBeenCalledTimes(1);
        expect(completionBodies.slice(-2)[0]).toEqual(
          completionBodies.slice(-2)[1],
        );
        expect(
          tool.mock.calls.filter(([name]) => name === "failMediaJob"),
        ).toHaveLength(cached ? 1 : 0);
        expect(await readdir(join(root, "retained"))).toEqual([]);
        expect(
          (await t.run((ctx) => ctx.db.get(jobId)))?.resultArtifactIds,
        ).toEqual([masterId, deliveryId]);
        expect((await t.run((ctx) => ctx.db.get(deliveryId)))?.status).toBe(
          "ready",
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  async function approvedMediaRecovery() {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    for (let i = 0; i < 3; i++) {
      const claim = await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "initial",
        kinds: ["probe"],
      });
      await t.mutation(internal.mediaJobs.fail, {
        jobId,
        leaseToken: claim!.leaseToken,
        error: "TTS HTTP 429",
      });
    }
    const failure = await t.run((ctx) =>
      ctx.db
        .query("operationFailures")
        .withIndex("by_operation", (q) => q.eq("operationId", `media:${jobId}`))
        .unique(),
    );
    const failureId = failure!._id;
    await t.run((ctx) => ctx.db.patch(failureId, { nextAttemptAt: 0 }));
    await t.mutation(internal.operationFailures.claimRecovery, { failureId });
    const investigating = await t.run((ctx) => ctx.db.get(failureId));
    const runId = investigating!.investigationRunId!;
    await t.run((ctx) => ctx.db.patch(runId, { status: "running" }));
    await t.mutation(internal.operationFailures.submitDiagnosis, {
      agentRunId: runId,
      result: { diagnosis: "Retry transient rejection", recover: true },
    });
    const attempt = await t.mutation(internal.operationFailures.claimRecovery, {
      failureId,
    });
    expect(attempt).toBe(1);
    await t.mutation(internal.operationFailures.dispatch, {
      failureId,
      attempt: attempt!,
    });
    return { t, jobId, failureId, runId };
  }

  test("media recovery dispatch schedules a near-term outcome check", async () => {
    const { t, failureId } = await approvedMediaRecovery();
    const row = await t.run((ctx) => ctx.db.get(failureId));
    expect(row!.nextAttemptAt - Date.now()).toBeLessThanOrEqual(60_000);
    expect(row!.status).toBe("recovering");
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(
      scheduled.some(
        (entry) =>
          entry.name === "operationFailures:reconcile" &&
          entry.scheduledTime <= Date.now() + 60_000,
      ),
    ).toBe(true);
  });

  test("media completion settles its operational recovery in the same transaction", async () => {
    const { t, jobId, failureId } = await approvedMediaRecovery();
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "recovery",
      kinds: ["probe"],
    });
    const { result } = await probePair(t, jobId);
    await t.mutation(internal.mediaJobs.complete, {
      jobId,
      leaseToken: claim!.leaseToken,
      result,
    });
    expect((await t.run((ctx) => ctx.db.get(failureId)))?.status).toBe(
      "resolved",
    );
  });

  test.each([
    "Retained job checkpoint missing",
    "GEMINI_API_KEY is not configured",
    "TTS HTTP 503",
  ])(
    "a failed media recovery discards its old diagnosis and investigates the current cause: %s",
    async (error) => {
      const { t, jobId, failureId, runId } = await approvedMediaRecovery();
      const claim = await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "recovery",
        kinds: ["probe"],
      });
      await t.mutation(internal.mediaJobs.fail, {
        jobId,
        leaseToken: claim!.leaseToken,
        error,
      });
      const failed = await t.run((ctx) => ctx.db.get(failureId));
      expect(failed?.status).toBe("recorded");
      expect(failed?.diagnosis).toBeUndefined();
      expect(failed?.causeKey).not.toBe("media:probe:rate_limit");
      expect(failed?.attempts).toBe(1);
      await t.run((ctx) => ctx.db.patch(failureId, { nextAttemptAt: 0 }));
      expect(
        await t.mutation(internal.operationFailures.claimRecovery, {
          failureId,
        }),
      ).toBeNull();
      const next = await t.run((ctx) => ctx.db.get(failureId));
      expect(next?.status).toBe("investigating");
      expect(next?.investigationRunId).not.toBe(runId);
      await t.run((ctx) =>
        ctx.db.patch(next!.investigationRunId!, { status: "running" }),
      );
      const evidence = await t.query(
        internal.operationFailures.getInvestigation,
        { agentRunId: next!.investigationRunId! },
      );
      expect(evidence[0]?.evidence.error).toBe(error);
      if (error.includes("checkpoint")) {
        await t.mutation(internal.operationFailures.submitDiagnosis, {
          agentRunId: next!.investigationRunId!,
          result: {
            diagnosis: "Stale approval cannot bypass prerequisites",
            recover: true,
          },
        });
        expect((await t.run((ctx) => ctx.db.get(failureId)))?.status).toBe(
          "needsReview",
        );
        expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe(
          "parked",
        );
      }
    },
  );

  test("new media prerequisites block an already approved retry", async () => {
    const { t, jobId, failureId } = await approvedMediaRecovery();
    await t.run(async (ctx) => {
      await ctx.db.patch(jobId, {
        status: "parked",
        error: "Retained job checkpoint missing",
      });
      await ctx.db.patch(failureId, { status: "recorded", nextAttemptAt: 0 });
    });
    expect(
      await t.mutation(internal.operationFailures.claimRecovery, { failureId }),
    ).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(failureId)))?.status).toBe(
      "investigating",
    );
    expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe("parked");
  });

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

  test("media investigations group the actual cause and keep independent recovery decisions", async () => {
    const t = convexTest(schema, modules);
    const failures: Id<"operationFailures">[] = [];
    for (const [i, error] of [
      "TTS HTTP 429: too many requests for voice A",
      "TTS HTTP 429: too many requests for voice B",
      "GEMINI_API_KEY is not configured",
    ].entries()) {
      const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
        input: narrationInput(undefined, `Distinct script ${i}`),
      });
      for (let attempt = 0; attempt < 3; attempt++) {
        const claim = await t.mutation(internal.mediaJobs.claimNext, {
          workerId: "w",
          kinds: ["narrate"],
        });
        await t.mutation(internal.mediaJobs.fail, {
          jobId,
          leaseToken: claim!.leaseToken,
          error,
        });
      }
      const failure = await t.run((ctx) =>
        ctx.db
          .query("operationFailures")
          .withIndex("by_operation", (q) =>
            q.eq("operationId", `media:${jobId}`),
          )
          .unique(),
      );
      failures.push(failure!._id);
      await t.run((ctx) => ctx.db.patch(failure!._id, { nextAttemptAt: 0 }));
      await t.mutation(internal.operationFailures.claimRecovery, {
        failureId: failure!._id,
      });
    }
    const rows = await t.run(async (ctx) =>
      Promise.all(failures.map((id) => ctx.db.get(id))),
    );
    expect(rows[0]?.causeKey).toBe(rows[1]?.causeKey);
    expect(rows[0]?.investigationRunId).toBe(rows[1]?.investigationRunId);
    expect(rows[2]?.causeKey).not.toBe(rows[0]?.causeKey);
    expect(rows[2]?.investigationRunId).not.toBe(rows[0]?.investigationRunId);
    for (const [i, recover] of [
      [0, true],
      [2, false],
    ] as const) {
      const runId = rows[i]!.investigationRunId!;
      await t.run((ctx) => ctx.db.patch(runId, { status: "running" }));
      await t.mutation(internal.operationFailures.submitDiagnosis, {
        agentRunId: runId,
        result: {
          diagnosis: recover ? "Transient rejection" : "Missing key",
          recover,
        },
      });
    }
    expect((await t.run((ctx) => ctx.db.get(failures[0]!)))?.status).toBe(
      "recorded",
    );
    expect((await t.run((ctx) => ctx.db.get(failures[1]!)))?.status).toBe(
      "recorded",
    );
    expect((await t.run((ctx) => ctx.db.get(failures[2]!)))?.status).toBe(
      "needsReview",
    );
  });

  test("media failure diagnostics preserve Unicode while exhausting the existing retry budget", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    for (let attempt = 0; attempt < 3; attempt++) {
      const claim = await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "w",
        kinds: ["probe"],
      });
      await t.mutation(internal.mediaJobs.fail, {
        jobId,
        leaseToken: claim!.leaseToken,
        error: `${"x".repeat(1999)}🧠 detail`,
      });
      expect((await t.run((ctx) => ctx.db.get(jobId)))?.error).toBe(
        "x".repeat(1999),
      );
    }
    expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe("parked");
    const failure = await t.run((ctx) =>
      ctx.db
        .query("operationFailures")
        .withIndex("by_operation", (q) => q.eq("operationId", `media:${jobId}`))
        .unique(),
    );
    expect(failure?.status).toBe("recorded");
  });

  test("a capped media job still receives one complete execution per operational recovery attempt", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    const failureId = await t.run(async (ctx) => {
      await ctx.db.patch(jobId, { status: "parked", attempts: 3 });
      return ctx.db.insert("operationFailures", {
        operationId: `audio:${jobId}`,
        causeKey: "audio:upload",
        target: { kind: "audioUpload", jobId },
        message: "Upload failed",
        status: "retrying",
        attempts: 1,
        nextAttemptAt: 0,
        createdAt: 1,
        updatedAt: 1,
      });
    });
    expect(
      await t.mutation(internal.operationFailures.dispatch, {
        failureId,
        attempt: 1,
      }),
    ).toBe(true);
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "recovery",
      kinds: ["probe"],
    });
    expect(claim?.jobId).toBe(jobId);
    expect(claim?.attempts).toBe(3);
    const { result } = await probePair(t, jobId);
    await t.mutation(internal.mediaJobs.complete, {
      jobId,
      leaseToken: claim!.leaseToken,
      result,
    });
    expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe("done");
  });
  test("one stale-lease sweep drains a crash backlog through separate bounded transactions", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest({ schema, modules, transactionLimits: true });
      const jobs: Id<"mediaJobs">[] = [];
      for (let i = 0; i < 3; i++) {
        const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
          input: { ...probe, toneHz: 440 + i },
        });
        jobs.push(jobId);
        await t.mutation(internal.mediaJobs.claimNext, {
          workerId: `worker-${i}`,
          kinds: ["probe"],
        });
        await t.run((ctx) => ctx.db.patch(jobId, { leaseExpiresAt: 0 }));
      }
      expect(await t.mutation(internal.mediaJobs.sweepStale, {})).toEqual({
        requeued: 1,
        parked: 0,
      });
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
      for (const id of jobs)
        expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
          status: "queued",
          attempts: 1,
        });
    } finally {
      vi.useRealTimers();
    }
  });
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

  test("enqueue dedupes identical snapshots into one row", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    const second = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.jobId).toBe(first.jobId);
    const rows = await t.run((ctx) => ctx.db.query("mediaJobs").collect());
    expect(rows).toHaveLength(1);
  });

  test("claim issues a lease; a second claim for the same kinds gets null", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.mediaJobs.enqueue, { input: probe });
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w1",
      kinds: ["probe"],
    });
    expect(claim?.kind).toBe("probe");
    expect(claim?.leaseToken).toMatch(/[0-9a-f-]{36}/);
    expect(claim!.leaseExpiresAt - Date.now()).toBeGreaterThan(
      LEASE_MS - 5_000,
    );
    expect(
      await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "w2",
        kinds: ["probe"],
      }),
    ).toBeNull();
  });

  test("complete is fenced by lease token and applies probe effects", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w1",
      kinds: ["probe"],
    });
    const { masterId, deliveryId, result } = await probePair(t, jobId);
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken: "wrong",
        result,
      }),
    ).rejects.toThrow(/lease/);
    const done = await t.mutation(internal.mediaJobs.complete, {
      jobId,
      leaseToken: claim!.leaseToken,
      result,
    });
    expect(done.status).toBe("done");
    expect(done.resultArtifactIds).toEqual([masterId, deliveryId]);
    const master = await t.run((ctx) => ctx.db.get(masterId));
    expect(master?.status).toBe("ready");
    const delivery = await t.run((ctx) => ctx.db.get(deliveryId));
    expect(delivery?.status).toBe("ready");
    // Repeat completion with the same lease returns the stored result.
    const again = await t.mutation(internal.mediaJobs.complete, {
      jobId,
      leaseToken: claim!.leaseToken,
      result,
    });
    expect(again.resultArtifactIds).toEqual([masterId, deliveryId]);
  });

  test("complete refuses a probe result without a master and its delivery", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    const claim = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w1",
      kinds: ["probe"],
    });
    const leaseToken = claim!.leaseToken;
    const masterId = await pendingArtifact(t, jobId, "masterNormalized");
    // Two masters: the roles are wrong even though the count is right.
    const secondMasterId = await pendingArtifact(t, jobId, "masterNormalized");
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken,
        result: {
          kind: "probe",
          artifacts: [
            { ...measured, artifactId: masterId, mimeType: "audio/wav" },
            { ...measured, artifactId: secondMasterId, mimeType: "audio/wav" },
          ],
        },
      }),
    ).rejects.toThrow(/one masterNormalized and one delivery/);
    // A delivery that does not point at the submitted master.
    const strayDeliveryId = await pendingArtifact(t, jobId, "delivery");
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken,
        result: {
          kind: "probe",
          artifacts: [
            { ...measured, artifactId: masterId, mimeType: "audio/wav" },
            {
              ...measured,
              artifactId: strayDeliveryId,
              mimeType: "audio/mpeg",
            },
          ],
        },
      }),
    ).rejects.toThrow(/reference its master/);
    for (const id of [masterId, secondMasterId, strayDeliveryId]) {
      const row = await t.run((ctx) => ctx.db.get(id));
      expect(row?.status).toBe("pending");
    }
    const job = await t.run((ctx) => ctx.db.get(jobId));
    expect(job?.status).toBe("claimed");
  });

  test("a stale worker cannot complete after its lease expired and the job was re-claimed", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    const stale = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w1",
      kinds: ["probe"],
    });
    await t.run((ctx) =>
      ctx.db.patch(jobId, { leaseExpiresAt: Date.now() - 1 }),
    );
    const swept = await t.mutation(internal.mediaJobs.sweepStale, {});
    expect(swept.requeued).toBe(1);
    const fresh = await t.mutation(internal.mediaJobs.claimNext, {
      workerId: "w2",
      kinds: ["probe"],
    });
    expect(fresh?.attempts).toBe(1);
    const { result } = await probePair(t, jobId);
    await expect(
      t.mutation(internal.mediaJobs.complete, {
        jobId,
        leaseToken: stale!.leaseToken,
        result,
      }),
    ).rejects.toThrow(/lease/);
    const row = await t.run((ctx) => ctx.db.get(jobId));
    expect(row?.status).toBe("claimed");
    expect(row?.workerId).toBe("w2");
  });

  test("fail re-queues until MAX_ATTEMPTS then parks", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: probe,
    });
    for (let attempt = 1; attempt <= 3; attempt++) {
      const claim = await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "w1",
        kinds: ["probe"],
      });
      const outcome = await t.mutation(internal.mediaJobs.fail, {
        jobId,
        leaseToken: claim!.leaseToken,
        error: `boom ${attempt}`,
      });
      expect(outcome.attempts).toBe(attempt);
      expect(outcome.status).toBe(attempt < 3 ? "queued" : "parked");
    }
    expect(
      await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "w1",
        kinds: ["probe"],
      }),
    ).toBeNull();
  });
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
    expect((await t.run((ctx) => ctx.db.get(delivery)))?.status).toBe("ready");
  },
);

test("a parked operator publication reuses its retained completion without another upload", async () => {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const root = await mkdtemp(join(tmpdir(), "operator-publication-"));
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
    const tool = vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "claimNextMediaJob")
        return t.mutation(internal.mediaJobs.claimNext, args as never);
      if (name === "completeMediaJob") {
        if (denyCompletion) throw new Error("Completion unavailable");
        return t.mutation(internal.mediaJobs.complete, args as never);
      }
      if (name === "failMediaJob")
        return t.mutation(internal.mediaJobs.fail, args as never);
      if (name === "renewMediaLease")
        return t.mutation(internal.mediaJobs.renewLease, args as never);
      throw new Error(`Unexpected tool ${name}`);
    }) as typeof callTool;
    const upload = vi.fn(async () => {
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
      (await t.run((ctx) => ctx.db.query("operationFailures").first()))?.status,
    ).toBe("resolved");
    expect(await readdir(join(root, "retained"))).toEqual([]);
  } finally {
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
});

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
