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
poll sleep wakes immediately. Heartbeats continue during graph drain; each
heartbeat HTTP request has a 30-second abort timeout, with its timer cleared when
the request settles. This timeout applies only to heartbeat metadata, never to
claims, graph execution or terminal writes.

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

Also obtain the still-missing **read-only** deployed Convex artifact identity and
complete scalar queue counts through the operator interfaces below.
Do not call `claimNextPendingRun` as a read-only probe: it mutates production.
Record endpoint identity, timestamp and scalar counts only. An unavailable
read-only interface remains a gate; do not print secrets or job payloads.

## Privileged queue and deployed-artifact evidence

`statusCountsPublic` and authenticated `statusCounts` both describe at most the
latest 100 runs. Neither establishes total queue size or absence of older running
jobs. `agentRuns:opsStatusCountsPage` is an **internal query**, callable only with
existing Convex administrative access. It grants no new public access. It reads
the whole `agentRuns` table in immutable creation order and returns per-status
scalar counts, an opaque cursor, completion/split information, observation time,
and the effective claim-pause boolean. It returns no job records or worker IDs.

The operator script uses the existing admin credential from inherited
`CONVEX_SELF_HOSTED_ADMIN_KEY`; it does not load `.env`, Varlock, or 1Password.
Use the coordinator's already-authorized credential delivery mechanism; never
put the key in command arguments, shell history, evidence files, or chat. This
interface does not justify issuing a new broadly privileged credential.
All privileged readers allow only `https://convex.resonantprojects.art`; a new deployment
origin requires a reviewed source change. The provenance verifier gives `gh` a
private read-only copy of the captured manifest bytes and removes it afterward.

The Mac coordinator verified credential metadata on September 12: vault
`Country Manor Lab`, item `Convex - Coolify` (`i4pg5qajepkxhgwqpe4oic75oq`),
field ID `password` labeled `adminKey`, stored deployment URL matching the
approved origin. `.env.schema` now references that item/field instead of the
nonexistent `convex-self-hosted-admin-key` item. This metadata correction neither
retrieves credentials nor changes the inherited-only operator-script contract.

After the separately approved backend deployment has installed this query:

```sh
vpx tsx scripts/frequency-queue-evidence.ts https://convex.resonantprojects.art
```

The optional second argument is page size, an integer from 1 to 200 (default
100). The script reads **one fixed Convex query timestamp** across all pages.
Only a completed scan prints evidence. It fails without partial totals on an
expired/unsupported snapshot, authentication failure, required page split,
repeated cursor, 1,000-page limit, or 20-second deadline. Each backend page is
bounded to 200 returned rows, 201 scanned rows and a 4 MiB read budget. A required
split can be retried as a fresh entire scan with a smaller page size. Never join
partial scans or silently fall back to different timestamps. Large queues that
cannot finish within these bounds remain an acceptance gate.

On failure the collector exits 1 and emits bounded JSON to stderr with
`complete:false`, a fixed `code`, `stage`, `pageNumber`, and, when observed,
`httpStatus` and an allowlisted `envelope` classification. It never emits partial
counts, cursor/timestamp contents, backend error messages, function logs, or job
data. Each timestamp/page HTTP response is capped at 64 KiB before SDK decoding.

`convex_error` means the backend returned an error envelope, including when HTTP
status was 200; it does **not** diagnose an absent query. `invalid_page_shape`,
`invalid_counts`, `invalid_page_total`, and `invalid_cursor` identify client
contract rejection. `split_required`, `page_limit`, and `deadline_exceeded`
identify bounded-scan gates. `invalid_timestamp`, `invalid_envelope`,
`invalid_json`, `value_decode_failure`, `http_failure`, `transport_failure`, and
`response_too_large` distinguish transport/protocol failures. A `pause_changed`
result rejects a changing environment observation. Share this fixed diagnostic
record with the source owner; do not attach the raw backend response.

Counts cover all six statuses at one database snapshot, including old runs.
They are not worker/process counts or proof that external effects have stopped.
The pause boolean must agree across pages, but deployment environment values
are not part of the database snapshot. Keep backend deployments and pause-value
changes frozen during collection. The timestamps printed are the collection
window, not a claimed exact wall-clock conversion of Convex's internal timestamp.

### Verify the deployed code artifact

