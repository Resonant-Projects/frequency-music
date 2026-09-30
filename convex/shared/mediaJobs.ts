// Contracts for the pull-based media lifecycle. Inputs are self-contained
// snapshots; results are validated by kind before Convex applies effects.
import { zid, zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod";
import { audioChapterZ, audioRefsZ } from "./audioArtifacts";
import { fnv1a64Hex, stableStringify } from "./stableHash";

export const LEASE_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 3;
// Renderer a freshly enqueued job expects; a job snapshot records it so a
// worker on an older build refuses the job instead of rendering it wrong.
// The media package's RENDERER_VERSION must match this string.
export const RENDERER_VERSION_FOR_JOBS = "0.2.1";

// Blind labels in presentation order: the label the listener hears in the
// shootout episode is the label the blind group stores, so both the media
// handler and the completion effect derive it here. blindGroups.create caps
// a group at eight members, so a shootout can never need more than this.
const ORDINALS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
];
export function spokenLabel(index: number): string {
  return `take ${ORDINALS[index] ?? String(index + 1)}`;
}

export const MEDIA_JOB_KINDS = [
  "probe",
  "narrate",
  "shootout",
  "assembleEpisode",
] as const;
export type MediaJobKind = (typeof MEDIA_JOB_KINDS)[number];
export const mediaJobKindZ = z.enum(MEDIA_JOB_KINDS);

// What a leased job of each kind may mint. Everything else about an artifact
// is caller-described, so this table is the only thing standing between a
// holder of the tool secret and, say, an `episode` with `access: "feed"`.
export const ARTIFACT_POLICY_BY_JOB_KIND: Record<
  MediaJobKind,
  { artifactKinds: readonly string[]; access: readonly string[] }
> = {
  probe: { artifactKinds: ["probe"], access: ["private"] },
  narrate: { artifactKinds: ["narration"], access: ["feed", "private"] },
  // Takes are private blind members; the episode is the feed-published cut.
  shootout: {
    artifactKinds: ["shootoutTake", "episode"],
    access: ["private", "feed"],
  },
  // The delivery is published; its WAV master is uploaded private.
  assembleEpisode: { artifactKinds: ["episode"], access: ["feed", "private"] },
};
export const mediaJobStatusZ = z.enum([
  "queued",
  "claimed",
  "done",
  "failed",
  "parked",
]);

export const probeJobInputZ = z.object({
  kind: z.literal("probe"),
  toneHz: z.number().min(20).max(20000),
  seconds: z.number().positive().max(30),
  rendererVersion: z.string().min(1),
});

export const scriptChapterZ = z.object({
  title: z.string().min(1),
  startParagraph: z.number().int().min(0),
});
// A chapter must start at a paragraph the script has; the renderer would
// otherwise have no offset for it.
export const narrationScriptZ = z
  .object({
    paragraphs: z.array(z.string().min(1)).min(1),
    chapters: z.array(scriptChapterZ),
  })
  .superRefine((script, ctx) => {
    script.chapters.forEach((chapter, index) => {
      if (chapter.startParagraph >= script.paragraphs.length) {
        ctx.addIssue({
          code: "custom",
          path: ["chapters", index, "startParagraph"],
          message: `chapter "${chapter.title}" starts at paragraph ${chapter.startParagraph}; the script has ${script.paragraphs.length}`,
        });
      }
    });
  });
export type NarrationScript = z.infer<typeof narrationScriptZ>;

export const narrateJobInputZ = z.object({
  kind: z.literal("narrate"),
  script: narrationScriptZ,
  voiceId: z.string().min(1),
  promptVersion: z.string().min(1),
  target: z.literal("spoken"),
  title: z.string().min(1),
  access: z.enum(["feed", "private"]),
  refs: audioRefsZ,
  // When set, the narrate effect enqueues an assembleEpisode job for the
  // delivery in the same mutation that marks it ready.
  assembleOnDone: z.boolean(),
  episodeTitle: z.string().min(1).optional(),
  rendererVersion: z.string().min(1),
});

