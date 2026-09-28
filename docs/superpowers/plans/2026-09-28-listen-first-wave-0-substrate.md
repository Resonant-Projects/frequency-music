# Listen-First Wave 0: Shared Substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the audio substrate every later wave builds on: artifact, blind-group, job, and settings tables in Convex; leased media-job lifecycle tools on `/agent-tools/*`; a `media/` package that pulls jobs, normalizes loudness, encodes, uploads, and completes; storage-backed audio delivery; and the private podcast feed route.

**Architecture:** Convex owns all state and the only public HTTP surface (`/podcast/<token>/feed.xml`); audio bytes are served from Convex file storage URLs, never through HTTP actions. A new `media/` workspace package runs on ai-5090-02 under Docker and pulls work through fenced, leased `mediaJobs`, completing each job with a typed result that a Convex mutation validates and applies atomically. A `probe` job kind exercises the whole pipeline end to end and doubles as a health check.

**Tech Stack:** Convex 1.34 (self-hosted), convex-helpers zod4, zod 4, vite-plus (`vp`/`vpx`) for test/lint/typecheck, Node 24 + tsx for the media package, ffmpeg (loudnorm/ebur128), Docker Compose on ai-5090-02, homelab-infra for deployment definitions.

**Spec:** `docs/superpowers/specs/2026-09-28-listen-first-program-design.md` (§3 shared substrate, §3.6 engineering rules). Wave 1 spec `docs/superpowers/specs/2026-09-28-voice-and-podcast-feed-design.md` consumes everything here.

## Global Constraints

- Run TypeScript with `vpx tsx`; install with `vp install`. Never `npm`/`bun` directly in this repo.
- Cross-seam contracts live in `convex/shared/`; validators derive from zod via `convex-helpers/server/zod4`.
- `/agent-tools/*` authenticates with `AGENT_TOOL_SECRET`; the media service is a standing service identity using that secret. No new tool may approve, reject, or supersede drafts, publish hypotheses or recipes, or create listening sessions.
- Secrets (`AGENT_TOOL_SECRET`, `PODCAST_FEED_TOKEN`, TTS keys) are resolved from 1Password references; never printed, pasted, or committed. `.env.test` gets an inert placeholder for every new `op()`-backed variable.
- Convex `deploy`, `run`, `dev`, `codegen` contact the one live deployment. Every such step below is marked **PRODUCTION** and runs only with Keith's go-ahead.
- Loudness policy (spec §3.4): spoken −16 LUFS ±0.5 LU, music −18 LUFS ±0.5 LU, both ≤ −1 dBTP measured on the decoded delivery file and on the master; spoken is mono delivered dual-mono, music stereo. Out of tolerance fails the job unless `normalize: false`.
- Podcast feed: `GET /podcast/<token>/feed.xml` only; wrong token returns 404, never 401. Enclosure URLs point at storage through `PODCAST_PUBLIC_BASE_URL`; only `access: "feed"` episode artifacts appear.
- Every new Convex module is registered in `harness/modules.ts` (convex-test cannot glob).
- `vp run verify` passes before each handoff.
- Machine analysis and media effects never write `listeningSessions`.

## Review Focus

1. A job whose worker crashed after uploading but before `attachAudioStorage`: the blob must be reclaimed by the sweeper, not leak forever. Test in Task 6.
2. A stale worker calling `completeMediaJob` after its lease expired and another worker re-claimed the job: the late completion must be rejected and must not overwrite the new worker's artifacts. Test in Task 5.
3. Two enqueues of an identical snapshot arriving in the same second: exactly one job row, both callers get the same id. Test in Task 5.
4. A feed request with a token that is a prefix or superset of the real token, or with URL-encoded characters: 404, and no timing difference leaks the length. Test in Task 9.
5. A delivery MP3 whose decoded true peak exceeds −1 dBTP although the master passed: the job must fail, not ship a clipped episode. Test in Task 12.

---

### Task 1: Audio artifact contracts (`convex/shared/audioArtifacts.ts`)

**Files:**
- Create: `convex/shared/audioArtifacts.ts`
- Test: `convex/shared/audioArtifacts.test.ts`

**Interfaces:**
- Produces: `audioArtifactKindZ`, `audioArtifactRoleZ`, `audioArtifactStatusZ`, `audioEncodingZ`, `audioAnalysisZ`, `audioRefsZ`, `audioArtifactFieldsZ` (zod), `audioArtifactFieldsValidator` (Convex), `AUDIO_ARTIFACT_KINDS`, `AudioArtifactKind`, `AudioEncoding`.

- [ ] **Step 1: Write the failing test**

```ts
// convex/shared/audioArtifacts.test.ts
import { describe, expect, test } from "vite-plus/test";
import {
  AUDIO_ARTIFACT_KINDS,
  audioArtifactFieldsZ,
  audioEncodingZ,
} from "./audioArtifacts";

describe("audio artifact contracts", () => {
  test("kinds are the closed wave-0 set", () => {
    expect([...AUDIO_ARTIFACT_KINDS]).toEqual([
      "narration",
      "shootoutTake",
      "episode",
      "litmusRender",
      "voiceNote",
      "blurb",
      "probe",
    ]);
  });

  test("encoding requires a codec and positive sample rate and channels", () => {
    expect(
      audioEncodingZ.safeParse({ codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 })
        .success,
    ).toBe(true);
    expect(audioEncodingZ.safeParse({ codec: "flac", sampleRate: 48000, channels: 2 }).success).toBe(false);
    expect(audioEncodingZ.safeParse({ codec: "wav", sampleRate: 0, channels: 2 }).success).toBe(false);
  });

  test("artifact fields default access to private and require a title", () => {
    const parsed = audioArtifactFieldsZ.parse({
      kind: "probe",
      role: "delivery",
      status: "pending",
      encoding: { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 },
      normalization: "applied",
      metadataStripped: false,
      title: "probe tone",
      refs: {},
      contentHash: "abc",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    expect(parsed.access).toBe("private");
    expect(audioArtifactFieldsZ.safeParse({ ...parsed, title: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test convex/shared/audioArtifacts.test.ts`
Expected: FAIL with "Cannot find module './audioArtifacts'".

- [ ] **Step 3: Write the contract module**

```ts
// convex/shared/audioArtifacts.ts
// Zod-first contracts for stored audio. Convex validators derive from these
// schemas; the media package and web import the zod types.
import { zid, zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod";

export const AUDIO_ARTIFACT_KINDS = [
  "narration",
  "shootoutTake",
  "episode",
  "litmusRender",
  "voiceNote",
  "blurb",
  "probe",
] as const;
export type AudioArtifactKind = (typeof AUDIO_ARTIFACT_KINDS)[number];

export const audioArtifactKindZ = z.enum(AUDIO_ARTIFACT_KINDS);
export const audioArtifactRoleZ = z.enum(["masterRaw", "masterNormalized", "delivery"]);
export const audioArtifactStatusZ = z.enum(["pending", "ready", "failed"]);
export const audioAccessZ = z.enum(["feed", "private"]);
export const normalizationZ = z.enum(["applied", "skipped"]);

export const audioEncodingZ = z.object({
  codec: z.enum(["wav", "mp3", "opus"]),
  bitrateKbps: z.number().int().positive().optional(),
  sampleRate: z.number().int().positive(),
  channels: z.number().int().min(1).max(2),
});
export type AudioEncoding = z.infer<typeof audioEncodingZ>;

export const audioAnalysisZ = z.object({
  version: z.string().min(1),
  roughnessMedian: z.number().optional(),
  roughnessP90: z.number().optional(),
  lufs: z.number().optional(),
  truePeakDbtp: z.number().optional(),
  spectralCentroidHz: z.number().optional(),
});

export const audioChapterZ = z.object({
  title: z.string().min(1),
  startSecs: z.number().min(0),
});

export const audioRefsZ = z.object({
  weeklyBriefId: zid("weeklyBriefs").optional(),
  agentReviewDraftId: zid("agentReviewDrafts").optional(),
  recipeId: zid("recipes").optional(),
  compositionId: zid("compositions").optional(),
  listeningSessionId: zid("listeningSessions").optional(),
  docketCardId: z.string().optional(),
  mediaJobId: zid("mediaJobs").optional(),
});

export const audioArtifactFieldsZ = z.object({
  kind: audioArtifactKindZ,
  role: audioArtifactRoleZ,
  masterArtifactId: zid("audioArtifacts").optional(),
  metadataStripped: z.boolean(),
  status: audioArtifactStatusZ,
  storageId: zid("_storage").optional(),
  mimeType: z.string().optional(),
  encoding: audioEncodingZ,
  durationSecs: z.number().nonnegative().optional(),
  loudnessLufs: z.number().optional(),
  truePeakDbtp: z.number().optional(),
  normalization: normalizationZ,
  access: audioAccessZ.default("private"),
  validation: z.enum(["unvalidated", "validated"]).optional(),
  title: z.string().min(1),
  scriptMd: z.string().optional(),
  chapters: z.array(audioChapterZ).optional(),
  engine: z
    .object({ name: z.string(), version: z.string(), params: z.record(z.string(), z.unknown()) })
    .optional(),
  voice: z.object({ catalogId: z.string(), promptVersion: z.string() }).optional(),
  analysis: audioAnalysisZ.optional(),
  refs: audioRefsZ,
  blindGroupId: zid("blindGroups").optional(),
  contentHash: z.string().min(1),
  error: z.string().optional(),
  createdBy: z.union([z.literal("system"), z.literal("agent"), zid("users")]),
  uploadIssuedAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type AudioArtifactFields = z.infer<typeof audioArtifactFieldsZ>;

export const audioArtifactFieldsValidator = zodToConvex(audioArtifactFieldsZ);
export const audioEncodingValidator = zodToConvex(audioEncodingZ);
export const audioAnalysisValidator = zodToConvex(audioAnalysisZ);
export const audioRefsValidator = zodToConvex(audioRefsZ);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test convex/shared/audioArtifacts.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/shared/audioArtifacts.ts convex/shared/audioArtifacts.test.ts
git commit -m "feat(shared): audio artifact contracts"
```

---

### Task 2: Media job contracts and stable hashing (`convex/shared/mediaJobs.ts`)

**Files:**
- Create: `convex/shared/mediaJobs.ts`, `convex/shared/stableHash.ts`
- Test: `convex/shared/mediaJobs.test.ts`, `convex/shared/stableHash.test.ts`

**Interfaces:**
- Produces: `stableStringify(value)`, `fnv1a64Hex(text)`, `MEDIA_JOB_KINDS`, `mediaJobKindZ`, `mediaJobInputZ` (discriminated union by `kind`), `mediaJobResultZ`, `mediaJobDedupeKey(kind, input)`, `LEASE_MS = 600_000`, `MAX_ATTEMPTS = 3`, `probeJobInputZ`, `probeJobResultZ`, `artifactResultZ`.

- [ ] **Step 1: Write the failing tests**

```ts
// convex/shared/stableHash.test.ts
import { describe, expect, test } from "vite-plus/test";
import { fnv1a64Hex, stableStringify } from "./stableHash";

describe("stable hashing", () => {
  test("key order does not change the string", () => {
    expect(stableStringify({ b: 1, a: [3, { d: 1, c: 2 }] })).toBe(
      stableStringify({ a: [3, { c: 2, d: 1 }], b: 1 }),
    );
  });
  test("undefined fields are dropped, null kept", () => {
    expect(stableStringify({ a: undefined, b: null })).toBe('{"b":null}');
  });
  test("fnv1a64 is deterministic and 16 hex chars", () => {
    expect(fnv1a64Hex("probe")).toMatch(/^[0-9a-f]{16}$/);
    expect(fnv1a64Hex("probe")).toBe(fnv1a64Hex("probe"));
    expect(fnv1a64Hex("probe")).not.toBe(fnv1a64Hex("probf"));
  });
});
```

```ts
// convex/shared/mediaJobs.test.ts
import { describe, expect, test } from "vite-plus/test";
import {
  LEASE_MS,
  MAX_ATTEMPTS,
  mediaJobDedupeKey,
  mediaJobInputZ,
  mediaJobResultZ,
} from "./mediaJobs";

describe("media job contracts", () => {
  test("probe input validates and dedupes by snapshot", () => {
    const input = { kind: "probe", toneHz: 440, seconds: 2, rendererVersion: "0.1.0" } as const;
    expect(mediaJobInputZ.parse(input)).toEqual(input);
    expect(mediaJobDedupeKey(input)).toBe(mediaJobDedupeKey({ ...input }));
    expect(mediaJobDedupeKey(input)).not.toBe(mediaJobDedupeKey({ ...input, toneHz: 441 }));
  });

  test("probe input rejects out-of-range tone and seconds", () => {
    expect(mediaJobInputZ.safeParse({ kind: "probe", toneHz: 10, seconds: 2, rendererVersion: "x" }).success).toBe(false);
    expect(mediaJobInputZ.safeParse({ kind: "probe", toneHz: 440, seconds: 0, rendererVersion: "x" }).success).toBe(false);
  });

  test("probe result requires ready artifacts with measurements", () => {
    const ok = mediaJobResultZ.safeParse({
      kind: "probe",
      artifacts: [
        { artifactId: "k123", durationSecs: 2, loudnessLufs: -16.1, truePeakDbtp: -1.4, mimeType: "audio/mpeg" },
      ],
    });
    expect(ok.success).toBe(true);
    expect(mediaJobResultZ.safeParse({ kind: "probe", artifacts: [] }).success).toBe(false);
  });

  test("lease and attempt constants match the spec", () => {
    expect(LEASE_MS).toBe(10 * 60 * 1000);
    expect(MAX_ATTEMPTS).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test convex/shared/stableHash.test.ts convex/shared/mediaJobs.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write the hashing module**

```ts
// convex/shared/stableHash.ts
// Deterministic, runtime-agnostic hashing for dedupe keys. Not cryptographic:
// these keys only need to be stable and collision-unlikely for job identity.
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`);
  return `{${entries.join(",")}}`;
}

export function fnv1a64Hex(text: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}
```

- [ ] **Step 4: Write the job contract module**

```ts
// convex/shared/mediaJobs.ts
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
export const mediaJobStatusZ = z.enum(["queued", "claimed", "done", "failed", "parked"]);

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
  artifacts: z.array(artifactResultZ).min(1),
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `vp test convex/shared/stableHash.test.ts convex/shared/mediaJobs.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add convex/shared/stableHash.ts convex/shared/stableHash.test.ts convex/shared/mediaJobs.ts convex/shared/mediaJobs.test.ts
git commit -m "feat(shared): media job contracts and stable hashing"
```

---

### Task 3: Schema tables (`audioArtifacts`, `blindGroups`, `mediaJobs`, `settings`)

**Files:**
- Modify: `convex/schema.ts` (imports at top; new tables after `listeningSessions`, before `weeklyBriefs`)
- Test: `convex/schemaMedia.test.ts`
- Modify: `harness/modules.ts` (no new module yet; verify the test harness still loads)

**Interfaces:**
- Produces tables: `audioArtifacts` (fields = `audioArtifactFieldsValidator`, indexes `by_kind_createdAt`, `by_status_createdAt`, `by_access_kind_createdAt`, `by_blindGroupId`, `by_refs_compositionId` on `["refs.compositionId"]`, `by_contentHash`, `by_storageId`), `blindGroups`, `mediaJobs`, `settings`.

- [ ] **Step 1: Write the failing test**

```ts
// convex/schemaMedia.test.ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import schema from "./schema";

