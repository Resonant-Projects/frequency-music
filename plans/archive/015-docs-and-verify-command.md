# Plan 015: Onboarding docs match reality; one `verify` command runs all gates

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 86f0751..HEAD -- README.md AGENTS.md CLAUDE.md package.json`
> If any changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `86f0751`, 2026-07-15

## Why this matters

The repo migrated from Bun to Vite+ (`vp`/`vpx`) on 2026-07-10, but the
onboarding docs still instruct `bun`/`bunx` everywhere and claim `.env.local`
auto-loads (it no longer does — `varlock/auto-load` handles it). A new
contributor or executor agent following `README.md` runs commands the migration
replaced and hits a first-run failure with no signpost to the real workflow. On
top of that there is **no single command** that verifies the repo — CI
reconstructs the checks across three jobs, but locally you must know and run five
scripts across three directories, and the README points at a `typecheck` script
that was never added. Finally, several `CLAUDE.md` facts are actively wrong
(tracing "needs a Node split" that already shipped; a phantom `skills/`
directory; "18 essays" when there are 306; the wrong file for `MODELS`). These
are the map agents navigate by; wrong entries erode trust in the whole document.
This plan makes the docs true and adds the missing `verify` script.

## Current state

### README.md — stale Bun commands and a missing script

- `README.md:56-57` — `bun install`, `cd web && bun install`
- `README.md:61` — `cd web && bun run dev`
- `README.md:65` — "Copy `.env.example` to `.env.local`; **Bun auto-loads it**."
- `README.md:77-80`:
  ```
  - Convex: `bun test convex/*.test.ts`
  - Web: `bun run typecheck:web` and `bun run build:web`
  - Agent: `cd agent && bun run verify && bun test`
  - If present after Plan 003 lands: `bun run lint:check`, `bun run format:check`, and `bun run typecheck`
  ```
  Plan 003 is DONE but its note records "root typecheck descoped" — so the
  referenced root `typecheck` script does **not** exist.
- `README.md:42` — "n8n: RSS polling + Notion scheduled sync + webhook pushes."
  Feed polling now runs natively in `convex/crons.ts` (`poll-feeds`, every 6h);
  commit `56c39ea` records n8n as retired/unauthorized.

### AGENTS.md — stale `bunx`

- `AGENTS.md:10` — `bunx convex run extract:extractSource '{... "model": "anthropic/claude-sonnet-4-6" ...}'`
  (also note: model id `claude-sonnet-4-6` vs CLAUDE.md's canonical `claude-sonnet-4.6`).

### CLAUDE.md — actively-wrong facts

- `CLAUDE.md:24` — "Convex-side tracing still needs a Node-runtime split before
  importing the LangSmith SDK." Already shipped: `convex/tracing.ts:1` is
  `"use node"` and imports `langsmith/traceable`; `convex/llmNode.ts` is the
  documented Node-runtime half. Runbook at `docs/langsmith-runbook.md`.
- `CLAUDE.md:48` — "`essays/  # Synthesized research essays (18 essays)`".
  Actual count: `ls docs/essays | wc -l` → 306.
- `CLAUDE.md:71` — "`skills/  # Agent skills (Fabric CLI, etc.)`". No `skills/`
  directory exists at repo root (`ls -d skills` → not found).
- `CLAUDE.md:17` — "see convex/extract.ts MODELS". `MODELS` is defined in
  `convex/llm.ts` and only re-exported from `extract.ts`; the dedicated Models
  section of CLAUDE.md already says `convex/llm.ts` correctly, so line 17 is a
  half-finished edit.

### package.json — no aggregate verify, no root typecheck

`package.json:5-17` scripts: `format`, `format:check`, `lint`, `lint:check`,
`test` (convex only), `test:harness`, `test:agent`, `typecheck:agent`,
`typecheck:web`, `build:web`, plus eval/convex/env helpers. No `verify`/`check`
and no root `typecheck`. CI (`.github/workflows/ci.yml`) runs, across three jobs:
root = `lint:check` + `format:check` + `test` + `test:harness`; web = panda
codegen + `tsc --noEmit`; agent = `verify` + `test`.

## Commands you will need

