# media

The Frequency Music media service. Runs on ai-5090-02 under Docker, pulls
`mediaJobs` from Convex through `/agent-tools/*`, renders, normalizes to the
loudness policy, encodes, uploads to Convex storage, and completes each job
with a typed result. It never writes research data directly.

- Contracts: `convex/shared/mediaJobs.ts`, `convex/shared/audioArtifacts.ts`
- Job kinds (`MEDIA_JOB_KINDS` env, comma-separated): `probe` (wave 0),
  `narrate` (a script through one voice into a normalized narration),
  `shootout` (the calibration passage through every configured voice, blind
  takes plus one feed episode), `assembleEpisode` (a narration master behind
  a 1 s lead-in becomes the feed episode), `litmusRender` (a recipe's frozen
  render plan through the SuperCollider litmus engine; see below). Handlers
  live in `src/jobs/`.
- Run locally: `cd media && vp install && APP_ENV=dev vp run start` (needs
  ffmpeg and the 1Password app or `OP_SERVICE_ACCOUNT_TOKEN`).
- Tests from the repository root: `vp run test:media` (requires `ffmpeg`, `ffprobe`, `sclang`, and
  `scsynth` on PATH; missing tools fail the suite).
- Deployment: `homelab-infra/hosts/frequency-media/` (compose, deploy script,
  operator notes for ai-5090-02).

## Litmus renders

`renders.request` (Clerk or service bypass) or `renders.requestInternal`
snapshots `recipes.renderPlan` into a `litmusRender` job:
`{ recipeId, recipeUpdatedAt, renderPlan, rendererVersion }`. A missing plan
fails with "needs a typed render plan"; a plan with `variable` (a study
family) is refused until the plan 11 gate setting `renderValidation` is
`go`. `renders.setPlan` admits a plan through `renderPlanZ` and bumps the
recipe revision, so an edit yields a new job; the same revision dedupes to
the queued, running, or finished job.

The handler (`src/jobs/litmusRender.ts`) renders every member with
`renderLocal` and uploads each as a 24-bit stereo WAV master
(`masterNormalized`, or `masterRaw` when `normalize: false`) and a 256 kbps
MP3 delivery, all private and metadata-stripped, upload-cap checked before a
URL is minted. Normalized members must meet -18 LUFS and -1 dBTP. The
result names members by index only.

Completion (`mediaJobEffects`) owns everything else: neutral titles, refs
(the delivery carries `recipeId`; masters carry only the job), `engine`
provenance, and `validation`, stamped `validated` only when
`renderValidation` is `go` at completion. Workers cannot set `validation`.
A study family becomes a `studyFamily` blind group with labels A to D
assigned at random (no X member yet); its masters carry the group id so
playback hides them until reveal. Validated renders get one `compositions`
row per member (`microStudy`, `m0.1`, `rendered`, private, system; variants
revise the baseline with `revisionVariable`) whose `audioArtifactId` is the
delivery: a single render at completion, a study family at its first
`blindGroups.reveal`, because composition titles and the docket would
otherwise name variants while the family is blind. The stamp used is the one
recorded at completion. Unvalidated renders create no compositions, so they stay out of
evidence, docket composition debt, and loop debt. Recipe and composition
pages reach deliveries through `audioArtifacts.listReadyForTarget`.
The `analyze` job (spec 3.4) is not implemented.

## TTS voices

- Catalog: `convex/shared/voices.ts` (`VOICE_CATALOG`, candidates) and
  `ANNOUNCER_VOICES` (never candidates). Providers in `src/tts/`.
- Env: `GEMINI_API_KEY`, `INWORLD_API_KEY`, `ELEVENLABS_API_KEY`,
  `CARTESIA_API_KEY` configure the hosted voices; each is optional, and a
  missing key skips that voice in a shootout. `BREEZE_TTS_BASE_URL` configures the local voice
  (`BREEZE_TTS_API_KEY` is only sent as a bearer token to a fronting proxy).
  It has no schema default: the compose file sets it, and clearing it
  retires the local voice (a shootout then skips Breeze rather than waiting
  5 minutes for a stopped `tts-local` and failing).
- Breeze TTS 2 server (`python -m breeze_infer.api`, the `tts-local`
  container): `POST /v1/audio/speech` takes a multipart form (`text`,
  `instruction` for `design:` voices, `cfg_scale`, `seed`) and streams raw
  mono 24 kHz PCM16 (`audio/pcm`), which the provider wraps as WAV. It
  renders one request at a time: 409 while busy, 503 while the model loads.
  Both wait 5 s before the retry; every synthesis first polls
  `GET /health` every 10 s for up to 5 minutes (R27), so a `tts-local`
  started cold while the worker runs is waited for.
- Cartesia (`cartesia-sonic-nandi`, `cartesia-sonic-quentin`, renderer
  0.2.2 or later): `POST https://api.cartesia.ai/tts/bytes` with
  `Authorization: Bearer`, `Cartesia-Version: 2026-08-14`, and a JSON body
  of `model_id` (the dated snapshot `sonic-3.6-2026-08-27`, never the moving
  `sonic-3.6` alias), `transcript`, `voice` (the voice id string),
  `output_format` `{container: "wav", encoding: "pcm_s16le", sample_rate:
  48000}`, and `language: "en"`. The response is a complete WAV file, written
  as returned; a 200 that is not WAV fails the take. Scripts chunk at 2 000
  characters.
