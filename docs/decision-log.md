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

## **Decision**

## **Rationale**

## **Alternatives considered**

## **Downstream implications**

## **Revisit trigger**
```

## Initial Foundational Decisions

## 2026-05-16 — LangChain Integration Defaults

**Decision**

- Use LangSmith Cloud for initial tracing and evaluation.
- Self-host the LangGraph Agent Server alongside the existing n8n posture rather than making Convex depend on LangSmith-hosted deployment.
- Treat tracing as best-effort: trace failures should warn and drop, never fail user-facing extraction, hypothesis, recipe, or weekly brief actions.

**Rationale**

- LangSmith Cloud is the fastest path to useful traces and eval datasets.
- The project already separates application infrastructure from research code, and Cool Guy owns deployment. Keeping the agent server self-hosted matches that operating boundary.
- Observability is valuable only if it does not reduce pipeline reliability.

**Alternatives considered**

- Self-host LangSmith immediately.
- Use LangSmith-hosted agent deployment.
- Fail Convex actions when tracing is unavailable.

**Downstream implications**

- The prep work should add env vars for LangSmith and agent tooling, but actual secret values remain deployment configuration.
- Agent server deployment artifacts should be prepared in-repo, then handed to Keith/Cool Guy for hosting.
- LangSmith wrappers must be defensive and no-op cleanly when tracing is disabled or misconfigured.

**Revisit trigger**

- Revisit if data residency requirements change, tracing costs become material, or the self-hosted agent server proves operationally noisy.

## 2026-03-24 — Phase 1B Meaning Foundation

**Decision**

- Keep `theses` lightweight and optional in Phase 1B rather than introducing campaign logic or a dedicated thesis UI.
- Store `truthConfidence` and `interestLevel` on individual extraction claims, not on whole extractions.
- Store `revisionParentId` and `revisionVariable` on compositions now, while full lineage views wait for Phase 2.

**Rationale**

- The project needs a durable meaning layer before adding heavier lineage and editorial graph features.
- Confidence and creative fertility vary claim by claim, so extraction-level metadata would be too blunt.
- Revision metadata is useful immediately for studio discipline even without a full ancestry surface.

**Alternatives considered**

- Defer theses entirely until Phase 2.
- Put "interesting vs true" at the extraction level.
- Wait for a full lineage graph before recording revision intent.

**Downstream implications**

- Hypotheses can be grouped under broader questions without overbuilding taxonomy.
- Review surfaces can distinguish epistemic confidence from compositional usefulness.
- Phase 2 can build lineage and failure/archive views from stored revision metadata instead of backfilling intent later.

**Revisit trigger**

- Revisit if thesis management becomes a daily workflow bottleneck or if claim-level metadata proves too noisy for review.

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

## 2026-03-25 — Phase 2 Derived Failure Rules

**Decision**

- Implement the Phase 2 failure archive as a derived view rather than a dedicated table.
- Use these initial derived reasons:
  - `contradicted_hypothesis`
  - `retired_hypothesis`
  - `archived_recipe`
  - `low_expandability_composition`
  - `repeat_no_expand_composition`

**Rationale**

- Existing hypothesis, recipe, composition, and listening data already carries enough signal to make contradictions and low-yield paths visible.
- A derived archive keeps the first Phase 2 slice additive and avoids premature taxonomy lock-in.

**Alternatives considered**

- Introduce a dedicated `failures` table immediately.
- Limit the archive to explicit contradiction and retirement only.
- Wait to surface low-yield patterns until campaigns exist.

**Downstream implications**

- Weekly briefs can reference recent reversals by stable synthetic keys.
- Composition detail can show derived archive status without new write-time bookkeeping.

**Revisit trigger**

- If the archive becomes noisy, the next step is sharper failure taxonomy, not silent removal.
- Revisit if low-yield composition rules produce too many false positives or if editorial review needs explicit human-confirmed failure categories.

## Deferred Questions

- Whether thesis and campaign records should eventually have direct public-facing representations
- What scoring method should be used for graph yield and experiment prioritization
- How much structure the embodied listening vocabulary should enforce

## 2026-03-26 - Phase 3 brief persistence and campaign activation

**Decision**

- Store 10/30/90-minute studio prompts on each weekly brief at generation time.
- Persist deterministic recommended actions on the brief alongside the narrative markdown.
- Treat campaigns as the current implementation of themes/chapters.
- Enforce a single active campaign at a time.

**Rationale**

- Prompt variants need to remain stable enough to review, compare, and reuse after a weekly turn is generated.
- Recommended actions should not silently drift after the brief is written.
- A single active campaign keeps weekly steering legible and avoids turning campaigns into a backlog taxonomy.
- Using campaigns as the current theme abstraction avoids adding a second organizing table before the first one is proven.

**Alternatives considered**

- Generate studio prompts on demand from current state.
- Allow multiple active campaigns.
- Introduce separate `themes` and `campaigns` tables immediately.

**Downstream implications**

- Weekly brief detail can render persisted studio prompts without recomputing them.
- Campaign activation is now a scheduling/priority choice, not just metadata.
- Thesis detail is responsible for campaign attachment until a broader campaign route becomes necessary.

**Revisit trigger**

- Revisit if weekly briefs need explicit regeneration flows, if parallel campaign work becomes common, or if "theme" semantics diverge from campaign semantics in practice.

## 2026-04-01 — Phase 4 public narrative export contract

**Decision**

- Implement public narrative as curated `editorialArtifacts` inside Frequency Music, then export only approved public artifacts as markdown snapshots via `public_editorial_v1`.
- Keep the app auth-gated and treat Astro as the anonymous public surface.
- Reject repo-metadata loaders as the primary Astro ingestion path for editorial writing.

**Rationale**

- Public narrative needs explicit curation, uncertainty language, and evidence review instead of live joins over mutable internal records.
- Snapshot export prevents accidental leakage if linked private rows later change visibility or content.
- The evaluated repo-metadata loader pattern fits repository listings, not markdown article ingestion from an editorial export.

**Alternatives considered**

- Render public editorial pages directly from Convex at request time.
- Make weekly briefs, theses, or campaigns public by virtue of existing.
- Use a GitHub repository metadata loader as the site’s article source.

**Downstream implications**

- Publishing now requires explicit states: draft -> in review -> approved -> published.
- Public evidence is carried as sanitized cards on the artifact, not reconstructed from private rows at render time.
- Astro content collections should read exported markdown snapshots through a dedicated loader, ideally GitHub-backed with local fallback for smoke tests.

**Revisit trigger**

- Revisit if the public site needs live data instead of snapshots, or if editorial publishing grows into a richer CMS workflow than markdown export can support.

## 2026-04-18 — Next-Wave Sequencing

**Decision**

- Prioritize automation and machine-readable music control surfaces before DAW connectors, explorer expansion, or more advanced analytics.
- Treat native plugin work as a later validation step, not the first connector implementation.
- Keep next-wave roadmap material in `docs/` as an extension of the existing strategic layer.

**Rationale**

- Better ingest automation increases throughput immediately.
- DAW integration will be fragile if recipes and parameters remain prose-heavy or loosely typed.
- Representation work becomes more meaningful after the underlying loop is more automatic and more executable.

**Alternatives considered**

- Start with the 3D explorer expansion because it is highly visible.
- Build a native plugin first and shape the data contract around it later.
- Capture this roadmap only in ad hoc issue notes or chat history.

**Downstream implications**

- Early next-wave work should focus on ingest automation, parameter normalization, experiment structure, and export contracts.
- External connector work should start with a bridge or Max for Live path rather than a native plugin.
- New strategic planning docs for this wave belong in `docs/next-wave-roadmap.md` and `docs/next-wave-workstreams.md`.

**Revisit trigger**

- Revisit if a compelling connector prototype proves that plugin-first work would now accelerate the project more than export and bridge hardening.

## Reversals / What Changed Our Mind

No strategic reversals recorded yet. Add entries here when a prior roadmap or doctrine assumption is intentionally changed rather than merely extended.
