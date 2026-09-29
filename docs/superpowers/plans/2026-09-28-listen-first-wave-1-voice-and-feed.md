# Listen-First Wave 1: Voice Shootout and Podcast Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Choose the house voice by a blind shootout episode rated on a minimal `/listen` panel, then deliver every Friday brief as a podcast episode in a private Pocket Casts feed.

**Architecture:** Convex gains a voice catalog, a `settings`-backed house voice, a narration script builder (LLM), `voiceRatings` with an atomic last-rating reveal, and three new media job kinds (`narrate`, `shootout`, `assembleEpisode`) whose effects run inside `completeMediaJob`. The `media/` package gains TTS providers (Gemini, Inworld, ElevenLabs, Breeze local via an OpenAI-compatible endpoint), paragraph chunking with 400 ms joins, chapter timing, silence trimming, and episode assembly. Brief generation enqueues narration as its last step; a Saturday cron reconciles.

**Tech Stack:** Everything in wave 0, plus Vercel AI SDK via `convex/llmNode.ts` for scripts, provider REST APIs for TTS, ffmpeg `silenceremove`/`concat`, Solid + TanStack router + Panda CSS for the listen page.

**Spec:** `docs/superpowers/specs/2026-09-28-voice-and-podcast-feed-design.md` with umbrella `docs/superpowers/specs/2026-09-28-listen-first-program-design.md` (§3.2 blind groups, §3.4 loudness, §3.5 feed).

## Global Constraints

- All wave 0 constraints apply (vpx/vp, `convex/shared/` contracts, `AGENT_TOOL_SECRET` service identity, no decision or listening-session writes from tools, secrets via 1Password only, **PRODUCTION** steps gated, `harness/modules.ts` registration, `vp run verify`).
- Loudness: spoken −16 LUFS ±0.5 LU, ≤ −1 dBTP on decoded delivery, mono source delivered dual-mono. Shootout takes trimmed to 300 ms lead/tail silence.
- Voice catalog ids are fixed strings: `gemini-flash-tts`, `inworld-max`, `elevenlabs-v3`, `breeze-2`. Kokoro, Piper, and Qwen3-TTS are excluded.
- Narration prompt version constant `NARRATION_PROMPT_VERSION = "narration.v1"`; scripts contain no markdown, `[pause]` marks paragraph breaks, chapters are `{ title, startParagraph }`.
- Script length targets: brief 8 to 14 minutes, docket 3 to 5 minutes at 150 words per minute (1200 to 2100 words for a brief).
- ElevenLabs requests are chunked at paragraph boundaries under 5 000 characters; chunks join with 400 ms silence.
- Shootout episode timings: intro, then per take 0.5 s 1 kHz tone at −20 dBFS, spoken "take N", 1 s silence, the take, 2 s silence.
- Blind projection returns only `memberId`, `label`, `durationSecs`, `playbackUrl`; reveal happens in the same mutation as the last required rating; choosing the house voice is a separate explicit mutation.
- Feed metadata: title "Frequency Music, private", author "Freq", `itunes:block yes`, only `access: "feed"` episodes; artwork `web/public/podcast-cover.png`.
- Episode titles: `Weekly turn, week of <Monday date>`.
- Wave 0 deploy findings (2026-09-29): Convex file URLs are served by the API origin (port 3210) with Range support; `https://listen.rproj.art/api/storage/<uuid>` returns `206` with `content-range` through Cloudflare, so §3.5's no-Range fallback is not needed. The `listen.rproj.art` proxy host forwards `/podcast/` to the site (3211) and `/api/storage/` to the API (3210) and 404s every other path. Cloudflare caps one proxied request body at 100 MB, which bounds a single episode upload from the media host. The worker on ai-5090-02 reaches Convex only through `https://convex-http.resonantprojects.art` (no route to the lab VLAN).

## Review Focus

1. A brief whose generation throws "No recent hypotheses or recipes found": no narration job, no episode, and the reconcile cron must not retry forever. Test in Task 6.
2. Two ratings submitted for the same member (double tap): the second returns the first's result, the group stays revealed once, no duplicate row. Test in Task 4.
3. A hosted TTS key absent for one voice: the shootout skips that voice, still assembles the episode from the rest, and the blind group has only rendered members. Test in Task 9.
4. A script paragraph longer than 5 000 characters for ElevenLabs: chunked at sentence boundaries, never truncated. Test in Task 7.
5. A shootout take that normalizes fine but decodes with a true peak above −1 dBTP: the take fails and the episode is not assembled from it. Test in Task 9.

---

### Task 1: Voice catalog (`convex/shared/voices.ts`)

**Files:**
- Create: `convex/shared/voices.ts`
- Test: `convex/shared/voices.test.ts`

**Interfaces:**
- Produces `VOICE_CATALOG: readonly VoiceEntry[]`, `VoiceEntry = { id, provider: "google" | "inworld" | "elevenlabs" | "openaiCompatible", model, voiceId, runsOn: "hosted" | "local", licence, openclawProvider, verifiedOn, keyEnvVar, baseUrlEnvVar? }`, `voiceById(id)`, `VOICE_IDS`.

- [ ] **Step 1: Write the failing test**

```ts
// convex/shared/voices.test.ts
import { describe, expect, test } from "vite-plus/test";
import { VOICE_CATALOG, VOICE_IDS, voiceById } from "./voices";

describe("voice catalog", () => {
  test("has exactly the four shootout voices with unique ids", () => {
    expect([...VOICE_IDS]).toEqual(["gemini-flash-tts", "inworld-max", "elevenlabs-v3", "breeze-2"]);
    expect(new Set(VOICE_CATALOG.map((voice) => voice.id)).size).toBe(4);
  });
  test("every entry names a provider, licence, OpenClaw mapping, key env var, and verification date", () => {
    for (const voice of VOICE_CATALOG) {
      expect(voice.provider).toBeTruthy();
      expect(voice.licence).toBeTruthy();
      expect(voice.openclawProvider).toBeTruthy();
      expect(voice.keyEnvVar).toMatch(/^[A-Z0-9_]+$/);
      expect(voice.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(voiceById("breeze-2").runsOn).toBe("local");
    expect(voiceById("breeze-2").baseUrlEnvVar).toBe("BREEZE_TTS_BASE_URL");
    expect(() => voiceById("kokoro")).toThrow(/unknown voice/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test convex/shared/voices.test.ts` → FAIL, module not found.

- [ ] **Step 3: Write the catalog**

```ts
// convex/shared/voices.ts
// TTS voices are not LLMs: they live here, not in convex/llm.ts MODELS.
// verifiedOn is the date the model/voice ids were checked against the
// provider's live API; the wave 1 plan's first task re-verifies them.
export type VoiceProvider = "google" | "inworld" | "elevenlabs" | "openaiCompatible";

export type VoiceEntry = {
  id: string;
  provider: VoiceProvider;
  model: string;
  voiceId: string;
  runsOn: "hosted" | "local";
  licence: string;
  openclawProvider: string;
  keyEnvVar: string;
  baseUrlEnvVar?: string;
  verifiedOn: string;
};

export const VOICE_CATALOG: readonly VoiceEntry[] = [
  {
    id: "gemini-flash-tts",
    provider: "google",
    model: "gemini-3.1-flash-tts",
    voiceId: "Charon",
    runsOn: "hosted",
    licence: "Google Gemini API terms",
    openclawProvider: "google",
    keyEnvVar: "GEMINI_API_KEY",
    verifiedOn: "2026-09-28",
  },
  {
    id: "inworld-max",
    provider: "inworld",
    model: "inworld-tts-1.5-max",
    voiceId: "Dennis",
    runsOn: "hosted",
    licence: "Inworld API terms",
    openclawProvider: "inworld",
    keyEnvVar: "INWORLD_API_KEY",
    verifiedOn: "2026-09-28",
  },
  {
    id: "elevenlabs-v3",
    provider: "elevenlabs",
    model: "eleven_v3",
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    runsOn: "hosted",
    licence: "ElevenLabs API terms",
    openclawProvider: "elevenlabs",
    keyEnvVar: "ELEVENLABS_API_KEY",
    verifiedOn: "2026-09-28",
  },
  {
    id: "breeze-2",
    provider: "openaiCompatible",
    model: "breeze-tts-2",
    voiceId: "design:A calm, warm, unhurried adult narrator with clear diction and a low-mid register.",
    runsOn: "local",
    licence: "Breeze TTS 2 research licence, personal use only",
    openclawProvider: "openai-compatible",
    keyEnvVar: "BREEZE_TTS_API_KEY",
    baseUrlEnvVar: "BREEZE_TTS_BASE_URL",
    verifiedOn: "2026-09-28",
  },
] as const;

export const VOICE_IDS = VOICE_CATALOG.map((voice) => voice.id) as readonly string[];

export function voiceById(id: string): VoiceEntry {
  const voice = VOICE_CATALOG.find((entry) => entry.id === id);
  if (!voice) throw new Error(`unknown voice ${id}`);
  return voice;
}
```

The `model` and `voiceId` strings above are the values researched on 2026-09-28. Task 12 step 1 re-verifies each against the provider's current API (Gemini `models.list`, Inworld voices list, ElevenLabs `/v1/voices`) and updates `model`, `voiceId`, and `verifiedOn` before the shootout runs.

- [ ] **Step 4: Run test, commit**

Run: `vp test convex/shared/voices.test.ts` → PASS.

```bash
git add convex/shared/voices.ts convex/shared/voices.test.ts
git commit -m "feat(shared): TTS voice catalog"
```

---

### Task 2: Settings module and house voice (`convex/settings.ts`)

**Files:**
- Create: `convex/settings.ts`
- Test: `convex/settings.test.ts`
- Modify: `harness/modules.ts`

**Interfaces:**
- Produces internal query `settings.get({ key })` → `string | null`; internal mutation `settings.set({ key, value })`; Clerk query `settings.houseVoice({})` → `{ voiceId: string | null }`; Clerk mutation `settings.setHouseVoice({ voiceId, devBypassSecret? })` which validates against `VOICE_IDS`.

- [ ] **Step 1: Write the failing test**

```ts
// convex/settings.test.ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";

describe("settings", () => {
  test("get returns null until set; set upserts by key", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(internal.settings.get, { key: "houseVoiceId" })).toBeNull();
    await t.mutation(internal.settings.set, { key: "houseVoiceId", value: "breeze-2" });
    await t.mutation(internal.settings.set, { key: "houseVoiceId", value: "inworld-max" });
    expect(await t.query(internal.settings.get, { key: "houseVoiceId" })).toBe("inworld-max");
    const rows = await t.run((ctx) => ctx.db.query("settings").collect());
    expect(rows).toHaveLength(1);
  });

  test("setHouseVoice rejects unknown voices", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.settings.setHouseVoiceInternal, { voiceId: "kokoro" }),
    ).rejects.toThrow(/unknown voice/);
    await t.mutation(internal.settings.setHouseVoiceInternal, { voiceId: "gemini-flash-tts" });
    expect(await t.query(internal.settings.get, { key: "houseVoiceId" })).toBe("gemini-flash-tts");
  });
});
```

- [ ] **Step 2: Run test to verify it fails** → FAIL, module not found.

- [ ] **Step 3: Write the module**

```ts
// convex/settings.ts
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireAuth } from "./auth";
import { voiceById } from "./shared/voices";

export const HOUSE_VOICE_KEY = "houseVoiceId";

async function readSetting(ctx: QueryCtx, key: string): Promise<string | null> {
  const row = await ctx.db.query("settings").withIndex("by_key", (q) => q.eq("key", key)).unique();
  return row?.value ?? null;
}

async function writeSetting(ctx: MutationCtx, key: string, value: string): Promise<void> {
  const row = await ctx.db.query("settings").withIndex("by_key", (q) => q.eq("key", key)).unique();
  const updatedAt = Date.now();
  if (row) await ctx.db.patch(row._id, { value, updatedAt });
  else await ctx.db.insert("settings", { key, value, updatedAt });
}

export const get = internalQuery({
  args: { key: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => readSetting(ctx, args.key),
});

export const set = internalMutation({
  args: { key: v.string(), value: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await writeSetting(ctx, args.key, args.value);
    return null;
  },
});

export const houseVoice = query({
  args: { devBypassSecret: v.optional(v.string()) },
  returns: v.object({ voiceId: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return { voiceId: await readSetting(ctx, HOUSE_VOICE_KEY) };
  },
});

export const setHouseVoiceInternal = internalMutation({
  args: { voiceId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    voiceById(args.voiceId); // throws on unknown
    await writeSetting(ctx, HOUSE_VOICE_KEY, args.voiceId);
    return null;
  },
});

// Explicit human choice; the system never auto-selects the house voice.
export const setHouseVoice = mutation({
  args: { voiceId: v.string(), devBypassSecret: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    voiceById(args.voiceId);
    await writeSetting(ctx, HOUSE_VOICE_KEY, args.voiceId);
    return null;
  },
});
```

- [ ] **Step 4: Register, test, commit**

Add `"./settings.ts": () => import("../convex/settings"),` to `harness/modules.ts`.
Run: `vp test convex/settings.test.ts` → PASS.

```bash
git add convex/settings.ts convex/settings.test.ts harness/modules.ts
git commit -m "feat(convex): settings with explicit house voice selection"
```

---

### Task 3: Job kinds `narrate`, `shootout`, `assembleEpisode` (contracts and effects)

**Files:**
- Modify: `convex/shared/mediaJobs.ts` (kinds, inputs, results)
- Modify: `convex/mediaJobEffects.ts` (effects)
- Test: `convex/shared/mediaJobs.test.ts` (extend), `convex/mediaJobEffects.test.ts` (new)

**Interfaces:**
- Inputs:
  - `narrate`: `{ kind, scriptArtifactId? , script: { paragraphs: string[], chapters: { title, startParagraph }[] }, voiceId, promptVersion, target: "spoken", title, access: "feed" | "private", refs, assembleOnDone: boolean, episodeTitle?, rendererVersion }`
  - `shootout`: `{ kind, passage: string[], voiceIds: string[], title, rendererVersion }`
  - `assembleEpisode`: `{ kind, narrationArtifactId, title, chapters, rendererVersion }`
- Results:
  - `narrate`: `{ kind, artifacts: ArtifactResult[], chapters: { title, startSecs }[] }`
  - `shootout`: `{ kind, takes: { voiceId, artifact: ArtifactResult, label }[], skippedVoiceIds: string[], episode: ArtifactResult, memberOrder: string[] }`
  - `assembleEpisode`: `{ kind, artifacts: ArtifactResult[] }`
