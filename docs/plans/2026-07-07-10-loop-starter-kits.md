# Recipe Starter Kits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps track progress.
> **Found-state rule (wave 2026-07-07):** adapt to found state; interfaces and gates binding. **No prerequisites — safe to run any time, in parallel with the rest of the wave.**

## Executor brief

- Every recipe becomes generatable into its **Starter Kit** (`CONTEXT.md` term): `.scl` + `.kbm` from tuning parameters, a seed MIDI sketch honoring the recipe's constraints, and a parameter card — so studio time starts at "make it sound good," not setup arithmetic.
- CLI-first (`bun run scripts/generate-starter-kit.ts <recipeId>`); pure, unit-tested generation lib; artifacts land in `exports/starter-kits/<recipe-slug>/`.
- This attacks the funnel's welded-shut bottom: 16 recipes, 0 compositions.

**Why (session Q14):** a recipe today is homework. The machine-derivable parts (`scales/*.scl` are currently hand-written — that's automatable arithmetic) become code.

**Tech Stack:** Bun, TypeScript (pure lib + CLI), `@tonejs/midi` (or `midi-file`) for MIDI writing, bun:test. Scala format per the repo's existing `scales/` files and CLAUDE.md's format reference.

## Global Constraints

- Generation is **pure functions first**: `(parameters) → file contents` with the CLI as a thin shell. Tuning math (cents/ratios) is exactly the kind of code that must be unit-tested against known-good values — use the existing hand-written `scales/*.scl` as golden fixtures where the parameters match.
- Never overwrite an existing kit directory without `--force`; kits are regenerable but a musician may have annotated them.
- Parameter vocabulary: consume `compositionParameterValidator` kinds as found (tempo, key, tuningSystem, rootNote, frequency, interval, …). Unknown/missing kinds degrade gracefully: the kit generates what it can and the parameter card lists what it couldn't and why.

## Non-goals / rabbit holes

- **No** audio rendering (plan 11's spike).
- **No** DAW project files (Ableton `.als` etc.) — the seed MIDI + card is the v1 contract.
- **No** new tuning-theory research: support the tuning families the 16 existing recipes and `scales/` actually use (EDOs, JI ratio lists, cents lists, polygon-angle sets per the Grant temperaments). A tuning the parser can't express → card note, not a rabbit hole.
- **No** web UI (link from recipe detail can come later; CLI is the deliverable).

---

### Task 1: Tuning lib — parameters → `.scl`/`.kbm`

**Files:**
- Create: `scripts/lib/tuning.ts` + `scripts/lib/tuning.test.ts`

**Interfaces (binding):**

```typescript
export type TuningSpec =
  | { kind: "edo"; divisions: number }
  | { kind: "ji"; ratios: string[] }                  // ["1/1","9/8",...]
  | { kind: "cents"; values: number[] }
  | { kind: "named"; name: string };                  // resolves against scales/ catalog

export function parseTuningFromParameters(params: CompositionParameter[]): TuningSpec | null;
export function toScl(spec: TuningSpec, description: string): string;   // valid Scala text
export function toKbm(spec: TuningSpec, rootNote?: string): string;     // mapping w/ root
```

- [x] **Step 1:** Golden-fixture tests: an EDO spec reproduces a hand-written `scales/*.scl` byte-for-byte (modulo header comment); JI and cents cases; parse failures return null with reason (typed, not thrown). *(Found-state adaptation: no handwritten EDO fixture exists; the geometric cents scale is golden-tested byte-for-byte modulo comments, with literal EDO and JI cases.)*
- [x] **Step 2:** Implement; tests green; commit.

---

### Task 2: Seed MIDI

**Files:**
- Create: `scripts/lib/seedMidi.ts` + tests

**Contract:** a deliberately minimal sketch — 8–16 bars honoring tempo, root, and scale degrees from the tuning (as a pitch-class palette; standard MIDI notes + a card note explaining the tuning file does the retuning), one simple figure per `rhythm`/`chordProgression` parameter when present. It is scaffolding to audition the tuning, not a composition — resist making it musical.

- [x] **Step 1:** Tests: correct tempo meta, note set ⊆ scale palette, deterministic output for fixed input (no randomness — same recipe, same seed file).
- [x] **Step 2:** Implement; commit.

---

### Task 3: Parameter card + kit assembly CLI

**Files:**
- Create: `scripts/generate-starter-kit.ts`; `scripts/lib/parameterCard.ts`

**Card (markdown):** recipe title + whyThisMatters; hypothesis question (one hop up); parameter table (kind, value, honored-in-kit ✓/— with reason); protocol summary (whatVaries / whatStaysConstant / duration); DAW checklist verbatim; kit manifest.

**CLI:** fetch recipe (ConvexHttpClient per script conventions) → generate all artifacts → write `exports/starter-kits/<slug>/{tuning.scl,tuning.kbm,seed.mid,card.md}` → print summary. `--force` to overwrite. Nonzero exit if *nothing* was generatable (a kit with only a card is a failure, not a kit).

- [ ] **Step 1:** Implement; run against 3 real recipes spanning different tuning kinds.
- [ ] **Step 2:** Commit with the 3 kit summaries in the PR.

---

### Task 4: Recipe row linkage + acceptance

**Files:**
- Modify: `convex/schema.ts` — `recipes.starterKit: v.optional(v.object({ generatedAt: v.number(), path: v.string(), manifest: v.array(v.string()) }))`; CLI patches it on success.

- [ ] **Step 1:** Schema + mirror + CLI patch; codegen; commit.
- [ ] **Step 2: Acceptance (human).** Keith loads one generated `.scl`/`.kbm` into his tuning workflow and opens the seed MIDI in the DAW: files load clean, tuning is audibly the intended system. Result recorded in PR. (This is minutes of studio time, not a session — but only human ears can pass this gate.)

---

## Done means

- Pure lib generates valid `.scl`/`.kbm`/seed MIDI, golden-tested against hand-written scales.
- CLI produces complete kits for ≥3 real recipes; degradation is explicit on the card.
- Recipe rows record their kit; regeneration is safe (`--force` contract).
- Human acceptance: one kit loaded and audibly correct in the real studio.
