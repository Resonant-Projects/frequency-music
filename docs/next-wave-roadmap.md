# Next-Wave Roadmap

## Purpose

The first four roadmap phases established the meaning layer, lineage, failure memory, campaigns, weekly prompts, and curated public editorial flow. The next wave should not add disconnected features. It should make Frequency Music more automatic, more machine-readable, more studio-actionable, and more legible as an instrument for composition.

This document sequences that work after the currently implemented Phase 1-4 roadmap in [meaning-roadmap.md](./meaning-roadmap.md).

## Core sequencing rule

Build in this order:

1. automate input capture
2. normalize the musical control surface
3. make experiments comparable and executable
4. export the results into external music tools
5. upgrade representation to reflect the richer loop
6. deepen analysis and public utility only after the loop is reliable

That order matters because a DAW connector, richer 3D explorer, or advanced analytics will all be weaker if the system still depends on manual ingest, prose-only recipes, and loosely structured parameters.

## What this wave is trying to fix

Current strengths:

- strong conceptual loop from source -> extraction -> hypothesis -> recipe -> composition -> listening
- durable Convex workflows and graph primitives
- meaningful editorial and failure memory
- a distinctive visual navigation layer

Current gaps:

- ingest is still partly manual
- extracted parameters are not yet strong enough to drive automation safely
- experiments are partly modeled but not yet first-class operational objects
- recipes are mostly human-readable, not machine-readable control surfaces
- external composition tooling has no stable export contract
- the 3D explorer reflects only part of the actual learning loop

## Priority ladder

### Tier 1: Foundation for automation and comparability

These should be built first because they unlock nearly everything else.

1. automatic fetch/transcript/PDF extraction
2. canonical parameter schema and unit normalization
3. structured experiment/protocol model
4. structured composition revision diffs
5. workflow visibility and retry surfaces

### Tier 2: Turn the loop into a control surface

These convert the system from a research memory into a composition engine.

6. parameter-actionability layer
7. stable recipe export contract
8. generated asset outputs (`recipe.json`, `.scl`, `.kbm`, MIDI seeds, automation hints)
9. instrument/template mapping
10. “start studio session” flow

### Tier 3: External connector layer

These make the system useful outside the web app.

11. OSC/WebSocket bridge prototype
12. Max for Live connector
13. plugin-oriented API contract
14. later native plugin work only after the bridge proves the model

### Tier 4: Representation and navigation upgrades

These should follow the stronger data model, not precede it.

15. extend the 3D explorer to compositions, listening, failures, campaigns, editorial artifacts
16. add a precise 2D companion view
17. replace keyword heuristics with graph/domain scoring
18. surface high-yield and low-yield signals directly in navigation

### Tier 5: Analysis, memory, and optimization

These improve judgment once the core loop is executable.

19. artifact registry for stems, renders, project files, and bounce metadata
20. computed audio-analysis pipeline
21. recommendation memory based on actual outcomes
22. vocabulary promotion and migration UI
23. stronger contract tests for AI outputs
24. visibility/auth hardening for broader deployment

## Proposed implementation phases

## Phase A — Autonomous Ingest

Goal:

- every supported source type can move from raw input to `text_ready` or a clear blocked state without manual paste work

Includes:

- readable text fetch for URL/RSS sources
- transcript retrieval for YouTube
- PDF text extraction
- explicit retry and failure reporting
- visible workflow status in the app

Why first:

- without this, the inbox still depends on manual rescue work
- better automation increases throughput immediately

Definition of done:

- inbox actions match real backend capabilities
- a user can submit a URL or YouTube link without pasting content
- blocked items expose exact failure reasons and retry paths

## Phase B — Canonical Music Control Surface

Goal:

- convert extracted and generated music information into a stable, typed, machine-readable schema

Includes:

- canonical parameter registry with aliases and normalization rules
- required unit fields and normalized values
- separation between observed parameters and controllable parameters
- structured experiment/protocol records
- structured revision diff records

Why second:

- external tooling and better automation depend on this layer
- it improves comparison discipline even inside the app

Definition of done:

- the system can say not just “432 Hz” or “Tresillo,” but what field it belongs to, what unit it uses, and whether it is actually controllable
- experiment comparisons can be inspected programmatically

## Phase C — Export and Connector Surface

Goal:

- let recipes leave the app as useful artifacts for composition tools

Includes:

- `recipe_export_v1` contract
- generated scale files and tuning payloads
- MIDI seed generation
- automation and arrangement hints
- instrument/template mapping
- initial OSC/WebSocket bridge

Why third:

- now the machine-readable model exists
- this phase turns the system into a real studio assistant

Definition of done:

- a recipe can produce at least one deterministic machine-readable bundle
- an external tool can consume that bundle without scraping prose

## Phase D — DAW Connector and Session UX

Goal:

- move from export-only to interactive use during composition

Includes:

- Max for Live prototype
- session launch flow in the app
- targeted connector behaviors for tuning, tempo, parameter macros, and clip seeding
- feedback path from composition session back into Frequency Music

Why fourth:

- connector work is lower risk once the export contract is already stable

Definition of done:

- a user can start from a recipe and get real DAW-side scaffolding with minimal manual translation

## Phase E — Representation Upgrade

Goal:

- make the UI reflect the full studio loop and its outcomes

Includes:

- 3D explorer expansion
- 2D graph/table companion
- richer item relations and yield overlays
- clearer campaign and failure navigation

Why fifth:

- better navigation becomes worthwhile after the data model is richer
- avoids building spectacle on weak foundations

Definition of done:

- navigation helps answer “what should I work on next?” and “what did this actually lead to?”

## Phase F — Analysis and Hardening

Goal:

- improve trust, feedback quality, and broader deployability

Includes:

- computed audio-analysis ingestion
- recommendation memory
- contract tests for AI-generated structures
- auth/visibility hardening
- vocabulary governance tools

Why last:

- these improvements compound the earlier work rather than unblock it

Definition of done:

- the system learns from outcomes, is safer to extend, and is less likely to drift structurally over time

## Recommended immediate build order

If work starts now, the first ten projects should be:

1. implement fetch/transcript/PDF actions and wire them into ingest + inbox
2. add workflow status surfaces for queued/running/failed jobs
3. define `parameter_value_v1` and canonical normalization rules
4. define `experiment_protocol_v1` as a first-class model
5. replace free-text `revisionVariable` with structured revision diffs
6. define `recipe_export_v1`
7. generate exported assets from recipes
8. add instrument/template mapping
9. build an OSC/WebSocket bridge prototype
10. extend the 3D/2D explorer with composition + feedback + failure layers

## Things to defer intentionally

- native VST/AU work before the export contract is stable
- advanced visual redesign before navigation exposes the full loop
- sophisticated recommendation logic before enough comparable experiments exist
- public-facing expansion of automation surfaces before auth and visibility are hardened

## Relationship to other docs

- [meaning-roadmap.md](./meaning-roadmap.md) remains the primary strategic roadmap for the first four waves
- this document extends that roadmap into automation, connector, and representation work
- [implementation-checkpoints.md](./implementation-checkpoints.md) should absorb concrete checkpoints from this document as work begins
- [parameter-extraction.md](./parameter-extraction.md) should evolve into the authoritative typed contract for the canonical control surface
