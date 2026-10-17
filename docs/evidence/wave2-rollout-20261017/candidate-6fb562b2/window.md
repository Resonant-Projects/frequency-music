# Rollout window, 2026-10-17

Operator: Claude Opus 5.5 on `devbox`, under Keith's
[named approval](approval.md). Raw outputs stay in the operator's mode-0700
store; `coverage-post.json` and `live-provenance-6fb562b2.json` are copied
here.

| UTC | Step | Result |
| --- | --- | --- |
| 18:24:04 | Queue evidence before the pause | complete; 0 queued, 0 running, 3 needs_review, 246 completed, 1 failed; `claimsPaused: false` |
| 18:24:12 | 1. `convex env set FREQUENCY_WORKER_CLAIMS_PAUSED true` | set |
| 18:24:17 | 1. Queue evidence | complete; `claimsPaused: true`; 0 running |
| 18:24:2x | 1. Media jobs | 66 rows: 63 `done`, 3 `parked`, none `claimed`; the worker logged nothing in 30 min |
| 18:24:38 | 1. Receipt part B: on-demand CT113 archive (`systemd-run`, snapshot mode, zstd, `nas-docker`) | `nas-docker:backup/vzdump-lxc-113-2026_10_17-14_24_38.tar.zst`, 30,570,880,639 bytes, SHA-256 `a9a4cede4ee7ce5cd6add2dbe8c17dc9cabd194226d653e87023351d5d6aff60`, `zstd -t` OK, embedded `pct.conf` lists `rootfs` and `mp0 …,backup=1`; finished in 3 min 47 s; no lock or snapshot left on CT113. Its capture time starts the write-loss window. |
| 18:3x | 2. Inspection and root module identities again | components, modules and schemas equal the evidence record; module identities equal; full metadata unchanged since the item 2 capture |
| 18:36:21 | 3. Queue evidence, then `vp run convex:deploy:dry-run` from a clean checkout of `6fb562b2` | `claimsPaused: true`, 0 running. Dry run exit 0: no index deleted, only index additions, no component removal, no authentication prompt. The CLI also printed "Change the server's version for Node.js actions:" with no old and no new value: the stored version is null and neither commit has a `convex.json`, so nothing changes. |
| 18:37:14 | 4. `vp run convex:deploy` | exit 0; indexes added; `rag`, `rag/workpool`, `rag/workpool/batchWorker` installed |
| 18:37:24 | 5. Inspection and coverage from the `6fb562b2` checkout | coverage exit 0, all seven groups deployed; 10 components active; no schema in progress |
| 18:37:36 | 5. `scripts/convex-provenance-verify.ts` against the live backend | `rootModuleArtifactMatches: true`, 256 modules, attested source `6fb562b2` |
| 18:37:4x | 5. HTTP | `GET /health` 200; empty `POST /discord/interactions` and `/telegram/webhook/x` 404 |
| 18:38 | 5. Gates | `DECISION_SIGNERS_ENABLED`, `DOCKET_PREPARATION_ENABLED`, `HYPOTHESIS_TOURNAMENT_ENABLED` unset; `FREQUENCY_WORKER_CLAIMS_PAUSED=true`; `settings` has no `renderValidation` or `passageIndexing` row |
| 18:38 | 5. Function logs (last 300 s window) | 2,539 entries, 0 errors; `extractions:normalizeLegacyHistory` 227 runs and `graph:reconcileExtractionConcepts` 2,280 runs (effect 1 in progress); old workers' poll calls validate |
| 18:39:10 | 7. Media host backup | `.env.backup-20261017T183910Z`, `compose.yaml.backup-20261017T183910Z` |
| 18:39 | 7. Media host change | `compose.yaml` from the `homelab-infra` change (equal to `main` except `MEDIA_JOB_KINDS` gains `litmusRender`); `.env` set to `MEDIA_IMAGE_TAG=sha-13e0c22c…@sha256:714a58dd…`; `./deploy.sh media` (only the media service; `tts-local` untouched) |
| 18:40 | 7. Media container | image `sha256:714a58dd…`, revision `13e0c22c`; polls `probe, narrate, shootout, assembleEpisode, litmusRender`; in-container smoke (node, tsx, ffmpeg 7.1.5, scsynth 3.13.0, uid 1001, `src/engines/sc/smoke.ts`) exit 0 |
| 18:41 | 7. Probe job `nd77a5ew88ks2rygfw324kzwr58gf5xk` (440 Hz, 2 s, renderer 0.3.0) | claimed by `ai-5090-02` on attempt 1 and `done` |

Two deviations from the work order text, both narrower than written: step 7
copied `compose.yaml` from the reviewed `homelab-infra` change before its merge
(the content is what `main` will hold), and ran `./deploy.sh media` rather than
every service, so `tts-local` kept running.

**Pending:** step 6 (agent worker) needs a Kubernetes read to confirm the old
pod drained and the new pod runs `sha256:000c8219…`; the cluster kubeconfig
needs Keith's interactive Omni login. Steps 8 and 9 follow step 6. Claims stay
paused until then.