describe("media tables", () => {
  test("audio artifact, blind group, media job, and settings rows insert and index", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const jobId = await ctx.db.insert("mediaJobs", {
        kind: "probe",
        input: { kind: "probe", toneHz: 440, seconds: 1, rendererVersion: "0.1.0" },
        dedupeKey: "probe:deadbeef",
        status: "queued",
        priority: 0,
        attempts: 0,
        createdAt: 1,
      });
      const artifactId = await ctx.db.insert("audioArtifacts", {
        kind: "probe",
        role: "delivery",
        metadataStripped: false,
        status: "pending",
        encoding: { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 },
        normalization: "applied",
        access: "private",
        title: "probe",
        refs: { mediaJobId: jobId },
        contentHash: "c1",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("blindGroups", {
        purpose: "voiceShootout",
        members: [{ memberId: "m1", artifactId, label: "take one" }],
        requiredRatings: ["m1"],
        createdAt: 1,
      });
      await ctx.db.insert("settings", { key: "houseVoiceId", value: "none", updatedAt: 1 });

      const byKind = await ctx.db
        .query("audioArtifacts")
        .withIndex("by_kind_createdAt", (q) => q.eq("kind", "probe"))
        .collect();
      expect(byKind).toHaveLength(1);
      const queued = await ctx.db
        .query("mediaJobs")
        .withIndex("by_status_priority_createdAt", (q) => q.eq("status", "queued"))
        .collect();
      expect(queued).toHaveLength(1);
      const setting = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", "houseVoiceId"))
        .unique();
      expect(setting?.value).toBe("none");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test convex/schemaMedia.test.ts`
Expected: FAIL, table `mediaJobs` not in schema.

- [ ] **Step 3: Add the tables to the schema**

Add imports near the other `./shared/*` imports in `convex/schema.ts`:

```ts
import { audioArtifactFieldsValidator } from "./shared/audioArtifacts";
import {
  mediaJobInputValidator,
  mediaJobResultValidator,
  mediaJobStatusValidator,
} from "./shared/mediaJobs";
```

Insert after the `listeningSessions` table definition:

```ts
  // ==========================================================================
  // AUDIO SUBSTRATE - artifacts, blind groups, media jobs, settings
  // ==========================================================================
  // Audio bytes live in Convex file storage; rows here carry provenance,
  // measurements, and blind-group membership. Machine analysis lives ONLY on
  // artifacts, never on listeningSessions.
  audioArtifacts: defineTable(audioArtifactFieldsValidator)
    .index("by_kind_createdAt", ["kind", "createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_access_kind_createdAt", ["access", "kind", "createdAt"])
    .index("by_blindGroupId", ["blindGroupId"])
    .index("by_refs_compositionId", ["refs.compositionId"])
    .index("by_contentHash", ["contentHash"])
    .index("by_storageId", ["storageId"]),

  blindGroups: defineTable({
    purpose: v.union(v.literal("voiceShootout"), v.literal("studyFamily")),
    // Immutable after creation. memberId is an opaque random handle.
    members: v.array(
      v.object({
        memberId: v.string(),
        artifactId: v.id("audioArtifacts"),
        label: v.string(),
      }),
    ),
    xMember: v.optional(v.object({ memberId: v.string(), duplicates: v.string() })),
    requiredRatings: v.array(v.string()),
    revealedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_revealedAt", ["revealedAt"]),

  mediaJobs: defineTable({
    kind: v.string(),
    input: mediaJobInputValidator,
    dedupeKey: v.string(),
    status: mediaJobStatusValidator,
    priority: v.number(),
    leaseToken: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    workerId: v.optional(v.string()),
    attempts: v.number(),
    result: v.optional(mediaJobResultValidator),
    resultArtifactIds: v.optional(v.array(v.id("audioArtifacts"))),
    error: v.optional(v.string()),
    createdAt: v.number(),
    claimedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  })
    .index("by_status_priority_createdAt", ["status", "priority", "createdAt"])
    .index("by_dedupeKey", ["dedupeKey"])
    .index("by_status_leaseExpiresAt", ["status", "leaseExpiresAt"]),

  // String settings keyed by name (houseVoiceId, renderValidation). The
  // `stats` table holds numbers only and is not reused for this.
  settings: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test convex/schemaMedia.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `vp run typecheck:scripts`
Expected: no errors (schema validators derive from zod).

```bash
git add convex/schema.ts convex/schemaMedia.test.ts
git commit -m "feat(convex): audio artifact, blind group, media job, and settings tables"
```

---

### Task 4: Artifact mutations (`convex/audioArtifacts.ts`)

**Files:**
- Create: `convex/audioArtifacts.ts`
- Test: `convex/audioArtifacts.test.ts`
- Modify: `harness/modules.ts` (add `"./audioArtifacts.ts": () => import("../convex/audioArtifacts"),` in alphabetical position)

**Interfaces:**
- Produces internal mutations `audioArtifacts.createPending({ fields })` → `Id<"audioArtifacts">`, `audioArtifacts.attachStorage({ artifactId, storageId })`, `audioArtifacts.markReady({ artifactId, durationSecs, loudnessLufs, truePeakDbtp, mimeType })`, `audioArtifacts.markFailed({ artifactId, error })`; internal query `audioArtifacts.listByStatusOlderThan({ status, olderThan, limit })`; public (Clerk) query `audioArtifacts.playback({ artifactId })` → `{ url, mimeType, durationSecs } | null` which refuses artifacts in an unrevealed blind group.
- Consumes: Task 1 validators.

- [ ] **Step 1: Write the failing tests**

```ts
// convex/audioArtifacts.test.ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";

const pendingFields = {
  kind: "probe" as const,
  role: "delivery" as const,
  metadataStripped: false,
  status: "pending" as const,
  encoding: { codec: "mp3" as const, bitrateKbps: 128, sampleRate: 48000, channels: 2 },
  normalization: "applied" as const,
  access: "private" as const,
  title: "probe",
  refs: {},
  contentHash: "c1",
  createdBy: "system" as const,
};

describe("audioArtifacts", () => {
  test("createPending stamps timestamps and uploadIssuedAt; attachStorage clears it", async () => {
    const t = convexTest(schema, modules);
    const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
      fields: pendingFields,
    });
    const before = await t.run((ctx) => ctx.db.get(artifactId));
    expect(before?.status).toBe("pending");
    expect(typeof before?.uploadIssuedAt).toBe("number");

    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await t.mutation(internal.audioArtifacts.attachStorage, { artifactId, storageId });
    const after = await t.run((ctx) => ctx.db.get(artifactId));
    expect(after?.storageId).toBe(storageId);
    expect(after?.uploadIssuedAt).toBeUndefined();
  });

  test("markReady requires storage and records measurements", async () => {
    const t = convexTest(schema, modules);
    const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
      fields: pendingFields,
    });
    await expect(
      t.mutation(internal.audioArtifacts.markReady, {
        artifactId,
        durationSecs: 2,
        loudnessLufs: -16,
        truePeakDbtp: -1.2,
        mimeType: "audio/mpeg",
      }),
    ).rejects.toThrow(/storage/);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await t.mutation(internal.audioArtifacts.attachStorage, { artifactId, storageId });
    await t.mutation(internal.audioArtifacts.markReady, {
      artifactId,
      durationSecs: 2,
      loudnessLufs: -16,
      truePeakDbtp: -1.2,
      mimeType: "audio/mpeg",
    });
    const row = await t.run((ctx) => ctx.db.get(artifactId));
    expect(row?.status).toBe("ready");
    expect(row?.loudnessLufs).toBe(-16);
  });

  test("playback refuses members of an unrevealed blind group", async () => {
    const t = convexTest(schema, modules);
    const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
      fields: pendingFields,
    });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await t.mutation(internal.audioArtifacts.attachStorage, { artifactId, storageId });
    await t.mutation(internal.audioArtifacts.markReady, {
      artifactId, durationSecs: 2, loudnessLufs: -16, truePeakDbtp: -1.2, mimeType: "audio/mpeg",
    });
    const groupId = await t.run((ctx) =>
      ctx.db.insert("blindGroups", {
        purpose: "voiceShootout",
        members: [{ memberId: "m1", artifactId, label: "take one" }],
        requiredRatings: ["m1"],
        createdAt: 1,
      }),
    );
    await t.run((ctx) => ctx.db.patch(artifactId, { blindGroupId: groupId }));
    const asKeith = t.withIdentity({ subject: "user_1", tokenIdentifier: "clerk|user_1" });
    expect(await asKeith.query(internal.audioArtifacts.playbackInternal, { artifactId })).toBeNull();
    await t.run((ctx) => ctx.db.patch(groupId, { revealedAt: 5 }));
    const playable = await asKeith.query(internal.audioArtifacts.playbackInternal, { artifactId });
    expect(playable?.mimeType).toBe("audio/mpeg");
    expect(playable?.url).toMatch(/^https?:\/\//);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test convex/audioArtifacts.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the module**

```ts
// convex/audioArtifacts.ts
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireAuth } from "./auth";
import { audioArtifactFieldsValidator } from "./shared/audioArtifacts";

const playbackReturn = v.union(
  v.null(),
  v.object({ url: v.string(), mimeType: v.string(), durationSecs: v.optional(v.number()) }),
);

export const createPending = internalMutation({
  args: { fields: audioArtifactFieldsValidator },
  returns: v.id("audioArtifacts"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("audioArtifacts", {
      ...args.fields,
      status: "pending",
      uploadIssuedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const attachStorage = internalMutation({
  args: { artifactId: v.id("audioArtifacts"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.artifactId);
    if (!row) throw new ConvexError({ code: "NOT_FOUND", message: "Artifact not found" });
    if (row.status !== "pending") {
      throw new ConvexError({ code: "INVALID_STATE", message: `Artifact is ${row.status}` });
    }
    await ctx.db.patch(args.artifactId, {
      storageId: args.storageId,
      uploadIssuedAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const markReady = internalMutation({
  args: {
    artifactId: v.id("audioArtifacts"),
    durationSecs: v.number(),
    loudnessLufs: v.number(),
    truePeakDbtp: v.number(),
    mimeType: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.artifactId);
    if (!row) throw new ConvexError({ code: "NOT_FOUND", message: "Artifact not found" });
    if (!row.storageId) {
      throw new ConvexError({ code: "INVALID_STATE", message: "Artifact has no storage attached" });
    }
    await ctx.db.patch(args.artifactId, {
      status: "ready",
      durationSecs: args.durationSecs,
      loudnessLufs: args.loudnessLufs,
      truePeakDbtp: args.truePeakDbtp,
      mimeType: args.mimeType,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const markFailed = internalMutation({
  args: { artifactId: v.id("audioArtifacts"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.artifactId, {
      status: "failed",
      error: args.error.slice(0, 2000),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const listByStatusOlderThan = internalQuery({
  args: {
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("failed")),
    olderThan: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("audioArtifacts")
      .withIndex("by_status_createdAt", (q) =>
        q.eq("status", args.status).lt("createdAt", args.olderThan),
      )
      .take(args.limit ?? 100);
  },
});

async function isBlindHidden(ctx: QueryCtx, row: Doc<"audioArtifacts">): Promise<boolean> {
  if (!row.blindGroupId) return false;
  const group = await ctx.db.get(row.blindGroupId);
  return Boolean(group && group.revealedAt === undefined);
}

async function playbackFor(ctx: QueryCtx, artifactId: Id<"audioArtifacts">) {
  const row = await ctx.db.get(artifactId);
  if (!row || row.status !== "ready" || !row.storageId) return null;
  if (await isBlindHidden(ctx, row)) return null;
  const url = await ctx.storage.getUrl(row.storageId);
  if (!url) return null;
  return { url, mimeType: row.mimeType ?? "application/octet-stream", durationSecs: row.durationSecs };
}

// Clerk-gated playback: the only way a non-feed artifact's bytes are reached.
export const playback = query({
  args: { artifactId: v.id("audioArtifacts"), devBypassSecret: v.optional(v.string()) },
  returns: playbackReturn,
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await playbackFor(ctx, args.artifactId);
  },
});

// Same projection without auth, for tests and internal callers.
export const playbackInternal = internalQuery({
  args: { artifactId: v.id("audioArtifacts") },
  returns: playbackReturn,
  handler: async (ctx, args) => playbackFor(ctx, args.artifactId),
});
```

Check `requireAuth`'s signature in `convex/auth.ts` before using it: it takes `(ctx, args)` with optional `devBypassSecret`, exactly as `listening.create` uses it. If the query variant rejects a `QueryCtx`, use the same call `listening.listByComposition` would use, or add `devBypassSecret` handling identical to `agentDrafts.approve`.

- [ ] **Step 4: Register the module and run tests**

Add to `harness/modules.ts`: `"./audioArtifacts.ts": () => import("../convex/audioArtifacts"),`

Run: `vp test convex/audioArtifacts.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/audioArtifacts.ts convex/audioArtifacts.test.ts harness/modules.ts
git commit -m "feat(convex): audio artifact lifecycle and gated playback"
```

---

### Task 5: Media job lifecycle mutations (`convex/mediaJobs.ts`, `convex/mediaJobEffects.ts`)

**Files:**
- Create: `convex/mediaJobs.ts`, `convex/mediaJobEffects.ts`
- Test: `convex/mediaJobs.test.ts`
- Modify: `harness/modules.ts` (register both modules)

**Interfaces:**
- Produces internal mutations: `mediaJobs.enqueue({ input, priority? })` → `{ jobId, created: boolean }`; `mediaJobs.claimNext({ workerId, kinds })` → `ClaimedMediaJob | null`; `mediaJobs.renewLease({ jobId, leaseToken })` → `{ leaseExpiresAt }`; `mediaJobs.complete({ jobId, leaseToken, result })` → `{ jobId, status: "done", resultArtifactIds }`; `mediaJobs.fail({ jobId, leaseToken, error })` → `{ status: "queued" | "parked", attempts }`; `mediaJobs.sweepStale({ now? })` → `{ requeued, parked }`.
- Produces `applyMediaJobResult(ctx, job, result)` in `mediaJobEffects.ts` returning `Id<"audioArtifacts">[]`.
- Consumes: Task 2 contracts, Task 4 `markReady`.

- [ ] **Step 1: Write the failing tests**

```ts
// convex/mediaJobs.test.ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";
import { LEASE_MS } from "./shared/mediaJobs";

const probe = { kind: "probe" as const, toneHz: 440, seconds: 1, rendererVersion: "0.1.0" };

async function pendingArtifact(t: ReturnType<typeof convexTest>, jobId: string) {
  const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
    fields: {
      kind: "probe", role: "delivery", metadataStripped: false, status: "pending",
      encoding: { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 },
      normalization: "applied", access: "private", title: "probe",
      refs: { mediaJobId: jobId as never }, contentHash: "c1", createdBy: "system",
    },
  });
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
  await t.mutation(internal.audioArtifacts.attachStorage, { artifactId, storageId });
  return artifactId;
}

describe("mediaJobs lifecycle", () => {
  test("enqueue dedupes identical snapshots into one row", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.mediaJobs.enqueue, { input: probe });
    const second = await t.mutation(internal.mediaJobs.enqueue, { input: probe });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.jobId).toBe(first.jobId);
    const rows = await t.run((ctx) => ctx.db.query("mediaJobs").collect());
    expect(rows).toHaveLength(1);
  });

  test("claim issues a lease; a second claim for the same kinds gets null", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.mediaJobs.enqueue, { input: probe });
    const claim = await t.mutation(internal.mediaJobs.claimNext, { workerId: "w1", kinds: ["probe"] });
    expect(claim?.kind).toBe("probe");
    expect(claim?.leaseToken).toMatch(/[0-9a-f-]{36}/);
    expect(claim!.leaseExpiresAt - Date.now()).toBeGreaterThan(LEASE_MS - 5_000);
    expect(await t.mutation(internal.mediaJobs.claimNext, { workerId: "w2", kinds: ["probe"] })).toBeNull();
  });

  test("complete is fenced by lease token and applies probe effects", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, { input: probe });
    const claim = await t.mutation(internal.mediaJobs.claimNext, { workerId: "w1", kinds: ["probe"] });
    const artifactId = await pendingArtifact(t, jobId);
    const result = {
      kind: "probe" as const,
      artifacts: [{ artifactId, durationSecs: 1, loudnessLufs: -16, truePeakDbtp: -1.5, mimeType: "audio/mpeg" }],
    };
    await expect(
      t.mutation(internal.mediaJobs.complete, { jobId, leaseToken: "wrong", result }),
    ).rejects.toThrow(/lease/);
    const done = await t.mutation(internal.mediaJobs.complete, { jobId, leaseToken: claim!.leaseToken, result });
    expect(done.status).toBe("done");
    expect(done.resultArtifactIds).toEqual([artifactId]);
    const artifact = await t.run((ctx) => ctx.db.get(artifactId));
    expect(artifact?.status).toBe("ready");
    // Repeat completion with the same lease returns the stored result.
    const again = await t.mutation(internal.mediaJobs.complete, { jobId, leaseToken: claim!.leaseToken, result });
    expect(again.resultArtifactIds).toEqual([artifactId]);
  });

  test("a stale worker cannot complete after its lease expired and the job was re-claimed", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, { input: probe });
    const stale = await t.mutation(internal.mediaJobs.claimNext, { workerId: "w1", kinds: ["probe"] });
    await t.run((ctx) => ctx.db.patch(jobId, { leaseExpiresAt: Date.now() - 1 }));
    const swept = await t.mutation(internal.mediaJobs.sweepStale, {});
    expect(swept.requeued).toBe(1);
    const fresh = await t.mutation(internal.mediaJobs.claimNext, { workerId: "w2", kinds: ["probe"] });
    expect(fresh?.attempts).toBe(1);
    const artifactId = await pendingArtifact(t, jobId);
    const result = {
      kind: "probe" as const,
      artifacts: [{ artifactId, durationSecs: 1, loudnessLufs: -16, truePeakDbtp: -1.5, mimeType: "audio/mpeg" }],
    };
    await expect(
      t.mutation(internal.mediaJobs.complete, { jobId, leaseToken: stale!.leaseToken, result }),
    ).rejects.toThrow(/lease/);
    const row = await t.run((ctx) => ctx.db.get(jobId));
    expect(row?.status).toBe("claimed");
    expect(row?.workerId).toBe("w2");
  });

  test("fail re-queues until MAX_ATTEMPTS then parks", async () => {
    const t = convexTest(schema, modules);
    const { jobId } = await t.mutation(internal.mediaJobs.enqueue, { input: probe });
    for (let attempt = 1; attempt <= 3; attempt++) {
      const claim = await t.mutation(internal.mediaJobs.claimNext, { workerId: "w1", kinds: ["probe"] });
      const outcome = await t.mutation(internal.mediaJobs.fail, {
        jobId, leaseToken: claim!.leaseToken, error: `boom ${attempt}`,
      });
      expect(outcome.attempts).toBe(attempt);
      expect(outcome.status).toBe(attempt < 3 ? "queued" : "parked");
    }
    expect(await t.mutation(internal.mediaJobs.claimNext, { workerId: "w1", kinds: ["probe"] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test convex/mediaJobs.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the effects module**

```ts
// convex/mediaJobEffects.ts
// Kind-specific domain effects applied inside mediaJobs.complete. The media
// service never writes research data; everything it produces passes through
// here, validated by kind. Nothing in this file may touch listeningSessions.
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { MediaJobResult } from "./shared/mediaJobs";

async function readyArtifacts(
  ctx: MutationCtx,
  job: Doc<"mediaJobs">,
  artifacts: MediaJobResult["artifacts"],
): Promise<Id<"audioArtifacts">[]> {
  const ids: Id<"audioArtifacts">[] = [];
  for (const artifact of artifacts) {
    const row = await ctx.db.get(artifact.artifactId);
    if (!row || row.refs.mediaJobId !== job._id) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: `Artifact ${artifact.artifactId} does not belong to job ${job._id}`,
      });
    }
    await ctx.runMutation(internal.audioArtifacts.markReady, {
      artifactId: artifact.artifactId,
      durationSecs: artifact.durationSecs,
      loudnessLufs: artifact.loudnessLufs,
      truePeakDbtp: artifact.truePeakDbtp,
      mimeType: artifact.mimeType,
    });
    ids.push(artifact.artifactId);
  }
  return ids;
}

export async function applyMediaJobResult(
  ctx: MutationCtx,
  job: Doc<"mediaJobs">,
  result: MediaJobResult,
): Promise<Id<"audioArtifacts">[]> {
  switch (result.kind) {
    case "probe":
      return await readyArtifacts(ctx, job, result.artifacts);
    default: {
      const never: never = result.kind;
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: `Unknown result kind ${never}` });
    }
  }
}
```

- [ ] **Step 4: Write the lifecycle module**

```ts
// convex/mediaJobs.ts
// Pull-based, leased job lifecycle. Convex never calls the media service.
import { zodToConvex } from "convex-helpers/server/zod4";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { applyMediaJobResult } from "./mediaJobEffects";
import {
  LEASE_MS,
  MAX_ATTEMPTS,
  mediaJobDedupeKey,
  mediaJobInputValidator,
  mediaJobInputZ,
  mediaJobResultValidator,
  mediaJobResultZ,
  mediaJobKindZ,
  type ClaimedMediaJob,
} from "./shared/mediaJobs";

const SWEEP_LIMIT = 100;

const claimedReturn = v.union(
  v.null(),
  v.object({
    jobId: v.string(),
    kind: v.string(),
    input: mediaJobInputValidator,
    leaseToken: v.string(),
    leaseExpiresAt: v.number(),
    attempts: v.number(),
  }),
);

function requireLease(job: Doc<"mediaJobs"> | null, leaseToken: string, now: number): Doc<"mediaJobs"> {
  if (!job) throw new ConvexError({ code: "NOT_FOUND", message: "Media job not found" });
  if (job.status !== "claimed" || job.leaseToken !== leaseToken) {
    throw new ConvexError({ code: "LEASE_MISMATCH", message: "Media job lease does not match" });
  }
  if ((job.leaseExpiresAt ?? 0) < now) {
    throw new ConvexError({ code: "LEASE_EXPIRED", message: "Media job lease has expired" });
  }
  return job;
}

export const enqueue = internalMutation({
  args: { input: mediaJobInputValidator, priority: v.optional(v.number()) },
  returns: v.object({ jobId: v.id("mediaJobs"), created: v.boolean() }),
  handler: async (ctx, args) => {
    const input = mediaJobInputZ.parse(args.input);
    const dedupeKey = mediaJobDedupeKey(input);
    const existing = await ctx.db
      .query("mediaJobs")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "queued"),
          q.eq(q.field("status"), "claimed"),
          q.eq(q.field("status"), "done"),
        ),
      )
      .first();
    if (existing) return { jobId: existing._id, created: false };
    const jobId = await ctx.db.insert("mediaJobs", {
      kind: input.kind,
      input,
      dedupeKey,
      status: "queued",
      priority: args.priority ?? 0,
      attempts: 0,
      createdAt: Date.now(),
    });
    return { jobId, created: true };
  },
});

export const claimNext = internalMutation({
  args: { workerId: v.string(), kinds: v.array(v.string()) },
  returns: claimedReturn,
  handler: async (ctx, args): Promise<ClaimedMediaJob | null> => {
    const kinds = args.kinds.map((kind) => mediaJobKindZ.parse(kind));
    const now = Date.now();
    const candidates = await ctx.db
      .query("mediaJobs")
      .withIndex("by_status_priority_createdAt", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(50);
    const job = candidates.find((row) => kinds.includes(row.kind as (typeof kinds)[number]));
    if (!job) return null;
    const leaseToken = crypto.randomUUID();
    const leaseExpiresAt = now + LEASE_MS;
    await ctx.db.patch(job._id, {
      status: "claimed",
      leaseToken,
      leaseExpiresAt,
      workerId: args.workerId,
      claimedAt: now,
    });
    return {
      jobId: job._id,
      kind: job.kind as ClaimedMediaJob["kind"],
      input: job.input,
      leaseToken,
      leaseExpiresAt,
      attempts: job.attempts,
    };
  },
});

export const renewLease = internalMutation({
  args: { jobId: v.id("mediaJobs"), leaseToken: v.string() },
  returns: v.object({ leaseExpiresAt: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = requireLease(await ctx.db.get(args.jobId), args.leaseToken, now);
    const leaseExpiresAt = now + LEASE_MS;
    await ctx.db.patch(job._id, { leaseExpiresAt });
    return { leaseExpiresAt };
  },
});

export const complete = internalMutation({
  args: { jobId: v.id("mediaJobs"), leaseToken: v.string(), result: mediaJobResultValidator },
  returns: v.object({
    jobId: v.id("mediaJobs"),
    status: v.literal("done"),
    resultArtifactIds: v.array(v.id("audioArtifacts")),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = await ctx.db.get(args.jobId);
    // Idempotent repeat: same lease, already done → stored result.
    if (job && job.status === "done" && job.leaseToken === args.leaseToken) {
      return { jobId: job._id, status: "done" as const, resultArtifactIds: job.resultArtifactIds ?? [] };
    }
    const live = requireLease(job, args.leaseToken, now);
    const result = mediaJobResultZ.parse(args.result);
    if (result.kind !== live.kind) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Result kind does not match job kind" });
    }
    const resultArtifactIds = await applyMediaJobResult(ctx, live, result);
    await ctx.db.patch(live._id, {
      status: "done",
      result,
      resultArtifactIds,
      finishedAt: now,
    });
    return { jobId: live._id, status: "done" as const, resultArtifactIds };
  },
});

async function requeueOrPark(
  ctx: MutationCtx,
  job: Doc<"mediaJobs">,
  error: string,
  now: number,
): Promise<{ status: "queued" | "parked"; attempts: number }> {
  const attempts = job.attempts + 1;
  const status = attempts >= MAX_ATTEMPTS ? "parked" : "queued";
  await ctx.db.patch(job._id, {
    status,
    attempts,
    error: error.slice(0, 2000),
    leaseToken: undefined,
    leaseExpiresAt: undefined,
    workerId: undefined,
    ...(status === "parked" ? { finishedAt: now } : {}),
  });
  return { status, attempts };
}

export const fail = internalMutation({
  args: { jobId: v.id("mediaJobs"), leaseToken: v.string(), error: v.string() },
  returns: v.object({ status: v.union(v.literal("queued"), v.literal("parked")), attempts: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = requireLease(await ctx.db.get(args.jobId), args.leaseToken, now);
    return await requeueOrPark(ctx, job, args.error, now);
  },
});

// Expired leases count as attempts (spec §3.3).
export const sweepStale = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.object({ requeued: v.number(), parked: v.number() }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const expired = await ctx.db
      .query("mediaJobs")
      .withIndex("by_status_leaseExpiresAt", (q) => q.eq("status", "claimed").lt("leaseExpiresAt", now))
      .take(SWEEP_LIMIT);
    let requeued = 0;
    let parked = 0;
    for (const job of expired) {
      const outcome = await requeueOrPark(ctx, job, "lease expired", now);
      if (outcome.status === "queued") requeued++;
      else parked++;
    }
    return { requeued, parked };
  },
});

export type { Id };
```

Note on `ctx.runMutation` inside `mediaJobEffects.ts`: Convex mutations may call `ctx.runMutation` on internal mutations in the same transaction. If the project's Convex version rejects it for the `MutationCtx` type, replace the call with a direct `ctx.db.patch` of the same fields (copy the body of `markReady`).

- [ ] **Step 5: Register modules and run tests**

Add to `harness/modules.ts`:
`"./mediaJobEffects.ts": () => import("../convex/mediaJobEffects"),`
`"./mediaJobs.ts": () => import("../convex/mediaJobs"),`

Run: `vp test convex/mediaJobs.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add convex/mediaJobs.ts convex/mediaJobEffects.ts convex/mediaJobs.test.ts harness/modules.ts
git commit -m "feat(convex): leased media job lifecycle with fenced completion"
```

---

### Task 6: Orphan sweep and cron (`convex/mediaSweeper.ts`, `convex/crons.ts`)

**Files:**
- Create: `convex/mediaSweeper.ts`
- Test: `convex/mediaSweeper.test.ts`
- Modify: `convex/crons.ts` (append before `export default crons;`)
- Modify: `harness/modules.ts`

**Interfaces:**
- Produces internal mutation `mediaSweeper.sweep({ now?, orphanAgeMs? })` → `{ requeued, parked, artifactsDeleted, blobsDeleted }`.
- Consumes: `mediaJobs.sweepStale`, `audioArtifacts.listByStatusOlderThan`.

- [ ] **Step 1: Write the failing test**

```ts
// convex/mediaSweeper.test.ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";

const DAY = 24 * 60 * 60 * 1000;

describe("mediaSweeper", () => {
  test("deletes stale pending artifacts with their blobs and unreferenced blobs, keeps fresh and referenced ones", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const staleBlob = await t.run((ctx) => ctx.storage.store(new Blob(["stale"])));
    const orphanBlob = await t.run((ctx) => ctx.storage.store(new Blob(["orphan"])));
    const keptBlob = await t.run((ctx) => ctx.storage.store(new Blob(["kept"])));
    await t.run(async (ctx) => {
      const base = {
        kind: "probe" as const, role: "delivery" as const, metadataStripped: false,
        encoding: { codec: "mp3" as const, bitrateKbps: 128, sampleRate: 48000, channels: 2 },
        normalization: "applied" as const, access: "private" as const, title: "p", refs: {},
        contentHash: "c", createdBy: "system" as const,
      };
      await ctx.db.insert("audioArtifacts", { ...base, status: "pending", storageId: staleBlob, createdAt: now - 2 * DAY, updatedAt: now - 2 * DAY });
      await ctx.db.insert("audioArtifacts", { ...base, status: "pending", createdAt: now, updatedAt: now });
      await ctx.db.insert("audioArtifacts", { ...base, status: "ready", storageId: keptBlob, createdAt: now - 3 * DAY, updatedAt: now });
    });
    // Blobs stored by this test are seconds old, so the blob age is set to 0 while
    // the artifact age stays at a minute: the fresh pending artifact survives.
    const result = await t.mutation(internal.mediaSweeper.sweep, {
      now: Date.now() + 1,
      orphanAgeMs: 60_000,
      blobAgeMs: 0,
    });
    expect(result.artifactsDeleted).toBe(1);
    expect(result.blobsDeleted).toBe(2); // staleBlob via artifact, orphanBlob via _storage scan
    const remaining = await t.run((ctx) => ctx.db.system.query("_storage").collect());
    expect(remaining.map((row) => row._id)).toEqual([keptBlob]);
    const artifacts = await t.run((ctx) => ctx.db.query("audioArtifacts").collect());
    expect(artifacts).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test convex/mediaSweeper.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the sweeper**

```ts
// convex/mediaSweeper.ts
// Reclaims expired leases, abandoned pending artifacts, and storage blobs no
// artifact references (a worker that crashed between upload and attach).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const DEFAULT_ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const SCAN_LIMIT = 200;

export const sweep = internalMutation({
  args: {
    now: v.optional(v.number()),
    orphanAgeMs: v.optional(v.number()), // pending artifacts older than this
    blobAgeMs: v.optional(v.number()), // unreferenced blobs older than this
  },
  returns: v.object({
    requeued: v.number(),
    parked: v.number(),
    artifactsDeleted: v.number(),
    blobsDeleted: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const cutoff = now - (args.orphanAgeMs ?? DEFAULT_ORPHAN_AGE_MS);
    const blobCutoff = now - (args.blobAgeMs ?? DEFAULT_ORPHAN_AGE_MS);

    const leases = await ctx.runMutation(internal.mediaJobs.sweepStale, { now });

    let artifactsDeleted = 0;
    let blobsDeleted = 0;
    const stalePending = await ctx.db
      .query("audioArtifacts")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "pending").lt("createdAt", cutoff))
      .take(SCAN_LIMIT);
    for (const row of stalePending) {
      if (row.storageId) {
        await ctx.storage.delete(row.storageId);
        blobsDeleted++;
      }
      await ctx.db.delete(row._id);
      artifactsDeleted++;
    }

    const blobs = await ctx.db.system.query("_storage").take(SCAN_LIMIT);
    for (const blob of blobs) {
      if (blob._creationTime > blobCutoff) continue;
      const referenced = await ctx.db
        .query("audioArtifacts")
        .withIndex("by_storageId", (q) => q.eq("storageId", blob._id))
        .first();
      if (referenced) continue;
      await ctx.storage.delete(blob._id);
      blobsDeleted++;
    }

    return { ...leases, artifactsDeleted, blobsDeleted };
  },
});
```

- [ ] **Step 4: Add the cron**

Append to `convex/crons.ts` before `export default crons;`:

```ts
// Reclaim expired media leases and orphaned audio uploads. Leases are 10
// minutes; a 10-minute sweep bounds a crashed worker's hold on a job.
crons.interval(
  "sweep-stale-media-jobs",
  { minutes: 10 },
  internal.mediaSweeper.sweep,
  {},
);
```

- [ ] **Step 5: Register, run tests, commit**

Add to `harness/modules.ts`: `"./mediaSweeper.ts": () => import("../convex/mediaSweeper"),`

Run: `vp test convex/mediaSweeper.test.ts convex/mediaJobs.test.ts`
Expected: PASS.

```bash
git add convex/mediaSweeper.ts convex/mediaSweeper.test.ts convex/crons.ts harness/modules.ts
git commit -m "feat(convex): media sweeper for expired leases and orphaned uploads"
```

---

### Task 7: Blind group projection (`convex/blindGroups.ts`)

**Files:**
- Create: `convex/blindGroups.ts`
- Test: `convex/blindGroups.test.ts`
- Modify: `harness/modules.ts`

**Interfaces:**
- Produces internal mutation `blindGroups.create({ purpose, members: { artifactId, label }[], xMember?: { artifactId, duplicatesLabel } , requiredAll?: boolean })` → `{ groupId, memberIds }` (generates opaque `memberId`s, stamps `blindGroupId` on every member artifact); internal query `blindGroups.projectionInternal({ groupId })` and Clerk query `blindGroups.projection({ groupId })` → `{ groupId, purpose, revealed: boolean, members: { memberId, label, durationSecs?, playbackUrl }[], labels?: Record<memberId, artifactId> }` where `labels` is present only when revealed; internal mutation `blindGroups.reveal({ groupId })`. Rating tables and the atomic "last rating reveals" mutation are wave 1's; this task supplies `reveal` for them to call inside their mutation.

- [ ] **Step 1: Write the failing test**

```ts
// convex/blindGroups.test.ts
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
import schema from "./schema";

async function readyArtifact(t: ReturnType<typeof convexTest>, title: string) {
  const artifactId = await t.mutation(internal.audioArtifacts.createPending, {
    fields: {
      kind: "shootoutTake", role: "delivery", metadataStripped: true, status: "pending",
      encoding: { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 },
      normalization: "applied", access: "private", title, refs: {},
      contentHash: title, createdBy: "system",
      engine: { name: "tts", version: "1", params: { voice: title } },
    },
  });
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob([title])));
  await t.mutation(internal.audioArtifacts.attachStorage, { artifactId, storageId });
  await t.mutation(internal.audioArtifacts.markReady, {
    artifactId, durationSecs: 90, loudnessLufs: -16, truePeakDbtp: -1.2, mimeType: "audio/mpeg",
  });
  return artifactId;
}

describe("blindGroups", () => {
  test("projection exposes only opaque ids, labels, duration, and url until reveal", async () => {
    const t = convexTest(schema, modules);
    const a = await readyArtifact(t, "gemini");
    const b = await readyArtifact(t, "breeze");
    const { groupId, memberIds } = await t.mutation(internal.blindGroups.create, {
      purpose: "voiceShootout",
      members: [{ artifactId: a, label: "take one" }, { artifactId: b, label: "take two" }],
    });
    expect(memberIds).toHaveLength(2);
    const blind = await t.query(internal.blindGroups.projectionInternal, { groupId });
    expect(blind.revealed).toBe(false);
    expect(blind.labels).toBeUndefined();
    for (const member of blind.members) {
      expect(Object.keys(member).toSorted()).toEqual(["durationSecs", "label", "memberId", "playbackUrl"]);
      expect(JSON.stringify(member)).not.toMatch(/gemini|breeze/);
    }
    // Member artifacts are hidden from ordinary playback while blind.
    expect(await t.query(internal.audioArtifacts.playbackInternal, { artifactId: a })).toBeNull();

    await t.mutation(internal.blindGroups.reveal, { groupId });
    const revealed = await t.query(internal.blindGroups.projectionInternal, { groupId });
    expect(revealed.revealed).toBe(true);
    expect(revealed.labels).toEqual({ [memberIds[0]!]: a, [memberIds[1]!]: b });
  });

  test("create rejects duplicate artifacts and non-ready members; reveal is idempotent", async () => {
    const t = convexTest(schema, modules);
    const a = await readyArtifact(t, "one");
    await expect(
      t.mutation(internal.blindGroups.create, {
        purpose: "voiceShootout",
        members: [{ artifactId: a, label: "x" }, { artifactId: a, label: "y" }],
      }),
    ).rejects.toThrow(/distinct/);
    const { groupId } = await t.mutation(internal.blindGroups.create, {
      purpose: "voiceShootout",
      members: [{ artifactId: a, label: "x" }],
    });
    await t.mutation(internal.blindGroups.reveal, { groupId });
    const first = await t.run((ctx) => ctx.db.get(groupId));
    await t.mutation(internal.blindGroups.reveal, { groupId });
    const second = await t.run((ctx) => ctx.db.get(groupId));
    expect(second?.revealedAt).toBe(first?.revealedAt);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test convex/blindGroups.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the module**

```ts
// convex/blindGroups.ts
// Blindness by projection: this is the only query that serves an unrevealed
// group, and it returns nothing that identifies a member.
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireAuth } from "./auth";

const memberInput = v.object({ artifactId: v.id("audioArtifacts"), label: v.string() });

const projectionReturn = v.object({
  groupId: v.id("blindGroups"),
  purpose: v.union(v.literal("voiceShootout"), v.literal("studyFamily")),
  revealed: v.boolean(),
  members: v.array(
    v.object({
      memberId: v.string(),
      label: v.string(),
      durationSecs: v.optional(v.number()),
      playbackUrl: v.string(),
    }),
  ),
  labels: v.optional(v.record(v.string(), v.id("audioArtifacts"))),
});

export const create = internalMutation({
  args: {
    purpose: v.union(v.literal("voiceShootout"), v.literal("studyFamily")),
    members: v.array(memberInput),
    xMember: v.optional(v.object({ artifactId: v.id("audioArtifacts"), duplicatesLabel: v.string() })),
  },
  returns: v.object({ groupId: v.id("blindGroups"), memberIds: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const all = [...args.members, ...(args.xMember ? [{ artifactId: args.xMember.artifactId, label: "X" }] : [])];
    const distinct = new Set(all.map((member) => member.artifactId));
    if (distinct.size !== all.length || all.length === 0) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Blind group members must be distinct artifacts" });
    }
    for (const member of all) {
      const row = await ctx.db.get(member.artifactId);
      if (!row || row.status !== "ready") {
        throw new ConvexError({ code: "INVALID_STATE", message: `Artifact ${member.artifactId} is not ready` });
      }
      if (row.blindGroupId) {
        throw new ConvexError({ code: "INVALID_STATE", message: `Artifact ${member.artifactId} already belongs to a blind group` });
      }
    }
    const members = all.map((member) => ({ ...member, memberId: crypto.randomUUID() }));
    const xEntry = args.xMember ? members[members.length - 1]! : undefined;
    const ratedMembers = xEntry ? members.filter((member) => member.memberId !== xEntry.memberId) : members;
    const now = Date.now();
    const groupId = await ctx.db.insert("blindGroups", {
      purpose: args.purpose,
      members: members.map(({ memberId, artifactId, label }) => ({ memberId, artifactId, label })),
      ...(xEntry && args.xMember
        ? { xMember: { memberId: xEntry.memberId, duplicates: args.xMember.duplicatesLabel } }
        : {}),
      requiredRatings: ratedMembers.map((member) => member.memberId),
      createdAt: now,
    });
    for (const member of members) {
      await ctx.db.patch(member.artifactId, { blindGroupId: groupId, updatedAt: now });
    }
    return { groupId, memberIds: members.map((member) => member.memberId) };
  },
});

async function project(ctx: QueryCtx, groupId: Id<"blindGroups">) {
  const group = await ctx.db.get(groupId);
  if (!group) throw new ConvexError({ code: "NOT_FOUND", message: "Blind group not found" });
  const revealed = group.revealedAt !== undefined;
  const members = [];
  const labels: Record<string, Id<"audioArtifacts">> = {};
  for (const member of group.members) {
    const artifact = await ctx.db.get(member.artifactId);
    if (!artifact?.storageId) continue;
    const playbackUrl = await ctx.storage.getUrl(artifact.storageId);
    if (!playbackUrl) continue;
    members.push({
      memberId: member.memberId,
      label: member.label,
      durationSecs: artifact.durationSecs,
      playbackUrl,
    });
    labels[member.memberId] = member.artifactId;
  }
  return {
    groupId: group._id,
    purpose: group.purpose,
    revealed,
    members,
    ...(revealed ? { labels } : {}),
  };
}

export const projectionInternal = internalQuery({
  args: { groupId: v.id("blindGroups") },
  returns: projectionReturn,
  handler: async (ctx, args) => project(ctx, args.groupId),
});

export const projection = query({
  args: { groupId: v.id("blindGroups"), devBypassSecret: v.optional(v.string()) },
  returns: projectionReturn,
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await project(ctx, args.groupId);
  },
});

export const reveal = internalMutation({
  args: { groupId: v.id("blindGroups") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new ConvexError({ code: "NOT_FOUND", message: "Blind group not found" });
    if (group.revealedAt === undefined) {
      await ctx.db.patch(args.groupId, { revealedAt: Date.now() });
    }
    return null;
  },
});
```

- [ ] **Step 4: Register, run, commit**

Add to `harness/modules.ts`: `"./blindGroups.ts": () => import("../convex/blindGroups"),`

Run: `vp test convex/blindGroups.test.ts convex/audioArtifacts.test.ts`
Expected: PASS.

```bash
git add convex/blindGroups.ts convex/blindGroups.test.ts harness/modules.ts
git commit -m "feat(convex): blind groups with server-side projection"
```

---

### Task 8: Media lifecycle tools on `/agent-tools/*`

**Files:**
- Modify: `convex/shared/agentToolArgs.ts` (add six entries before the closing `} as const;`)
- Modify: `convex/shared/agentToolManifest.ts` (add kind `"media_write"` to the union, six `entry(...)` calls at the end of `AGENT_TOOL_MANIFEST`)
- Modify: `convex/agentToolRegistry.ts` (six `runs` entries)
- Modify: `convex/agentTools.ts` (six exports)
- Modify: `scripts/lib/agentToolDocs.ts` (new section)
- Modify: `convex/agentToolRegistry.test.ts` (`FROZEN_ARGS` entries)
- Modify: `docs/agent-tool-surface.md` (regenerated)
- Create: `convex/mediaToolsInternal.ts` (the `generateAudioUploadUrl` mutation that both creates the pending row and returns the upload URL)

**Interfaces:**
- Produces HTTP tools: `claimNextMediaJob { workerId, kinds }`, `renewMediaJobLease { jobId, leaseToken }`, `generateAudioUploadUrl { jobId, leaseToken, artifact }` → `{ artifactId, uploadUrl }`, `attachAudioStorage { jobId, leaseToken, artifactId, storageId }`, `completeMediaJob { jobId, leaseToken, result }`, `failMediaJob { jobId, leaseToken, error }`.
- Consumes: Tasks 4, 5.

- [ ] **Step 1: Extend the frozen-args test first**

In `convex/agentToolRegistry.test.ts`, add to `FROZEN_ARGS`:

```ts
  claimNextMediaJob: frozenArgs({
    workerId: field(string),
    kinds: field(array(string)),
  }),
  renewMediaJobLease: frozenArgs({
    jobId: field(id("mediaJobs")),
    leaseToken: field(string),
  }),
  generateAudioUploadUrl: frozenArgs({
    jobId: field(id("mediaJobs")),
    leaseToken: field(string),
    artifact: field(any),
  }),
  attachAudioStorage: frozenArgs({
    jobId: field(id("mediaJobs")),
    leaseToken: field(string),
    artifactId: field(id("audioArtifacts")),
    storageId: field(id("_storage")),
  }),
  completeMediaJob: frozenArgs({
    jobId: field(id("mediaJobs")),
    leaseToken: field(string),
    result: field(any),
  }),
  failMediaJob: frozenArgs({
    jobId: field(id("mediaJobs")),
    leaseToken: field(string),
    error: field(string),
  }),
```

Run: `vp test convex/agentToolRegistry.test.ts`
Expected: FAIL, the manifest lacks the new names.

- [ ] **Step 2: Add args**

In `convex/shared/agentToolArgs.ts` before `} as const;`:

```ts
  // Media lifecycle (wave 0). Artifact fields and results are validated by
  // their zod contracts inside the backing mutations; the transport passes any.
  claimNextMediaJob: z.object({
    workerId: z.string().min(1),
    kinds: z.array(z.string().min(1)).min(1),
  }),
  renewMediaJobLease: z.object({ jobId: zid("mediaJobs"), leaseToken: z.string().min(1) }),
  generateAudioUploadUrl: z.object({
    jobId: zid("mediaJobs"),
    leaseToken: z.string().min(1),
    artifact: z.any(),
  }),
  attachAudioStorage: z.object({
    jobId: zid("mediaJobs"),
    leaseToken: z.string().min(1),
    artifactId: zid("audioArtifacts"),
    storageId: zid("_storage"),
  }),
  completeMediaJob: z.object({
    jobId: zid("mediaJobs"),
    leaseToken: z.string().min(1),
    result: z.any(),
  }),
  failMediaJob: z.object({
    jobId: zid("mediaJobs"),
    leaseToken: z.string().min(1),
    error: z.string().min(1),
  }),
```

- [ ] **Step 3: Add manifest entries**

In `convex/shared/agentToolManifest.ts` change the `kind` type in both places to
`"read" | "research_write" | "audit_write" | "media_write"`, then append:

```ts
  entry(
    "claimNextMediaJob",
    "media_write",
    "internal.mediaJobs:claimNext",
    "Claim the oldest queued media job whose kind is in the caller's list and issue a 10-minute lease.",
    "Media service only. A lifecycle write; never research data.",
    { langchain: false },
  ),
  entry(
    "renewMediaJobLease",
    "media_write",
    "internal.mediaJobs:renewLease",
    "Extend a claimed media job's lease; fails when the token no longer matches.",
    "Call every few minutes while rendering.",
    { langchain: false },
  ),
  entry(
    "generateAudioUploadUrl",
    "media_write",
    "internal.mediaToolsInternal:generateAudioUploadUrl",
    "Create a pending audio artifact for a leased job and return a storage upload URL.",
    "Upload, then call attachAudioStorage with the returned storageId immediately.",
    { langchain: false },
  ),
  entry(
    "attachAudioStorage",
    "media_write",
    "internal.mediaToolsInternal:attachAudioStorage",
    "Record the uploaded storage id on a pending artifact.",
    "Fenced by the job lease. Blobs never attached are reclaimed by the sweeper.",
    { langchain: false },
  ),
  entry(
    "completeMediaJob",
    "media_write",
    "internal.mediaJobs:complete",
    "Complete a leased job with a kind-specific result; Convex validates it and applies domain effects atomically.",
    "Fenced by lease token and expiry. Repeating with the same lease returns the stored result.",
    { langchain: false },
  ),
  entry(
    "failMediaJob",
    "media_write",
    "internal.mediaJobs:fail",
    "Fail a leased job; it re-queues with attempts+1 and parks after three.",
    "Error text is truncated server-side; never include secrets.",
    { langchain: false },
  ),
```

- [ ] **Step 4: Write the internal helpers module**

```ts
// convex/mediaToolsInternal.ts
// Lease-fenced wrappers that the media tools call. Upload URLs are minted here
// so a pending artifact row always exists before bytes are uploaded.
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { audioArtifactFieldsZ } from "./shared/audioArtifacts";

async function assertLease(ctx: MutationCtx, jobId: Id<"mediaJobs">, leaseToken: string): Promise<void> {
  const job = await ctx.db.get(jobId);
  if (
    !job ||
    job.status !== "claimed" ||
    job.leaseToken !== leaseToken ||
    (job.leaseExpiresAt ?? 0) < Date.now()
  ) {
    throw new ConvexError({ code: "LEASE_MISMATCH", message: "Media job lease does not match" });
  }
}

export const generateAudioUploadUrl = internalMutation({
  args: { jobId: v.id("mediaJobs"), leaseToken: v.string(), artifact: v.any() },
  returns: v.object({ artifactId: v.id("audioArtifacts"), uploadUrl: v.string() }),
  handler: async (ctx, args) => {
    await assertLease(ctx, args.jobId, args.leaseToken);
    const now = Date.now();
    const fields = audioArtifactFieldsZ.parse({
      ...args.artifact,
      status: "pending",
      refs: { ...(args.artifact?.refs ?? {}), mediaJobId: args.jobId },
      createdAt: now,
      updatedAt: now,
    });
    const artifactId = await ctx.runMutation(internal.audioArtifacts.createPending, { fields });
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { artifactId, uploadUrl };
  },
});

export const attachAudioStorage = internalMutation({
  args: {
    jobId: v.id("mediaJobs"),
    leaseToken: v.string(),
    artifactId: v.id("audioArtifacts"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertLease(ctx, args.jobId, args.leaseToken);
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact || artifact.refs.mediaJobId !== args.jobId) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Artifact does not belong to this job" });
    }
    await ctx.runMutation(internal.audioArtifacts.attachStorage, {
      artifactId: args.artifactId,
      storageId: args.storageId,
    });
    return null;
  },
});
```

- [ ] **Step 5: Wire registry and actions**

In `convex/agentToolRegistry.ts` `runs`:

```ts
  claimNextMediaJob: (ctx, args) =>
    ctx.runMutation(internal.mediaJobs.claimNext, {
      workerId: args.workerId as string,
      kinds: args.kinds as string[],
    }),
  renewMediaJobLease: (ctx, args) =>
    ctx.runMutation(internal.mediaJobs.renewLease, {
      jobId: args.jobId as Id<"mediaJobs">,
      leaseToken: args.leaseToken as string,
    }),
  generateAudioUploadUrl: (ctx, args) =>
    ctx.runMutation(internal.mediaToolsInternal.generateAudioUploadUrl, {
      jobId: args.jobId as Id<"mediaJobs">,
      leaseToken: args.leaseToken as string,
      artifact: args.artifact,
    }),
  attachAudioStorage: (ctx, args) =>
    ctx.runMutation(internal.mediaToolsInternal.attachAudioStorage, {
      jobId: args.jobId as Id<"mediaJobs">,
      leaseToken: args.leaseToken as string,
      artifactId: args.artifactId as Id<"audioArtifacts">,
      storageId: args.storageId as Id<"_storage">,
    }),
  completeMediaJob: (ctx, args) =>
    ctx.runMutation(internal.mediaJobs.complete, {
      jobId: args.jobId as Id<"mediaJobs">,
      leaseToken: args.leaseToken as string,
      result: args.result as never,
    }),
  failMediaJob: (ctx, args) =>
    ctx.runMutation(internal.mediaJobs.fail, {
      jobId: args.jobId as Id<"mediaJobs">,
      leaseToken: args.leaseToken as string,
      error: args.error as string,
    }),
```

This matches how the file already references internal functions (for example `countPendingDrafts` uses `internal.agentDrafts.countPending`).

In `convex/agentTools.ts` append:

```ts
export const claimNextMediaJob = makeAgentToolAction("claimNextMediaJob");
export const renewMediaJobLease = makeAgentToolAction("renewMediaJobLease");
export const generateAudioUploadUrl = makeAgentToolAction("generateAudioUploadUrl");
export const attachAudioStorage = makeAgentToolAction("attachAudioStorage");
export const completeMediaJob = makeAgentToolAction("completeMediaJob");
export const failMediaJob = makeAgentToolAction("failMediaJob");
```

- [ ] **Step 6: Docs renderer section**

In `scripts/lib/agentToolDocs.ts` widen `table(kind)`'s parameter type to include `"media_write"` and add before `END`:

```ts
  "",
  "### Media lifecycle tools",
  "",
  "Used only by the media service on ai-5090-02 (a standing service identity). They claim, lease, upload for, complete, and fail media jobs. Completion validates a kind-specific result and applies domain effects inside Convex; the media service never writes research data and nothing here can create a listening session or decide a draft.",
  "",
  table("media_write"),
```

Run: `vpx tsx scripts/generate-agent-tool-docs.ts`
Expected: `docs/agent-tool-surface.md regenerated.`

- [ ] **Step 7: Register, test, commit**

Add to `harness/modules.ts`: `"./mediaToolsInternal.ts": () => import("../convex/mediaToolsInternal"),`

Run: `vp test convex/agentToolRegistry.test.ts convex/agentTools.test.ts && vp run typecheck:scripts`
Expected: PASS, no type errors.

```bash
git add convex/shared/agentToolArgs.ts convex/shared/agentToolManifest.ts convex/agentToolRegistry.ts convex/agentTools.ts convex/mediaToolsInternal.ts convex/agentToolRegistry.test.ts scripts/lib/agentToolDocs.ts docs/agent-tool-surface.md harness/modules.ts
git commit -m "feat(agent-tools): media lifecycle tools"
```

---

### Task 9: Podcast feed route (`convex/podcast.ts`, `convex/http.ts`)

**Files:**
- Create: `convex/podcast.ts`
- Test: `convex/podcast.test.ts`
- Modify: `convex/http.ts` (one `pathPrefix` route)
- Modify: `.env.schema`, `.env.test` (new variables)
- Modify: `harness/modules.ts`

**Interfaces:**
- Produces pure `buildFeedXml({ title, publicBaseUrl, episodes })`, `publicStorageUrl(storageUrl, publicBaseUrl)`, `feedTokenMatches(pathToken, expected)`; internal query `podcast.listFeedEpisodes({ limit })` → episode artifacts with `storageUrl`; HTTP `GET /podcast/<token>/feed.xml`.
- Env: `PODCAST_FEED_TOKEN` (secret, op ref `op://Country Manor Lab/podcast-feed-token/credential`), `PODCAST_PUBLIC_BASE_URL` (public, default `https://listen.rproj.art`).

- [ ] **Step 1: Write the failing tests**

```ts
// convex/podcast.test.ts
import { describe, expect, test } from "vite-plus/test";
import { buildFeedXml, feedTokenMatches, publicStorageUrl } from "./podcast";

describe("podcast feed", () => {
  test("token match is exact and constant-time-safe for prefixes and supersets", () => {
    expect(feedTokenMatches("abc", "abc")).toBe(true);
    expect(feedTokenMatches("ab", "abc")).toBe(false);
    expect(feedTokenMatches("abcd", "abc")).toBe(false);
    expect(feedTokenMatches("abc%20", "abc")).toBe(false);
    expect(feedTokenMatches("", "")).toBe(false);
  });

  test("storage urls are rewritten onto the public host", () => {
    expect(
      publicStorageUrl("http://convex.rproj.art:3211/api/storage/0123-abcd", "https://listen.rproj.art"),
    ).toBe("https://listen.rproj.art/api/storage/0123-abcd");
  });

  test("feed renders items newest first with enclosures and escapes text", () => {
    const xml = buildFeedXml({
      title: "Frequency Music, private",
      publicBaseUrl: "https://listen.rproj.art",
      episodes: [
        { id: "k1", title: "Weekly turn, week of 2026-09-21 & more", createdAt: 1_700_000_000_000, durationSecs: 600, sizeBytes: 9_600_000, mimeType: "audio/mpeg", storageUrl: "http://convex.rproj.art:3211/api/storage/one" },
        { id: "k2", title: "Older", createdAt: 1_600_000_000_000, durationSecs: 60, sizeBytes: 960_000, mimeType: "audio/mpeg", storageUrl: "http://convex.rproj.art:3211/api/storage/two" },
      ],
    });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<itunes:block>yes</itunes:block>");
    expect(xml).toContain("&amp; more");
    expect(xml.indexOf("api/storage/one")).toBeLessThan(xml.indexOf("api/storage/two"));
    expect(xml).toContain('url="https://listen.rproj.art/api/storage/one" length="9600000" type="audio/mpeg"');
    expect(xml).toContain("<guid isPermaLink=\"false\">k1</guid>");
    expect(xml).toContain("<itunes:duration>600</itunes:duration>");
  });

  test("empty feed is still valid", () => {
    const xml = buildFeedXml({ title: "t", publicBaseUrl: "https://x", episodes: [] });
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test convex/podcast.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the module**

```ts
// convex/podcast.ts
// Private podcast feed. Only feed.xml is served by an HTTP action; audio bytes
// come from storage URLs rewritten onto the public host. A wrong token is a
// 404 so the route is invisible to scanners.
import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { constantTimeEqual } from "./auth";

export type FeedEpisode = {
  id: string;
  title: string;
  createdAt: number;
  durationSecs?: number;
  sizeBytes: number;
  mimeType: string;
  storageUrl: string;
};

const FEED_LIMIT = 100;

export function feedTokenMatches(pathToken: string, expected: string | undefined): boolean {
  if (!expected || !pathToken) return false;
  return constantTimeEqual(pathToken, expected);
}

export function publicStorageUrl(storageUrl: string, publicBaseUrl: string): string {
  const parsed = new URL(storageUrl);
  return `${publicBaseUrl.replace(/\/$/, "")}${parsed.pathname}`;
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildFeedXml(args: {
  title: string;
  publicBaseUrl: string;
  episodes: FeedEpisode[];
}): string {
  const items = [...args.episodes]
    .toSorted((a, b) => b.createdAt - a.createdAt)
    .slice(0, FEED_LIMIT)
    .map((episode) => {
      const url = publicStorageUrl(episode.storageUrl, args.publicBaseUrl);
      const duration = episode.durationSecs === undefined ? "" : `<itunes:duration>${Math.round(episode.durationSecs)}</itunes:duration>`;
      return [
        "<item>",
        `<title>${escapeXml(episode.title)}</title>`,
        `<guid isPermaLink="false">${escapeXml(episode.id)}</guid>`,
        `<pubDate>${new Date(episode.createdAt).toUTCString()}</pubDate>`,
        `<enclosure url="${escapeXml(url)}" length="${episode.sizeBytes}" type="${escapeXml(episode.mimeType)}"/>`,
        duration,
        "</item>",
      ].join("");
    })
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">',
    "<channel>",
    `<title>${escapeXml(args.title)}</title>`,
    `<link>${escapeXml(args.publicBaseUrl)}</link>`,
    "<language>en-us</language>",
    "<itunes:author>Freq</itunes:author>",
    "<itunes:block>yes</itunes:block>",
    "<itunes:explicit>false</itunes:explicit>",
    '<itunes:category text="Music"/>',
    `<itunes:image href="${escapeXml(args.publicBaseUrl)}/podcast-cover.png"/>`,
    items,
    "</channel>",
    "</rss>",
  ].join("\n");
}

export const listFeedEpisodes = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<FeedEpisode[]> => {
    const rows = await ctx.db
      .query("audioArtifacts")
      .withIndex("by_access_kind_createdAt", (q) => q.eq("access", "feed").eq("kind", "episode"))
      .order("desc")
      .take(args.limit ?? FEED_LIMIT);
    const episodes: FeedEpisode[] = [];
    for (const row of rows) {
      if (row.status !== "ready" || !row.storageId) continue;
      const storageUrl = await ctx.storage.getUrl(row.storageId);
      const meta = await ctx.db.system.get(row.storageId);
      if (!storageUrl || !meta) continue;
      episodes.push({
        id: row._id,
        title: row.title,
        createdAt: row.createdAt,
        durationSecs: row.durationSecs,
        sizeBytes: meta.size,
        mimeType: row.mimeType ?? "audio/mpeg",
        storageUrl,
      });
    }
    return episodes;
  },
});
```

- [ ] **Step 4: Add the HTTP route**

In `convex/http.ts`, after the `/health` route:

```ts
import { buildFeedXml, feedTokenMatches } from "./podcast";

// Private podcast feed: /podcast/<token>/feed.xml. Wrong token → 404.
http.route({
  pathPrefix: "/podcast/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const path = new URL(request.url).pathname;
    const match = path.match(/^\/podcast\/([^/]+)\/feed\.xml$/);
    if (!match || !feedTokenMatches(match[1] ?? "", process.env.PODCAST_FEED_TOKEN)) {
      return new Response("Not found", { status: 404 });
    }
    const publicBaseUrl = process.env.PODCAST_PUBLIC_BASE_URL ?? "https://listen.rproj.art";
    const episodes = await ctx.runQuery(internal.podcast.listFeedEpisodes, {});
    const xml = buildFeedXml({ title: "Frequency Music, private", publicBaseUrl, episodes });
    return new Response(xml, {
      status: 200,
      headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "no-store" },
    });
  }),
});
```

- [ ] **Step 5: Env schema**

Append to `.env.schema` in the secrets block:

```
# Private podcast feed token (path segment). Rotating it re-subscribes Pocket Casts.
# @sensitive @optional
PODCAST_FEED_TOKEN=op("op://Country Manor Lab/podcast-feed-token/credential", allowMissing=true)
# Public host that proxies /podcast/* and /api/storage/* to the Convex site.
# @public @optional @type=url
PODCAST_PUBLIC_BASE_URL=https://listen.rproj.art
```

Append to `.env.test`: `PODCAST_FEED_TOKEN=test-placeholder`.

Keith creates the 1Password item `podcast-feed-token` in Country Manor Lab with a 32-byte random credential (`openssl rand -hex 32`); this plan never sees the value.

- [ ] **Step 6: Register, test, commit**

Add to `harness/modules.ts`: `"./podcast.ts": () => import("../convex/podcast"),`

Run: `vp test convex/podcast.test.ts && vp run typecheck:scripts`
Expected: PASS.

```bash
git add convex/podcast.ts convex/podcast.test.ts convex/http.ts .env.schema .env.test harness/modules.ts
git commit -m "feat(convex): private podcast feed route"
```

---

### Task 10: `media/` package scaffold and Convex client

**Files:**
- Create: `media/package.json`, `media/tsconfig.json`, `media/vite.config.ts`, `media/.env.schema`, `media/src/config.ts`, `media/src/convex.ts`, `media/src/log.ts`
- Test: `media/tests/convex.test.ts`
- Modify: root `package.json` scripts (`typecheck:media`, `test:media`, and add both to `typecheck`/`verify`)

**Interfaces:**
- Produces `loadConfig()` → `{ convexSiteUrl, agentToolSecret, workerId, pollIntervalMs, kinds: string[], rendererVersion }`; `callTool<T>(name, body, signal?)`; `redactError(error)`.

- [ ] **Step 1: Write the failing test**

```ts
// media/tests/convex.test.ts
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { callTool } from "../src/convex";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("callTool", () => {
  test("posts the secret in the body and returns parsed json", async () => {
    vi.stubEnv("CONVEX_SITE_URL", "http://convex.test:3211/");
    vi.stubEnv("AGENT_TOOL_SECRET", "s3cret");
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("http://convex.test:3211/agent-tools/claimNextMediaJob");
      expect(JSON.parse(String(init.body))).toEqual({ secret: "s3cret", workerId: "w", kinds: ["probe"] });
      return new Response(JSON.stringify({ jobId: "j1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await callTool<{ jobId: string }>("claimNextMediaJob", { workerId: "w", kinds: ["probe"] });
    expect(result).toEqual({ jobId: "j1" });
  });

  test("throws with status but never echoes the secret", async () => {
    vi.stubEnv("CONVEX_SITE_URL", "http://convex.test:3211");
    vi.stubEnv("AGENT_TOOL_SECRET", "s3cret");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope s3cret", { status: 403 })));
    await expect(callTool("failMediaJob", {})).rejects.toThrow(/403/);
    await expect(callTool("failMediaJob", {})).rejects.not.toThrow(/s3cret/);
  });
});
```

- [ ] **Step 2: Create the package**

`media/package.json`:

```json
{
  "name": "resonant-projects-media",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "vpx tsx src/main.ts",
    "test": "vp test",
    "typecheck": "vpx tsc --noEmit"
  },
  "dependencies": {
    "convex": "1.34.1",
    "convex-helpers": "0.1.120",
    "tsx": "4.23.4",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vite-plus": "*"
  }
}
```

Copy the exact `vite-plus` version from the root `package.json` devDependencies instead of `*`.

`media/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "../convex/shared/**/*.ts"]
}
```

`media/vite.config.ts`:

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
  },
});
```

`media/.env.schema`:

```
# Frequency Music — media service environment schema (varlock + 1Password)
# @defaultSensitive=true @defaultRequired=infer
# @currentEnv=$APP_ENV
# @plugin(@varlock/1password-plugin)
# @initOp(token=$OP_SERVICE_ACCOUNT_TOKEN, allowAppAuth=forEnv(dev))
# ---

# @public @type=enum(dev, ci, prod, test)
APP_ENV=dev
# @optional @type=opServiceAccountToken
OP_SERVICE_ACCOUNT_TOKEN=

# @public @type=url
CONVEX_SITE_URL=http://convex.rproj.art:3211
# @public @optional
MEDIA_WORKER_ID=ai-5090-02
# @public @optional @type=number
MEDIA_POLL_INTERVAL_MS=15000
# @public @optional
MEDIA_JOB_KINDS=probe
# @public @optional
MEDIA_WORK_DIR=/work

# @sensitive @required
AGENT_TOOL_SECRET=op(op://Country Manor Lab/agent-tool-secret/credential)
```

`media/src/log.ts`:

```ts
export function log(message: string, ...rest: unknown[]): void {
  console.log(`[media] ${message}`, ...rest);
}

const SECRET_PATTERN = /(secret|token|key)=?[^\s]*/gi;

export function redactError(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.replaceAll(SECRET_PATTERN, "$1=[REDACTED]");
}
```

`media/src/config.ts`:

```ts
import { z } from "zod";

const configZ = z.object({
  convexSiteUrl: z.string().url(),
  agentToolSecret: z.string().min(1),
  workerId: z.string().min(1),
  pollIntervalMs: z.number().int().min(1000),
  kinds: z.array(z.string().min(1)).min(1),
  workDir: z.string().min(1),
  rendererVersion: z.string().min(1),
});
export type MediaConfig = z.infer<typeof configZ>;

export const RENDERER_VERSION = "0.1.0";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): MediaConfig {
  return configZ.parse({
    convexSiteUrl: env.CONVEX_SITE_URL,
    agentToolSecret: env.AGENT_TOOL_SECRET,
    workerId: env.MEDIA_WORKER_ID ?? "media-local",
    pollIntervalMs: Number(env.MEDIA_POLL_INTERVAL_MS ?? 15000),
    kinds: (env.MEDIA_JOB_KINDS ?? "probe").split(",").map((kind) => kind.trim()).filter(Boolean),
    workDir: env.MEDIA_WORK_DIR ?? "/tmp/frequency-media",
    rendererVersion: RENDERER_VERSION,
  });
}
```

`media/src/convex.ts`:

```ts
// Thin HTTP client for /agent-tools/*. The secret travels in the body, as the
// worker does; error text never includes it.
export async function callTool<T>(
  name: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const base = process.env.CONVEX_SITE_URL;
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!base) throw new Error("CONVEX_SITE_URL is required");
  if (!secret) throw new Error("AGENT_TOOL_SECRET is required");
  const response = await fetch(`${base.replace(/\/$/, "")}/agent-tools/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret, ...body }),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    const text = (await response.text()).replaceAll(secret, "[REDACTED]").slice(0, 500);
    throw new Error(`Convex tool ${name} failed: ${response.status} ${text}`);
  }
  return (await response.json()) as T;
}
```

- [ ] **Step 3: Root scripts**

In root `package.json` scripts add:

```json
"typecheck:media": "cd media && vpx tsc --noEmit",
"test:media": "cd media && vp test",
```

and change `typecheck` to `"vp run typecheck:scripts && vp run typecheck:web && vp run typecheck:agent && vp run typecheck:media"` and `verify` to end with `&& vp run test:agent && vp run test:media`.

- [ ] **Step 4: Install and run the test**

Run: `cd media && vp install && cd .. && vp run test:media`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add media/package.json media/tsconfig.json media/vite.config.ts media/.env.schema media/src media/tests package.json
git add media/*.lock* 2>/dev/null || true
git commit -m "feat(media): package scaffold and Convex tool client"
```

