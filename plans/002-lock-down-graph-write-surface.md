# Plan 002: Convert convex/graph.ts writes to internal functions so unauthenticated callers cannot mutate the knowledge graph

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e07be2e..HEAD -- convex/graph.ts convex/workflows.ts`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `e07be2e`, 2026-06-12

## Why this matters

`convex/graph.ts` is the only mutation-bearing module in the backend with completely unguarded writes: 4 public mutations (including an unconditional `deleteEdge`) and 3 public actions, none of which import `requireAuth`. The Convex deployment URL is publicly reachable, so any anonymous caller can delete knowledge-graph edges, overwrite concepts, inflate mention counts, or trigger graph rebuilds. Every other module routes writes through `requireAuth` (`convex/auth.ts:48`) — this is an omission, not a design choice. The only legitimate callers are the pipeline's own workflows, so the cleanest fix is converting them to `internal*` functions (invisible to the public API) rather than adding secret plumbing.

## Current state

- `convex/graph.ts` — knowledge-graph module (~990 lines). Public **reads** (queries) are numerous and stay public. The unguarded **writes**:
  - `graph.ts:97` — `export const upsertConcept = mutation({...})`
  - `graph.ts:163` — `export const incrementMentions = mutation({...})`
  - `graph.ts:412` — `export const createEdge = mutation({...})`
  - `graph.ts:472` — `export const deleteEdge = mutation({...})` — handler body is `await ctx.db.delete("edges", args.id);` with no checks
  - `graph.ts:489` — `export const linkExtractionConcepts = action({...})`
  - `graph.ts:535` — `export const linkHypothesisConcepts = action({...})`
  - `graph.ts:589` — `export const buildGraphFromExtractions = action({...})`
- Intra-file call sites that must be re-pointed from `api.graph.*` to `internal.graph.*` once the targets become internal: `graph.ts:506`, `:511`, `:521` (inside `linkExtractionConcepts`), `:553`, `:558`, `:572` (inside `linkHypothesisConcepts`). The file already imports and uses `internal` (`graph.ts:119`, `:427` call `internal.vocabulary.*`), so both `api` and `internal` imports exist.
- External callers (exhaustive — verified by repo-wide grep at `e07be2e`): only `convex/workflows.ts`:
  - `workflows.ts:67` and `:109` — `await ctx.runAction(api.graph.linkExtractionConcepts, {...})`
  - `workflows.ts:144` and `:185` — `await ctx.runAction(api.graph.linkHypothesisConcepts, {...})`
- The web client references only graph **queries** (`web/src/integrations/convex/api.ts:131-134`: `getConceptsForDomain`, `getConceptEdges`, `getConceptDetail`) — no write refs, nothing to change in `web/`.
- `buildGraphFromExtractions` has no callers anywhere; it is operator-invoked via CLI. Convex's CLI can run internal functions (`bunx convex run graph:buildGraphFromExtractions`), so converting it loses nothing.
- Convention to match: internal pipeline functions elsewhere use `internalMutation`/`internalAction` imported from `./_generated/server` — see `convex/extractInternal.ts:3-5` and `convex/ingest.ts:128` (`internalAction`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `bun run test` | 39 pass, 0 fail |
| Typecheck error baseline (pre-existing repo errors) | `bunx tsc --noEmit 2>&1 \| grep -cE '^convex/(graph\|workflows)\.ts'` | record the count BEFORE changes; must not increase after |
| No public write refs remain | `grep -n 'api\.graph\.\(upsertConcept\|incrementMentions\|createEdge\|deleteEdge\|linkExtractionConcepts\|linkHypothesisConcepts\|buildGraphFromExtractions\)' convex/ -r` | no matches |

Note: the repo currently has ~107 pre-existing `tsc` errors in `convex/` + `scripts/` (being burned down in plan 003) — that is why the typecheck gate here is "error count for these two files does not increase", not "exit 0".

## Scope

**In scope** (the only files you should modify):
- `convex/graph.ts`
- `convex/workflows.ts`

**Out of scope** (do NOT touch, even though they look related):
- All graph **queries** in `graph.ts` (`getConcept`, `searchConcepts`, `getConceptDetail`, `exportForVisualization`, etc.) — they stay public reads; a separate finding (SECURITY-03 in `plans/README.md`) covers read-surface auth holistically.
- `convex/vocabulary.ts` — its functions are already `internal`.
- `web/src/**` — verified to reference only graph queries.
- `convex/agentTools.ts` / `agentToolsHttp.ts` — the external agent surface is read-only by design and does not call graph writes.

## Git workflow

- Branch: `advisor/002-lock-down-graph-write-surface`
- Conventional-commit style (e.g. `fix: make knowledge-graph writes internal-only`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Record the typecheck baseline

`bunx tsc --noEmit 2>&1 | grep -cE '^convex/(graph|workflows)\.ts'` → write down the number (expected 0 or small).

### Step 1: Convert the 4 mutations to `internalMutation`

In `convex/graph.ts`, change `mutation` → `internalMutation` for `upsertConcept` (line 97), `incrementMentions` (163), `createEdge` (412), `deleteEdge` (472). Add `internalMutation` to the existing import from `./_generated/server` (keep `mutation` only if still used elsewhere in the file — after this step it should not be; remove unused imports).

**Verify**: `grep -n 'export const \(upsertConcept\|incrementMentions\|createEdge\|deleteEdge\) = internalMutation' convex/graph.ts` → 4 matches.

### Step 2: Re-point the intra-file references

At `graph.ts:506`, `:511`, `:521`, `:553`, `:558`, `:572`, change `ctx.runMutation(api.graph.X, ...)` → `ctx.runMutation(internal.graph.X, ...)`.

**Verify**: `grep -n 'api\.graph\.\(upsertConcept\|createEdge\|incrementMentions\)' convex/graph.ts` → no matches.

### Step 3: Convert the 3 actions to `internalAction`

Change `action` → `internalAction` for `linkExtractionConcepts` (489), `linkHypothesisConcepts` (535), `buildGraphFromExtractions` (589); import `internalAction` from `./_generated/server`.

**Verify**: `grep -n 'export const \(linkExtractionConcepts\|linkHypothesisConcepts\|buildGraphFromExtractions\) = internalAction' convex/graph.ts` → 3 matches.

### Step 4: Update the workflow call sites

In `convex/workflows.ts` lines 67, 109, 144, 185: `api.graph.link*` → `internal.graph.link*`. `workflows.ts` already imports `internal` (it schedules `internal.*` functions elsewhere); confirm and add the import if missing.

**Verify**: the "No public write refs remain" command from the table → no matches anywhere in `convex/`.

### Step 5: Full verification

1. `bun run test` → 39 pass.
2. Typecheck count for the two files ≤ Step 0 baseline.
3. `grep -rn 'graph:linkExtractionConcepts\|graph:buildGraphFromExtractions\|graph:upsertConcept\|graph:createEdge\|graph:deleteEdge\|graph:incrementMentions\|graph:linkHypothesisConcepts' scripts/ web/src/ docs/ CLAUDE.md AGENTS.md` → if any *string-based* references exist (e.g. a script calling `makeFunctionReference("graph:upsertConcept")` or a documented CLI command), STOP and report them — they would break silently at runtime.

## Test plan

No new tests required — there is no test infrastructure for Convex function *registration* types (the hand-rolled fakes in `convex/testHelpers.ts` never exercise auth or function visibility; replacing them is tracked separately as finding TESTS-03). The regression gates are the grep + typecheck + existing-suite checks above. If plan 003's CI has already landed, the typecheck gate hardens this automatically.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn 'api\.graph\.\(upsertConcept\|incrementMentions\|createEdge\|deleteEdge\|linkExtractionConcepts\|linkHypothesisConcepts\|buildGraphFromExtractions\)' convex/` → no matches
- [ ] `grep -c 'internalMutation\|internalAction' convex/graph.ts` ≥ 7
- [ ] `bun run test` exits 0 (39 pass)
- [ ] `bunx tsc --noEmit 2>&1 | grep -cE '^convex/(graph|workflows)\.ts'` ≤ Step 0 baseline
- [ ] `git status` shows only `convex/graph.ts` and `convex/workflows.ts` modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 5.3 finds string-based (`graph:functionName`) references to any converted function outside `convex/` — list them; the operator must decide whether those callers get the internal-invocation path or the function needs `requireAuth` instead.
- Any converted function turns out to be referenced from `web/src/integrations/convex/api.ts` (it should not be, per "Current state").
- The typecheck error count for the two files increases and you cannot reduce it back with a type-only fix in two attempts.
- `convex/graph.ts` at the cited line numbers does not contain the named functions (drift).

## Maintenance notes

- Future graph features that need browser-triggered writes (e.g. an admin "rebuild graph" button) must add a *new* public mutation/action with `requireAuth` — do not flip these back to public.
- Reviewer should scrutinize: that no graph *query* was accidentally converted (the UI depends on them), and that `workflows.ts` still compiles its workpool definitions.
- Deferred: auth on the read surface (`sources`/`extractions`/`dashboard`/`failures` queries expose full text unauthenticated) — finding SECURITY-03, larger blast radius, needs its own plan.