export const shootoutJobInputZ = z.object({
  kind: z.literal("shootout"),
  passage: z.array(z.string().min(1)).min(1),
  voiceIds: z.array(z.string().min(1)).min(1),
  title: z.string().min(1),
  rendererVersion: z.string().min(1),
  // Set only by an explicit rerun: a done shootout with identical input is a
  // dedupe hit, so a fresh runId is what lets the same comparison run again.
  runId: z.string().min(1).optional(),
});

export const assembleEpisodeJobInputZ = z.object({
  kind: z.literal("assembleEpisode"),
  narrationArtifactId: zid("audioArtifacts"),
  // Filled by the narrate effect from ctx.storage.getUrl: playback URLs are
  // Clerk-gated, so the worker downloads the narration through this instead.
  narrationStorageUrl: z.string().url(),
  title: z.string().min(1),
  chapters: z.array(audioChapterZ),
  // R29: the narration's refs (its weeklyBriefId above all), copied onto the
  // episode artifacts so an episode links back to its brief. Optional so
  // jobs enqueued before this field existed still validate; code treats a
  // missing value as {}.
  refs: audioRefsZ.optional(),
  rendererVersion: z.string().min(1),
});

export const mediaJobInputZ = z.discriminatedUnion("kind", [
  probeJobInputZ,
  narrateJobInputZ,
  shootoutJobInputZ,
  assembleEpisodeJobInputZ,
]);
export type MediaJobInput = z.infer<typeof mediaJobInputZ>;

export const artifactResultZ = z.object({
  artifactId: zid("audioArtifacts"),
  durationSecs: z.number().nonnegative(),
  loudnessLufs: z.number(),
  truePeakDbtp: z.number(),
  mimeType: z.string().min(1),
});
export type ArtifactResult = z.infer<typeof artifactResultZ>;

export const probeJobResultZ = z.object({
  kind: z.literal("probe"),
  // Exactly the master and its delivery; mediaJobEffects checks the roles.
  artifacts: z.array(artifactResultZ).length(2),
});

export const narrateJobResultZ = z.object({
  kind: z.literal("narrate"),
  // The normalized master and its delivery; mediaJobEffects checks the roles.
  artifacts: z.array(artifactResultZ).min(1),
  chapters: z.array(audioChapterZ),
});

// A take's label is not part of the result: the effect derives it from the
// take's position in memberOrder with spokenLabel, the same function the
// handler spoke it with.
export const shootoutTakeResultZ = z.object({
  voiceId: z.string(),
  // artifact is the delivery (the blind member); master is its normalized WAV.
  artifact: artifactResultZ,
  master: artifactResultZ,
});

export const shootoutJobResultZ = z.object({
  kind: z.literal("shootout"),
  takes: z.array(shootoutTakeResultZ).min(1),
  skippedVoiceIds: z.array(z.string()),
  episode: artifactResultZ,
  episodeMaster: artifactResultZ,
  // Voice ids in blind presentation order; every entry must name a take.
  memberOrder: z.array(z.string()).min(1),
});

export const assembleEpisodeJobResultZ = z.object({
  kind: z.literal("assembleEpisode"),
  artifacts: z.array(artifactResultZ).min(1),
  // The narration's chapters shifted by the assembler's lead-in; the effect
  // stores these on the episode delivery, not the job input's.
  chapters: z.array(audioChapterZ),
});

export const mediaJobResultZ = z.discriminatedUnion("kind", [
  probeJobResultZ,
  narrateJobResultZ,
  shootoutJobResultZ,
  assembleEpisodeJobResultZ,
]);
export type MediaJobResult = z.infer<typeof mediaJobResultZ>;

export function mediaJobDedupeKey(input: MediaJobInput): string {
  return `${input.kind}:${fnv1a64Hex(stableStringify(input))}`;
}

export const mediaJobInputValidator = zodToConvex(mediaJobInputZ);
export const mediaJobResultValidator = zodToConvex(mediaJobResultZ);
export const mediaJobStatusValidator = zodToConvex(mediaJobStatusZ);

export type ClaimedMediaJob = {
  jobId: string;
  kind: MediaJobKind;
  input: MediaJobInput;
  leaseToken: string;
  leaseExpiresAt: number;
  attempts: number;
};