---

### Task 11: ffmpeg wrappers: synthesis, measurement, loudness, encoding, metadata stripping

**Files:**
- Create: `media/src/audio/ffmpeg.ts`, `media/src/audio/loudness.ts`, `media/src/audio/encode.ts`, `media/src/audio/synth.ts`
- Test: `media/tests/loudness.test.ts`, `media/tests/encode.test.ts`

Prerequisite: ffmpeg on the machine running the tests. Locally: `sudo apt-get install -y ffmpeg` (Keith approves; ai-5090-02 already has `/usr/bin/ffmpeg`). Tests fail loudly with "ffmpeg not found" rather than skipping.

**Interfaces:**
- Produces `runFfmpeg(args: string[]) → Promise<{ stdout, stderr }>`, `measure(path) → { integratedLufs, truePeakDbtp, durationSecs }` (ffmpeg `ebur128`), `normalize(input, output, { targetLufs, truePeakCeilingDbtp: -1 }) → measurement of the output` (two-pass `loudnorm`), `assertWithinPolicy(measurement, target, toleranceLu = 0.5)`, `encodeMp3(input, output, { bitrateKbps, channels, stripMetadata: true })`, `encodeWav(input, output)`, `synthTone(output, { hz, seconds, sampleRate: 48000, gainDb: -20 })`, `LOUDNESS_TARGETS = { spoken: -16, music: -18 }`, `TRUE_PEAK_CEILING = -1`.

