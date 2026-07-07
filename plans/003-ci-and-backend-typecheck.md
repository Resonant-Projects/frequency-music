# Plan 003: Stand up CI on the existing verification commands and make the backend typecheckable (burn down 107 errors)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e07be2e..HEAD -- tsconfig.json package.json convex/ scripts/ .github/workflows/`
> If files changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it
> as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests / dx
- **Planned at**: commit `e07be2e`, 2026-06-12

## Why this matters

Nothing gates merges in this repo: the only GitHub workflows are a Claude PR assistant, a Claude review bot, and a manual editorial export — none runs tests, typecheck, lint, or build, even though all four exist as scripts and are green (verified at `e07be2e`: `bun run test` 39/39 in ~230ms, `typecheck:web` clean, `build:web` exit 0). Worse, TypeScript currently enforces nothing on the backend: there is no typecheck script for `convex/` or `scripts/`, and running `tsc` there reveals **107 real errors** (68 in `convex/`, 39 in `scripts/`) — including at least one silent runtime bug (`recipes.ts:481` passes `maxTokens`, which the installed AI SDK v6 ignores; the option was renamed `maxOutputTokens`, so recipe generation runs with **no output-token cap**). Agents execute most changes in this repo; this plan is the cheapest large safety net available.

## Current state

- `package.json:5-13` scripts (root):

  ```json
  "scripts": {
    "format": "biome format --write .",
    "lint": "oxlint . --fix --tsconfig tsconfig.json",
    "test": "bun test convex/*.test.ts",
    "build:web": "cd web && bun run build",
    "typecheck:web": "cd web && bunx tsc --noEmit",
    ...
  }
  ```

  Note `lint` includes `--fix` — CI must use `bunx oxlint .` (no `--fix`) so CI never mutates the tree.

