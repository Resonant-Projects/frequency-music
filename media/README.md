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
  a 1 s lead-in becomes the feed episode). Handlers live in `src/jobs/`.
- Run locally: `cd media && vp install && APP_ENV=dev vp run start` (needs
  ffmpeg and the 1Password app or `OP_SERVICE_ACCOUNT_TOKEN`).
- Tests: `vp run test:media` (needs ffmpeg on PATH).
- Deployment: `homelab-infra/hosts/frequency-media/` (compose, deploy script,
  operator notes for ai-5090-02).

## TTS voices

- Catalog: `convex/shared/voices.ts` (`VOICE_CATALOG`, candidates) and
  `ANNOUNCER_VOICES` (never candidates). Providers in `src/tts/`.
- Env: `GEMINI_API_KEY`, `INWORLD_API_KEY`, `ELEVENLABS_API_KEY` configure
  the hosted voices; each is optional, and a missing key skips that voice in
  a shootout. `BREEZE_TTS_BASE_URL` configures the local voice
  (`BREEZE_TTS_API_KEY` is only sent as a bearer token to a fronting proxy).
- Breeze TTS 2 server (`python -m breeze_infer.api`, the `tts-local`
  container): `POST /v1/audio/speech` takes a multipart form (`text`,
  `instruction` for `design:` voices, `cfg_scale`, `seed`) and streams raw
  mono 24 kHz PCM16 (`audio/pcm`), which the provider wraps as WAV. It
  renders one request at a time: 409 while busy, 503 while the model loads.
  Both wait 5 s before the retry; every synthesis first polls
  `GET /health` every 10 s for up to 5 minutes (R27), so a `tts-local`
  started cold while the worker runs is waited for.
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
Convex value at enqueue time and the runner refuses a job whose version is
not its own (`renderer version mismatch`, `src/runner.ts`), so an old worker
never renders a 0.2.0 job wrong. A refusal is a failed attempt, though: the
job is requeued and, after `MAX_ATTEMPTS` (3) refusals, parked for an
operator re-enqueue. Stop the old container (or have the new image up)
before enqueueing new jobs, and expect the new worker to refuse any leftover
jobs stamped with the previous version the same way.

## Container image

`media/Dockerfile` builds `ghcr.io/resonant-projects/frequency-music-media`
from the repo root (the build context needs `media/` and `convex/shared/`;
`.dockerignore` at the root allows both). Two stages: bun installs production
`node_modules` in `dependencies`; the `runtime` stage is the same Debian
`node:24.18.1-trixie-slim` base with `ffmpeg`/`ffprobe` from apt, a non-root
`media` user (uid 1001), `MEDIA_WORK_DIR=/work` owned by that user, and
`/app/node_modules` symlinked to the media install so `convex/shared` files
resolve their imports. `media/.env.schema` ships in the image because
`varlock/auto-load` (the first import in `src/main.ts`) execs `varlock load`,
which reads the schema from the working directory; values come from the
container environment, and no `.env.local` is ever baked.

```sh
docker build -f media/Dockerfile -t frequency-music-media:local .
docker run --rm --entrypoint /bin/sh frequency-music-media:local \
  -ec 'command -v node; node_modules/.bin/tsx --version; ffmpeg -version | head -1; id -u'
```

CI publishes the image through `.github/workflows/publish-media-image.yml`
(pull requests build, smoke-test, and scan; `main` publishes an immutable
`sha-<commit>` tag with provenance attestation).
