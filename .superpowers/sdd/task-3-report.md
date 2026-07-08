# Task 3 Report — Weekly self-improvement report section (plan 05 Task 5)

## What I implemented

### Architecture note (read this first)

The plan text says "extend the weekly brief context (agent path)." Unlike the deterministic path (`convex/weeklyBriefs.ts`, `loadBriefContext`), the agent path (`agent/src/agents/weekly-brief/`) has no pre-assembled "context object" — it's a `deepagents` tool-calling supervisor (`index.ts`) that reads Convex by invoking LangChain tools itself, guided by `prompts.ts`, and its final output is validated by `schema.ts`. So "extending the context" here means: add a new read-only tool, tell the supervisor prompt to call it and how to synthesize the section, and add an optional field to the output schema that can be safely omitted/zeroed. This is not a redesign of the agent — same shape as every other data source it already uses.

### Requirement 1 — Data plumbing

Added one new narrow, read-only, secret-gated tool end-to-end, following the exact existing 4-file pattern (colocated backing query, action wrapper, HTTP handler, route registration, LangChain tool):

- **`convex/agentTools.ts`**:
  - Pure function `summarizeSelfImprovementWindow(input)` — takes plain arrays (`editCaptures`, `decidedDrafts`, `runEvents`) plus `windowStart`/`windowEnd`, and does all window-filtering/aggregation in DB-free code: counts edit captures in window, splits decided `agentReviewDrafts` into approved/rejected with rejection notes (trimmed, blank ones dropped, capped at 10), and counts+collects `memory_recall` `agentRunEvents` messages in window (capped at 10). Exported and unit-tested directly (no Convex harness needed).
  - `selfImprovementStats` — a colocated `query` (`args: { daysBack? }`, explicit `returns` validator). Fetches a bounded recent slice from each table (`editCaptures` and `agentRunEvents` via plain `.order("desc").take(500)` — no new index needed; `agentReviewDrafts` via the *existing* `by_status_updatedAt` index, once for `"approved"` once for `"rejected"`) and hands the raw rows to the pure function. `daysBack` defaults to 7, clamped to [1, 90].
  - `getSelfImprovementStats` — the secret-gated `action` wrapper, same shape as every other tool action (`requireAgentToolSecret` then `ctx.runQuery`).
  - Referenced via `makeFunctionReference<"query">("agentTools:selfImprovementStats")`, matching the file's existing string-reference convention exactly (not `internal.agentTools.x`), which also means it works without a fresh `bunx convex codegen`.
- **`convex/agentToolsHttp.ts`**: added `getSelfImprovementStats` to `agentToolRefs` and `getSelfImprovementStatsHttp` via the existing `makeAgentToolHttpHandler` factory.
- **`convex/http.ts`**: registered `POST /agent-tools/getSelfImprovementStats`. This file isn't literally named in the brief's "may modify" list, but the list's own parenthetical on `agentToolsHttp.ts` says "(or wherever the surface routes)" — and without the `http.route()` registration the new HTTP endpoint is unreachable, so the tool wouldn't actually work end to end. Treated this as in-scope wiring, not a scope violation (no other file outside the listed set was touched).
- **`docs/agent-tool-surface.md`**: added a table row for `getSelfImprovementStats` documenting the endpoint, its Convex backing function, the `daysBack` param, the degrade-to-zero behavior, and an explicit note (matching the brief's instruction) that prompt/policy promotions are NOT included because there is no queryable store for them yet — they live in `docs/eval-baselines.md` + the decision log via `scripts/langsmith/promote.ts` — and that a field should be wired here once one exists, rather than building a parallel store.
- **No schema.ts (Convex) or validators.ts changes** — no new table, no new index, no existing return-shape mirroring needed (the new query has its own self-contained inline return validator).

### Requirement 2 — Section synthesis

- **`agent/src/tools/convexTools.ts`**: added the `get_self_improvement_stats` LangChain tool (`callConvex("getSelfImprovementStats", { daysBack })`) and added it to the exported `convexTools` array, so it's automatically available to the supervisor (and, incidentally, the subagents, which already share the full tool list — no subagent changes needed since only the supervisor produces the final structured output).
- **`agent/src/agents/weekly-brief/prompts.ts`**: extended `supervisorPrompt` with explicit instructions: call the tool once; copy `editCapturesCount`/`draftsApproved`/`draftsRejected` verbatim (never invent/round); synthesize `rejectionThemes` from the tool's raw `rejectionNotes` (this is explicitly framed as the model's job, not more plumbing); only report `memoryRecallNotes` when a recall actually changed a decision; leave `promptPromotions` empty always (no store exists); and when everything is zero/empty, either omit the whole section or write a short "nothing new this week" summary — never pad with speculation.
- **`agent/src/agents/weekly-brief/schema.ts`**: added `whatTheSystemLearned` as an **optional** object (consistent with how every other data-availability edge case in this schema is handled — e.g. `contradictionsOrWeakPaths`/`todo`/etc. default to `[]` rather than requiring a sentinel value): `summaryMd` (required, non-empty when the object is present), `editCapturesCount`/`draftsApproved`/`draftsRejected` (non-negative ints), and `rejectionThemes`/`memoryRecallNotes`/`promptPromotions` (arrays, default `[]`).

