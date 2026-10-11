import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fnv1a64Hex, stableStringify } from "../../../convex/shared/stableHash";
import { encodeFlac, encodeMp3, encodeWav } from "./encode";
import { assertWithinPolicy, measure } from "./loudness";
import { assertUnderUploadCap, MAX_UPLOAD_BYTES } from "../upload";
import type { ArtifactResult, JobContext, NewArtifact } from "../jobs/types";
import { sha256Hex } from "../retained";

// Encodes a normalized WAV as a 16-bit mono master and a dual-mono MP3
// delivery and uploads both, master first. The master is always private:
// only the delivery is ever published, and `base.access` is the delivery's.
// Each file is measured, checked against policy, and checked against the
// upload size cap before its upload URL is minted, so a failed file creates
// no server state.
export async function uploadMasterAndDelivery(
  ctx: JobContext,
  normalizedWav: string,
  base: Omit<NewArtifact, "role" | "encoding" | "contentHash">,
  hashBase: Record<string, unknown>,
  targetLufs: number,
  options: { hashMode?: "bytes" } = {},
): Promise<ArtifactResult[]> {
  let master = join(ctx.workDir, "master.wav");
  await encodeWav(
    normalizedWav,
    master,
    { channels: 1, bitDepth: 16 },
    ctx.signal,
  );
  let codec: "wav" | "flac" = "wav";
  if ((await stat(master)).size > MAX_UPLOAD_BYTES) {
    const compressed = join(ctx.workDir, "master.flac");
    await encodeFlac(master, compressed, ctx.signal);
    master = compressed;
    codec = "flac";
  }
  assertUnderUploadCap("masterNormalized", (await stat(master)).size);
  const hashFor = async (path: string, role: string, fileCodec: string) =>
    options.hashMode === "bytes"
      ? sha256Hex(await readFile(path))
      : fnv1a64Hex(stableStringify({ ...hashBase, role, codec: fileCodec }));
  const delivery = join(ctx.workDir, "delivery.mp3");
  // Dual-mono delivery: ffmpeg's loudness-preserving upmix keeps integrated
  // LUFS and reads ~3 dB lower in true peak, which stays within the ceiling.
  await encodeMp3(
    master,
    delivery,
    { bitrateKbps: 128, channels: 2 },
    ctx.signal,
  );
  const masterResult = await uploadArtifact(
    ctx,
    master,
    {
      ...base,
      role: "masterNormalized",
      access: "private",
      encoding: { codec, sampleRate: 48000, channels: 1 },
      contentHash: await hashFor(master, "masterNormalized", codec),
    },
    codec === "flac" ? "audio/flac" : "audio/wav",
    targetLufs,
  );
  const deliveryResult = await uploadArtifact(
    ctx,
    delivery,
    {
      ...base,
      role: "delivery",
      masterArtifactId: masterResult.artifactId,
      encoding: {
        codec: "mp3",
        bitrateKbps: 128,
        sampleRate: 48000,
        channels: 2,
      },
      contentHash: await hashFor(delivery, "delivery", "mp3"),
    },
    "audio/mpeg",
    targetLufs,
  );
  return [masterResult, deliveryResult];
}

/**
 * Measures, checks policy and the upload cap, then mints. A failed file
 * creates no server state; an already attached blob is not uploaded again.
 */
export async function uploadArtifact(
  ctx: JobContext,
  path: string,
  artifact: NewArtifact,
  mimeType: string,
  targetLufs: number,
): Promise<ArtifactResult> {
  const measured = await measure(path, ctx.signal);
  assertWithinPolicy(measured, targetLufs);
  assertUnderUploadCap(artifact.role, (await stat(path)).size);
  const { artifactId, uploadUrl, storageAttached } =
    await ctx.tools.generateAudioUploadUrl({
      jobId: ctx.job.jobId,
      leaseToken: ctx.job.leaseToken,
      artifact,
    });
  if (!storageAttached) {
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
  }
  return {
    artifactId: artifactId as ArtifactResult["artifactId"],
    durationSecs: measured.durationSecs,
    loudnessLufs: measured.integratedLufs,
    truePeakDbtp: measured.truePeakDbtp,
    mimeType,
  };
}
