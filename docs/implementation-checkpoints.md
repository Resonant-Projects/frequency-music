# Implementation Checkpoints

## Scope of This Document

This document translates the meaning roadmap into implementation-facing checkpoints. It is not a sprint backlog. It is the bridge between strategy and execution for the current codebase:

- Convex backend in `convex/`
- Solid app routes in `web/src/routes/`
- operating docs in `docs/`

Read this alongside:

- [vision-and-meaning.md](./vision-and-meaning.md)
- [meaning-roadmap.md](./meaning-roadmap.md)
- [loop-spec-v1.1.md](./loop-spec-v1.1.md)
- [schema.md](./schema.md)

## Phase-by-Phase Checkpoints

### Phase 1: Rigor and Interpretation

Status:
- Phase 1A is landed in the current codebase: `whyThisMatters` on hypotheses and recipes, richer listening-session language, and weekly-brief / generation prompt support.
- Phase 1B completes the remaining foundation: lightweight theses, claim-level confidence-vs-interest metadata, composition revision discipline, and UI/doc parity.

#### Backend and schema

- add a `theses` table
- add `thesisId` to hypotheses
- add claim-level extraction metadata to distinguish interest from truth confidence
- add revision metadata for compositions before lineage work
- keep all new Phase 1B fields backward-compatible and optional where migration would add unnecessary churn

#### Query and API

- query active theses
- query hypotheses grouped by thesis
- return listening-session embodied metadata in existing composition/listening flows
- return truth/interest metadata in extraction and source review flows
- include linked thesis data in hypothesis detail responses

#### UI and workflow

- hypothesis create/detail flow includes `why this matters`
- recipe detail surfaces include `why this matters`
- feedback flow captures body-map tags, felt qualities, standout moments, and expandability
- hypothesis workflow can optionally attach a thesis
- composition update flow prompts for what changed when revising

#### AI prompt and generation

- weekly brief prompt includes why a selected experiment matters
- hypothesis generation prompt should bias toward testable stakes, not only interesting connections
- recipe generation prompt should preserve the link between stake and musical implementation

#### Documentation

- update roadmap docs if field names or phase boundaries change
- note any terminology changes in the decision log

#### Test expectations

- creating a hypothesis still works with or without thesis linkage
- listening session validates expandability range
- revision flows cannot silently mutate multiple variables without recording the revision note
- extraction/source displays can distinguish creative fertility from evidential confidence

### Phase 2: Represent Accumulated Learning

#### Backend and schema

- add lineage queries joining sources, extractions, hypotheses, recipes, compositions, and listening sessions
- add failure archive query logic based on contradiction, retirement, or repeated low-yield outcomes
- add graph-derived editorial signals using current concepts and edges data

#### Query and API

- `compositions.getLineage(id)` style query
- thesis detail query with children
- failure archive query with filters by reason, thesis, or campaign later
- graph summary query that returns high-yield and low-yield concept clusters

#### UI and workflow

- composition detail or new lineage surface
- failure archive view
- graph sidebar or dashboard signals that influence decisions
- weekly brief surfaces link to active theses and notable contradictions

#### AI prompt and generation

- weekly brief generation should include recent failures and active theses
- summary prompts should mention when an experiment contradicts prior work

#### Documentation

- update checkpoints when lineage query shapes settle
- log decisions about what counts as a "failure" vs "revisit later"

#### Test expectations

- lineage view resolves correct ancestry
- contradicted items appear in the archive
- graph signals do not surface private/public content incorrectly if visibility is applied later

### Phase 3: Tighten the Studio Loop

#### Backend and schema

- add `campaigns` table
- link weekly briefs and theses to campaigns
- optionally store studio prompts on weekly briefs or a related structure

#### Query and API

- campaign list/detail queries
- weekly brief query includes studio prompts and active campaign context
- query for next recommended actions based on expandability and recent outcomes

#### UI and workflow

- campaign creation and overview surface
- weekly brief UI adds short-form studio prompt modes
- app surfaces should help move from brief -> recipe -> composition without losing context

#### AI prompt and generation

- weekly brief generation includes active campaign context
- add prompt modes for:
  - 10-minute prompt
  - 30-minute prompt
  - 90-minute prompt

#### Documentation

- add campaign guidance once the shape is stable
- log decisions about campaign scope and completion rules

#### Test expectations

- weekly brief can render short-form studio prompts
- campaigns can organize multiple hypotheses or briefs
- recommendation logic does not ignore recent negative evidence

### Phase 4: Strengthen Public Narrative

#### Backend and schema

- extend visibility and publishing workflows for thesis summaries, campaign summaries, or recap artifacts if needed
- do not expose raw private material by default

#### Query and API

- public-safe summary queries
- recap-oriented content projection queries if needed

#### UI and workflow

- publishing surfaces for:
  - experiment recap
  - what changed my mind
  - campaign summary
- public-safe visibility review before publish

#### AI prompt and generation

- prompts for recap and reflection formats
- public-facing summaries should clearly signal uncertainty and evidence level

#### Documentation

- document editorial formats and review criteria
- log any shift in public publishing doctrine

#### Test expectations

- public output never overstates evidence
- publishing workflow cannot accidentally expose private raw inputs
- recap formats consistently include what was tried, what changed, and why it matters

## Data Model Changes

### New or expanded records

- `theses`
- `campaigns`
- expanded `hypotheses`
- expanded `recipes`
- expanded `listeningSessions`
- expanded `compositions`
- possibly expanded `weeklyBriefs`
- possibly expanded `sources` or `extractions`