### Requirement 3 — Graceful degradation

- Schema: the whole `whatTheSystemLearned` object is optional; every sub-array defaults to `[]`; counts are typed non-negative integers so a bad number is a schema-validation failure, not a silently-passed lie.
- Convex: `summarizeSelfImprovementWindow` on empty inputs returns `{ editCaptures: { count: 0 }, drafts: { approved: 0, rejected: 0, rejectionNotes: [] }, memoryRecalls: { count: 0, notes: [] } }` — no throw, no undefined access (covered by a dedicated test, see below).
- Prompt: explicit "omit or write one 'nothing new' line, never speculate" instruction (Requirement 2 above) is the actual anti-fabrication mechanism, since the model — not a query — writes `summaryMd` and the theme summaries.

## What I tested (and results)

Both sides: pure-function/schema tests written and run before final integration polish, TDD-adjacent (implementation and its tests were built together in tight loops, verified failing/passing at each step rather than as one big batch at the end — see below for the explicit RED/GREEN check I ran retroactively to confirm test sensitivity).

### Convex side — `convex/agentTools.test.ts` (new file, 6 tests)

Covers `summarizeSelfImprovementWindow`:
1. All-empty window → all-zero/empty result (the graceful-degradation case required by gate 4).
2. Edit captures: in-window counted, out-of-window (`windowStart - 1`, `windowEnd + 1`) excluded, boundary values (`windowStart`, `windowEnd` exactly) included.
3. Draft decisions: approved/rejected split correctly, rejection notes collected and trimmed, out-of-window and `pending_review` rows ignored (data-present case for gate 4).
4. Blank/whitespace-only decision notes on rejected drafts are dropped from `rejectionNotes` (rejected count still increments).
5. `memory_recall` filtering: only that `kind` counted, other kinds (e.g. `decision`) ignored, out-of-window recalls excluded.
6. Cap at 10: 15 rejection notes / 15 recall notes in, only 10 surface in each `notes` array while the raw counts still report all 15.

```
$ bun test convex/agentTools.test.ts
 6 pass
 0 fail
 13 expect() calls
```

Sensitivity check (RED before the implementation existed): temporarily reverted `convex/agentTools.ts` to its pre-task state while keeping the new test file — `bun test convex/agentTools.test.ts` fails immediately with `error: export named 'summarizeSelfImprovementWindow' not found in module`, confirming the test actually exercises the new code and isn't vacuous. Restored the implementation → GREEN as above.

### Agent side — two new files

**`agent/tests/self-improvement-stats.test.ts`** (5 tests) — DI-mocked via `globalThis.fetch` stubbing (no network, no live Convex needed), covering:
- Tool is registered by name (`get_self_improvement_stats`) in the exported `convexTools` list the supervisor/subagents receive.
- Posts to the correct path (`{CONVEX_SITE_URL}/agent-tools/getSelfImprovementStats`) with `secret` and `daysBack` in the body.
- Returns the tool's raw empty-window response unchanged (data-absent case).
- Returns the tool's raw populated-window response unchanged (data-present case).
- `daysBack` omitted from the request body when not passed (confirms the optional-arg plumbing, since `JSON.stringify` drops `undefined`-valued keys).