- [ ] **Step 1: Write the failing tests**

```ts
// media/tests/loudness.test.ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { encodeMp3 } from "../src/audio/encode";
import { assertWithinPolicy, LOUDNESS_TARGETS, measure, normalize, TRUE_PEAK_CEILING } from "../src/audio/loudness";
import { synthTone } from "../src/audio/synth";

const dir = mkdtempSync(join(tmpdir(), "media-loudness-"));

describe("loudness pipeline", () => {
  test("a quiet tone normalizes to the spoken target within tolerance and under the peak ceiling", async () => {
    const raw = join(dir, "raw.wav");
    const out = join(dir, "norm.wav");
    await synthTone(raw, { hz: 440, seconds: 3, gainDb: -30 });
    const before = await measure(raw);
    expect(before.integratedLufs).toBeLessThan(-25);
    const after = await normalize(raw, out, { targetLufs: LOUDNESS_TARGETS.spoken });
    expect(Math.abs(after.integratedLufs - LOUDNESS_TARGETS.spoken)).toBeLessThanOrEqual(0.5);
    expect(after.truePeakDbtp).toBeLessThanOrEqual(TRUE_PEAK_CEILING);
    expect(after.durationSecs).toBeGreaterThan(2.9);
    expect(() => assertWithinPolicy(after, LOUDNESS_TARGETS.spoken)).not.toThrow();
  });

  test("assertWithinPolicy rejects level and peak violations", () => {
    expect(() =>
      assertWithinPolicy({ integratedLufs: -17.2, truePeakDbtp: -2, durationSecs: 1 }, -16),
    ).toThrow(/LUFS/);
    expect(() =>
      assertWithinPolicy({ integratedLufs: -16, truePeakDbtp: -0.5, durationSecs: 1 }, -16),
    ).toThrow(/dBTP/);
  });

  test("decoded mp3 true peak is measured, and a hot encode fails policy", async () => {
    const raw = join(dir, "hot.wav");
    const mp3 = join(dir, "hot.mp3");
    await synthTone(raw, { hz: 1000, seconds: 2, gainDb: -0.2 });
    await encodeMp3(raw, mp3, { bitrateKbps: 128, channels: 2 });
    const decoded = await measure(mp3);
    expect(decoded.truePeakDbtp).toBeGreaterThan(TRUE_PEAK_CEILING);
    expect(() => assertWithinPolicy(decoded, decoded.integratedLufs)).toThrow(/dBTP/);
  });
});
```

