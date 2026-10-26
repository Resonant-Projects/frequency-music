import { convexTest } from "convex-test";
import { modules } from "./modules";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import type { MediaJobInput } from "../convex/shared/mediaJobs";

export const probe = {
  kind: "probe" as const,
  toneHz: 440,
  seconds: 1,
  rendererVersion: "0.1.0",
};

type Role = "masterNormalized" | "delivery";

// A pending artifact with a blob attached, as the worker leaves it before
// completing the job. The delivery carries its master's id.
export async function pendingArtifact(
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

export const measured = {
  durationSecs: 1,
  loudnessLufs: -16,
  truePeakDbtp: -1.5,
};

export async function insertBrief(t: ReturnType<typeof convexTest>) {
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

export function narrationInput(
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
export async function probePair(
  t: ReturnType<typeof convexTest>,
  jobId: string,
) {
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
