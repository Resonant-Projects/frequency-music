// shootout: the same passage through every configured candidate voice, each
// take a private blind member, plus one feed episode that plays them back in
// a seeded order behind a non-candidate intro voice. Unconfigured voices are
// skipped and reported; fewer than two takes is not a shootout.
import { join } from "node:path";
import { fnv1a64Hex } from "../../../convex/shared/stableHash";
import { type VoiceEntry, voiceById } from "../../../convex/shared/voices";
import { concatWithGaps, trimEdges } from "../audio/concat";
import { encodeMp3 } from "../audio/encode";
import {
  assertWithinPolicy,
  LOUDNESS_TARGETS,
  measure,
  normalize,
} from "../audio/loudness";
import { synthTone } from "../audio/synth";
import { isConfigured, providerFor } from "../tts";
import {
  PARAGRAPH_GAP_MS,
  renderParagraph,
  type Synth,
  uploadMasterAndDelivery,
} from "./narrate";
import type { ArtifactResult, JobContext } from "./types";

// Must match the effect's ORDINALS table (convex/mediaJobEffects.ts): the
// label the listener hears is the label the blind group stores.
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

// Fisher-Yates on a linear congruential generator seeded from the job id, so
// a retried job presents the same order as its first attempt.
export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
  let state = Number.parseInt(fnv1a64Hex(seed).slice(0, 8), 16) || 1;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const TONE_SECS = 0.5;
const TONE_HZ = 1000;
const TONE_GAIN_DB = -20;
const PRE_TAKE_SILENCE_MS = 1000;
const POST_TAKE_SILENCE_MS = 2000;
const EDGE_KEEP_MS = 300;

// One voice's passage: paragraphs joined with the narration gap, edges
// trimmed, normalized, then policy-checked on a decoded MP3 probe so a hot
// encode fails the take here rather than at upload.
async function renderTake(
  ctx: JobContext,
  synth: Synth,
  voice: VoiceEntry,
  paragraphs: string[],
  tag: string,
): Promise<string> {
  const files: string[] = [];
  for (const [index, paragraph] of paragraphs.entries()) {
    files.push(await renderParagraph(ctx, synth, voice, paragraph, index));
  }
  const joined = join(ctx.workDir, `${tag}-joined.wav`);
  await concatWithGaps(files, joined, PARAGRAPH_GAP_MS, {}, ctx.signal);
  const trimmed = join(ctx.workDir, `${tag}-trimmed.wav`);
  await trimEdges(joined, trimmed, EDGE_KEEP_MS, ctx.signal);
  const normalized = join(ctx.workDir, `${tag}.wav`);
  await normalize(
    trimmed,
    normalized,
    { targetLufs: LOUDNESS_TARGETS.spoken },
    ctx.signal,
  );
  const probeMp3 = join(ctx.workDir, `${tag}-probe.mp3`);
  await encodeMp3(
    normalized,
    probeMp3,
    { bitrateKbps: 128, channels: 2 },
    ctx.signal,
  );
  assertWithinPolicy(
    await measure(probeMp3, ctx.signal),
    LOUDNESS_TARGETS.spoken,
  );
  return normalized;
}