| Purpose         | Command                        | Expected on success        |
|-----------------|--------------------------------|----------------------------|
| Convex tests    | `vp test convex`               | all pass                   |
| Harness tests   | `vp test harness`              | all pass                   |
| Typecheck web   | `vp run typecheck:web`         | exit 0                     |
| Typecheck agent | `vp run typecheck:agent`       | exit 0                     |
| Agent tests     | `vp run test:agent`            | all pass                   |
| Lint            | `vp run lint:check`            | exit 0                     |
| Format check    | `vp run format:check`          | exit 0                     |
| The new script  | `vp run verify`                | runs all of the above, exits 0 |

Do NOT run `bunx convex ...` / `vpx convex run ...` (LIVE backend).

## Scope

**In scope**:
- `package.json` — add the `verify` script (and optionally a root `typecheck`)
- `README.md` — fix all Bun→Vite+ commands, the env-autoload line, the missing
  `typecheck` reference, and the n8n deliverable
- `AGENTS.md` — fix the `bunx` command and model-id spelling
- `CLAUDE.md` — fix the four wrong facts (tracing, essay count, phantom
  `skills/`, `MODELS` file pointer)

**Out of scope**:
- `docs/n8n.md` retirement/reconciliation — flagged as needing an operator
  decision (the commit message "eliminated-n8n-but-unknown-and-packaged" is
  ambiguous). Do NOT delete it; in README just describe scheduling as
  Convex-crons and drop the n8n deliverable line, or soften it — see Step 3.
- The essays-vs-`editorialArtifacts` question — out of scope; only fix the count.
- Any code change beyond `package.json` scripts. This is a docs+scripts plan.
- Rewriting the CLAUDE.md directory tree wholesale — fix only the two wrong
  lines (48, 71) and the one pointer (17, 24).

## Git workflow

- Branch: `advisor/015-docs-and-verify-command`
- Commit style: `docs: correct post-Vite+ onboarding commands and stale facts`
  and `chore(scripts): add aggregate verify script`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add the `verify` script

In `package.json` `scripts`, add an aggregate that mirrors what CI's three jobs
run, fail-fast, in a sensible order (cheap checks first):

```jsonc
    "verify": "vp run format:check && vp run lint:check && vp run typecheck:web && vp run typecheck:agent && vp test convex && vp run test:harness && vp run test:agent",
```

Notes:
- `typecheck:web` transitively typechecks `convex` (via `_generated/api`), which
  is why no separate root `typecheck` is strictly needed; you may ALSO add a root
  `"typecheck": "vp run typecheck:web && vp run typecheck:agent"` if you want the
  README reference to resolve to a real script (recommended — it makes Step 3
  simpler). Keep whichever you choose consistent between `package.json` and the
  README text.
- Use the exact script names that already exist (`test`, `test:harness`,
  `test:agent`, `typecheck:web`, `typecheck:agent`, `lint:check`,
  `format:check`) — verify each resolves.

**Verify**: `vp run verify` → runs every gate and exits 0. (If a gate fails for a
reason unrelated to this plan — pre-existing debt — STOP and report which gate;
do not "fix" unrelated failures here.)

### Step 2: Fix README commands

In `README.md`, replace Bun invocations with Vite+ equivalents:
- `bun install` → `vp install` (both the root and `cd web && ...` lines)
- `cd web && bun run dev` → `cd web && vp run dev`
- Line 65: replace "Bun auto-loads it" with: "scripts load it via
  `varlock/auto-load` (imported at the top of each env-reading script); Node does
  not auto-load `.env` files."
- Lines 77-80: `bun test convex/*.test.ts` → `vp test convex`;
  `bun run typecheck:web`/`build:web` → `vp run typecheck:web` / `vp run build:web`;
  `cd agent && bun run verify && bun test` → `cd agent && vp run verify && vp test`;
  replace the conditional line 80 with a single line pointing at the new
  aggregate: "Everything at once: `vp run verify`."

**Verify**: `grep -n "bun " README.md` → no matches (no bare `bun`/`bunx`
commands remain). `grep -n "vp run verify" README.md` → at least one match.

### Step 3: Fix the README n8n deliverable

