# Improve-skill ledger: Waves 1 and 2 (execution order and status)

Moved verbatim from `plans/README.md` on 2026-11-09 so the index stays under
the 20,000-byte commit limit. Current index: [`../README.md`](../README.md).

> **SEC-01 — resolved by operator decision (Keith, 2026-07-16):**
> `AUTH_BYPASS_ENABLED=true` on the single production instance is
> **intentional and stays on**. There is no separate dev deployment; the
> bypass secret is the standing service identity for agents, CI (the
> editorial export), and scripts that read/write the database, while Clerk
> authentication exists to track which humans log in — not to gate agents.
> Do not re-flag the enabled bypass as a misconfiguration, and do not file
> plans to disable it. See the 2026-07-16 decision-log entry. The controls
> that matter under this model are **secret hygiene**: plan 014's
> constant-time compare, rotation discipline, the consumer inventory +
> auth-failure alerting (improvements ledger #20), and TLS for the site
> surface (#9).

> **Archive note (2026-07-15):** Wave-1 completed plans 001–007, 009, 010 were
> moved to `plans/archive/`. Only 008 remains active from Wave 1. The Wave-1
> table below stays as that wave's ledger. Cross-repo plan status:
> `docs/plans/README.md`.
>
> **Archive note (2026-07-19):** Wave-2 plans 011–015 (all DONE 2026-07-18)
> moved to `plans/archive/`. **Plan 008 is now the only file in `plans/`** —
> the sole open item across both improve-skill waves. Golden datasets were
> ratified in `d2487c1`; plan 008 is ready when live API access is available.

**Relationship to `docs/plans/`**: this repo already carries two committed plan
waves — the 2026-07-01 agent-system-v2 and 2026-07-03 architecture-deepening
waves, both fully landed and archived to `docs/archive/plan-waves/`. The audit
behind THIS directory excluded everything those waves already card. Where a
plan here touches the same files as an arch-wave plan, its STOP conditions and
maintenance notes say how to reconcile.

**Standing constraint for every plan**: `bunx convex codegen|dev|deploy` — and
equally the post-Vite+ `vpx convex codegen|dev|deploy` / `vpx convex run` —
contact the LIVE self-hosted backend. No plan here requires them; executors
never run them. Deployment of convex-touching changes (plans 002, 005, 010) is
operator-gated.

## Wave 2 (2026-07-15) — execution order & status

Audited at commit `86f0751`. All five plans are independent (separate branches/
worktrees) with one caveat noted below. None require live-backend commands; 013
adds a cron whose **activation is operator-gated** (needs a Convex deploy).

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 011 | SSRF guard on `ingestUrl` (block private/loopback targets) | P1 | S | — | DONE 2026-07-18 — parse-time guard incl. IPv4-mapped-IPv6 block; `lint:check` gate pre-existing-broken on main (waived; carded into 015). |
| 012 | Fix `recipes.generateBatch` return validator (`whyThisMatters`) | P1 | S | — | DONE 2026-07-18 — fail-then-pass regression test included; `lint:check` gate pre-existing-broken on main (waived; carded into 015/016). |
| 013 | Wire `reconcileReviewedRuns` cron + finalizer atomicity | P1 | S | — | DONE — code+tests landed 2026-07-18; cron activation deploy-pending (operator). Note: `lint:check` and root `typecheck:agent` gates are pre-existing-broken on main (waived; carded into 015). |
| 014 | Security hardening: bump `ws` (GHSA), constant-time bypass compare | P2 | S | — | DONE (root + agent) 2026-07-18 — root ws@8.21.0 and `agent/` ws@8.21.1, each via its own override; no `ws` advisory in either. Constant-time compare landed. **`web/` residual closed 2026-10-17:** the Convex 1.46.0 upgrade (c78be22e) added a name-level `ws` override to `web/` that removed `ws@7.5.10`, and #129 later dropped its consumers (`react-native` for metro/dev-middleware, `@solana/web3.js` for jayson). The name-level override is now the path-scoped `"viem": { "ws": "^8.21.0" }`: viem's exact `ws@8.18.3` pin was the only one below the floor, so every `ws` resolves to `>=8.21.0`, and a future `ws@7` consumer keeps its major (verified with jayson in a scratch install). `lint:check` gate pre-existing-broken on main at the time (waived; cleared by 016). |
| 015 | Docs sweep (Bun→Vite+, stale facts) + aggregate `verify` command | P2 | S | — | DONE 2026-07-18 — incl. root typecheck + fixed typecheck:agent script; `verify` green on the merged tree (016 lint/format debt cleared, lint scope corrected). |

**Recommended order**: 011, 012, 013 (the P1 correctness/security fixes) first,
then 014 and 015 (hygiene). All are S-effort and independent.

**Parallelization caveat**: 014 and 015 both edit root `package.json` (014 adds a
`ws` override; 015 adds the `verify` script) — land them sequentially or expect a
trivial merge. 011/012/013 touch disjoint files and parallelize freely.

**Wave-2 dependency notes**:
- None of 011–015 depend on each other for correctness.
- 013's cron only takes effect after an operator Convex deploy — the code+tests
  landing is "done" for the executor; note deploy-pending in the status row.
- 014 reduces SEC-01's blast radius but does NOT resolve it (see the operator-
  action callout at the top).

## Wave 1 (2026-07-07) — execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Rotate & de-commit auth-bypass secret, HTTPS transport | P1 | S | — | DONE — secrets rotated 2026-07-09, HTTPS via convex.resonantprojects.art |
| 002 | Internalize concept-graph write surface + constant-time secret check | P1 | S–M | — | DONE |
| 003 | CI workflow + check-only lint/format/typecheck scripts | P1 | S | — | DONE — root typecheck descoped (pre-existing type debt) |
| 004 | Characterization tests for RSS/LLM-output parsers | P2 | M | — (best before/with 003's CI) | DONE |
| 005 | Dashboard query scaling: quadratic, N+1, stats table for counts | P2 | M | — | DONE — operator must deploy + run first `recomputeStats`; counts read 0 until then |
| 006 | Docs canonicalization (CLAUDE.md/AGENTS.md/README) | P2 | S | 001 | DONE |
| 007 | Dependency hygiene: dead deps, npm lockfile, linter split | P3 | S | 006 | DONE |
| 008 | Run first eval baseline sweep (operational) | P2 | S–M | Golden datasets ratified; needs live API keys | STAGE 1 DONE 2026-10-17: extraction and hypothesis are baselined. Extraction: `schema_valid` 1.00, `parameter_specificity` 0.82. Hypothesis: `why_this_matters` 0.67. Three runs each, all exit 0. Stage 1 cost $3.48: run 1 at its $1.52 bound on Keith's decision, plus $1.96 measured through the new opt-in `EVAL_USAGE_LOG` hook. Four stale 2026-07-24 LangSmith examples were deleted on Keith's decision. Stage 2 (weekly briefs) stays BLOCKED: STOP 4 applies, at 2 rows and 0 production theses, and stage 2 has no approval. See [stage 1 sweep](../docs/evidence/eval-baseline-20261017/sweep-stage1.md). Earlier: STOP 1 cleared on `devbox`; hypotheses ratified and materialized at 6 rows (H1–H3, H5–H7). Runner defects repaired ([runner repair](../docs/evidence/eval-baseline-20261017/runner-repair.md)); see [preflight](../docs/evidence/eval-baseline-20261017/preflight.md) and [readiness](../docs/evidence/eval-baseline-20261017/readiness.md) |
| 009 | Spike: `recipe_export_v1` contract + .scl emitter | P3 | M | — (needs `.env.local`) | DONE — [Open questions](../docs/recipe-export-v1-design.md#6-open-questions) |
| 010 | Spike: autonomous ingest design + URL-fetch prototype | P3 | M | — (see its STOP 1 re: arch plan 06) | DONE — see `docs/autonomous-ingest-design.md` §7 build slices |


Status values: TODO | IN PROGRESS | DONE | BLOCKED (with one-line reason) | REJECTED (with one-line rationale)

Safe to parallelize (separate branches/worktrees): {001, 002, 003} are
independent; {004, 005} after or alongside them; 008/009/010 any time
(they don't touch the files plans 001–007 edit, except 010's one additive
action in `convex/ingest.ts` — don't run 004 and 010 concurrently).

## Dependency notes

- **006 after 001**: both edit `CLAUDE.md`; 001 removes the secret literal 006
  would otherwise have to work around.
- **007 after 006**: both edit `CLAUDE.md` (linter-split note vs canonicalization).
- **004 before/with 003**: the parser tests should be enforced by the new CI
  from day one; either order works, but land both.
- **004 vs arch plan 2026-07-03-03 (LLM module, archived)**: if the LLM-module refactor
  lands first, 004's extract.ts targets move — its STOP 1 covers this.
- **002 vs arch plan 2026-07-03-05 (agent-tool registry, archived)**: both touch
  `agentToolsHttp.ts`; whichever runs second adapts (002's STOP 2 / the
  registry plan's seam-handoff rules).
- **Deferred dep upgrades** (see 007 maintenance notes): AI SDK v6→v7 must wait
  for arch plan 2026-07-03-03 (archived).
- **008** needs `ANTHROPIC_API_KEY` + `LANGSMITH_API_KEY` through Varlock
  (resolving on `devbox` since 2026-10-17), a cost estimate approved before
  the first paid run, and upload approval. Human dataset curation was ratified
  in `d2487c1` with hypothesis (4) and weekly brief (2) under STOP 4's 5-row
  floor. Keith ratified 6 hypothesis rows on 2026-10-17, now materialized,
  which clears the hypothesis floor. No further brief qualifies, so briefs
  stay under STOP 4. It STOPs cleanly if either key is missing.

