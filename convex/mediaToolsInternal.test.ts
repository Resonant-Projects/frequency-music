import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const probe = {
  kind: "probe" as const,
  toneHz: 440,
  seconds: 1,
  rendererVersion: "0.1.0",
};

// Everything a caller must send; storageId and refs are what the tool fences.
const artifact = {
  kind: "probe",
  role: "delivery",
  metadataStripped: false,
  encoding: { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 },
  normalization: "applied",
  title: "probe",
  refs: {},
  contentHash: "c1",
  createdBy: "system",
};

// Two distinct queued jobs (dedupe keys differ by toneHz); the first is
// claimed so the caller holds a live lease, the second stays queued.
async function leasedAndOtherJob(t: ReturnType<typeof convexTest>) {
  await t.mutation(internal.mediaJobs.enqueue, { input: probe });
  const other = await t.mutation(internal.mediaJobs.enqueue, {
    input: { ...probe, toneHz: 880 },
  });
  const claim = await t.mutation(internal.mediaJobs.claimNext, {
    workerId: "w1",
    kinds: ["probe"],
  });
  if (!claim) throw new Error("expected a claim");
  return {
    jobId: claim.jobId as Id<"mediaJobs">,
    leaseToken: claim.leaseToken,
    otherJobId: other.jobId,
  };
}

