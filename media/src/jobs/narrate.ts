// narrate: a script's paragraphs through one TTS voice into a normalized
// narration. Each paragraph is chunked to the provider's cap, the chunks and
// then the paragraphs are joined with short gaps, and the paragraph starts
// become chapter marks.
import {
  retainedKey,
  restoreChunk,
  retainChunk,
  beginSynthesis,
  failSynthesis,
} from "../retained";
import { join } from "node:path";
import { type VoiceEntry, voiceById } from "../../../convex/shared/voices";
import { concatWithGaps } from "../audio/concat";
import {
  assertWithinPolicy,
  LOUDNESS_TARGETS,
  measure,
  normalize,
} from "../audio/loudness";
import { chunkForLimit, providerFor } from "../tts";
import { SynthesisRejectedError } from "../tts/types";
import type { JobContext } from "./types";
import { uploadMasterAndDelivery } from "../audio/artifacts";

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

export async function synthesizeRetained(
  ctx: JobContext,
  synth: Synth,
  voice: VoiceEntry,
  text: string,
  file: string,
) {
  const key = retainedKey({
    text,
    voice,
    rendererVersion: ctx.rendererVersion,
    input: ctx.job.input,
  });
  if (!ctx.retainedDir || !(await restoreChunk(ctx.retainedDir, key, file))) {
    ctx.signal.throwIfAborted();
    if (ctx.retainedDir) await beginSynthesis(ctx.retainedDir, key);
    try {
      await synth.synthesize(text, voice, file, ctx.signal);
    } catch (error) {
      if (
        ctx.retainedDir &&
        !ctx.signal.aborted &&
        error instanceof SynthesisRejectedError
      )
        await failSynthesis(ctx.retainedDir, key);
      throw error;
    }
    if (ctx.retainedDir) await retainChunk(ctx.retainedDir, key, file);
    ctx.signal.throwIfAborted();
  }
}

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
    await synthesizeRetained(ctx, synth, voice, chunk, file);
    files.push(file);
  }
  const out = join(ctx.workDir, `p${index}.wav`);
  await concatWithGaps(files, out, PARAGRAPH_GAP_MS, {}, ctx.signal);
  return out;
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
