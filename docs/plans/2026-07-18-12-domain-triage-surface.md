# 12 — Domain Triage Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps track progress.
> **Sequencing:** parallel to plan 04 (embeddings) — touches the vocabulary registry, not embeddings. **Must land before plan 05** so the miner filters on a curated registry.
> **Origin:** 2026-07-18 decision-log entry (Decision Surfaces). Vocabulary: `CONTEXT.md` → Domain Triage.

## Executor brief

- Make domain triage **executable**: today the triage packet
  ([docs/review/domain-triage-2026-07-12.md](../review/domain-triage-2026-07-12.md) — 49 provisional
  concept domains, 19 parameter kinds, 126 relationship kinds) has Promote/Merge/Reject columns and no
  backing mutations. Decisions parked in markdown don't happen; decisions with buttons do.
- Build the per-entry triage mutations plus a minimal UI, then **decide the packet through the new
  surface** (operator step at the end).
- Triage is recurring, not one-off: the classifier keeps minting provisional entries as sources arrive.

**Why:** plan 05's candidate generator filters on domain membership and mission relevance. Mining
against an uncurated registry (34 of 49 provisional domains are near-synonym merges, 13 are
off-mission rejects) bakes junk provenance into correspondences that later triage can't cleanly undo.

**Tech stack:** Convex mutations in `convex/vocabulary.ts` (registry tables: `conceptDomains` at
`convex/schema.ts:788`, plus parameter-kind and relationship-kind tables per found state); existing
`vocabulary:triageBoard` query as the implemented UI read side (`vocabulary:reviewSummary` remains
untouched for compatibility); SolidJS route in `web/src/routes/` per the project design language
(violet chips for domains; gold only on the decide actions).

## Global constraints

- `bunx convex codegen|dev|deploy` — and equally `vpx convex codegen|dev|deploy` / `vpx convex run`
  — contact the LIVE backend; sequence commits so no broken intermediate state pushes; deploys stay
  operator-gated.
- Registry maturity axis is `known / provisional / experimental / deprecated` — triage moves entries
  along it; nothing is hard-deleted.
- Existing seed paths stay: `seedMissionConceptDomains` and `scripts/seed-concept-domains.ts` remain
  the bulk-seed path; the new mutations are the per-entry decision path.

## Non-goals / rabbit holes

- **No** taxonomy redesign; the registry schema stays as found (plus at most a `mergedInto` field).
- **No** classifier changes — this plan curates output, it does not tune the producer.
- **No** correspondence re-scoring on merge in this plan; log affected counts, leave re-scoring to
  the miner wave.

---

### Task 1: Triage mutations

**Files:** `convex/vocabulary.ts`, `convex/schema.ts` (if `mergedInto`/decision fields are added),
harness tests.

**Interfaces (binding):** three human mutations, each list-aware
(`list: "conceptDomain" | "parameterKind" | "relationshipKind"`), each recording
`decidedAt`/`decidedBy` and a short optional note. Common contract: caller must be
an authenticated operator (Clerk identity, or `devBypassSecret` under the standing
`AUTH_BYPASS_ENABLED` service-identity model) with `decidedBy` derived server-side
from the auth context, never caller-supplied; the source entry must be **currently
provisional and belong to the named list** at transaction time — decided (known/
deprecated/merged) or wrong-list sources reject, making repeated and stale
operations safe. Tests cover unauthorized callers and stale/repeated decisions:

- `vocabulary.promoteEntry { list, entryId, note? }` — provisional → `known`.
- `vocabulary.rejectEntry { list, entryId, note? }` — provisional → `deprecated`; concepts keep their
  membership rows but deprecated domains are excluded from mining filters (verify the miner-facing
  read path honors this).
- `vocabulary.mergeEntry { list, sourceEntryId, targetEntryId, note? }` — remap references from
  source to target (concept domain memberships / parameter-kind uses / relationship-kind uses per
  list), then mark source `deprecated` with `mergedInto: targetId`. Same-entry merge rejected;
  merging into a non-`known` target rejected. **Semantics (binding):** the whole merge runs in ONE
  Convex mutation (transactional by runtime guarantee — remap + deprecate commit together or not at
  all); a reference that already carries the target is deduplicated, not doubled; a zero-reference
  merge still deprecates the source; repeating an identical merge is a no-op (source already
  `mergedInto` target ⇒ return success without re-remapping).