The existing privileged Convex 1.34.1 CLI interface `POST /api/get_config_hashes`
returns actual deployed root module hashes. The verification script reads this
interface without deploying or executing any job. The full config response is
discarded; only validated module identities are compared in memory.

The `Convex source artifact provenance` workflow
(`.github/workflows/convex-provenance.yml`) produces an attested
`convex-root-modules-<source-sha>` artifact containing `convex-root-modules.json`.
Publication is manual, from `main`; it needs no backend credentials. Its offline
builder uses the pinned installed Convex 1.34.1 bundle pipeline, inert explicit
credentials, and a network-denying preload. It hashes the exact generated module
source plus source map using Convex's own comparison algorithm. **Do not run a
plain `convex deploy --dry-run` to reproduce this:** that command alone contacts
the backend. Use only the guarded preparation script:

```sh
vpx tsx scripts/convex-provenance-build.ts /tmp/convex-root-modules.json
```

A locally generated manifest is useful for offline validation but is not release
provenance. For acceptance, download the artifact from the successful reviewed
`main` workflow run, note its source SHA and run URL, and use a modern `gh` with
`attestation verify` support:

```sh
gh run download RELEASE_RUN_ID --repo Resonant-Projects/frequency-music \
  --name convex-root-modules-REVIEWED_SOURCE_SHA --dir /tmp/frequency-convex-release
vpx tsx scripts/convex-provenance-verify.ts \
  /tmp/frequency-convex-release/convex-root-modules.json \
  REVIEWED_SOURCE_SHA https://convex.resonantprojects.art
```

Replace the run ID and SHA with the actual release coordinates, not a guessed
deployed revision. The verifier requires GitHub's cryptographic attestation for
the manifest bytes, this repository, the exact provenance workflow, the expected
source SHA, `refs/heads/main`, and a GitHub-hosted runner. It then requires an
exact match of the complete deployed root module set, including environments and
hashes. A client-supplied SHA alone can never produce successful evidence.
Record the sanitized result and release run URL. Verify artifact equality before
and after the queue scan while deployment changes are frozen; independent reads
cannot rule out an intervening deploy-and-revert.

This identifies **root function modules only**. It does not verify component
deployments, schema/index readiness, dependency installation, environment values,
the worker image, or the current process state. Different bundler/dependency
versions or source-map bytes can produce a mismatch; mismatches block acceptance
and must not be waived by writing a version string into the backend.

### Deployment prerequisites and merge side effects

The tracked GitHub workflows do not deploy Convex on a source merge. The tracked
Vercel contract (`docs/reference/vercel-web-deploy.md`, `web/package.json`)
builds the web SPA in `web/`; it does not run Convex deployment. This preparation
adds no automatic backend deploy. The provenance workflow's release operation
only publishes a hash artifact and attestation; it does not activate a worker.
Untracked deployment-setting overrides are not established by repository code.

The Mac/backend coordinator must separately approve the exact backend deployment
target and full function/schema/component/cron delta from the currently deployed
artifact to the reviewed release. Preserve a rollback artifact and do not remove
claim-pause support while it is relied upon. Deploy through the existing approved
backend procedure, then verify the attested root-module artifact and collect the
complete queue snapshot. Unsupported admin hash/snapshot APIs, missing release
attestation, differing deployed bytes, or unavailable existing admin access are
explicit gates. Publishing or merging this preparation satisfies none of those
live deployment gates by itself.

The failed September 12 Mac checks and the complete candidate inventory are
tracked in [backend deployment preparation](frequency-backend-deployment-preparation.md).
The current deployment remains unidentified. The Mac coordinator confirmed the
original 129 identities were not retained. Follow the preparation document's
one new bounded identity capture, then reuse that sanitized file for offline
comparison without further live reads:

```sh
vpx tsx scripts/convex-module-delta.ts \
  /tmp/frequency-convex-release/convex-root-modules.json \
  /tmp/frequency-deployed-module-identities.json
```

The second file must contain only `{ "moduleHashes": [{ "path": "...",
"environment": "isolate", "hash": "<64 lowercase hex characters>" }] }` using
actual recorded identities. The script emits all added/removed/changed root
module identities and hashes with both input-file digests. It accepts no
credentials and makes no network calls. This is a comparison aid, not an
attestation, complete deployment delta, or rollback artifact; the strict
provenance matcher continues to reject mismatches.

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
