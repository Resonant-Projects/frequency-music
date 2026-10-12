// End-to-end pipeline proof: tone → normalize (spoken target) → WAV master +
// MP3 delivery → upload both → measurements. Also the production health check.
import { join } from "node:path";
import { fnv1a64Hex, stableStringify } from "../../../convex/shared/stableHash";
import { uploadArtifact } from "../audio/artifacts";
import { encodeMp3 } from "../audio/encode";
import { LOUDNESS_TARGETS, normalize } from "../audio/loudness";
import { synthTone } from "../audio/synth";
import type { JobHandler, NewArtifact } from "./types";

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
    LOUDNESS_TARGETS.spoken,
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
    LOUDNESS_TARGETS.spoken,
  );
  return { kind: "probe", artifacts: [masterResult, deliveryResult] };
};
