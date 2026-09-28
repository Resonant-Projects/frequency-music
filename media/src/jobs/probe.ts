// End-to-end pipeline proof: tone → normalize (spoken target) → WAV master +
// MP3 delivery → upload both → measurements. Also the production health check.
import { join } from "node:path";
import { fnv1a64Hex, stableStringify } from "../../../convex/shared/stableHash";
import { encodeMp3 } from "../audio/encode";
import {
  assertWithinPolicy,
  LOUDNESS_TARGETS,
  measure,
  normalize,
} from "../audio/loudness";
import { synthTone } from "../audio/synth";
import type {
  ArtifactResult,
  JobContext,
  JobHandler,
  NewArtifact,
} from "./types";

async function uploadArtifact(
  ctx: JobContext,
  path: string,
  artifact: NewArtifact,
  mimeType: string,
): Promise<ArtifactResult> {
  // Policy first: only a file that passed creates server state (pending row,
  // blob), so a failed attempt leaves nothing for the sweeper.
  const measured = await measure(path, ctx.signal);
  assertWithinPolicy(measured, LOUDNESS_TARGETS.spoken);
  const { artifactId, uploadUrl } = await ctx.tools.generateAudioUploadUrl({
    jobId: ctx.job.jobId,
    leaseToken: ctx.job.leaseToken,
    artifact,
  });
  const { storageId } = await ctx.tools.uploadBytes(
    uploadUrl,
    path,
    mimeType,
    ctx.signal,
  );
  await ctx.tools.attachAudioStorage({
    jobId: ctx.job.jobId,
    leaseToken: ctx.job.leaseToken,
    artifactId,
    storageId,
  });
  return {
    artifactId: artifactId as ArtifactResult["artifactId"],
    durationSecs: measured.durationSecs,
    loudnessLufs: measured.integratedLufs,
    truePeakDbtp: measured.truePeakDbtp,
    mimeType,
  };
}

export const probeHandler: JobHandler = async (ctx) => {
  if (ctx.job.input.kind !== "probe") {
    throw new Error("probe handler received another kind");
  }
  const { toneHz, seconds } = ctx.job.input;
  const raw = join(ctx.workDir, "probe-raw.wav");
  const master = join(ctx.workDir, "probe-master.wav");
  const delivery = join(ctx.workDir, "probe.mp3");
  await synthTone(raw, { hz: toneHz, seconds, gainDb: -20 }, ctx.signal);
  await normalize(
    raw,
    master,
    { targetLufs: LOUDNESS_TARGETS.spoken },
    ctx.signal,
  );
  // Dual-mono delivery: ffmpeg's loudness-preserving upmix keeps integrated
  // LUFS and reads ~3 dB lower in true peak, which stays within the ceiling.
  await encodeMp3(
    master,
    delivery,
    { bitrateKbps: 128, channels: 2 },
    ctx.signal,
  );

  const engine = {
    name: "probe",
    version: ctx.rendererVersion,
    params: { toneHz, seconds },
  };
  const hashBase = { kind: "probe", engine, input: ctx.job.input };
  const masterArtifact: NewArtifact = {
    kind: "probe",
    role: "masterNormalized",
    metadataStripped: true,
    encoding: { codec: "wav", sampleRate: 48000, channels: 1 },
    normalization: "applied",
    access: "private",
    title: `Probe ${toneHz} Hz master`,
    engine,
    contentHash: fnv1a64Hex(
      stableStringify({ ...hashBase, role: "masterNormalized" }),
    ),
    createdBy: "system",
  };
  const masterResult = await uploadArtifact(
    ctx,
    master,
    masterArtifact,
    "audio/wav",
  );
  const deliveryArtifact: NewArtifact = {
    ...masterArtifact,
    role: "delivery",
    masterArtifactId: masterResult.artifactId,
    encoding: {
      codec: "mp3",
      bitrateKbps: 128,
      sampleRate: 48000,
      channels: 2,
    },
    title: `Probe ${toneHz} Hz`,
    contentHash: fnv1a64Hex(stableStringify({ ...hashBase, role: "delivery" })),
  };
  const deliveryResult = await uploadArtifact(
    ctx,
    delivery,
    deliveryArtifact,
    "audio/mpeg",
  );
  return { kind: "probe", artifacts: [masterResult, deliveryResult] };
};
