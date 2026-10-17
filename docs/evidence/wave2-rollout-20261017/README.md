# Rollout evidence, 2026-10-17

Read-only observations of the live deployment, taken between 02:55 and 03:08
UTC on 2026-10-17 from the coordinator host. Nothing here mutated production,
changed an environment value, created a workload or sent a message. The work
order that uses this evidence is in
[the rollout packet](../../wave2-rollout-packet.md#combined-rollout-work-order-2026-10-17).

## Credential path

The host's 1Password service account now lists the `Country Manor Lab` and
`Homelab Runtime` vaults. Earlier on 2026-10-17, and on 2026-10-13, it listed
only `Vedic.Today`. Every admin read below ran as

```sh
op run --env-file=<mode-0600 file holding only the op:// reference> -- vpx tsx <script> ...
```

The file held the `op://` reference from `.env.schema`, never a value. The key
was never printed, written to disk or placed in argv. No credential or vault
access was changed.

## Reads and results

| UTC | Read | Result | File |
| --- | --- | --- | --- |
| 02:55:42 | `scripts/convex-deployment-inspect.ts https://convex.resonantprojects.art` (system metadata queries only) | exit 0; 7 components, 103 root modules with functions, 16 root crons, no in-progress schema | `deployment-inspection.json` |
| 02:55:53 | `scripts/frequency-queue-evidence.ts https://convex.resonantprojects.art 100` (`agentRuns:opsStatusCountsPage`, one query timestamp) | exit 0; 248 rows: 0 queued, 0 running, 3 needs_review, 244 completed, 1 failed; `claimsPaused: false` | `agent-run-queue.json` |
| 02:57:46 | `scripts/convex-module-identities.ts https://convex.resonantprojects.art` (`POST /api/get_config_hashes`) | exit 0; 177 root module identities | `deployed-module-identities.json` |
| 03:01 | `scripts/convex-provenance-verify.ts` against the `81150337` release | exit 1 before any comparison: `gh` 2.46.0 has no `attestation` command | none |
| offline | `scripts/convex-module-delta.ts <81150337 release manifest> deployed-module-identities.json` | 177 of 177 unchanged, 0 added, 0 removed, 0 changed | `root-delta-vs-81150337-release.json` |
| offline | `scripts/wave2-deployment-coverage.ts deployment-inspection.json` (with this branch's groups) | exit 3; every requirement of all six groups missing; 10 of 114 web calls missing | `coverage.json` |
| 03:04 | Anonymous `GET /health` on both origins | `https://convex-http.resonantprojects.art` 200 `{"ok":true}` via Cloudflare; `https://convex.resonantprojects.art` 404 | none |

### Deployed Convex revision

The deployed root modules are byte-identical to the
`convex-root-modules-81150337a777594c3a39f2be0a5f75b5e226d9d3` artifact from
provenance run [38195261921](https://github.com/Resonant-Projects/frequency-music/actions/runs/38195261921)
(workflow dispatch on `main`, 2026-10-12T02:18Z), manifest SHA-256
`8961e78e41a9d148f8b43a24098b4a0374e2c9957d114e25adbc07c56328f2fb`. GitHub
holds one attestation for that digest
(`GET /repos/.../attestations/sha256:8961e78e…`). At 03:01 this host could not
verify it cryptographically, so the match was byte equality with the downloaded
artifact. At 03:25 `scripts/convex-provenance-verify.ts` verified the
attestation and the live match together (see
[release attestation](#release-attestation-and-second-reads)). `81150337` is #135 (direct Anthropic inference,
2026-10-11); it predates #118. The last deployment recorded in the repository
was `2d2c78e` (2026-10-05). The [inference cutover](../../anthropic-inference-cutover.md)
plans the `81150337` deployment, but no dated record of it exists. It came
after the provenance run, and the agent worker at the same revision started at
2026-10-13T01:38Z.

Independent checks agree: the inspection's function and cron inventory matches
`81150337` source exports, and its 103 non-chunk module paths equal those of an
offline build of `81150337` (the `94a76e9a` and `1556ba17` builds lack
`shared/llmPolicy.js`).

Deployed components, all `active`: `workflow`, `workflow/workpool`,
`workflow/workpool/batchWorker`, `aggregate`, `aggregate/batchWorker`,
`actionCache`. No `rag` mount.

### Workers

Read with `kubectl get` and `ssh ai-5090-02 sudo -n docker ps|inspect|printenv`
of named non-secret settings only.

| Worker | Observed |
| --- | --- |
| Agent, `frequency-worker/frequency-worker` (Argo CD) | `registry.rproj.art/frequency-music/frequency-music-agent@sha256:06bcf3d679af8945897a188daa9dd75bf54fa6b8768bdbb1e4d32bd88fdbfddb`, template annotation `rproj.source-revision: 81150337a777594c3a39f2be0a5f75b5e226d9d3`; pod started 2026-10-13T01:38Z, 0 restarts. PVC at `/data`; `AGENT_OUTBOX_DIR` not set; `CONVEX_SITE_URL=http://convex.rproj.art:3211`. Its graph registry at `81150337` lacks `failure-investigation` and `hypothesis-tournament`. |
| Media, `frequency-media-media-1` on ai-5090-02 | `ghcr.io/resonant-projects/frequency-music-media:sha-4f016f83e4d3653e4ecad726d9648790d51cad54` (#91, 2026-10-01), renderer `0.2.2`, up 6 days. `MEDIA_JOB_KINDS=probe,narrate,shootout,assembleEpisode`; `MEDIA_WORK_DIR=/work` on named volume `frequency-media_media-work`; `CONVEX_SITE_URL=https://convex-http.resonantprojects.art`; `BREEZE_TTS_BASE_URL=http://tts-local:8881`. No job claim logged in 168 hours; two `claimNextMediaJob` 502 poll errors. `tts-local` up 2 weeks, healthy. |
| MCP | No deployment in the cluster. |

The media host's deployed renderer, 0.2.2, matches the backend's
`RENDERER_VERSION_FOR_JOBS` at `81150337`.

### Web

Vercel production deployment for `main` at `91cb3047` succeeded at
2026-10-17T02:59:58Z (GitHub deployment `7133922294`). `web/` has not changed
since `ec04c7c`. The web calls ten public functions the backend lacks:
`docket:listWeb`, `decisionIntents:get|applyWeb|deferWeb|cancelWeb`,
`audioFeedback:queue|item|submit`, `audioArtifacts:listReadyForTarget` and
`operationFailures:listForRun` (#118, the Agent Run failure panel).

## Offline candidate checks

All ran locally without network access to production.

- **Schema delta, `81150337` to `main`.** Compared `schema.export()` at both
  commits: 11 new tables, 16 new optional fields, 3 widened unions
  (`audioArtifacts.encoding.codec`, `mediaJobs.input`, `mediaJobs.result`),
  15 new indexes on 7 existing tables (`claims`, `edges`, `extractions`,
  `agentRunEvents`, `agentReviewDrafts`, `audioArtifacts`, `mediaJobs`); no
  table, field, union member or index removed, and no field became required.
  Locally computed `schema.export()` hashes do not equal the backend's stored
  hash for any commit, so the stored format differs; this check compares
  source, not the stored schema.
- **Bundle.** `scripts/convex-provenance-build.ts` at `57f7c90b` (network
  denied, codegen disabled) exits 0 with 249 root module identities. It is a
  local build, not release provenance.
- **Media image** `ghcr.io/resonant-projects/frequency-music-media@sha256:2b58a8ace6bb080f1b5515f3ba89e687df357ab3d2f92b583114c35d522c971d`
  (`main` at `6f332386`): `docker run --network none --read-only` reports
  `RENDERER_VERSION = "0.3.0"`, and the SuperCollider smoke
  (`node_modules/.bin/tsx src/engines/sc/smoke.ts`) printed
  `{"members":[2]}`.
- **Agent image** `ghcr.io/resonant-projects/frequency-music-agent@sha256:6853836008280dbca712558e412a946b73a79993ad5250b54e67c079f4d37c5d`
  (`main` at `6f332386`; the Harbor copy has the same digest): its worker
  registers `failure-investigation` and `hypothesis-tournament` along with the
  seven graphs the running worker has.

## Release attestation and second reads

Taken from 03:23 to 03:48 UTC on the same host. The only GitHub write was one
dispatch of the offline packaging workflow, which deploys nothing and starts
no worker. Production reads used the same `op run` reference-only file as
above. Nothing mutated production or infrastructure.

### Verifier

`gh` 2.46.0 has no `attestation` command. `gh` 2.102.0, the current
`cli/cli` release, was installed user-locally at
`~/.local/share/gh-cli/gh_2.102.0_linux_amd64/`. The system `gh`,
`~/.local/bin` and the stored GitHub login are unchanged. The tarball's
SHA-256 (`bb766f71…6019386`) matched the release checksums file. Its build
attestation verified to `cli/cli` `deployment.yml` on a GitHub-hosted runner
at `fc4b137c`, the commit of tag `v2.102.0`. Every verification ran with
`GH_CONFIG_DIR` set to an empty private directory and `GH_TOKEN` taken from the
existing login in the environment, so no `gh` configuration was migrated or
written and no token was printed.

### Reads and results

| UTC | Action | Result | File |
| --- | --- | --- | --- |
| 03:23:16 | `gh workflow run convex-provenance.yml --ref main` (main at `91cb3047`) | Run [38998580987](https://github.com/Resonant-Projects/frequency-music/actions/runs/38998580987): `artifact` success, `validate` skipped; artifact `convex-root-modules-91cb304701f5a96b06251bda3f34ff6e0407c37a` (id 12087908946) | `release-manifest-91cb3047.json` |
| 03:24 | `gh attestation verify` on that manifest with the flags of `scripts/convex-provenance-verify.ts` (repository, signer workflow `convex-provenance.yml`, source digest `91cb3047…`, `refs/heads/main`, `--deny-self-hosted-runners`) | exit 0; one SLSA v1 provenance attestation, subject SHA-256 `1f9dd07b…`, `workflow_dispatch`, GitHub-hosted, Rekor entry 03:23:38 | `release-attestation-91cb3047.json` |
| 03:25:37 | `scripts/convex-provenance-verify.ts <81150337 manifest> 81150337… https://convex.resonantprojects.art` with `gh` 2.102.0 first in `PATH` | exit 0; attestation verified, `rootModuleArtifactMatches: true`, 177 modules | `live-provenance-81150337.json` |
| 03:26:23 | Out-of-repo probe: one `_system/cli/queryEnvironmentVariables:get` for `OPENAI_API_KEY`, printing booleans only | exit 0; `present: true`, `nonEmpty: true`. No value, and no other variable, was read or printed. | `openai-key-presence.json` |
| 03:27 | `gh attestation verify oci://…` for both worker images (signer workflow `publish-agent-image.yml` or `publish-media-image.yml`, source digest `6f332386…`, `refs/heads/main`, no self-hosted runners) | Both exit 0, SLSA v1, runs 38995835502 (agent) and 38995835619 (media). `docker buildx imagetools inspect` resolves both `sha-6f332386…` tags, and the Harbor agent copy, to the same digests. | `image-attestations-6f332386.json` |
| 03:27 to 03:34 | Offline: the media image under `compose.yaml`'s settings (`--network none --init --cap-drop ALL --security-opt no-new-privileges:true`) runs the SuperCollider smoke | `{"members":[2]}` | none |
| 03:27 to 03:34 | Offline: the proposed init command in the agent image, run twice as UID 1001 with a read-only root | `/data/outbox` created `1001:1001 700`; the second run is a no-op | none |
| 03:27 to 03:34 | `ssh ai-5090-02`: SHA-256 of `/srv/frequency-media/{compose.yaml,deploy.sh}`, and `.env`'s `MEDIA_IMAGE_TAG` line (its only non-empty line) | Both files equal `homelab-infra` `main`; `MEDIA_IMAGE_TAG=sha-4f016f83…@sha256:a3144acc…` | none |
| 03:35 | Anonymous `GET https://convex.resonantprojects.art/version` | `unknown`; the endpoint does not identify the backend image | none |
| 03:48 | Offline: `scripts/convex-provenance-build.ts` in a clean detached worktree of `91cb3047` (no `.env` or `.env.local`, `bun install --frozen-lockfile`, Node 24.22.0, Convex CLI 1.46.0) | exit 0; 249 identities; output byte-identical to `release-manifest-91cb3047.json` (SHA-256 `1f9dd07b…`) | none |
| offline | `scripts/convex-module-delta.ts release-manifest-91cb3047.json deployed-module-identities.json` | 249 release, 177 deployed: 56 unchanged, 78 changed, 115 added, 43 removed. All 43 removed paths are `_deps/` bundle chunks; no function module is removed. | `root-delta-vs-91cb3047-release.json` |

The verify script compares stored root module identities only. It does not
cover applied schema, component instances, environment or worker images.
`main` from `6f332386` to `91cb3047` changes nothing under `agent/`, `media/`,
`convex/`, `.github/`, `.dockerignore`, `package.json` or `bun.lock`. The
images built at `6f332386` are therefore the current worker images, and the
91cb3047 manifest covers the Convex source both commits share.

Kubernetes reads were unavailable this time: the cluster kubeconfig requires
an interactive Omni OIDC login. The other kubeconfigs on the host belong to
storage work and were not used. Whether `/data/outbox` already exists on the
`frequency-state` volume is therefore unobserved; the prepared change creates
it idempotently either way.

### Prepared `homelab-infra` change

Local commit `42ff776d` on branch `prep/frequency-wave2-rollout-20261017`, in
worktree `~/.t3/worktrees/homelab-infra/frequency-wave2-rollout-prep-20261017`.
It was made from `origin/main` at `550c4dd5`, and is not pushed, has no PR and
has not been synced. `homelab-infra-wave2-prep.patch` is its `git format-patch`
output. It:

- pins the agent digest `sha256:68538360…` in the worker and `pot-provider`
  containers, the process monitor's `IMAGE` (in `check.cjs` and the CronJob
  ConfigMap) and the CronJob image. It also sets the template annotation
  `rproj.source-revision` to `6f332386…`, the image's source;
- adds `AGENT_OUTBOX_DIR=/data/outbox` to the worker;
- adds an `outbox-dir` init container from the same image that runs
  `mkdir -p /data/outbox && chmod 700 /data/outbox && sync` on the
  `frequency-state` mount. The worker treats `AGENT_OUTBOX_DIR` as its own
  durable root, and `DurableOutbox.prepareDirectory()` throws when that root
  does not exist (`agent/src/shared/outbox.ts`). Without the init container,
  every spool attempt would fail until someone created the directory by hand;
- adds `litmusRender` to `MEDIA_JOB_KINDS` in `hosts/frequency-media/compose.yaml`
  and updates its README and `.env.example` notes (the handler arrived in #140);
- extends `scripts/tests/test_frequency_active_preparation.py` to cover the
  outbox variable and the init container.

The media image tag is not repo-backed. It is the only non-empty line of the host's
untracked `/srv/frequency-media/.env`, so the media step sets it there
directly (see the work order). In `homelab-infra`,
`python3 -m unittest discover -s scripts/tests -p 'test_*.py'` ran 1179 tests,
OK (20 skipped, all opt-in Docker smokes). `bash hosts/frequency-media/test-deploy.sh`
passed, `scripts/tests/test_kubernetes_tree.py` passed, and
`docker compose config` renders the new tag and job list.

## File digests (SHA-256)

| File | Digest |
| --- | --- |
| `deployment-inspection.json` | `cb41bff88f4bb58f8fb36d00fa11dbf2f5757350150d6aeb67a63ae2a6a48e91` |
| `agent-run-queue.json` | `1f3768ccff6f0c2c23910b914f7c811cb3c10288432967b5f11d990ceb0fa91c` |
| `deployed-module-identities.json` | `9066c3a4224fa944fb623221aff48fe1af3a145f916ab2e628eaa4436833ec79` |
| `root-delta-vs-81150337-release.json` | `3f080304c4beb81255225e66257481e99160f0c48c896e432d279ac4cbb3e816` |
| `coverage.json` | `0eac22a45fb0a5c6b24bafaf0dd7cebb4ab32a687929a6ac913694b553ee60da` |
| `release-manifest-91cb3047.json` | `1f9dd07b8f8e0e3eb3d0ed346c7aed977f971322022071758e22573aa090ab7b` |
| `release-attestation-91cb3047.json` | `5c75481d3aae26b4a9d52145544dcf6e7bbdd69c7ed355b094c134aa88dc0bed` |
| `live-provenance-81150337.json` | `19eb3b562039c704a109ba4523d6c79cbe8102e71e12e5eadef198508681f0f1` |
| `openai-key-presence.json` | `5bcc65fde67ebcdbaa281f59d3f98fa95877ff0005c607e62dc64fcfd1e32399` |
| `image-attestations-6f332386.json` | `710db3ef15fd60d05f29f7fa7a29199ebd9eaba800aa5069a6e51d39ce23ef71` |
| `root-delta-vs-91cb3047-release.json` | `624987a852ce30a23a990bb6e019170c89cd7ff357906efe84a0ea6429937b8a` |
| `homelab-infra-wave2-prep.patch` | `bd4043dc3ee49dc75573989962c2afac5c19919336757a121297833e9d71ef12` |
