# media

The Frequency Music media service. Runs on ai-5090-02 under Docker, pulls
`mediaJobs` from Convex through `/agent-tools/*`, renders, normalizes to the
loudness policy, encodes, uploads to Convex storage, and completes each job
with a typed result. It never writes research data directly.

- Contracts: `convex/shared/mediaJobs.ts`, `convex/shared/audioArtifacts.ts`
- Job kinds: `probe` (wave 0). Wave 1 adds `narrate`, `shootout`, `assembleEpisode`.
- Run locally: `cd media && vp install && APP_ENV=dev vp run start` (needs
  ffmpeg and the 1Password app or `OP_SERVICE_ACCOUNT_TOKEN`).
- Tests: `vp run test:media` (needs ffmpeg on PATH).
- Deployment: `homelab-infra/hosts/frequency-media/` (compose, deploy script,
  operator notes for ai-5090-02).

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