- Effects: `narrate` marks artifacts ready, stores chapters on the delivery artifact, and when `assembleOnDone` enqueues `assembleEpisode` in the same mutation; `shootout` marks takes and the episode ready, creates the blind group over the takes in `memberOrder` with labels "take one".."take N", stores the episode with `access: "feed"`; `assembleEpisode` marks the episode ready with `access: "feed"` and chapters.

- [ ] **Step 1: Extend contract tests**

Append to `convex/shared/mediaJobs.test.ts`:

```ts
  test("narrate, shootout, and assembleEpisode inputs validate", () => {
    expect(
      mediaJobInputZ.safeParse({
        kind: "narrate",
        script: { paragraphs: ["Hello.", "World."], chapters: [{ title: "Open", startParagraph: 0 }] },
        voiceId: "inworld-max", promptVersion: "narration.v1", target: "spoken",
        title: "Weekly turn, week of 2026-09-21", access: "feed", refs: {}, assembleOnDone: true,
        episodeTitle: "Weekly turn, week of 2026-09-21", rendererVersion: "0.2.0",
      }).success,
    ).toBe(true);
    expect(
      mediaJobInputZ.safeParse({ kind: "shootout", passage: ["a"], voiceIds: [], title: "t", rendererVersion: "x" }).success,
    ).toBe(false);
    expect(
      mediaJobInputZ.safeParse({ kind: "assembleEpisode", narrationArtifactId: "k1", narrationStorageUrl: "http://convex.test/api/storage/x", title: "t", chapters: [], rendererVersion: "x" }).success,
    ).toBe(true);
  });
```

- [ ] **Step 2: Write the effects test**

```ts
// convex/mediaJobEffects.test.ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";

async function attached(t: ReturnType<typeof convexTest>, jobId: string, kind: "narration" | "shootoutTake" | "episode", title: string) {
  const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
    fields: {
      kind, role: "delivery", metadataStripped: true, status: "pending",
      encoding: { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 },
      normalization: "applied", access: "private", title, refs: { mediaJobId: jobId as never },
      contentHash: title, createdBy: "system",
    },
  });
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob([title])));
  await t.mutation(internal.audioArtifacts.attachStorage, { artifactId, storageId });
  return artifactId;
}
const measured = (artifactId: string) => ({ artifactId: artifactId as never, durationSecs: 10, loudnessLufs: -16, truePeakDbtp: -1.3, mimeType: "audio/mpeg" });

describe("media job effects", () => {
  test("narrate with assembleOnDone stores chapters and enqueues assembleEpisode atomically", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: {
        kind: "narrate", script: { paragraphs: ["a", "b"], chapters: [{ title: "Open", startParagraph: 0 }] },
        voiceId: "inworld-max", promptVersion: "narration.v1", target: "spoken", title: "Brief",
        access: "feed", refs: {}, assembleOnDone: true, episodeTitle: "Weekly turn, week of 2026-09-21", rendererVersion: "0.2.0",
      },
    });
    const claim = await t.mutation(internal.mediaJobs.claimNext, { workerId: "w", kinds: ["narrate"] });
    const narration = await attached(t, jobId, "narration", "Brief");
    await t.mutation(internal.mediaJobs.complete, {
      jobId, leaseToken: claim!.leaseToken,
      result: { kind: "narrate", artifacts: [measured(narration)], chapters: [{ title: "Open", startSecs: 0 }] },
    });
    const row = await t.run((ctx) => ctx.db.get(narration));
    expect(row?.chapters).toEqual([{ title: "Open", startSecs: 0 }]);
    const queued = await t.run((ctx) => ctx.db.query("mediaJobs").withIndex("by_status_priority_createdAt", (q) => q.eq("status", "queued")).collect());
    expect(queued).toHaveLength(1);
    expect(queued[0]?.input).toMatchObject({
      kind: "assembleEpisode", narrationArtifactId: narration, title: "Weekly turn, week of 2026-09-21",
      narrationStorageUrl: expect.stringMatching(/^https?:\/\//),
    });
  });

  test("shootout creates a blind group over the takes in member order and publishes the episode to the feed", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, {
      input: { kind: "shootout", passage: ["p"], voiceIds: ["inworld-max", "breeze-2", "gemini-flash-tts"], title: "Shootout", rendererVersion: "0.2.0" },
    });
    const claim = await t.mutation(internal.mediaJobs.claimNext, { workerId: "w", kinds: ["shootout"] });
    const a = await attached(t, jobId, "shootoutTake", "inworld");
    const aMaster = await attached(t, jobId, "shootoutTake", "inworld-master");
    const b = await attached(t, jobId, "shootoutTake", "breeze");
    const bMaster = await attached(t, jobId, "shootoutTake", "breeze-master");
    const episode = await attached(t, jobId, "episode", "Shootout");
    const episodeMaster = await attached(t, jobId, "episode", "Shootout-master");
    await t.mutation(internal.mediaJobs.complete, {
      jobId, leaseToken: claim!.leaseToken,
      result: {
        kind: "shootout",
        takes: [
          { voiceId: "inworld-max", artifact: measured(a), master: measured(aMaster), label: "take two" },
          { voiceId: "breeze-2", artifact: measured(b), master: measured(bMaster), label: "take one" },
        ],
        skippedVoiceIds: ["gemini-flash-tts"],
        episode: measured(episode),
        episodeMaster: measured(episodeMaster),
        memberOrder: ["breeze-2", "inworld-max"],
      },
    });
    for (const id of [aMaster, bMaster, episodeMaster]) {
      expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("ready");
    }
    const groups = await t.run((ctx) => ctx.db.query("blindGroups").collect());
    expect(groups).toHaveLength(1);
    expect(groups[0]?.members.map((m) => m.label)).toEqual(["take one", "take two"]);
    expect(groups[0]?.members.map((m) => m.artifactId)).toEqual([b, a]);
    expect(groups[0]?.requiredRatings).toHaveLength(2);
    const ep = await t.run((ctx) => ctx.db.get(episode));
    expect(ep?.access).toBe("feed");
    expect(ep?.blindGroupId).toBe(groups[0]?._id);
    const take = await t.run((ctx) => ctx.db.get(a));
    expect(take?.voice?.catalogId).toBe("inworld-max");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail** → FAIL (unknown kinds).

- [ ] **Step 4: Extend the contracts**

In `convex/shared/mediaJobs.ts` replace the `MEDIA_JOB_KINDS`/inputs/results section:

```ts
export const MEDIA_JOB_KINDS = ["probe", "narrate", "shootout", "assembleEpisode"] as const;

export const scriptChapterZ = z.object({ title: z.string().min(1), startParagraph: z.number().int().min(0) });
export const narrationScriptZ = z.object({
  paragraphs: z.array(z.string().min(1)).min(1),
  chapters: z.array(scriptChapterZ),
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
});

export const assembleEpisodeJobInputZ = z.object({
  kind: z.literal("assembleEpisode"),
  narrationArtifactId: zid("audioArtifacts"),
  narrationStorageUrl: z.string().url(), // filled by the narrate effect from ctx.storage.getUrl
  title: z.string().min(1),
  chapters: z.array(audioChapterZ),
  rendererVersion: z.string().min(1),
});

export const mediaJobInputZ = z.discriminatedUnion("kind", [
  probeJobInputZ, narrateJobInputZ, shootoutJobInputZ, assembleEpisodeJobInputZ,
]);

export const narrateJobResultZ = z.object({
  kind: z.literal("narrate"),
  artifacts: z.array(artifactResultZ).min(1),
  chapters: z.array(audioChapterZ),
});
export const shootoutJobResultZ = z.object({
  kind: z.literal("shootout"),
  // artifact is the delivery (the blind member); master is its normalized WAV.
  takes: z.array(z.object({ voiceId: z.string(), artifact: artifactResultZ, master: artifactResultZ, label: z.string() })).min(1),
  skippedVoiceIds: z.array(z.string()),
  episode: artifactResultZ,
  episodeMaster: artifactResultZ,
  memberOrder: z.array(z.string()).min(1),
});
export const assembleEpisodeJobResultZ = z.object({
  kind: z.literal("assembleEpisode"),
  artifacts: z.array(artifactResultZ).min(1),
});
export const mediaJobResultZ = z.discriminatedUnion("kind", [
  probeJobResultZ, narrateJobResultZ, shootoutJobResultZ, assembleEpisodeJobResultZ,
]);
```

Import `audioRefsZ` and `audioChapterZ` from `./audioArtifacts`.

- [ ] **Step 5: Extend the effects**

In `convex/mediaJobEffects.ts` add cases (keep `readyArtifacts` from wave 0; the result's `artifacts` field name differs per kind, so pass the right array):

```ts
    case "narrate": {
      const ids = await readyArtifacts(ctx, job, result.artifacts);
      const delivery = ids.at(-1)!;
      await ctx.db.patch(delivery, { chapters: result.chapters, updatedAt: Date.now() });
      if (job.input.kind === "narrate" && job.input.assembleOnDone) {
        const deliveryRow = await ctx.db.get(delivery);
        const narrationStorageUrl = deliveryRow?.storageId ? await ctx.storage.getUrl(deliveryRow.storageId) : null;
        if (!narrationStorageUrl) throw new ConvexError({ code: "INVALID_STATE", message: "narration delivery has no storage url" });
        await ctx.runMutation(internal.mediaJobs.enqueue, {
          input: {
            kind: "assembleEpisode",
            narrationArtifactId: delivery,
            narrationStorageUrl,
            title: job.input.episodeTitle ?? job.input.title,
            chapters: result.chapters,
            rendererVersion: job.input.rendererVersion,
          },
        });
      }
      return ids;
    }
    case "shootout": {
      if (job.input.kind !== "shootout") throw new ConvexError({ code: "INVALID_ARGUMENT", message: "job/result kind mismatch" });
      await readyArtifacts(ctx, job, [...result.takes.map((take) => take.master), result.episodeMaster]);
      const takeIds = await readyArtifacts(ctx, job, result.takes.map((take) => take.artifact));
      const byVoice = new Map<string, Id<"audioArtifacts">>();
      result.takes.forEach((take, index) => {
        byVoice.set(take.voiceId, takeIds[index]!);
      });
      for (const take of result.takes) {
        await ctx.db.patch(byVoice.get(take.voiceId)!, {
          voice: { catalogId: take.voiceId, promptVersion: "shootout.v1" },
          updatedAt: Date.now(),
        });
      }
      const [episodeId] = await readyArtifacts(ctx, job, [result.episode]);
      await ctx.db.patch(episodeId!, { access: "feed", updatedAt: Date.now() });
      const members = result.memberOrder.map((voiceId, index) => {
        const artifactId = byVoice.get(voiceId);
        if (!artifactId) throw new ConvexError({ code: "INVALID_ARGUMENT", message: `memberOrder names unrendered voice ${voiceId}` });
        return { artifactId, label: `take ${ORDINALS[index] ?? String(index + 1)}` };
      });
      const { groupId } = await ctx.runMutation(internal.blindGroups.create, { purpose: "voiceShootout", members });
      await ctx.db.patch(episodeId!, { blindGroupId: groupId });
      return [...takeIds, episodeId!];
    }
    case "assembleEpisode": {
      const ids = await readyArtifacts(ctx, job, result.artifacts);
      if (job.input.kind !== "assembleEpisode") throw new ConvexError({ code: "INVALID_ARGUMENT", message: "job/result kind mismatch" });
      for (const id of ids) {
        await ctx.db.patch(id, { access: "feed", chapters: job.input.chapters, title: job.input.title, updatedAt: Date.now() });
      }
      return ids;
    }
```

with `const ORDINALS = ["one", "two", "three", "four", "five", "six"];` at module top. Note: the episode artifact is NOT tagged with `blindGroupId` (wave 0's `podcast.listFeedEpisodes` hides any row that carries one, and `blindGroups.create` rejects non-private members); only the takes are members. The episode's link to its group is the shared `refs.mediaJobId` of the shootout job, which the `/listen` page uses to pair them.

- [ ] **Step 6: Run tests, commit**

Run: `vp test convex/shared/mediaJobs.test.ts convex/mediaJobEffects.test.ts convex/mediaJobs.test.ts` → PASS.

```bash
git add convex/shared/mediaJobs.ts convex/shared/mediaJobs.test.ts convex/mediaJobEffects.ts convex/mediaJobEffects.test.ts
git commit -m "feat(convex): narrate, shootout, and assembleEpisode job kinds"
```

---

### Task 4: Voice ratings with atomic reveal (`convex/voiceRatings.ts`)

**Files:**
- Modify: `convex/schema.ts` (new table `voiceRatings`)
- Create: `convex/voiceRatings.ts`
- Test: `convex/voiceRatings.test.ts`
- Modify: `harness/modules.ts`

**Interfaces:**
- Table `voiceRatings { groupId, memberId, artifactId, ratings: { naturalness, prosody, clean, clarity, overall }, notes?, createdBy, createdAt }` index `by_groupId_memberId`.
- Clerk mutation `voiceRatings.submit({ groupId, memberId, ratings, notes?, devBypassSecret? })` → `{ revealed: boolean, remaining: number }`; internal `submitInternal` with `createdBy` argument for tests; Clerk query `voiceRatings.forGroup({ groupId })` → rows with `voiceId` only when revealed.

- [ ] **Step 1: Write the failing test**

```ts
// convex/voiceRatings.test.ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";

async function group(t: ReturnType<typeof convexTest>) {
  const make = async (title: string) => {
    const id = await t.mutation(internal.audioArtifacts.createPending, {
      fields: {
        kind: "shootoutTake", role: "delivery", metadataStripped: true, status: "pending",
        encoding: { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 },
        normalization: "applied", access: "private", title, refs: {}, contentHash: title, createdBy: "system",
        voice: { catalogId: title, promptVersion: "shootout.v1" },
      },
    });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([title])));
    await t.mutation(internal.audioArtifacts.attachStorage, { artifactId: id, storageId });
    await t.mutation(internal.audioArtifacts.markReady, { artifactId: id, durationSecs: 90, loudnessLufs: -16, truePeakDbtp: -1.2, mimeType: "audio/mpeg" });
    return id;
  };
  const a = await make("inworld-max");
  const b = await make("breeze-2");
  return await t.mutation(internal.blindGroups.create, {
    purpose: "voiceShootout", members: [{ artifactId: a, label: "take one" }, { artifactId: b, label: "take two" }],
  });
}
const ratings = { naturalness: 4, prosody: 3, clean: 5, clarity: 4, overall: 4 };

