# 14 — Decision-Surface Sweep — Implementation Plan (card-level)

> **For agentic workers:** card-level plan — each item is small and independent; expand to checkbox
> detail at execution time against found state.
> **Sequencing:** after plans 08/09 — none of these block the loop; they close the audited long tail
> of human decisions that exist as mutations but have no UI, or exist nowhere.
> **Origin:** 2026-07-18 decision-log entry (Decision Surfaces), grounded in the 2026-07-18 UI
> decision-surface audit.

## Executor brief

The 2026-07-18 audit mapped every human decision point in the backend against UI reachability. The
loop-critical gaps went to plans 07 (amended), 12, and 13. This sweep closes the rest. Items, in
recommended order:

1. **Correspondence adjudication view.** `correspondences.setStatus` (confirm/retire/override),
   `upsertConjecture`, and `addEvidence` are CLI-only ("the only manual surface until plan 07's
   UI" — this is that UI, kept out of plan 07 to protect its <2-minute gate). A correspondence
   list + detail route with lifecycle actions and evidence display. Becomes urgent as soon as the
   miner (05) produces volume.
2. **Weekly-brief edit + publish.** `weeklyBriefs.editBrief` and `publish` have no UI (only
   `publishToNotion` is wired). Add both to `weekly-brief-detail.tsx`.
3. **Draft supersede.** `agentDrafts.supersede` is unwired. Pending the visual-plan open question:
   recommended as a decide-bar overflow action on the plan-07 card.
4. **Extraction correction.** `extractions.editExtraction` is CLI-only; surface it from the source
   detail per found state, with the same field-diff provenance discipline as other edits.
5. **Listening-session visibility + composition delete.** `listening.updateVisibility`,
   `compositions.deleteById` — small admin affordances, lowest priority.

## Global constraints

- Presentation + wiring of **existing** mutations only; the only new mutation surface allowed is
  what item 1 needs for list/detail reads. No new decision semantics anywhere in this sweep.
- Per item: typecheck green, Interceptor visual pass, screenshots in PR.

## Non-goals

- Generator steering (deferred by decision log — next after this sweep).
- Correspondence *browsing/graph exploration* beyond the adjudication list + detail (its own future
  wave).
- Domain triage (plan 12), recipe surfaces (plan 13), draft amendment (plan 07).

## Done means

- Every human decision mutation identified by the 2026-07-18 audit is UI-reachable or explicitly
  recorded here as intentionally CLI-only.
- Correspondence lifecycle decisions happen in the web app with evidence on-screen.