**`agent/tests/weekly-brief-self-improvement-schema.test.ts`** (5 tests) — pure `zod` parsing, no mocks:
- `whatTheSystemLearned` fully omitted → parses fine, field is `undefined` (the "omit" degradation path).
- All-zero "nothing new this week" object → parses, defaults (`rejectionThemes`/`memoryRecallNotes`/`promptPromotions` → `[]`) apply correctly (the "zero-line" degradation path).
- Fully populated object → parses, all fields round-trip.
- Negative count → schema rejects (anti-fabrication guard: a bad number is a hard validation failure).
- Blank `summaryMd` → schema rejects.

```
$ cd agent && bun test tests/self-improvement-stats.test.ts tests/weekly-brief-self-improvement-schema.test.ts
 10 pass
 0 fail
 14 expect() calls
```

### Full gate runs

```
$ bun test convex scripts
 138 pass
 0 fail
 319 expect() calls
Ran 138 tests across 21 files.
```
(Baseline before this task, per the shared progress ledger, was 116; Task 1/2 already on top of that; this task added 6 more via `convex/agentTools.test.ts`, landing at 138 — consistent.)

```
$ cd agent && bunx tsc --noEmit
(no output — clean)

$ cd agent && bun test
 75 pass
 0 fail
 170 expect() calls
Ran 75 tests across 13 files.
```
(This task added 10 tests across the two new agent test files, consistent with the running total.)