Line 42: change "n8n: RSS polling + Notion scheduled sync + webhook pushes" to
describe current reality — RSS/feed polling and batch extraction run on Convex
crons (`convex/crons.ts`). Do not assert anything about n8n's current
authorization status (operator-owned); simply stop crediting it for scheduling
that now lives in Convex. Example: "Scheduling: Convex crons (feed polling every
6h, batch extraction every 8h, weekly briefs) — see `convex/crons.ts`."

**Verify**: `grep -n "n8n: RSS polling" README.md` → no matches.

### Step 4: Fix AGENTS.md

Line 10: `bunx convex run ...` → `vpx convex run ...`. Change the model id string
`anthropic/claude-sonnet-4-6` → `anthropic/claude-sonnet-4.6` (dot form, matching
CLAUDE.md's canonical Models table).

**Verify**: `grep -n "bunx" AGENTS.md` → no matches; `grep -n "claude-sonnet-4.6" AGENTS.md` → one match.

### Step 5: Fix the four CLAUDE.md facts

- Line 24: replace "Convex-side tracing still needs a Node-runtime split before
  importing the LangSmith SDK." with a statement that the split is implemented —
  e.g. "Convex-side tracing runs in a Node-runtime module (`convex/tracing.ts`
  with `\"use node\"`, plus `convex/llmNode.ts`); see `docs/langsmith-runbook.md`."
- Line 48: change "(18 essays)" to non-numeric phrasing, e.g. "(synthesized
  research essays — hundreds)" so it doesn't rot again.
- Line 71: delete the `skills/` line from the directory tree (no such dir).
- Line 17: change "see convex/extract.ts MODELS" to "see convex/llm.ts MODELS"
  (matching the dedicated Models section).

**Verify**: `grep -n "Node-runtime split" CLAUDE.md` → no matches;
`grep -n "18 essays" CLAUDE.md` → no matches;
`grep -n "^└── skills/" CLAUDE.md` → no matches;
`grep -n "extract.ts MODELS" CLAUDE.md` → no matches.

## Test plan

No unit tests — this plan changes docs and one npm script. The verification is
the grep/exit-code checks in each step plus a clean `vp run verify` run. There is
nothing behavioral to test beyond the script executing all gates.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `vp run verify` exists and exits 0 (all gates pass)
- [ ] `grep -rn "bun " README.md` → no matches
- [ ] `grep -n "bunx" AGENTS.md` → no matches
- [ ] `grep -n "Bun auto-loads" README.md` → no matches
- [ ] `grep -n "n8n: RSS polling" README.md` → no matches
- [ ] `grep -n "Node-runtime split" CLAUDE.md` → no matches
- [ ] `grep -n "18 essays" CLAUDE.md` → no matches
- [ ] `grep -n "extract.ts MODELS" CLAUDE.md` → no matches
- [ ] Only in-scope files modified (`package.json`, `README.md`, `AGENTS.md`,
      `CLAUDE.md`) (`git status`)
- [ ] `plans/README.md` status row for 015 updated

## STOP conditions

Stop and report if:

- Any "Current state" excerpt doesn't match live code (drift) — especially if
  the docs were already partly fixed (line numbers shifted).
- `vp run verify` fails on a gate that is pre-existing debt unrelated to this
  plan (e.g. a root/convex type error the CI doesn't gate). Report the failing
  gate and its output; do NOT chase unrelated failures or weaken the `verify`
  chain to make it pass.
- You're unsure whether a `bun`-mentioning line in README is a command (fix it)
  vs. prose about the Bun runtime dependency (leave it) — report the ambiguous
  line rather than guessing.

## Maintenance notes

- `CLAUDE.md` is force-loaded context for every agent session in this repo —
  keep it true. The essay count was frozen once and rotted; the non-numeric
  phrasing prevents a recurrence.
- If a future migration changes the runner again, `README.md` + `AGENTS.md` +
  `CLAUDE.md`'s "Vite+ Defaults" section must move together; a reviewer should
  grep the three for the old tool name on any tooling-migration PR.
- The `verify` script now encodes the full gate set — if CI adds a job (e.g.
  web tests, per finding TEST-02), add it to `verify` too so local and CI stay in
  sync.
- `docs/n8n.md` disposition remains an open operator decision (see README Step 3
  scope note).
