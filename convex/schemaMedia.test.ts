import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import schema from "./schema";

describe("media tables", () => {
  test("audio artifact, blind group, media job, and settings rows insert and index", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const jobId = await ctx.db.insert("mediaJobs", {
        kind: "probe",
        input: {
          kind: "probe",
          toneHz: 440,
          seconds: 1,
          rendererVersion: "0.1.0",
        },
        dedupeKey: "probe:deadbeef",
        status: "queued",
        priority: 0,
        attempts: 0,
        createdAt: 1,
      });
      const artifactId = await ctx.db.insert("audioArtifacts", {
        kind: "probe",
        role: "delivery",
        metadataStripped: false,
        status: "pending",
        encoding: {
          codec: "mp3",
          bitrateKbps: 128,
          sampleRate: 48000,
          channels: 2,
        },
        normalization: "applied",
        access: "private",
        title: "probe",
        refs: { mediaJobId: jobId },
        contentHash: "c1",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("blindGroups", {
        purpose: "voiceShootout",
        members: [{ memberId: "m1", artifactId, label: "take one" }],
        requiredRatings: ["m1"],
        createdAt: 1,
      });
      await ctx.db.insert("settings", {
        key: "houseVoiceId",
        value: "none",
        updatedAt: 1,
      });

      const byKind = await ctx.db
        .query("audioArtifacts")
        .withIndex("by_kind_createdAt", (q) => q.eq("kind", "probe"))
        .collect();
      expect(byKind).toHaveLength(1);
      const queued = await ctx.db
        .query("mediaJobs")
        .withIndex("by_status_priority_createdAt", (q) =>
          q.eq("status", "queued"),
        )
        .collect();
      expect(queued).toHaveLength(1);
      const setting = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", "houseVoiceId"))
        .unique();
      expect(setting?.value).toBe("none");
    });
  });
});
