// assembleEpisode: a finished narration becomes the feed episode. Wave 1
// assembly is a lead-in of silence ahead of the narration master; chapters
// shift by the same amount.
import { join } from "node:path";
import { concatWithGaps } from "../audio/concat";
import { LOUDNESS_TARGETS, normalize } from "../audio/loudness";
import { downloadTo } from "../download";
import { uploadMasterAndDelivery } from "./narrate";
import type { JobContext } from "./types";

export const EPISODE_LEAD_IN_SECS = 1;

export async function assembleEpisodeHandler(ctx: JobContext) {
  const input = ctx.job.input;
  if (input.kind !== "assembleEpisode") {
    throw new Error("assembleEpisode handler received another kind");
  }
  // The narrate effect points this at the narration's lossless WAV master.
  const source = join(ctx.workDir, "narration.wav");
  await downloadTo(input.narrationStorageUrl, source, ctx.signal);
  const padded = join(ctx.workDir, "padded.wav");
  await concatWithGaps(
    [source],
    padded,
    0,
    { leadMs: EPISODE_LEAD_IN_SECS * 1000 },
    ctx.signal,
  );
  const normalized = join(ctx.workDir, "episode.wav");
  await normalize(
    padded,
    normalized,
    { targetLufs: LOUDNESS_TARGETS.spoken },
    ctx.signal,
  );
  const chapters = input.chapters.map((chapter) => ({
    title: chapter.title,
    startSecs: chapter.startSecs + EPISODE_LEAD_IN_SECS,
  }));
  const engine = {
    name: "assembleEpisode",
    version: ctx.rendererVersion,
    params: { leadInSecs: EPISODE_LEAD_IN_SECS },
  };
  const artifacts = await uploadMasterAndDelivery(
    ctx,
    normalized,
    {
      kind: "episode",
      metadataStripped: true,
      normalization: "applied",
      access: "feed",
      title: input.title,
      chapters,
      engine,
      // R29: the narration's refs (its weeklyBriefId) so the episode links
      // back to the brief it narrates.
      refs: input.refs ?? {},
      createdBy: "system",
    },
    { kind: "episode", narration: input.narrationArtifactId, engine },
    LOUDNESS_TARGETS.spoken,
  );
  return { kind: "assembleEpisode" as const, artifacts, chapters };
}