### Recommended field directions

#### `theses`
- `title`
- `statement`
- `descriptionMd`
- `status`
- `createdAt`
- `updatedAt`

#### `hypotheses`
- `thesisId?`
- `whyThisMatters`

#### `recipes`
- `whyThisMatters`
- `singleVariableFocus?`

#### `compositions`
- `revisionParentId?`
- `revisionVariable?`
- `diffNote?`

#### `listeningSessions`
- `expandability`
- `bodyMapTags?`
- `feltQualities?`
- `standoutMoments?`

#### `sources` or `extractions`
- `interestLevel?`
- `truthConfidence?`

#### `campaigns`
- `title`
- `question`
- `descriptionMd`
- `status`
- `thesisIds`
- `startedAt?`
- `endedAt?`
- `summaryMd?`

## Query and API Changes

Recommended additions:

- thesis list/detail queries
- thesis-linked hypothesis queries
- composition lineage query
- failure archive query
- embodied listening aggregation query
- graph editorial-signals query
- campaign list/detail queries
- weekly brief query that returns prompt variants and campaign context

Recommended constraints:

- reuse existing visibility model where possible
- avoid creating separate public tables unless projection queries become necessary
- prefer additive query surfaces over rewiring current route contracts all at once

## UI Changes

### Likely route touch points

- `web/src/routes/hypotheses.tsx`
- `web/src/routes/hypothesis-detail.tsx`
- `web/src/routes/recipes.tsx`
- `web/src/routes/recipe-detail.tsx`
- `web/src/routes/compositions.tsx`
- `web/src/routes/feedback.tsx`
- `web/src/routes/weekly-turns.tsx`
- `web/src/routes/weekly-brief-detail.tsx`
- `web/src/routes/zodiac-3d.tsx`

### New or expanded surfaces

- thesis index/detail
- composition lineage view
- failure archive view
- campaign surfaces
- better brief actions and prompt variants

### Interaction design principles

- keep new structured fields lightweight
- preserve current flow speed
- do not require long-form writing everywhere
- use guided labels and helpers for embodied vocabulary

## Content and Prompt Changes

Update prompts and generation logic so they:

- carry forward `why this matters`
- include active thesis context
- note recent failures and contradictions
- distinguish evidence-backed claims from inspirational-only material
- generate short-form studio prompts in addition to weekly briefs
- generate public recap/reflection formats later without overstating certainty

Likely files:

- `convex/weeklyBriefs.ts`
- hypothesis and recipe generation modules if present
- related prompt templates in `prompts/` if they are the source of truth

## Test Scenarios

### Phase 1
- create hypothesis with stake
- create listening session with embodied fields
- revise composition and record changed variable
- view truth vs interest distinction on source/extraction data

### Phase 2
- open lineage for a composition
- find a contradicted idea in the failure archive
- use graph signals to identify a high-yield concept area

### Phase 3
- generate a 10/30/90-minute studio prompt
- connect a brief to an active campaign
- use campaign context to steer next experiment

### Phase 4
- draft a recap with clear uncertainty language
- publish only public-safe material
- generate a "what changed my mind" artifact tied to actual contradictions

## Acceptance Criteria

### Phase 1
- new data captured is richer and more comparable than current state
- artistic stakes are explicit in core experiment objects
- evidence and inspiration are no longer flattened together

### Phase 2
- the product can explain where an artifact came from
- failed paths are visible and reusable
- graph outputs influence decisions

### Phase 3
- the system can steer short-form studio sessions
- work can accumulate under larger themes without losing weekly cadence

### Phase 4
- the project can publish recurring reflections without inventing them from scratch each time
- public narrative tracks actual learning quality

## Definition of Done by Phase

### Phase 1 done means

- new meaning-critical fields exist in schema and validators
- the hypothesis, recipe, composition, and feedback flows can capture those fields
- weekly brief generation can see artistic stakes where available
- related docs reflect the new semantics

### Phase 2 done means

- lineage is visible in at least one artifact flow
- failed paths are inspectable as structured knowledge
- graph outputs expose decision-support signals rather than only navigation detail

### Phase 3 done means

- campaigns exist as a usable organizing layer
- weekly briefs can incorporate campaign context
- short-form studio prompts are available in the app

### Phase 4 done means

- at least one recap-style publishing flow exists
- public-safe projections preserve uncertainty and visibility constraints
- recurring public synthesis no longer depends on manual reconstruction of context

## Deferred Items

These items are intentionally out of scope for the first roadmap pass:

- a dedicated failure table before derived archive views prove insufficient
- advanced graph scoring beyond basic editorial usefulness
- broad redesign of the Zodiac interaction model
- campaign-specific standalone docs before campaigns are active in the product
- public essay workflow changes unrelated to the roadmap’s structured recap needs

## Definition of Done by Phase

### Phase 1 done
When new hypotheses, recipes, compositions, and listening sessions capture stakes, richer felt response, and comparable revisions in the live app.

### Phase 2 done
When the product can show ancestry, contradiction, and concept-level signals clearly enough to affect what gets worked on next.

### Phase 3 done
When the weekly system produces actionable studio prompts and campaigns organize work over multiple weeks.

### Phase 4 done
When public publishing flows can present selected findings with rigor, uncertainty, and continuity.

## Deferred Items

These should remain deferred until the earlier phases land:

- complex graph visualization redesign
- deep public thesis browser
- advanced scoring formulas for concept yield
- full analytics dashboarding for campaigns
- broad public exposure of raw source materials