```ts
// media/tests/encode.test.ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { encodeMp3, probeStreams } from "../src/audio/encode";
import { synthTone } from "../src/audio/synth";

const dir = mkdtempSync(join(tmpdir(), "media-encode-"));

describe("encodeMp3", () => {
  test("produces dual-mono stereo at 48 kHz with no metadata tags", async () => {
    const raw = join(dir, "t.wav");
    const mp3 = join(dir, "t.mp3");
    await synthTone(raw, { hz: 440, seconds: 1, gainDb: -20 });
    await encodeMp3(raw, mp3, { bitrateKbps: 128, channels: 2, title: "should be stripped" });
    const info = await probeStreams(mp3);
    expect(info.codec).toBe("mp3");
    expect(info.channels).toBe(2);
    expect(info.sampleRate).toBe(48000);
    expect(info.tags).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp run test:media`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write the ffmpeg wrapper**

```ts
// media/src/audio/ffmpeg.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runFfmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync("ffmpeg", ["-hide_banner", "-nostdin", "-y", ...args], {
      maxBuffer: 64 * 1024 * 1024,
    });
    return { stdout, stderr };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stderr?: string };
    if (err.code === "ENOENT") throw new Error("ffmpeg not found on PATH");
    throw new Error(`ffmpeg failed: ${(err.stderr ?? err.message).split("\n").slice(-20).join("\n")}`);
  }
}

export async function runFfprobe(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", ...args]);
    return stdout;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") throw new Error("ffprobe not found on PATH");
    throw error;
  }
}
```

