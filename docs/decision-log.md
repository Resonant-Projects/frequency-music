# Decision Log

## How to Use This Log

This log exists to keep the strategic layer of Frequency Music coherent as the project evolves. Use it whenever a roadmap-level or doctrine-level decision is made, changed, deferred, or reversed.

Add entries when:

- a roadmap phase changes meaningfully
- a naming or schema decision affects long-term structure
- a tradeoff is resolved between rigor, embodiment, musicality, or publishing
- a previous assumption is overturned by implementation or real use

Do not use this file for ordinary implementation notes or commit-style changelogs.

## Decision Entry Template

```md
## YYYY-MM-DD — Area

**Decision**
-

**Rationale**
-

**Alternatives considered**
-

**Downstream implications**
-

**Revisit trigger**
-
```

## Initial Foundational Decisions

## 2026-03-24 — Documentation Architecture

**Decision**
- `docs/` is the living strategy and doctrine layer for the project.
- `planning/` remains historical/bootstrap planning context.

**Rationale**
- `docs/` already contains the durable operating truths for the current system: loop spec, cadence rules, schema, metrics, and templates.
- `planning/` reads as MVP-era scaffolding and should not become the main strategic source of truth.

**Alternatives considered**
- Extend `planning/` with the new roadmap material.
- Collapse the new material into a single oversized README.

**Downstream implications**
- New strategic docs should be added in `docs/`.
- README should point to the strategic docs instead of absorbing them.

**Revisit trigger**
- Revisit only if the repo gets a dedicated docs site or another canonical documentation surface.

## 2026-03-24 — Roadmap Bias

**Decision**
- Prioritize research rigor and interpretation before public narrative expansion.

**Rationale**
- Better experiments produce better observations, which produce better public writing.
- Shipping narrative first would risk overclaiming relative to what the system has actually learned.

**Alternatives considered**
- Prioritize public editorial outputs first.
- Prioritize UX polish and representation first.

**Downstream implications**
- Phase 1 work centers on stakes, evidence framing, listening vocabulary, and revision discipline.
- Public publishing features come later in the roadmap.

**Revisit trigger**
- Revisit if the project develops an external audience whose needs materially change sequencing.

## 2026-03-24 — Public Publishing Doctrine

**Decision**
- Public storytelling should follow internal evidence quality and preserve uncertainty explicitly.

**Rationale**
- The project mixes evidence-backed material, speculative inspiration, and artistic intuition.
- Public outputs need to distinguish these clearly to remain trustworthy.

**Alternatives considered**
- Publish exploratory material with lighter framing.
- Treat all compelling internal synthesis as publishable by default.

**Downstream implications**
- Public recap formats should signal confidence and uncertainty.
- Private raw materials remain distinct from public summaries.

**Revisit trigger**
- Revisit if a formal editorial review process is added.

## 2026-03-24 — Graph Product Role

**Decision**
- Graph work must support decisions, not decoration.

**Rationale**
- The product already has a distinctive graph/navigation layer.
- Additional graph complexity is only worthwhile if it helps identify themes, blind spots, or high-yield areas.

**Alternatives considered**
- Expand graph visualization primarily for spectacle or exploration.

**Downstream implications**
- Future graph work should be evaluated on usefulness for choosing next experiments.
- Editorial signals matter more than visual novelty.

**Revisit trigger**
- Revisit if graph-driven navigation becomes the primary user workflow for a broader audience.

## 2026-03-24 — Contradictions and Failures

**Decision**
- Contradictions and failed experiments are first-class signals and should be preserved visibly.

**Rationale**
- The project becomes more cumulative and more honest when negative results remain available for comparison and reflection.

**Alternatives considered**
- Archive failed work quietly.
- Treat contradiction as noise rather than knowledge.

**Downstream implications**
- The roadmap includes a failure archive.
- Weekly and editorial synthesis should account for reversals, not only wins.

**Revisit trigger**
- Revisit if the archive becomes noisy enough that a sharper taxonomy of failure is required.

## Rejected Alternatives

- Treat `planning/` as the main evolving roadmap surface.
- Make graph expansion a first-wave priority without requiring decision support value.
- Lead with public narrative before internal rigor improvements.

## Deferred Questions

- Whether thesis and campaign records should eventually have direct public-facing representations
- Whether studio prompts should be stored persistently or generated on demand
- What scoring method should be used for graph yield and experiment prioritization
- How much structure the embodied listening vocabulary should enforce

## Reversals / What Changed Our Mind

No strategic reversals recorded yet. Add entries here when a prior roadmap or doctrine assumption is intentionally changed rather than merely extended.