- `tsconfig.json` (root) has compiler options only — **no `include`/`exclude`**, so `bunx tsc --noEmit` at root wrongly sweeps in `web/` (2,155 spurious errors — `web/` has its own passing tsconfig) and `agent/` (own tsconfig with a `verify` script). Strict flags already on: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`.

- Real error counts at `e07be2e` (`bunx tsc --noEmit 2>&1 | grep -oE '^(convex|scripts|web|agent)/' | sort | uniq -c`):

  ```
     6 agent/      (excluded from this plan — agent/ has its own tsconfig + verify script)
    68 convex/
    39 scripts/
  2155 web/        (artifact of the missing exclude — web's own typecheck passes)
  ```

  Top error classes for the 107: `TS2345` (33, bad argument types), `TS18048`/`TS2532` (22, possibly-undefined from `noUncheckedIndexedAccess`), `TS2322` (10, bad assignments), `TS7022`/`TS7023` (13, implicit-any self-references). Regenerate the exact list with:
  `bunx tsc --noEmit 2>&1 | grep -E '^(convex|scripts)/'`

- Known specific errors you will hit (verified by reading the code):
  - `convex/recipes.ts:481` — `generateText({ ..., maxTokens: 3000 })`. **Fix by renaming to `maxOutputTokens: 3000`** — this is the one fix in this plan that changes runtime behavior (restores the intended 3000-token cap). Sibling call sites already use the correct name: `convex/extract.ts:219`, `convex/hypotheses.ts:429`, `convex/weeklyBriefs.ts:434`.
  - `convex/aggregates.ts:20,81,108` — wrong type-argument counts / option shapes against the installed `@convex-dev/aggregate@0.2.x` API. Fix types only; do not change which aggregates exist.
  - `convex/testHelpers.ts` — `Tables` is `Record<TableName, any[]>` (all keys required), but tests pass partial table sets (`convex/campaigns.test.ts:19,140,160` fail with "missing properties ... sources, extractions, weeklyBriefs, editorialArtifacts"). Fix: make it `type Tables = Partial<Record<TableName, any[]>>` — `makeDb` already handles absent tables (`tables[table] ?? []` at `testHelpers.ts:56-61`).
  - `convex/http.ts:72` — handler typed to return `Promise<Response>` but returns `Response`; align the annotation.
  - `convex/admin.ts:230,235` — implicit-any self-reference (`pollFeedsNow`); add explicit type annotations.
  - `convex/ingest.ts:54,64,65,68` + similar — possibly-undefined regex/array accesses; guard with explicit checks, do **not** use non-null assertions (`!`) — prefer `if (!x) continue/throw` matching the surrounding style.

- CI exemplar already in-repo — `.github/workflows/public-editorial-export.yml:17-25`:

  ```yaml
  - name: Setup Bun
    uses: oven-sh/setup-bun@v2
    with:
      bun-version: latest
  - name: Install dependencies
    run: bun install --frozen-lockfile
  ```

- `web/` has its own lockfile (`web/bun.lock`) — CI must run `bun install --frozen-lockfile` in BOTH root and `web/`.
- All four gates verified green locally at `e07be2e`: test (39 pass), typecheck:web (exit 0), build:web (exit 0), `bunx oxlint .` (assumed green since `lint --fix` is run routinely — verify in Step 1).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `bun run test` | 39 pass, 0 fail |
| Backend typecheck (new) | `bun run typecheck` | exit 0 after burn-down |
| Web typecheck | `bun run typecheck:web` | exit 0 |
| Web build | `bun run build:web` | exit 0 |
| Lint (CI form) | `bunx oxlint . --tsconfig tsconfig.json` | exit 0 |
| Error inventory | `bunx tsc --noEmit 2>&1 \| grep -E '^(convex\|scripts)/'` | shrinking list → empty |

## Scope

**In scope** (the only files you should modify):
- `tsconfig.json` (add `exclude`)
- `package.json` (add `typecheck` script)
- `.github/workflows/ci.yml` (create)
- `convex/*.ts` and `scripts/*.ts` — **type-level fixes only**, plus the one sanctioned behavioral fix (`recipes.ts:481` rename)

**Out of scope** (do NOT touch, even though they look related):
- `web/**` — its typecheck already passes; the 2,155 root-sweep errors disappear via the `exclude`, not via edits.
- `agent/**` — has its own tsconfig and `verify` script; wiring it into CI is deferred (see Maintenance notes).
- `biome.json`, `.oxlintrc.json` — no config changes; CI consumes them as-is.
- Any refactor beyond what a type error strictly requires. In particular do NOT "fix" `convex/weeklyBriefs.ts`'s `ctx: any` (plan 004 owns that file's repair) and do NOT touch `convex/graph.ts` function registration (plan 002 owns it).
- The e2e suite (`web/tests/`) — cannot run in CI yet (needs live backend + Clerk creds); separate finding TESTS-04.

## Git workflow

- Branch: `advisor/003-ci-and-backend-typecheck`
- Conventional commits; suggested sequence: `chore: scope root tsconfig to backend`, `fix: correct maxTokens option name in recipe generation`, `fix: resolve backend type errors (convex)`, `fix: resolve script type errors`, `ci: add test/typecheck/build/lint workflow`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline check of the four existing gates

Run `bun run test`, `bun run typecheck:web`, `bun run build:web`, `bunx oxlint . --tsconfig tsconfig.json`. All must pass BEFORE you change anything (they did at `e07be2e`).

**Verify**: all four exit 0. If oxlint fails, STOP — report the pre-existing lint errors rather than fixing them silently.

### Step 2: Scope the root tsconfig

Add to `tsconfig.json` (top level, alongside `compilerOptions`):

```json
"exclude": ["node_modules", "web", "agent", "exports", "data"]
```

**Verify**: `bunx tsc --noEmit 2>&1 | grep -cE '^web/'` → 0, and `bunx tsc --noEmit 2>&1 | grep -cE '^(convex|scripts)/'` → ~107.

### Step 3: Add the typecheck script

In root `package.json` scripts: `"typecheck": "bunx tsc --noEmit"`.

**Verify**: `bun run typecheck` runs and currently fails listing only `convex/` + `scripts/` errors.

### Step 4: Fix `recipes.ts:481` (the sanctioned behavioral fix)

`maxTokens: 3000` → `maxOutputTokens: 3000`.

**Verify**: `grep -n 'maxOutputTokens: 3000' convex/recipes.ts` → 1 match; `grep -rn 'maxTokens' convex/` → no matches.

### Step 5: Burn down the `convex/` errors (68)

Work file by file using the inventory command. Apply the specific fixes listed in "Current state" first (testHelpers `Tables`, aggregates generics, http.ts annotation, admin.ts annotations, ingest guards), then the remainder. Rules:

- Type-level fixes only: annotations, guards, narrowing, correcting wrong generic arguments.
- No `as any`, no `@ts-ignore`, no non-null `!` unless the value is provably present within 5 lines; prefer explicit guards.
- If a fix would change runtime behavior (other than Step 4), record it and STOP at the end of the step to report the list before proceeding.
- After each file: `bun run test` must stay green (39 pass).

**Verify**: `bunx tsc --noEmit 2>&1 | grep -cE '^convex/'` → 0, and `bun run test` → 39 pass.

### Step 6: Burn down the `scripts/` errors (39)

Same rules. These are operator CLI tools — be conservative; guards should fail loudly (`console.error` + `process.exit(1)`) rather than silently continue, matching `scripts/export-editorial.ts:22-31` style.

**Verify**: `bun run typecheck` → exit 0.

### Step 7: Create `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - name: Install root dependencies
        run: bun install --frozen-lockfile
      - name: Install web dependencies
        run: cd web && bun install --frozen-lockfile
      - name: Test
        run: bun run test
      - name: Typecheck backend
        run: bun run typecheck
      - name: Typecheck web
        run: bun run typecheck:web
      - name: Lint
        run: bunx oxlint . --tsconfig tsconfig.json
      - name: Build web
        run: bun run build:web
  ```

**Verify**: `bunx action-validator .github/workflows/ci.yml` if available; otherwise YAML-parse it: `bun -e "const f=await Bun.file('.github/workflows/ci.yml').text(); console.log('ok')"` plus a manual read-through against the step list above.

### Step 8: Full local dry-run of exactly what CI will run

Run the five commands from Step 7 in order from a clean state.

**Verify**: all exit 0.

## Test plan

No new test files — this plan's product *is* the verification infrastructure. Gates:

- `bun run test` green after every burn-down file (regression guard for type-fix collateral).
- One manual behavioral spot-check for Step 4: `grep -A3 'maxOutputTokens: 3000' convex/recipes.ts` shows it inside the `generateText` options where `maxTokens` used to be.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run test` exits 0 (39 pass)
- [ ] `bun run typecheck:web`, `bun run build:web`, `bunx oxlint . --tsconfig tsconfig.json` all exit 0
- [ ] `.github/workflows/ci.yml` exists and runs the five gates above with `--frozen-lockfile` installs for root and web
- [ ] `grep -rn 'maxTokens' convex/` → no matches
- [ ] `grep -rn '@ts-ignore\|as any' convex/ scripts/ | wc -l` is not larger than before your changes (`git stash && <count> && git stash pop` to compare if needed)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 finds any of the four existing gates already red (pre-existing breakage to report, not fix).
- A type error cannot be fixed without changing runtime behavior (other than Step 4) — collect these and report the list with proposed fixes.
- The error inventory after Step 2 differs from ~107 by more than ~10 (the codebase drifted; re-vet which errors this plan still owns).
- Fixing `convex/aggregates.ts` generics appears to require changing the aggregate component's *configuration* (`convex/convex.config.ts` or `components.ts` beyond a type annotation).
- `bun run test` breaks and two fix attempts fail.

## Maintenance notes

- Once green, CI failures are signal — do not add `continue-on-error` to gates.
- Follow-ups deliberately deferred: wiring `agent/` (`cd agent && bunx tsc --noEmit`, 6 known errors) into CI; e2e in CI (needs seeded dev deployment + Clerk test tokens — finding TESTS-04); replacing the hand-rolled test fakes with `convex-test` (finding TESTS-03 — note `testHelpers.ts` fidelity limits: `withIndex` ignores index names, `order()` always sorts by `updatedAt`, `makeDb` is read-only).
- Reviewer should scrutinize: any burn-down hunk that touches a conditional or a default value (behavior risk), and the `Tables` type change (must stay `Partial`, not grow `any`).
- If plan 004 lands first, `weeklyBriefs.ts` may already typecheck differently — re-run the inventory rather than trusting the 68 count.