Lint (informational, not a listed gate, but matched prior tasks' discipline):
```
$ bunx oxlint convex/agentTools.ts convex/agentTools.test.ts convex/agentToolsHttp.ts convex/http.ts --tsconfig tsconfig.json
Found 0 warnings and 0 errors.

$ cd agent && bunx oxlint src/tools/convexTools.ts src/agents/weekly-brief/schema.ts src/agents/weekly-brief/prompts.ts tests/self-improvement-stats.test.ts tests/weekly-brief-self-improvement-schema.test.ts --tsconfig tsconfig.json
Found 0 warnings and 0 errors.
```
(Fixed one `require-await` warning in `self-improvement-stats.test.ts` by dropping an unnecessary `async` on the mock-fetch closure before this final run.)

### Gate 1 — `bunx convex codegen` — COULD NOT VERIFY (infrastructure outage, documented as environmental, not blocking)

```
$ timeout 90 bunx convex codegen
Finding component definitions...
Generating server code...
Bundling component definitions...
Bundling component schemas and implementations...
Downloading current deployment state...
EXIT:124   (timed out)
```
Consistent with the known issue flagged in the task and already logged in `progress.md` for Task 2 (self-hosted backend behind Cloudflare, 524/unreachable). Not something a code change fixes.

**Best-effort static substitute**: ran a root-scoped `bunx tsc --noEmit -p tsconfig.json` (not the real gate — codegen uses its own bundler config — but the closest static check available without the live backend) and grepped for my touched files specifically:
```
$ bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "convex/agentTools\.ts|convex/agentToolsHttp\.ts|convex/agentTools\.test\.ts"
(no output)
```
Zero errors in the files this task touched. The full unfiltered run does show ~50 pre-existing errors scattered across ~15 *other* convex files (`ingest.ts`, `graph.ts`, `recipes.ts`, `campaigns.test.ts`, `aggregates.ts`, etc.) — confirmed unrelated to this task by name/line and untouched by this diff. `convex/http.ts` itself has one pre-existing unrelated error at line 75 (a `Response`-vs-`Promise<Response>` mismatch in the pre-existing `json()` helper, nowhere near my added route block).

This gate should be re-run once `https://convex.resonantprojects.art` (or whatever the current self-hosted URL is) is reachable, before relying on this in production — it's the only gate that both typechecks against the live schema *and* pushes.

## Files changed

- `convex/agentTools.ts` — added `summarizeSelfImprovementWindow` (pure), `selfImprovementStats` (query), `getSelfImprovementStats` (action), `selfImprovementStatsRef`
- `convex/agentTools.test.ts` — new file, 6 tests
- `convex/agentToolsHttp.ts` — added `getSelfImprovementStats` ref + HTTP handler
- `convex/http.ts` — registered `/agent-tools/getSelfImprovementStats` route
- `docs/agent-tool-surface.md` — documented the new tool row
- `agent/src/tools/convexTools.ts` — added `get_self_improvement_stats` LangChain tool, added to `convexTools` export
- `agent/src/agents/weekly-brief/prompts.ts` — extended `supervisorPrompt` with synthesis + anti-fabrication instructions
- `agent/src/agents/weekly-brief/schema.ts` — added optional `whatTheSystemLearned` field
- `agent/tests/self-improvement-stats.test.ts` — new file, 5 tests
- `agent/tests/weekly-brief-self-improvement-schema.test.ts` — new file, 5 tests

## Self-review findings

- **Completeness**: all four data points from the plan text handled — edit-captures count (plumbed), approve/reject ratio with rejection-note-derived themes (plumbed + delegated to the model for synthesis, per the brief's own instruction that theme summarization is "what the LLM is for"), memory recalls that changed decisions (plumbed, empty today by design since the memory store is gated on Proxmox soak), prompt promotions (explicitly and permanently omitted per the brief — no store built, code comment + doc note left for the future gate). Empty-window path is covered end-to-end: pure function (Convex), schema parse (agent), and prompt instruction (model behavior, not testable in isolation but explicit).
- **Quality**: matches the existing 4-file tool-surface pattern exactly (colocated query → action → HTTP handler → route → LangChain tool). Window-filtering/aggregation logic lives entirely in one pure, exported, DB-free function per the brief's explicit instruction. No new Convex indexes or schema changes were needed — reused the existing `by_status_updatedAt` index on `agentReviewDrafts` and bounded unindexed scans (capped at 500 rows) for the two smaller tables, which is a reasonable tradeoff at this project's current data volume and documented inline as such.
- **Discipline**: read-only only (no write capability added). No promotions store built (explicitly declined per the brief, with a forward-pointing comment in both `agentTools.ts` and the doc). No changes to `convex/weeklyBriefs.ts` (the deterministic path) or `convex/schema.ts`. The one file touched outside the brief's literal list (`convex/http.ts`) was necessary wiring for the surface to function at all and is covered by the list's own "(or wherever the surface routes)" qualifier — flagged here explicitly rather than silently going out of bounds.
- **Testing**: all new tests exercise real exported logic (pure aggregation function, real zod schema, real LangChain `tool()` object with a mocked network boundary) — not mocks-all-the-way-down. Confirmed test sensitivity on the Convex side with an explicit RED (revert implementation, keep test, watch it fail on the missing export) → GREEN (restore, watch it pass) cycle. Pristine lint on every touched file.

## Issues / concerns

- **Gate 1 (`bunx convex codegen`) unverified due to backend outage** — the one real open item, purely environmental (matches the exact failure mode already logged for Task 2 in `progress.md`). Recommend re-running once the self-hosted backend is reachable again. Static substitute (scoped `tsc --noEmit`) shows zero errors in every file this task touched.
- **`convex/http.ts` touched despite not being in the brief's literal file list** — judgment call, explained above; the surface's own HTTP routing table needed the new path registered for the tool to be reachable at all, and the brief's phrasing on `agentToolsHttp.ts` ("or wherever the surface routes") reads as anticipating this. Flagging for Keith's review rather than assuming it's fine.
- No live agent run was performed (explicitly out of scope per the brief — "SKIP live runs; verify via unit tests + typecheck. It will be listed as manual follow-up"). The plan's own verification line ("section renders from real data in one brief cycle") remains a manual follow-up once the backend is back and a real weekly-brief run can be triggered.