describe("voiceRatings", () => {
  test("reveals in the same mutation as the last required rating; repeats are idempotent", async () => {
    const t = convexTest(schema, modules);
    const { groupId, memberIds } = await group(t);
    const first = await t.mutation(internal.voiceRatings.submitInternal, { groupId, memberId: memberIds[0]!, ratings, createdBy: "user_1" });
    expect(first).toEqual({ revealed: false, remaining: 1 });
    const again = await t.mutation(internal.voiceRatings.submitInternal, { groupId, memberId: memberIds[0]!, ratings: { ...ratings, overall: 1 }, createdBy: "user_1" });
    expect(again).toEqual({ revealed: false, remaining: 1 });
    const rows = await t.run((ctx) => ctx.db.query("voiceRatings").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ratings.overall).toBe(4);
    const last = await t.mutation(internal.voiceRatings.submitInternal, { groupId, memberId: memberIds[1]!, ratings, createdBy: "user_1" });
    expect(last).toEqual({ revealed: true, remaining: 0 });
    const projection = await t.query(internal.blindGroups.projectionInternal, { groupId });
    expect(projection.revealed).toBe(true);
    const forGroup = await t.query(internal.voiceRatings.forGroupInternal, { groupId });
    expect(forGroup.map((row) => row.voiceId).toSorted()).toEqual(["breeze-2", "inworld-max"]);
  });

  test("rejects out-of-range values and unknown members, and hides voiceId before reveal", async () => {
    const t = convexTest(schema, modules);
    const { groupId, memberIds } = await group(t);
    await expect(
      t.mutation(internal.voiceRatings.submitInternal, { groupId, memberId: memberIds[0]!, ratings: { ...ratings, clean: 6 }, createdBy: "user_1" }),
    ).rejects.toThrow(/between 0 and 5/);
    await expect(
      t.mutation(internal.voiceRatings.submitInternal, { groupId, memberId: "nope", ratings, createdBy: "user_1" }),
    ).rejects.toThrow(/member/);
    await t.mutation(internal.voiceRatings.submitInternal, { groupId, memberId: memberIds[0]!, ratings, createdBy: "user_1" });
    const rows = await t.query(internal.voiceRatings.forGroupInternal, { groupId });
    expect(rows[0]?.voiceId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.

- [ ] **Step 3: Schema and module**

Add to `convex/schema.ts` after `settings`:

```ts
  voiceRatings: defineTable({
    groupId: v.id("blindGroups"),
    memberId: v.string(),
    artifactId: v.id("audioArtifacts"),
    ratings: v.object({
      naturalness: v.number(),
      prosody: v.number(),
      clean: v.number(),
      clarity: v.number(),
      overall: v.number(),
    }),
    notes: v.optional(v.string()),
    createdBy: v.union(v.id("users"), v.string()),
    createdAt: v.number(),
  }).index("by_groupId_memberId", ["groupId", "memberId"]),
```

```ts
// convex/voiceRatings.ts
// Shootout ratings. The last required rating reveals the group in the same
// mutation. Choosing the house voice is a separate explicit act (settings).
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { requireAuth } from "./auth";

const ratingsValidator = v.object({
  naturalness: v.number(), prosody: v.number(), clean: v.number(), clarity: v.number(), overall: v.number(),
});
const RATING_KEYS = ["naturalness", "prosody", "clean", "clarity", "overall"] as const;
const submitReturn = v.object({ revealed: v.boolean(), remaining: v.number() });

function assertRatings(ratings: Record<(typeof RATING_KEYS)[number], number>): void {
  for (const key of RATING_KEYS) {
    const value = ratings[key];
    if (!Number.isFinite(value) || value < 0 || value > 5) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: `${key} must be between 0 and 5`, field: key });
    }
  }
}

async function submitCore(
  ctx: MutationCtx,
  args: { groupId: Id<"blindGroups">; memberId: string; ratings: Record<(typeof RATING_KEYS)[number], number>; notes?: string; createdBy: string },
) {
  assertRatings(args.ratings);
  const group = await ctx.db.get(args.groupId);
  if (!group) throw new ConvexError({ code: "NOT_FOUND", message: "Blind group not found" });
  const member = group.members.find((row) => row.memberId === args.memberId);
  if (!member || !group.requiredRatings.includes(args.memberId)) {
    throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Unknown member for this group" });
  }
  const existing = await ctx.db
    .query("voiceRatings")
    .withIndex("by_groupId_memberId", (q) => q.eq("groupId", args.groupId).eq("memberId", args.memberId))
    .first();
  if (!existing) {
    await ctx.db.insert("voiceRatings", {
      groupId: args.groupId, memberId: args.memberId, artifactId: member.artifactId,
      ratings: args.ratings, notes: args.notes, createdBy: args.createdBy as Id<"users">, createdAt: Date.now(),
    });
  }
  const rated = await ctx.db.query("voiceRatings").withIndex("by_groupId_memberId", (q) => q.eq("groupId", args.groupId)).collect();
  const ratedIds = new Set(rated.map((row) => row.memberId));
  const remaining = group.requiredRatings.filter((id) => !ratedIds.has(id)).length;
  if (remaining === 0) await ctx.runMutation(internal.blindGroups.reveal, { groupId: args.groupId });
  return { revealed: remaining === 0, remaining };
}

export const submitInternal = internalMutation({
  args: { groupId: v.id("blindGroups"), memberId: v.string(), ratings: ratingsValidator, notes: v.optional(v.string()), createdBy: v.string() },
  returns: submitReturn,
  handler: async (ctx, args) => submitCore(ctx, args),
});

export const submit = mutation({
  args: { groupId: v.id("blindGroups"), memberId: v.string(), ratings: ratingsValidator, notes: v.optional(v.string()), devBypassSecret: v.optional(v.string()) },
  returns: submitReturn,
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx, args);
    return await submitCore(ctx, { ...args, createdBy: identity.subject });
  },
});

async function forGroupCore(ctx: QueryCtx, groupId: Id<"blindGroups">) {
  const group = await ctx.db.get(groupId);
  if (!group) return [];
  const revealed = group.revealedAt !== undefined;
  const rows = await ctx.db.query("voiceRatings").withIndex("by_groupId_memberId", (q) => q.eq("groupId", groupId)).collect();
  const result = [];
  for (const row of rows) {
    const artifact = revealed ? await ctx.db.get(row.artifactId) : null;
    result.push({
      memberId: row.memberId, ratings: row.ratings, notes: row.notes, createdAt: row.createdAt,
      ...(artifact?.voice ? { voiceId: artifact.voice.catalogId } : {}),
    });
  }
  return result;
}

export const forGroupInternal = internalQuery({
  args: { groupId: v.id("blindGroups") },
  handler: async (ctx, args) => forGroupCore(ctx, args.groupId),
});

export const forGroup = query({
  args: { groupId: v.id("blindGroups"), devBypassSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await forGroupCore(ctx, args.groupId);
  },
});
```

- [ ] **Step 4: Register, test, commit**

Add `"./voiceRatings.ts": () => import("../convex/voiceRatings"),` to `harness/modules.ts`.
Run: `vp test convex/voiceRatings.test.ts convex/schemaMedia.test.ts` → PASS.

```bash
git add convex/schema.ts convex/voiceRatings.ts convex/voiceRatings.test.ts harness/modules.ts
git commit -m "feat(convex): voice ratings with atomic reveal"
```

---

### Task 5: Narration script builder (`convex/narration.ts`)

**Files:**
- Create: `convex/narration.ts`, `convex/narrationPrompt.ts`, `media/fixtures/calibration-passage.md`
- Test: `convex/narration.test.ts`
- Modify: `convex/llm.ts` (`TOKEN_BUDGETS.narration_v1: 6000`)
- Modify: `harness/modules.ts`

**Interfaces:**
- `NARRATION_PROMPT_VERSION = "narration.v1"`, `buildNarrationPrompt({ kind: "weeklyBrief" | "docket" | "passage", bodyMd, studioPrompts?, targetMinutes })` → `{ system, prompt }`; `parseNarrationScript(text)` → `NarrationScript` (throws on markdown residue or empty chapters); `scriptWordCount(script)`; internal action `narration.buildScriptForBrief({ briefId, model? })` → `NarrationScript`; `calibrationPassage()` → `NarrationScript` from the fixture.

- [ ] **Step 1: Write the failing test**

```ts
// convex/narration.test.ts
import { describe, expect, test } from "vite-plus/test";
import { buildNarrationPrompt, NARRATION_PROMPT_VERSION, parseNarrationScript, scriptWordCount } from "./narrationPrompt";

describe("narration prompt", () => {
  test("prompt names the target length and forbids markdown", () => {
    const { system, prompt } = buildNarrationPrompt({ kind: "weeklyBrief", bodyMd: "# Brief\n- item", targetMinutes: 10, studioPrompts: { tenMin: "a", thirtyMin: "b", ninetyMin: "c" } });
    expect(system).toMatch(/no headers|no markdown/i);
    expect(prompt).toContain("1500 words");
    expect(prompt).toContain("[pause]");
    expect(NARRATION_PROMPT_VERSION).toBe("narration.v1");
  });

  test("parser splits paragraphs on [pause], reads the chapter block, rejects markdown residue", () => {
    const text = [
      "Welcome to the weekly turn.",
      "[pause]",
      "First experiment: the fifth against the third.",
      "[pause]",
      "Studio prompts. Ten minutes: tune one drone.",
      "",
      "CHAPTERS",
      "0: Welcome",
      "1: Experiments",
      "2: Studio prompts",
    ].join("\n");
    const script = parseNarrationScript(text);
    expect(script.paragraphs).toHaveLength(3);
    expect(script.chapters).toEqual([
      { title: "Welcome", startParagraph: 0 },
      { title: "Experiments", startParagraph: 1 },
      { title: "Studio prompts", startParagraph: 2 },
    ]);
    expect(scriptWordCount(script)).toBeGreaterThan(10);
    expect(() => parseNarrationScript("## Heading\n[pause]\nx\n\nCHAPTERS\n0: a")).toThrow(/markdown/);
    expect(() => parseNarrationScript("plain\n")).toThrow(/CHAPTERS/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.

- [ ] **Step 3: Prompt and parser (pure, V8-safe)**

```ts
// convex/narrationPrompt.ts
import type { NarrationScript } from "./shared/mediaJobs";

export const NARRATION_PROMPT_VERSION = "narration.v1";
const WORDS_PER_MINUTE = 150;

export function buildNarrationPrompt(args: {
  kind: "weeklyBrief" | "docket" | "passage";
  bodyMd: string;
  targetMinutes: number;
  studioPrompts?: { tenMin: string; thirtyMin: string; ninetyMin: string };
}): { system: string; prompt: string } {
  const words = args.targetMinutes * WORDS_PER_MINUTE;
  const system = [
    "You write spoken-word scripts for a podcast narrator. Output plain prose only: no headers, no markdown, no lists, no links, no code, no asterisks.",
    "Speak numbers as a reader would (\"four hundred and thirty-two hertz\"). Speak ratios as \"three to two\".",
    "Separate paragraphs with a line containing only [pause].",
    "End with a line CHAPTERS followed by one line per chapter in the form <paragraph index>: <title>, starting at 0.",
  ].join(" ");
  const closing = args.studioPrompts
    ? `\n\nClose with a chapter titled Studio prompts that reads these three options aloud, each as one or two sentences:\nTen minutes: ${args.studioPrompts.tenMin}\nThirty minutes: ${args.studioPrompts.thirtyMin}\nNinety minutes: ${args.studioPrompts.ninetyMin}`
    : "";
  const prompt = `Turn the following ${args.kind === "weeklyBrief" ? "weekly brief" : args.kind} into a script of about ${words} words (${args.targetMinutes} minutes at ${WORDS_PER_MINUTE} words per minute). Keep at most three experiment cards; state the stake of each in its first sentence.${closing}\n\nSOURCE:\n${args.bodyMd}`;
  return { system, prompt };
}

const MARKDOWN_RESIDUE = /^(#{1,6}\s|[-*]\s|\d+\.\s|>|```)|\*\*|\[[^\]]+\]\(/m;

export function parseNarrationScript(text: string): NarrationScript {
  const marker = text.lastIndexOf("\nCHAPTERS");
  if (marker < 0) throw new Error("script is missing the CHAPTERS block");
  const body = text.slice(0, marker).trim();
  const chapterLines = text.slice(marker + "\nCHAPTERS".length).trim().split("\n").filter(Boolean);
  if (MARKDOWN_RESIDUE.test(body)) throw new Error("script contains markdown residue");
  const paragraphs = body
    .split(/\n\s*\[pause\]\s*\n/)
    .map((paragraph) => paragraph.replaceAll(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  if (paragraphs.length === 0) throw new Error("script has no paragraphs");
  const chapters = chapterLines.map((line) => {
    const match = line.match(/^(\d+):\s*(.+)$/);
    if (!match) throw new Error(`bad chapter line: ${line}`);
    const startParagraph = Number(match[1]);
    if (startParagraph >= paragraphs.length) throw new Error(`chapter start ${startParagraph} beyond paragraphs`);
    return { title: match[2]!.trim(), startParagraph };
  });
  if (chapters.length === 0) throw new Error("script has no chapters");
  return { paragraphs, chapters };
}

export function scriptWordCount(script: NarrationScript): number {
  return script.paragraphs.reduce((sum, paragraph) => sum + paragraph.split(/\s+/).filter(Boolean).length, 0);
}
```

- [ ] **Step 4: Action and fixture**

```ts
// convex/narration.ts
"use node";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { generateLlmText } from "./llmNode";
import { buildNarrationPrompt, NARRATION_PROMPT_VERSION, parseNarrationScript, scriptWordCount } from "./narrationPrompt";
import { narrationScriptZ, type NarrationScript } from "./shared/mediaJobs";

const BRIEF_TARGET_MINUTES = 11;
const BRIEF_MIN_WORDS = 1200;
const BRIEF_MAX_WORDS = 2100;

export const buildScriptForBrief = internalAction({
  args: { briefId: v.id("weeklyBriefs"), model: v.optional(v.string()) },
  handler: async (ctx, args): Promise<NarrationScript> => {
    const brief = await ctx.runQuery(internal.weeklyBriefs.getInternal, { briefId: args.briefId });
    if (!brief) throw new Error("brief not found");
    const { system, prompt } = buildNarrationPrompt({
      kind: "weeklyBrief",
      bodyMd: brief.bodyMd,
      targetMinutes: BRIEF_TARGET_MINUTES,
      studioPrompts: brief.studioPrompts
        ? { tenMin: brief.studioPrompts.tenMinuteMd, thirtyMin: brief.studioPrompts.thirtyMinuteMd, ninetyMin: brief.studioPrompts.ninetyMinuteMd }
        : undefined,
    });
    const { text } = await generateLlmText({
      task: "narration_v1", model: args.model, system, prompt,
      traceName: "narration_v1.brief", metadata: { briefId: args.briefId, promptVersion: NARRATION_PROMPT_VERSION },
    });
    const script = narrationScriptZ.parse(parseNarrationScript(text));
    const words = scriptWordCount(script);
    if (words < BRIEF_MIN_WORDS || words > BRIEF_MAX_WORDS) {
      throw new Error(`script is ${words} words; expected ${BRIEF_MIN_WORDS} to ${BRIEF_MAX_WORDS}`);
    }
    return script;
  },
});
```

`weeklyBriefs.ts` has no internal getter by id today (only `loadBriefContext`); add `getInternal = internalQuery({ args: { briefId: v.id("weeklyBriefs") }, handler: (ctx, a) => ctx.db.get(a.briefId) })` there. The studio prompt field names `tenMinuteMd`, `thirtyMinuteMd`, `ninetyMinuteMd` come from `studioPromptVariantsValidator` in `convex/schema.ts`.

`narration.ts` carries `"use node"` because `llmNode.ts` does; a `"use node"` file cannot export queries, so the calibration passage query lives in `narrationPrompt.ts`:

```ts
// append to convex/narrationPrompt.ts
import { internalQuery } from "./_generated/server";

export const CALIBRATION_PASSAGE = `<the exact text of media/fixtures/calibration-passage.md>`;

export const calibrationPassage = internalQuery({
  args: {},
  handler: async () => parseNarrationScript(CALIBRATION_PASSAGE),
});
```

and `convex/narration.test.ts` gains one assertion that `CALIBRATION_PASSAGE` equals `readFileSync("media/fixtures/calibration-passage.md", "utf8").trim()`.

Add `narration_v1: 6000,` to `TOKEN_BUDGETS` in `convex/llm.ts`.

`media/fixtures/calibration-passage.md`: a 90-second passage (about 220 words) in the same plain form with `[pause]` and a CHAPTERS block; content: one paragraph about listening for beating between a just fifth and a tempered fifth, one about a body response, one that reads a tuning ratio and a frequency aloud, chapters "Beating", "Body", "Numbers". Write it as prose, not bullet points; it is checked in and used verbatim by every shootout so takes are comparable across time.

- [ ] **Step 5: Register, test, commit**

Add `"./narration.ts": () => import("../convex/narration"),` and `"./narrationPrompt.ts": () => import("../convex/narrationPrompt"),` to `harness/modules.ts`.
Run: `vp test convex/narration.test.ts convex/llm.test.ts && vp run typecheck:scripts` → PASS.

```bash
git add convex/narration.ts convex/narrationPrompt.ts convex/narration.test.ts convex/llm.ts media/fixtures/calibration-passage.md harness/modules.ts
git commit -m "feat(convex): narration script builder"
```

---

### Task 6: Enqueue narration after brief generation; reconcile cron; shootout enqueue action

**Files:**
- Modify: `convex/weeklyBriefs.ts` (`generateBriefCore` tail), `convex/crons.ts`
- Create: `convex/episodes.ts`
- Test: `convex/episodes.test.ts`
- Modify: `harness/modules.ts`

**Interfaces:**
- Internal action `episodes.narrateBrief({ briefId })` → `{ jobId, created }`: builds the script (Task 5), reads `houseVoiceId` (throws `HOUSE_VOICE_UNSET` when null), enqueues `narrate` with `assembleOnDone: true`, `access: "feed"`, `refs.weeklyBriefId`, `episodeTitle`.
- Internal mutation `episodes.hasReadyEpisodeForBrief({ briefId })` → boolean; internal action `episodes.reconcile({ daysBack: 14 })` enqueues narration for briefs without a ready episode, skipping when the house voice is unset, and never re-enqueues a brief whose narrate job is `parked`.
- Internal action `episodes.enqueueShootout({})` → `{ jobId, created }` using the calibration passage and `VOICE_IDS`.
- `generateBriefCore` schedules `internal.episodes.narrateBrief` via `ctx.scheduler.runAfter(0, ...)` after the brief row is created; a failure to schedule is logged, never thrown.

- [ ] **Step 1: Write the failing test**

```ts
// convex/episodes.test.ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";
import { pickBriefsNeedingNarration, episodeTitleForWeek } from "./episodes";

describe("episodes", () => {
  test("episode title uses the Monday date", () => {
    expect(episodeTitleForWeek("2026-09-21")).toBe("Weekly turn, week of 2026-09-21");
  });

  test("pickBriefsNeedingNarration skips briefs with ready episodes or parked jobs", () => {
    const picked = pickBriefsNeedingNarration({
      briefs: [{ _id: "b1" }, { _id: "b2" }, { _id: "b3" }] as never,
      readyEpisodeBriefIds: new Set(["b1"]),
      parkedBriefIds: new Set(["b3"]),
    });
    expect(picked.map((brief) => brief._id)).toEqual(["b2"]);
  });

  test("hasReadyEpisodeForBrief reads feed episodes by brief ref", async () => {
    const t = convexTest(schema, modules);
    const briefId = await t.run((ctx) =>
      ctx.db.insert("weeklyBriefs", {
        weekOf: "2026-09-21", model: "m", promptVersion: "v", bodyMd: "x", sourceIds: [],
        recommendedHypothesisIds: [], recommendedRecipeIds: [], visibility: "private", createdBy: "system", createdAt: 1,
      }),
    );
    expect(await t.query(internal.episodes.hasReadyEpisodeForBrief, { briefId })).toBe(false);
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["e"]));
      await ctx.db.insert("audioArtifacts", {
        kind: "episode", role: "delivery", metadataStripped: true, status: "ready", storageId,
        encoding: { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 }, normalization: "applied",
        access: "feed", title: "t", refs: { weeklyBriefId: briefId }, contentHash: "c", createdBy: "system", createdAt: 2, updatedAt: 2,
      });
    });
    expect(await t.query(internal.episodes.hasReadyEpisodeForBrief, { briefId })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.

- [ ] **Step 3: Write the module**

```ts
// convex/episodes.ts
// No "use node": the actions here only call ctx.run*, and the file also
// exports a query, which a node file cannot.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalQuery } from "./_generated/server";
import { HOUSE_VOICE_KEY } from "./settings";
import { NARRATION_PROMPT_VERSION } from "./narrationPrompt";
import { VOICE_IDS } from "./shared/voices";
import { RENDERER_VERSION_FOR_JOBS } from "./shared/mediaJobs";

export function episodeTitleForWeek(weekOf: string): string {
  return `Weekly turn, week of ${weekOf}`;
}

export function pickBriefsNeedingNarration(args: {
  briefs: Doc<"weeklyBriefs">[];
  readyEpisodeBriefIds: Set<string>;
  parkedBriefIds: Set<string>;
}): Doc<"weeklyBriefs">[] {
  return args.briefs.filter(
    (brief) => !args.readyEpisodeBriefIds.has(brief._id) && !args.parkedBriefIds.has(brief._id),
  );
}

export const hasReadyEpisodeForBrief = internalQuery({
  args: { briefId: v.id("weeklyBriefs") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const episodes = await ctx.db
      .query("audioArtifacts")
      .withIndex("by_access_kind_createdAt", (q) => q.eq("access", "feed").eq("kind", "episode"))
      .order("desc")
      .take(200);
    return episodes.some((row) => row.status === "ready" && row.refs.weeklyBriefId === args.briefId);
  },
});

export const narrateBrief = internalAction({
  args: { briefId: v.id("weeklyBriefs") },
  returns: v.object({ jobId: v.id("mediaJobs"), created: v.boolean() }),
  handler: async (ctx, args) => {
    const voiceId = await ctx.runQuery(internal.settings.get, { key: HOUSE_VOICE_KEY });
    if (!voiceId) throw new Error("HOUSE_VOICE_UNSET: choose a house voice on /listen first");
    const brief = await ctx.runQuery(internal.weeklyBriefs.getInternal, { briefId: args.briefId });
    if (!brief) throw new Error("brief not found");
    const script = await ctx.runAction(internal.narration.buildScriptForBrief, { briefId: args.briefId });
    const title = episodeTitleForWeek(brief.weekOf);
    return await ctx.runMutation(internal.mediaJobs.enqueue, {
      input: {
        kind: "narrate", script, voiceId, promptVersion: NARRATION_PROMPT_VERSION, target: "spoken",
        title, access: "feed", refs: { weeklyBriefId: args.briefId }, assembleOnDone: true,
        episodeTitle: title, rendererVersion: RENDERER_VERSION_FOR_JOBS,
      },
    });
  },
});

export const reconcile = internalAction({
  args: { daysBack: v.optional(v.number()) },
  returns: v.object({ enqueued: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    const voiceId = await ctx.runQuery(internal.settings.get, { key: HOUSE_VOICE_KEY });
    if (!voiceId) return { enqueued: 0, skipped: 0 };
    const since = Date.now() - (args.daysBack ?? 14) * 24 * 60 * 60 * 1000;
    const briefs = await ctx.runQuery(internal.weeklyBriefs.listSinceInternal, { since });
    let enqueued = 0;
    let skipped = 0;
    for (const brief of briefs) {
      const has = await ctx.runQuery(internal.episodes.hasReadyEpisodeForBrief, { briefId: brief._id });
      const parked = await ctx.runQuery(internal.mediaJobs.isParkedForBrief, { briefId: brief._id });
      if (has || parked) { skipped++; continue; }
      const { created } = await ctx.runAction(internal.episodes.narrateBrief, { briefId: brief._id });
      if (created) enqueued++; else skipped++;
    }
    return { enqueued, skipped };
  },
});

export const enqueueShootout = internalAction({
  args: {},
  returns: v.object({ jobId: v.id("mediaJobs"), created: v.boolean() }),
  handler: async (ctx) => {
    const passage = await ctx.runQuery(internal.narrationPrompt.calibrationPassage, {});
    return await ctx.runMutation(internal.mediaJobs.enqueue, {
      input: { kind: "shootout", passage: passage.paragraphs, voiceIds: [...VOICE_IDS], title: "Voice shootout", rendererVersion: RENDERER_VERSION_FOR_JOBS },
      priority: -1,
    });
  },
});
```

Supporting additions this step also makes:
- `convex/shared/mediaJobs.ts`: `export const RENDERER_VERSION_FOR_JOBS = "0.2.0";` (the media package's `RENDERER_VERSION` is bumped to the same string in Task 7; a job snapshot records which renderer it expects).
- `convex/weeklyBriefs.ts`: `getInternal` (by id) and `listSinceInternal({ since })` internal queries if absent.
- `convex/mediaJobs.ts`: `isParkedForBrief({ briefId })` internal query: scans parked jobs of kind `narrate` (index `by_status_priority_createdAt` with status `parked`, take 200) and matches `input.refs.weeklyBriefId`.
- In `generateBriefCore` after `const briefId = await ctx.runMutation(internal.weeklyBriefs.create, ...)`:

```ts
  try {
    await ctx.scheduler.runAfter(0, internal.episodes.narrateBrief, { briefId });
  } catch (error) {
    console.warn("narration scheduling failed", error instanceof Error ? error.message : String(error));
  }
```

- `convex/crons.ts`:

```ts
// Narration is enqueued by brief generation itself; this only reconciles
// briefs that missed it (worker down, house voice chosen later).
crons.weekly(
  "reconcile-episodes",
  { dayOfWeek: "saturday", hourUTC: 2, minuteUTC: 0 },
  internal.episodes.reconcile,
  { daysBack: 14 },
);
```

- [ ] **Step 4: Register, test, commit**

Add `"./episodes.ts": () => import("../convex/episodes"),` to `harness/modules.ts`.
Run: `vp test convex/episodes.test.ts convex/weeklyBriefs.test.ts && vp run typecheck:scripts` → PASS.

```bash
git add convex/episodes.ts convex/episodes.test.ts convex/weeklyBriefs.ts convex/crons.ts convex/mediaJobs.ts convex/narrationPrompt.ts convex/shared/mediaJobs.ts harness/modules.ts
git commit -m "feat(convex): narrate briefs on generation, reconcile weekly, enqueue shootout"
```

---

### Task 7: TTS providers in `media/`

**Files:**
- Create: `media/src/tts/types.ts`, `media/src/tts/chunk.ts`, `media/src/tts/gemini.ts`, `media/src/tts/inworld.ts`, `media/src/tts/elevenlabs.ts`, `media/src/tts/openaiCompatible.ts`, `media/src/tts/index.ts`
- Test: `media/tests/chunk.test.ts`, `media/tests/tts-providers.test.ts`
- Modify: `media/.env.schema` (keys), `media/src/config.ts` (`RENDERER_VERSION = "0.2.0"`)

**Interfaces:**
- `TtsProvider = { id: VoiceProvider, synthesize(text: string, voice: VoiceEntry, outputPath: string): Promise<void> }` writing a WAV (any sample rate; the pipeline resamples). `providerFor(voice)`; `isConfigured(voice): boolean` (key present, and base URL for local). `chunkForLimit(paragraph, maxChars)` → string[] splitting at sentence boundaries.

- [ ] **Step 1: Write the failing tests**

```ts
// media/tests/chunk.test.ts
import { describe, expect, test } from "vite-plus/test";
import { chunkForLimit } from "../src/tts/chunk";

describe("chunkForLimit", () => {
  test("returns the paragraph whole when under the limit", () => {
    expect(chunkForLimit("One. Two.", 100)).toEqual(["One. Two."]);
  });
  test("splits at sentence boundaries and never truncates", () => {
    const sentence = "This sentence has exactly forty characters!! ";
    const paragraph = sentence.repeat(200).trim();
    const chunks = chunkForLimit(paragraph, 5000);
    expect(chunks.join(" ")).toBe(paragraph);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(5000);
    expect(chunks.length).toBeGreaterThan(1);
  });
  test("a single sentence over the limit splits on whitespace", () => {
    const long = "word ".repeat(2000).trim();
    const chunks = chunkForLimit(long, 5000);
    expect(chunks.join(" ")).toBe(long);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(5000);
  });
});
```

```ts
// media/tests/tts-providers.test.ts
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { voiceById } from "../../convex/shared/voices";
import { isConfigured, providerFor } from "../src/tts";

const dir = mkdtempSync(join(tmpdir(), "tts-"));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("tts providers", () => {
  test("isConfigured reflects key and base url presence", () => {
    expect(isConfigured(voiceById("inworld-max"))).toBe(false);
    vi.stubEnv("INWORLD_API_KEY", "k");
    expect(isConfigured(voiceById("inworld-max"))).toBe(true);
    vi.stubEnv("BREEZE_TTS_API_KEY", "k");
    expect(isConfigured(voiceById("breeze-2"))).toBe(false);
    vi.stubEnv("BREEZE_TTS_BASE_URL", "http://ai-5090-02:8881");
    expect(isConfigured(voiceById("breeze-2"))).toBe(true);
  });

  test("elevenlabs provider posts text with the model id and writes the audio bytes", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "el-key");
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toContain("/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb");
      expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("el-key");
      expect(JSON.parse(String(init.body))).toMatchObject({ text: "Hello there.", model_id: "eleven_v3" });
      return new Response(new Uint8Array([82, 73, 70, 70]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const out = join(dir, "el.wav");
    await providerFor(voiceById("elevenlabs-v3")).synthesize("Hello there.", voiceById("elevenlabs-v3"), out);
    expect(readFileSync(out).subarray(0, 4).toString()).toBe("RIFF");
  });

  test("provider failures retry twice then throw with status only", async () => {
    vi.stubEnv("INWORLD_API_KEY", "k");
    const fetchMock = vi.fn(async () => new Response("secret body k", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      providerFor(voiceById("inworld-max")).synthesize("x", voiceById("inworld-max"), join(dir, "in.wav")),
    ).rejects.toThrow(/500/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expect(
      providerFor(voiceById("inworld-max")).synthesize("x", voiceById("inworld-max"), join(dir, "in.wav")),
    ).rejects.not.toThrow(/secret body/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** → FAIL.

- [ ] **Step 3: Write chunking and shared helpers**

```ts
// media/src/tts/chunk.ts
const SENTENCE_END = /(?<=[.!?])\s+/;

export function chunkForLimit(paragraph: string, maxChars: number): string[] {
  if (paragraph.length <= maxChars) return [paragraph];
  const pieces: string[] = [];
  let current = "";
  const push = () => { if (current) { pieces.push(current); current = ""; } };
  for (const sentence of paragraph.split(SENTENCE_END)) {
    const units = sentence.length > maxChars ? splitOnWhitespace(sentence, maxChars) : [sentence];
    for (const unit of units) {
      if (!current) current = unit;
      else if (current.length + 1 + unit.length <= maxChars) current = `${current} ${unit}`;
      else { push(); current = unit; }
    }
  }
  push();
  return pieces;
}

function splitOnWhitespace(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= maxChars) current = `${current} ${word}`;
    else { out.push(current); current = word; }
  }
  if (current) out.push(current);
  return out;
}
```

```ts
// media/src/tts/types.ts
import type { VoiceEntry, VoiceProvider } from "../../../convex/shared/voices";

export type TtsProvider = {
  id: VoiceProvider;
  maxChars: number;
  synthesize: (text: string, voice: VoiceEntry, outputPath: string) => Promise<void>;
};

export async function fetchAudioWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3,
): Promise<ArrayBuffer> {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url, init);
    if (response.ok) return await response.arrayBuffer();
    lastStatus = response.status;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
  }
  throw new Error(`TTS request failed with status ${lastStatus}`);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
```

- [ ] **Step 4: Write the four providers**

```ts
// media/src/tts/elevenlabs.ts
import { writeFile } from "node:fs/promises";
import type { TtsProvider } from "./types";
import { fetchAudioWithRetry, requireEnv } from "./types";

export const elevenlabs: TtsProvider = {
  id: "elevenlabs",
  maxChars: 5000,
  async synthesize(text, voice, outputPath) {
    const key = requireEnv(voice.keyEnvVar);
    const bytes = await fetchAudioWithRetry(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}?output_format=pcm_24000`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/wav" },
        body: JSON.stringify({ text, model_id: voice.model }),
      },
    );
    await writeFile(outputPath, wrapPcmAsWav(new Uint8Array(bytes), 24000, 1));
  },
};

// ElevenLabs pcm_* formats are headerless 16-bit little-endian; add a WAV header.
export function wrapPcmAsWav(pcm: Uint8Array, sampleRate: number, channels: number): Uint8Array {
  if (pcm.length >= 4 && pcm[0] === 0x52 && pcm[1] === 0x49 && pcm[2] === 0x46 && pcm[3] === 0x46) return pcm; // already RIFF
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, "RIFF"); view.setUint32(4, 36 + pcm.length, true); write(8, "WAVE");
  write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  write(36, "data"); view.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}
```

```ts
// media/src/tts/inworld.ts
import { writeFile } from "node:fs/promises";
import { wrapPcmAsWav } from "./elevenlabs";
import type { TtsProvider } from "./types";
import { fetchAudioWithRetry, requireEnv } from "./types";

export const inworld: TtsProvider = {
  id: "inworld",
  maxChars: 2000,
  async synthesize(text, voice, outputPath) {
    const key = requireEnv(voice.keyEnvVar);
    const bytes = await fetchAudioWithRetry("https://api.inworld.ai/tts/v1/voice", {
      method: "POST",
      headers: { authorization: `Basic ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        text, voiceId: voice.voiceId, modelId: voice.model,
        audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000 },
      }),
    });
    // Inworld returns JSON with base64 audioContent for LINEAR16.
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { audioContent: string };
    const pcm = new Uint8Array(Buffer.from(parsed.audioContent, "base64"));
    await writeFile(outputPath, wrapPcmAsWav(pcm, 24000, 1));
  },
};
```

```ts
// media/src/tts/gemini.ts
import { writeFile } from "node:fs/promises";
import { wrapPcmAsWav } from "./elevenlabs";
import type { TtsProvider } from "./types";
import { fetchAudioWithRetry, requireEnv } from "./types";

export const gemini: TtsProvider = {
  id: "google",
  maxChars: 4000,
  async synthesize(text, voice, outputPath) {
    const key = requireEnv(voice.keyEnvVar);
    const bytes = await fetchAudioWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${voice.model}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.voiceId } } },
          },
        }),
      },
    );
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
      candidates: { content: { parts: { inlineData?: { data: string; mimeType: string } }[] } }[];
    };
    const part = parsed.candidates[0]?.content.parts.find((p) => p.inlineData);
    if (!part?.inlineData) throw new Error("Gemini returned no audio part");
    const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType)?.[1] ?? 24000);
    await writeFile(outputPath, wrapPcmAsWav(new Uint8Array(Buffer.from(part.inlineData.data, "base64")), rate, 1));
  },
};
```

```ts
// media/src/tts/openaiCompatible.ts
// Breeze TTS 2 behind an OpenAI-style /v1/audio/speech. The voiceId
// "design:<description>" selects voice design; anything else is a named voice.
import { writeFile } from "node:fs/promises";
import type { TtsProvider } from "./types";
import { fetchAudioWithRetry, requireEnv } from "./types";