- [ ] **Step 4: Write synthesis**

```ts
// media/src/audio/synth.ts
import { runFfmpeg } from "./ffmpeg";

export async function synthTone(
  output: string,
  options: { hz: number; seconds: number; sampleRate?: number; gainDb?: number },
): Promise<void> {
  const sampleRate = options.sampleRate ?? 48000;
  const gainDb = options.gainDb ?? -20;
  await runFfmpeg([
    "-f", "lavfi",
    "-i", `sine=frequency=${options.hz}:sample_rate=${sampleRate}:duration=${options.seconds}`,
    "-af", `volume=${gainDb}dB`,
    "-ac", "1",
    "-c:a", "pcm_s24le",
    output,
  ]);
}
```

- [ ] **Step 5: Write measurement and normalization**

```ts
// media/src/audio/loudness.ts
// One loudness policy for every wave (spec §3.4). Measurements use ffmpeg's
// ebur128 filter; normalization is two-pass loudnorm with a true-peak ceiling.
import { runFfmpeg } from "./ffmpeg";

export const LOUDNESS_TARGETS = { spoken: -16, music: -18 } as const;
export const TRUE_PEAK_CEILING = -1;
export const TOLERANCE_LU = 0.5;

export type Measurement = { integratedLufs: number; truePeakDbtp: number; durationSecs: number };

function lastMatch(text: string, pattern: RegExp): RegExpMatchArray {
  const last = [...text.matchAll(pattern)].at(-1);
  if (!last) throw new Error(`loudness measurement missing ${pattern.source}`);
  return last;
}

// ebur128 prints a summary block at the end of stderr:
//   Integrated loudness:
//     I:         -16.0 LUFS
//   True peak:
//     Peak:       -1.3 dBFS
// and ffmpeg's progress line carries time=HH:MM:SS.ss.
export async function measure(path: string): Promise<Measurement> {
  const { stderr } = await runFfmpeg([
    "-i", path,
    "-af", "ebur128=peak=true",
    "-f", "null", "-",
  ]);
  const integratedLufs = Number(lastMatch(stderr, /I:\s+(-?[\d.]+) LUFS/g)[1]);
  const truePeakDbtp = Number(lastMatch(stderr, /Peak:\s+(-?[\d.]+) dBFS/g)[1]);
  const time = lastMatch(stderr, /time=(\d+):(\d+):([\d.]+)/g);
  const durationSecs = Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]);
  return { integratedLufs, truePeakDbtp, durationSecs };
}

export async function normalize(
  input: string,
  output: string,
  options: { targetLufs: number; truePeakCeilingDbtp?: number },
): Promise<Measurement> {
  const ceiling = options.truePeakCeilingDbtp ?? TRUE_PEAK_CEILING;
  const first = await runFfmpeg([
    "-i", input,
    "-af", `loudnorm=I=${options.targetLufs}:TP=${ceiling}:LRA=11:print_format=json`,
    "-f", "null", "-",
  ]);
  const jsonText = first.stderr.slice(first.stderr.lastIndexOf("{"));
  const stats = JSON.parse(jsonText) as Record<string, string>;
  await runFfmpeg([
    "-i", input,
    "-af",
    `loudnorm=I=${options.targetLufs}:TP=${ceiling}:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true:print_format=summary`,
    "-ar", "48000",
    "-c:a", "pcm_s24le",
    output,
  ]);
  return await measure(output);
}

export function assertWithinPolicy(
  measurement: Measurement,
  targetLufs: number,
  toleranceLu: number = TOLERANCE_LU,
): void {
  if (Math.abs(measurement.integratedLufs - targetLufs) > toleranceLu) {
    throw new Error(
      `loudness ${measurement.integratedLufs.toFixed(2)} LUFS is outside ${targetLufs} ±${toleranceLu} LU`,
    );
  }
  if (measurement.truePeakDbtp > TRUE_PEAK_CEILING) {
    throw new Error(`true peak ${measurement.truePeakDbtp.toFixed(2)} dBTP exceeds ${TRUE_PEAK_CEILING} dBTP`);
  }
}
```

