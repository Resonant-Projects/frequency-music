# Listen-First Program Design (umbrella)

Turn Frequency Music from a reading loop into a listening loop: the system
speaks, renders, and takes decisions by voice, while the human-only decision
doctrine stays intact.

This umbrella spec fixes the shared substrate, the engineering rules, and the
wave boundaries. Each wave has its own spec and its own implementation plan.

Revision 2 (2026-09-28) incorporates the GPT 6.0 Astra review: agent tools
are proposal-only, audio is served from storage rather than through HTTP
actions, media jobs are leased and completed atomically with typed domain
effects, machine analysis never creates listening sessions, blind groups are
projected server-side, and wave 0 is cut to what wave 1 needs.

| Wave | Spec | Hard dependencies |
| --- | --- | --- |
| 0 | Shared substrate (this document, §3) | none |
| 1 | [Voice and podcast feed](./2026-09-28-voice-and-podcast-feed-design.md) | wave 0 |
| 2 | [Freq docket and voice decisions](./2026-09-28-freq-docket-and-voice-decisions-design.md) | wave 0; wave 1's house voice for spoken cards |
| 3 | [Render ladder and listen page](./2026-09-28-render-ladder-and-listen-page-design.md) | wave 0; the plan 11 listening gate before renders count as evidence; wave 1 for episodes |
| 4 | [Hypothesis tournament](./2026-09-28-hypothesis-tournament-design.md) | wave 0 only for the freq request path; wave 3 human sessions before listening fitness |

## 1. Intent and success criteria

Keith (audio engineer, listens in Pocket Casts in the car and on walks, does
voice transcription while walking and in the studio) asked for:

- "something that doesn't require reading but allows me to listen"
- "a high voice quality bar. I can't stand to listen to crap-generated stuff"
- "what can be generated; how we can create more innovative hypotheses and
  experiments; how we can help to clear the backlog of existing things by
  providing pages and blurbs, either delivered through OpenClaw or via
  Discord; how we can provide a page for listening to the generated music or
  audio"
- Discord preferred, Telegram kept because it already works; a new Discord
  channel for this work; all waves pursued, in parallel where possible.

Success:

1. The Friday brief and Thursday docket arrive as podcast episodes in Pocket
   Casts, in a voice Keith chose by blind listening.
2. Keith clears the draft docket from a walk: freq explains by voice, Keith
   signs each decision with a tap or a typed reply that the platform, not the
   model, attributes to him. Every decision stores its transcript.
3. A recipe becomes audible without a DAW through a validated plain render,
   study families are compared blind, and ratings land in listening sessions.
4. Hypothesis drafting searches instead of filtering, with one human door and
   the cap of three unchanged.

**First acceptance boundary** is wave 1: a chosen house voice and a working
private feed. Waves 2 to 4 are developed in parallel but accepted separately.

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

The human door has not opened in 90 days; the docket is the bottleneck.

Infrastructure facts:

- The worker runs on the Talos cluster in namespace `frequency-worker`,
  ArgoCD-managed from `homelab-infra/kubernetes/infra/frequency-worker`. Its
  Cilium egress allows only Convex (172.16.10.24:3211), OpenRouter, Firecrawl,
  and LangSmith. Nothing on the cluster has a GPU.
- ai-5090-02 (RTX 5090, ~31 GB VRAM free, Docker) hosts local TTS and
  rendering. ComfyUI with ACE-Step 1.5 already runs there on 8188.
- Convex is self-hosted; site URL `http://convex.rproj.art:3211`. File
  storage is unused today. HTTP actions have a 20 MiB response limit, so
  audio is never proxied through them.
- OpenClaw on moltbot (CT200 on prox9) has agent `freq` bound to its own
  Telegram bot, one Discord guild (`1512943651368734944`), no TTS and no MCP
  configured, and a Google provider entry.
- 1Password CLI has no staged unattended profile here; `devBypassSecret`
  mutations cannot run from this machine until Keith stages one with
  `op-access`.

Existing plan gates this program keeps: plan 008 (eval baseline) and plan 13
(recipe loop closure, blocked on 008) are untouched. Plan 11 (self-render
spike) is absorbed into wave 3 with its gate preserved (§3.6 and wave 3 §2).

## 3. Shared substrate (wave 0)

Wave 0 is only what wave 1 needs: the artifact table, the job lifecycle, the
media package with TTS and loudness, storage-backed delivery, the feed, and
the blind-group projection. Render engines, analysis, and transcription join
in wave 3.