export const openaiCompatible: TtsProvider = {
  id: "openaiCompatible",
  maxChars: 3000,
  async synthesize(text, voice, outputPath) {
    const base = requireEnv(voice.baseUrlEnvVar ?? "BREEZE_TTS_BASE_URL").replace(/\/$/, "");
    const key = process.env[voice.keyEnvVar] ?? "local";
    const design = voice.voiceId.startsWith("design:") ? voice.voiceId.slice("design:".length) : undefined;
    const bytes = await fetchAudioWithRetry(`${base}/v1/audio/speech`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: voice.model,
        input: text,
        voice: design ? "design" : voice.voiceId,
        ...(design ? { instructions: design } : {}),
        response_format: "wav",
      }),
    });
    await writeFile(outputPath, new Uint8Array(bytes));
  },
};
```

```ts
// media/src/tts/index.ts
import type { VoiceEntry } from "../../../convex/shared/voices";
import { elevenlabs } from "./elevenlabs";
import { gemini } from "./gemini";
import { inworld } from "./inworld";
import { openaiCompatible } from "./openaiCompatible";
import type { TtsProvider } from "./types";

const providers: Record<VoiceEntry["provider"], TtsProvider> = {
  google: gemini, inworld, elevenlabs, openaiCompatible,
};

export function providerFor(voice: VoiceEntry): TtsProvider {
  return providers[voice.provider];
}

