# Plan 002: Remove the unauthenticated public write surface on the concept graph, and make the agent-tool HTTP secret check constant-time

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a30f10c..HEAD -- convex/graph.ts convex/workflows.ts convex/agentDrafts.ts convex/agentToolsHttp.ts convex/auth.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: MED (touches internal call paths used by workflows and draft promotion)
- **Depends on**: none (see Maintenance notes for interaction with `docs/plans/2026-07-03-05`)
- **Category**: security
- **Planned at**: commit `a30f10c`, 2026-07-07

## Why this matters

`convex/graph.ts` is the only write module in the backend with no auth of any
kind: `upsertConcept`, `incrementMentions`, `createEdge`, `deleteEdge` are
public `mutation`s, and `linkExtractionConcepts`, `linkHypothesisConcepts`,
`buildGraphFromExtractions` are public `action`s. Anyone who can reach the
Convex deployment URL can create, rename, corrupt, or delete knowledge-graph
concepts and edges, and trigger compute-bearing graph builds — no secret, no
Clerk session. Every sibling write module (`sources.ts`, `recipes.ts`,
`hypotheses.ts`, `compositions.ts`, …) gates on `requireAuth`. The good news:
these seven functions have **zero external callers** — all callers are internal
— so the fix is to convert them to `internalMutation`/`internalAction`, which
removes them from the public API entirely. A second, smaller hardening rides
along: the agent-tool HTTP boundary compares its shared secret with plain `!==`
while every other secret check in the repo is constant-time.

## Current state

- `convex/graph.ts` imports from `./_generated/server`; it has **no**
  `requireAuth` import (verified: `grep -c requireAuth convex/graph.ts` → 0).
- The seven write functions and their locations at `a30f10c`:
  - `graph.ts:97` `export const upsertConcept = mutation({ ... })`
  - `graph.ts:163` `export const incrementMentions = mutation({ ... })`
  - `graph.ts:412` `export const createEdge = mutation({ ... })`
  - `graph.ts:472` `export const deleteEdge = mutation({ ... })`
  - `graph.ts:489` `export const linkExtractionConcepts = action({ ... })`
  - `graph.ts:535` `export const linkHypothesisConcepts = action({ ... })`
  - `graph.ts:589` `export const buildGraphFromExtractions = action({ ... })`
- **Complete caller map** (verified by repo-wide grep over `convex/`, `web/src/`,
  `agent/src/`, `scripts/` at `a30f10c` — re-verify in Step 1):
  - Inside `graph.ts` itself, the actions call the mutations via the PUBLIC api
    object: `ctx.runMutation(api.graph.upsertConcept, ...)` at `:506` and
    `:553`; `ctx.runMutation(api.graph.createEdge, ...)` at `:511`, `:558`,
    `:572`; `ctx.runMutation(api.graph.incrementMentions, ...)` at `:521`; and
    `buildGraphFromExtractions` calls
    `ctx.runAction(api.graph.linkExtractionConcepts, ...)` at `:612`.
  - `convex/workflows.ts:67,109` → `ctx.runAction(api.graph.linkExtractionConcepts, ...)`
  - `convex/workflows.ts:144,185` → `ctx.runAction(api.graph.linkHypothesisConcepts, ...)`
  - `convex/agentDrafts.ts:358` →
    `await ctx.scheduler.runAfter(0, api.graph.linkHypothesisConcepts, { hypothesisId })`
    (comment above it: "Concept linking is an action; schedule it").
  - **No caller anywhere in `web/src/`, `agent/src/`, or `scripts/`.**
  - `deleteEdge` has no callers at all (operator runs it via
    `bunx convex run graph:deleteEdge` when needed; the CLI can run internal
    functions on a self-hosted deployment with the admin key, so converting it
    to internal preserves that workflow).
- Convex convention in this repo: internal functions are imported from
  `./_generated/server` as `internalMutation` / `internalAction` and referenced
  via `internal.module.fn` from `./_generated/api` (exemplar:
  `convex/graph.ts:119` already does
  `ctx.runMutation(internal.vocabulary.ensureConceptDomain, ...)`).
- The constant-time helper already exists but is module-private:
  `convex/auth.ts:26` `function constantTimeEqual(a: string, b: string): boolean`.
  `convex/http.ts:43` has its own private copy. The weak spot is
  `convex/agentToolsHttp.ts:64-66`:
  ```ts
  const secret = typeof body.secret === "string" ? body.secret : undefined;
  if (!secret || secret !== process.env.AGENT_TOOL_SECRET) {
    return json({ error: "Forbidden" }, 403);
  }
  ```
