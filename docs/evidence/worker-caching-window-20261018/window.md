# Rollout window, 2026-10-18: Convex and worker at e1a2fb0a

Operator: Claude Opus 5.5 on Keith's Mac, under Keith's approval of the window
page (Postplan draft `m86sntmww0ny`, version 1) at about 12:48 UTC, with every
decision kept as proposed: run now and end by 14:45Z, take a fresh CT113
archive, leave PDF capture off, deploy Convex `e1a2fb0a`, then the drained
worker repin. Keith typed both `deploy` confirmations and merged the
`homelab-infra` pull request.

The window shipped Anthropic prompt caching for the worker (#173,
[plan](https://lrw55f3c59jg.postplan.dev)). The backend went first because
`main` carried undeployed Convex changes (#165 100,000-character extraction cap,
#167 auth-failure counters, #170 PDF ingest) that the new worker image depends
on: it trims Source Scout text to 100,000 characters, which the 6fb562b2
backend rejected above 30,000.

## Candidate

| Item | Value |
| --- | --- |
| Source | `e1a2fb0affe9a7d64d6552295424945859b4a3e8` (merge of #173) |
| Convex manifest | `convex-provenance` run 39128262577, attestation verified; offline builds in the dev and release checkouts byte-equal to it (265 root modules); Node 26.12.0, Convex 1.46.0 |
| Agent image | `registry.rproj.art/frequency-music/frequency-music-agent@sha256:41885e83a2c1da9e5208280a36a15677e1e4b68836b5fb8b6a38806ec926dd7b` (`publish-agent-image` run 39127250271; GHCR and Harbor equal; `gh attestation verify` passed against the workflow, source digest and `refs/heads/main`) |
| Delta from 6fb562b2 | Root modules 256 → 265. Named modules 142 → 147: 5 added (`authFailures`, `pdfCapture`, `pdfCaptureNode`, `shared/authFailures`, `shared/pdfCapture`), 0 removed. Bundler `_deps/` chunks 114 → 118 (69 added, 65 removed: content-hashed names that change with each build). Schema additive: table `authFailureCounters`, optional `sources.pdfStorageId`, two indexes. Crons, components, HTTP routes and runtime dependencies unchanged. |

## Timeline

| UTC | Step | Result |
| --- | --- | --- |
| 12:49:40 | Queue evidence before the pause | complete; 0 queued, 0 running, 3 needs_review, 249 completed, 1 failed; `claimsPaused: false` |
| 12:49:50 | `convex env set FREQUENCY_WORKER_CLAIMS_PAUSED true` | set; queue evidence `claimsPaused: true`, 0 running |
| 12:50 | Worker | no log line in the previous 30 min; Argo `frequency-worker` Synced, Healthy |
| 12:50:16 | On-demand CT113 archive on prox5 (`systemd-run`, snapshot mode, zstd, `nas-docker`) | `nas-docker:backup/vzdump-lxc-113-2026_10_18-08_50_16.tar.zst`, 35,618,010,088 bytes, SHA-256 `f63e30d10eb8a3065f515a618934bde141eb3382a0958f0a23f4c20dccc008aa`, `zstd -t` OK; embedded `pct.conf` lists `rootfs` and `mp0` (`/srv/app-data`, `backup=1`); finished in 4 min 0 s; no lock or snapshot left on CT113. Its capture time starts the write-loss window. |
| 12:5x | Deployed module identities again | equal to the first capture (256 modules, 6fb562b2) |
| 13:01 | `scripts/convex-deploy.ts --dry-run` from a clean detached checkout of `e1a2fb0a` | exit 0: no index deleted, two index additions (`authFailureCounters.by_key`, `sources.by_pdfStorageId`), no component change, no authentication prompt; the Node.js action version line has no old or new value, as on 2026-10-17 |
| 13:07:57 | Queue evidence | `claimsPaused: true`, 0 queued, 0 running |
| 13:09 | `scripts/convex-deploy.ts` | exit 0 |
| 13:09:39 | `scripts/convex-provenance-verify.ts` against the live backend | `rootModuleArtifactMatches: true`, 265 modules, attested source `e1a2fb0a` |
| 13:10 | HTTP and gates | `GET https://convex-http.resonantprojects.art/health` 200 `{"ok":true}`; `DECISION_SIGNERS_ENABLED`, `DOCKET_PREPARATION_ENABLED`, `HYPOTHESIS_TOURNAMENT_ENABLED` unset |
| 13:10:42 | `convex env set FIRECRAWL_SCRAPE_EGRESS_GUARDED false` | Deviation, below |
| 13:13 | Function logs (last 1,000 entries) | 0 failures; no `pdfCapture` call; old worker's paused `claimNextPendingRun` polls and the media worker's `claimNextMediaJob` polls succeed |
| 13:18:50 | Keith merges keithce/homelab-infra#781 (merge `507df3b0`) | required checks `validate` and `ansible` passed; repins the Deployment (init, worker, pot-provider, `rproj.source-revision`) and the process monitor (`check.cjs` IMAGE, CronJob) |
| 13:21:54 | Argo CD applies the new template | `Recreate`: both old containers stopped first, so the old and new pods never ran together |
| 13:22:48 | New pod `frequency-worker-6dcb68fbb8-nlqrj` on `talos-w1` | init `outbox-dir` Completed; `worker` and `pot-provider` ready, 0 restarts; all three run `sha256:41885e83…`; source revision `e1a2fb0a`; log `[worker] started workerId=kubernetes-worker-1 pollIntervalMs=15000`; Argo Synced `507df3b0`, Healthy |
| 13:23:00 | Process monitor CronJob | `frequency-process-check-29872163` Complete against the new pod and IMAGE |
| 13:23:49 | `convex env set FREQUENCY_WORKER_CLAIMS_PAUSED false` | set; queue evidence `claimsPaused: false`, 0 queued, 0 running, 3 needs_review, 249 completed, 1 failed (unchanged since the pause) |

The window closed at 13:23:49Z, inside the approved interval. The write-loss
window of a restore from the archive above runs from 12:50:16Z.

## Deviation

The window page said PDF capture fails closed until the Convex environment sets
`FIRECRAWL_SCRAPE_EGRESS_GUARDED=true`. That flag was already `true`, with
`FIRECRAWL_API_URL` on the Lab Firecrawl, though no deployed 6fb562b2 code read
it. Activation therefore enabled PDF capture, contrary to Keith's "leave it
off" decision. At 13:10:42Z, about a minute after activation, the operator set
the flag to exact `false`. In the Convex deployment, only
`convex/pdfCaptureNode.ts` reads it. The worker's
`agent/src/tools/crawlTool.ts` reads a variable of the same name from the pod
environment (`deployment.yaml`), which this Convex setting does not reach, so
worker page capture is unchanged. The function logs show no PDF capture in
that minute.
Turning PDF capture on is a separate decision: set the flag back to `true`.

## Open after the window

- Cache-read acceptance for #173 needs the first runs on the new worker:
  `enqueue-correspondence-miner` (05:00Z daily, no breakpoints) and
  `enqueue-evidence-hunter` (06:00Z daily). Source Scout runs Wednesday 16:00Z.
  The check reads `cache_creation_input_tokens` and `cache_read_input_tokens`
  on the Evidence Hunter judge traces in LangSmith project
  `frequency-music-agents`.
- `frequency-process-check-29871670` failed once at about 01:10Z with
  `process_readiness_check_failed`, before this window; the next check passed.
  It was not investigated.
