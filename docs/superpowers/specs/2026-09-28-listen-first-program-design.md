# Listen-First Program Design (umbrella)

Turn Frequency Music from a reading loop into a listening loop: the system
speaks, renders, and takes decisions by voice, while the existing human-only
decision doctrine stays intact.

This umbrella spec fixes the shared substrate and the wave boundaries. Each
wave has its own spec and its own implementation plan; waves can be built in
parallel once the substrate lands.

| Wave | Spec | Depends on |
| --- | --- | --- |
| 0 | Shared substrate (this document, §3) | nothing |
| 1 | [Voice and podcast feed](./2026-09-28-voice-and-podcast-feed-design.md) | substrate |
| 2 | [Freq docket and voice decisions](./2026-09-28-freq-docket-and-voice-decisions-design.md) | substrate; wave 1 for spoken blurbs |
| 3 | [Render ladder and listen page](./2026-09-28-render-ladder-and-listen-page-design.md) | substrate; wave 1 for episodes |
| 4 | [Hypothesis tournament](./2026-09-28-hypothesis-tournament-design.md) | none for the tournament; wave 3 for listening fitness |

## 1. Intent and success criteria

Keith (audio engineer, listens in Pocket Casts in the car and on walks, does
voice transcription while walking and in the studio) said:

- "start having something that doesn't require reading but allows me to listen"
- "I want a high voice quality bar. I can't stand to listen to crap-generated stuff"
- explore "what can be generated; how we can create more innovative hypotheses
  and experiments; how we can help to clear the backlog of existing things by
  providing pages and blurbs, either delivered through OpenClaw or via Discord;
  how we can provide a page for listening to the generated music or audio"
- Discord preferred, Telegram kept because it already works; a new Discord
  channel for this work.

Success looks like:

1. The Friday brief and Thursday docket arrive as podcast episodes in Pocket
   Casts, in a voice Keith chose by blind listening.
2. Keith can clear the draft docket by voice from a walk, and every decision is
   attributable to him, with the transcript stored.
3. A recipe becomes audible without opening a DAW: a plain machine render for
   the litmus test, a study family for A/B/X, and a listen page that records
   ratings.
4. Hypothesis drafting searches instead of filtering: many candidates, a
   novelty gate, a tournament, and still one human door with the WIP cap of 3.

## 2. Findings that shape the design

Live state read on 2026-09-28 through the read-only agent tools:

| Item | Count |
| --- | --- |
| Pending hypothesis drafts | 3 (cap 3, queue full) |
| Pending recipe drafts | 0 |
| Hypotheses | 56 (51 draft, 5 queued, none approved) |
| Recipes | 17 (all draft; 3 with starter kits; 12 comparison, 5 litmus) |
| Draft approvals or rejections in 90 days | 0 |
| Draftable correspondences waiting | 20 |
| Failure archive entries | 0 |

The human door has not been opened in 90 days, so the docket is the
bottleneck. Compositions and listening sessions are not exposed on the agent
surface, so their counts are read in wave 2.

Infrastructure facts:

- The worker runs on the Talos cluster in namespace `frequency-worker`,
  ArgoCD-managed from `homelab-infra/kubernetes/infra/frequency-worker`. Its
  Cilium egress allows only Convex (172.16.10.24:3211), OpenRouter, Firecrawl,
  and LangSmith. It cannot call a LAN media service, and nothing on the
  cluster has a GPU.
- ai-5090-02 (RTX 5090, ~31 GB VRAM free, Docker) is the only place for local
  TTS and rendering. ComfyUI with ACE-Step 1.5 already runs there on 8188.
- Convex is self-hosted at `http://convex.rproj.art:3211` (site URL). File
  storage is unused today. The HTTP router serves `/health`, `/ingest/*`, and
  `/agent-tools/*`.
- OpenClaw on moltbot (CT200 on prox9) has agent `freq` bound to its own
  Telegram bot, one Discord guild (`1512943651368734944`) with an allowlist
  of two channels, no TTS configured, no MCP servers configured, and a Google
  provider entry.
- 1Password CLI has no staged unattended profile on this machine, so
  `devBypassSecret` mutations cannot run from here until Keith stages one
  with `op-access`.

## 3. Shared substrate (wave 0)

Everything below is used by two or more waves and is built first.

### 3.1 `audioArtifacts` table

