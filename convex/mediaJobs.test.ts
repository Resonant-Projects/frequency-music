import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
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
) {
  const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
    fields: {
      kind: "probe",
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
): MediaJobInput {
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

  test.each([
    "claimed",
    "done",
  ] as const)("a %s narration blocks a different script for the same brief", async (status) => {
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
  });

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
