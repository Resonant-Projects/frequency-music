# Passage index acceptance — 2026-10-17

Activation and acceptance sequence for [plan 15](../../plans/2026-08-01-15-passage-index.md),
whose implementation merged in PR #153 (merge `6f33238`, on `main` at `57f7c90`).
G-deploy and Stages 1 to 5 ran on 2026-10-17 and 18 UTC and are recorded
below. Indexing is enabled and the index converged. The first full apply
failed two sources on write throughput, and Keith accepted a resumed run (see
[Recorded exception](#recorded-exception-2026-10-18)). Keith extended that
exception to the two logged skips. The Stage 6 probes, the two uncaptured log
intervals (23:45–23:51 and 01:02–01:09) and G-keep remain.

## Local preflight (no production contact)

| Check | Result at this branch (base `57f7c90`) |
| --- | --- |
| `vp test convex/passages.test.ts convex/shared/passages.test.ts scripts/lib/passage-backfill.test.ts convex/agentToolRegistry.test.ts convex/shared/agentToolManifest.test.ts` | 5 files, 58 tests pass. The Convex harness uses a mocked embedder, so it proves no network path. |
| `vpx tsx scripts/backfill-passages.ts --aply` | Rejected with `Unknown argument: --aply`, exit 2, before any Convex client exists. |
| 1Password vault visibility (`op vault list`, names only) | This host's service account lists `Country Manor Lab`, the vault that holds `AUTH_BYPASS_SECRET` and `CONVEX_SELF_HOSTED_ADMIN_KEY`. No item was resolved, so item access is unverified. On 2026-10-13 the rollout host could not see this vault. |

## Target and credentials

Every command below except Stage 0 contacts the one self-hosted Convex
deployment, `https://convex.resonantprojects.art` (`CONVEX_URL`, aliased as
`CONVEX_SELF_HOSTED_URL` in `.env.schema`).

- `vpx tsx scripts/backfill-passages.ts` and `scripts/probe-passages.ts` load
  `.env.local` through Varlock and send `AUTH_BYPASS_SECRET` as
  `devBypassSecret`. `passages:backfillBatch` refuses any identity but the
  bypass.
- `vpx convex run` needs `CONVEX_SELF_HOSTED_URL` and
  `CONVEX_SELF_HOSTED_ADMIN_KEY` in the CLI's environment, from the operator's
  credential broker or `vpx varlock run -- vpx convex run …`. Never put the
  key in argv, shell history, a file or output.
- Paste only the report lines named below into the evidence slots. Never paste
  environment values.

## Gates

| Gate | Owner | Blocks |
| --- | --- | --- |
| **G-deploy.** Lane A's coordinated backend deploy includes PR #153 (`57f7c90` or later), and the parent confirms no other production operation is running. | Parent coordinator | Stage 1 onward |
| **G-budget.** Keith approves a dollar cap at or above the Stage 1 `ceiling:` line. | Keith | Stage 2 onward |
| **G-keep.** Keith decides whether indexing stays enabled after acceptance. | Keith | Stage 6 |

## What the deploy brings, and what it leaves off

The deploy mounts the `rag` component (with its nested workpool), the
`passages:*` functions, the write hooks in `sources.ts` and
`transcriptCapture.ts`, the `/agent-tools/searchSourcePassages` route and the
`passage-index-sweep` cron (Sunday 15:30 UTC). With the `passageIndexing`
settings row absent, every paid path returns before embedding: write hooks
schedule `indexSource`, which returns `disabled`; the sweep returns at once;
`backfillBatch --apply` throws `INDEXING_DISABLED`. Clearing or deleting text
still removes passages. Search answers `{passages: []}` without a paid query
embedding until the namespace exists.

The supported deploy (`scripts/convex-deploy.ts`) runs with
`--codegen disable`. `convex/_generated/api.js` resolves functions and
components at runtime, so the hand-added `passages` and `components.rag` types
in `api.d.ts` do not change the bundle. Type drift from a later, separately
authorized codegen is a follow-up commit, not an acceptance gate.

## Sequence

### Stage 0. Local preflight

Rerun the preflight table above in the release checkout. Pass: every test
passes.

### Stage 1. Read-only checks (after G-deploy)

None of these writes data or calls OpenAI.

1. Gate state. Pass: prints `false`.

   ```sh
   vpx convex run passages:indexingEnabled
   ```

2. `OPENAI_API_KEY` is set in the deployment environment. This prints the
   name only; the value goes no further than the pipe. Pass: `present`.

   ```sh
   vpx convex env list | cut -d= -f1 | grep -qx OPENAI_API_KEY && echo present || echo absent
   ```

   A pre-deploy read at 03:26 UTC on 2026-10-17 found it present and
   non-empty, printing booleans only
   ([record](../wave2-rollout-20261017/openai-key-presence.json)). Repeat the
   check here, after G-deploy.

3. Dry run. Effect: one `backfillBatch` action per ten sources reads each
   source and looks up its entry by content hash. Pass: exit 0, `indexing=disabled`,
   `scope=full`, `indexed=0 failed=0`.

   ```sh
   vpx tsx scripts/backfill-passages.ts
   ```

   Record the `sources:`, `estimate:` and `ceiling:` lines. The estimate
   assumes about four characters per token; the ceiling assumes three tokens
   per character and holds for any script. Both use OpenAI's list price for
   `text-embedding-3-large` ($0.13 per million tokens), which the operator
   confirms before G-budget. They do not include re-embedding after a failed
   source, which a rerun pays again.

### Stage 2. Enable (after G-budget)

Pick a window that finishes the full apply before the next Sunday 15:00 UTC.
The sweep at 15:30 UTC would otherwise index the same pending sources and
could embed one twice while a backfill page holds it.

```sh
vpx convex run passages:setIndexingEnabled '{"enabled": true}'
vpx convex run passages:indexingEnabled
```

Pass: the second command prints `true`. Effect: writes the `passageIndexing`
settings row. From here on, every new or changed source text is embedded, and
the weekly sweep indexes any source without a ready entry.

### Stage 3. Canary

If the Stage 1 dry run reported `pending=0` with `textBearing` above zero,
the index is already current, which is only possible after an earlier
activation: the gate is off by default and nothing indexes while it is off.
Follow the zero-pending path in the acceptance criteria instead of Stages 2–4.

```sh
vpx tsx scripts/backfill-passages.ts --apply --canary
vpx tsx scripts/backfill-passages.ts
```

`--canary` walks pages that hold no pending work, which embed nothing, and
stops after the first page that does, so it embeds at most one page of up to
ten sources. Pass: the apply exits 0 with `failed=0` and `indexed` equal to its
`pending`, which must be at least 1; its scope reads `scope=partial … (canary
stopped at the first page with pending work)`, or `scope=full` when that page
was the last. The dry run's `pending` has then dropped by that `indexed` count
(allow for sources written in between). A failure here usually means a missing or invalid
`OPENAI_API_KEY` or a component fault: roll back (below) and read the Convex
logs for `Passage indexing skipped for <sourceId>`.

### Stage 4. Full apply

```sh
vpx tsx scripts/backfill-passages.ts --apply
```

Pass: exit 0, `scope=full`, `failed=0`. A rerun resumes, because sources whose
current text has a ready entry are skipped. If a `backfillBatch` action times
out (the script reports `scope=partial … (stopped by an error)`), rerun with
`--batch-size 3` or lower. If `failed` is above zero, do not loop: read the
logs for the failed source ids and stop.

### Stage 5. Convergence

```sh
vpx tsx scripts/backfill-passages.ts
```

Pass: exit 0, `scope=full`, `pending=0`, `converged=yes`, `failed=0`, and
`textBearing` is within the sources created or deleted since Stage 1. Pending
sources written during Stage 4 justify one more Stage 4 rerun. A source still
pending after that is a failure to investigate, not to rerun.

### Stage 6. Probe

Each probe makes one paid query embedding. The operator picks a phrase the
corpus is known to discuss in both article prose and a transcript, for example
a cymatics phrase.

```sh
vpx tsx scripts/probe-passages.ts "<cross-domain phrase>"
vpx tsx scripts/probe-passages.ts "<cross-domain phrase>" --type youtube
vpx tsx scripts/probe-passages.ts "<cross-domain phrase>" --type url
```

Pass, mechanically: each run exits 0; the header shows `passages=` between 1
and 8 and `chars=` at most 12000; no row has status `archived`. Pass, by eye:
the typed runs return only sources of that type (by title and host); the
untyped run returns both article prose and a transcript passage; and the
passages are relevant to the phrase. That judgment is the operator's or Keith's, recorded in the slot
below. Substitute `--type podcast`, `rss` or `pdf` if the corpus holds the
phrase there instead.

Then G-keep: leave indexing enabled (new and changed text is embedded as it
lands, and the sweep heals missed writes), or disable it with R1.

## Zero-failure acceptance

Acceptance holds only when all of these are recorded:

1. Stage 1 printed `false` and `present`, and the dry run exited 0 with
   `indexed=0 failed=0`.
2. The approved cap is at or above the Stage 1 ceiling.
3. Every apply exited 0 with `failed=0`, and the canary indexed at least one
   source. **Zero-pending path:** when Stage 1 reported `pending=0` and
   Stages 2–4 were skipped, this criterion is met instead by citing the earlier
   activation's recorded canary and apply evidence. Without that record, the
   index's provenance is unknown: stop and report instead of accepting.
4. The Stage 5 dry run reported `scope=full`, `pending=0` and `converged=yes`.
5. Every Stage 6 probe met the mechanical bounds and the by-eye check passed.
6. The Convex logs for the window hold no `Passage indexing skipped for` or
   `Passage removal failed for` line.

Any other outcome is a failed acceptance: roll back with R1 and report it.

### Recorded exception, 2026-10-18

The first full apply (Stage 4) exited 1 with `failed=2`. Both sources were
skipped because the deployment hit its write limit of 4 MiB per second, not
because of a key, embedding or component fault. As written, that is a failed
acceptance and calls for R1. Keith instead chose, in chat on 2026-10-18, to
rerun the apply with `--batch-size 3` and stated: "I accept a resumed run for
criterion 3 since the failure was write throughput." R1 was not applied, and
indexing remains enabled.

This exception amends criterion 3 for this run only: a resumed apply that ends
with `failed=0` meets it when every earlier failure was a write-throughput
skip and the rerun indexed each failed source.

Later on 2026-10-18 Keith extended the exception to criterion 6: "the two
skip lines are the same write-throughput failures the rerun healed." Criterion
6 is met for this run when every `Passage indexing skipped for` line in the
window names a source that the rerun then indexed. The extension does not
cover the two intervals that no log stream captured: 23:45 to 23:51 (the
canary, before the first stream) and 01:02 to 01:09 (between the two streams).
The Stage 5 convergence (`pending=0`) shows that no indexing skip in those
intervals was left unhealed, but it cannot detect a `Passage removal failed for`
line, because cleared or deleted text is not counted as text-bearing. Those
intervals stay open until a log record covering them is recovered or Keith
waives them.

Status of each criterion for this run:

| # | Status |
| --- | --- |
| 1 | Met (Stage 1) |
| 2 | Met: $18 cap, $17.61 ceiling |
| 3 | Met under the exception above: the canary had `failed=0`, the first full apply `failed=2` (exit 1), and the rerun `failed=0` (exit 0) |
| 4 | Met (Stage 5) |
| 5 | Open: the Stage 6 probes have not run |
| 6 | **Open.** The captured windows (23:51–01:02 and 01:09–01:28) are met under the extended exception: their only two `Passage indexing skipped for` lines name the Stage 4 failures, which the rerun indexed, and they hold 0 `Passage removal failed for` lines. 23:45–23:51 and 01:02–01:09 were not captured and need recovered logs or Keith's waiver |

Acceptance is therefore not yet complete. It needs the Stage 6 probes
(criterion 5), recovered logs or Keith's waiver for the two uncaptured
intervals (criterion 6), and G-keep.

## Rollback

- **R1. Stop paid indexing.** Pass: the second command prints `false`.

  ```sh
  vpx convex run passages:setIndexingEnabled '{"enabled": false}'
  vpx convex run passages:indexingEnabled
  ```

  Write hooks, the sweep and backfill applies stop embedding; a running
  `--apply` stops at its next page with `INDEXING_DISABLED`. An `indexSource`
  already past its gate check finishes that one source. Clearing or deleting
  source text still removes its passages.
- **What stays.** Indexed passages remain searchable through
  `searchSourcePassages` and the probe. No generator prompt reads them: the
  tool is registered with `langchain: false`, so no model-visible toolset
  includes it. No purge tool exists; removing indexed data would be a
  separately reviewed change.
- **Code rollback** belongs to the deployment lane
  ([frequency-supported-deployment-rollback.md](../../frequency-supported-deployment-rollback.md)).

## Evidence slots

Fill each row with the UTC time, the operator, and the named report lines.

| Stage | UTC time | Operator | Report lines | Pass |
| --- | --- | --- | --- | --- |
| G-deploy | 18:37:14 | Claude Opus 5.5 on `devbox` | `6fb562b2` deployed with `rag`, `rag/workpool`, `rag/workpool/batchWorker` active; provenance verify `rootModuleArtifactMatches: true` at 18:37:36; window closed 19:49:31 ([window record](../wave2-rollout-20261017/candidate-6fb562b2/window.md)). No other production operation was running at Stage 1. | yes |
| 1.1 Gate state | 22:26:19 | Claude Opus 5.5 on `MacBook-Max` | `false` | yes |
| 1.2 `OPENAI_API_KEY` | 22:26:28 | Claude Opus 5.5 on `MacBook-Max` | `present` | yes |
| 1.3 Dry run | 22:29:17–22:30:11 | Claude Opus 5.5 on `MacBook-Max` | exit 0; `indexing=disabled`; `scope=full batches=785`; `sources: scanned=7842 textBearing=7688 pending=7688 indexed=0 failed=0`; `estimate: chars=45151717 tokens≈11287930 cost≈$1.4674`; `ceiling: tokens≤135455151 cost≤$17.6092`; `converged=no`. A first run at 22:26:38 printed the same lines; its exit code was not captured. | yes |
| G-budget | before 23:45 | Keith | $18, approved in chat; at or above the $17.61 ceiling | yes |
| 2 Enable | 23:45:19–23:45:31 | Claude Opus 5.5 on `MacBook-Max` | `setIndexingEnabled` returned; `indexingEnabled` printed `true` | yes |
| 3 Canary | 23:45:41–23:48:44 | Claude Opus 5.5 on `MacBook-Max` | Apply exit 0: `scope=partial batches=1 (canary stopped at the first page with pending work)`, `sources: scanned=10 textBearing=10 pending=10 indexed=10 failed=0`. Dry run exit 0: `sources: scanned=7842 textBearing=7688 pending=7678` (down 10) | yes |
| 4 Full apply | 23:48:52–01:00:39 | Claude Opus 5.5 on `MacBook-Max` | exit 1 (`backfillExitCode` returns 1 for an apply with `failed` above 0); `scope=full batches=785`; `sources: scanned=7842 textBearing=7688 pending=7678 indexed=7676 failed=2`. Both failures logged `Passage indexing skipped for <id>: Too many writes per second … limited to 4 MiB bytes written per 1 second`: `jx78enw8wn6xsnwx5sb7pjsm3s8db3h3`, `jx7ben1c3c2ne75zq87ezk2bw98fesf8`. Rerun 01:09:39–01:26:02 with `--batch-size 3`: exit 0, `scope=full batches=2615`, `sources: scanned=7842 textBearing=7688 pending=2 indexed=2 failed=0`. Keith accepted the resumed run for criterion 3 because the failure was write throughput; see [Recorded exception](#recorded-exception-2026-10-18) | First apply failed; criterion 3 met only under Keith's exception |
| 5 Convergence | 01:26:23–01:28:39 | Claude Opus 5.5 on `MacBook-Max` | exit 0; `scope=full batches=785`; `sources: scanned=7842 textBearing=7688 pending=0 indexed=0 failed=0`; `converged=yes`. `textBearing` unchanged since Stage 1 | yes |
| 6 Probes | | | Header line and table per run; by-eye verdict | |
| Logs | 23:51–01:02 | Claude Opus 5.5 on `MacBook-Max` | Streamed `convex logs --jsonl` (about 59,000 events): 2 `Passage indexing skipped for` lines (the two above), 0 `Passage removal failed for`. The stream started after the canary, so 23:45–23:51 is not covered. A second stream over the rerun and Stage 5 (01:09–01:28, about 26,000 events) held 0 of either line. | Captured windows met under Keith's extended exception; 23:45–23:51 and 01:02–01:09 not captured, so criterion 6 is open |
| G-keep | | Keith | Enabled or disabled | |