export function isConfigured(voice: VoiceEntry): boolean {
  if (!process.env[voice.keyEnvVar]) return false;
  if (voice.runsOn === "local" && !process.env[voice.baseUrlEnvVar ?? ""]) return false;
  return true;
}
```

Env additions to `media/.env.schema` (all `@sensitive @optional`, resolved from Country Manor Lab / Homelab Runtime items Keith creates): `GEMINI_API_KEY`, `INWORLD_API_KEY`, `ELEVENLABS_API_KEY`, `BREEZE_TTS_API_KEY`; `@public @optional @type=url BREEZE_TTS_BASE_URL=http://tts-local:8881`. Bump `RENDERER_VERSION` in `media/src/config.ts` to `"0.2.0"`.

Provider request shapes above follow each provider's documented API as of 2026-09-28. Task 12 step 1 sends one real request per provider with a ten-word sentence and adjusts field names in the single provider file if a provider changed; tests keep mocking the shape the code sends.

- [ ] **Step 5: Run tests, commit**

Run: `vp run test:media` → PASS.

```bash
git add media/src/tts media/tests/chunk.test.ts media/tests/tts-providers.test.ts media/.env.schema media/src/config.ts
git commit -m "feat(media): TTS providers with chunking and retries"
```

---

### Task 8: `narrate` and `assembleEpisode` handlers

**Files:**
- Create: `media/src/audio/concat.ts`, `media/src/jobs/narrate.ts`, `media/src/jobs/assembleEpisode.ts`, `media/src/download.ts`
- Modify: `media/src/jobs/index.ts`
- Test: `media/tests/concat.test.ts`, `media/tests/narrate.test.ts`

**Interfaces:**
- `concatWithGaps(inputs: string[], output: string, gapMs: number)` → `{ starts: number[] }` (start second of each input in the output); `silence(output, seconds)`; `trimEdges(input, output, keepMs = 300)`.
- `narrateHandler`: per paragraph, chunk by provider `maxChars`, synthesize each chunk to WAV, concat chunks with 400 ms gaps into the paragraph file, concat paragraphs with 400 ms gaps, normalize spoken, encode WAV master + MP3 delivery (dual-mono), compute chapter `startSecs` from paragraph starts, upload master then delivery, return `{ kind: "narrate", artifacts, chapters }`.
- `assembleEpisodeHandler`: download the narration delivery's master? No: download the narration delivery MP3 by playback URL is Clerk-gated, so the job input carries the storage URL: extend `assembleEpisodeJobInputZ` with `narrationStorageUrl: z.string().url()` filled by the `narrate` effect from `ctx.storage.getUrl`. Prepend 1 s silence, re-encode, upload as `episode`, return artifacts. Chapters shift by 1 s.

- [ ] **Step 1: Write the failing tests**

```ts
// media/tests/concat.test.ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { concatWithGaps, trimEdges } from "../src/audio/concat";
import { measure } from "../src/audio/loudness";
import { synthTone } from "../src/audio/synth";

const dir = mkdtempSync(join(tmpdir(), "concat-"));

describe("concat", () => {
  test("joins with gaps and reports start offsets", async () => {
    const a = join(dir, "a.wav"); const b = join(dir, "b.wav"); const out = join(dir, "ab.wav");
    await synthTone(a, { hz: 440, seconds: 1 });
    await synthTone(b, { hz: 660, seconds: 2 });
    const { starts } = await concatWithGaps([a, b], out, 400);
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBeCloseTo(1.4, 1);
    expect((await measure(out)).durationSecs).toBeCloseTo(3.4, 0);
  });
  test("trimEdges keeps 300 ms of edge silence", async () => {
    const padded = join(dir, "padded.wav"); const trimmed = join(dir, "trimmed.wav");
    // 2 s silence, 1 s tone, 2 s silence
    await synthTone(join(dir, "tone.wav"), { hz: 440, seconds: 1 });
    await concatWithGaps([join(dir, "tone.wav")], padded, 0, { leadMs: 2000, tailMs: 2000 });
    await trimEdges(padded, trimmed, 300);
    const duration = (await measure(trimmed)).durationSecs;
    expect(duration).toBeGreaterThan(1.4);
    expect(duration).toBeLessThan(1.8);
  });
});
```

```ts
// media/tests/narrate.test.ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vite-plus/test";
import { synthTone } from "../src/audio/synth";
import { narrateHandler } from "../src/jobs/narrate";
import type { ToolClient } from "../src/jobs/types";

describe("narrate job", () => {
  test("renders paragraphs, joins with gaps, computes chapter starts, uploads master then delivery", async () => {
    const synth = vi.fn(async (text: string, _voice: unknown, out: string) => { await synthTone(out, { hz: 440, seconds: text.length > 20 ? 2 : 1, gainDb: -25 }); });
    const roles: string[] = [];
    const tools: ToolClient = {
      generateAudioUploadUrl: vi.fn(async ({ artifact }) => { roles.push(artifact.role); return { artifactId: `a${roles.length}`, uploadUrl: "http://u" }; }),
      attachAudioStorage: vi.fn(async () => null),
      uploadBytes: vi.fn(async () => ({ storageId: "s" })),
    };
    const result = await narrateHandler(
      {
        job: {
          jobId: "j", kind: "narrate", leaseToken: "L", leaseExpiresAt: Date.now() + 60_000, attempts: 0,
          input: {
            kind: "narrate", script: { paragraphs: ["Short one.", "This is a longer second paragraph here."], chapters: [{ title: "A", startParagraph: 0 }, { title: "B", startParagraph: 1 }] },
            voiceId: "inworld-max", promptVersion: "narration.v1", target: "spoken", title: "T", access: "feed", refs: {}, assembleOnDone: false, rendererVersion: "0.2.0",
          },
        },
        workDir: mkdtempSync(join(tmpdir(), "narr-")), tools, rendererVersion: "0.2.0",
      },
      { synthesize: synth },
    );
    expect(result.kind).toBe("narrate");
    expect(roles).toEqual(["masterNormalized", "delivery"]);
    expect(result.chapters[0]).toEqual({ title: "A", startSecs: 0 });
    expect(result.chapters[1]?.startSecs).toBeCloseTo(1.4, 1);
    for (const artifact of result.artifacts) {
      expect(Math.abs(artifact.loudnessLufs + 16)).toBeLessThanOrEqual(0.5);
      expect(artifact.truePeakDbtp).toBeLessThanOrEqual(-1);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** → FAIL.

- [ ] **Step 3: Concat, silence, trim**

```ts
// media/src/audio/concat.ts
import { runFfmpeg } from "./ffmpeg";
import { measure } from "./loudness";

export async function silence(output: string, seconds: number): Promise<void> {
  await runFfmpeg(["-f", "lavfi", "-i", `anullsrc=r=48000:cl=mono`, "-t", String(seconds), "-c:a", "pcm_s24le", output]);
}