- [ ] **Step 6: Write encoding and probing**

```ts
// media/src/audio/encode.ts
import { runFfmpeg, runFfprobe } from "./ffmpeg";

export async function encodeMp3(
  input: string,
  output: string,
  options: { bitrateKbps: number; channels: 1 | 2; title?: string },
): Promise<void> {
  // -map_metadata -1 strips every tag; blind deliveries must carry none.
  await runFfmpeg([
    "-i", input,
    "-map_metadata", "-1",
    "-ar", "48000",
    "-ac", String(options.channels),
    "-c:a", "libmp3lame",
    "-b:a", `${options.bitrateKbps}k`,
    "-id3v2_version", "0",
    "-write_xing", "1",
    output,
  ]);
}

export async function encodeWav(input: string, output: string, channels: 1 | 2): Promise<void> {
  await runFfmpeg(["-i", input, "-map_metadata", "-1", "-ar", "48000", "-ac", String(channels), "-c:a", "pcm_s24le", output]);
}

export async function probeStreams(path: string): Promise<{
  codec: string;
  channels: number;
  sampleRate: number;
  tags: Record<string, string>;
}> {
  const text = await runFfprobe([
    "-show_entries", "stream=codec_name,channels,sample_rate:format_tags",
    "-of", "json",
    path,
  ]);
  const parsed = JSON.parse(text) as {
    streams: { codec_name: string; channels: number; sample_rate: string }[];
    format?: { tags?: Record<string, string> };
  };
  const stream = parsed.streams[0];
  if (!stream) throw new Error("no audio stream");
  return {
    codec: stream.codec_name,
    channels: stream.channels,
    sampleRate: Number(stream.sample_rate),
    tags: parsed.format?.tags ?? {},
  };
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `vp run test:media`
Expected: PASS (5 tests). If `ebur128` output format differs on the installed ffmpeg, print `stderr` once, adjust the regexes to the observed "Integrated loudness: I: -xx.x LUFS" and "True peak: Peak: -x.x dBFS" lines, and keep the tests unchanged.

- [ ] **Step 8: Commit**

```bash
git add media/src/audio media/tests/loudness.test.ts media/tests/encode.test.ts
git commit -m "feat(media): ffmpeg synthesis, loudness policy, and metadata-free encoding"
```

---

### Task 12: Probe job handler and the job runner

**Files:**
- Create: `media/src/jobs/types.ts`, `media/src/jobs/probe.ts`, `media/src/jobs/index.ts`, `media/src/upload.ts`, `media/src/runner.ts`, `media/src/main.ts`
- Test: `media/tests/probe.test.ts`, `media/tests/runner.test.ts`

**Interfaces:**
- Produces `JobHandler = (ctx: JobContext) => Promise<MediaJobResult>` with `JobContext = { job: ClaimedMediaJob, workDir, tools: ToolClient, rendererVersion }`; `ToolClient = { generateAudioUploadUrl, attachAudioStorage }` (typed wrappers over `callTool`); `uploadFile(tools, job, path, artifactFields) → ArtifactResult`; `runOnce(config, tools, handlers) → "idle" | "done" | "failed"`; `main()`.

- [ ] **Step 1: Write the failing tests**

```ts
// media/tests/probe.test.ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vite-plus/test";
import { probeHandler } from "../src/jobs/probe";
import type { ToolClient } from "../src/jobs/types";

describe("probe job", () => {
  test("synthesizes, normalizes to spoken target, encodes, uploads master and delivery, returns measurements", async () => {
    const uploads: string[] = [];
    const tools: ToolClient = {
      generateAudioUploadUrl: vi.fn(async ({ artifact }) => {
        uploads.push(artifact.role);
        return { artifactId: `a-${uploads.length}`, uploadUrl: "http://upload.test/x" };
      }),
      attachAudioStorage: vi.fn(async () => null),
      uploadBytes: vi.fn(async () => ({ storageId: "st1" })),
    };
    const result = await probeHandler({
      job: {
        jobId: "j1",
        kind: "probe",
        input: { kind: "probe", toneHz: 440, seconds: 2, rendererVersion: "0.1.0" },
        leaseToken: "lease",
        leaseExpiresAt: Date.now() + 60_000,
        attempts: 0,
      },
      workDir: mkdtempSync(join(tmpdir(), "probe-")),
      tools,
      rendererVersion: "0.1.0",
    });
    expect(result.kind).toBe("probe");
    expect(uploads).toEqual(["masterNormalized", "delivery"]);
    expect(result.artifacts).toHaveLength(2);
    for (const artifact of result.artifacts) {
      expect(Math.abs(artifact.loudnessLufs + 16)).toBeLessThanOrEqual(0.5);
      expect(artifact.truePeakDbtp).toBeLessThanOrEqual(-1);
    }
    expect(tools.attachAudioStorage).toHaveBeenCalledTimes(2);
  });
});
```

```ts
// media/tests/runner.test.ts
import { describe, expect, test, vi } from "vite-plus/test";
import { runOnce } from "../src/runner";

