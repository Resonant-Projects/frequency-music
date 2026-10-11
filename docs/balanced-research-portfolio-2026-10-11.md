# Balanced research portfolio and discovery expansion

Implemented October 11, 2026, following the approved [source expansion research](source-expansion-research-2026-10-11.md). The canonical selection is [data/balanced-research-portfolio.json](../data/balanced-research-portfolio.json).

## Verified live intake

Canonical intake into `https://convex.resonantprojects.art` created 22 private Sources, skipped two existing Sources, and reported zero failures. A subsequent read of all 24 canonical dedupe keys confirmed their presence and private visibility.

| Research area | Selected units | Newly created | Existing | Captured scope of the selection |
| --- | ---: | ---: | ---: | --- |
| Mathematics | 5 | 5 | 0 | Four full chapter/paper captures, one abstract |
| Wave Physics | 5 | 5 | 0 | Two explanatory pages, one abstract, two URL-only references |
| Music Theory | 5 | 3 | 2 | Two explanatory pages, one new abstract, two existing extracted works |
| Psychoacoustics | 5 | 5 | 0 | Three full articles, two abstracts |
| Geometry | 2 | 2 | 0 | One abstract, one URL-only reference |
| Synthesis | 2 | 2 | 0 | Two substantive DSP chapters |

The 22 new rows comprise 19 `text_ready` Sources and three `ingested` URL-only references. The two skipped works, *Playing Music in Just Intonation* and *Harmony Perception by Periodicity Detection*, already have text and `extracted` status. Their existing text and provenance were preserved. The prepared captures contained 13 full texts and eight explicitly labeled abstracts; two of those abstracts were unnecessary because richer sources already existed.

Each new row records selection area, intended primary domain, work identity, content scope, reuse information, and selection rationale. Captured rows also record provider, capture date, and character count. DSP chapter text was cleaned of leading site navigation and advertising while retaining equations in image alt text. All 21 prepared text captures passed the shared bot-wall and minimum-content checks before intake.

OpenStax resonance/beats and UNSW Chladni remain reference-only because their pages state reuse restrictions that need review before text intake. Other captures retain the verified license or `not_verified`; public access is not a redistribution license. No full article or textbook text is committed in the repository manifest.

Units are not independent works. Smith's three DFT chapters share a work identifier, as do the two physical-audio chapters and the two OpenStax chapters. Domain recommendations in the manifest do not override classification. Imported sources are not a claim-coverage result, and new extraction or reclassification was not manually launched.

## Broader topics and filters

`convex/shared/researchTopics.ts` defines six research areas, musical mechanisms, measured outcomes, foundation queries, and source guidance shared by planning, candidate judging, extraction, and concept classification.

- Mathematics includes Fourier analysis, pitch ratios and logarithms, cyclic rhythms, symmetry, dynamical systems, and information models.
- Wave Physics includes boundary conditions, modes, damping, beating, coupled resonators, room acoustics, and nonlinear vibration.
- Music Theory includes temperament, voice leading, meter, tuning traditions, expectation, and performance practice.
- Psychoacoustics includes critical bands, harmonicity, masking, auditory grouping, spatial hearing, familiarity, and synchronization.
- Geometry includes nodal patterns, tuning lattices, voice-leading spaces, topology, and resonator shape.
- Synthesis includes physical modeling, waveguides, spectral envelopes, modulation, filtering, and spatial rendering.

Useful university chapters, formal results, reproducible DSP methods, practitioner documentation, and negative or contrary evidence can qualify without mentioning music in the title. They need a specific musical mechanism. Incidental speech benchmarks, unrelated ML, and generic software remain off mission. Stability, pleasantness, harmonicity, roughness, familiarity, and therapeutic outcomes stay distinct. Abstracts cannot supply absent methods, and an opinion article cannot establish an empirical finding.

Gap targeting now considers approved core domains even when the sampled on-mission concept count is zero. Eight indexed core-registry lookups supplement the recent-domain scan so a thin core area cannot disappear behind newer domains. Empty provisional, deprecated, and unrelated domains do not become bootstrap targets. Counts remain approximate, with the existing total concept sample and five-domain target cap.

The target cap favors distinct display areas before multiple domains in the same area. Planning ensures one query for each thin domain before repeats and supplies deterministic foundation queries if the planner fails. Intake similarly gives distinct motivating gaps a slot before repeats, retaining the five-source write cap and ten-search cap. This improves allocation within a run; it does not guarantee every area a turn when more than five areas are thin.

Classification chooses primary domain by mechanism and retains the existing one-to-three-domain contract and canonical registry slugs. Extraction uses `extract_v3` because the instructions changed. Existing evidence-level values and the 30,000-character model input cap remain unchanged. Longer stored texts therefore do not establish that all methods reached the model.

## Alexandria integration

The optional adapter calls only the documented free, keyless Research Index endpoint:

`GET https://api.firecrawl.dev/v2/search/research/papers?query=...&k=...`

It resolves DOI, arXiv, PMID, and PMCID records to original-work URLs, interleaves them with Firecrawl, OpenAlex, and Europe PMC within the existing result cap, deduplicates arXiv revisions, and records failures or partial results in provider audit metadata. Provider failures retain the other channels' results. Research Index abstracts are discovery metadata, not captured claim evidence. This adapter does not execute general Alexandria catalog tools, retrieve passages, or add paid calls.

Set `ALEXANDRIA_RESEARCH_ENABLED=true` in the worker's explicit runtime environment after releasing the code. The schema and example default to false. Lab self-hosted Firecrawl does not contain the Cloud Research Index corpus. See the [verified product research](alexandria-product-research-2026-10-11.md) for access, coverage, and the November 16 Search-contract change.

Shared arXiv identity and sector mapping helpers live under `convex/shared/`, which the worker image copies. Existing backend/web imports keep their public paths through re-exports. An import smoke using only agent source and the Docker-shipped shared directory confirms the new planner and search imports resolve.

## Live atlas limitation and release

Read-only production probes found `graph:getConceptsForDomain` failing for Mathematics, Wave Physics, Music Theory, and Psychoacoustics with `ReturnsValidationError`, because a returned object contains `lastProbedAt`. The current checkout's `leanConcept` already removes that field. The observed deployed behavior therefore differs from this checkout; the four empty-looking atlas areas are not reliable proof of missing concepts.

Geometry and Synthesis queries returned the 100-row cap. These are bounded observations, not complete domain counts. This work does not replace the existing atlas fix or claim it is deployed.

Source intake is live. The broader discovery rules, classifier/extraction instructions, shared helper placement, and optional Alexandria adapter are local changes awaiting a reviewed backend and worker release. No Convex deploy, dev, run, or codegen command was executed. The existing backend release requirements in [the worker handoff](frequency-worker-handoff.md) require deployed-artifact identity, a reviewed full deployment delta, attestation, and rollback preparation before an exact deployment can be approved. No hypotheses or recipes were published.

## Validation

The final `vp run verify`, after the shared-helper move, passed formatting, lint, all four TypeScript projects, and 1,224 tests: 808 backend/script, 96 harness, 249 agent, and 71 media. Focused tests cover empty core-domain bootstrap, planner fallback, query/intake diversity, Alexandria response and failure handling, arXiv dedupe, and portfolio allocation. The isolated Docker-layout import smoke also passed. A fresh isolated GPT-6.1 Sol/high/Fast review of the complete local candidate returned a validated `scoped-clean` result with no P0-P3 findings. The reviewer did not independently rerun tests or live intake; those were verified by the implementing agent. `git diff --check` passed.
