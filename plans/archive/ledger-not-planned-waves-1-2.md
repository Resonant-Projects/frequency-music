# Improve-skill ledger: Waves 1 and 2 (findings not planned, coverage notes)

Moved verbatim from `plans/README.md` on 2026-11-09 so the index stays under
the 20,000-byte commit limit. Current index: [`../README.md`](../README.md).
Do not re-audit the items below unless their status has changed.

## Audit findings that did NOT become plans

(So nobody re-audits them.)

- **Pagination on list endpoints** — real absence (no `.paginate()` anywhere;
  fixed `.take()` caps), but no list has hit its cap for the small-collaborator
  user base. Revisit when any table crosses a few thousand rows.
- **`graph.ts getConceptEdges` N+1 / `exportForVisualization` load-all-then-BFS**
  — real but low-traffic (constellation view); documented as deferred in plan
  005's maintenance notes.
- **Empty `catch {}` blocks in fetch scripts** — best-effort retry paths in
  one-shot scripts; not worth hardening.
- **`@onkernel/sdk` 0.37→0.74, `@clerk/clerk-js` v5→v6, AI SDK majors** —
  legitimate version lag, deliberately deferred with sequencing recorded in
  plan 007's maintenance notes.
- **Playwright e2e in CI** — needs live Convex + Clerk auth seeding; deferred
  with options in plan 003's maintenance notes.
- **`recipe` eval baseline runner absent** — noted in plan 008; a tooling gap,
  not an execution step.
- **Direction findings not selected for planning**: composition→listening
  "proving ground" build-out (large; revisit after the current waves), essays
  vs `editorialArtifacts` divergence (272 static essays bypass the review
  pipeline; likely resolved by a decision-log entry choosing to bless the
  split or unify — an operator decision, not an executor plan).
- **Already-settled by decision log / arch wave** (not re-reported): best-effort
  tracing, dedupe contract, status-shape duplication, LLM-call duplication,
  ctx-seam harness, agent-tool registry, ingest script env handling, web api
  string table, `aggregates.ts` orphan decision, god-file decompositions.

### Wave 2 (2026-07-15) — vetted but not planned

Confirmed real, but lower leverage than 011–015; recorded so they aren't
re-audited. Promote any of these in a future wave if priorities change.

- **BUG-02 — hypothesis "already-linked" check misses multi-extraction
  hypotheses** (`convex/hypotheses.ts:586`): the `by_extractionIds` index
  equality matches the whole array, so an extraction linked only inside a
  multi-extraction hypothesis reads as unlinked and gets a duplicate hypothesis
  regenerated. **Latent** — production only generates single-element
  `extractionIds` today, so it can't fire until multi-extraction hypotheses
  exist (agent-draft promotion can create them). Fix = membership test /
  normalized join. Promote if agent drafts start carrying multiple extractions.
- **BUG-04 — weekly-brief `weekOf` computes next Monday on Sundays**
  (`convex/weeklyBriefs.ts:510`, `getDate()-getDay()+1`): a Sunday-generated
  brief is stamped a week ahead. The scheduled cron runs Fridays, so the default
  path is unaffected; only manual/off-day generation misfiles. S-effort one-line
  fix (`const dow = (getDay()+6)%7`) — fold into a future correctness pass.
- **BUG-05 — extraction JSON cast without zod** (`convex/extract.ts:184,210,235,237`):
  the LLM extraction result is `as ExtractionResult` / `as any` with no schema;
  a missing top-level `claims`/`compositionParameters` throws and flips the
  source to `review_needed`, discarding a partially-good payload. Fails safe (no
  corrupt data), so MED priority. Fix = zod-parse mirroring the classifier/recipe
  paths. M-effort; good candidate for a dedicated robustness plan later.
