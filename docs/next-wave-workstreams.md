# Next-Wave Workstreams

## How to use this document

This is the implementation catalog for the next major Frequency Music improvements. Each workstream captures:

- the problem it solves
- the main deliverable
- the key implementation tasks
- important dependencies
- the success criteria

Use this document as the reference layer for future specs, issues, and execution plans.

## 1. Autonomous ingest

Problem:

- the app still depends on manually pasted article text or transcripts for many source types

Deliverable:

- URL, RSS, YouTube, and PDF sources can automatically move from ingest to extraction-ready

Key tasks:

- add readable text fetch for URL/RSS
- add transcript fetch for YouTube
- add PDF text extraction
- store fetch/extract attempt metadata
- expose retry and blocked-state actions in the UI

Depends on:

- existing `sources`, HTTP ingest, and workflow infrastructure

Success criteria:

- manual text paste becomes optional rather than expected

## 2. Workflow operations surface

Problem:

- workflow IDs exist but operational state is mostly invisible

Deliverable:

- app surfaces for queued, running, failed, retried, and completed jobs

Key tasks:

- persist user-facing job metadata
- add workflow status query surfaces
- show per-source and per-batch job states
- expose retry/cancel where appropriate

Depends on:

- durable workflows already in `convex/workflows.ts`

Success criteria:

- users can tell whether automation is working without checking logs

## 3. Canonical parameter schema

Problem:

- current parameter records are flexible but too loose for automation and comparison

Deliverable:

- typed canonical parameter contract with normalized units and aliases

Key tasks:

- define canonical parameter families
- add normalized numeric/unit fields where possible
- keep raw extracted text alongside canonical values
- define alias and coercion rules
- migrate registry review from passive to governed

Depends on:

- current extraction parameter model and vocabulary tables

Success criteria:

- exported and internal consumers can trust parameter structure programmatically

## 4. Parameter actionability layer

Problem:

- a parameter being mentioned in a source does not mean it should become a DAW control

Deliverable:

- a layer that marks parameters as observed, inferred, recommended, or directly controllable

Key tasks:

- add actionability flags
- define control ranges and defaults
- represent uncertainty explicitly
- separate descriptive metadata from performance controls

Depends on:

- canonical parameter schema

Success criteria:

- recipes can expose a clean set of usable controls instead of dumping all extracted values

## 5. First-class experiment protocol model

Problem:

- protocol data exists, but experiments are not yet strong first-class operational objects

Deliverable:

- durable experiment model for litmus tests, comparisons, baselines, and repeated trials

Key tasks:

- model experiment identity separately from recipe prose
- store baseline links, conditions, what varies, and what stays constant
- support repeated runs against the same protocol
- connect experiment outcomes back to hypotheses and campaigns

Depends on:

- current recipe protocol structure

Success criteria:

- the system can compare experiments directly rather than inferring structure from markdown

## 6. Structured revision diffs

Problem:

- `revisionVariable` is useful but too free-form

Deliverable:

- machine-readable revision diff model for compositions

Key tasks:

- define changed parameter set
- define unchanged control set
- store rationale for the change
- support branch-level comparison views

Depends on:

- canonical parameter schema
- experiment protocol model

Success criteria:

- revisions become comparable by code and by UI, not only by human memory

## 7. Stable recipe export contract

Problem:

- recipes are mostly prose plus loose parameters

Deliverable:

- `recipe_export_v1` bundle that external tools can consume

Key tasks:

- define JSON shape
- include protocol, control parameters, musical constraints, and assets
- version the format explicitly
- support deterministic regeneration

Depends on:

- canonical parameter schema
- parameter actionability layer

Success criteria:

- external tools never need to scrape markdown to use a recipe

## 8. Generated composition assets

Problem:

- recipes do not yet produce concrete machine-side music artifacts

Deliverable:

- deterministic export bundle with supporting files

Key tasks:

- generate `recipe.json`
- generate `.scl` and `.kbm` when tuning data exists
- generate MIDI seed clips or note scaffolds
- generate automation/macro suggestions
- attach exports to recipes or compositions

Depends on:

- stable recipe export contract

Success criteria:

- at least one recipe can produce files directly useful in a DAW workflow

## 9. Instrument and template mapping

Problem:

- exported ideas remain too generic for actual production setups

Deliverable:

- mapping layer from recipe controls to concrete synths, racks, and templates

Key tasks:

- model target environments
- store template presets and supported control mappings
- support tuning-specific targets
- support fallback mappings when a target is unavailable

Depends on:

- export contract

Success criteria:

- a recipe can say not just what to do, but where to do it in a concrete setup

## 10. OSC/WebSocket bridge

Problem:

- there is no live connector path between the app and external music tools

Deliverable:

- lightweight bridge for real-time control exchange

Key tasks:

- define transport protocol
- expose live session payloads
- support pull and push modes
- test with simple external clients before DAW-specific work

Depends on:

- export contract

Success criteria:

- an external process can receive and apply structured recipe/session data

## 11. Max for Live connector

Problem:

- the strongest early DAW target is missing

Deliverable:

- Max for Live device or companion patch that consumes exported/session data

Key tasks:

- choose the first supported interactions
- load structured recipes
- apply tempo/tuning/control data
- seed clips or macro targets where possible

Depends on:

- OSC/WebSocket bridge or equivalent ingest path
- export contract

Success criteria:

- a recipe can bootstrap a usable Ableton session with materially less manual translation

## 12. Native plugin feasibility path

Problem:

- a full plugin is desirable, but expensive to build prematurely

