# Expanding Frequency Music sources with Alexandria

Research date: October 11, 2026.

Frequency should test Firecrawl's Research Index through Alexandria as an additional discovery channel, then use curated open courses, specialist texts, and empirical papers to build coverage in Psychoacoustics, Music Theory, Wave Physics, and Mathematics. The useful outcome is a set of traceable mechanisms that can become listening experiments. Equal numbers of atlas nodes would be a poor success measure.

This is a research recommendation. No backend, worker, feed, source record, or extraction job was changed. Product evidence and the initial seed-source list are in [Alexandria product research](alexandria-product-research-2026-10-11.md) and [source expansion seeds](source-expansion-seeds-2026-10-11.md).

## What the atlas establishes

The supplied screenshot shows concentrated concept coverage in Geometry and Synthesis, sparse Music Theory, and visually empty Mathematics, Wave Physics, and Psychoacoustics. It does not establish full database counts.

The current home view requests at most 24 concepts per sector. Its backend sorts domain-specific concepts ahead of general concepts, then by mention count. Sector selection uses the concept's primary `domain`, even though classification also stores a `domains` array. A secondary relationship such as geometry plus music theory can therefore be absent from the sector display. See [home queries](../web/src/routes/zodiac-3d.tsx), [display query](../convex/graph.ts), [sector registry](../convex/domainMappings.ts), and [classification](../convex/conceptClassifier.ts).

Six unauthenticated, read-only requests to the configured production `graph:getConceptsForDomain` query returned HTTP 403 on October 11. The recommendation therefore uses the screenshot to set provisional priorities, not invented live counts. A complete authenticated census remains necessary before choosing final intake quotas.

## The existing discovery loop has a bootstrap gap

Source Scout already searches Firecrawl, OpenAlex, and Europe PMC, interleaves their rankings, and deduplicates results. It captures approved candidates through Crawl4AI, Lab Firecrawl, and an explicitly labeled OpenAlex abstract fallback. See [existing research discovery](source-scout-research.md), [search implementation](../agent/src/tools/searchTool.ts), and [Scout nodes](../agent/src/graphs/source-scout/nodes.ts).

The thin-domain census in [correspondences.ts](../convex/correspondences.ts) reads a bounded sample of concepts by primary domain, filters for `missionRelevance === "on"`, then executes `if (concepts.length === 0) continue`. This excludes genuinely empty areas and can also miss on-mission concepts outside the bounded sample. The existing [census test](../convex/scoutTargets.test.ts) explicitly includes an empty registry domain but omits it from the expected targets. This is verified current behavior, not proof that it caused the screenshot.

Adding another search provider alone will not make the planner target such areas. A subsequent implementation should create explicit bootstrap targets for empty, approved domains, map those targets to the six sectors, and distinguish a missing source from a source awaiting extraction or a concept awaiting classification. Provisional domains should retain their existing review process.

## A balanced research portfolio

| Area | First questions to cover | Suitable material | A musical experiment it could support |
| --- | --- | --- | --- |
| Psychoacoustics | Roughness, critical bands, harmonicity, auditory grouping, cultural familiarity | Empirical studies, reviews, auditory demonstrations | Compare intervals with controlled spectra, register, level, and listener background |
| Music Theory | Just intonation, equal temperament, voice leading, rhythm, tuning practices | Open theory textbooks, tuning documentation, specialist papers | Compare voicings or tuning systems while holding melody and timbre constant |
| Wave Physics | Normal modes, resonance, damping, beating, boundaries, room modes | University acoustics chapters, instrument measurements, physical-model papers | Change damping or excitation while keeping the nominal pitch fixed |
| Mathematics | Fourier representation, logarithmic pitch, ratios, modular rhythm, optimization | Open mathematical and signal-processing texts, music-specific papers | Compare additive spectra or rhythmic patterns using explicit mathematical parameters |
| Geometry | Chladni nodal patterns, tuning lattices, voice-leading spaces | Measured plate behavior and formal mathematical music models | Translate a documented spatial relation into a tuning or voice-leading constraint |
| Synthesis | Additive and physical modeling, spectrum versus tuning, envelopes | Authoritative DSP texts, implementation documentation, empirical timbre studies | Render a controlled sound that tests a claim from another area |

Geometry and Synthesis should contribute connections to the thinner areas. Keep empirical evidence, formal results, technical practice, speculative inspiration, and metaphor distinguishable, following [project doctrine](vision-and-meaning.md). For example, a Chladni pattern demonstrates a plate's vibration modes; a visual resemblance to a geometric symbol does not establish a perceptual or therapeutic effect.