describe("mediaToolsInternal", () => {
  test("a probe lease cannot mint a feed episode or a non-probe kind", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await leasedAndOtherJob(t);
    await expect(
      t.mutation(internal.mediaToolsInternal.generateAudioUploadUrl, {
        jobId,
        leaseToken,
        artifact: { ...artifact, kind: "episode", access: "feed" },
      }),
    ).rejects.toThrow(/cannot mint/);
    await expect(
      t.mutation(internal.mediaToolsInternal.generateAudioUploadUrl, {
        jobId,
        leaseToken,
        artifact: { ...artifact, access: "feed" },
      }),
    ).rejects.toThrow(/access/);
    // createdBy is server-owned.
    const { artifactId } = await t.mutation(
      internal.mediaToolsInternal.generateAudioUploadUrl,
      { jobId, leaseToken, artifact: { ...artifact, createdBy: "agent" } },
    );
    const row = await t.run((ctx) => ctx.db.get(artifactId));
    expect(row?.createdBy).toBe("system");
    expect(row?.access).toBe("private");
    const rows = await t.run((ctx) => ctx.db.query("audioArtifacts").collect());
    expect(rows).toHaveLength(1);
  });

  test("generateAudioUploadUrl forces refs.mediaJobId to the leased job", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken, otherJobId } = await leasedAndOtherJob(t);
    const { artifactId, uploadUrl } = await t.mutation(
      internal.mediaToolsInternal.generateAudioUploadUrl,
      {
        jobId,
        leaseToken,
        artifact: { ...artifact, refs: { mediaJobId: otherJobId } },
      },
    );
    expect(uploadUrl.length).toBeGreaterThan(0);
    const row = await t.run((ctx) => ctx.db.get(artifactId));
    expect(row?.status).toBe("pending");
    expect(row?.refs.mediaJobId).toBe(jobId);
    expect(row?.storageId).toBeUndefined();
  });

  test("generateAudioUploadUrl rejects a caller-supplied storageId", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await leasedAndOtherJob(t);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await expect(
      t.mutation(internal.mediaToolsInternal.generateAudioUploadUrl, {
        jobId,
        leaseToken,
        artifact: { ...artifact, storageId },
      }),
    ).rejects.toThrow(/storageId/);
    const rows = await t.run((ctx) => ctx.db.query("audioArtifacts").collect());
    expect(rows).toHaveLength(0);
  });

  test("attachAudioStorage rejects a wrong lease token", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await leasedAndOtherJob(t);
    const { artifactId } = await t.mutation(
      internal.mediaToolsInternal.generateAudioUploadUrl,
      { jobId, leaseToken, artifact },
    );
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await expect(
      t.mutation(internal.mediaToolsInternal.attachAudioStorage, {
        jobId,
        leaseToken: "not-the-token",
        artifactId,
        storageId,
      }),
    ).rejects.toThrow(/lease/);
    const row = await t.run((ctx) => ctx.db.get(artifactId));
    expect(row?.storageId).toBeUndefined();
  });

  test("attachAudioStorage rejects an artifact owned by another job", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken, otherJobId } = await leasedAndOtherJob(t);
    const foreignId = await t.mutation(internal.audioArtifacts.createPending, {
      fields: {
        ...artifact,
        kind: "probe",
        role: "delivery",
        status: "pending",
        encoding: { ...artifact.encoding, codec: "mp3" },
        normalization: "applied",
        access: "private",
        createdBy: "system",
        refs: { mediaJobId: otherJobId },
      },
    });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await expect(
      t.mutation(internal.mediaToolsInternal.attachAudioStorage, {
        jobId,
        leaseToken,
        artifactId: foreignId,
        storageId,
      }),
    ).rejects.toThrow(/belong/);
    const row = await t.run((ctx) => ctx.db.get(foreignId));
    expect(row?.storageId).toBeUndefined();
  });

  test("attachAudioStorage rejects a storageId with no blob behind it", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await leasedAndOtherJob(t);
    const { artifactId } = await t.mutation(
      internal.mediaToolsInternal.generateAudioUploadUrl,
      { jobId, leaseToken, artifact },
    );
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(["x"]));
      await ctx.storage.delete(id);
      return id;
    });
    await expect(
      t.mutation(internal.mediaToolsInternal.attachAudioStorage, {
        jobId,
        leaseToken,
        artifactId,
        storageId,
      }),
    ).rejects.toThrow(/exist/);
    const row = await t.run((ctx) => ctx.db.get(artifactId));
    expect(row?.storageId).toBeUndefined();
  });

  test("attachAudioStorage rejects a blob already attached to another artifact", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken, otherJobId } = await leasedAndOtherJob(t);
    // A ready artifact of the other job already owns the blob.
    const ownerId = await t.mutation(internal.audioArtifacts.createPending, {
      fields: {
        ...artifact,
        kind: "probe",
        role: "delivery",
        status: "pending",
        encoding: { ...artifact.encoding, codec: "mp3" },
        normalization: "applied",
        access: "private",
        createdBy: "system",
        contentHash: "c-owner",
        refs: { mediaJobId: otherJobId },
      },
    });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await t.mutation(internal.audioArtifacts.attachStorage, {
      artifactId: ownerId,
      storageId,
    });
    await t.mutation(internal.audioArtifacts.markReady, {
      artifactId: ownerId,
      durationSecs: 1,
      loudnessLufs: -16,
      truePeakDbtp: -1,
      mimeType: "audio/mpeg",
    });
    const { artifactId } = await t.mutation(
      internal.mediaToolsInternal.generateAudioUploadUrl,
      { jobId, leaseToken, artifact },
    );
    await expect(
      t.mutation(internal.mediaToolsInternal.attachAudioStorage, {
        jobId,
        leaseToken,
        artifactId,
        storageId,
      }),
    ).rejects.toThrow(/already/);
    const row = await t.run((ctx) => ctx.db.get(artifactId));
    expect(row?.storageId).toBeUndefined();
    const owner = await t.run((ctx) => ctx.db.get(ownerId));
    expect(owner?.storageId).toBe(storageId);
  });

  test("generate then attach records the storageId on the pending row", async () => {
    const t = convexTest(schema, modules);
    const { jobId, leaseToken } = await leasedAndOtherJob(t);
    const { artifactId } = await t.mutation(
      internal.mediaToolsInternal.generateAudioUploadUrl,
      { jobId, leaseToken, artifact },
    );
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await t.mutation(internal.mediaToolsInternal.attachAudioStorage, {
      jobId,
      leaseToken,
      artifactId,
      storageId,
    });
    const row = await t.run((ctx) => ctx.db.get(artifactId));
    expect(row?.status).toBe("pending");
    expect(row?.storageId).toBe(storageId);
    expect(row?.uploadIssuedAt).toBeUndefined();
  });
});
