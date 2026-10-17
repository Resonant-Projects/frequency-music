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
| 19:44:17 | 6. Kubernetes read (after Keith's Omni login) | one worker pod, `frequency-worker-85f9444794-pngg2`, image `sha256:06bcf3d6…`, up 4 d 18 h; Argo CD application `frequency-worker` Synced, Healthy, automated with prune and self-heal; worker logged nothing in the previous 15 min |
| 19:44:3x | 6. Queue evidence | complete; `claimsPaused: true`; 0 queued, 0 running |
| 19:44:58 | 6. Merge keithce/homelab-infra#765 (`--merge`, head `4de63813`, merge `337ffd36`) | required checks `validate` and `ansible` passed. The `main-protected` ruleset also requires one approving review; the PR is Keith's own, so the merge used his pull-request bypass under the step 6 approval |
| 19:48:09 | 6. Argo CD applies the new template | `Recreate`: both old containers stopped first; the new pod waited about 6 s for the exclusive volume to detach, so the old and new pods never ran together |
| 19:48:4x | 6. New pod `frequency-worker-7c7c6cd898-75pq9` on `talos-w1` | init `outbox-dir` Completed; `worker` and `pot-provider` ready, 0 restarts; all three containers run `registry.rproj.art/frequency-music/frequency-music-agent@sha256:000c82198a379ddbf0073c634dcba515ac277fed6341cf5ddbfec6c8cf0cbdeb`; `/data/outbox` exists (mode 0700, owner `agent`); `AGENT_OUTBOX_DIR=/data/outbox`; log `[worker] started workerId=kubernetes-worker-1 pollIntervalMs=15000` |
| 19:49:17 | 8. `convex env set FREQUENCY_WORKER_CLAIMS_PAUSED false` | set |
| 19:49:2x | 8. Queue evidence | complete; `claimsPaused: false`; 0 queued, 0 running, 3 needs_review, 246 completed, 1 failed (unchanged since the pause) |
| 19:49:31 | 9. `scripts/wave2-revision-backfill.ts --execute --batch-size 50` | exit 0, `complete: true`, `verified: true`. `feeds`: 23 backfilled in 1 page, verification 1 page, 0 updated. `agentReviewDrafts`: 3 backfilled in 1 page, verification 1 page, 0 updated |
| 19:5x | Acceptance. Function logs (last 1,000 entries) | 0 errors. `extractions:normalizeLegacyHistory` runs only on its 5-minute cron tick (19:17:14 to 19:47:14, 7 runs) and schedules no follow-up, so its `take(1)` over `historical: undefined` returns no row: effect 1 is complete |
| 19:5x | Acceptance. Gates | `DECISION_SIGNERS_ENABLED`, `DOCKET_PREPARATION_ENABLED`, `HYPOTHESIS_TOURNAMENT_ENABLED` unset; `settings` keys are `docketRebuildState.v1`, `houseVoiceId`, `initialNarrationScheduledAt` and two `mediaSweeper` cursors, so no `renderValidation` or `passageIndexing` row |

Two deviations from the work order text, both narrower than written: step 7
copied `compose.yaml` from the reviewed `homelab-infra` change before its merge
(the content is what `main` will hold), and ran `./deploy.sh media` rather than
every service, so `tts-local` kept running.

Steps 1 to 9 are complete. The window closed at 19:49:31, when the backfill
exited; the write-loss window of a restore from the part B archive runs from
18:24:38. Since #765 merged, the media host's `compose.yaml` equals
`homelab-infra` `main`.

**Open after the window:**

- No agent run was queued during the window, and none was enqueued by hand to
  avoid a paid run outside the schedule. The first scheduled run on the new
  worker is `enqueue-correspondence-miner` at Sunday 05:00Z; `workerId` is a
  fixed configuration value (`kubernetes-worker-1`), so that run is matched to
  the new pod by its claim time after 19:48:4x.
- The signed-in checks (`/listen`, the feed, the docket, intent review, audio
  feedback and the failure panel) need Keith's session.
