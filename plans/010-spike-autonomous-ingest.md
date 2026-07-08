# Plan 010 (spike): Design autonomous ingest — in-app URL/YouTube/PDF text fetch with visible workflow status

> **Executor instructions**: This is a DESIGN SPIKE. The deliverable is a
> design document that maps roadmap Phase A onto the infrastructure that
> already exists, plus ONE thin prototype (a URL-text-fetch Convex action) to
> validate the riskiest assumption. Not a build-out. Follow the steps; on any
> STOP condition, stop and report. When done, update the status row in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a30f10c..HEAD -- convex/ingest.ts convex/workflows.ts convex/http.ts convex/schema.ts scripts/`
> Heavy drift in `scripts/` is EXPECTED if `docs/plans/2026-07-03-06`
> (ingest-script lib) has executed — that changes Step 1's inventory source but
> not the spike's purpose; note it and continue.

## Status

- **Priority**: P3
- **Effort**: M (as a spike)
- **Risk**: LOW (one additive prototype action; deployment operator-gated)
- **Depends on**: none (composes with `docs/plans/2026-07-03-06`; see STOP 1)
- **Category**: direction (design spike)
- **Planned at**: commit `a30f10c`, 2026-07-07

## Why this matters

Roadmap Phase A ("Autonomous Ingest") is the stated "recommended immediate
build order" item #1: "every supported source type can move from raw input to
`text_ready` or a clear blocked state without manual paste work… without this,
the inbox still depends on manual rescue work." Today, full text arrives via
~10 hand-run scripts (Jina Reader, Kernel.sh cloud browser, Fabric CLI
transcripts, `/tmp` file reconciliation) while the backend crons only poll RSS
metadata and batch-extract. The definition of done is concrete: "a user can
submit a URL or YouTube link without pasting content; blocked items expose
exact failure reasons and retry paths." The pieces exist — durable workflows
(`@convex-dev/workflow` already runs batch extraction), a `blockedReason`
field on sources, HTTP ingest routes, and proven fetch code in the scripts —
but nobody has designed how they compose. This spike does that design and
validates the riskiest piece: server-side text fetching from the Convex
runtime.

## Current state

- Stated goal (quote in the design doc): `docs/next-wave-roadmap.md` Phase A —
  includes "readable text fetch for URL/RSS, transcript retrieval for YouTube,
  PDF text extraction, explicit retry and failure reporting, visible workflow
  status in the app". Workstreams doc (`docs/next-wave-workstreams.md` #1, #2):
  autonomous ingest + "workflow operations surface" ("workflow IDs exist but
  operational state is mostly invisible"; success = "users can tell whether
  automation is working without checking logs").
- What exists at `a30f10c`:
  - `convex/crons.ts`: RSS poll every 6h (`ingest.pollAllFeedsInternal`),
    batch extraction every 8h via `workflows.startBatchExtractionInternal`
    (durable, per-step timeout/retries), weekly brief, stale-run sweep.
  - `convex/workflows.ts`: the durable-workflow pattern to copy (extraction
    steps + concept linking).
  - Source status flow (CLAUDE.md): `ingested → text_ready → extracted →
    triaged`, plus `review_needed`, and `blockedReason` on sources
    (`convex/inbox.ts` counts blocked rows).
  - Web `/ingest` route: manual URL/YouTube ingest + extraction trigger
    (README "App routes").
  - Fetch capabilities living in scripts (the migration source): Jina Reader
    (`scripts/fetch-full-articles.ts`), Kernel.sh cloud browser for blocked
    sources (`scripts/fetch-article-kernel.ts`, `smart-fetch.ts` — 5 concurrent
    sessions, `KERNEL_API_KEY`), Fabric CLI transcripts
    (`scripts/fetch-youtube-transcripts.ts` — shells out via `Bun.spawn`;
    **cannot run inside Convex**), `update-text-from-files.ts` (`/tmp`
    reconciliation — the workflow to eliminate).
- Key constraints to design around (state them in the doc):
  - Convex actions can `fetch` external URLs; the DEFAULT runtime has no
    subprocess/`Bun.spawn` — so Fabric-CLI transcript fetching cannot move
    into Convex as-is. Options to evaluate: youtube transcript via plain
    `fetch` (timedtext API), Kernel.sh browser, or a worker-side job (the
    agent worker already polls a queue — `agentRuns` — and CAN spawn
    processes).
  - Decided tradeoff: tracing best-effort; and per the arch wave, dedupe keys
    are owned by `sourceUtils` (any new intake path must use it — that is
    plan `2026-07-03-01`'s contract).
  - PDF: no PDF library is currently a real dependency (plan 007 removes two
    unused ones) — choosing one is a design-doc decision with a shortlist, not
    an install in this spike.
- Vocabulary (`CONTEXT.md`): "Source Intake: any path by which a source enters
  the system — RSS cron polling, HTTP ingest routes, or manifest scripts. All
  intake paths share one dedupe contract." Use "Source Intake", "Dedupe Key",
  "blocked state" in the design.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit -p tsconfig.json` | exit 0 |
