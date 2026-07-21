# Plans — What Remains, In Order

> Last full audit: 2026-07-15 (see [plan-status-report-2026-07-15.md](../plan-status-report-2026-07-15.md)).
> Last planning session: 2026-07-18 (decision surfaces — see the decision-log entry of that date).
> Last cleanup: 2026-07-19 — landed loop plans 01–03 and Wave-2 plans 011–015 archived.
> Completed waves live in [docs/archive/](../archive/README.md). Decision history: [decision-log.md](../decision-log.md).
> **Visual plan** (dependency graph + gate order, 2026-07-19): `plan-1511dbd302914c0a` on plans.rproj.art.

## Where things stand

Every plan wave before the knowledge loop is **done**: the MVP (`planning/`,
archived), the 2026-07-01 agent-system wave, the 2026-07-03 architecture wave,
the 2026-07-07 improve-skill Wave 1 (except 008), and the 2026-07-15
improve-skill Wave 2 (011–015, all DONE 2026-07-18). The meaning roadmap
Phases 1–4 are implemented. The active frontier is the **2026-07-07 knowledge-loop
wave**, of which plans 01–03 are landed and live (archived to
[plan-waves/](../archive/plan-waves/) with their landing evidence).

The sequencing rule, per the 2026-07-07 decision-log entry: **synthesis is the
bottleneck, not capture** (1,580+ extractions and a 5,400-concept graph had
produced only 19 hypotheses). Finish the loop wave before starting next-wave
phases.

## 1. Knowledge-loop wave — the active work (execute in gate order)

From [2026-07-07-00-loop-master-sequence.md](./2026-07-07-00-loop-master-sequence.md).
Plans 01–03 carry `> Landed:` headers and are archived; do not re-implement.

| # | Plan | Status |
|---|------|--------|
| 01 | [Claims become first-class rows](../archive/plan-waves/2026-07-07-01-loop-claims-table.md) | ✅ Landed `b2e0cbe` (4,648 claims backfilled) — archived |
| 02 | [Concept domains + mission relevance](../archive/plan-waves/2026-07-07-02-loop-domains-and-relevance.md) | ✅ Landed `03dce57` (5,444/5,444 classified) — archived |
| 03 | [Correspondences table + agent write surface](../archive/plan-waves/2026-07-07-03-loop-correspondences.md) | ✅ Landed `2adca48` (live-gated) — archived |
| 04 | [Embeddings + vector indexes](./2026-07-07-04-loop-embeddings.md) | ✅ Merged 2026-07-20 (PR #28) — deploy + `OPENAI_API_KEY` + backfill/probe operator-gated |
| 12 | [Domain triage surface](./2026-07-18-12-domain-triage-surface.md) | ✅ Merged 2026-07-20 (PR #29) — deploy + packet decision (Keith/DA) operator-gated |
| 05 | [Candidate generator + miner & evidence-hunter graphs](./2026-07-07-05-loop-miner-graphs.md) | ✅ Merged 2026-07-20 (PR #31) — live-run gates + **Proxmox worker healthy** operator-gated |
| 06 | [Drafting graph + WIP cap (N=3)](./2026-07-07-06-loop-drafting-graph.md) | ✅ Merged 2026-07-20 (PR #32) — live gate (first real draft reviewed) operator-gated |
| 07 | [Review UX + edit-before-approve](./2026-07-07-07-loop-review-ux.md) | ✅ Merged 2026-07-20 (PR #33) — Interceptor screenshots + timed <2min gate (Keith) operator-gated |
| 13 | [Recipe loop closure](./2026-07-18-13-recipe-loop-closure.md) | ⬅️ **NEXT** — blocked on golden-dataset ratification (Keith, §2 item 1; DA prep done) |
| 08 | [Weekly brief integration](./2026-07-07-08-loop-weekly-brief.md) | ✅ Merged 2026-07-20 (PR #34) — real-brief live gate operator-gated |
| 09 | [Source scout](./2026-07-07-09-loop-source-scout.md) | ✅ Merged 2026-07-20 (PR #35) — `TAVILY_API_KEY` + first live run operator-gated |
| 14 | [Decision-surface sweep](./2026-07-18-14-decision-surface-sweep.md) (card-level) | ✅ Merged 2026-07-21 (PR #36) — Interceptor passes operator-gated |
| 10 | [Composition starter kits](./2026-07-07-10-loop-starter-kits.md) | ✅ Merged 2026-07-20 (PR #30) — 3-real-recipe run + studio acceptance (Keith) operator-gated |
| 11 | Self-render spike (bounded) | Deferred to a Keith/DA studio session (needs audio engine install, real kits, human A/B listening) |

After 11: **generator steering** (model/prompt/scope knobs in the UI) is the next roadmapped item —
deferred by the 2026-07-18 decision, not dropped.

## 2. Unblock in parallel — operator items (ownership updated 2026-07-18)

Small; none block the loop wave start but several gate-specific plans.

1. **Golden eval datasets — DA-prepared, Keith-ratified.** The DA pre-ranks and
   annotates `data/eval/*-candidates.jsonl` (keep/swap + one-line rationale);
   Keith does a single accept/reject pass (~30 min) producing
   `extractions/hypotheses/weekly-briefs-golden.jsonl` (targets ≥15/≥15/≥6).
   Scheduled **before plan 13 (recipe loop closure) starts**; sole blocker for
   [`plans/008`](../../plans/008-eval-baseline-sweep.md).
2. **Domain triage** — now carded as
   [plan 12](./2026-07-18-12-domain-triage-surface.md): the packet is decided
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
- Improve-skill wave ledger (008 still open): [`plans/README.md`](../../plans/README.md)
- Living operating docs (not plans): vision-and-meaning, loop-spec-v1.1,
  cadence-and-operating-rules, schema, agent-tool-surface, eval-baselines,
  langsmith-runbook, parameter-extraction, metrics-and-dissonance.