export async function concatWithGaps(
  inputs: string[],
  output: string,
  gapMs: number,
  options: { leadMs?: number; tailMs?: number } = {},
): Promise<{ starts: number[] }> {
  const starts: number[] = [];
  let cursor = (options.leadMs ?? 0) / 1000;
  const durations: number[] = [];
  for (const input of inputs) {
    starts.push(cursor);
    const duration = (await measure(input)).durationSecs;
    durations.push(duration);
    cursor += duration + gapMs / 1000;
  }
  const filterInputs = inputs.map((_, index) => `[${index}:a]aresample=48000,aformat=channel_layouts=mono[a${index}]`);
  const delays = inputs.map((_, index) => `[a${index}]adelay=${Math.round(starts[index]! * 1000)}|${Math.round(starts[index]! * 1000)}[d${index}]`);
  const total = cursor - gapMs / 1000 + (options.tailMs ?? 0) / 1000;
  const mix = `${inputs.map((_, index) => `[d${index}]`).join("")}amix=inputs=${inputs.length}:normalize=0:dropout_transition=0,apad=whole_dur=${total.toFixed(3)}[out]`;
  await runFfmpeg([
    ...inputs.flatMap((input) => ["-i", input]),
    "-filter_complex", [...filterInputs, ...delays, mix].join(";"),
    "-map", "[out]", "-t", total.toFixed(3), "-c:a", "pcm_s24le", output,
  ]);
  return { starts };
}

export async function trimEdges(input: string, output: string, keepMs = 300): Promise<void> {
  const keep = keepMs / 1000;
  await runFfmpeg([
    "-i", input,
    "-af",
    `silenceremove=start_periods=1:start_threshold=-50dB:start_silence=${keep},areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=${keep},areverse`,
    "-c:a", "pcm_s24le", output,
  ]);
}
```

- [ ] **Step 4: Narrate handler**

```ts
// media/src/jobs/narrate.ts
import { join } from "node:path";
import { fnv1a64Hex, stableStringify } from "../../../convex/shared/stableHash";
import { voiceById, type VoiceEntry } from "../../../convex/shared/voices";
import { concatWithGaps } from "../audio/concat";
import { encodeMp3 } from "../audio/encode";
import { assertWithinPolicy, LOUDNESS_TARGETS, measure, normalize } from "../audio/loudness";
import { chunkForLimit } from "../tts/chunk";
import { providerFor } from "../tts";
import type { ArtifactResult, JobContext, NewArtifact } from "./types";

export const PARAGRAPH_GAP_MS = 400;

type Synth = { synthesize: (text: string, voice: VoiceEntry, outputPath: string) => Promise<void>; maxChars?: number };

export async function renderParagraph(ctx: JobContext, synth: Synth, voice: VoiceEntry, text: string, index: number): Promise<string> {
  const maxChars = synth.maxChars ?? providerFor(voice).maxChars;
  const chunks = chunkForLimit(text, maxChars);
  const files: string[] = [];
  for (const [chunkIndex, chunk] of chunks.entries()) {
    const file = join(ctx.workDir, `p${index}-c${chunkIndex}.wav`);
    await synth.synthesize(chunk, voice, file);
    files.push(file);
  }
  const out = join(ctx.workDir, `p${index}.wav`);
  await concatWithGaps(files, out, PARAGRAPH_GAP_MS);
  return out;
}

export async function uploadMasterAndDelivery(
  ctx: JobContext,
  normalizedWav: string,
  base: Omit<NewArtifact, "role" | "encoding" | "contentHash">,
  hashBase: Record<string, unknown>,
  targetLufs: number,
): Promise<ArtifactResult[]> {
  const delivery = join(ctx.workDir, "delivery.mp3");
  await encodeMp3(normalizedWav, delivery, { bitrateKbps: 128, channels: 2 });
  const results: ArtifactResult[] = [];
  const upload = async (path: string, artifact: NewArtifact, mimeType: string) => {
    const { artifactId, uploadUrl } = await ctx.tools.generateAudioUploadUrl({ jobId: ctx.job.jobId, leaseToken: ctx.job.leaseToken, artifact });
    const { storageId } = await ctx.tools.uploadBytes(uploadUrl, path, mimeType);
    await ctx.tools.attachAudioStorage({ jobId: ctx.job.jobId, leaseToken: ctx.job.leaseToken, artifactId, storageId });
    const measured = await measure(path);
    assertWithinPolicy(measured, targetLufs);
    const result: ArtifactResult = { artifactId: artifactId as ArtifactResult["artifactId"], durationSecs: measured.durationSecs, loudnessLufs: measured.integratedLufs, truePeakDbtp: measured.truePeakDbtp, mimeType };
    results.push(result);
    return result;
  };
  const master = await upload(normalizedWav, {
    ...base, role: "masterNormalized", encoding: { codec: "wav", sampleRate: 48000, channels: 1 },
    contentHash: fnv1a64Hex(stableStringify({ ...hashBase, role: "masterNormalized" })),
  }, "audio/wav");
  await upload(delivery, {
    ...base, role: "delivery", masterArtifactId: master.artifactId, encoding: { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 },
    contentHash: fnv1a64Hex(stableStringify({ ...hashBase, role: "delivery" })),
  }, "audio/mpeg");
  return results;
}

export async function narrateHandler(ctx: JobContext, synthOverride?: Synth) {
  const input = ctx.job.input;
  if (input.kind !== "narrate") throw new Error("narrate handler received another kind");
  const voice = voiceById(input.voiceId);
  const synth: Synth = synthOverride ?? providerFor(voice);
  const paragraphFiles: string[] = [];
  for (const [index, paragraph] of input.script.paragraphs.entries()) {
    paragraphFiles.push(await renderParagraph(ctx, synth, voice, paragraph, index));
  }
  const joined = join(ctx.workDir, "joined.wav");
  const { starts } = await concatWithGaps(paragraphFiles, joined, PARAGRAPH_GAP_MS);
  const normalized = join(ctx.workDir, "normalized.wav");
  await normalize(joined, normalized, { targetLufs: LOUDNESS_TARGETS.spoken });
  const chapters = input.script.chapters.map((chapter) => ({ title: chapter.title, startSecs: Number((starts[chapter.startParagraph] ?? 0).toFixed(3)) }));
  const engine = { name: "narrate", version: ctx.rendererVersion, params: { paragraphs: input.script.paragraphs.length } };
  const hashBase = { kind: "narration", script: input.script, voiceId: input.voiceId, promptVersion: input.promptVersion, engine };
  const artifacts = await uploadMasterAndDelivery(
    ctx, normalized,
    {
      kind: "narration", metadataStripped: true, normalization: "applied", access: input.access, title: input.title,
      scriptMd: input.script.paragraphs.join("\n\n"), chapters, engine,
      voice: { catalogId: input.voiceId, promptVersion: input.promptVersion }, refs: input.refs, createdBy: "system",
    },
    hashBase, LOUDNESS_TARGETS.spoken,
  );
  return { kind: "narrate" as const, artifacts, chapters };
}
```

- [ ] **Step 5: Episode assembly and download**

```ts
// media/src/download.ts
import { writeFile } from "node:fs/promises";

