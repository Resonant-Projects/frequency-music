// Contracts for the pull-based media lifecycle. Inputs are self-contained
// snapshots; results are validated by kind before Convex applies effects.
import { zid, zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod";
import { fnv1a64Hex, stableStringify } from "./stableHash";

export const LEASE_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 3;

export const MEDIA_JOB_KINDS = ["probe"] as const; // wave 1 adds narrate, shootout, assembleEpisode
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

export const mediaJobInputZ = z.discriminatedUnion("kind", [probeJobInputZ]);
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

export const mediaJobResultZ = z.discriminatedUnion("kind", [probeJobResultZ]);
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
