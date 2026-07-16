# Plan 003: Add check-only lint/format/typecheck scripts and a CI workflow that actually runs the test suites

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a30f10c..HEAD -- package.json .github/workflows/ agent/package.json web/package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (additive; may surface pre-existing failures on first CI run — that is signal, not breakage)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `a30f10c`, 2026-07-07

## Why this matters

The repo has three healthy verification surfaces — 59 convex unit tests
(`bun test convex/*.test.ts`, ~80ms), a green `typecheck:web`, and 10 agent
test files — but **nothing runs any of them automatically**. The only GitHub
workflows are two Claude-bot triggers and a manual editorial export; the Claude
review bot does not execute the suite. Worse, the lint and format scripts exist
only in mutating form (`oxlint --fix`, `biome format --write`), so CI couldn't
even call them safely. Regressions currently merge silently. This plan adds
check-only script variants and one CI workflow covering root, web, and agent.

## Current state

- `.github/workflows/` contains exactly: `claude-code-review.yml` (Claude
  review on PRs), `claude.yml` (Claude on issue comments), and
  `public-editorial-export.yml` (manual `workflow_dispatch`). None install
  deps or run tests.
- Root `package.json` scripts (verified at `a30f10c`):
  ```json
  "format": "biome format --write .",
  "lint": "oxlint . --fix --tsconfig tsconfig.json",
  "test": "bun test convex/*.test.ts",
  "build:web": "cd web && bun run build",
  "typecheck:web": "cd web && bunx tsc --noEmit",
  ```
  There is no check-only lint/format, and no typecheck covering `convex/` or
  `agent/`.
- `agent/package.json` scripts include `"verify": "bunx tsc --noEmit"` and
  `"test": "bun test"`. The expensive/real-run test is env-gated:
  `run:research-pipeline` sets `RUN_RESEARCH_PIPELINE_REAL=true`; plain
  `bun test` in `agent/` does not set it, so it is CI-safe.
- `web/package.json` scripts: `dev`/`build` run `panda codegen && panda cssgen`
  first; `test:e2e` is Playwright (needs a live Convex + Clerk auth state under
  `web/tests/e2e/.auth` — NOT CI-safe today). `"packageManager": "bun@1.3.11"`.
- Lockfiles: root `bun.lock`, `web/bun.lock`, `agent/bun.lock` (ignore
  `agent/package-lock.json`; plan 007 deletes it).
- `convex/_generated/` is committed, so typechecking `convex/` needs no codegen.
- **Standing constraint**: `bunx convex codegen` / `dev` / `deploy` contact the
  LIVE self-hosted backend. CI must NEVER run them. `bun test` and `tsc` are safe.
- Baseline verified at `a30f10c`: `bun test convex/*.test.ts` → 59 pass /
  0 fail; `bun run typecheck:web` → exit 0.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Root tests | `bun test convex/*.test.ts` | 59+ pass, 0 fail |
| Web typecheck | `bun run typecheck:web` | exit 0 |
| Agent typecheck | `cd agent && bun run verify` | exit 0 |
| Agent tests | `cd agent && bun test` | 0 fail |
| Lint check (new) | `bun run lint:check` | exit 0 |
| Format check (new) | `bun run format:check` | exit 0 |
| Workflow syntax | `gh workflow list` (after push) or a YAML parse | file listed / parses |

## Scope

**In scope** (the only files you should modify/create):
- `package.json` (scripts block only)
- `.github/workflows/ci.yml` (create)

**Out of scope** (do NOT touch):
- `.github/workflows/claude-code-review.yml`, `claude.yml`,
  `public-editorial-export.yml` — leave the existing automation alone.
- `biome.json`, `.oxlintrc.json` — rule content is plan 007's concern.
- Playwright e2e in CI — requires live backend + Clerk auth seeding; explicitly
  deferred (see Maintenance notes).
- Any convex/web/agent source file.

## Git workflow

- Branch: `advisor/003-ci-and-check-scripts`
- Conventional commits, e.g. `feat(dx): add ci workflow and check-only lint/format scripts`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add check-only and typecheck scripts to root `package.json`

Add to `"scripts"` (keep the existing mutating `format`/`lint` as-is):