export async function downloadTo(url: string, path: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed: ${response.status}`);
  await writeFile(path, new Uint8Array(await response.arrayBuffer()));
}
```

```ts
// media/src/jobs/assembleEpisode.ts
import { join } from "node:path";
import { concatWithGaps } from "../audio/concat";
import { LOUDNESS_TARGETS, normalize } from "../audio/loudness";
import { downloadTo } from "../download";
import { uploadMasterAndDelivery } from "./narrate";
import type { JobContext } from "./types";

export const EPISODE_LEAD_IN_SECS = 1;

export async function assembleEpisodeHandler(ctx: JobContext) {
  const input = ctx.job.input;
  if (input.kind !== "assembleEpisode") throw new Error("assembleEpisode handler received another kind");
  const source = join(ctx.workDir, "narration.mp3");
  await downloadTo(input.narrationStorageUrl, source);
  const padded = join(ctx.workDir, "padded.wav");
  await concatWithGaps([source], padded, 0, { leadMs: EPISODE_LEAD_IN_SECS * 1000 });
  const normalized = join(ctx.workDir, "episode.wav");
  await normalize(padded, normalized, { targetLufs: LOUDNESS_TARGETS.spoken });
  const chapters = input.chapters.map((chapter) => ({ title: chapter.title, startSecs: chapter.startSecs + EPISODE_LEAD_IN_SECS }));
  const engine = { name: "assembleEpisode", version: ctx.rendererVersion, params: { leadInSecs: EPISODE_LEAD_IN_SECS } };
  const artifacts = await uploadMasterAndDelivery(
    ctx, normalized,
    { kind: "episode", metadataStripped: true, normalization: "applied", access: "feed", title: input.title, chapters, engine, refs: {}, createdBy: "system" },
    { kind: "episode", narration: input.narrationArtifactId, engine }, LOUDNESS_TARGETS.spoken,
  );
  return { kind: "assembleEpisode" as const, artifacts };
}
```

`narrationStorageUrl` was added to the contract and filled by the `narrate` effect in Task 3.

Register in `media/src/jobs/index.ts`: `narrate: narrateHandler, assembleEpisode: assembleEpisodeHandler`.

- [ ] **Step 6: Run tests, commit**

Run: `vp run test:media && vp test convex/mediaJobEffects.test.ts` → PASS.

```bash
git add media/src/audio/concat.ts media/src/download.ts media/src/jobs convex/shared/mediaJobs.ts convex/mediaJobEffects.ts convex/mediaJobEffects.test.ts media/tests/concat.test.ts media/tests/narrate.test.ts
git commit -m "feat(media): narrate and assembleEpisode handlers"
```

---

### Task 9: `shootout` handler

**Files:**
- Create: `media/src/jobs/shootout.ts`
- Modify: `media/src/jobs/index.ts`
- Test: `media/tests/shootout.test.ts`

**Interfaces:**
- `shuffleWithSeed(items, seed)` deterministic Fisher–Yates on a seeded PRNG (seed = job id) so a retried job produces the same order; `spokenLabel(index)` → "take one"; `shootoutHandler(ctx, synthOverride?)`.
- Flow: for each configured voice render the passage paragraphs (reuse `renderParagraph` + join, then `trimEdges` 300 ms, then normalize spoken, then measure and `assertWithinPolicy` on a decoded MP3 encode of each take); skip unconfigured voices; fail the job if fewer than two takes render; choose intro voice = first configured hosted voice; render intro text "This intro voice is not a candidate. You will hear N takes of the same passage. Rate each one before the reveal."; render "take N" labels with the intro voice; build the episode by concatenation: intro, then per take tone (0.5 s, 1 kHz, −20 dBFS), label, 1 s silence, take, 2 s silence; normalize episode; upload each take (master + delivery) and the episode (master + delivery); return takes with labels in shuffled order and `memberOrder`.

- [ ] **Step 1: Write the failing test**

```ts
// media/tests/shootout.test.ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { synthTone } from "../src/audio/synth";
import { shootoutHandler, shuffleWithSeed, spokenLabel } from "../src/jobs/shootout";
import type { ToolClient } from "../src/jobs/types";

afterEach(() => vi.unstubAllEnvs());

describe("shootout job", () => {
  test("shuffle is deterministic per seed and labels are ordinal words", () => {
    expect(shuffleWithSeed(["a", "b", "c", "d"], "job-1")).toEqual(shuffleWithSeed(["a", "b", "c", "d"], "job-1"));
    expect(shuffleWithSeed(["a", "b", "c", "d"], "job-1").toSorted()).toEqual(["a", "b", "c", "d"]);
    expect(spokenLabel(0)).toBe("take one");
    expect(spokenLabel(3)).toBe("take four");
  });

  test("skips unconfigured voices, renders the rest, assembles an episode, returns member order", async () => {
    vi.stubEnv("INWORLD_API_KEY", "k");
    vi.stubEnv("ELEVENLABS_API_KEY", "k");
    // gemini and breeze unconfigured
    const synth = vi.fn(async (text: string, voice: { id: string }, out: string) => {
      await synthTone(out, { hz: voice.id === "inworld-max" ? 440 : 660, seconds: Math.max(1, Math.min(3, text.length / 40)), gainDb: -25 });
    });
    const roles: string[] = [];
    const tools: ToolClient = {
      generateAudioUploadUrl: vi.fn(async ({ artifact }) => { roles.push(`${artifact.kind}:${artifact.role}`); return { artifactId: `a${roles.length}`, uploadUrl: "http://u" }; }),
      attachAudioStorage: vi.fn(async () => null),
      uploadBytes: vi.fn(async () => ({ storageId: "s" })),
    };
    const result = await shootoutHandler(
      {
        job: { jobId: "job-7", kind: "shootout", leaseToken: "L", leaseExpiresAt: Date.now() + 60_000, attempts: 0,
          input: { kind: "shootout", passage: ["First paragraph of the passage.", "Second paragraph, a little longer than the first."], voiceIds: ["gemini-flash-tts", "inworld-max", "elevenlabs-v3", "breeze-2"], title: "Voice shootout", rendererVersion: "0.2.0" } },
        workDir: mkdtempSync(join(tmpdir(), "shoot-")), tools, rendererVersion: "0.2.0",
      },
      { synthesize: synth },
    );
    expect(result.skippedVoiceIds.toSorted()).toEqual(["breeze-2", "gemini-flash-tts"]);
    expect(result.takes.map((take) => take.voiceId).toSorted()).toEqual(["elevenlabs-v3", "inworld-max"]);
    expect(result.memberOrder.toSorted()).toEqual(["elevenlabs-v3", "inworld-max"]);
    expect(result.takes.map((take) => take.label).toSorted()).toEqual(["take one", "take two"]);
    expect(result.takes.every((take) => take.master.artifactId !== take.artifact.artifactId)).toBe(true);
    expect(result.episodeMaster.artifactId).not.toBe(result.episode.artifactId);
    expect(roles.filter((role) => role.startsWith("shootoutTake:delivery"))).toHaveLength(2);
    expect(roles.filter((role) => role.startsWith("episode:delivery"))).toHaveLength(1);
    expect(result.episode.durationSecs).toBeGreaterThan(result.takes[0]!.artifact.durationSecs + result.takes[1]!.artifact.durationSecs + 7);
  });

  test("fewer than two configured voices fails the job", async () => {
    vi.stubEnv("INWORLD_API_KEY", "k");
    await expect(
      shootoutHandler(
        { job: { jobId: "j", kind: "shootout", leaseToken: "L", leaseExpiresAt: Date.now() + 60_000, attempts: 0,
          input: { kind: "shootout", passage: ["p"], voiceIds: ["inworld-max", "breeze-2"], title: "t", rendererVersion: "0.2.0" } },
          workDir: mkdtempSync(join(tmpdir(), "shoot2-")), tools: {} as ToolClient, rendererVersion: "0.2.0" },
        { synthesize: vi.fn(async (_t: string, _v: unknown, out: string) => synthTone(out, { hz: 440, seconds: 1 })) },
      ),
    ).rejects.toThrow(/at least two/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.

- [ ] **Step 3: Write the handler**

```ts
// media/src/jobs/shootout.ts
import { join } from "node:path";
import { fnv1a64Hex, stableStringify } from "../../../convex/shared/stableHash";
import { voiceById, type VoiceEntry } from "../../../convex/shared/voices";
import { concatWithGaps, silence, trimEdges } from "../audio/concat";
import { encodeMp3 } from "../audio/encode";
import { assertWithinPolicy, LOUDNESS_TARGETS, measure, normalize } from "../audio/loudness";
import { synthTone } from "../audio/synth";
import { isConfigured, providerFor } from "../tts";
import { PARAGRAPH_GAP_MS, renderParagraph, uploadMasterAndDelivery } from "./narrate";
import type { ArtifactResult, JobContext } from "./types";

const ORDINALS = ["one", "two", "three", "four", "five", "six"];
export function spokenLabel(index: number): string {
  return `take ${ORDINALS[index] ?? String(index + 1)}`;
}

export function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  let state = Number.parseInt(fnv1a64Hex(seed).slice(0, 8), 16) || 1;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

type Synth = { synthesize: (text: string, voice: VoiceEntry, outputPath: string) => Promise<void>; maxChars?: number };

async function renderTake(ctx: JobContext, synth: Synth, voice: VoiceEntry, paragraphs: string[], tag: string): Promise<string> {
  const files: string[] = [];
  for (const [index, paragraph] of paragraphs.entries()) files.push(await renderParagraph(ctx, synth, voice, paragraph, index));
  const joined = join(ctx.workDir, `${tag}-joined.wav`);
  await concatWithGaps(files, joined, PARAGRAPH_GAP_MS);
  const trimmed = join(ctx.workDir, `${tag}-trimmed.wav`);
  await trimEdges(joined, trimmed, 300);
  const normalized = join(ctx.workDir, `${tag}.wav`);
  await normalize(trimmed, normalized, { targetLufs: LOUDNESS_TARGETS.spoken });
  // Policy is checked on the decoded delivery, so a hot encode fails the take here.
  const probeMp3 = join(ctx.workDir, `${tag}-probe.mp3`);
  await encodeMp3(normalized, probeMp3, { bitrateKbps: 128, channels: 2 });
  assertWithinPolicy(await measure(probeMp3), LOUDNESS_TARGETS.spoken);
  return normalized;
}

export async function shootoutHandler(ctx: JobContext, synthOverride?: Synth) {
  const input = ctx.job.input;
  if (input.kind !== "shootout") throw new Error("shootout handler received another kind");
  const voices = input.voiceIds.map(voiceById);
  const configured = voices.filter(isConfigured);
  const skippedVoiceIds = voices.filter((voice) => !isConfigured(voice)).map((voice) => voice.id);
  if (configured.length < 2) throw new Error(`shootout needs at least two configured voices; configured: ${configured.map((v) => v.id).join(", ") || "none"}`);
  const synthFor = (voice: VoiceEntry): Synth => synthOverride ?? providerFor(voice);

  const takeFiles = new Map<string, string>();
  for (const voice of configured) takeFiles.set(voice.id, await renderTake(ctx, synthFor(voice), voice, input.passage, `take-${voice.id}`));

  const order = shuffleWithSeed(configured.map((voice) => voice.id), ctx.job.jobId);
  const introVoice = configured.find((voice) => voice.runsOn === "hosted") ?? configured[0]!;
  const intro = join(ctx.workDir, "intro.wav");
  await synthFor(introVoice).synthesize(
    `This intro voice is not a candidate. You will hear ${order.length} takes of the same passage. Rate each one before the reveal.`,
    introVoice, intro,
  );
  const tone = join(ctx.workDir, "tone.wav");
  await synthTone(tone, { hz: 1000, seconds: 0.5, gainDb: -20 });
  const gap1 = join(ctx.workDir, "gap1.wav"); await silence(gap1, 1);
  const gap2 = join(ctx.workDir, "gap2.wav"); await silence(gap2, 2);

  const sequence: string[] = [intro];
  for (const [index, voiceId] of order.entries()) {
    const label = join(ctx.workDir, `label-${index}.wav`);
    await synthFor(introVoice).synthesize(`${spokenLabel(index)}.`, introVoice, label);
    sequence.push(tone, label, gap1, takeFiles.get(voiceId)!, gap2);
  }
  const episodeJoined = join(ctx.workDir, "episode-joined.wav");
  await concatWithGaps(sequence, episodeJoined, 0);
  const episodeWav = join(ctx.workDir, "episode.wav");
  await normalize(episodeJoined, episodeWav, { targetLufs: LOUDNESS_TARGETS.spoken });

  const engine = { name: "shootout", version: ctx.rendererVersion, params: { voices: order.length } };
  const takes: { voiceId: string; artifact: ArtifactResult; label: string }[] = [];
  for (const [index, voiceId] of order.entries()) {
    const artifacts = await uploadMasterAndDelivery(
      ctx, takeFiles.get(voiceId)!,
      { kind: "shootoutTake", metadataStripped: true, normalization: "applied", access: "private", title: `Shootout take ${index + 1}`, engine, refs: {}, createdBy: "system" },
      { kind: "shootoutTake", voiceId, passage: input.passage, engine }, LOUDNESS_TARGETS.spoken,
    );
    takes.push({ voiceId, artifact: artifacts[1]!, master: artifacts[0]!, label: spokenLabel(index) });
  }
  const episodeArtifacts = await uploadMasterAndDelivery(
    ctx, episodeWav,
    { kind: "episode", metadataStripped: true, normalization: "applied", access: "feed", title: input.title, engine, refs: {}, createdBy: "system",
      chapters: [] },
    { kind: "shootoutEpisode", order, passage: input.passage, engine }, LOUDNESS_TARGETS.spoken,
  );
  return {
    kind: "shootout" as const, takes, skippedVoiceIds,
    episode: episodeArtifacts[1]!, episodeMaster: episodeArtifacts[0]!, memberOrder: order,
  };
}
```

`uploadMasterAndDelivery` returns `[master, delivery]`; the delivery is the blind member and the master rides along so the Task 3 effect can mark both ready.

Register `shootout: shootoutHandler` in `media/src/jobs/index.ts` and set `MEDIA_JOB_KINDS` in the compose env to `probe,narrate,shootout,assembleEpisode` in Task 12.

- [ ] **Step 4: Run tests, commit**

Run: `vp run test:media && vp test convex/mediaJobEffects.test.ts convex/shared/mediaJobs.test.ts` → PASS.

```bash
git add media/src/jobs/shootout.ts media/src/jobs/index.ts media/tests/shootout.test.ts convex/shared/mediaJobs.ts convex/mediaJobEffects.ts convex/mediaJobEffects.test.ts
git commit -m "feat(media): blind voice shootout handler"
```

---

### Task 10: Listen page, shootout section (`web/src/routes/listen.tsx`)

**Files:**
- Create: `web/src/routes/listen.tsx`, `web/src/components/audio-player.tsx`
- Modify: `web/src/router.tsx` (lazy route `/listen`, nav entry `{ to: "/listen", label: "Listen" }` after Feedback)
- Create: `convex/listen.ts` (Clerk queries the page needs), test `convex/listen.test.ts`
- Modify: `harness/modules.ts`
- Create: `web/public/podcast-cover.png` (1400×1400 PNG; Keith supplies artwork, a placeholder gradient generated with ImageMagick `convert -size 1400x1400 gradient:'#1a1330'-'#3b2a5a' -gravity center -pointsize 96 -fill '#e8dcc0' -annotate 0 'Frequency Music' web/public/podcast-cover.png` until then)

**Interfaces:**
- Clerk query `listen.shootouts({})` → `{ groupId, title, createdAt, revealed, episodeArtifactId }[]` (blind groups of purpose `voiceShootout`, newest first).
- Page: list of shootouts; for the selected group: `blindGroups.projection`, a native `<audio>` player per member with label and duration, a five-field 0 to 5 form per member (`naturalness`, `prosody`, `clean`, `clarity`, `overall`) plus notes, submit via `voiceRatings.submit`; after reveal show `voiceRatings.forGroup` with `voiceId`, and a "Set as house voice" button per revealed voice calling `settings.setHouseVoice`; a banner shows the current `settings.houseVoice`.

- [ ] **Step 1: Convex query with test**

```ts
// convex/listen.test.ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";

describe("listen.shootouts", () => {
  test("lists voice shootout groups newest first with reveal state", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("blindGroups", { purpose: "voiceShootout", members: [], requiredRatings: [], createdAt: 1 });
      await ctx.db.insert("blindGroups", { purpose: "studyFamily", members: [], requiredRatings: [], createdAt: 2 });
      await ctx.db.insert("blindGroups", { purpose: "voiceShootout", members: [], requiredRatings: [], revealedAt: 3, createdAt: 3 });
    });
    const rows = await t.query(internal.listen.shootoutsInternal, {});
    expect(rows.map((row) => row.revealed)).toEqual([true, false]);
  });
});
```

```ts
// convex/listen.ts
import { v } from "convex/values";
import { internalQuery, type QueryCtx, query } from "./_generated/server";
import { requireAuth } from "./auth";

const shootoutReturn = v.array(
  v.object({ groupId: v.id("blindGroups"), createdAt: v.number(), revealed: v.boolean(), memberCount: v.number() }),
);

async function listShootouts(ctx: QueryCtx) {
  const groups = await ctx.db.query("blindGroups").order("desc").take(50);
  return groups
    .filter((group) => group.purpose === "voiceShootout")
    .map((group) => ({ groupId: group._id, createdAt: group.createdAt, revealed: group.revealedAt !== undefined, memberCount: group.members.length }));
}

export const shootoutsInternal = internalQuery({ args: {}, returns: shootoutReturn, handler: async (ctx) => listShootouts(ctx) });

export const shootouts = query({
  args: { devBypassSecret: v.optional(v.string()) },
  returns: shootoutReturn,
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await listShootouts(ctx);
  },
});
```

Register `"./listen.ts": () => import("../convex/listen"),`. Run `vp test convex/listen.test.ts` → PASS.

- [ ] **Step 2: Player component**

```tsx
// web/src/components/audio-player.tsx
import { createSignal, Show } from "solid-js";
import { css } from "../../styled-system/css";

const wrap = css({ display: "flex", flexDirection: "column", gap: "2" });

export function AudioPlayer(props: { src: string; label: string; durationSecs?: number }) {
  const [error, setError] = createSignal<string | null>(null);
  return (
    <div class={wrap}>
      <div class={css({ color: "zodiac.cream/80", fontWeight: "600" })}>
        {props.label}
        <Show when={props.durationSecs !== undefined}>
          <span class={css({ color: "zodiac.cream/50", ml: "2" })}>{Math.round(props.durationSecs ?? 0)}s</span>
        </Show>
      </div>
      <audio controls preload="metadata" src={props.src} onError={() => setError("Could not load audio")} class={css({ width: "100%" })} />
      <Show when={error()}>
        <p class={css({ color: "red.300" })}>{error()}</p>
      </Show>
    </div>
  );
}
```

- [ ] **Step 3: Route**

```tsx
// web/src/routes/listen.tsx
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { css } from "../../styled-system/css";
import { AudioPlayer } from "../components/audio-player";
import { pageClass, pageTitleClass, sectionTitleClass, UIBadge, UIButton, UICard, UIInput, UINotice } from "../components/ui";
import { createMutation, createQuery, createQueryWithStatus } from "../integrations/convex";

const RATING_KEYS = ["naturalness", "prosody", "clean", "clarity", "overall"] as const;
type RatingKey = (typeof RATING_KEYS)[number];
const RATING_LABELS: Record<RatingKey, string> = {
  naturalness: "Naturalness", prosody: "Prosody", clean: "Clean (5 = no artifacts)", clarity: "Clarity", overall: "Overall",
};

export function ListenPage() {
  onMount(() => { document.title = "Listen — Frequency Music"; });
  const shootouts = createQuery(api.listen.shootouts, () => ({}));
  const houseVoice = createQuery(api.settings.houseVoice, () => ({}));
  const [groupId, setGroupId] = createSignal<Id<"blindGroups"> | null>(null);
  const selected = createMemo(() => groupId() ?? shootouts()?.[0]?.groupId ?? null);
  const [notice, setNotice] = createSignal<string | null>(null);

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={pageTitleClass}>Listen</h1>
        <p class={css({ color: "zodiac.cream/62" })}>
          Blind voice shootout. Rate every take; the mapping is revealed only after the last rating. Choosing the house voice is a separate, explicit step.
        </p>
        <p class={css({ color: "zodiac.cream/80", mt: "2" })}>House voice: {houseVoice()?.voiceId ?? "not chosen"}</p>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Shootouts</h2>
        <For each={shootouts() ?? []}>
          {(row) => (
            <button type="button" onClick={() => setGroupId(row.groupId)} class={css({ display: "block", textAlign: "left", py: "1" })}>
              {new Date(row.createdAt).toLocaleString()} · {row.memberCount} takes {row.revealed ? "· revealed" : ""}
            </button>
          )}
        </For>
      </UICard>

      <Show when={notice()}><UINotice>{notice()}</UINotice></Show>

      <Show when={selected()} keyed>
        {(id) => <ShootoutGroup groupId={id} onNotice={setNotice} />}
      </Show>
    </section>
  );
}

