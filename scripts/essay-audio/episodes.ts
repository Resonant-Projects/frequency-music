// Operator tool: audio editions of the written essays, published to the
// private podcast feed. See scripts/essay-audio/README.md.
//
//   vpx tsx scripts/essay-audio/episodes.ts queue [--limit N]
//   vpx tsx scripts/essay-audio/episodes.ts prepare --batch NAME --voice inworld (--next N | --slugs a,b)
//   vpx tsx scripts/essay-audio/episodes.ts render --batch NAME [--asr] [--voxtral-url URL]
//   vpx tsx scripts/essay-audio/episodes.ts publish --batch NAME
//
// prepare and render touch only out/essay-audio/. queue and publish read
// production Convex; publish also stops the idle production media worker
// for the length of the batch, renders nothing, and restarts it.
import "varlock/auto-load";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ConvexHttpClient } from "convex/browser";
import {
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
  makeFunctionReference,
} from "convex/server";
import { api, internal } from "../../convex/_generated/api";
import { runFfmpeg } from "../../media/src/audio/ffmpeg";
import { encodeMp3 } from "../../media/src/audio/encode";
import { concatWithGaps } from "../../media/src/audio/concat";
import {
  assertWithinPolicy,
  measure,
  normalize,
} from "../../media/src/audio/loudness";
import {
  assemblePaced,
  checkChunk,
  noiseFloorDb,
  trimToSpeech,
} from "../../media/src/audio/pacing";
import { callTool } from "../../media/src/convex";
import { downloadTo } from "../../media/src/download";
import type { JobContext, NewArtifact } from "../../media/src/jobs/types";
import { runOnce } from "../../media/src/runner";
import { chunkForLimit } from "../../media/src/tts/chunk";
import { wrapPcmAsWav } from "../../media/src/tts/elevenlabs";
import { assertUnderUploadCap } from "../../media/src/upload";
import { wordErrorRate } from "./wer";
import {
  type EssayOverride,
  type SpokenSegment,
  shortTitle,
  toSpokenEssay,
} from "./spoken";

const ESSAYS = "docs/essays";
const OUT = "out/essay-audio";
const PRODUCTION = "https://convex.resonantprojects.art";
const PROMPT_VERSION = "essay-audio-edition-20261006.1";
const RENDERER = "essay-audio-20261006.1";
const MEDIA_HOST = "ai-5090-02";
const MEDIA_CONTAINER = "frequency-media-media-1";

// ── Voices ──────────────────────────────────────────────────────────────

type VoiceKey = "inworld" | "elevenlabs" | "voxtral";
type Voice = {
  key: VoiceKey;
  catalogId: string;
  label: string;
  // Request size. Voxtral drifts on long inputs, so it gets short chunks.
  maxChars: number;
  paid: boolean;
  // Re-renders allowed for a chunk that fails the sanity gate.
  retries: number;
  // Lay a noise bed under the gaps at the take's own floor (see pacing.ts).
  roomTone: boolean;
  settings: Record<string, unknown>;
};