- **PERF-01 — `editorialSignals` per-concept traversal cascade**
  (`convex/dashboard.ts:594-710`): four nested fan-out levels (concept →
  hypothesis → recipe → composition → listening-session), each capped at 100 —
  the heaviest dashboard read. Bounded (won't table-scan) and **predates
  `a30f10c`**. Fix = extend the plan-005 stats cron to precompute per-concept
  net-yield. Revisit when graph density makes the dashboard feel slow.
- **PERF-02/03/04 — bounded perf smells**: classifier nested edge scans
  (`conceptClassifier.ts:304`, ~2k edge reads/batch, off client hot path);
  sequential claim inserts in `extractInternal.ts:87` (single mutation
  transaction — marginal); worker poll loop has no error backoff
  (`agent/src/worker/runner.ts:293`, single worker so low impact). All S-effort,
  low leverage — batch into a perf pass if one is ever warranted.
- **TEST-02 — web has zero non-e2e tests in CI** (`.github/workflows/ci.yml:23-41`
  web job typechecks only; loop-wave web routes +690 lines untested): a real
  MED coverage gap, but CI *does* typecheck web (which transitively typechecks
  convex), so it is not the critical "no gate at all" variant. Playwright-e2e-in-CI
  remains separately deferred (needs live Convex+Clerk). Promote by adding a
  vitest Solid component runner for the highest-churn routes.
- **TEST-03 — two new graph-link actions untested** (`convex/graph.ts`
  `linkHypothesisConcepts`, `buildGraphFromExtractions`): no test reference;
  LLM-dependent, possibly deferred deliberately. M-effort harness tests with a
  stubbed classifier. Fold into a graph-coverage plan.
- **DEP-01 — `web/` Vite+ floats on `@latest`** (`web/package.json:34,39`) while
  root pins `0.2.2`: non-reproducible web builds on a young, fast-moving
  toolchain. S-effort (pin to `0.2.2` + re-lock). Not bundled into 015 to keep
  that plan docs-only; promote to its own tiny plan or fold into the next deps
  pass.
- **DEP-02 — minor cross-workspace version drift** (`langsmith`/`convex`/
  `convex-helpers` caret-vs-exact across root/agent): latent risk on the
  convex↔agent shared-contract seam. Worth a pinning *policy*, not a one-off bump.
- **DEBT-01/02 — fossils & mislabels**: `frequency.db` (0-byte), `files.zip`
  (also flagged SEC-03 — see below), `prompts/`, `planning/` are pre-Convex
  fossils; `convex/phase4.test.ts` describes "phase 1 hardening" and tests
  editorial/hypothesis modules (misnamed). S-effort cleanup; low urgency. Note:
  `phase2.ts`/`fabric.ts`/`inbox.ts` were checked and are **live**, not fossils.
- **SEC-03 — `files.zip` contains retired n8n/feed config with credential-shaped
  fields** (repo root, tracked): dead artifact from the retired n8n path. Whether
  the fields are live secrets or n8n credential-ID placeholders needs a
  **maintainer values-level check** (not done here per the no-secret-repro rule).
  If any real secret is present: delete + purge from history + rotate. Operator
  task, not an executor plan.
- **SEC-06/07 — blast-radius hygiene**: `AUTH_BYPASS_SECRET` provisioned into the
  Vercel web env for e2e-only use (`web/.env.schema:54`; confirmed NOT in the
  client bundle — no `VITE_` prefix); empty `*.db` artifacts tracked
  (`frequency.db`, `data/freq.db`, `data/pipeline.db`). Both LOW — scope the
  secret to the test runner; `git rm` the empty dbs + `.gitignore *.db`. Fold
  into a hygiene pass.
- **DOC-03 — README credits retired n8n for scheduling**: partially addressed by
  plan 015 (README deliverable line). Full `docs/n8n.md` retirement is an
  operator decision (commit `56c39ea` is ambiguous) — left out of 015's scope.

### Wave 2 — direction findings (options for the maintainer, not planned)

Grounded in repo evidence; each is a design/spike or build decision for Keith,
not an executor task. Listed so they're captured:

- **DIR-01 — build `recipe_export_v1` / "Starter Kit"**: spike (Wave-1 plan 009)
  DONE, GLOSSARY.md specifies it, `.scl` emitter prototyped, but zero code
  (`grep starterKit` → nothing). Highest-leverage "tool does the setup
  arithmetic" win. Resolve `docs/recipe-export-v1-design.md#6` open questions
  first. Effort L.
- **DIR-02 — card autonomous-ingest slices S1–S5**: spike (Wave-1 plan 010) DONE
  with sequenced slices in `docs/autonomous-ingest-design.md#7`; the `fetchJobs`
  table (S1) is unstarted (`grep fetchJobs convex/schema.ts` → nothing). Reuses
  the proven `agentRuns` claim/heartbeat contract. S1 alone unblocks the rest.
- **DIR-03 — implement "Source Scout"**: GLOSSARY.md specifies need-directed
  discovery driven by graph gaps; zero code, but the correspondence `conjectured`
  lifecycle + domain registry + agent plumbing now exist. Needs a design/spike
  first (no design doc yet). Effort L.
- **DIR-04 — run the eval baseline sweep**: this is Wave-1 **plan 008** (BLOCKED
  2026-10-17; see its row); tooling staged (`scripts/export-eval-datasets.ts`, `docs/eval-baselines.md`
  skeleton). Operator-gated on live API keys. Without a baseline every generator
  prompt/model change is unmeasured.

## Audit coverage note

**Wave 2 (2026-07-15)**, standard effort, audited at `86f0751` via 4 parallel
read-only subagents (correctness, security, perf+tests, debt/deps/DX/docs/
direction), weighted to the 528-file delta since `a30f10c`. Read deeply:
`convex/` loop-wave modules (claims, correspondences, classifier, domains,
dashboard, agentRuns, agentDrafts, extract, ingest, recipes, hypotheses,
weeklyBriefs, auth, http, agentTools*), `agent/src` worker + research-pipeline
nodes, all three `package.json` + lockfiles, CI workflows, root docs. Local test
suites run green: `vp test convex` (144), `vp test harness` (46). NOT audited in
depth: `web/src` component/3D-zodiac internals, the 306 essays' content, `data/`
manifests, `harness/` test bodies line-by-line, live-backend state (barred). No
secrets reproduced; no prompt-injection content encountered. Every finding that
became a plan (011–015) was re-verified against live code by the advisor before
planning. Correction carried forward: `web/` is **SolidJS**, not React.

---

## Wave 1 archived coverage note

Standard-effort audit (2026-07-07): correctness/security (very thorough over
`convex/`, `agent/src`, `scripts/`, lighter over `web/src`), performance,
dependencies, tests, DX, docs, direction. NOT audited: `web/src` component
internals in depth, `agent/src` graph logic in depth, the 272 essays' content,
`data/` manifests, git history beyond 30 commits. The audit trusted the
2026-07-02 architecture review's findings for the seven clusters it carded
rather than re-deriving them.