- Every hosted attempt runs under the job deadline plus a 180 s per-attempt
  timeout; two retries with backoff, then the take fails with the status
  code only (never the body).
- Announcer rule (R26/R28): the shootout intro and take labels are spoken by
  a configured catalog voice that is not competing (hosted preferred), else
  the first configured `ANNOUNCER_VOICES` entry, else a candidate with an
  intro that does not claim otherwise. The episode records the choice in
  `engine.params.announcerVoiceId`.
- Uploads: masters are 16-bit PCM and every narration, episode, and
  shootout file is checked against `MAX_UPLOAD_BYTES` (95 MB, the Cloudflare
  proxied-body cap) before an upload URL is minted. The seconds-long probe
  tone is not checked.

## Deploying a renderer bump

Deploy Convex first, then the image, promptly. `RENDERER_VERSION`
(`src/config.ts`) must equal `RENDERER_VERSION_FOR_JOBS`
(`convex/shared/mediaJobs.ts`; a test pins them). Jobs are stamped with the
Convex value at enqueue time. Renderer-aware claims select compatible jobs
before loading their inputs, and the runner still refuses a mismatched job
before synthesis starts. Confirmed renderer-only mismatches preserve the
ordinary attempt budget so a matching worker can recover during a rollout.

The media sweep parks queued standard-renderer snapshots that differ from
`RENDERER_VERSION_FOR_JOBS` after a ten-minute grace period. It scans one
job per transaction and records an Operational Failure without changing the
snapshot or discarding retained audio. Claimed jobs and `essay-*` operator
jobs stay with their existing owners. Parked narration continues to block
replacement admission until an operator inspects the original job and
retained output; the sweep never changes renderer versions or repeats paid
work automatically. Deploy the matching image promptly so compatible queued
jobs can drain during the grace period.

## Container image

`media/Dockerfile` builds `ghcr.io/resonant-projects/frequency-music-media`
from the repo root (the build context needs `media/` and `convex/shared/`;
`.dockerignore` at the root allows both). Two stages: bun installs production
`node_modules` in `dependencies`; the `runtime` stage is the same Debian
`node:24.18.1-trixie-slim` base with `ffmpeg`/`ffprobe` from apt, a non-root
`media` user (uid 1001), `MEDIA_WORK_DIR=/work` owned by that user, and
`/app/node_modules` symlinked to the media install so `convex/shared` files
resolve their imports, and an `/app/package.json` declaring `"type": "module"`
so `convex/shared` loads as ESM, as it does under the repo root (barrel
re-exports such as `convex/shared/tuning` lose their names under CommonJS).
Debian's SuperCollider 3.13 (`supercollider-server`, `supercollider-language`)
supplies `scsynth` and `sclang` for litmus renders; sclang links Qt and runs
offscreen. The image is about 1.6 GB. `media/.env.schema` ships in the image because
`varlock/auto-load` (the first import in `src/main.ts`) execs `varlock load`,
which reads the schema from the working directory; values come from the
container environment, and no `.env.local` is ever baked.

```sh
docker build -f media/Dockerfile -t frequency-music-media:local .
docker run --rm --entrypoint /bin/sh frequency-music-media:local \
  -ec 'command -v node; node_modules/.bin/tsx --version; ffmpeg -version | head -1; scsynth -v; id -u; node_modules/.bin/tsx src/engines/sc/smoke.ts'
```

`src/engines/sc/smoke.ts` is a two-second real render; the publish workflow
runs it in its smoke step. `tests/sc-real.test.ts` holds the real-engine
tests (kits, pitch, dense voices, handler). These are required on development
hosts and CI runners. Development-host installation and rebuilds are owned by
[personal-config's native media setup](https://github.com/keithce/personal-config/blob/main/README.md#frequency-music-media-prerequisites),
including both platform bootstraps and the focused installer. A rebuilt machine
is ready only after all six tests pass with zero skips.

For standalone setup on Ubuntu or Debian, install the dependencies with:

```sh
sudo apt-get update
sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  ffmpeg supercollider-language supercollider-server
# Run from the repository root:
vp run test:media
```

On macOS, install Homebrew `ffmpeg` and the `supercollider` cask. The cask
installs an app without CLI links, so expose its binaries before testing:

```sh
brew install ffmpeg
brew install --cask supercollider
export PATH="/Applications/SuperCollider.app/Contents/MacOS:/Applications/SuperCollider.app/Contents/Resources:$PATH"
# Run from the repository root:
vp run test:media
```

Use the actual app paths above or the `personal-config` installer's launchers.
Symlinking `sclang` changes where it looks for its bundled class library.

The renderer runs offline with a private home directory. Linux uses Qt
offscreen; the macOS app uses its bundled cocoa backend. No audio device,
running SuperCollider service, or production credentials are needed. The media
CI job installs the same Linux packages on each fresh runner.

CI publishes the image through `.github/workflows/publish-media-image.yml`
(pull requests build, smoke-test, and scan; `main` publishes an immutable
`sha-<commit>` tag with provenance attestation).
