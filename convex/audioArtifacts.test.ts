import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { api, internal } from "./_generated/api";
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
      error: `${"x".repeat(1999)}🧠 detail`,
    });
    await t.mutation(internal.audioArtifacts.markFailed, {
      artifactId,
      error: "again",
    });
    const failed = await t.run((ctx) => ctx.db.get(artifactId));
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("x".repeat(1999));

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

async function seedAudioTargets(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const hypothesisId = await ctx.db.insert("hypotheses", {
      title: "Hypothesis",
      question: "Question",
      hypothesis: "Hypothesis",
      rationaleMd: "Rationale",
      sourceIds: [],
      status: "draft",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    const recipeId = await ctx.db.insert("recipes", {
      hypothesisId,
      title: "Recipe",
      bodyMd: "Recipe",
      parameters: [],
      dawChecklist: [],
      status: "draft",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    const compositionId = await ctx.db.insert("compositions", {
      recipeId,
      title: "Composition",
      artifactType: "microStudy",
      version: "v1",
      status: "rendered",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    return { recipeId, compositionId };
  });
}

describe("listReadyForTarget", () => {
  test("requires authentication before returning private target identities", async () => {
    const t = convexTest(schema, modules);
    const { compositionId } = await seedAudioTargets(t);
    await expect(
      t.query(api.audioArtifacts.listReadyForTarget, {
        target: { kind: "composition", id: compositionId },
      }),
    ).rejects.toThrow();
  });

  test("recipe includes composition audio, deduplicates references and excludes nonplayable or blind identities", async () => {
    const t = convexTest(schema, modules);
    const { recipeId, compositionId } = await seedAudioTargets(t);
    const ids = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["audio"]));
      const base = {
        ...pendingFields,
        status: "ready" as const,
        storageId,
        createdAt: 1,
        updatedAt: 1,
      };
      const direct = await ctx.db.insert("audioArtifacts", {
        ...base,
        title: "Direct",
        refs: { recipeId },
      });
      const composition = await ctx.db.insert("audioArtifacts", {
        ...base,
        title: "Composition",
        refs: { compositionId },
        createdAt: 2,
      });
      const both = await ctx.db.insert("audioArtifacts", {
        ...base,
        title: "Both",
        refs: { recipeId, compositionId },
        createdAt: 3,
      });
      await ctx.db.insert("audioArtifacts", {
        ...base,
        title: "Unrelated",
        refs: {},
      });
      for (const status of ["pending", "failed"] as const) {
        await ctx.db.insert("audioArtifacts", {
          ...base,
          status,
          title: status,
          refs: { compositionId },
        });
      }
      await ctx.db.insert("audioArtifacts", {
        ...base,
        storageId: undefined,
        title: "No storage",
        refs: { recipeId },
      });
      const hidden = await ctx.db.insert("audioArtifacts", {
        ...base,
        title: "Secret identity",
        refs: { recipeId, compositionId },
        createdAt: 4,
      });
      const groupId = await ctx.db.insert("blindGroups", {
        purpose: "studyFamily",
        members: [
          { artifactId: hidden, memberId: "opaque", label: "Secret label" },
        ],
        requiredRatings: ["opaque"],
        createdAt: 1,
      });
      await ctx.db.patch(hidden, { blindGroupId: groupId });
      return { direct, composition, both, hidden, groupId };
    });
    const human = t.withIdentity({ subject: "human" });
    const recipeTarget = { kind: "recipe" as const, id: recipeId };
    expect(
      await human.query(api.audioArtifacts.listReadyForTarget, {
        target: recipeTarget,
      }),
    ).toEqual([
      { artifactId: ids.both, title: "Both" },
      { artifactId: ids.composition, title: "Composition" },
      { artifactId: ids.direct, title: "Direct" },
    ]);
    expect(
      await human.query(api.audioArtifacts.listReadyForTarget, {
        target: { kind: "composition", id: compositionId },
      }),
    ).toEqual([
      { artifactId: ids.both, title: "Both" },
      { artifactId: ids.composition, title: "Composition" },
    ]);
    await t.run((ctx) => ctx.db.patch(ids.groupId, { revealedAt: 5 }));
    expect(
      (
        await human.query(api.audioArtifacts.listReadyForTarget, {
          target: recipeTarget,
        })
      )[0],
    ).toEqual({ artifactId: ids.hidden, title: "Secret identity" });
    await t.run((ctx) => ctx.db.delete(ids.groupId));
    expect(
      await human.query(api.audioArtifacts.playback, {
        artifactId: ids.hidden,
      }),
    ).toBeNull();
    expect(
      (
        await human.query(api.audioArtifacts.listReadyForTarget, {
          target: recipeTarget,
        })
      ).map((row) => row.artifactId),
    ).not.toContain(ids.hidden);
  });

  test("returns empty for empty or deleted targets and refuses oversized reference sets", async () => {
    const t = convexTest(schema, modules);
    const { compositionId } = await seedAudioTargets(t);
    const human = t.withIdentity({ subject: "human" });
    const target = { kind: "composition" as const, id: compositionId };
    expect(
      await human.query(api.audioArtifacts.listReadyForTarget, { target }),
    ).toEqual([]);
    await t.run(async (ctx) => {
      for (let i = 0; i < 101; i++)
        await ctx.db.insert("audioArtifacts", {
          ...pendingFields,
          refs: { compositionId },
          createdAt: i,
          updatedAt: i,
        });
    });
    await expect(
      human.query(api.audioArtifacts.listReadyForTarget, { target }),
    ).rejects.toThrow(/Too many audio records/);
    await t.run((ctx) => ctx.db.delete(compositionId));
    expect(
      await human.query(api.audioArtifacts.listReadyForTarget, { target }),
    ).toEqual([]);
  });
});