One row per rendered or uploaded audio file. Lives in `convex/schema.ts`;
validators in `convex/shared/audioArtifacts.ts`.

```
audioArtifacts
  kind: "narration" | "shootoutTake" | "episode" | "litmusRender"
      | "qualityRender" | "expansion" | "voiceNote" | "blurb"
  status: "queued" | "rendering" | "ready" | "failed"
  storageId?: Id<"_storage">          // set when ready
  mimeType?: string                    // audio/mpeg, audio/wav, audio/ogg
  durationSecs?: number
  sampleRate?: number
  loudnessLufs?: number
  title: string
  scriptMd?: string                    // spoken text for narration/blurb
  engine?: { name, version, params: Record<string, unknown> }
  voice?: { provider, voiceId, promptVersion }
  analysis?: { roughness?, spectralCentroid?, lufs? }
  refs: { weeklyBriefId?, agentReviewDraftId?, recipeId?, compositionId?,
          hypothesisId?, listeningSessionId?, docketCardId? }
  blindGroupId?: Id<"blindGroups">
  blindLabel?: string                  // "A" | "B" | "X" | "take 3"
  contentHash: string                  // sha256 of (kind, scriptMd|kit, engine, voice)
  error?: string
  createdBy: "system" | "agent" | "human"
  agentRunId?: Id<"agentRuns">
  createdAt, updatedAt
indexes: by_kind_createdAt, by_status_createdAt, by_blindGroupId,
         by_refs_compositionId, by_contentHash
```

`contentHash` makes rendering idempotent: a job whose hash already has a
`ready` row is a no-op.

### 3.2 `blindGroups` table

```
blindGroups
  purpose: "voiceShootout" | "studyFamily"
  memberArtifactIds: Id<"audioArtifacts">[]
  labels: Record<label, artifactId>    // never sent to the listen page before reveal
  revealedAt?: number
  createdAt
```

A query returns labels only after `revealedAt` is set, and `revealedAt` is set
by the mutation that records the last required rating.

### 3.3 `mediaJobs` table and media tools

The media service pulls work; Convex never calls it (worker egress rule, and
the service sits on a LAN box).

```
mediaJobs
  kind: "narrate" | "shootout" | "assembleEpisode" | "litmusRender"
      | "qualityRender" | "studyFamily" | "expansion" | "transcribe" | "analyze"
  input: Record<string, unknown>        // kind-specific, validated in convex/shared/mediaJobs.ts
  status: "queued" | "claimed" | "done" | "failed"
  priority: number
  workerId?: string
  claimedAt?, finishedAt?
  resultArtifactIds?: Id<"audioArtifacts">[]
  error?: string
  attempts: number
  createdAt
indexes: by_status_priority_createdAt, by_kind_status
```

New `/agent-tools/*` entries, registered in `convex/shared/agentToolManifest.ts`
and documented in `docs/agent-tool-surface.md` under a new "Media lifecycle
tools" table. They are lifecycle and artifact writes, never research-data
writes:

| Tool | Purpose |
| --- | --- |
| `claimNextMediaJob` | Atomically claim the oldest queued job in the caller's `kinds` list. |
| `generateAudioUploadUrl` | Return a Convex storage upload URL for one artifact. |
| `registerAudioArtifact` | Attach a storage id, duration, loudness, analysis to a queued artifact and mark it ready. |
| `completeMediaJob` / `failMediaJob` | Close a job; failures keep the error and bump attempts, and three attempts park the job. |

The media service authenticates with `AGENT_TOOL_SECRET`, as the worker does.
It is a second standing service identity. Stale claimed jobs are swept by the
existing `sweep-stale-agent-runs` pattern (a sibling cron `sweep-stale-media-jobs`).

### 3.4 Media service on ai-5090-02

A new workspace package `media/` in this repo (own `package.json`,
`tsconfig.json`, `.env.schema`, tests), built into an image
`ghcr.io/resonant-projects/frequency-media`, run by Docker Compose on
ai-5090-02 with the GPU. Its definition lives in homelab-infra under
`services/frequency-media/` following the existing `service.json` pattern.

Containers:

