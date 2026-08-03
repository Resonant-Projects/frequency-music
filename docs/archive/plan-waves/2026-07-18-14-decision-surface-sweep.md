# 14 — Decision-Surface Sweep — Implementation Plan (card-level)

> **Archived 2026-08-03:** implementation merged in PR #36 (`236e6f0`). Remaining visual acceptance is tracked in `docs/plans/README.md`.

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

1. **Correspondence adjudication view.** `correspondences.setStatus` (confirm/retire/override) is
   CLI-only ("the only manual surface until plan 07's UI" — this is that UI, kept out of plan 07 to
   protect its <2-minute gate). A correspondence list + detail route with lifecycle actions and
   evidence display. Becomes urgent as soon as the miner (05) produces volume. Scope note:
   `upsertConjecture` and `addEvidence` stay CLI/agent-side by design — graph enrichment is the
   agents' door per the two-doors doctrine, and human conjecture creation is rare enough that the
   CLI path suffices; this view adjudicates, it does not author.
2. **Weekly-brief edit + publish.** `weeklyBriefs.editBrief` and `publish` have no UI (only
   `publishToNotion` is wired). Add both to `weekly-brief-detail.tsx`.
3. **Draft supersede.** `agentDrafts.supersede` is unwired. Pending the visual-plan open question:
   recommended as a decide-bar overflow action on the plan-07 card.
4. **Extraction correction.** `extractions.editExtraction` is CLI-only; surface it from the source
   detail per found state, with the same field-diff provenance discipline as other edits.
5. **Listening-session visibility + composition delete.** `listening.updateVisibility`,
   `compositions.deleteById` — small admin affordances, lowest priority.

## Execution checklist

- [x] **Correspondence adjudication view.** Reused the bounded
  `correspondences.listByStatus` query (25 rows per lifecycle section), added the list route and
  navigation entry, and wired the existing `correspondences.setStatus` mutation on the existing
  detail route. The required `statusReason` is presented as a decision note; status choices expose
  evidence confirmation, contradiction, retirement, and explicit override to conjectured. No
  authoring UI was added for `upsertConjecture` or `addEvidence`; those remain intentionally
  CLI/agent-side.
- [x] **Weekly-brief edit + publish.** Added an explicit edit mode for `bodyMd`, `todo`, and all
  three studio-prompt variants, including changed-field chips and the existing mutation's
  generated-vs-edited provenance behavior. Wired `weeklyBriefs.publish` behind an in-app publish
  confirmation while preserving `publishToNotion` as a separate existing action.
- [x] **Draft supersede.** Verified the found plan-07 review card already called
  `agentDrafts.supersede` with `draftId`, replacement `byDraftId`, and optional `decisionNote`.
  Moved the signal into a decide-bar overflow menu while preserving its replacement selector and
  explicit confirmation step.
- [x] **Extraction correction.** Found no source-detail route; the full extraction rows render in
  the composition detail provenance section, so the correction affordance lives there. It exposes
  exactly the existing `editExtraction` fields, identifies changed fields before save, and explains
  that the mutation records generated-vs-edited eval provenance.
- [x] **Listening-session visibility + composition delete.** Added an explicit per-session
  visibility selector on composition detail, wired to the existing owner-checked
  `listening.updateVisibility` mutation; sessions not owned by the signed-in user render read-only.
  Added `compositions.deleteById` to the same detail page behind a confirm dialog, with navigation
  back to the composition list after success.

All mutations named by this plan were present in found state; there are no additional not-found or
intentionally CLI-only mutation gaps to record. Correspondence authoring mutations remain
CLI/agent-side by the plan's explicit non-goal.

## Operator-gated verification

- [ ] Interceptor visual pass and PR screenshots for item 1 — operator-gated; no automated
  Interceptor run was performed by this implementation agent.
- [ ] Interceptor visual pass and PR screenshots for item 2 — operator-gated; no automated
  Interceptor run was performed by this implementation agent.
- [ ] Interceptor visual pass and PR screenshots for item 3 — operator-gated; no automated
  Interceptor run was performed by this implementation agent.
- [ ] Interceptor visual pass and PR screenshots for item 4 — operator-gated; no automated
  Interceptor run was performed by this implementation agent.
- [ ] Interceptor visual pass and PR screenshots for item 5 — operator-gated; no automated
  Interceptor run was performed by this implementation agent.

## Global constraints

- Presentation + wiring of **existing** mutations only; the only new backend surface allowed is the
  **query/read** side item 1 needs for its list/detail views. No new decision semantics anywhere in
  this sweep.
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