| Tests | `bun test convex/*.test.ts` | all pass |
| Inventory fetch scripts | `grep -ln "jina\|kernel\|Bun.spawn\|fetch(" scripts/*.ts` | file list for Step 1 |
| Prototype smoke (operator-gated, needs deploy) | `bunx convex run ingest:fetchUrlText '{"url": "https://example.com", ...}'` | see Step 3 |

## Scope

**In scope** (the only files you should create/modify):
- `docs/autonomous-ingest-design.md` (create — primary deliverable)
- `convex/ingest.ts` (ONE additive internalAction prototype, Step 3)
- `convex/ingest.test.ts` (extend if it exists from plan 004; else create for
  the prototype's pure helpers only)

**Out of scope** (do NOT touch):
- `convex/schema.ts` — job-metadata tables are PROPOSED in the doc, not added.
- `web/**` — the status-surface UI is designed, not built.
- `convex/crons.ts`, `convex/workflows.ts`, `convex/http.ts` — composition is
  designed, not wired.
- `scripts/*` — they keep working as-is until the real build; plan
  `2026-07-03-06` owns their refactor.
- Retry/blocked-state UI actions, PDF implementation, transcript implementation.

## Git workflow

- Branch: `advisor/010-spike-autonomous-ingest`
- Conventional commits, e.g. `docs(spike): autonomous ingest design`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Capability inventory

Read the fetch scripts (grep table above) and tabulate in the design doc: per
source type (URL-plain, URL-blocked/Cloudflare, YouTube, PDF, Notion) — current
mechanism, env keys needed, runtime requirements (plain fetch vs browser vs
subprocess), observed failure modes (the scripts' catch branches and the
`blockedReason` values already in use — grep `blockedReason` across `convex/`
and `scripts/`).

**Verify**: design doc has the capability table with ≥5 source types.

### Step 2: Write the design doc

`docs/autonomous-ingest-design.md`, sections:

1. **Goal** — quote Phase A's definition of done verbatim.
2. **Capability table** (Step 1).
3. **Target architecture** — for each source type, where fetch runs:
   (a) Convex action via plain `fetch` (Jina-style URL text — the default),
   (b) Convex action calling Kernel.sh HTTP API (blocked sources),
   (c) worker-side job for anything needing subprocesses (Fabric transcripts) —
   reusing the `agentRuns` queue pattern or a parallel `fetchJobs` queue:
   compare both in 1 paragraph and recommend one.
   All intake paths MUST route dedupe through `sourceUtils` (per the
   `2026-07-03-01` contract) and set `text_ready` or a structured
   `blockedReason` — enumerate the proposed blocked-reason vocabulary.
4. **Durable orchestration** — how `@convex-dev/workflow` wraps fetch+extract
   per source (mirror `workflows.startBatchExtraction`'s shape), retry policy,
   and the stale-sweep analogue.
5. **Workflow status surface** (workstream #2) — proposed `fetchJobs`/job-metadata
   shape (queued/running/failed/completed + attempt count + last error), which
   existing route surfaces it (`/display` inbox vs `/admin`), and the retry
   action contract. Schema proposals only.
6. **Env & secrets** — names only (`KERNEL_API_KEY`, etc.), where each runtime
   reads them.
7. **Build slices** — 3–5 orderable slices (e.g. S1 URL-plain in-app; S2 status
   surface; S3 blocked-source Kernel path; S4 transcripts via worker; S5 PDF),
   each with a rough S/M effort tag, so the operator can card them.
8. **Open questions.**

**Verify**: doc exists with all eight sections; every "must" traces to a quoted
roadmap/workstream/CONTEXT line.

### Step 3: Prototype the riskiest assumption — server-side URL text fetch

Add to `convex/ingest.ts` ONE additive `internalAction`, `fetchUrlText`:
args `{ url: v.string() }`; behavior: `fetch` the URL via Jina Reader
(`https://r.jina.ai/<url>` — copy the exact request pattern, headers, and env
key usage from `scripts/fetch-full-articles.ts`), return
`{ ok: boolean, text?: string, error?: string, status?: number }`. It must NOT
write to the database (pure probe — the design doc, not this spike, decides
how text lands on sources). Keep any response-shaping logic in exported pure
helpers so they're testable without the network.

**Verify**: `bunx tsc --noEmit -p tsconfig.json` → exit 0;
`bun test convex/*.test.ts` → all pass.
**Verify (only if the operator deploys the branch)**:
`bunx convex run ingest:fetchUrlText '{"url": "https://en.wikipedia.org/wiki/Cymatics"}'`
→ `ok: true`, non-empty text. If you cannot deploy, mark this check
"pending operator deploy" in the report — do NOT run `convex dev`/`deploy`
yourself (live backend).

### Step 4: Record findings back into the doc

Whatever the prototype taught (Jina latency, size limits, action timeout
headroom, env var availability in the Convex deployment) goes into the design
doc's architecture section; unresolved items go to Open questions.

**Verify**: doc's section 3 references the prototype's results or its pending status.

## Test plan

Pure helpers from Step 3 get unit tests (URL→Jina-URL construction, response→
result shaping for ok/error/oversize cases) in `convex/ingest.test.ts`,
modeled on `convex/sourceUtils.test.ts`. Network behavior is validated only
via the operator-gated smoke command.

## Done criteria

ALL must hold:

- [ ] `docs/autonomous-ingest-design.md` exists, eight sections, capability table ≥5 source types, 3–5 build slices
- [ ] `fetchUrlText` internalAction exists, DB-write-free, with tested pure helpers
- [ ] `bunx tsc --noEmit -p tsconfig.json` → exit 0; `bun test convex/*.test.ts` → 0 fail
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated with a pointer to the build slices

## STOP conditions

Stop and report back (do not improvise) if:

1. `docs/plans/2026-07-03-06` (ingest-script lib) is mid-execution (a
   `scripts/lib/` directory exists with partial migration) — coordinate: the
   capability inventory should read `scripts/lib/` instead; if the tree is
   half-migrated, pause and ask which state to design against.
2. `convex/ingest.ts` has no `internalAction` import pattern available and the
   file structure resists an additive action (drifted heavily since `a30f10c`).
3. Jina Reader requires an API key that isn't in `.env.example`/scripts —
   report what the scripts actually use; don't sign up for services.
4. You find yourself adding a table, cron, or web change — that's the build,
   not the spike.

## Maintenance notes

- The follow-up build should be carded from the doc's build-slices section,
  one plan per slice, AFTER `2026-07-03-01` (dedupe contract) and ideally
  `2026-07-03-06` (script lib) land — both reshape the intake surface this
  design composes with.
- The `fetchUrlText` prototype is production-adjacent (it's the S1 slice's
  core); it may be promoted rather than deleted, but only once the design's
  decision on where text lands (who sets `text_ready`, who computes the dedupe
  key) is implemented around it.
- Whoever builds the status surface should reconcile it with `agentRuns`'
  existing queue/heartbeat vocabulary rather than inventing a third job model
  (`CONTEXT.md` "Agent Run") — the design doc's section 5 comparison is the
  place that argument gets settled.
