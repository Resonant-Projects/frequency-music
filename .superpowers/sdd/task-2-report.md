# Task 2 Report — Edit-capture hooks for extractions and weekly briefs

## What I implemented

### Requirement A — `convex/extractions.ts`

Extractions had no edit mutation at all. Added:

- **Pure helpers** (unit-testable, no DB harness):
  - `selectExtractionContent(row)` — picks the human-editable fields off an extraction row: `summary`, `claims`, `compositionParameters`, `topics`, `openQuestions`, `confidence`. (`sourceId`/`model`/`promptVersion`/`inputHash`/`createdBy`/`createdAt` are excluded — provenance/bookkeeping, not editable content. There's no `status` field on extractions; that lives on `sources`.)
  - `mergeExtractionContent(existing, updates)` — applies partial updates over the existing content (nullish-coalescing, so `confidence: 0` is preserved, not treated as absent).
  - `extractionContentChanged(generated, edited)` — deep-equality via `JSON.stringify` comparison.
  - `computeExtractionEditCapture(extraction, updates)` — the should-capture decision: builds `generated`/`edited` and returns `null` when nothing actually changed, otherwise the capture payload including `promptVersion`/`model` sourced from the extraction row.
- **`editExtraction` mutation** — mirrors `hypotheses.update`'s shape: `requireAuth(ctx, args)`, load-or-404 via `ConvexError({code:"NOT_FOUND",...})`, call `computeExtractionEditCapture` and `recordEditCapture` when it returns non-null, then `ctx.db.patch("extractions", id, updates)` (two-arg convention, matching this file). Returns `v.null()`.
- Local `claimValidator` const duplicating the schema-internal claim shape — `convex/schema.ts`'s `claimValidator` isn't exported (same reason `convex/validators.ts` keeps its own local copy), so `editExtraction`'s `claims` arg needed a structurally-identical copy. `compositionParameterValidator` *is* exported from `schema.ts`, so that one is imported directly, not duplicated.

**Resolution: extractions have no `origin` field.** Unlike hypotheses, every extraction row comes from the AI pipeline — `convex/extractInternal.ts:storeExtraction` is the only inserter, and it's an `internalMutation` only reachable from `convex/extract.ts`. There is no human-authored extraction path, so unlike `hypotheses.update`'s `origin === "agent"` gate, `editExtraction` captures unconditionally on any actual content change.

### Requirement B — `convex/weeklyBriefs.ts`

Inspected `publish` (only flips `visibility`/`publishedAt`, never touches content) and `create` (an `internalMutation` only called from `generateBriefCore`, i.e. the AI generation action — never human-invoked). Confirmed there is no existing content-edit path, so per the brief I created **`editBrief`** rather than contorting `publish`.

- **Pure helpers**, same shape as Requirement A: `selectBriefContent`, `mergeBriefContent`, `briefContentChanged`, `computeBriefEditCapture`.
- **Editable content scope**: `bodyMd`, `todo`, `studioPrompts` — the brief's authored output. Excluded the structural/recommendation-link fields (`sourceIds`, `recommendedHypothesisIds`, `recommendedRecipeIds`, `activeThesisIds`, `referencedFailureKeys`, `campaignId`, `weekOf`, `model`, `promptVersion`) — those are AI-selected bookkeeping/links, not human-authored text a person would "edit," and touching them isn't what "edit-capture hooks... for weekly briefs" is asking for. This keeps the mutation narrowly scoped per the brief's no-overbuilding instruction.
- **`editBrief` mutation** — same shape as `editExtraction`/`hypotheses.update`: `requireAuth`, load-or-404, `computeBriefEditCapture` + `recordEditCapture` when content changed, `ctx.db.patch("weeklyBriefs", id, updates)` (two-arg convention, matching this file). Returns `v.null()`.

**Resolution: weekly briefs also have no `origin` field**, same reasoning as extractions — `create` is only ever called from the AI generation pipeline, so there's no human-authored row to exclude. Capture fires unconditionally on actual content change.

### Deliberate deviation from `hypotheses.ts`'s literal `hasContentEdit` pattern

`hypotheses.update`'s `hasContentEdit` only checks whether a field is *present* in the args (`!== undefined`), not whether the value actually differs from what's stored — so re-submitting the same value would still fire a capture there. The brief's verification gate #3 explicitly requires a test proving "no capture when content unchanged," which that presence-only check cannot satisfy. Both new mutations instead do real value diffing (`JSON.stringify` comparison of the full generated/edited content objects) before calling `recordEditCapture`. This also cleanly subsumes the "no updates provided at all" case (generated === edited trivially) without a separate presence check. Auth handling, patch mechanics, and the two-arg `ctx.db` convention still mirror `hypotheses.ts` exactly.

### Not touched

`convex/editCaptures.ts` needed no changes — `recordEditCapture`'s existing signature already covers both new call sites. `scripts/langsmith/export-edit-captures.ts` already has `extraction` and `weeklyBrief` entries in its `ENTITY_FILE` map, so no script changes were needed either. No schema changes. No UI changes.

## What I tested

TDD wasn't literally red-then-green against a stub (the implementation and tests were written in the same pass, structured around the pure helpers), but I verified failure/success mechanically:

**RED** (stashing implementation changes, keeping the new test file in place):
```
$ git stash && bun test convex scripts
SyntaxError: Export named 'extractionContentChanged' not found in module '.../convex/extractions.ts'.
116 pass / 1 fail / 1 error / 266 expect() calls — Ran 117 tests across 20 files.
```
This also confirms the stated baseline of 116 pre-existing passing tests on this branch.

**GREEN** (restored):
```
$ git stash pop && bun test convex scripts
132 pass
0 fail
306 expect() calls
Ran 132 tests across 20 files.
```

New coverage: `convex/extractions.test.ts` (9 tests) + additions to `convex/weeklyBriefs.test.ts` (7 new tests, 10 total in that describe block including the 3 pre-existing). 116 + 16 = 132, matches.

Both new test suites individually:
```
$ bun test convex/extractions.test.ts   → 9 pass, 0 fail, 22 expect() calls
$ bun test convex/weeklyBriefs.test.ts  → 10 pass, 0 fail, 27 expect() calls
```

Each pure-helper suite covers the three brief-mandated scenarios:
- **Capture fires on AI-origin edit with content change** — `computeExtractionEditCapture`/`computeBriefEditCapture` return a non-null payload with correct `generated`/`edited`/`promptVersion`/`model` when a field's value actually differs.
- **No capture when content unchanged** — returns `null` both when no fields are provided at all, and when a field is explicitly provided but matches the stored value.
- **No capture on non-AI rows** — does not apply to either entity: extractions and weekly briefs have no `origin` field and no human-authored insert path (confirmed by grepping for `insert("extractions"` / `insert("weeklyBriefs"` — the only inserters are `extractInternal.storeExtraction` and `weeklyBriefs.create`, both `internalMutation`s reachable only from the AI pipeline). Documented this explicitly as a comment in both test files rather than silently omitting the scenario.
- Also added an extra case per entity (claims-array edit / todo-only edit) proving the diff isn't accidentally scoped to just one field.

Lint: `bunx oxlint convex/extractions.ts convex/extractions.test.ts convex/weeklyBriefs.ts convex/weeklyBriefs.test.ts --tsconfig tsconfig.json` → 0 warnings, 0 errors (fixed one `consistent-function-scoping` warning by hoisting a test helper to module scope).

Root `bunx tsc --noEmit` (informational only, per the brief explicitly *not* the gate): diffed against a `git stash` of my changes and confirmed the pre-existing `weeklyBriefs.ts` TS7006 implicit-any errors (lines shifted by my insertions, same count: 8) already existed before my edits — no new errors introduced.

### Gate 1 — `bunx convex codegen` — COULD NOT VERIFY (infrastructure outage, not a code issue)

Ran `bunx convex codegen` twice; both attempts failed identically:
```
✖ Error: Unable to pull deployment config from https://convex.resonantprojects.art
✖ Error fetching POST  https://convex.resonantprojects.art/api/get_config_hashes 524 <none>
```
Diagnosed before giving up:
- DNS resolves (`convex.resonantprojects.art` → Cloudflare IPs 104.21.77.38 / 172.67.204.6).
- ICMP ping succeeds (~10ms, host is up at the network layer, behind Cloudflare).
- Every HTTPS request to it times out or gets a Cloudflare 524 (origin unresponsive) — tried `/version` and `/api/get_config_hashes` directly with curl, 30s timeout, multiple times over several minutes.
- General internet egress from this sandbox is fine: `https://github.com` and `https://registry.npmjs.org` both returned HTTP 200 immediately.
- Ran a 4-attempt poll (15s apart, ~75s total) against `/version` — all 4 attempts returned `000` (connection failure/timeout).

Conclusion: the self-hosted Convex backend's origin (behind Cloudflare) is not responding right now — a real backend/infra availability issue outside this task's control, not something a code change can fix. I did not skip this gate by choice; it was unreachable for the full session. This needs to be re-run once the backend (managed by Cool Guy, per CLAUDE.md) is back up.

## Files changed

- `convex/extractions.ts` — added `editExtraction` mutation + 4 pure helpers + local `claimValidator`
- `convex/weeklyBriefs.ts` — added `editBrief` mutation + 4 pure helpers
- `convex/extractions.test.ts` — new file, 9 tests
- `convex/weeklyBriefs.test.ts` — added 7 tests to existing file

## Self-review findings

- **Completeness**: both entity types hooked (extraction, weeklyBrief). Edge cases covered: unchanged content (no fields passed; field passed but identical value), and the "no non-AI rows" case is explicitly documented rather than silently absent for both entities.
- **Quality**: mirrors `hypotheses.ts` structure (auth, 404 handling, two-arg `ctx.db`, `v.null()` return) with a deliberate, documented improvement (real diffing vs. presence-only check) justified by the brief's own test requirement.
- **Discipline**: no schema changes, no UI changes, no changes to `editCaptures.ts` or the export script (neither needed extending). Weekly-brief editable scope kept to authored content (bodyMd/todo/studioPrompts), not the AI-selected structural links — avoided overbuilding a full brief-editing surface the brief didn't ask for.
- **Testing**: all new tests exercise the exported pure functions directly (no mocked DB), matching `editCaptures.test.ts` style. Fixed one lint warning (hoisted a test-helper closure) before committing; confirmed pristine `oxlint` output on all four touched files.
- One thing I did **not** independently re-verify: whether a human reviewer would want `sourceId` reassignment on extractions or `campaignId`/link changes on briefs also gated behind capture. I read those as structural corrections, not "edited content," and left them out of both mutations' args entirely (not merely uncaptured) to keep the mutations scoped to what the brief describes as content.

## Issues / concerns

- **Gate 1 unverified due to backend outage** (see above) — this is the one concern serious enough to flag. Everything else (gates 2 and 3, lint, targeted diff review against pre-existing TS errors) passed clean. Recommend re-running `bunx convex codegen` once `https://convex.resonantprojects.art` is reachable again before merging/relying on this in production, since it both typechecks against the live schema *and* pushes.