### 3.1 `audioArtifacts`

One row per stored file. Validators in `convex/shared/audioArtifacts.ts`.

```
audioArtifacts
  kind: "narration" | "shootoutTake" | "episode" | "litmusRender"
      | "voiceNote" | "blurb"                       // wave 3 adds render kinds
  role: "masterRaw" | "masterNormalized" | "delivery"
  masterArtifactId?: Id<"audioArtifacts">           // delivery → normalized master → raw master
  metadataStripped: boolean                         // true for every blind delivery (no ID3, no RIFF INFO)
  status: "pending" | "ready" | "failed"
  storageId?: Id<"_storage">
  mimeType?: string
  encoding: { codec: "wav" | "mp3" | "opus", bitrateKbps?, sampleRate, channels }
  durationSecs?, loudnessLufs?, truePeakDbtp?
  normalization: "applied" | "skipped"              // skipped when level is the variable
  access: "feed" | "private"                        // feed rows are the only public ones
  validation?: "unvalidated" | "validated"          // renders only; see §3.6
  title: string
  scriptMd?: string
  chapters?: { title: string, startSecs: number }[]
  engine?: { name, version, params }
  voice?: { catalogId, promptVersion }
  analysis?: { version, roughnessMedian, roughnessP90, lufs, truePeakDbtp, spectralCentroidHz }
  refs: { weeklyBriefId?, agentReviewDraftId?, recipeId?, compositionId?,
          listeningSessionId?, docketCardId?, mediaJobId? }
  blindGroupId?: Id<"blindGroups">
  contentHash: string      // sha256(kind, scriptMd|renderPlan, engine, voice, encoding)
  createdBy: "system" | "agent" | Id<"users">    // voice notes and studio uploads carry the user
  uploadIssuedAt?: number  // set by generateAudioUploadUrl; cleared when storageId attaches
  createdAt, updatedAt
indexes: by_kind_createdAt, by_status_createdAt, by_access_kind_createdAt,
         by_blindGroupId, by_refs_compositionId, by_contentHash
```

Analysis lives only here. Nothing in this program writes machine values
into `listeningSessions`.

Voice notes are owned before a session exists: a `voiceNote` artifact carries
`createdBy` (the user) and `refs.compositionId`; submitting the session sets
`refs.listeningSessionId`. Voice notes older than 7 days with no session are
pruned by the sweeper.

### 3.2 `blindGroups`

```
blindGroups
  purpose: "voiceShootout" | "studyFamily"
  members: { memberId: string, artifactId: Id<"audioArtifacts">, label: string }[]
      // immutable after creation; memberId is an opaque random handle
  xMember?: { memberId: string, duplicates: string }    // optional single X trial
  requiredRatings: string[]                              // memberIds that must be rated
  revealedAt?: number
  createdAt
```

Blindness is enforced by projection, not by omission: the only query that
serves a blind group to the web or to freq before reveal returns
`{ memberId, label, durationSecs, playbackUrl }` and nothing else. Playback
URLs are storage URLs whose ids carry no meaning. Every blind member,
including an X duplicate, has its own delivery artifact with its own storage
id (the X copy is re-encoded from the same normalized master), so URL
equality never reveals identity. Blind deliveries are `metadataStripped`.
Artifact and composition detail queries hide artifacts that belong to an
unrevealed group. Reveal happens inside the same mutation that records the
last required rating; a duplicate submission returns the prior result.

### 3.3 `mediaJobs` and the media lifecycle tools

The media service pulls; Convex never calls it.

```
mediaJobs
  kind: "narrate" | "shootout" | "assembleEpisode"     // wave 3 adds render kinds
  input: <kind-specific, zod in convex/shared/mediaJobs.ts>
        // a self-contained SNAPSHOT: the script text or render plan copied at
        // enqueue time, the source row's id and updatedAt, and the
        // rendererVersion / catalog version the job must use
  dedupeKey: string           // sha256(kind, input snapshot); enqueue returns the
                              // existing queued|claimed|done job instead of inserting,
                              // so editing the source produces a new snapshot and a new job
  status: "queued" | "claimed" | "done" | "failed" | "parked"
  priority: number
  leaseToken?: string, leaseExpiresAt?: number, workerId?: string
  attempts: number            // failures AND expired leases count; parked after 3
  resultArtifactIds?: Id<"audioArtifacts">[]
  error?: string
  createdAt, claimedAt?, finishedAt?
indexes: by_status_priority_createdAt, by_dedupeKey, by_leaseExpiresAt
```

