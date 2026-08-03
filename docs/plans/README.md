# Plans — What Remains, In Order

> Last full code audit: 2026-07-15 (see [plan-status-report-2026-07-15.md](../plan-status-report-2026-07-15.md)).
> Last planning session: 2026-07-18 (decision surfaces — see the decision-log entry of that date).
> Last plan-status/archive audit: 2026-08-03 — implementation-complete loop plans 04–10, 12, and 14 archived.
> Completed waves live in [docs/archive/](../archive/README.md). Decision history: [decision-log.md](../decision-log.md).
> **Visual plan** (dependency graph + gate order, 2026-07-19): `plan-1511dbd302914c0a` on plans.rproj.art.

## Where things stand

Every plan wave before the knowledge loop is **done**: the MVP (`planning/`,
archived), the 2026-07-01 agent-system wave, the 2026-07-03 architecture wave,
the 2026-07-07 improve-skill Wave 1 (except 008), and the 2026-07-15
improve-skill Wave 2 (011–015, all DONE 2026-07-18). The meaning roadmap
Phases 1–4 are implemented. Knowledge-loop plans **01–10, 12, and 14 are
implemented and archived** in [plan-waves/](../archive/plan-waves/); remaining
live/operator acceptance is listed below rather than keeping implementation
specs in the active folder.

The active plan files are now: **008** (next, operator-gated eval baseline
sweep), **13** (recipe loop closure, blocked on 008), **11** (deferred studio
spike), **15** (passage-index foundation), and the autonomous Proxmox operations
plan.

The sequencing rule, per the 2026-07-07 decision-log entry: **synthesis is the
bottleneck, not capture** (1,580+ extractions and a 5,400-concept graph had
produced only 19 hypotheses). Finish the loop wave before starting next-wave
phases.

## 1. Knowledge-loop wave — implementation ledger and remaining work

From [2026-07-07-00-loop-master-sequence.md](./2026-07-07-00-loop-master-sequence.md).
Plans 01–10, 12, and 14 are archived; do not re-implement them. An archived
implementation may still have an operator/live acceptance item in §2.

| # | Plan | Status |
|---|------|--------|
| 01 | [Claims become first-class rows](../archive/plan-waves/2026-07-07-01-loop-claims-table.md) | ✅ Landed `b2e0cbe` (4,648 claims backfilled) — archived |
| 02 | [Concept domains + mission relevance](../archive/plan-waves/2026-07-07-02-loop-domains-and-relevance.md) | ✅ Landed `03dce57` (5,444/5,444 classified) — archived |
| 03 | [Correspondences table + agent write surface](../archive/plan-waves/2026-07-07-03-loop-correspondences.md) | ✅ Landed `2adca48` (live-gated) — archived |
| 04 | [Embeddings + vector indexes](../archive/plan-waves/2026-07-07-04-loop-embeddings.md) | ✅ Implemented in PR #28 (`4622c2b`) — archived; backfill/probe acceptance remains |
| 12 | [Domain triage surface](../archive/plan-waves/2026-07-18-12-domain-triage-surface.md) | ✅ Implemented in PR #29 (`e8f5516`) — archived; packet decision remains |
| 05 | [Candidate generator + miner & evidence-hunter graphs](../archive/plan-waves/2026-07-07-05-loop-miner-graphs.md) | ✅ Implemented in PR #31 (`3600ec5`) — archived; worker/live-run acceptance remains |
| 06 | [Drafting graph + WIP cap (N=3)](../archive/plan-waves/2026-07-07-06-loop-drafting-graph.md) | ✅ Implemented in PR #32 (`f3556d5`) — archived; first live draft gate remains |
| 07 | [Review UX + edit-before-approve](../archive/plan-waves/2026-07-07-07-loop-review-ux.md) | ✅ Implemented in PR #33 (`1d69ae4`) — archived; visual/timed acceptance remains |
| 13 | [Recipe loop closure](./2026-07-18-13-recipe-loop-closure.md) | ⏸️ **BLOCKED on plan 008.** Golden datasets are ratified, but the required baseline sweep is not recorded yet |
| 08 | [Weekly brief integration](../archive/plan-waves/2026-07-07-08-loop-weekly-brief.md) | ✅ Implemented in PR #34 (`60cca5e`) — archived; real-brief acceptance remains |
| 09 | [Source scout](../archive/plan-waves/2026-07-07-09-loop-source-scout.md) | ✅ Implemented in PR #35 (`073cb94`) — archived; first live run remains |
| 14 | [Decision-surface sweep](../archive/plan-waves/2026-07-18-14-decision-surface-sweep.md) (card-level) | ✅ Implemented in PR #36 (`236e6f0`) — archived; visual acceptance remains |
| 10 | [Composition starter kits](../archive/plan-waves/2026-07-07-10-loop-starter-kits.md) | ✅ Implemented in PR #30 (`3b72b5c`) — archived; real-recipe/studio acceptance remains |
| 11 | Self-render spike (bounded) | Deferred to a Keith/DA studio session (needs audio engine install, real kits, human A/B listening) |

