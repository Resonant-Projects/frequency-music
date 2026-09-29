// narrate: a script's paragraphs through one TTS voice into a normalized
// narration. Each paragraph is chunked to the provider's cap, the chunks and
// then the paragraphs are joined with short gaps, and the paragraph starts
// become chapter marks.
import { join } from "node:path";
import { fnv1a64Hex, stableStringify } from "../../../convex/shared/stableHash";
import { type VoiceEntry, voiceById } from "../../../convex/shared/voices";
import { concatWithGaps } from "../audio/concat";
import { encodeMp3, encodeWav } from "../audio/encode";
import {
  assertWithinPolicy,
  LOUDNESS_TARGETS,
  measure,
  normalize,
} from "../audio/loudness";
import { chunkForLimit, providerFor } from "../tts";
import type { ArtifactResult, JobContext, NewArtifact } from "./types";

export const PARAGRAPH_GAP_MS = 400;

// A TTS provider, or a test double standing in for one. `maxChars` falls
// back to the voice's real provider cap so chunking matches production.
export type Synth = {
  synthesize: (
    text: string,
    voice: VoiceEntry,
    outputPath: string,
    signal?: AbortSignal,
  ) => Promise<void>;
  maxChars?: number;
};

export async function renderParagraph(
  ctx: JobContext,
  synth: Synth,
  voice: VoiceEntry,
  text: string,
  index: number,
): Promise<string> {
  const maxChars = synth.maxChars ?? providerFor(voice).maxChars;
  const files: string[] = [];
  for (const [chunkIndex, chunk] of chunkForLimit(text, maxChars).entries()) {
    const file = join(ctx.workDir, `p${index}-c${chunkIndex}.wav`);
    await synth.synthesize(chunk, voice, file, ctx.signal);
    files.push(file);
  }
  const out = join(ctx.workDir, `p${index}.wav`);
  await concatWithGaps(files, out, PARAGRAPH_GAP_MS, {}, ctx.signal);
  return out;
}

// Encodes a normalized WAV as a 16-bit mono master and a dual-mono MP3
// delivery and uploads both, master first. The master is always private:
// only the delivery is ever published, and `base.access` is the delivery's.
// Each file is measured and checked against policy before its upload URL is
// minted, so a failed file creates no server state.
export async function uploadMasterAndDelivery(
  ctx: JobContext,
  normalizedWav: string,
  base: Omit<NewArtifact, "role" | "encoding" | "contentHash">,
  hashBase: Record<string, unknown>,
  targetLufs: number,
): Promise<ArtifactResult[]> {
  const master = join(ctx.workDir, "master.wav");
  await encodeWav(
    normalizedWav,
    master,
    { channels: 1, bitDepth: 16 },
    ctx.signal,
  );
  const delivery = join(ctx.workDir, "delivery.mp3");
  // Dual-mono delivery: ffmpeg's loudness-preserving upmix keeps integrated
  // LUFS and reads ~3 dB lower in true peak, which stays within the ceiling.
  await encodeMp3(
    master,
    delivery,
    { bitrateKbps: 128, channels: 2 },
    ctx.signal,
  );
  const upload = async (
    path: string,
    artifact: NewArtifact,
    mimeType: string,
  ): Promise<ArtifactResult> => {
    const measured = await measure(path, ctx.signal);
    assertWithinPolicy(measured, targetLufs);
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
  };
  const masterResult = await upload(
    master,
    {
      ...base,
      role: "masterNormalized",
      access: "private",
      encoding: { codec: "wav", sampleRate: 48000, channels: 1 },
      contentHash: fnv1a64Hex(
        stableStringify({ ...hashBase, role: "masterNormalized" }),
      ),
    },
    "audio/wav",
  );
  const deliveryResult = await upload(
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
      contentHash: fnv1a64Hex(
        stableStringify({ ...hashBase, role: "delivery" }),
      ),
    },
    "audio/mpeg",
  );
  return [masterResult, deliveryResult];
}

export async function narrateHandler(ctx: JobContext, synthOverride?: Synth) {
  const input = ctx.job.input;
  if (input.kind !== "narrate") {
    throw new Error("narrate handler received another kind");
  }
  const voice = voiceById(input.voiceId);
  const synth: Synth = synthOverride ?? providerFor(voice);
  const paragraphFiles: string[] = [];
  for (const [index, paragraph] of input.script.paragraphs.entries()) {
    paragraphFiles.push(
      await renderParagraph(ctx, synth, voice, paragraph, index),
    );
  }
  const joined = join(ctx.workDir, "joined.wav");
  const { starts } = await concatWithGaps(
    paragraphFiles,
    joined,
    PARAGRAPH_GAP_MS,
    {},
    ctx.signal,
  );
  const normalized = join(ctx.workDir, "normalized.wav");
  await normalize(
    joined,
    normalized,
    { targetLufs: LOUDNESS_TARGETS.spoken },
    ctx.signal,
  );
  const chapters = input.script.chapters.map((chapter) => ({
    title: chapter.title,
    startSecs: Number((starts[chapter.startParagraph] ?? 0).toFixed(3)),
  }));
  const engine = {
    name: "narrate",
    version: ctx.rendererVersion,
    params: { paragraphs: input.script.paragraphs.length },
  };
  const hashBase = {
    kind: "narration",
    script: input.script,
    voiceId: input.voiceId,
    promptVersion: input.promptVersion,
    engine,
  };
  const artifacts = await uploadMasterAndDelivery(
    ctx,
    normalized,
    {
      kind: "narration",
      metadataStripped: true,
      normalization: "applied",
      access: input.access,
      title: input.title,
      scriptMd: input.script.paragraphs.join("\n\n"),
      chapters,
      engine,
      voice: { catalogId: input.voiceId, promptVersion: input.promptVersion },
      refs: input.refs,
      createdBy: "system",
    },
    hashBase,
    LOUDNESS_TARGETS.spoken,
  );
  return { kind: "narrate" as const, artifacts, chapters };
}
