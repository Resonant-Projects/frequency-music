# Named approval and maintenance protocol, 2026-10-17

Keith answered the approval page (Postplan draft `k5qawant71nq`, version 1)
at about 18:00 UTC on 2026-10-17. Every decision was kept as proposed:

| Packet item | Decision |
| --- | --- |
| 5. Named approval | One ordinary deploy that covers schema preparation (dry run) and activation, running work-order steps 1 to 9 after the restore receipt passes. Operator: Claude Opus 5.5 on the `devbox` coordinator host, for Keith. Target: the self-hosted Convex backend at `https://convex.resonantprojects.art` (CT113). Candidate: `6fb562b270176c94372962ed921dbca9e21ef208`, agent image `sha256:000c8219…`, media image `sha256:714a58dd…`. |
| Activation effects | All five approved, including the irreversible #118 legacy extraction normalization. |
| 4. Maintenance protocol | Accepted as below. |
| Maintenance interval | Saturday 2026-10-17, after the receipt passes, ending before Sunday 2026-10-18 04:30Z. |
| Rollback | The criteria below, with a CT113 restore from the part B archive as the data rollback mechanism. |

The deploy still waits for receipt part A to pass items 1 to 7 and 9. If it
fails, the rollout stops.

## Maintenance protocol (packet item 4)

- **Stopped:** agent claims (`FREQUENCY_WORKER_CLAIMS_PAUSED=true`), direct
  graph execution (no operator or agent session runs graphs or Convex
  mutations during the window), and media claims (the media worker holds no
  claimed job).
- **Running:** crons, workpool and workflow resumptions. No flag stops them.
  The native pause controller is not used: its 120-second watchdog is sized for
  a worker handoff, and it has no production execution receipt.
- **Calendar crons:** none fires between Saturday 16:30Z and Sunday 05:00Z.
- **Interval crons:** `batch-extract` (8 h; paid only if Sources are pending),
  `classify-stale-concepts` (1 h; Haiku, only for unreviewed concepts),
  `poll-feeds` (6 h; RSS reads), `enqueue-transcript-capture` (3 h; enqueues
  agent runs, which stay unclaimed while paused), reconcilers and sweeps
  (5 to 30 min; no external effect).
- **Accepted:** writes after the part B capture fall inside the write-loss
  window of a restore. Their external effects are reads or a small number of
  paid calls. No message leaves the system: signers, docket preparation,
  narration and the tournament stay off.
- **Not done:** stopping CT107, starting a second consumer, or overriding the
  pause.

## Rollback criteria

- **Before activation:** any red dry-run result (a removal, a field that
  becomes required, an unexpected component change, or an authentication
  prompt) stops the rollout. Nothing is activated.
- **After activation, code faults:** coverage not exit 0, `rag` not active, a
  schema still in progress after 30 minutes, `/health` not 200, or
  missing-function errors on the web. Fix forward, or redeploy older functions
  with the current schema (the packet's Stage 1 method).
- **Data damage:** if the normalization or the recovery corrupts rows, restore
  CT113 from the part B archive. Every write after its capture is lost.
- **Workers:** revert the `homelab-infra` change, and restore the media host's
  `.env` and `compose.yaml` backups together. Claims stay paused meanwhile.
