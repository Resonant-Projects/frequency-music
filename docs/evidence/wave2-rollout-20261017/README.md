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
(`GET /repos/.../attestations/sha256:8961e78e…`). This host could not verify it
cryptographically, so the match is byte equality with the downloaded artifact,
not an attested verification. `81150337` is #135 (direct Anthropic inference,
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

## File digests (SHA-256)

| File | Digest |
| --- | --- |
| `deployment-inspection.json` | `cb41bff88f4bb58f8fb36d00fa11dbf2f5757350150d6aeb67a63ae2a6a48e91` |
| `agent-run-queue.json` | `1f3768ccff6f0c2c23910b914f7c811cb3c10288432967b5f11d990ceb0fa91c` |
| `deployed-module-identities.json` | `9066c3a4224fa944fb623221aff48fe1af3a145f916ab2e628eaa4436833ec79` |
| `root-delta-vs-81150337-release.json` | `3f080304c4beb81255225e66257481e99160f0c48c896e432d279ac4cbb3e816` |
| `coverage.json` | `0eac22a45fb0a5c6b24bafaf0dd7cebb4ab32a687929a6ac913694b553ee60da` |
