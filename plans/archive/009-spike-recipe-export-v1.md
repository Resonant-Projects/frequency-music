# Plan 009 (spike): Design the `recipe_export_v1` contract and prove it with a deterministic .scl emitter

> **Executor instructions**: This is a DESIGN SPIKE. The deliverables are a
> design document and a small, throwaway-grade prototype that proves the
> contract on real data — NOT production integration, NOT schema changes, NOT
> UI. Timebox mentality: when a question can't be answered from the repo,
> write it into the design doc's "Open questions" section instead of chasing
> it. Follow the steps; on any STOP condition, stop and report. When done,
> update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a30f10c..HEAD -- convex/schema.ts scales/ docs/next-wave-roadmap.md`
> On material drift in the recipe schema, re-read it before designing against it.

## Status

- **Priority**: P3
- **Effort**: M (as a spike)
- **Risk**: LOW (additive artifacts only)
- **Depends on**: none
- **Category**: direction (design spike)
- **Planned at**: commit `a30f10c`, 2026-07-07

## Why this matters

The roadmap names this the pivot that "turns the system into a real studio
assistant": recipes today are prose (`bodyMd`) plus loosely-typed parameters,
so nothing downstream — DAW connectors, Max for Live, OSC bridges — can consume
them without scraping text. `docs/next-wave-roadmap.md` (Phase C) requires "a
recipe can produce at least one deterministic machine-readable bundle" and "an
external tool can consume that bundle without scraping prose." The repo
already hand-authors Scala tuning files in `scales/` — the exact artifact an
exporter would generate. Zero export code exists (verified: repo-wide grep for
`recipe_export` finds nothing). The decided sequencing (decision log
2026-04-18) demands machine-readable control surfaces BEFORE connectors, and
warns that export is only trustworthy after parameter normalization — so this
spike must design the parameter contract and the export together, not just
"emit JSON."

## Current state

- Recipe schema (`convex/schema.ts:527+`): `hypothesisId`, `title`,
  `whyThisMatters?`, `bodyMd` (prose), `parameters: v.array(compositionParameterValidator)`,
  `dawChecklist: v.array(v.string())`, optional `protocol` (studyType
  litmus|comparison, durationSecs, panelPlanned, whatVaries, whatStaysConstant, …).
- The parameter shape is the weak link (`convex/schema.ts:98`):
  ```ts
  export const compositionParameterValidator = v.object({
    kind: v.optional(v.string()),
    type: v.optional(v.string()),
    value: v.string(),          // free text — "432Hz", "60 BPM", "19-EDO"…
    details: v.optional(v.any()),
    registryStatus: v.optional(registryStatusValidator),
    canonicalKind: v.optional(v.string()),
  });
  ```
  Note `canonicalKind`/`registryStatus` — a normalization registry already
  partially exists; find it (grep `canonicalKind` and `registryStatus` across
  `convex/`) and design WITH it, not around it.
- Existing tuning artifacts: `scales/*.scl`, `*.kbm` — Scala format, documented
  in `CLAUDE.md` ("Scala File Format" section): header comment, description,
  note count, then cents values or ratios, `2/1` octave. Exemplar:
  `scales/geometric-temperament.scl` (cents with comments, A=432Hz reference).
- Roadmap requirements to honor (quote them in the design doc):
  - `docs/next-wave-roadmap.md` Phase C "Includes": `recipe_export_v1`
    contract; generated scale files and tuning payloads; MIDI seed generation;
    automation/arrangement hints; instrument/template mapping; OSC/WebSocket
    bridge. (v1 = the contract + scale files; the rest is out of scope here.)
  - First-ten-projects list items 3–7: `parameter_value_v1` + canonical
    normalization rules (item 3) precede `recipe_export_v1` (item 6) and
    generated assets (item 7).
  - Decision log 2026-04-18: "DAW integration will be fragile if recipes and
    parameters remain prose-heavy or loosely typed."
- Vocabulary (`CONTEXT.md`): Recipe = "the experiment protocol that turns a
  hypothesis into concrete composition instructions — parameters, DAW
  checklist, and study protocol." A "Cross-Seam Contract" is "defined once
  under `convex/shared/`; zod-first for payloads" — but `convex/shared/` is
  being CREATED by the arch wave (`docs/plans/2026-07-03-02/-05`). The spike
  therefore keeps its schema in the prototype directory and the design doc
  states the eventual home is `convex/shared/` post-wave.
- Fetch real recipe data (needs `.env.local`):
  `bunx convex run recipes:listByStatus '{"limit": 10}'`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Real recipes | `bunx convex run recipes:listByStatus '{"limit": 10}'` | JSON rows |
| Prototype run | `bun scripts/spike-recipe-export.ts <fixture.json>` | writes .scl + bundle JSON |
| Prototype tests | `bun test scripts/spike-recipe-export.test.ts` | all pass |
| Determinism check | run the emitter twice, `diff` outputs | identical bytes |

## Scope

**In scope** (the only files you should create/modify):
- `docs/recipe-export-v1-design.md` (create — the primary deliverable)
- `scripts/spike-recipe-export.ts` (create — prototype emitter)
- `scripts/spike-recipe-export.test.ts` (create)
- `data/eval/` untouched; a small fixture file
  `scripts/fixtures/recipe-export-sample.json` (create) holding 2–3
  real-ish recipe rows (scrub nothing secret — recipe rows contain no
  credentials, but check before committing).

**Out of scope** (do NOT touch):
- `convex/schema.ts` and ALL of `convex/` — no schema changes in a spike; the
  design doc PROPOSES them.
- `web/**`, `agent/**`.
- MIDI generation, OSC/WebSocket, instrument mapping — later phases; the design
  doc lists them as consumers of the contract, nothing more.
- `scales/*.scl` — read as exemplars; never overwrite.

## Git workflow

- Branch: `advisor/009-spike-recipe-export-v1`
- Conventional commits, e.g. `docs(spike): recipe_export_v1 contract design`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Inventory what parameters actually look like

Pull ~10 real recipes (`recipes:listByStatus`; if no `.env.local`, STOP 1 —
the design must be grounded in real rows, not guesses). Also grep the
normalization surface: `grep -rn "canonicalKind\|registryStatus" convex/ --include='*.ts'`
(find the registry/vocabulary machinery). Tabulate in the design doc: every
distinct `kind`/`canonicalKind` seen, example `value` strings, how many are
parseable as {number+unit}, which are prose.

**Verify**: the design doc has a "Parameter reality" table with ≥8 real examples.

### Step 2: Write the design doc

`docs/recipe-export-v1-design.md`, sections:

1. **Goal & non-goals** — quote the Phase C definition-of-done lines verbatim.
2. **`parameter_value_v1`** — the minimal normalized value model needed for
   export (e.g. `{ canonicalKind, value: { raw: string, number?: number,
   unit?: "Hz"|"BPM"|"cents"|"ratio"|"EDO"|…, } }`), designed around what Step 1
   found and the existing `canonicalKind`/`registryStatus` fields. State the
   normalization rules and what happens to unparseable prose values (they
   export as `raw` only, flagged `lossy: true`).
3. **`recipe_export_v1` bundle** — a versioned JSON envelope:
   `{ contract: "recipe_export_v1", recipeId, title, hypothesisId, generatedAt,
   parameters: parameter_value_v1[], protocol, dawChecklist, assets: [{ type:
   "scl"|"kbm", filename, sha256 }] }` — adjust from real data; every field
   justified in one line. Deterministic: same recipe row → byte-identical
   bundle (no wall-clock timestamps inside assets; `generatedAt` lives only in
   the envelope and is excluded from the determinism check).
4. **.scl emission rules** — when parameters describe a tuning (which
   `canonicalKind`s trigger it; what the note-count/cents lines are computed
   from; A=432 vs 440 reference handling), following the Scala format section
   in `CLAUDE.md` and the style of `scales/geometric-temperament.scl`.
   Explicitly: which recipes CANNOT produce a .scl (no tuning parameters) —
   the bundle then has an empty `assets` list, which is valid.
5. **Eventual integration** — proposed home post-arch-wave (zod schema in
   `convex/shared/`, an export action or script, where files land in
   `exports/`), and what schema changes recipes need (if any) — proposals, not
   commitments.
6. **Open questions** — everything you couldn't resolve from the repo.

**Verify**: doc exists with all six sections; quotes the roadmap lines.

### Step 3: Prototype the emitter

`scripts/spike-recipe-export.ts`: reads a recipe JSON (fixture file or stdin),
applies the normalization rules from the design doc, writes
`<slug>.recipe-export.json` + any `.scl` to a `--out` directory (default
`/tmp` — keep out of the repo). Pure functions for normalize/emit, exported
for tests. It is fine for this to be ~150 lines and inelegant — it exists to
prove the contract, and to be deleted when the real implementation lands.

**Verify**: `bun scripts/spike-recipe-export.ts scripts/fixtures/recipe-export-sample.json --out /tmp/spike-export` → writes bundle (+ .scl when tuning params present).
**Verify**: run twice, `diff -r` the two output dirs → identical (after
excluding the `generatedAt` envelope field per the design's determinism rule —
simplest: make `generatedAt` an optional CLI-injected value and omit it in the
determinism check).

### Step 4: Tests

`scripts/spike-recipe-export.test.ts` (bun:test, model on
`convex/sourceUtils.test.ts`): normalization of each unit class found in Step 1
(Hz, BPM, cents, ratio, EDO, prose-lossy); .scl output for a known tuning
parameter set matches an expected literal block; recipe with no tuning params →
empty assets, valid bundle; determinism (two calls, deep-equal).

**Verify**: `bun test scripts/spike-recipe-export.test.ts` → all pass.

### Step 5: Validate against a hand-authored scale

Emit a .scl whose parameters mirror `scales/geometric-temperament.scl`'s
documented intervals and compare structure (note count line, cents precision,
octave line) — not byte equality (comments will differ), but a Scala-tool-loadable
file. If `scalatool`/`scala` CLI isn't available, verify by structural assert
in the test (line 3 is the note count; last interval is `2/1` or `1200.0`).

**Verify**: structural assertions pass in the test suite.

## Test plan

See Step 4 — the spike's tests ARE its evidence. Plus the determinism diff
(Step 3) and the structural Scala check (Step 5).

## Done criteria

ALL must hold:

- [ ] `docs/recipe-export-v1-design.md` exists, six sections, grounded in ≥8 real parameter examples
- [ ] Prototype emits a bundle for every fixture recipe; deterministic per Step 3
- [ ] `bun test scripts/spike-recipe-export.test.ts` → 0 fail
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated with a one-line pointer to the design doc's Open questions

## STOP conditions

Stop and report back (do not improvise) if:

1. No `.env.local` / cannot fetch real recipes — a contract designed on
   imagined data is the failure mode the decision log warns about.
2. Real recipes have ZERO parseable tuning-ish parameters (all prose) — the
   spike's conclusion is then "normalization must be fixed at generation time
   first"; write that up in the design doc's conclusion and stop before the
   emitter.
3. You find an existing export implementation (someone built it since
   `a30f10c`) — reconcile, don't duplicate.
4. The spike starts wanting schema changes to proceed — that's the boundary;
   propose in the doc, never edit `convex/schema.ts`.

## Maintenance notes

- The follow-up (a real plan, post-spike + post-arch-wave): zod
  `recipeExportV1` in `convex/shared/`, an export surface (action or script),
  `exports/recipes/` output dir, and generation-time parameter normalization
  per the design's `parameter_value_v1`. Wire into the editorial-export
  workflow only if the operator wants exports published.
- Whoever implements MIDI seeds / OSC later consumes the bundle — changes to
  the envelope after v1 ships require a `recipe_export_v2`, not in-place edits
  (the contract is versioned for exactly this reason).
- Delete `scripts/spike-recipe-export*` when the real implementation lands;
  the design doc is the survivor.