- Vocabulary (`CONTEXT.md`): the "Agent-Tool Surface" is the secret-guarded HTTP
  interface; graph writes are NOT part of it and must not become part of it.
- **Standing constraint**: `bunx convex codegen` / `dev` / `deploy` talk to the
  LIVE self-hosted backend — do not run them. This plan only edits existing
  modules (no new convex file), so `_generated/api.d.ts` does not need
  regeneration; types flow from the source modules.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `bun test convex/*.test.ts` | 59+ pass, 0 fail |
| Lint (check-only) | `bunx oxlint convex/ --tsconfig tsconfig.json` | exit 0 |
| Typecheck convex | `bunx tsc --noEmit -p tsconfig.json` | exit 0 |
| Caller re-verification | `grep -rn "api\.graph\." convex web/src agent/src scripts --include='*.ts' --include='*.tsx'` | see Step 1 |

## Scope

**In scope** (the only files you should modify):
- `convex/graph.ts`
- `convex/workflows.ts` (re-point 4 call sites)
- `convex/agentDrafts.ts` (re-point 1 scheduler call site)
- `convex/agentToolsHttp.ts` (constant-time comparison)
- `convex/auth.ts` (export the existing helper — one-word change)
- `convex/graphAuth.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- Read-only queries in `graph.ts` (`getConcept`, `searchConcepts`,
  `getConceptEdges`, `exportForVisualization`, …) — public read queries are the
  repo-wide pattern; leave them public.
- `convex/http.ts` — its `isAuthorized` is already constant-time; deduplicating
  the two helpers is deferred (see Maintenance notes).
- `convex/agentTools.ts` — its `requireAgentToolSecret` path is already correct.
- Adding graph writes to the agent-tool surface — explicitly not wanted
  (CONTEXT.md: human decisions and internal writes are never part of it).

## Git workflow

- Branch: `advisor/002-graph-write-auth`
- Conventional commits, e.g. `fix(security): internalize concept-graph write surface`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Re-verify the caller map

Run `grep -rn "api\.graph\." convex web/src agent/src scripts --include='*.ts' --include='*.tsx' | grep -v "_generated"`.
Expected: hits ONLY in `convex/graph.ts`, `convex/workflows.ts`,
`convex/agentDrafts.ts`, and only for the seven functions listed above. Any
OTHER hit (a new caller added since `a30f10c`) → STOP condition 1.

**Verify**: output matches the caller map in Current state.

### Step 2: Convert the four mutations to `internalMutation`

In `convex/graph.ts`: add `internalMutation` and `internalAction` to the import
from `./_generated/server`, then change the declarations at `:97`, `:163`,
`:412`, `:472` from `mutation({` to `internalMutation({`. Do not change args,
returns, or handler bodies.

**Verify**: `grep -n "= mutation(" convex/graph.ts` → no output.

### Step 3: Convert the three actions to `internalAction`

Change the declarations at `:489`, `:535`, `:589` from `action({` to
`internalAction({`. Do not change handler bodies yet.

**Verify**: `grep -n "= action(" convex/graph.ts` → no output.

### Step 4: Re-point every caller from `api.graph.*` to `internal.graph.*`

- In `convex/graph.ts`: the self-calls at `:506`, `:511`, `:521`, `:553`,
  `:558`, `:572`, `:612` become `internal.graph.upsertConcept`, etc.
  (`internal` is already imported at the top of the file — check; if not, add
  it to the existing `./_generated/api` import).
- In `convex/workflows.ts`: `:67`, `:109`, `:144`, `:185` — `api.graph.link…`
  → `internal.graph.link…` (add `internal` to the `_generated/api` import if
  absent).
- In `convex/agentDrafts.ts:358`:
  `ctx.scheduler.runAfter(0, api.graph.linkHypothesisConcepts, …)` →
  `ctx.scheduler.runAfter(0, internal.graph.linkHypothesisConcepts, …)`.

**Verify**: `grep -rn "api\.graph\.\(upsertConcept\|incrementMentions\|createEdge\|deleteEdge\|linkExtractionConcepts\|linkHypothesisConcepts\|buildGraphFromExtractions\)" convex/` → no output.
**Verify**: `bunx tsc --noEmit -p tsconfig.json` → exit 0.

### Step 5: Make the agent-tool HTTP secret check constant-time

1. In `convex/auth.ts:26`: `function constantTimeEqual` →
   `export function constantTimeEqual` (no other change).
2. In `convex/agentToolsHttp.ts`: import it
   (`import { constantTimeEqual } from "./auth";`) and replace the comparison at
   `:64-66` with:
   ```ts
   const expected = process.env.AGENT_TOOL_SECRET;
   if (!secret || !expected || !constantTimeEqual(secret, expected)) {
     return json({ error: "Forbidden" }, 403);
   }
   ```
   Semantics preserved: unset env → fail closed; wrong secret → 403.

**Verify**: `grep -n "!== process.env.AGENT_TOOL_SECRET" convex/agentToolsHttp.ts` → no output.
**Verify**: `bunx tsc --noEmit -p tsconfig.json` → exit 0.

### Step 6: Full check

**Verify**: `bun test convex/*.test.ts` → all pass (59 existing + new from Test plan).
**Verify**: `bunx oxlint convex/ --tsconfig tsconfig.json` → exit 0.
**Verify**: `git status --short` → only in-scope files modified.

## Test plan

Create `convex/graphAuth.test.ts` (pure static test — the repo has no ctx-seam
harness yet; that is `docs/plans/2026-07-03-04`'s job). Model the file header on
`convex/sourceUtils.test.ts` (bun:test, `describe`/`test`/`expect`). Cases:

1. Read `convex/graph.ts` with `await Bun.file(...).text()` and assert it does
   not contain `= mutation(` or `= action(` — i.e., the module exports no
   public write functions. (Characterization guard so a future edit can't
   silently re-publicize the surface.)
2. Same technique on `convex/agentToolsHttp.ts`: assert it contains
   `constantTimeEqual` and does not contain `!== process.env.AGENT_TOOL_SECRET`.
3. Direct unit test of `constantTimeEqual` (import from `./auth`): equal
   strings → true; same-length different strings → false; different-length →
   false; empty vs empty → true.

**Verification**: `bun test convex/graphAuth.test.ts` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "= mutation(\|= action(" convex/graph.ts` → 0
- [ ] `grep -rn "api\.graph\." convex/ | grep -v "_generated" | grep -vE "api\.graph\.(getConcept|searchConcepts|listByDomain|getTopConcepts|getEdgesFrom|getEdgesTo|getRelatedSources|getConceptsFor|searchSourcesByConcept|getConceptsForDomain|getConceptEdges|getConceptDetail|exportForVisualization)"` → no output
- [ ] `bunx tsc --noEmit -p tsconfig.json` → exit 0
- [ ] `bun test convex/*.test.ts` → 0 fail, including the 3+ new tests
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

1. Step 1 finds a caller of any of the seven write functions outside
   `convex/graph.ts` / `convex/workflows.ts` / `convex/agentDrafts.ts` — e.g. a
   web mutation hook added after `a30f10c`. Internalizing would break it; the
   fix then needs an auth-gated public wrapper instead, which changes this
   plan's shape.
2. `docs/plans/2026-07-03-05-arch-agent-tool-registry.md` has already been
   executed and `agentToolsHttp.ts` no longer matches the excerpt (its
   handler may have been rebuilt around a registry) — re-locate the secret
   comparison in the new structure; if you cannot find a single comparison
   point, stop.
3. `web/src` gains a "graph editing" UI during your work (someone concurrently
   building on the public mutations).
4. A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Anyone adding a human-facing graph-editing UI later must add PUBLIC wrapper
  mutations that call `requireAuth` (exemplar: `convex/sources.ts:140-149` —
  `devBypassSecret: v.optional(v.string())` arg + `await requireAuth(ctx, args)`)
  and then `ctx.db`-write directly or call the internal functions. Do not flip
  the internal functions back to public.
- Reviewer should scrutinize Step 4's call-site re-pointing: a missed site
  fails at RUNTIME (Convex resolves function references dynamically), not at
  typecheck — hence the grep done-criterion; run it yourself in review.
- Interaction with the arch wave: `docs/plans/2026-07-03-05` (agent-tool
  registry) touches `agentToolsHttp.ts`. If it runs after this plan, its
  "before" excerpts won't match at the secret check — the constant-time
  comparison is the end-state to preserve.
- Deferred: deduplicating the two `constantTimeEqual` copies (`auth.ts`,
  `http.ts:43`) into one shared module — trivial, but `http.ts` is heavily
  touched by the registry plan; let that land first.
- Deferred: rate-limiting on the agent-tool HTTP surface (defense in depth on
  top of the shared secret).