Tools added to `/agent-tools/*`, registered in
`convex/shared/agentToolManifest.ts`, documented in
`docs/agent-tool-surface.md` under "Media lifecycle tools":

| Tool | Effect |
| --- | --- |
| `claimNextMediaJob` | Claim the oldest queued job whose kind is in the caller's list; issues a lease token with a 10-minute expiry. |
| `renewMediaJobLease` | Extend the lease; fails if the token no longer matches. |
| `generateAudioUploadUrl` | Creates the pending artifact row with `uploadIssuedAt` and returns a storage upload URL for it. |
| `attachAudioStorage` | Called immediately after the upload returns its storage id; records `storageId` on the pending artifact and clears `uploadIssuedAt`. |
| `completeMediaJob` | Fenced by lease token. Validates the kind-specific result with its zod schema and applies the domain effects in one mutation: marks artifacts ready, links masters and deliveries, creates blind groups, and in wave 3 creates compositions with every required field. The media service never writes research data directly. |
| `failMediaJob` | Fenced. Stores the error, re-queues with `attempts + 1`, parks at 3. |

Fencing rules: `completeMediaJob` and `failMediaJob` reject when the lease
token differs or `leaseExpiresAt` has passed; a stale worker finishing late
is rejected rather than overwriting. A repeat completion with the same lease
returns the stored result before any precondition check. The cron
`sweep-stale-media-jobs` re-queues claimed jobs whose lease expired,
incrementing `attempts`, and cleans orphans in two passes: `pending`
artifacts older than 24 hours are deleted along with their `storageId` blob
when they have one; then every `_storage` row (read through
`ctx.db.system.query("_storage")`) older than 24 hours that no artifact
references is deleted, which covers a blob uploaded by a worker that crashed
before `attachAudioStorage`.

The media service authenticates with `AGENT_TOOL_SECRET`, the same standing
service identity as the worker.

### 3.4 Media package on ai-5090-02

New workspace package `media/` (own `package.json`, `tsconfig.json`,
`.env.schema`, tests; joins the root `typecheck`, `test`, and `verify`
chains). Image `ghcr.io/resonant-projects/frequency-media`; compose
definition in homelab-infra `services/frequency-media/` following the
worker's `service.json` and `op://` pattern.

Wave 0 containers:

| Container | Role |
| --- | --- |
| `media` | Poller: claims jobs, calls hosted TTS, runs loudness and encoding, uploads, completes. |
| `tts-local` | Breeze TTS 2 behind an OpenAI-compatible `/v1/audio/speech`. Runs for the shootout; stays only if a local voice wins. |

Loudness policy (one implementation in `media/src/loudness.ts`, used by
every wave):

| Content | Integrated target | Tolerance | True peak | Layout |
| --- | --- | --- | --- | --- |
| Spoken | −16 LUFS | ±0.5 LU, else the take fails | ≤ −1 dBTP | mono source, delivered dual-mono |
| Music renders | −18 LUFS | ±0.5 LU, else fails | ≤ −1 dBTP | stereo |

True peak is measured on the decoded delivery file as well as the master.
Every render keeps a pre-normalization master (`role: "masterRaw"`,
`normalization: "skipped"`) and a normalized master (`role:
"masterNormalized"`, linked to the raw one by `masterArtifactId`);
deliveries encode the normalized master and link to it. When a recipe's variable is loudness or dynamics, the
render plan sets `normalize: false`, all family members skip normalization,
and the artifacts carry `normalization: "skipped"`.

### 3.5 Audio delivery and the feed

- Audio bytes are always served from Convex storage URLs
  (`/api/storage/<uuid>`), never through an HTTP action. Storage ids are
  unguessable and permanent; that is the access model. `access: "feed"`
  artifacts are the only ones ever listed in the feed; `private` artifacts
  are reachable only through Clerk-gated queries that return their URLs.
- `GET /podcast/:token/feed.xml` is the one HTTP action: small RSS 2.0 with
  iTunes tags, enclosure URLs pointing at storage through the public host.
  `:token` must equal `PODCAST_FEED_TOKEN`; mismatch returns 404. Rotating the
  token means re-subscribing in Pocket Casts; enclosure URLs do not contain it.
- Public exposure: the existing Nginx Proxy Manager gets host
  `listen.rproj.art` forwarding `/podcast/*` and `/api/storage/*` to the
  Convex site. Nothing else is forwarded.