Deliverable:

- decision-ready feasibility study for VST/AU implementation after the bridge proves value

Key tasks:

- identify minimum plugin behaviors
- define what must remain in-app vs in-plugin
- assess JUCE or equivalent implementation cost

Depends on:

- bridge and export model proving actual utility

Success criteria:

- plugin work starts only with a validated contract and constrained scope

## 13. Studio session launcher

Problem:

- the path from weekly brief or recipe into active making is still fragmented

Deliverable:

- guided “start studio session” flow

Key tasks:

- launch from weekly brief, hypothesis, or recipe
- choose target template/instrument environment
- assemble export bundle
- create or attach a composition record automatically

Depends on:

- export bundle
- instrument/template mapping

Success criteria:

- starting work on an experiment feels like a single action, not a context switch maze

## 14. Artifact registry

Problem:

- compositions have links, but not a strong asset model

Deliverable:

- durable registry for renders, stems, project files, presets, and analysis outputs

Key tasks:

- define asset types and metadata
- store URLs, hashes, versions, and provenance
- connect assets to compositions and experiments

Depends on:

- likely UploadThing or equivalent storage patterns

Success criteria:

- the system can reason about actual produced artifacts, not just notes about them

## 15. Computed audio-analysis pipeline

Problem:

- the loop still leans more on subjective feedback than computed audio descriptors

Deliverable:

- analysis ingestion for rendered audio

Key tasks:

- define which descriptors matter first
- compute them from uploaded renders
- store results on artifact or listening-linked records
- compare measured features against intended protocol changes

Depends on:

- artifact registry

Success criteria:

- the system can compare intended changes to measured sonic changes

## 16. Recommendation memory

Problem:

- the system does not yet learn enough from what actually works for this practice

Deliverable:

- memory layer that ranks useful experiment families and low-yield traps

Key tasks:

- aggregate outcomes by parameter family, protocol type, and campaign
- combine listening outcomes with computed descriptors
- feed recommendations back into weekly and studio surfaces

Depends on:

- stronger experiment model
- audio analysis

Success criteria:

- recommendations become grounded in accumulated studio outcomes

## 17. Vocabulary governance UI

Problem:

- provisional vocabulary can accumulate without enough operational curation

Deliverable:

- UI for reviewing, merging, aliasing, and promoting parameter kinds/domains/relationships

Key tasks:

- review queues
- alias management
- canonical migration rules
- impact preview for merges

Depends on:

- current vocabulary tables

Success criteria:

- schema flexibility remains useful without causing semantic drift

## 18. AI contract tests

Problem:

- AI-generated structures can drift silently even if core code remains unchanged

Deliverable:

- fixture-based contract tests around extraction, hypothesis, recipe, and brief generation outputs

Key tasks:

- add payload fixtures
- add schema invariants
- test parsing and coercion boundaries
- protect export contract stability

Depends on:

- canonical schemas and exports

Success criteria:

- regressions are caught before they damage accumulated data quality

## 19. 3D explorer expansion

Problem:

- the explorer is visually strong but does not yet represent the whole loop

Deliverable:

- full-loop explorer including compositions, listening, failures, campaigns, and editorial artifacts

Key tasks:

- add new node families and relations
- encode yield, failure, and revision states visually
- support campaign- and thesis-level navigation

Depends on:

- richer data surfaces from earlier work

Success criteria:

- the explorer helps answer what happened, what mattered, and what is next

## 20. 2D companion exploration surface

Problem:

- serious analysis needs precision that 3D alone cannot provide

Deliverable:

- filterable 2D graph/table/matrix companion view

Key tasks:

- add search, filters, and pivots
- support relationship inspection and export
- allow switching between graph and structured list modes

Depends on:

- expanded explorer data

Success criteria:

- users can move from evocative browsing to precise analysis without leaving the app

## 21. Better domain and sector scoring

Problem:

- current sector inference is still partly keyword driven

Deliverable:

- graph- and registry-informed scoring model for explorer placement

Key tasks:

- combine canonical domains, edges, and item relationships
- reduce brittle keyword heuristics
- expose confidence and fallback behavior

Depends on:

- vocabulary governance
- expanded graph signals

Success criteria:

- navigation placement reflects learned structure rather than crude token matching

## 22. Yield visualization

Problem:

- high-yield and low-yield signals exist, but are not yet central in navigation

Deliverable:

- visible yield overlays across explorer and dashboard surfaces

Key tasks:

- define yield metrics at concept, thesis, campaign, and parameter-family levels
- show dead zones, high-return zones, and contradiction clusters

Depends on:

- recommendation memory
- richer explorer data

Success criteria:

- the product gets better at helping choose next work

## 23. Auth and visibility hardening

Problem:

- broader automation and connector work increases the cost of accidental exposure

Deliverable:

- tighter access model for operational and public surfaces

Key tasks:

- review intentionally public queries
- harden promotion and export boundaries
- audit connector-facing endpoints

Depends on:

- none, but should complete before broad externalization

Success criteria:

- private research and public exports are cleanly separated under automation pressure

## 24. Public utility and connector-safe narrative

Problem:

- external integrations can amplify uncertainty and ambiguity if the public framing is weak

Deliverable:

- public-safe connector-facing summaries and artifact descriptions

Key tasks:

- distinguish internal control surfaces from public editorial claims
- add explicit confidence and uncertainty framing to external bundles where needed

Depends on:

- export contract
- auth/visibility hardening

Success criteria:

- the system can expose useful artifacts externally without overstating what the project knows
