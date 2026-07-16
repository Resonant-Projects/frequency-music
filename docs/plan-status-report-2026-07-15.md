# Plan Status Report — 2026-07-15

Full audit of every plan document in the repository: what was planned, what
shipped, what remains, and the recommended completion order. Companion README
(the short version): [docs/plans/README.md](./plans/README.md). Completed
material was moved to [docs/archive/](./archive/README.md) and
`plans/archive/` as part of this audit.

## 1. Executive summary

The project has run five distinct planning generations. Four are complete;
one is mid-flight:

| Generation | Where | Verdict |
|---|---|---|
| MVP spec (May 2026) | `planning/` → **archived** | ✅ Shipped and exceeded (M0–M5 + most post-MVP) |
| LangChain/LangGraph/LangSmith prep (2026-05-14) | `planning/langchain/` → **archived** | ✅ ~90% landed (pivot noted below); open gap = golden datasets |
| Agent system v2 wave (2026-07-01, plans 01–05) | `docs/plans/` → **archived** | ✅ All landed (`550fbbb`, `32166aa`) |
| Architecture deepening wave (2026-07-03, plans 01–07) | `docs/plans/` → **archived** | ✅ All landed (per-file `> Landed:` headers) |
| Improve-skill audit plans (2026-07-07, 001–010) | `plans/` → done ones **archived** | ✅ 9 of 10 done; **008 eval sweep open** (blocked on dataset curation) |
| **Knowledge-loop wave (2026-07-07, plans 01–11)** | `docs/plans/` — **active** | 🔶 **01–03 landed; 04–11 remain. This is the frontier.** |

Strategic roadmaps: the **meaning roadmap Phases 1–4** (theses, lineage,
failure memory, campaigns, studio prompts, curated editorial + `public_editorial_v1`
export) are **implemented** — confirmed both by status lines in
`implementation-checkpoints.md` and by schema/code audit (theses, campaigns,
editorialArtifacts tables all live). The **next-wave roadmap (Phases A–F)** is
the post-loop-wave backlog; a code audit of its 24 workstreams is in §4.

**The single most important fact** (from the 2026-07-07 grilling session,
decision log): the system's bottleneck is synthesis, not capture — 1,580+
extractions and a 5,400-concept graph had collapsed to 19 hypotheses,
0 compositions. The knowledge-loop wave is the designed remedy and the
2026-07-10/12 verification sessions confirmed it should be executed as
planned. **Loop wave first; everything else second.**

## 2. Recommended completion order

### Now: knowledge-loop wave, gate order

1. **Plan 04 — Embeddings + vector indexes** (next; prereqs 01–03 all live).
   OpenAI `text-embedding-3-small`, Convex-native vector indexes over
   on-mission claims + concepts.
2. **Plan 05 — Candidate generator + miner/evidence-hunter graphs** — the
   "semantically near, domain-far" query that starts producing correspondences
   at scale.
3. **Plan 06 — Drafting graph + WIP cap (N=3)** — turns correspondences into
   hypothesis/recipe drafts without flooding review.
4. **Plans 07–08 — Review UX, weekly-brief integration** — closes the
   human loop.
5. **Plans 09–11 — Source scout, starter kits, self-render spike** — the
   wave's tail; starter kits are the first composition-side payoff.

### In parallel (human-gated, small)

- **Golden dataset curation** — the sole blocker for `plans/008` (eval
  baseline sweep). Targets: ≥15 extraction, ≥15 hypothesis, ≥6 weekly-brief
  golden examples curated from `data/eval/*-candidates.jsonl`. Research
  judgment, not code.
- **Domain triage packet** — `docs/review/domain-triage-2026-07-12.md`
  (2 promote / 34 merge / 13 reject + parameter/relationship kinds).
- **Proxmox host session** — worker env refresh + restart, UNAUTHORIZED
  scheduler hunt (`docs/proxmox-worker-runbook-2026-07-12.md`). The worker
  image is already fixed; only host access is missing.
- **Review the 1 pending agent draft.**
- **Structural security items** — improvements ledger #19 (e2e writes to
  production — dedicated e2e deployment + fail-closed cleanup), #20
  (bypass-secret consumer inventory + auth-failure alerting), #9 (TLS for the
  `:3211` site surface).

### After the loop wave: next-wave Phases A–F

In roadmap order — automate input, normalize the control surface, export,
connect, represent, analyze (details and already-done credits in §4).

## 3. Evidence: what each ledger says

- **`plans/README.md`** (improve wave): 001–007, 009, 010 DONE in the status
  table; 008 TODO. 009/010 ended as design spikes whose outputs are
  `docs/recipe-export-v1-design.md` and `docs/autonomous-ingest-design.md` —
  both remain **active designs** feeding next-wave Phases C and A.
- **`docs/improvements-2026-07-10.md`** (verification ledger, sessions 1–3):
  backlog items #2–#5, #7, #8, #10–#18 all fixed/deployed; #6 and #14
  deferred-by-design; **open: #9 (TLS), #19 (e2e→prod), #20 (secret
  inventory/alerting)**. Both formerly-dead crons (batch-extract,
  weekly-turn) proven alive end-to-end after the OpenRouter key rotation.