- Plan step 1 verifies that convex-backend's storage GET honors `Range` and
  `HEAD` (Pocket Casts scrubbing). If it does not, the media service also
  mirrors `feed` artifacts to a static directory served by the same NPM host,
  and enclosure URLs point there.

### 3.6 Engineering rules for every wave

- **Decisions stay human.** No `/agent-tools/*` or MCP tool applies a draft
  decision, publishes a hypothesis or recipe, or records a listening session.
  Agents propose; a human signs through Clerk or through a platform-verified
  signer interaction (wave 2 §4). The Clerk mutations in `agentDrafts.ts` and
  the signer path share one internal decision function so invariants cannot
  drift. `docs/agent-tool-surface.md` §"Human-only decision mutations" is
  updated in wave 2 to say decisions are Clerk-authenticated or
  platform-signed through the Convex-owned signer bots, and to list the
  proposal-only tools.
- **Human listening predicate.** Debt closure, recommendations, verdict
  selection, failure analysis, and fitness use one shared predicate
  `isHumanListeningSession` (participant role not `machine`, created by a
  user). Machine analysis never creates sessions, so today the predicate is
  trivially true; it exists so wave 3 cannot regress it.
- **Render validation gate (from plan 11).** Renders are `unvalidated` until
  the bounded spike passes: human render versus machine render of the same
  kit, a contamination assessment (do ratings track the hypothesis or the
  synthesis), and a written go/no-go. Unvalidated renders never count as
  evidence, never close listening debt, and never feed tournament fitness.
- New LLM models go into `MODELS` in `convex/llm.ts`. TTS voices get their
  own catalog in `convex/shared/voices.ts`.
- Cross-seam contracts live in `convex/shared/`. `scripts/lib/tuning.ts` and
  `scripts/lib/seedMidi.ts` move to `convex/shared/tuning/` with re-export
  shims, because the media package needs them.
- Every new table gets validators in `convex/shared/`, tests beside the
  module, and a vocabulary line in `CONTEXT.md`.
- Secrets (`AGENT_TOOL_SECRET`, `PODCAST_FEED_TOKEN`, `MCP_SHARED_SECRET`,
  signer bot tokens, TTS keys) resolve through 1Password references in
  deployment configs; none printed, pasted, or committed.
- Convex `deploy` for schema changes contacts production; each plan names the
  deploy step and it runs with Keith's go-ahead.
- `vp run verify` must pass at each handoff.

### 3.7 Sequencing and critical path

Wave 0 must be frozen before parallel work starts; it is small on purpose.
After that:

- **Wave 1** is the critical path to the first acceptance. It carries its own
  minimal rating and reveal panel and does not wait for wave 3's page.
- **Wave 2** text docket and proposal tools proceed independently. Spoken
  cards wait for the house voice. Signed decisions need the signer bots,
  which are wave 2 work, not wave 0.
- **Wave 3** builds the renderer, the blind panel, and the minimal listen
  page first, because the plan 11 gate is itself a blind human-versus-machine
  comparison on that panel. Study families and debt closure follow the go
  decision. Episodes need wave 1.
- **Wave 4** builds and unit-tests the graph independently; live comparison
  needs queue capacity (the cap is full today, so wave 2 clears it first).
  Listening fitness stays deferred until human sessions on validated renders
  exist.

## 4. Non-goals

- No generative music model in the litmus path. ACE-Step is expansion only,
  and expansion is deferred out of wave 3's first release.
- No new OpenClaw bot. The signer bots are Convex-owned and post only
  decision cards.
- No essay narration in wave 1.

## 5. Open items carried into the plans

| Item | Owner | Blocks |
| --- | --- | --- |
| Stage an `op-access` profile on this machine | Keith | CLI mutations from here |
| Gemini API key: exists for freq in OpenClaw; reference the same 1Password item from the media compose env | plan step | Gemini take in the shootout |
| Confirm `listen.rproj.art` can be exposed via NPM, and whether storage GET honors Range | plan step 1 | Pocket Casts |
| `#frequency` exists (id held in the OpenClaw config and the initiative record, not in this repo); create the two signer bot applications | Keith, guided by the plan | wave 2 signing |
| Pianoteq deferred; u-he Diva, Zebra, Repro owned | decided 2026-09-28 | wave 3 quality tier only |
| homelab-infra local checkout is behind `origin/main`; pull before editing | plan step | media compose, MCP ingress |
