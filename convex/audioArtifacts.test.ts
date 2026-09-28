import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";

const pendingFields = {
  kind: "probe" as const,
  role: "delivery" as const,
  metadataStripped: false,
  status: "pending" as const,
  encoding: {
    codec: "mp3" as const,
    bitrateKbps: 128,
    sampleRate: 48000,
    channels: 2,
  },
  normalization: "applied" as const,
  access: "private" as const,
  title: "probe",
  refs: {},
  contentHash: "c1",
  createdBy: "system" as const,
};

describe("audioArtifacts", () => {
  test("createPending stamps timestamps and uploadIssuedAt; attachStorage clears it", async () => {
    const t = convexTest(schema, modules);
    const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
      fields: pendingFields,
    });
    const before = await t.run((ctx) => ctx.db.get(artifactId));
    expect(before?.status).toBe("pending");
    expect(typeof before?.uploadIssuedAt).toBe("number");

    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await t.mutation(internal.audioArtifacts.attachStorage, {
      artifactId,
      storageId,
    });
    const after = await t.run((ctx) => ctx.db.get(artifactId));
    expect(after?.storageId).toBe(storageId);
    expect(after?.uploadIssuedAt).toBeUndefined();
  });

  test("attachStorage is idempotent for the same blob and refuses a different one", async () => {
    const t = convexTest(schema, modules);
    const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
      fields: pendingFields,
    });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await t.mutation(internal.audioArtifacts.attachStorage, {
      artifactId,
      storageId,
    });
    await t.mutation(internal.audioArtifacts.attachStorage, {
      artifactId,
      storageId,
    });
    const other = await t.run((ctx) => ctx.storage.store(new Blob(["y"])));
    await expect(
      t.mutation(internal.audioArtifacts.attachStorage, {
        artifactId,
        storageId: other,
      }),
    ).rejects.toThrow(/already has storage attached/);
    const row = await t.run((ctx) => ctx.db.get(artifactId));
    expect(row?.storageId).toBe(storageId);
  });

  test("markReady refuses an artifact that is not pending", async () => {
    const t = convexTest(schema, modules);
    const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
      fields: pendingFields,
    });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await t.mutation(internal.audioArtifacts.attachStorage, {
      artifactId,
      storageId,
    });
    await t.mutation(internal.audioArtifacts.markFailed, {
      artifactId,
      error: "encode failed",
    });
    await expect(
      t.mutation(internal.audioArtifacts.markReady, {
        artifactId,
        durationSecs: 2,
        loudnessLufs: -16,
        truePeakDbtp: -1.2,
        mimeType: "audio/mpeg",
      }),
    ).rejects.toThrow(/Artifact is failed/);
    const row = await t.run((ctx) => ctx.db.get(artifactId));
    expect(row?.status).toBe("failed");
  });

  test("markReady requires storage and records measurements", async () => {
    const t = convexTest(schema, modules);
    const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
      fields: pendingFields,
    });
    await expect(
      t.mutation(internal.audioArtifacts.markReady, {
        artifactId,
        durationSecs: 2,
        loudnessLufs: -16,
        truePeakDbtp: -1.2,
        mimeType: "audio/mpeg",
      }),
    ).rejects.toThrow(/storage/);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await t.mutation(internal.audioArtifacts.attachStorage, {
      artifactId,
      storageId,
    });
    await t.mutation(internal.audioArtifacts.markReady, {
      artifactId,
      durationSecs: 2,
      loudnessLufs: -16,
      truePeakDbtp: -1.2,
      mimeType: "audio/mpeg",
    });
    const row = await t.run((ctx) => ctx.db.get(artifactId));
    expect(row?.status).toBe("ready");
    expect(row?.loudnessLufs).toBe(-16);
  });

  test("markFailed only moves pending artifacts and is idempotent once failed", async () => {
    const t = convexTest(schema, modules);
    const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
      fields: pendingFields,
    });
    await t.mutation(internal.audioArtifacts.markFailed, {
      artifactId,
      error: "boom",
    });
    await t.mutation(internal.audioArtifacts.markFailed, {
      artifactId,
      error: "again",
    });
    const failed = await t.run((ctx) => ctx.db.get(artifactId));
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("boom");

    const readyId = await t.mutation(internal.audioArtifacts.createPending, {
      fields: pendingFields,
    });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await t.mutation(internal.audioArtifacts.attachStorage, {
      artifactId: readyId,
      storageId,
    });
    await t.mutation(internal.audioArtifacts.markReady, {
      artifactId: readyId,
      durationSecs: 2,
      loudnessLufs: -16,
      truePeakDbtp: -1.2,
      mimeType: "audio/mpeg",
    });
    await expect(
      t.mutation(internal.audioArtifacts.markFailed, {
        artifactId: readyId,
        error: "late",
      }),
    ).rejects.toThrow(/ready/);
  });

  test("playback refuses members of an unrevealed blind group", async () => {
    const t = convexTest(schema, modules);
    const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
      fields: pendingFields,
    });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await t.mutation(internal.audioArtifacts.attachStorage, {
      artifactId,
      storageId,
    });
    await t.mutation(internal.audioArtifacts.markReady, {
      artifactId,
      durationSecs: 2,
      loudnessLufs: -16,
      truePeakDbtp: -1.2,
      mimeType: "audio/mpeg",
    });
    const groupId = await t.run((ctx) =>
      ctx.db.insert("blindGroups", {
        purpose: "voiceShootout",
        members: [{ memberId: "m1", artifactId, label: "take one" }],
        requiredRatings: ["m1"],
        createdAt: 1,
      }),
    );
    await t.run((ctx) => ctx.db.patch(artifactId, { blindGroupId: groupId }));
    const asKeith = t.withIdentity({
      subject: "user_1",
      tokenIdentifier: "clerk|user_1",
    });
    expect(
      await asKeith.query(internal.audioArtifacts.playbackInternal, {
        artifactId,
      }),
    ).toBeNull();
    await t.run((ctx) => ctx.db.patch(groupId, { revealedAt: 5 }));
    const playable = await asKeith.query(
      internal.audioArtifacts.playbackInternal,
      { artifactId },
    );
    expect(playable?.mimeType).toBe("audio/mpeg");
    expect(playable?.url).toMatch(/^https?:\/\//);
  });
});
