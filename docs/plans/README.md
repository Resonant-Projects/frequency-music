# Plans — What Remains, In Order

> Last full audit: 2026-07-15 (see [plan-status-report-2026-07-15.md](../plan-status-report-2026-07-15.md)).
> Last planning session: 2026-07-18 (decision surfaces — see the decision-log entry of that date).
> Completed waves live in [docs/archive/](../archive/README.md). Decision history: [decision-log.md](../decision-log.md).

## Where things stand

Every plan wave before the knowledge loop is **done**: the MVP (`planning/`,
archived), the 2026-07-01 agent-system wave, the 2026-07-03 architecture wave,
and the 2026-07-07 improve-skill audit plans (except 008). The meaning roadmap
Phases 1–4 are implemented. The active frontier is the **2026-07-07 knowledge-loop
wave**, of which plans 01–03 are landed and live.

The sequencing rule, per the 2026-07-07 decision-log entry: **synthesis is the
bottleneck, not capture** (1,580+ extractions and a 5,400-concept graph had
produced only 19 hypotheses). Finish the loop wave before starting next-wave
phases.

## 1. Knowledge-loop wave — the active work (execute in gate order)

From [2026-07-07-00-loop-master-sequence.md](./2026-07-07-00-loop-master-sequence.md).
Plans 01–03 carry `> Landed:` headers; do not re-implement.

| # | Plan | Status |
|---|------|--------|
| 01 | Claims become first-class rows | ✅ Landed `b2e0cbe` (4,648 claims backfilled) |
| 02 | Concept domains + mission relevance | ✅ Landed `03dce57` (5,444/5,444 classified) |
| 03 | Correspondences table + agent write surface | ✅ Landed `2adca48` (live-gated) |
| 04 | **Embeddings + vector indexes** | ⬅️ **NEXT** (prereqs 01+02 satisfied) |
| 12 | [Domain triage surface](./2026-07-18-12-domain-triage-surface.md) | Pending — **parallel to 04, must land before 05** |
| 05 | Candidate generator + miner & evidence-hunter graphs | Pending (needs 03+04+12; gate: Proxmox worker healthy) |
| 06 | Drafting graph + WIP cap (N=3) | Pending |
| 07 | Review UX — **amended 2026-07-18**: edit-before-approve added | Pending |
| 13 | [Recipe loop closure](./2026-07-18-13-recipe-loop-closure.md) | Pending (after 07; golden datasets curated first) |
| 08 | Weekly brief integration | Pending |
| 09 | Source scout | Pending |
| 14 | [Decision-surface sweep](./2026-07-18-14-decision-surface-sweep.md) (card-level) | Pending (after 08/09) |
| 10 | Composition starter kits | Pending (independent — pull forward any time) |
| 11 | Self-render spike (bounded) | Pending (spike framing reaffirmed 2026-07-18) |

After 11: **generator steering** (model/prompt/scope knobs in the UI) is the next roadmapped item —
deferred by the 2026-07-18 decision, not dropped.

## 2. Unblock in parallel — operator items (ownership updated 2026-07-18)

Small; none block the loop wave start but several gate specific plans.

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
  code in `scripts/spike-recipe-export.ts`) into Convex; add `.kbm`/MIDI seeds.
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