```json
"format:check": "biome format .",
"lint:check": "oxlint . --tsconfig tsconfig.json",
"typecheck": "tsc --noEmit -p tsconfig.json",
"test:agent": "cd agent && bun test",
"typecheck:agent": "cd agent && bun run verify"
```

Note: `biome format .` (no `--write`) exits non-zero when files need
formatting; `oxlint` without `--fix` reports without writing.

**Verify**: `bun run lint:check` → exit 0. If it fails with real lint errors,
that's pre-existing dirt: record the count in your report and continue (CI will
enforce from now on) — unless the errors exceed ~20, which is STOP condition 2.
**Verify**: `bun run format:check` → exit 0 (same escape as above).
**Verify**: `bun run typecheck` → exit 0 (same escape as above).

### Step 2: Create `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  root:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.14
      - run: bun install --frozen-lockfile
      - run: bun run lint:check
      - run: bun run format:check
      - run: bun run typecheck
      - run: bun test convex/*.test.ts

  web:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.11
      - run: bun install --frozen-lockfile
      - run: bunx panda codegen && bunx panda cssgen
      - run: bunx tsc --noEmit

  agent:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: agent
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.14
      - run: bun install --frozen-lockfile
      - run: bun run verify
      - run: bun test
```

Rationale you must preserve: web's `tsc` needs the panda-generated
`styled-system` (it is gitignored), hence the codegen step; `typecheck:web`
from root assumes it exists locally. No job may run any `convex` CLI command.

**Verify**: `bunx yaml '.github/workflows/ci.yml'` parses — or simpler:
`python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"` → exit 0.

### Step 3: Local dry-run of every CI command

Run each job's command sequence locally from the right directory (skip
`bun install --frozen-lockfile` if node_modules is current). All must pass:

**Verify**: root: `bun run lint:check && bun run format:check && bun run typecheck && bun test convex/*.test.ts` → exit 0 (or recorded pre-existing failures per Step 1 escape).
**Verify**: `cd web && bunx panda codegen && bunx panda cssgen && bunx tsc --noEmit` → exit 0.
**Verify**: `cd agent && bun run verify && bun test` → exit 0. If agent tests
try to reach a network service, STOP condition 3.

## Test plan

No new test files — this plan wires existing suites into automation. The test
IS the local dry-run (Step 3) plus, after the operator pushes the branch, one
green run of the `CI` workflow on GitHub (record the run URL in your report if
you have `gh` access and were told to push).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `git diff package.json` shows only added scripts (no removed/renamed ones)
- [ ] `.github/workflows/ci.yml` exists and parses as YAML
- [ ] `grep -rn "convex \(dev\|deploy\|codegen\)" .github/workflows/ci.yml` → no output
- [ ] All Step 3 dry-run commands pass (or pre-existing failures are itemized in the report)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

1. Root `package.json` scripts no longer match the Current state excerpt
   (renamed/restructured since `a30f10c`).
2. `lint:check`, `format:check`, or `typecheck` reveals more than ~20
   pre-existing errors — fixing source is out of scope for this plan; the
   operator must decide whether to fix first or land CI as non-blocking.
3. `cd agent && bun test` attempts real network calls or hangs >5 minutes —
   the env-gating assumption (`RUN_RESEARCH_PIPELINE_REAL`) is then wrong for
   some test; report which file.
4. A `postinstall`/`prepare` hook in any of the three package.json files runs a
   convex CLI command (would make CI touch the live backend).

## Maintenance notes

- When `docs/plans/2026-07-03-04` (convex-test harness) lands with its
  `test:harness` script, add it to the root CI job.
- Playwright e2e (`web/tests/e2e/`, 8 specs) is deliberately NOT in CI: it
  needs a live Convex deployment and Clerk auth state. Follow-up options:
  a nightly job against a staging deployment, or convex-test-backed component
  tests. Until then it remains a manual gate — someone should run
  `cd web && bun run test:e2e` before releases.
- Reviewer should scrutinize: that the workflow pins bun versions matching the
  lockfiles (root/agent were generated with bun 1.3.14; web pins 1.3.11 via
  `packageManager`), and that no step can reach the self-hosted backend.
- If CI formatting/lint checks become noisy, the fix is running the existing
  mutating `bun run format && bun run lint` locally — do not weaken the checks.