function voiceFor(
  key: VoiceKey,
  options: { elevenVoiceId?: string; elevenVoiceName?: string } = {},
): Voice {
  if (key === "inworld") {
    return {
      key,
      catalogId: "inworld-max",
      label: "Inworld Max, Dennis",
      maxChars: 1900,
      paid: true,
      retries: 1,
      roomTone: false,
      settings: { model: "inworld-tts-1.5-max", voice: "Dennis" },
    };
  }
  if (key === "elevenlabs") {
    const voiceId = options.elevenVoiceId ?? "JBFqnCBsd6RMkjVDRZzb";
    const name = options.elevenVoiceName ?? "George";
    return {
      key,
      catalogId: `elevenlabs-v4-${name.toLowerCase().replaceAll(/\W+/g, "-")}`,
      label: `ElevenLabs v4, ${name}`,
      maxChars: 2400,
      paid: true,
      retries: 1,
      roomTone: true,
      settings: {
        model: "eleven_v4",
        voice: voiceId,
        stability: 0.5,
        similarity_boost: 0.75,
        // 44.1 kHz PCM needs the Pro tier (403 output_format_not_allowed on
        // this plan); 192 kbps MP3 is the best format it allows.
        output_format: "mp3_44100_192",
      },
    };
  }
  return {
    key,
    catalogId: "voxtral-male-preset",
    label: "Voxtral, male preset",
    maxChars: 360,
    paid: false,
    retries: 3,
    roomTone: false,
    settings: {
      model: "mistralai/Voxtral-4B-TTS-2603",
      voice: "neutral_male",
      seed: 42,
    },
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function synthesize(
  voice: Voice,
  text: string,
  attempt: number,
  output: string,
  voxtralUrl?: string,
): Promise<void> {
  const signal = AbortSignal.timeout(300_000);
  let response: Response;
  if (voice.key === "inworld") {
    response = await fetch("https://api.inworld.ai/tts/v1/voice", {
      method: "POST",
      headers: {
        authorization: `Basic ${requireEnv("INWORLD_API_KEY")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text,
        voiceId: voice.settings.voice,
        modelId: voice.settings.model,
        audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 48000 },
      }),
      redirect: "error",
      signal,
    });
  } else if (voice.key === "elevenlabs") {
    const { voice: id, output_format, model, ...settings } = voice.settings;
    response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${String(id)}?output_format=${String(output_format)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": requireEnv("ELEVENLABS_API_KEY"),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: settings,
        }),
        redirect: "error",
        signal,
      },
    );
  } else {
    if (!voxtralUrl) throw new Error("--voxtral-url is required for Voxtral");
    response = await fetch(`${voxtralUrl.replace(/\/$/, "")}/v1/audio/speech`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: voice.settings.model,
        input: text,
        voice: voice.settings.voice,
        // A re-render after a failed gate tries another seed.
        seed: Number(voice.settings.seed) + attempt,
        response_format: "wav",
      }),
      redirect: "error",
      signal,
    });
  }
  // Status only: a body may echo the request.
  if (!response.ok) throw new Error(`${voice.key} status ${response.status}`);
  if (voice.key === "inworld") {
    const body = (await response.json()) as { audioContent: string };
    const pcm = new Uint8Array(Buffer.from(body.audioContent, "base64"));
    await writeFile(output, wrapPcmAsWav(pcm, 48000, 1));
  } else if (voice.key === "elevenlabs") {
    const mp3 = `${output}.mp3`;
    await writeFile(mp3, new Uint8Array(await response.arrayBuffer()));
    await runFfmpeg(["-i", mp3, "-ac", "1", "-c:a", "pcm_s24le", output]);
  } else {
    await writeFile(output, new Uint8Array(await response.arrayBuffer()));
  }
}

// ── Speech recognition check (optional) ─────────────────────────────────

async function transcribe(file: string): Promise<string> {
  const form = new FormData();
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "en");
  form.append("response_format", "json");
  form.append(
    "file",
    new Blob([new Uint8Array(await readFile(file))], { type: "audio/wav" }),
    "chunk.wav",
  );
  const response = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { authorization: `Bearer ${requireEnv("GROQ_API_KEY")}` },
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(120_000),
    },
  );
  if (!response.ok) throw new Error(`groq status ${response.status}`);
  return ((await response.json()) as { text: string }).text;
}

// ── Manifest ────────────────────────────────────────────────────────────

type ManifestEntry = {
  slug: string;
  source: string;
  sourceSha256: string;
  title: string;
  episodeTitle: string;
  voice: VoiceKey;
  voiceOptions: { elevenVoiceId?: string; elevenVoiceName?: string };
  segments: SpokenSegment[];
  chapters: { title: string; startParagraph: number }[];
};

type Manifest = { batch: string; createdAt: string; entries: ManifestEntry[] };

const batchDir = (batch: string) => join(OUT, batch);

async function readManifest(batch: string): Promise<Manifest> {
  return JSON.parse(
    await readFile(join(batchDir(batch), "manifest.json"), "utf8"),
  ) as Manifest;
}

async function readOverrides(): Promise<Record<string, EssayOverride>> {
  return JSON.parse(
    await readFile("scripts/essay-audio/overrides.json", "utf8"),
  ) as Record<string, EssayOverride>;
}

async function essaySlugs(): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const all = (await readdir(ESSAYS))
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.slice(0, -3))
    .sort();
  // Essays that have been through a feedback round come first.
  const reviewed = (await readFile(join(ESSAYS, "feedback-list.txt"), "utf8"))
    .split("\n")
    .map((line) => line.trim())
    .filter((slug) => all.includes(slug));
  return [...new Set([...reviewed, ...all])];
}

// ── Convex ──────────────────────────────────────────────────────────────

function productionClient(): ConvexHttpClient {
  if (process.env.CONVEX_URL !== PRODUCTION) {
    throw new Error(`unexpected CONVEX_URL ${process.env.CONVEX_URL}`);
  }
  const client = new ConvexHttpClient(PRODUCTION, { logger: false });
  (
    client as ConvexHttpClient & { setAdminAuth(key: string): void }
  ).setAdminAuth(requireEnv("CONVEX_SELF_HOSTED_ADMIN_KEY"));
  return client;
}

// Admin auth may call internal functions; the client's types admit only
// public ones, so these keep the argument and return types while widening
// the visibility.
function adminMutation<F extends FunctionReference<"mutation", "internal">>(
  client: ConvexHttpClient,
  ref: F,
  args: FunctionArgs<F>,
): Promise<FunctionReturnType<F>> {
  const call = client.mutation.bind(client) as unknown as (
    ref: F,
    args: FunctionArgs<F>,
  ) => Promise<FunctionReturnType<F>>;
  return call(ref, args);
}

function adminQuery<F extends FunctionReference<"query", "internal">>(
  client: ConvexHttpClient,
  ref: F,
  args: FunctionArgs<F>,
): Promise<FunctionReturnType<F>> {
  const call = client.query.bind(client) as unknown as (
    ref: F,
    args: FunctionArgs<F>,
  ) => Promise<FunctionReturnType<F>>;
  return call(ref, args);
}

async function scanTable(
  client: ConvexHttpClient,
  table: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 200; page++) {
    const result = (await client.query(
      makeFunctionReference<"query">("_system/cli/tableData"),
      { table, order: "desc", paginationOpts: { cursor, numItems: 200 } },
    )) as {
      page: Record<string, unknown>[];
      isDone: boolean;
      continueCursor: string;
    };
    rows.push(...result.page);
    if (result.isDone) return rows;
    cursor = result.continueCursor;
  }
  throw new Error(`incomplete scan of ${table}`);
}

// Essays with a ready feed episode, by source path: the same ready
// delivery conditions as podcast.listFeedEpisodes, so a failed or partial
// publication does not hide an essay. Includes the October 5 listening-trial
// editions, which recorded their source the same way.
async function publishedSources(
  client: ConvexHttpClient,
): Promise<Set<string>> {
  const artifacts = await scanTable(client, "audioArtifacts");
  const sources = new Set<string>();
  for (const artifact of artifacts) {
    const engine = artifact.engine as
      | { params?: { source?: unknown } }
      | undefined;
    const source = engine?.params?.source;
    if (
      typeof source === "string" &&
      source.startsWith(`${ESSAYS}/`) &&
      artifact.kind === "episode" &&
      artifact.role === "delivery" &&
      artifact.access === "feed" &&
      artifact.status === "ready"
    ) {
      sources.add(source);
    }
  }
  return sources;
}

// ── Commands ────────────────────────────────────────────────────────────

async function queue(limit: number): Promise<string[]> {
  const published = await publishedSources(productionClient());
  const overrides = await readOverrides();
  const ready: string[] = [];
  const blocked: string[] = [];
  const withOmissions: string[] = [];
  for (const slug of await essaySlugs()) {
    if (published.has(`${ESSAYS}/${slug}.md`)) continue;
    if (overrides[slug]?.skip) continue;
    const essay = toSpokenEssay(
      slug,
      await readFile(join(ESSAYS, `${slug}.md`), "utf8"),
      overrides[slug],
    );
    if (essay.warnings.length) blocked.push(slug);
    else if (essay.omissions.length) withOmissions.push(slug);
    else ready.push(slug);
  }
  // Essays that lose tables or code listings in audio come after the ones
  // that read whole.
  ready.push(...withOmissions);
  console.log(
    JSON.stringify({
      published: published.size,
      ready: ready.length,
      needsOverride: blocked.length,
      next: ready.slice(0, limit),
    }),
  );
  return ready.slice(0, limit);
}

async function prepare(
  batch: string,
  voiceKey: VoiceKey,
  slugs: string[],
  voiceOptions: ManifestEntry["voiceOptions"],
): Promise<void> {
  const voice = voiceFor(voiceKey, voiceOptions);
  const overrides = await readOverrides();
  const entries: ManifestEntry[] = [];
  for (const slug of slugs) {
    const path = join(ESSAYS, `${slug}.md`);
    const markdown = await readFile(path, "utf8");
    const essay = toSpokenEssay(slug, markdown, overrides[slug]);
    if (essay.warnings.length) {
      throw new Error(
        `${slug} needs an override first:\n  ${essay.warnings.join("\n  ")}`,
      );
    }
    entries.push({
      slug,
      source: path,
      sourceSha256: createHash("sha256").update(markdown).digest("hex"),
      title: essay.title,
      episodeTitle: `${shortTitle(essay.title)} [${voice.label}]`,
      voice: voiceKey,
      voiceOptions,
      segments: essay.segments,
      chapters: essay.chapters,
    });
  }
  await mkdir(batchDir(batch), { recursive: true });
  const manifest: Manifest = {
    batch,
    createdAt: new Date().toISOString(),
    entries,
  };
  await writeFile(
    join(batchDir(batch), "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  for (const entry of entries) {
    await writeFile(
      join(batchDir(batch), `${entry.slug}.txt`),
      `${entry.segments.map((s) => `[${s.role}] ${s.text}`).join("\n\n")}\n`,
    );
  }
  const chars = entries.reduce(
    (sum, entry) =>
      sum + entry.segments.reduce((total, s) => total + s.text.length, 0),
    0,
  );
  console.log(
    JSON.stringify({ batch, voice: voice.label, essays: slugs, chars }),
  );
}

type Ledger = { attemptedChars: number };

// Everything that decides an essay's audio. A render is reused, and
// published, only for the manifest entry it was made from.
function inputFingerprint(entry: ManifestEntry): string {
  const voice = voiceFor(entry.voice, entry.voiceOptions);
  return createHash("sha256")
    .update(
      JSON.stringify({
        segments: entry.segments,
        chapters: entry.chapters,
        voice: voice.catalogId,
        settings: voice.settings,
        maxChars: voice.maxChars,
      }),
    )
    .digest("hex");
}

type RenderRecord = {
  fingerprint: string;
  asrChecked: boolean;
  voice: string;
  settings: Record<string, unknown>;
  chapters: { title: string; startSecs: number }[];
};

async function readRender(dir: string): Promise<RenderRecord | undefined> {
  try {
    return JSON.parse(
      await readFile(join(dir, "render.json"), "utf8"),
    ) as RenderRecord;
  } catch {
    return undefined;
  }
}

async function render(
  batch: string,
  options: { asr: boolean; voxtralUrl?: string; capChars: number },
): Promise<void> {
  const manifest = await readManifest(batch);
  const ledgerFile = join(batchDir(batch), "attempts.jsonl");
  const ledger: Ledger = { attemptedChars: 0 };
  try {
    for (const line of (await readFile(ledgerFile, "utf8")).split("\n")) {
      if (line) {
        // Only paid attempts count toward the cap; lines written before the
        // flag existed are counted, to stay conservative.
        const attempt = JSON.parse(line) as { chars: number; paid?: boolean };
        if (attempt.paid !== false) ledger.attemptedChars += attempt.chars;
      }
    }
  } catch {}
  for (const entry of manifest.entries) {
    const voice = voiceFor(entry.voice, entry.voiceOptions);
    const dir = join(batchDir(batch), entry.slug);
    await mkdir(dir, { recursive: true });
    const fingerprint = inputFingerprint(entry);
    const previous = await readRender(dir);
    if (
      previous?.fingerprint === fingerprint &&
      (previous.asrChecked || !options.asr)
    ) {
      console.log(`${entry.slug}: already rendered`);
      continue;
    }
    // From here the old render no longer stands: if this attempt fails,
    // publish must not find a render.json to accept.
    if (previous) {
      await rename(join(dir, "render.json"), join(dir, "render.stale.json"));
    }
    const rates: number[] = [];
    const segmentFiles: string[][] = [];
    const flagged: string[] = [];
    for (const [segmentIndex, segment] of entry.segments.entries()) {
      const files: string[] = [];
      for (const text of chunkForLimit(segment.text, voice.maxChars)) {
        const hash = createHash("sha256")
          .update(JSON.stringify([voice.settings, text]))
          .digest("hex")
          .slice(0, 16);
        const trimmed = join(dir, `${hash}.trim.wav`);
        const asrMarker = join(dir, `${hash}.asr.json`);
        const asrApplies = options.asr && text.length >= 60;
        let cached = await exists(trimmed);
        // A chunk cached by a run without --asr is checked now.
        if (cached && asrApplies && !(await exists(asrMarker))) {
          const wer = wordErrorRate(text, await transcribe(trimmed));
          if (wer > 0.2) {
            console.log(
              `${entry.slug} segment ${segmentIndex} cached chunk rejected: word error rate ${(wer * 100).toFixed(0)}%`,
            );
            await rename(trimmed, join(dir, `${hash}.rejected.wav`));
            cached = false;
          } else {
            await writeFile(asrMarker, `${JSON.stringify({ wer })}\n`);
          }
        }
        if (!cached) {
          let accepted = false;
          for (
            let attempt = 0;
            attempt <= voice.retries && !accepted;
            attempt++
          ) {
            if (
              voice.paid &&
              ledger.attemptedChars + text.length > options.capChars
            ) {
              throw new Error(
                `paid character cap ${options.capChars} reached; raise --cap-chars deliberately`,
              );
            }
            if (voice.paid) ledger.attemptedChars += text.length;
            await appendFile(
              ledgerFile,
              `${JSON.stringify({ slug: entry.slug, segmentIndex, hash, attempt, chars: text.length, paid: voice.paid, voice: voice.catalogId, at: new Date().toISOString() })}\n`,
            );
            const raw = join(dir, `${hash}.a${attempt}.wav`);
            await synthesize(voice, text, attempt, raw, options.voxtralUrl);
            const candidate = join(dir, `${hash}.a${attempt}.trim.wav`);
            await trimToSpeech(raw, candidate);
            const seconds = (await measure(candidate)).durationSecs;
            const median = rates.length >= 4 ? medianOf(rates) : undefined;
            let verdict = checkChunk(text.length, seconds, median);
            if (verdict.ok && asrApplies) {
              const wer = wordErrorRate(text, await transcribe(candidate));
              if (wer > 0.2) {
                verdict = {
                  ok: false,
                  reason: `word error rate ${(wer * 100).toFixed(0)}%`,
                };
              } else {
                await writeFile(asrMarker, `${JSON.stringify({ wer })}\n`);
              }
            }
            if (verdict.ok) {
              await rename(candidate, trimmed);
              accepted = true;
            } else {
              console.log(
                `${entry.slug} segment ${segmentIndex} attempt ${attempt + 1} rejected: ${verdict.reason}`,
              );
            }
          }
          if (!accepted) {
            flagged.push(`segment ${segmentIndex}: "${text.slice(0, 80)}…"`);
            continue;
          }
        }
        const seconds = (await measure(trimmed)).durationSecs;
        if (text.length >= 60) rates.push(text.length / seconds);
        files.push(trimmed);
      }
      segmentFiles.push(files);
    }
    if (flagged.length) {
      throw new Error(
        `${entry.slug}: chunks failed the sanity gate after retries; not assembling:\n  ${flagged.join("\n  ")}`,
      );
    }
    let roomToneDb: number | undefined;
    if (voice.roomTone) {
      const sample = segmentFiles.flat().slice(0, 8);
      const floors = await Promise.all(
        sample.map((file) => noiseFloorDb(file)),
      );
      const floor = medianOf(floors);
      // A clean take needs no bed; a hissy one gets a bed at its own floor.
      if (floor > -80) roomToneDb = floor;
    }
    const joined = join(dir, "joined.wav");
    const { segmentStarts, durationSecs } = await assemblePaced(
      entry.segments.map((segment, index) => ({
        role: segment.role,
        ...(segment.breakBefore ? { breakBefore: true } : {}),
        files: segmentFiles[index]!,
      })),
      joined,
      { tailMs: 600, ...(roomToneDb === undefined ? {} : { roomToneDb }) },
    );
    const normalized = join(dir, "normalized.wav");
    await normalize(joined, normalized, { targetLufs: -16 });
    const measurements = await measure(normalized);
    assertWithinPolicy(measurements, -16);
    const chapters = entry.chapters.map((chapter) => ({
      title: chapter.title,
      startSecs: Number(segmentStarts[chapter.startParagraph]!.toFixed(3)),
    }));
    await writeFile(
      join(dir, "render.json"),
      `${JSON.stringify(
        {
          slug: entry.slug,
          fingerprint,
          asrChecked: options.asr,
          voice: voice.catalogId,
          settings: voice.settings,
          roomToneDb,
          medianCharsPerSec: Number(medianOf(rates).toFixed(2)),
          durationSecs,
          measurements,
          chapters,
          attemptedCharsBatch: ledger.attemptedChars,
        },
        null,
        2,
      )}\n`,
    );
    console.log(
      `${entry.slug}: ${(measurements.durationSecs / 60).toFixed(1)} min, ${chapters.length} chapters, batch paid characters ${ledger.attemptedChars}`,
    );
  }
}

async function publish(batch: string): Promise<void> {
  const manifest = await readManifest(batch);
  const client = productionClient();
  process.env.CONVEX_SITE_URL = "https://convex-http.resonantprojects.art";
  const house = (await client.query(api.settings.houseVoice, {
    devBypassSecret: requireEnv("AUTH_BYPASS_SECRET"),
  })) as { voiceId: string };
  if (house.voiceId !== "inworld-max") {
    throw new Error("house voice changed; re-evaluate before publishing");
  }
  const published = await publishedSources(client);
  const pending = [];
  for (const entry of manifest.entries) {
    if (published.has(entry.source)) {
      console.log(`${entry.slug}: already in the feed`);
      continue;
    }
    const rendered = await readRender(join(batchDir(batch), entry.slug));
    if (rendered?.fingerprint !== inputFingerprint(entry)) {
      throw new Error(
        `${entry.slug} has no render for its current manifest entry; run render`,
      );
    }
    pending.push(entry);
  }
  if (pending.length === 0) return;
  const busy = async () =>
    (await scanTable(client, "mediaJobs")).some(
      (job) => job.status === "queued" || job.status === "claimed",
    );
  if (await busy())
    throw new Error("media queue is busy; not stopping the worker");
  console.log(
    JSON.stringify({
      target: PRODUCTION,
      effects: `stop the idle media worker, publish ${pending.length} essay episode(s) through the leased narrate/assemble lifecycle, restart the worker`,
    }),
  );
  let stopped = false;
  try {
    execFileSync(
      "ssh",
      [MEDIA_HOST, `sudo -n docker stop --time 30 ${MEDIA_CONTAINER}`],
      { stdio: "pipe" },
    );
    stopped = true;
    if (await busy())
      throw new Error("queue changed while stopping the worker");
    for (const entry of pending) await publishOne(client, batch, entry);
  } finally {
    if (stopped) {
      execFileSync(
        "ssh",
        [MEDIA_HOST, `sudo -n docker start ${MEDIA_CONTAINER}`],
        {
          stdio: "pipe",
        },
      );
      console.log("production media worker restarted");
    }
  }
}

async function publishOne(
  client: ConvexHttpClient,
  batch: string,
  entry: ManifestEntry,
): Promise<void> {
  const dir = join(batchDir(batch), entry.slug);
  const rendered = JSON.parse(
    await readFile(join(dir, "render.json"), "utf8"),
  ) as {
    chapters: { title: string; startSecs: number }[];
    settings: Record<string, unknown>;
    voice: string;
  };
  const local = join(dir, "normalized.wav");
  assertWithinPolicy(await measure(local), -16);
  const script = {
    paragraphs: entry.segments.map((segment) => segment.text),
    chapters: entry.chapters,
  };
  const engineParams = {
    source: entry.source,
    sourceSha256: entry.sourceSha256,
    settings: rendered.settings,
  };
  const workDir = join(batchDir(batch), "publisher");
  await mkdir(workDir, { recursive: true });

  const upload = async (
    ctx: JobContext,
    input: string,
    kind: "narration" | "episode",
    base: Omit<NewArtifact, "role" | "encoding" | "contentHash">,
  ) => {
    const duration = (await measure(input, ctx.signal)).durationSecs;
    // Long 48 kHz masters would pass the 95 MB upload cap; keep 24 kHz then.
    const rate = duration * 48000 * 2 + 44 > 95_000_000 ? 24000 : 48000;
    const master = join(ctx.workDir, "master.wav");
    await runFfmpeg(
      [
        "-i",
        input,
        "-map_metadata",
        "-1",
        "-fflags",
        "+bitexact",
        "-ar",
        String(rate),
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        master,
      ],
      { signal: ctx.signal },
    );
    const delivery = join(ctx.workDir, "delivery.mp3");
    await encodeMp3(
      master,
      delivery,
      { bitrateKbps: 128, channels: 2 },
      ctx.signal,
    );
    const one = async (
      path: string,
      role: "masterNormalized" | "delivery",
      masterArtifactId?: string,
    ) => {
      const metrics = await measure(path, ctx.signal);
      assertWithinPolicy(metrics, -16);
      assertUnderUploadCap(role, (await stat(path)).size);
      const artifact: NewArtifact = {
        ...base,
        kind,
        role,
        access: role === "delivery" ? base.access : "private",
        encoding:
          role === "delivery"
            ? { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 }
            : { codec: "wav", sampleRate: rate, channels: 1 },
        contentHash: createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
        ...(masterArtifactId
          ? {
              masterArtifactId:
                masterArtifactId as NewArtifact["masterArtifactId"],
            }
          : {}),
      };
      const ticket = await ctx.tools.generateAudioUploadUrl({
        jobId: ctx.job.jobId,
        leaseToken: ctx.job.leaseToken,
        artifact,
      });
      const mimeType = role === "delivery" ? "audio/mpeg" : "audio/wav";
      const stored = await ctx.tools.uploadBytes(
        ticket.uploadUrl,
        path,
        mimeType,
        ctx.signal,
      );
      await ctx.tools.attachAudioStorage({
        jobId: ctx.job.jobId,
        leaseToken: ctx.job.leaseToken,
        artifactId: ticket.artifactId,
        storageId: stored.storageId,
      });
      return {
        artifactId: ticket.artifactId as NonNullable<
          NewArtifact["masterArtifactId"]
        >,
        durationSecs: metrics.durationSecs,
        loudnessLufs: metrics.integratedLufs,
        truePeakDbtp: metrics.truePeakDbtp,
        mimeType,
      };
    };
    const master1 = await one(master, "masterNormalized");
    const delivery1 = await one(delivery, "delivery", master1.artifactId);
    return [master1, delivery1];
  };

  const voiceMeta = {
    catalogId: rendered.voice,
    promptVersion: PROMPT_VERSION,
  };
  const narrate = async (ctx: JobContext) => {
    const input = ctx.job.input;
    if (input.kind !== "narrate" || input.title !== entry.episodeTitle) {
      throw new Error("unexpected narrate job; refusing");
    }
    const artifacts = await upload(ctx, local, "narration", {
      kind: "narration",
      metadataStripped: true,
      normalization: "applied",
      access: "feed",
      title: entry.episodeTitle,
      scriptMd: script.paragraphs.join("\n\n"),
      chapters: rendered.chapters,
      engine: {
        name: "essay-audio-narration",
        version: RENDERER,
        params: engineParams,
      },
      voice: voiceMeta,
      refs: {},
      createdBy: "system",
    });
    return { kind: "narrate" as const, artifacts, chapters: rendered.chapters };
  };
  const assemble = async (ctx: JobContext) => {
    const input = ctx.job.input;
    if (
      input.kind !== "assembleEpisode" ||
      input.title !== entry.episodeTitle
    ) {
      throw new Error("unexpected assembly job; refusing");
    }
    const downloaded = join(ctx.workDir, "narration.wav");
    await downloadTo(input.narrationStorageUrl, downloaded, ctx.signal);
    const padded = join(ctx.workDir, "padded.wav");
    await concatWithGaps([downloaded], padded, 0, { leadMs: 1000 }, ctx.signal);
    const normalized = join(ctx.workDir, "normalized.wav");
    await normalize(padded, normalized, { targetLufs: -16 }, ctx.signal);
    const chapters = input.chapters.map((chapter) => ({
      ...chapter,
      startSecs: chapter.startSecs + 1,
    }));
    const artifacts = await upload(ctx, normalized, "episode", {
      kind: "episode",
      metadataStripped: true,
      normalization: "applied",
      access: "feed",
      title: entry.episodeTitle,
      chapters,
      engine: {
        name: "essay-audio-assembly",
        version: RENDERER,
        params: {
          ...engineParams,
          narrationArtifactId: input.narrationArtifactId,
        },
      },
      voice: voiceMeta,
      refs: input.refs ?? {},
      createdBy: "system",
    });
    return { kind: "assembleEpisode" as const, artifacts, chapters };
  };

  const outcome = await adminMutation(client, internal.mediaJobs.enqueue, {
    input: {
      kind: "narrate",
      script,
      voiceId: rendered.voice,
      promptVersion: PROMPT_VERSION,
      target: "spoken",
      title: entry.episodeTitle,
      access: "feed",
      refs: {},
      assembleOnDone: true,
      episodeTitle: entry.episodeTitle,
      rendererVersion: RENDERER,
    },
  });
  if (!outcome.created) {
    throw new Error(
      `${entry.slug}: an identical job already exists (${outcome.jobId}); inspect before retrying`,
    );
  }
  const config = {
    workerId: `operator-${RENDERER}`,
    kinds: ["narrate", "assembleEpisode"],
    workDir,
    rendererVersion: RENDERER,
  };
  const expectedKinds = ["narrate", "assembleEpisode"] as const;
  for (const [step, kind] of expectedKinds.entries()) {
    // runOnce claims by kind, not by job. With the production worker
    // stopped, the only live job must be this essay's; anything else (a
    // weekly brief, say) is left for the worker and the batch stops.
    const live = (await scanTable(client, "mediaJobs")).filter(
      (job) => job.status === "queued" || job.status === "claimed",
    );
    const input = (live[0]?.input ?? {}) as {
      kind?: string;
      title?: string;
      rendererVersion?: string;
    };
    const ours =
      live.length === 1 &&
      live[0]?.status === "queued" &&
      input.kind === kind &&
      input.title === entry.episodeTitle &&
      input.rendererVersion === RENDERER &&
      (step > 0 || live[0]?._id === outcome.jobId);
    if (!ours) {
      throw new Error(
        `${entry.slug}: another media job is live (${live.length} queued or claimed); stopping before any claim`,
      );
    }
    const result = await runOnce(config, callTool, {
      narrate,
      assembleEpisode: assemble,
    });
    if (result !== "done")
      throw new Error(`${entry.slug}: publication ${result}`);
  }
  const episodes = await adminQuery(client, internal.podcast.listFeedEpisodes, {
    limit: 100,
  });
  const found = episodes.filter(
    (episode) => episode.title === entry.episodeTitle,
  );
  if (found.length !== 1) {
    throw new Error(
      `${entry.slug}: expected one feed episode, found ${found.length}`,
    );
  }
  await writeFile(
    join(dir, "published.json"),
    `${JSON.stringify(
      found.map(
        ({ storageUrl: _, ...episode }: Record<string, unknown>) => episode,
      ),
      null,
      2,
    )}\n`,
  );
  console.log(`${entry.slug}: published "${entry.episodeTitle}"`);
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function positiveInteger(raw: string | undefined, flag: string): number {
  const value = Number(raw);
  if (!raw || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${flag} must be a positive whole number, got ${raw}`);
  }
  return value;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      batch: { type: "string" },
      voice: { type: "string", default: "inworld" },
      next: { type: "string" },
      slugs: { type: "string" },
      limit: { type: "string", default: "10" },
      asr: { type: "boolean", default: false },
      "voxtral-url": { type: "string" },
      "eleven-voice-id": { type: "string" },
      "eleven-voice-name": { type: "string" },
      "cap-chars": { type: "string", default: "200000" },
    },
  });
  const command = positionals[0];
  const batch = values.batch;
  if (command === "queue") {
    await queue(positiveInteger(values.limit, "--limit"));
    return;
  }
  if (!batch || !/^[\w.-]+$/.test(batch))
    throw new Error("--batch NAME is required");
  if (command === "prepare") {
    const voice = values.voice as VoiceKey;
    if (!["inworld", "elevenlabs", "voxtral"].includes(voice)) {
      throw new Error(`unknown voice ${voice}`);
    }
    const slugs = values.slugs
      ? values.slugs.split(",").map((slug) => slug.trim())
      : await queue(positiveInteger(values.next ?? "5", "--next"));
    await prepare(batch, voice, slugs, {
      ...(values["eleven-voice-id"]
        ? { elevenVoiceId: values["eleven-voice-id"] }
        : {}),
      ...(values["eleven-voice-name"]
        ? { elevenVoiceName: values["eleven-voice-name"] }
        : {}),
    });
  } else if (command === "render") {
    await render(batch, {
      asr: values.asr,
      ...(values["voxtral-url"] ? { voxtralUrl: values["voxtral-url"] } : {}),
      capChars: positiveInteger(values["cap-chars"], "--cap-chars"),
    });
  } else if (command === "publish") {
    await publish(batch);
  } else {
    throw new Error(`unknown command ${command}`);
  }
}

await main();