export async function shootoutHandler(ctx: JobContext, synthOverride?: Synth) {
  const input = ctx.job.input;
  if (input.kind !== "shootout") {
    throw new Error("shootout handler received another kind");
  }
  const voices = input.voiceIds.map(voiceById);
  const configured = voices.filter(isConfigured);
  const skippedVoiceIds = voices
    .filter((voice) => !isConfigured(voice))
    .map((voice) => voice.id);
  for (const voiceId of skippedVoiceIds) {
    console.warn(
      `shootout ${ctx.job.jobId}: skipping unconfigured voice ${voiceId}`,
    );
  }
  if (configured.length < 2) {
    throw new Error(
      `shootout needs at least two configured voices; configured: ${configured.map((voice) => voice.id).join(", ") || "none"}`,
    );
  }
  const synthFor = (voice: VoiceEntry): Synth =>
    synthOverride ?? providerFor(voice);

  const takeFiles = new Map<string, string>();
  for (const voice of configured) {
    takeFiles.set(
      voice.id,
      await renderTake(
        ctx,
        synthFor(voice),
        voice,
        input.passage,
        `take-${voice.id}`,
      ),
    );
  }

  const order = shuffleWithSeed(
    configured.map((voice) => voice.id),
    ctx.job.jobId,
  );
  // The intro voice is never a candidate's reveal: a hosted voice where one
  // is configured, since local voices are the ones most likely on trial.
  const introVoice =
    configured.find((voice) => voice.runsOn === "hosted") ?? configured[0]!;
  const introSynth = synthFor(introVoice);
  const intro = join(ctx.workDir, "intro.wav");
  await introSynth.synthesize(
    `This intro voice is not a candidate. You will hear ${order.length} takes of the same passage. Rate each one before the reveal.`,
    introVoice,
    intro,
    ctx.signal,
  );
  const tone = join(ctx.workDir, "tone.wav");
  await synthTone(
    tone,
    { hz: TONE_HZ, seconds: TONE_SECS, gainDb: TONE_GAIN_DB },
    ctx.signal,
  );

  // One slot per take: tone, spoken label, 1 s of silence, the take, 2 s of
  // silence. The silences are concat padding rather than files: ebur128
  // reports -inf for pure silence, which measure() cannot read.
  const slots: string[] = [];
  for (const [index, voiceId] of order.entries()) {
    const label = join(ctx.workDir, `label-${index}.wav`);
    await introSynth.synthesize(
      `${spokenLabel(index)}.`,
      introVoice,
      label,
      ctx.signal,
    );
    const announce = join(ctx.workDir, `announce-${index}.wav`);
    await concatWithGaps([tone, label], announce, 0, {}, ctx.signal);
    const slot = join(ctx.workDir, `slot-${index}.wav`);
    await concatWithGaps(
      [announce, takeFiles.get(voiceId)!],
      slot,
      PRE_TAKE_SILENCE_MS,
      { tailMs: POST_TAKE_SILENCE_MS },
      ctx.signal,
    );
    slots.push(slot);
  }
  const episodeJoined = join(ctx.workDir, "episode-joined.wav");
  const { starts } = await concatWithGaps(
    [intro, ...slots],
    episodeJoined,
    0,
    {},
    ctx.signal,
  );
  const episodeWav = join(ctx.workDir, "episode.wav");
  await normalize(
    episodeJoined,
    episodeWav,
    { targetLufs: LOUDNESS_TARGETS.spoken },
    ctx.signal,
  );
  // Each chapter starts at the tone that announces its take: entry 0 is the
  // intro, then one slot per take.
  const chapters = order.map((_, index) => ({
    title: spokenLabel(index),
    startSecs: Number((starts[1 + index] ?? 0).toFixed(3)),
  }));

  const engine = {
    name: "shootout",
    version: ctx.rendererVersion,
    params: { voices: order.length },
  };
  const takes: {
    voiceId: string;
    artifact: ArtifactResult;
    master: ArtifactResult;
    label: string;
  }[] = [];
  for (const [index, voiceId] of order.entries()) {
    const [master, delivery] = await uploadMasterAndDelivery(
      ctx,
      takeFiles.get(voiceId)!,
      {
        kind: "shootoutTake",
        metadataStripped: true,
        normalization: "applied",
        access: "private",
        title: `Shootout take ${index + 1}`,
        engine,
        refs: {},
        createdBy: "system",
      },
      { kind: "shootoutTake", voiceId, passage: input.passage, engine },
      LOUDNESS_TARGETS.spoken,
    );
    takes.push({
      voiceId,
      artifact: delivery!,
      master: master!,
      label: spokenLabel(index),
    });
  }
  const [episodeMaster, episode] = await uploadMasterAndDelivery(
    ctx,
    episodeWav,
    {
      kind: "episode",
      metadataStripped: true,
      normalization: "applied",
      access: "feed",
      title: input.title,
      chapters,
      engine,
      refs: {},
      createdBy: "system",
    },
    { kind: "shootoutEpisode", order, passage: input.passage, engine },
    LOUDNESS_TARGETS.spoken,
  );
  return {
    kind: "shootout" as const,
    takes,
    skippedVoiceIds,
    episode: episode!,
    episodeMaster: episodeMaster!,
    memberOrder: order,
  };
}