After 11: **generator steering** (model/prompt/scope knobs in the UI) is the next roadmapped item —
deferred by the 2026-07-18 decision, not dropped.

## 1b. Passage-retrieval program (planned 2026-08-01)

Grilling session 2026-08-01 (Keith): make source prose retrievable via the
`@convex-dev/rag` component. Language: **Passage** in `CONTEXT.md`; decision
record: [ADR 0001](../adr/0001-split-embedding-spaces-for-passages.md)
(3-large passages / 3-small claims, split space, migration is a follow-on).

| # | Plan | Status |
|---|------|--------|
| 15 | [Passage index foundation + `searchSourcePassages` agent tool](./2026-08-01-15-passage-index.md) | 📝 Planned — wave one |
| — | Hypothesis cross-source context (ship directly, no flag) | Follow-on, unplanned |
| — | Extraction full-text fix (send all ≤100k chars; not a RAG change) | Follow-on, trivial |
| — | Recipe context (inherits hypothesis pattern) | Follow-on, last |
| — | Migrate claims/concepts to 3-large | Roadmap follow-on (ADR 0001) |

## 2. Operator/live acceptance items

Small; several are gate-specific, and item 1 must finish before plan 13 starts.

1. **Eval baseline — NEXT, operator-gated.** Golden datasets were ratified in
   `d2487c1`, so [`plans/008`](../../plans/008-eval-baseline-sweep.md) is ready
   when live API access and spend authorization are available. Record that
   baseline before starting plan 13 so its generator changes remain measurable.
2. **Domain triage** — now carded as
   [plan 12](../archive/plan-waves/2026-07-18-12-domain-triage-surface.md): the packet is decided
   *through* the new surface, not hand-applied.
3. **Proxmox worker — DA-executed** (SSH / 1Password / OpenTofu): restart with
   the fresh `AGENT_TOOL_SECRET`, refresh `agent/.env` on the host, hunt the
   UNAUTHORIZED ~6h caller:
   [proxmox-worker-runbook-2026-07-12.md](../proxmox-worker-runbook-2026-07-12.md).
   **Gate: worker healthy before plan 05 counts as done.**
4. **Review the 1 pending agent draft** in the review queue (Keith — also the
   felt baseline for plan 07's timed gate).
5. **Structural fixes** (improvements ledger #19, #20, #9): dedicated e2e Convex
   deployment (e2e currently points at production), bypass-secret consumer
   inventory + auth-failure alerting, TLS for the `:3211` site surface.
   Unscheduled backlog — none gate the current sequence.

## 3. Next wave (Phases A–F) — after the loop wave

From [next-wave-roadmap.md](../next-wave-roadmap.md) /
[next-wave-workstreams.md](../next-wave-workstreams.md). The 2026-07-15 code
audit found several items further along than the roadmap assumes:

- **Phase A — Autonomous ingest** (design: [autonomous-ingest-design.md](../autonomous-ingest-design.md),
  build slices S1–S5). URL fetch and YouTube transcripts are already wired into
  Convex; **the real gap is PDF extraction** (still script-only) and the
  blocked-state/retry surfaces.
- **Phase B — Canonical control surface**: parameter actionability flags (not
  started), first-class experiment model (protocol exists as a recipe field,
  not a table), structured revision diffs (lineage fields exist; diffs are
  free-text).
- **Phase C — Export/connector**: productionize the `recipe_export_v1` +
  `.scl` emitter spike ([recipe-export-v1-design.md](../recipe-export-v1-design.md),
  code archived at `scripts/archive/spike-recipe-export.ts`; production tuning
  lib now at `scripts/lib/tuning.ts` per plan 10) into Convex; add `.kbm`/MIDI seeds.
- **Phase D — DAW connector**: OSC/WebSocket bridge, then Max for Live (nothing
  started; plugin work stays deferred until the bridge proves the model).
- **Phase E — Representation**: 3D explorer expansion (currently
  sources/extractions/hypotheses/recipes only), 2D companion view, replace the
  `inferSector` keyword heuristic with the now-existing domain classifications.
- **Phase F — Analysis & hardening**: artifact registry, computed audio
  analysis, recommendation memory (currently gated off in the agent). Note:
  yield visualization, AI contract tests, auth hardening, and the
  `public_editorial_v1` narrative surface are **already implemented** — skip.

## Ledgers & references

- Improvement backlog + session ledgers: [improvements-2026-07-10.md](../improvements-2026-07-10.md)
- Improve-skill wave ledger (008 ready, still open): [`plans/README.md`](../../plans/README.md)
- Living operating docs (not plans): vision-and-meaning, loop-spec-v1.1,
  cadence-and-operating-rules, schema, agent-tool-surface, eval-baselines,
  langsmith-runbook, parameter-extraction, metrics-and-dissonance.
