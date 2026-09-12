# Frequency worker drain and migration handoff

This source change prepares the original CT107-to-Kubernetes migration. It does
not deploy Convex functions, promote an image, stop CT107, or authorize another
production consumer. General repository staging is deferred.

## Runtime evidence

The September 11, 2026 Mac snapshot in homelab-infra's
[`docs/remaining-infrastructure-placement.md`](https://github.com/keithce/homelab-infra/blob/main/docs/remaining-infrastructure-placement.md#frequency-ct-107-sanitized-handoff)
reports one running container on CT107/prox6, image digest
`sha256:327671828f7115402d1c53d70d5479b9f0b4e2a9c30814ea64933f1c7efb5999`, source
`33409660cc00a41ce961fb91674000b4c91f0d9a`. Its `app_codex-home` volume contains
5,334 files / 47,444,931 logical bytes, including credential-named and database
files. Do not treat it as disposable or copy it into a synthetic test.

The snapshot establishes neither active-job counts nor the deployed Convex
function revision. Docker's `kill -0 1` health check does not prove drain or queue
health. Two Node process rows do not establish two active workers. The old image
fails an active run on SIGTERM; it does not contain this drain implementation.

## Two controls with different responsibilities

The worker handles SIGTERM and SIGINT by stopping further polls and waiting for
its current poll to settle. A poll includes the outstanding claim request, graph
execution, and awaited terminal-status writes. If a claim returns after the
signal, the worker executes that claimed run once before exiting: abandoning it
would leave an ambiguous running row. Repeated signals do not force exit. Idle
poll sleep wakes immediately. Heartbeats continue during graph drain.

The worker does not mark a run failed just because shutdown was requested and
does not automatically requeue or retry a run. A graph failure still follows its
existing failure-reporting path. Shutdown completion establishes that the local
poll settled, not that every remote write succeeded. Check the queue's terminal
state and reconcile errors before handoff.

`FREQUENCY_WORKER_CLAIMS_PAUSED` is a **Convex deployment environment variable**,
read inside the claim mutation, not a worker environment variable. Unset, empty,
or exact `false` permits claims. Every other nonempty value pauses claims,
including `true` and misspellings. Set it to `true` for maintenance and remove it
or use exact `false` only when resumption is authorized. It blocks both legacy
and new callers of `claimNextPendingRun`, including graph-filtered requests.
Queued rows are left unchanged. It does not cancel active runs, freeze other
Convex workflows, or prevent producers from enqueueing more work. Direct graph execution and
`markRunning` paths do not pass through this admission gate: suspend manual/direct
execution separately during the maintenance window.

This admission barrier is narrower than freezing every UI and cron producer:
new work can queue while no worker claims it. This applies only to queue consumers, not direct execution.
It must be deployed and accepted
on the actual backend before relying on it. Claims already admitted before the
pause may still be executing or returning over the network. Wait for those
workers and verify their termination before allowing any replacement.

## What this does not guarantee

This is a planned, non-overlapping handoff protocol, not a distributed fencing
lease or an exactly-once guarantee. Graph/provider retries remain unchanged.
The stale sweep still marks old running rows failed without stopping their
processes. Existing run-status APIs are not proof that external effects stopped.
Do not requeue, retry, or create a duplicate run while the old process might be
alive. Reconcile partial effects before manual retry.

There is deliberately no shutdown timeout that marks the run failed and exits
successfully. A stuck provider, claim, or terminal write can prevent drain.
Container managers may eventually SIGKILL; that is **failed acceptance**, not
successful handoff. Do not start a replacement from an automatic restart,
Deployment rollout, disappearing pod, or expired grace period. Confirm all old
processes (including Codex children and partitioned nodes) are dead and reconcile
ambiguous remote effects. Configure the future runtime's grace period from
observed bounded jobs; no guessed grace period is introduced here.

## Synthetic verification

The tests use an in-memory Convex database and injected worker polls/graphs.
They require no backend URL, provider account, 1Password, or production data.
Run with test environment only; never run `convex dev`, `run`, `deploy`, or
`codegen` as part of this verification.

```sh
APP_ENV=test vp test convex/agentRuns-handoff.test.ts
cd agent
APP_ENV=test vp test tests/worker-lifecycle.test.ts tests/worker-runner.test.ts tests/worker-signal.test.ts
```

The claim tests exercise pause, legacy callers, graph filters, preserved active
work, and one-time claiming after resume. Lifecycle tests exercise active-job
completion, signal during an outstanding claim, repeated signals, idle wakeup,
and failure handling. A separate Node subprocess test sends real OS SIGTERM,
holds active synthetic work, then requires one effect and normal exit after
release. These prove local contracts; they do not establish network
partition safety or live backend deployment identity.

## Exact next Mac-side acceptance task

Before any production change, run the source tests above at the reviewed source
commit on Mac with `APP_ENV=test`, using only synthetic fixtures, and return the
commit SHA and test counts. Inspect the published candidate image's OCI revision
and digest from the source release workflow; do not infer a digest from the SHA.
Verify the entrypoint forwards signals to the actual worker (including the tsx
launcher) in a disposable, network-disabled container with synthetic work. Record
that a signal during a held claim/active job does not exit early, release the
synthetic job, then require exactly one completion/effect and no second claim.
No production credentials or `app_codex-home` mount belong in that test.

Also obtain the still-missing **read-only** deployed Convex revision and sanitized
counts of queued/running/failed jobs through an existing reviewed interface.
Do not call `claimNextPendingRun` as a read-only probe: it mutates production.
Record endpoint identity, timestamp and scalar counts only. An unavailable
read-only interface remains a gate; do not print secrets or job payloads.

## Later tracked production steps (not authorized by this source merge)

1. Review the deployed Convex revision against this source. Prepare the exact
   function deployment delta and rollback; merging source does not deploy these
   functions. Deliver/accept the claim-pause support through the backend's normal
   reviewed path. Set the pause in that approved maintenance step and verify it
   on the actual backend without starting a new consumer.
2. Keep the barrier closed and suspend manual/direct graph execution that bypasses
   claiming. Verify all previously admitted jobs finish under the
   old image and all ambiguous/failed jobs are reconciled. The old image must be
   idle before its first stop because it cannot drain. Queue status alone is
   insufficient: verify outstanding claims and all old processes. A stuck job
   blocks the migration; no blind retry or forced successful drain.
3. Through homelab-infra's tracked service flow, retain `type: lxc` and guest
   disks, stop CT107 with onboot disabled using the approved runtime change, and
   complete its monitoring handoff. Require confirmed stop before preparing any
   production Kubernetes consumer. Keep the claim barrier closed throughout.
4. Promote the attested new worker image and verified secret/storage bindings in
   the separate reviewed Kubernetes change, with exactly one consumer. Only after
   old-writer exclusion and new runtime readiness are accepted may the coordinator
   reopen claims. Monitor actual job completion and failures.
5. Rollback: close claims, drain the new worker, confirm all its processes are
   stopped, reconcile uncertain effects, then restore the retained LXC via Git.
   Reopen claims only after it is the sole consumer. Do not remove the backend
   pause implementation while relying on a paused value: old code would ignore it.

No PVC, secret binding, image promotion, Kubernetes activation, or source-backed
production deployment is included in this PR. The shared queue stays in Convex.