The [verified seed portfolio](source-expansion-seeds-2026-10-11.md) includes Smith's [DFT textbook](https://www.dsprelated.com/freebooks/mdft/), Puget Sound's [voice-leading text](https://musictheory.pugetsound.edu/mt21c/VoiceLeading.html), UNSW's [beats and combination tones](https://www.phys.unsw.edu.au/jw/beats.html), and a full-text [register and consonance experiment](https://link.springer.com/article/10.3758/s13423-021-02033-5). It also pairs [roughness and musical stability](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0291642) with [cross-cultural consonance preferences](https://www.nature.com/articles/nature18635). Stability and pleasantness are different measured outcomes. An experiment should ask about both rather than assume that one implies the other.

## How to evaluate Alexandria

Firecrawl [Alexandria](https://docs.firecrawl.dev/features/alexandria) is a provider-tool catalog. Its [Research Index](https://docs.firecrawl.dev/features/research) offers paper search, metadata inspection, passages, and citation expansion. The documented corpus is roughly 43 million abstracts, mainly biomedical sources plus arXiv. That gives it useful physics and mathematics coverage, but does not establish comprehensive music-theory or musicology coverage.

The documented free, keyless Cloud Research Index endpoint returned 18 records across six small queries in this investigation. Relevant candidates included [dynamically adapting just intonation](https://arxiv.org/abs/1706.04338), [Fourier analysis with a bass guitar](https://arxiv.org/abs/physics/0605154), and [piano string modeling](https://pubmed.ncbi.nlm.nih.gov/12942987/). Two read probes found full-text passages for one geometry paper but no passages for the piano paper. These are qualitative discovery results, not a relevance benchmark or evidence that the sources are missing from Frequency.

General Alexandria execution has provider-specific prices and terms. Existing self-hosted Lab Firecrawl does not include the upstream Research Index or the whole Alexandria provider catalog. Use a dedicated, separately configured Research Index discovery adapter if the pilot justifies integration. The [Search docs](https://docs.firecrawl.dev/features/search) announce a November 16, 2026 change to `categories: ["research"]`, so changing the current web-search request to that category would create a response-contract dependency.

Use Alexandria's Research Index alongside the existing direct OpenAlex and Europe PMC channels. Use the first-party provider documentation to verify current access, price, and corpus coverage. Broad provider totals do not establish relevant music-research coverage, and a search result or generated digest is not claim evidence.

Run a small matched comparison with two queries per thin area and five results per query. Use the same query text against the Research Index and the current provider set. Deduplicate by DOI, arXiv identifier, and canonical URL, then record which relevant works Alexandria adds beyond existing discovery. Keep this evaluation separate from production ingestion.

For each candidate, record the original work URL, authors, publication venue and date, DOI or arXiv identifier, discovery provider, motivating domain gap, accessible content level, and any reuse terms that affect storage. Distinguish publisher full text, repository full text, abstract, and metadata. Passage offsets returned by an index may be index positions rather than publisher page numbers. Citation expansion should lead to the original work, and citations should quote the text actually captured.

Scout capture stored at most 30,000 characters when this research was done; since 2026-10-17 it stores up to 100,000, the same bound as the Extraction input. Several verified full articles exceeded the old limit, so successful retrieval does not imply that all methods or results reached Extraction. Prefer substantive chapter URLs over book indexes and check whether the captured text includes the support for each proposed claim. PMC HTML returned cookie walls in the seed research; publisher alternatives supplied usable PLOS, Springer, and Frontiers text.

Useful comparison measures are unique relevant works, usable full-text captures, abstract-only captures, extraction yield, domain classification, independent source diversity, and testable composition parameters. Report capture and extraction yield separately. A relevant abstract can guide further discovery without supporting a claim about methods or detailed results it does not contain.

Any integration should adapt provider results to the existing Source Scout candidate contract and preserve its five-ingests-per-run limit. An additional provider must not crowd out existing channels within the five-results-per-query cap. Keep discovery provenance separate from content-capture provenance. Do not label Research Index passages as Crawl4AI or OpenAlex captures. General Alexandria calls should use an explicit approved capability list and credit budget rather than executing arbitrary catalog tools.

## A bounded first intake

A useful starting target is 24 candidate sources: five for each of the four thin areas, plus two cross-domain sources each for Geometry and Synthesis. This is a proposed allocation, not a live coverage result. Select sources that collectively cover several mechanisms and more than one author or institution. An open textbook chapter can establish a foundation, while an empirical paper can test a disputed mechanism.

Start with the verified seed list rather than relying entirely on query planning. Capture readable text, extract grounded claims, confirm classification and sector mapping, and only then assess whether more discovery is needed. Advance in batches that fit the existing five-ingests-per-run guardrail. Prioritize the intended thin area when choosing extraction work, so new foundational material does not wait behind a generic backlog.

The October 3 [operator handoff](plans/2026-10-03-source-backlog-operator-extraction-handoff.md) reported about 1,800 sources awaiting extraction and substantial off-mission speech or ML material. Those are historical counts, not a current census. Before expanding intake, check the present backlog and recent Scout planner/provider errors. More collected URLs will not repair stalled extraction or classification.

Success means that each previously thin area has traceable claims covering several useful mechanisms, including limitations or contrary evidence where relevant, and that some cross-domain ideas can become controlled musical experiments. Hypothesis and recipe publication retain the project's human approval rules.

## Initial research validation

This section records the earlier research-only pass. The implementation and live intake are tracked in [balanced portfolio implementation](balanced-research-portfolio-2026-10-11.md).

The research changed documentation only. Repository code and existing tests were inspected to verify the Scout bootstrap gap and atlas limits. `vp run verify` failed before the new documents existed because this checkout has no project-local dependencies and cannot find `biome` for `format:check`. This blocker predates the research changes. No Convex run, dev, codegen, or deploy command was executed.
