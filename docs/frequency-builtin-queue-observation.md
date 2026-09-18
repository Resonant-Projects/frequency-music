# Frequency built-in queue observation

`scripts/recovery/guest-queue-counts.py` reads `agentRuns` using the backend's
built-in `_system/cli/tableData` query. It does not require deployment of
`agentRuns:opsStatusCountsPage` or any application source change.

The query and argument contract were checked against Convex backend revision
`c0cb7ae17f54e14846c243c5332a8a5e6d0e19d4`, the observed image revision label:

- `npm-packages/system-udfs/convex/_system/cli/tableData.ts` uses ViewData and
  returns standard pagination for `{table, order, paginationOpts}`.
- `npm-packages/convex/src/cli/lib/data.ts` uses that function for `convex data`.

A revision label is not source attestation. The first bounded production
observation was authorized after independent collector review and synthetic
HTTP validation. The unrelated backend restore remained blocked before boot
by its vendor-unit allowlist, and was explicitly separated from this worker-only
migration. No isolated-backend compatibility result is claimed.

## Exact read and limits

The script accepts only HTTP loopback origins, default `http://127.0.0.1:3210`.
It sends POST `/api/query` with the existing admin authentication header. The
only function is `_system/cli/tableData`, table `agentRuns`, ascending order,
100 rows per page. It neither calls mutations nor claims, retries, requeues,
stops workers, or changes configuration.

Run with `python3 scripts/recovery/guest-queue-counts.py`. The inherited
`RESTORE_ADMIN_KEY_FILE` points to a caller-owned regular file of mode 0600;
symlinks are refused. `RESTORE_BACKEND_ORIGIN` can select a different loopback
port. Do not pass a key on the command line. Use the existing scoped credential
handling and remove the temporary key afterwards, including on failure.

Raw job records are parsed only in memory and never printed or saved. The
output contains fixed status counts, page/row counts and observation times.
Unknown statuses, repeated identities/cursors, nonascending creation order,
split pages, malformed responses and limits fail without partial counts.
Responses are capped at 4 MiB each, 32 MiB total, 100 pages and 10,000 rows. A
separate main thread imposes a 45-second process deadline even when a transport
read stalls. There is no automatic retry. Errors contain fixed codes only.

## Interpretation

The result is a sequential observation across separate query snapshots.
It is not an atomic queue snapshot, proof of an idle worker, a request-drain
barrier, or permission to kill a worker. In particular, a legacy process can
still be awaiting a claim response or performing external effects after its
queue row became terminal. The output always records `atomic:false` and
`worker_idle_proven:false`.

The original Phase 3 task can migrate the worker against the unchanged backend.
The already-attested PR 57 worker image adds client-side drain behavior without
changing graph implementations or HTTP function names/arguments from the
retained old worker. The broader backend semantic/provenance update remains
separate; it is not required merely to obtain queue observations.

## Verification

```sh
python3 scripts/recovery/tests/test-guest-queue-counts.py
```

The tests cover aggregation without payload leakage, malformed/unknown/duplicate
rows, split and cyclic pagination, local-only origins, real HTTP request shape,
credential-file permissions and process-level deadline termination. Live
isolated acceptance and any subsequent production observation must retain their
own sanitized receipts. Unit tests do not establish deployed compatibility.

## September 18 bounded production observation

The reviewed collector completed one observation through CT113's existing
loopback backend route. It read 142 rows in two pages and reported queued 0,
running 0, needs_review 3, completed 138, failed 1, cancelled 0. The observation
started at Unix time 1789690471.3763103 and finished at 1789690471.4509447.
Raw records were neither retained nor shared. Temporary admin-key material was
derived through the existing local backend utility and removed on exit.

This establishes deployed built-in query compatibility and the reported
sequential counts. It does not establish the absence of an outstanding claim,
an idle process, or permission to terminate the old worker. No mutation,
application deployment, backend stop, or worker action occurred.