// Mounted only with a concrete group id, so every query has real args.
function ShootoutGroup(props: { groupId: Id<"blindGroups">; onNotice: (text: string) => void }) {
  const projection = createQuery(api.blindGroups.projection, () => ({ groupId: props.groupId }));
  const ratings = createQuery(api.voiceRatings.forGroup, () => ({ groupId: props.groupId }));
  const submit = createMutation(api.voiceRatings.submit);
  const setHouseVoice = createMutation(api.settings.setHouseVoice);
  const [form, setForm] = createSignal<Record<string, Record<RatingKey, string> & { notes: string }>>({});

  const formFor = (memberId: string) => form()[memberId] ?? { naturalness: "3", prosody: "3", clean: "3", clarity: "3", overall: "3", notes: "" };
  const update = (memberId: string, key: RatingKey | "notes", value: string) =>
    setForm({ ...form(), [memberId]: { ...formFor(memberId), [key]: value } });
  const ratedIds = createMemo(() => new Set((ratings() ?? []).map((row) => row.memberId)));
  const setNotice = props.onNotice;

  async function rate(memberId: string) {
    const values = formFor(memberId);
    try {
      const result = await submit({
        groupId: props.groupId, memberId,
        ratings: Object.fromEntries(RATING_KEYS.map((key) => [key, Number(values[key])])) as Record<RatingKey, number>,
        notes: values.notes || undefined,
      });
      setNotice(result.revealed ? "All takes rated. Revealed below." : `${result.remaining} take(s) left to rate.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Rating failed");
    }
  }

  return (
    <>
      <Show when={projection()}>
        {(group) => (
          <For each={group().members}>
            {(member) => (
              <UICard>
                <AudioPlayer src={member.playbackUrl} label={member.label} durationSecs={member.durationSecs} />
                <Show when={!group().revealed && !ratedIds().has(member.memberId)}>
                  <div class={css({ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "3", mt: "3" })}>
                    <For each={RATING_KEYS}>
                      {(key) => (
                        <label class={css({ display: "flex", flexDirection: "column", gap: "1" })}>
                          <span>{RATING_LABELS[key]} (0-5)</span>
                          <UIInput type="number" min="0" max="5" step="1" value={formFor(member.memberId)[key]} onInput={(e) => update(member.memberId, key, e.currentTarget.value)} />
                        </label>
                      )}
                    </For>
                  </div>
                  <UIInput placeholder="Notes" value={formFor(member.memberId).notes} onInput={(e) => update(member.memberId, "notes", e.currentTarget.value)} />
                  <UIButton onClick={() => rate(member.memberId)}>Save rating</UIButton>
                </Show>
                <Show when={ratedIds().has(member.memberId) && !group().revealed}><UIBadge>rated</UIBadge></Show>
                <Show when={group().revealed && group().labels}>
                  {(labels) => {
                    const row = () => (ratings() ?? []).find((r) => r.memberId === member.memberId);
                    return (
                      <div class={css({ mt: "2" })}>
                        <UIBadge>{row()?.voiceId ?? "unrated"}</UIBadge>
                        <Show when={row()?.voiceId}>
                          <UIButton onClick={() => setHouseVoice({ voiceId: row()!.voiceId! }).then(() => setNotice(`House voice set to ${row()!.voiceId}`))}>
                            Set as house voice
                          </UIButton>
                        </Show>
                        <span class={css({ display: "none" })}>{labels()[member.memberId]}</span>
                      </div>
                    );
                  }}
                </Show>
              </UICard>
            )}
          </For>
        )}
      </Show>
    </>
  );
}
```

`UIBadge`, `UIButton`, `UICard`, `UIInput`, `UINotice` are the names exported by `web/src/components/ui`; match the `UIInput` props used in `feedback.tsx`. `createQueryWithStatus` is imported only if the shootout list needs a loading state; otherwise remove it from the import.

Router: add a `lazyRoute` import for `ListenPage`, a `createRoute({ path: "/listen" })`, include it in the route tree array, and add `{ to: "/listen", label: "Listen" }` to the nav list after Feedback.

- [ ] **Step 4: Typecheck, build, commit**

Run: `vp run typecheck:web && cd web && vp run build && cd ..` → no errors.
Manual check: `cd web && vp dev`, open `/listen` signed in; with no shootout yet the page shows "House voice: not chosen" and an empty list.

```bash
git add web/src/routes/listen.tsx web/src/components/audio-player.tsx web/src/router.tsx web/public/podcast-cover.png convex/listen.ts convex/listen.test.ts harness/modules.ts
git commit -m "feat(web): listen page with blind shootout ratings and house voice choice"
```

---

### Task 11: Local TTS container (Breeze TTS 2) and compose update

**Files (homelab-infra, after `git pull --ff-only`):**
- Modify: `hosts/ai-5090-02/frequency-media/compose.yaml` (add `tts-local`, extend `media` env)
- Create: `hosts/ai-5090-02/frequency-media/tts-local/Dockerfile`, `hosts/ai-5090-02/frequency-media/tts-local/server.py`

**Interfaces:**
- `tts-local` listens on `:8881` inside the compose network, exposing `POST /v1/audio/speech` with body `{ model, input, voice, instructions?, response_format: "wav" }` and returning WAV bytes, and `GET /health`.

- [ ] **Step 1: Dockerfile and server**

```dockerfile
# tts-local/Dockerfile — Breeze TTS 2 behind an OpenAI-style speech endpoint.
FROM nvidia/cuda:12.6.3-cudnn-runtime-ubuntu24.04
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv python3-pip git ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
RUN git clone --depth 1 https://github.com/breezeblue-ai/breeze-tts.git /srv/breeze-tts
RUN python3 -m venv /srv/venv && /srv/venv/bin/pip install --no-cache-dir -U pip \
    && /srv/venv/bin/pip install --no-cache-dir -r /srv/breeze-tts/requirements.txt fastapi uvicorn soundfile huggingface_hub
COPY server.py /srv/server.py
ENV BREEZE_MODEL_DIR=/models/breeze-tts-2 HF_HOME=/models/hf
EXPOSE 8881
CMD ["/srv/venv/bin/uvicorn", "server:app", "--app-dir", "/srv", "--host", "0.0.0.0", "--port", "8881"]
```

```python
# tts-local/server.py — thin OpenAI-style adapter over breeze_infer.
# Weights: BreezeBlue/Breeze-TTS-2 (research licence, personal use only),
# downloaded once into the /models volume on first start.
import io, os, sys
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import soundfile as sf
from huggingface_hub import snapshot_download

sys.path.insert(0, "/srv/breeze-tts")
MODEL_DIR = os.environ.get("BREEZE_MODEL_DIR", "/models/breeze-tts-2")
if not os.path.isdir(MODEL_DIR):
    snapshot_download("BreezeBlue/Breeze-TTS-2", local_dir=MODEL_DIR)

from breeze_infer import BreezeTTS  # the repo's inference entry; adjust the import to the name infer.py uses

engine = BreezeTTS(MODEL_DIR)
app = FastAPI()

class SpeechRequest(BaseModel):
    model: str = "breeze-tts-2"
    input: str
    voice: str = "design"
    instructions: str | None = None
    response_format: str = "wav"

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/v1/audio/speech")
def speech(req: SpeechRequest):
    if req.response_format != "wav":
        raise HTTPException(400, "only wav is supported")
    if req.voice == "design":
        if not req.instructions:
            raise HTTPException(400, "voice design needs instructions")
        audio, sr = engine.synthesize(text=req.input, instruction=req.instructions, cfg_scale=4)
    else:
        audio, sr = engine.synthesize(text=req.input, ref_audio=f"/voices/{req.voice}.wav", ref_text=open(f"/voices/{req.voice}.txt").read())
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV", subtype="PCM_16")
    return Response(content=buf.getvalue(), media_type="audio/wav")
```

The `BreezeTTS` import and `synthesize` signature must match `breeze-tts/infer.py`; the plan's Step 2 reads that file on the box and edits the four lines that call the engine. Everything else in the adapter is fixed.

- [ ] **Step 2: Compose changes**

Add to `compose.yaml`:

```yaml
  tts-local:
    build: ./tts-local
    restart: unless-stopped
    volumes:
      - tts-models:/models
    environment:
      BREEZE_MODEL_DIR: /models/breeze-tts-2
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8881/health"]
      interval: 30s
      timeout: 5s
      retries: 20
volumes:
  media-work:
  tts-models:
```

and to the `media` service environment: `MEDIA_JOB_KINDS: probe,narrate,shootout,assembleEpisode`, `BREEZE_TTS_BASE_URL: http://tts-local:8881`, `BREEZE_TTS_API_KEY: local`, and `GEMINI_API_KEY: ${GEMINI_API_KEY}`, `INWORLD_API_KEY: ${INWORLD_API_KEY}`, `ELEVENLABS_API_KEY: ${ELEVENLABS_API_KEY}`. Extend `deploy.sh` to `op read` each of the three hosted keys from their Homelab Runtime items (Gemini from the existing freq item Keith names; Inworld and ElevenLabs from items Keith creates) with `|| true` so a missing item leaves the variable empty and the shootout skips that voice. Remove the GPU reservation from `media` (only `tts-local` needs it).

Smoke on the box after `docker compose up -d --build tts-local`: `curl -s -X POST localhost:8881/v1/audio/speech -H 'content-type: application/json' -d '{"input":"This is a ten word sentence for the local voice test.","voice":"design","instructions":"A calm adult narrator.","response_format":"wav"}' -o /tmp/breeze.wav && ffprobe /tmp/breeze.wav` → a WAV of a few seconds. Expect first start to take several minutes while weights download (about 8 GB).

- [ ] **Step 3: Commit in homelab-infra**

`git add hosts/ai-5090-02 && git commit -m "feat(ai-5090-02): local Breeze TTS and hosted voice keys for frequency-media"`.

---

### Task 12: **PRODUCTION** shootout, rating, house voice, first brief episode

Each step runs with Keith's go-ahead.

- [ ] **Step 1: Verify provider ids** (network calls with real keys, no writes): for each hosted voice, one ten-word request from the box using the media image (`docker compose run --rm media node -e '...'` importing `providerFor`) writing to `/work/verify-<id>.wav`; listen to each file locally. Fix `model`/`voiceId`/request fields in the single provider file if any provider rejects the request; set `verifiedOn` to today. Commit.

- [ ] **Step 2: Deploy Convex** (`vpx convex deploy`): new tables `voiceRatings`, new functions, the cron, the brief hook.

- [ ] **Step 3: Rebuild and restart media** on the box with the new image tag; confirm log shows the four kinds.

- [ ] **Step 4: Enqueue the shootout**: `vpx convex run episodes:enqueueShootout '{}'`. Watch media logs: four takes (or fewer with a skipped voice listed), one episode; job `done`. Feed shows the shootout episode within one Pocket Casts refresh.

- [ ] **Step 5: Keith rates on `/listen`** (headphones), then taps "Set as house voice" on the winner. `vpx convex run settings:get '{"key":"houseVoiceId"}'` prints the choice.

- [ ] **Step 6: First narrated brief**: `vpx convex run episodes:reconcile '{"daysBack":14}'` narrates the newest brief (or wait for Friday's `generate-weekly-turn`). Expect a `narrate` job then an `assembleEpisode` job, and `Weekly turn, week of <Monday>` in Pocket Casts. Record the script word count and episode duration in the handoff.

- [ ] **Step 7: Stop what lost**: if the winner is hosted, `docker compose stop tts-local`; if local, remove hosted keys from `deploy.sh`.

- [ ] **Step 8: `vp run verify`** on the final branch; open the PR with the shootout results summarized (which voice, ratings table) and the Range-request finding from wave 0.

---

## Implementation notes (2026-09-29)

Tasks 1–11a landed on `t3code/listen-first-wave-1` (base `1040e38`); Task 11 host work is done in homelab-infra `hosts/frequency-media/`; Task 12 (**PRODUCTION**) is pending Keith's hosted TTS keys and go-ahead. Controller rulings, by number (ledger: `.superpowers/sdd/2026-09-28-listen-first-wave-1-voice-and-feed/progress.md`; numbers not listed were not issued):

- R1: the shootout episode artifact carries no `blindGroupId` (only takes are members); it pairs with its group through `refs.mediaJobId`, because the feed hides any row with a `blindGroupId`.
- R1b: `listen.shootouts` also returns a nullable `episodeArtifactId`, resolved through feed episodes whose `refs.mediaJobId` matches the members'.
- R2: every artifact array in a result passes the landed `ownedArtifacts(ctx, job, arr)` fence before `readyArtifacts`.
- R3: `ARTIFACT_POLICY_BY_JOB_KIND` gains rows for narrate, shootout, and assembleEpisode, with a test that every job kind has one.
- R6: `episodes.hasReadyEpisodeForBrief` is an internalQuery, not a mutation.
- R8: handler tests build a `JobContext` with a real `AbortSignal`; handlers forward `ctx.signal` to every ffmpeg, measure, fetch, and upload.
- R9: `uploadMasterAndDelivery` measures and checks policy before `generateAudioUploadUrl`, so a failed file creates no server state.
- R10 (revised): `.toSorted()` is allowed in `convex/*.ts` and tests, avoided in `convex/shared/` (consumed by media and web).
- R11: Task 11 files live in homelab-infra `hosts/frequency-media/`, run by the controller after Tasks 1–10.
- R12: hosted TTS keys do not exist in 1Password yet; `deploy.sh` reads each with `|| true` so the shootout skips a missing voice.
- R13: the placeholder cover PNG ships in `web/public/` only; the feed's `itunes:image` stays absent until Keith supplies artwork.
- R17: every subagent ran on the session model.
- R18: the feed lists only `role === "delivery"` episodes; effects publish deliveries only, masters keep the private access they were uploaded with.
- R19: reconcile skips a brief with any narrate job in a non-failed status (queued, claimed, done, parked); `dedupeKey` cannot protect regenerated scripts.
- R20: the narrate effect fills `narrationStorageUrl` with the narration master's URL (lossless), falling back to the delivery only when the master has no blob.
- R21: wave 1 masters are 16-bit PCM mono 48 kHz because Cloudflare caps a proxied request body at 100 MB; FLAC is the follow-up if briefs exceed 14 minutes.
- R22: `assembleEpisodeJobResultZ` carries the handler's lead-in-shifted `chapters`, which the effect stores on the delivery.
- R23: `TtsProvider.synthesize(text, voice, outputPath, signal?)` forwards the job signal into the provider fetch.
- R24: Tasks 9 and 10 ran concurrently on disjoint paths with explicit-path staging (one file rename was swept into a neighbouring commit as the cost).
- R25: the plan's hand-written server adapter is dropped; `tts-local` runs Breeze's upstream API and the media provider speaks it (multipart form, raw PCM, 409 backoff); the catalog provider is `breeze`, configured by `BREEZE_TTS_BASE_URL` alone.
- R26: the intro voice is the first configured catalog voice not in `input.voiceIds` (hosted preferred); when none exists a candidate announces and the intro drops the "not a candidate" claim.
- R27: Breeze treats 503 (model loading) like 409 (busy backoff), and every synthesis first polls `GET /health` every 10 s for up to 5 minutes (R30); no compose `depends_on` on media, because `tts-local` is stopped deliberately when a hosted voice wins.
- R28: `ANNOUNCER_VOICES` (`announcer-breeze`, `announcer-gemini`) are dedicated non-candidate announcer voices, chosen after a catalog bystander and before the R26 candidate fallback; the episode records `engine.params.announcerVoiceId`.
- R29: `assembleEpisodeJobInputZ` gains optional `refs`; the narrate effect forwards the narration's refs so an episode carries its `weeklyBriefId`.
- R30: the Breeze health gate runs before every synthesis rather than once per process, so a `tts-local` restarted cold while the worker runs is waited for.