describe("runOnce", () => {
  test("idle when nothing is claimed", async () => {
    const calls: string[] = [];
    const tool = vi.fn(async (name: string) => {
      calls.push(name);
      return null;
    });
    const outcome = await runOnce(
      { workerId: "w", kinds: ["probe"], workDir: "/tmp", rendererVersion: "0.1.0" },
      tool as never,
      {},
    );
    expect(outcome).toBe("idle");
    expect(calls).toEqual(["claimNextMediaJob"]);
  });

  test("a handler error fails the job with a redacted message", async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const tool = vi.fn(async (name: string, body: Record<string, unknown>) => {
      calls.push([name, body]);
      if (name === "claimNextMediaJob") {
        return { jobId: "j1", kind: "probe", input: { kind: "probe", toneHz: 440, seconds: 1, rendererVersion: "0.1.0" }, leaseToken: "L", leaseExpiresAt: Date.now() + 60_000, attempts: 0 };
      }
      return { status: "queued", attempts: 1 };
    });
    const outcome = await runOnce(
      { workerId: "w", kinds: ["probe"], workDir: "/tmp", rendererVersion: "0.1.0" },
      tool as never,
      { probe: async () => { throw new Error("boom secret=abc"); } },
    );
    expect(outcome).toBe("failed");
    const fail = calls.find(([name]) => name === "failMediaJob");
    expect(fail?.[1]).toMatchObject({ jobId: "j1", leaseToken: "L" });
    expect(String(fail?.[1].error)).not.toContain("abc");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp run test:media`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write types and upload**

```ts
// media/src/jobs/types.ts
import type { ArtifactResult, ClaimedMediaJob, MediaJobResult } from "../../../convex/shared/mediaJobs";
import type { AudioArtifactFields } from "../../../convex/shared/audioArtifacts";

export type NewArtifact = Omit<AudioArtifactFields, "status" | "createdAt" | "updatedAt" | "refs"> & {
  refs?: AudioArtifactFields["refs"];
};

export type ToolClient = {
  generateAudioUploadUrl: (args: { jobId: string; leaseToken: string; artifact: NewArtifact }) => Promise<{ artifactId: string; uploadUrl: string }>;
  attachAudioStorage: (args: { jobId: string; leaseToken: string; artifactId: string; storageId: string }) => Promise<null>;
  uploadBytes: (uploadUrl: string, path: string, mimeType: string) => Promise<{ storageId: string }>;
};

export type JobContext = {
  job: ClaimedMediaJob;
  workDir: string;
  tools: ToolClient;
  rendererVersion: string;
};

export type JobHandler = (ctx: JobContext) => Promise<MediaJobResult>;
export type { ArtifactResult };
```

```ts
// media/src/upload.ts
import { readFile } from "node:fs/promises";
import { callTool } from "./convex";
import type { ToolClient } from "./jobs/types";

export async function uploadBytes(uploadUrl: string, path: string, mimeType: string): Promise<{ storageId: string }> {
  const bytes = await readFile(path);
  const response = await fetch(uploadUrl, { method: "POST", headers: { "content-type": mimeType }, body: bytes });
  if (!response.ok) throw new Error(`upload failed: ${response.status}`);
  return (await response.json()) as { storageId: string };
}

export function liveTools(): ToolClient {
  return {
    generateAudioUploadUrl: (args) => callTool("generateAudioUploadUrl", args),
    attachAudioStorage: (args) => callTool("attachAudioStorage", args),
    uploadBytes,
  };
}
```

- [ ] **Step 4: Write the probe handler**

```ts
// media/src/jobs/probe.ts
// End-to-end pipeline proof: tone → normalize (spoken target) → WAV master +
// MP3 delivery → upload both → measurements. Also the production health check.
import { join } from "node:path";
import { stableStringify, fnv1a64Hex } from "../../../convex/shared/stableHash";
import { encodeMp3 } from "../audio/encode";
import { assertWithinPolicy, LOUDNESS_TARGETS, measure, normalize } from "../audio/loudness";
import { synthTone } from "../audio/synth";
import type { ArtifactResult, JobContext, JobHandler, NewArtifact } from "./types";

async function uploadArtifact(ctx: JobContext, path: string, artifact: NewArtifact, mimeType: string): Promise<ArtifactResult> {
  const { artifactId, uploadUrl } = await ctx.tools.generateAudioUploadUrl({
    jobId: ctx.job.jobId, leaseToken: ctx.job.leaseToken, artifact,
  });
  const { storageId } = await ctx.tools.uploadBytes(uploadUrl, path, mimeType);
  await ctx.tools.attachAudioStorage({ jobId: ctx.job.jobId, leaseToken: ctx.job.leaseToken, artifactId, storageId });
  const measured = await measure(path);
  assertWithinPolicy(measured, LOUDNESS_TARGETS.spoken);
  return {
    artifactId: artifactId as ArtifactResult["artifactId"],
    durationSecs: measured.durationSecs,
    loudnessLufs: measured.integratedLufs,
    truePeakDbtp: measured.truePeakDbtp,
    mimeType,
  };
}

export const probeHandler: JobHandler = async (ctx) => {
  if (ctx.job.input.kind !== "probe") throw new Error("probe handler received another kind");
  const { toneHz, seconds } = ctx.job.input;
  const raw = join(ctx.workDir, "probe-raw.wav");
  const master = join(ctx.workDir, "probe-master.wav");
  const delivery = join(ctx.workDir, "probe.mp3");
  await synthTone(raw, { hz: toneHz, seconds, gainDb: -20 });
  await normalize(raw, master, { targetLufs: LOUDNESS_TARGETS.spoken });
  await encodeMp3(master, delivery, { bitrateKbps: 128, channels: 2 });

  const engine = { name: "probe", version: ctx.rendererVersion, params: { toneHz, seconds } };
  const hashBase = { kind: "probe", engine, input: ctx.job.input };
  const masterArtifact: NewArtifact = {
    kind: "probe", role: "masterNormalized", metadataStripped: true,
    encoding: { codec: "wav", sampleRate: 48000, channels: 1 },
    normalization: "applied", access: "private", title: `Probe ${toneHz} Hz master`,
    engine, contentHash: fnv1a64Hex(stableStringify({ ...hashBase, role: "masterNormalized" })),
    createdBy: "system",
  };
  const masterResult = await uploadArtifact(ctx, master, masterArtifact, "audio/wav");
  const deliveryArtifact: NewArtifact = {
    ...masterArtifact,
    role: "delivery",
    masterArtifactId: masterResult.artifactId,
    encoding: { codec: "mp3", bitrateKbps: 128, sampleRate: 48000, channels: 2 },
    title: `Probe ${toneHz} Hz`,
    contentHash: fnv1a64Hex(stableStringify({ ...hashBase, role: "delivery" })),
  };
  const deliveryResult = await uploadArtifact(ctx, delivery, deliveryArtifact, "audio/mpeg");
  return { kind: "probe", artifacts: [masterResult, deliveryResult] };
};
```

- [ ] **Step 5: Write the handler registry, runner, and main**

```ts
// media/src/jobs/index.ts
import { probeHandler } from "./probe";
import type { JobHandler } from "./types";

export const handlers: Record<string, JobHandler> = { probe: probeHandler };
```

```ts
// media/src/runner.ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ClaimedMediaJob } from "../../convex/shared/mediaJobs";
import { LEASE_MS } from "../../convex/shared/mediaJobs";
import { callTool } from "./convex";
import type { JobHandler, ToolClient } from "./jobs/types";
import { log, redactError } from "./log";
import { liveTools } from "./upload";

export type RunnerConfig = { workerId: string; kinds: string[]; workDir: string; rendererVersion: string };
type Tool = typeof callTool;

const RENEW_EVERY_MS = Math.floor(LEASE_MS / 3);

export async function runOnce(
  config: RunnerConfig,
  tool: Tool,
  handlers: Record<string, JobHandler>,
  tools: ToolClient = liveTools(),
): Promise<"idle" | "done" | "failed"> {
  const job = await tool<ClaimedMediaJob | null>("claimNextMediaJob", { workerId: config.workerId, kinds: config.kinds });
  if (!job) return "idle";
  log(`claimed ${job.kind} job ${job.jobId} (attempt ${job.attempts + 1})`);
  const workDir = await mkdtemp(join(config.workDir, `${job.kind}-`));
  const renew = setInterval(() => {
    tool("renewMediaJobLease", { jobId: job.jobId, leaseToken: job.leaseToken }).catch((error) =>
      log(`lease renewal failed for ${job.jobId}: ${redactError(error)}`),
    );
  }, RENEW_EVERY_MS);
  try {
    const handler = handlers[job.kind];
    if (!handler) throw new Error(`no handler for kind ${job.kind}`);
    const result = await handler({ job, workDir, tools, rendererVersion: config.rendererVersion });
    await tool("completeMediaJob", { jobId: job.jobId, leaseToken: job.leaseToken, result });
    log(`completed ${job.kind} job ${job.jobId}`);
    return "done";
  } catch (error) {
    const message = redactError(error);
    log(`job ${job.jobId} failed: ${message}`);
    try {
      await tool("failMediaJob", { jobId: job.jobId, leaseToken: job.leaseToken, error: message });
    } catch (failError) {
      log(`could not record failure for ${job.jobId}: ${redactError(failError)}`);
    }
    return "failed";
  } finally {
    clearInterval(renew);
    await rm(workDir, { recursive: true, force: true });
  }
}
```

```ts
// media/src/main.ts
import "varlock/auto-load";
import { mkdir } from "node:fs/promises";
import { loadConfig } from "./config";
import { callTool } from "./convex";
import { handlers } from "./jobs";
import { log, redactError } from "./log";
import { runOnce } from "./runner";

async function main(): Promise<void> {
  const config = loadConfig();
  await mkdir(config.workDir, { recursive: true });
  log(`media worker ${config.workerId} polling every ${config.pollIntervalMs} ms for ${config.kinds.join(", ")}`);
  let stopping = false;
  process.on("SIGTERM", () => { stopping = true; });
  process.on("SIGINT", () => { stopping = true; });
  while (!stopping) {
    let outcome: "idle" | "done" | "failed" = "idle";
    try {
      outcome = await runOnce(config, callTool, handlers);
    } catch (error) {
      log(`poll iteration failed: ${redactError(error)}`);
    }
    if (outcome === "idle") await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
  log("stopped");
}

void main();
```

Add `varlock` and `@varlock/1password-plugin` to `media/package.json` dependencies at the root's versions, then `cd media && vp install`.

- [ ] **Step 6: Run tests, typecheck, commit**

Run: `vp run test:media && vp run typecheck:media`
Expected: PASS (all media tests), no type errors.

```bash
git add media
git commit -m "feat(media): probe job handler, leased runner, and entrypoint"
```

---

### Task 13: Container image and homelab-infra definition for ai-5090-02

**Files (this repo):**
- Create: `media/Dockerfile`, `media/README.md`
- Modify: `.github/workflows/*` only if an existing workflow builds the agent image; add a matching job for `media/` (check `ls .github/workflows` first and mirror the agent image job).

**Files (homelab-infra, separate commit in that repo after `git pull`):**
- Create: `hosts/ai-5090-02/frequency-media/compose.yaml`, `hosts/ai-5090-02/frequency-media/deploy.sh`, `hosts/ai-5090-02/frequency-media/README.md`, `hosts/ai-5090-02/frequency-media/.env.example`

- [ ] **Step 1: Dockerfile**

```dockerfile
# media/Dockerfile — Frequency Music media service (wave 0: probe pipeline).
# ffmpeg from Debian; the app runs under tsx like the agent image.
ARG NODE_IMAGE=node:24.18.1-trixie-slim
FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app/media
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates unzip \
    && curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14" \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.bun/bin:${PATH}"
COPY media/package.json media/bun.lock* ./
RUN bun install --frozen-lockfile --production

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# node_modules sits at /app so both media/src and convex/shared resolve
# convex, convex-helpers, and zod by walking up from their own directories.
COPY --from=dependencies /app/media/node_modules ./node_modules
COPY media ./media
COPY convex/shared ./convex/shared
RUN useradd -u 1001 -m media && mkdir -p /work && chown media /work
USER media
ENV MEDIA_WORK_DIR=/work
WORKDIR /app/media
CMD ["/app/node_modules/.bin/tsx", "src/main.ts"]
```

Match the lockfile name to what `vp install` produced in `media/` (bun.lock, pnpm-lock.yaml, or package-lock.json) and adjust the dependency stage accordingly; the agent image uses bun, so prefer the same.

Build locally to prove it: `docker build -f media/Dockerfile -t frequency-media:local .` (from the repo root). Expected: image builds; `docker run --rm frequency-media:local ffmpeg -version | head -1` prints a version.

- [ ] **Step 2: README in media/**

```markdown
# media

The Frequency Music media service. Runs on ai-5090-02 under Docker, pulls
`mediaJobs` from Convex through `/agent-tools/*`, renders, normalizes to the
loudness policy, encodes, uploads to Convex storage, and completes each job
with a typed result. It never writes research data directly.

- Contracts: `convex/shared/mediaJobs.ts`, `convex/shared/audioArtifacts.ts`
- Job kinds: `probe` (wave 0). Wave 1 adds `narrate`, `shootout`, `assembleEpisode`.
- Run locally: `cd media && vp install && APP_ENV=dev vp run start` (needs ffmpeg and the 1Password app or `OP_SERVICE_ACCOUNT_TOKEN`).
- Tests: `vp run test:media` (needs ffmpeg on PATH).
- Deployment: `homelab-infra/hosts/ai-5090-02/frequency-media/`.
```

- [ ] **Step 3: homelab-infra compose (in `~/code/homelab-infra` after `git pull --ff-only`)**

`hosts/ai-5090-02/frequency-media/compose.yaml`:

```yaml
services:
  media:
    image: ghcr.io/resonant-projects/frequency-media:${MEDIA_IMAGE_TAG:-latest}
    restart: unless-stopped
    environment:
      APP_ENV: prod
      CONVEX_SITE_URL: http://convex.rproj.art:3211
      MEDIA_WORKER_ID: ai-5090-02
      MEDIA_JOB_KINDS: probe
      MEDIA_POLL_INTERVAL_MS: "15000"
      AGENT_TOOL_SECRET: ${AGENT_TOOL_SECRET}
    volumes:
      - media-work:/work
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
volumes:
  media-work:
```

`deploy.sh` resolves `AGENT_TOOL_SECRET` from 1Password at deploy time and never writes it to disk:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${OP_SERVICE_ACCOUNT_TOKEN:?set via op-access run or the host's ambient token}"
export AGENT_TOOL_SECRET
AGENT_TOOL_SECRET="$(op read 'op://Homelab Runtime/agent-tool-secret/credential')"
docker compose pull
docker compose up -d
docker compose ps
```

`README.md` states: image source (this repo `media/Dockerfile`), the secret reference, that the GPU reservation is for wave 1's local TTS, and the health check (`docker compose logs --tail 20 media` should show "polling every").

- [ ] **Step 4: Commit both repos**

```bash
git add media/Dockerfile media/README.md
git commit -m "feat(media): container image"
```

In homelab-infra: `git add hosts/ai-5090-02 && git commit -m "feat(ai-5090-02): frequency-media compose definition"`. Do not push either repo without Keith's go-ahead; report the commits.

---

### Task 14: Human-session predicate, vocabulary, docs, and verify

**Files:**
- Create: `convex/shared/listeningPredicates.ts`, test `convex/shared/listeningPredicates.test.ts`
- Modify: `CONTEXT.md` (new terms under a new `### Audio substrate` heading in the Language section)
- Modify: `docs/plans/README.md` (one paragraph pointing at the listen-first specs and this plan)
- Modify: `AGENTS.md` (one line in Guardrails: the media service is a second standing service identity using `AGENT_TOOL_SECRET`; `media/` is a fourth package with its own configs)

**Interfaces:**
- Produces `isHumanListeningSession(session)` (spec §3.6): true when `createdBy` is a user id (not `"system"`) and no participant has `role === "machine"`. Wave 3 routes debt closure, verdict selection, and fitness through it.

- [ ] **Step 0: Predicate with test**

```ts
// convex/shared/listeningPredicates.test.ts
import { describe, expect, test } from "vite-plus/test";
import { isHumanListeningSession } from "./listeningPredicates";

describe("isHumanListeningSession", () => {
  test("user-created sessions without machine participants are human", () => {
    expect(isHumanListeningSession({ createdBy: "user_1", participants: [{ role: "self" }] })).toBe(true);
    expect(isHumanListeningSession({ createdBy: "user_1", participants: [] })).toBe(true);
  });
  test("system-created or machine-participant sessions are not", () => {
    expect(isHumanListeningSession({ createdBy: "system", participants: [{ role: "self" }] })).toBe(false);
    expect(isHumanListeningSession({ createdBy: "user_1", participants: [{ role: "machine" }] })).toBe(false);
  });
});
```

```ts
// convex/shared/listeningPredicates.ts
// One predicate for "a human listened". Debt closure, recommendations,
// verdict selection, failure analysis, and fitness must all use it.
export type ListeningSessionLike = {
  createdBy: string;
  participants: { role?: string }[];
};

export function isHumanListeningSession(session: ListeningSessionLike): boolean {
  if (session.createdBy === "system") return false;
  return !session.participants.some((participant) => participant.role === "machine");
}
```

Run: `vp test convex/shared/listeningPredicates.test.ts` → PASS.

- [ ] **Step 1: Add vocabulary**

```markdown
### Audio substrate

**Audio Artifact**:
One stored audio file with provenance, measurements, and role (raw master, normalized master, or delivery). Bytes live in Convex file storage; the row is the record. Machine analysis lives only here, never on a Listening Session.
_Avoid_: recording, clip, track (a Composition may have many artifacts)

**Media Job**:
A self-contained, leased unit of audio work the media service pulls from Convex. Its input is a snapshot, its identity is the hash of that snapshot, and its completion is a typed result Convex validates and applies atomically.
_Avoid_: render task, queue item

**Blind Group**:
An immutable set of audio artifacts served to a listener only through a projection that hides everything but opaque handles and labels until the last required rating reveals them.
_Avoid_: A/B test (that is one use of a blind group)

**House Voice**:
The TTS voice Keith chose by blind listening; stored in settings and used by every narration job until changed.
```

- [ ] **Step 2: Update AGENTS.md and the plans index**

In `AGENTS.md` Sources of truth, change "Root, `web/`, and `agent/` are separate packages" to include `media/`. In Guardrails after the `/agent-tools/*` line add: "`media/` (the media service on ai-5090-02) is a second standing service identity using `AGENT_TOOL_SECRET`; its tools are lifecycle writes only and are listed under 'Media lifecycle tools' in `docs/agent-tool-surface.md`."

In `docs/plans/README.md` add a short section "Listen-first program (2026-09-28)" linking the umbrella spec, the four wave specs, and this plan, stating wave 0's status.

- [ ] **Step 3: Full verification**

Run: `vp run verify`
Expected: format, lint, typecheck (scripts, web, agent, media), convex+scripts tests, harness tests, agent tests, media tests all pass. If `biome` flags the new files, run `vp run format` and re-run.

- [ ] **Step 4: Commit**

```bash
git add convex/shared/listeningPredicates.ts convex/shared/listeningPredicates.test.ts CONTEXT.md AGENTS.md docs/plans/README.md
git commit -m "feat(shared): human listening predicate; audio substrate vocabulary and plan index"
```

---

### Task 15: **PRODUCTION** deploy and end-to-end probe

Runs only with Keith's go-ahead; each step names its effect.

- [ ] **Step 1: Create the feed token item** (Keith, in 1Password): item `podcast-feed-token` in vault Country Manor Lab, field `credential` = `openssl rand -hex 32` output. Also add the same item to the Homelab Runtime vault if the Convex deployment env is populated from there.

- [ ] **Step 2: Deploy Convex schema and functions** (affects production: adds four tables, one cron, seven HTTP-reachable tools, one public route that 404s without the token):

```bash
vpx convex deploy
```

- [ ] **Step 3: Set deployment env** (affects production): `PODCAST_FEED_TOKEN` and `PODCAST_PUBLIC_BASE_URL` in the self-hosted deployment's environment through the Convex dashboard or `vpx convex env set PODCAST_PUBLIC_BASE_URL https://listen.rproj.art`; the token is set by Keith from 1Password, never typed into this session.

- [ ] **Step 4: Build and push the media image**: the repo's CI builds `ghcr.io/resonant-projects/frequency-media` on merge; until then build on ai-5090-02 directly: `ssh ai-5090-02 'cd /srv/frequency-music && git pull && docker build -f media/Dockerfile -t ghcr.io/resonant-projects/frequency-media:local .'` (create the checkout if absent) and set `MEDIA_IMAGE_TAG=local` in the compose env.

- [ ] **Step 5: Start the service**: on ai-5090-02, `op-access run homelab -- ./deploy.sh` from the compose directory (Keith stages the `homelab` profile first; see the op-access walkthrough in the handoff message). Expected log line: `[media] media worker ai-5090-02 polling every 15000 ms for probe`.

- [ ] **Step 6: Enqueue a probe** (affects production: one job row, two artifacts):

```bash
vpx convex run mediaJobs:enqueue '{"input":{"kind":"probe","toneHz":440,"seconds":3,"rendererVersion":"0.1.0"}}'
```

Expected within 30 seconds: media logs show `claimed probe job` then `completed probe job`; `vpx convex run audioArtifacts:listByStatusOlderThan '{"status":"ready","olderThan":9999999999999}'` lists two ready artifacts with `loudnessLufs` within −16 ±0.5 and `truePeakDbtp` ≤ −1.

- [ ] **Step 7: Feed smoke**: `curl -s -o /dev/null -w '%{http_code}\n' http://convex.rproj.art:3211/podcast/wrong/feed.xml` → `404`. With the real token supplied by Keith in his own shell: `200` and a valid empty feed (no episodes yet).

- [ ] **Step 8: NPM host and Range check** (Keith, in Nginx Proxy Manager): host `listen.rproj.art` → `http://172.16.10.24:3211`, forwarding only `/podcast/` and `/api/storage/`. Then `curl -sI -H 'Range: bytes=0-99' https://listen.rproj.art/api/storage/<probe delivery uuid>` and record whether the response is `206` with `content-range`. Write the result into the wave 1 plan's assumptions (spec §3.5 fallback if not `206`).

- [ ] **Step 9: Commit nothing; report**: summarize the probe measurements and the Range result in the handoff.