- **Loop-wave plan headers**: 01 landed `b2e0cbe` (2026-07-10, 4,648 claims),
  02 landed `03dce57` (2026-07-11, 5,444/5,444 concepts classified, ~$6.2),
  03 landed `2adca48` (2026-07-12, live-gated upsert-twice→one-row).
- **`docs/decision-log.md`**: 2026-07-07 entries fix the wave's decisions
  (correspondence identity, claims as rows, two-doors-one-gate, embeddings
  propose / symbolic score / LLM judge, WIP cap N=3) — marked do-not-reopen.

## 4. Next-wave workstream audit (code-verified, 2026-07-15)

Status of all 24 workstreams in `docs/next-wave-workstreams.md` against the
actual codebase — several are further along than the roadmap assumes:

| # | Workstream | Status | Evidence |
|---|---|---|---|
| 1 | Autonomous ingest | **Partial** | URL fetch (`convex/ingest.ts` `fetchUrlText`/`ingestUrl`) and YouTube transcripts (`convex/fabric.ts`) wired; **PDF extraction still script-only** |
| 2 | Workflow ops surface | **Done** | `workflows:getStatus`, `agent-runs` route with status filters, admin snapshot |
| 3 | Canonical parameter schema | Partial | Typed validator + `parameterKinds` registry; `parameter_value_v1` exists only in the export spike; no unit normalization in Convex |
| 4 | Parameter actionability | Not started | No observed/controllable flags anywhere |
| 5 | Experiment protocol model | Partial | `recipeProtocolZ` field (litmus/comparison, whatVaries…) — a field, not a table |
| 6 | Structured revision diffs | Partial | `revisionParentId`/`revisionVariable`/`diffNote` + lineage traversal; diff itself is free text |
| 7 | `recipe_export_v1` | Partial (spike) | `scripts/spike-recipe-export.ts` + tests; not wired into Convex/app |
| 8 | Generated assets | Partial | Spike emits `recipe.json` + `.scl`; no `.kbm` generation, no MIDI seeds |
| 9 | Instrument/template mapping | Not started | Free-text `dawChecklist` only |
| 10 | OSC/WebSocket bridge | Not started | — |
| 11 | Max for Live connector | Not started | — |
| 12 | Native plugin feasibility | Not started (doc only) | Deliberately deferred |
| 13 | Studio session launcher | Partial | 10/30/90-min prompt variants + recommended actions on briefs; no launcher flow |
| 14 | Artifact registry | Not started | Compositions carry `links[]` only |
| 15 | Audio-analysis pipeline | Not started | Consonance fields are manual ratings |
| 16 | Recommendation memory | Not started (gated) | Agent memory store explicitly gated off |
| 17 | Vocabulary governance UI | Partial | `reviewSummary` + admin display; no approve/merge controls in UI |
| 18 | AI contract tests | **Done** | `harness/*.harness.test.ts` + fixtures, `convex/contracts.test.ts`, LangSmith evals |
| 19 | 3D explorer expansion | Not started (base exists) | Zodiac covers 4 of ~9 entity families |
| 20 | 2D companion surface | Not started | — |
| 21 | Domain/sector scoring | Partial | LLM domain classification live; zodiac `inferSector` still keyword-based |
| 22 | Yield visualization | **Done** | `netYieldScore`/`yieldBand` + high/low-yield clusters on `display.tsx` |
| 23 | Auth/visibility hardening | **Done** | `requireAuth`, per-table visibility, internal-only graph writes, tests (plans 001/002) |
| 24 | Connector-safe narrative | **Done** | `public_editorial_v1` export bundle, visibility-gated |

Implication for Phase planning: Phases E/F are less work than the roadmap
text implies (22–24 done), Phase A reduces mostly to PDF wiring + retry
surfaces, and Phase B (items 3–6) is the real meat.

## 5. Notable pivot recorded during this audit

The 2026-05-14 LangGraph plan's push model (Convex cron → LangGraph server
`/runs/wait`) was **replaced** by a pull-based worker: `agent/src/worker/runner.ts`
polls `agentRuns`, executes the graph, and writes `agentReviewDrafts` for
human review; the primary graph became `research-pipeline` rather than
`weekly-brief`, and a Codex-SDK subagent + model-fallback layer were added
beyond plan. The plan's 3-week static-vs-agentic comparison (its Task 6) was
never run and is superseded in practice by the loop wave's eval/review
machinery. The archived plan is historical; `docs/agent-tool-surface.md` and
`agent/README.md` describe reality.

## 6. Cleanup performed with this report

- `planning/` (12 files incl. `langchain/`) → `docs/archive/planning/`
- Completed waves (2026-06-02, 2026-06-06, all 2026-07-01-\*, all 2026-07-03-\*)
  → `docs/archive/plan-waves/`
- `docs/minimal-schema-for-loop.md`, `docs/mvp-screens-and-actions.md`
  → `docs/archive/superseded/`
- `plans/001–007, 009, 010` → `plans/archive/` (`plans/README.md` stays as ledger)
- The active 2026-07-07 loop wave stays intact in `docs/plans/` (landed plans
  01–03 included, since 04–11 reference their interfaces)
- New: [docs/plans/README.md](./plans/README.md) — the standing "what remains,
  in order" index