| Container | Role |
| --- | --- |
| `media` | The TypeScript poller: claims jobs, runs engines, normalizes loudness, encodes, uploads, registers artifacts. |
| `tts-local` | Breeze TTS 2 server exposing an OpenAI-compatible `/v1/audio/speech`. Only started if the shootout picks a local voice, or for bulk narration. |
| `render` | SuperCollider (`sclang`, `scsynth` NRT), Surge XT CLI, ffmpeg, Python with `dissonant`. Invoked by `media` over a local Unix socket, or merged into `media` if image size allows. |

Hosted voices (Gemini 3.1 Flash TTS, Inworld, ElevenLabs) are called by the
`media` container directly with keys from the compose env, resolved through
1Password `op://` references at deploy time, the same way the worker's
`service.json` does.

Audio pipeline for everything spoken: TTS output → resample 48 kHz →
loudness normalize to −16 LUFS integrated, −1 dBTP → encode MP3 128 kbps
(spoken) or 256 kbps (music) → upload. WAV masters for renders are kept as a
second artifact so A/B tests never compare codec artifacts.

### 3.5 Public audio and feed routes

Two HTTP routes in `convex/http.ts`:

- `GET /podcast/:token/feed.xml` — RSS 2.0 with iTunes tags, built from
  `audioArtifacts` where `kind = "episode"` and `status = "ready"`.
- `GET /podcast/:token/audio/:artifactId.mp3` — streams the stored blob with
  `content-type`, `content-length`, and `accept-ranges: none`.

`:token` must equal `PODCAST_FEED_TOKEN` (32+ random bytes, set in the Convex
deployment env); mismatches return 404, not 401, so the route is invisible to
scanners. Pocket Casts requires the URL to be publicly reachable, so the
Convex site is exposed through the existing Nginx Proxy Manager as
`listen.rproj.art`, forwarding only `/podcast/*` and `/health`. Keith submits
the feed at pocketcasts.com/submit marked Private.

Risk: Convex HTTP actions return whole responses, so range requests are not
honored. Pocket Casts downloads episodes whole, so this is acceptable for
20–40 minute episodes; if scrubbing in-app fails, the fallback is a static
export of `/podcast/*` to the NPM host by a media-service job.

### 3.6 Engineering rules that apply to every wave

- Decisions stay human. Nothing on `/agent-tools/*` or the MCP surface can
  approve, reject, or supersede a draft, or publish a hypothesis or recipe.
  Voice decisions are relayed with identity and transcript and confirmed in a
  second message (wave 2 §4).
- New models go into `MODELS` in `convex/llm.ts`. TTS voices are not LLMs and
  get their own catalog in `convex/shared/voices.ts`.
- Contracts crossing seams (web, agent, media, Convex) live in `convex/shared/`.
  `scripts/lib/tuning.ts` and `scripts/lib/seedMidi.ts` move to
  `convex/shared/tuning/` with re-export shims left in `scripts/lib/`, because
  the media service needs them.
- Every new table gets validators in `convex/shared/`, unit tests beside the
  Convex module, and a one-line entry in `CONTEXT.md` vocabulary.
- `vp run verify` must pass at each handoff. The `media/` package joins the
  `typecheck` and `test` chains.
- Secrets: `AGENT_TOOL_SECRET`, `PODCAST_FEED_TOKEN`, `MCP_SHARED_SECRET`,
  TTS keys. All resolved through 1Password references in deployment configs;
  none printed, pasted, or committed.
- Convex `deploy` for schema changes contacts production. Each plan states the
  deploy step explicitly and it is run by Keith or with his go-ahead.

## 4. Non-goals

- No generative music model in the litmus path. ACE-Step is expansion only.
- No new Discord bot; the existing OpenClaw Discord account gets a new channel.
- No essay narration in wave 1. It is a wave-1 follow-on once the house voice
  is chosen and bulk local TTS is running.
- No Pianoteq. Surge XT CLI is the quality-render engine.

## 5. Open items carried into the plans

| Item | Owner | Blocks |
| --- | --- | --- |
| Stage an `op-access` profile so `devBypassSecret` mutations can run unattended from this machine | Keith | any CLI mutation |
| Gemini API key on moltbot and in the media compose env | Keith | Gemini take in the shootout |
| Confirm `listen.rproj.art` can be exposed publicly via NPM | Keith | Pocket Casts subscription |
| Create `#frequency` in the Discord guild (bot needs Manage Channels, or Keith creates it and pastes the id) | plan step | wave 2 delivery |
| homelab-infra local checkout is behind `origin/main`; pull before editing service definitions | plan step | media compose, MCP ingress |
