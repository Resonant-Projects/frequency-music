import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { STORAGE_SCAN_CURSOR_KEY } from "./mediaSweeper";
import schema from "./schema";

const DAY = 24 * 60 * 60 * 1000;

const base = {
  kind: "probe" as const,
  role: "delivery" as const,
  metadataStripped: false,
  encoding: {
    codec: "mp3" as const,
    bitrateKbps: 128,
    sampleRate: 48000,
    channels: 2,
  },
  normalization: "applied" as const,
  access: "private" as const,
  title: "p",
  refs: {},
  contentHash: "c",
  createdBy: "system" as const,
};

describe("mediaSweeper", () => {
  test("deletes stale pending artifacts with their blobs and unreferenced blobs, keeps fresh and referenced ones", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const staleBlob = await t.run((ctx) =>
      ctx.storage.store(new Blob(["stale"])),
    );
    const orphanBlob = await t.run((ctx) =>
      ctx.storage.store(new Blob(["orphan"])),
    );
    const keptBlob = await t.run((ctx) =>
      ctx.storage.store(new Blob(["kept"])),
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("audioArtifacts", {
        ...base,
        status: "pending",
        storageId: staleBlob,
        createdAt: now - 2 * DAY,
        updatedAt: now - 2 * DAY,
      });
      await ctx.db.insert("audioArtifacts", {
        ...base,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("audioArtifacts", {
        ...base,
        status: "ready",
        storageId: keptBlob,
        createdAt: now - 3 * DAY,
        updatedAt: now,
      });
    });
    // Blobs stored by this test are seconds old, so the blob age is set to 0 while
    // the artifact age stays at a minute: the fresh pending artifact survives.
    const result = await t.mutation(internal.mediaSweeper.sweep, {
      now: Date.now() + 1,
      orphanAgeMs: 60_000,
      blobAgeMs: 0,
    });
    expect(result.artifactsDeleted).toBe(1);
    expect(result.blobsDeleted).toBe(2); // staleBlob via artifact, orphanBlob via _storage scan
    const remaining = await t.run((ctx) =>
      ctx.db.system.query("_storage").collect(),
    );
    expect(remaining.map((row) => row._id)).toEqual([keptBlob]);
    for (const id of [staleBlob, orphanBlob]) {
      expect(await t.run((ctx) => ctx.db.system.get(id))).toBeNull();
    }
    const artifacts = await t.run((ctx) =>
      ctx.db.query("audioArtifacts").collect(),
    );
    expect(artifacts).toHaveLength(2);
  });

  test("scans _storage from a persisted cursor so old referenced blobs cannot shadow newer orphans", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const referenced: Id<"_storage">[] = [];
    for (const label of ["a", "b", "c"]) {
      const storageId = await t.run((ctx) =>
        ctx.storage.store(new Blob([label])),
      );
      referenced.push(storageId);
      await t.run((ctx) =>
        ctx.db.insert("audioArtifacts", {
          ...base,
          status: "ready",
          storageId,
          createdAt: now - DAY,
          updatedAt: now,
        }),
      );
    }
    const orphanBlob = await t.run((ctx) =>
      ctx.storage.store(new Blob(["orphan"])),
    );
    const args = { now: Date.now() + 1, blobAgeMs: 0, scanLimit: 2 };

    const first = await t.mutation(internal.mediaSweeper.sweep, args);
    expect(first.blobsDeleted).toBe(0);
    const cursor = await t.run((ctx) =>
      ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", STORAGE_SCAN_CURSOR_KEY))
        .unique(),
    );
    expect(cursor).not.toBeNull();
    expect(Number(cursor?.value)).toBeGreaterThan(0);

    const second = await t.mutation(internal.mediaSweeper.sweep, args);
    expect(second.blobsDeleted).toBe(1);
    expect(await t.run((ctx) => ctx.db.system.get(orphanBlob))).toBeNull();
    const remaining = await t.run((ctx) =>
      ctx.db.system.query("_storage").collect(),
    );
    expect(remaining.map((row) => row._id).toSorted()).toEqual(
      referenced.toSorted(),
    );
  });

  test("tolerates a stale pending artifact whose storageId points at a blob that is already gone", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const goneBlob = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["gone"]));
      await ctx.storage.delete(storageId);
      return storageId;
    });
    const liveBlob = await t.run((ctx) =>
      ctx.storage.store(new Blob(["live"])),
    );
    await t.run(async (ctx) => {
      for (const storageId of [goneBlob, liveBlob]) {
        await ctx.db.insert("audioArtifacts", {
          ...base,
          status: "pending",
          storageId,
          createdAt: now - 2 * DAY,
          updatedAt: now - 2 * DAY,
        });
      }
    });

    const result = await t.mutation(internal.mediaSweeper.sweep, {
      now: Date.now() + 1,
    });
    expect(result.artifactsDeleted).toBe(2);
    expect(result.blobsDeleted).toBe(1);
    expect(await t.run((ctx) => ctx.db.system.get(liveBlob))).toBeNull();
    const artifacts = await t.run((ctx) =>
      ctx.db.query("audioArtifacts").collect(),
    );
    expect(artifacts).toHaveLength(0);
  });
});