**Merge fallback (pre-agreed):** if reference remapping for a list turns out to be genuinely
hairy (e.g. relationship kinds embedded in edge rows beyond a simple field), keep `promoteEntry` +
`rejectEntry` mutations for that list and cover its merges with a one-shot assisted script under
`scripts/` — record which path was taken in the PR.

Implemented merge paths: concept-domain primary memberships remap inline through the `by_domain`
index up to 2,000 matches; oversized primary sets and secondary-only membership arrays use
`scripts/merge-vocabulary-references.ts` in bounded batches before finalization. Parameter-kind
registry merges are inline while extraction references use the same fallback script; relationship
kinds remap inline through 2,000 edges, with the fallback script for larger sets.

- [x] **Step 1:** Harness tests first (promote/reject/merge happy paths; merge remap count asserted;
  same-entry and non-known-target rejections; duplicate-membership dedupe on merge; zero-reference
  merge still deprecates; repeated identical merge is an idempotent no-op; deprecated exclusion from
  the mining read path).
- [x] **Step 2a:** Implement; commit. (Implementation and local commits complete; `_generated`
  registration hand-edited in generated style because executor constraints prohibit commands that
  contact the live backend.)
- [ ] **Step 2b:** Operator-gated: run Convex codegen/deploy against the live backend and confirm
  the generated API matches.

---

### Task 2: Triage UI

**Files:** create `web/src/routes/vocabulary-triage.tsx` (+ route registration per found router
state); the implemented UI read side is `vocabulary:triageBoard`, while
`vocabulary:reviewSummary` remains untouched for compatibility.

**Layout contract:** three sections (concept domains / parameter kinds / relationship kinds), each a
list of provisional entries showing: name, description/example mentions, mention count, and — for
merge — a target picker constrained to `known` entries of the same list. Per-row actions:
**Promote · Merge → · Reject** (gold on the confirm action only). Decided entries drop out of the
list live (Convex reactivity). Headline shows remaining-provisional counts per list so triage debt is
visible the way review debt is on the draft queue.

- [x] **Step 1:** Implement against the prompt-authorized `triageBoard` read side;
  `vp run typecheck:web`.
- [ ] **Step 2:** Interceptor visual pass (desktop + one phone viewport); screenshots in PR; commit.

Interceptor visual verification stays unticked because it is operator/deploy-gated for this task.

---

### Task 3: Decide the 2026-07-12 packet (operator step)

- [ ] **Step 1:** Keith (or DA-assisted session) walks the packet's recommendations through the new
  surface. The packet document gets a header note marking it decided-with-date and pointing at the
  registry as the source of truth thereafter. **Completion is scoped to the packet snapshot** (the
  entries listed in the 2026-07-12 doc): provisional entries minted after that cutoff are ordinary
  new triage debt surfaced by the route's headline counts, not blockers on this plan's done-gate.
- [ ] **Step 2:** Spot-check gate: compatibility query `reviewSummary` (which lists ALL current
  provisional entries, not just the snapshot) is checked against the packet-snapshot list — the gate
  passes when **no packet-snapshot entry** remains provisional on any of the three lists;
  provisional entries minted after the 2026-07-12 cutoff may legitimately appear in the output and
  are not blockers. Miner-facing domain filter excludes deprecated entries;
  `vpx convex run vocabulary:reviewSummary '{}'` output attached to the PR.

Packet decisions and the live-backend spot check stay unticked because they are operator/deploy-gated.

## Done means

- Per-entry promote/reject/merge mutations exist with harness coverage (or documented merge-fallback
  for a specific list); nothing hard-deletes.
- A triage route renders all three provisional lists and can decide entries end-to-end.
- The 2026-07-12 packet is decided through the surface; provisional counts at zero across all three
  lists; packet doc annotated.
