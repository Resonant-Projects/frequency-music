# Firecrawl Alexandria research

Research date: October 11, 2026. Sources are current official Firecrawl documentation, public provider pages, and public source code. Public pages were retrieved through Lab Firecrawl. The qualitative Research Index probe used the documented free, keyless Firecrawl Cloud endpoints. It used no credentials, accepted no provider terms, incurred no paid execution, and made no Frequency production changes.

## Recommendation

Use Alexandria's Research Index as another source-discovery channel for Frequency, particularly for psychoacoustics, wave physics, tuning, and links between geometry and music. The free endpoint already returned relevant candidate papers in a small live probe. Keep OpenAlex, Europe PMC, curated educational resources, and specialist music publications alongside it. Its documented corpus consists mainly of biomedical abstracts plus arXiv, so it cannot establish balanced coverage of all six project domains by itself.

Treat search results as candidates. Capture the underlying paper or an explicitly labelled abstract, preserve its identifiers and retrieval provenance, and extract concepts only from that captured evidence. A retrieval score or an arXiv listing does not establish scientific reliability or peer review.

## What Alexandria is

Firecrawl [announced Alexandria on September 22, 2026](https://www.firecrawl.dev/blog/introducing-alexandria-series-b). It combines provider APIs, specialized indexes, site-specific connectors, and web tools behind Firecrawl's API, MCP, and CLI. Its [public library](https://www.firecrawl.dev/alexandria) currently advertises 245 providers, 1,492 capabilities, and 113M+ indexed sources. Those are publisher claims for the whole library, not counts of music sources or independently audited corpus sizes.

The [Alexandria documentation](https://docs.firecrawl.dev/features/alexandria) describes a tool catalogue. Search discovers relevant provider capabilities, inspection reveals their input/output contracts and prices, and a call executes one capability. `sources: ["alexandria"]` discovers tools rather than returning the provider's underlying research records. Running a tool requires a separate call.

The [Research Index](https://docs.firecrawl.dev/features/research) is the relevant part of that library. It documents roughly 43 million abstracts, mainly PubMed, bioRxiv, and medRxiv, with arXiv for physics, mathematics, and computer science. It supports paper search, identifier/metadata inspection, passage retrieval, and expansion through similar papers, citers, or references. The [Research category](https://www.firecrawl.dev/alexandria/categories/research) currently lists just that one provider. No OpenAlex, JSTOR, musicology-journal, or specialist music-theory provider was established by that category inspection.

## Access, cost, and deployment

| Route | Verified access and behavior | Implication for Frequency |
| --- | --- | --- |
| Research Index REST | Official docs permit no-key requests to `https://api.firecrawl.dev/v2/search/research/papers`. Search, inspect, read, and related-paper operations currently have zero credit cost in the public API source. Six searches, two passage reads, and one citation expansion returned HTTP 200 in this probe. | A small pilot can query public scientific topics without a Cloud key or a paid provider execution. Free access still has rate limits and no availability guarantee. |
| General Alexandria discovery | Authenticated Search can return `data.tools`. Tool discovery is free; ordinary web results still have their usual cost. MCP docs say keyless sessions receive no Alexandria tools. | Adding `alexandria` to Lab web search does not automatically give the worker the Cloud provider catalogue. |
| General Alexandria execution | `/v2/scrape` accepts `alexandria: {provider, capability, options}` without a URL; responses use `data.alexandria`. Prices and terms vary by capability. Up to 10 tool calls can be sent together. | Inspect each capability's contract, terms, price, and errors before enabling it. Use a stable `x-request-id` for paid retries. |
| Self-hosted Firecrawl | Public code proxies Alexandria through `FIRE_EXCHANGE_URL` and research through `RESEARCH_PROXY_URL`. The default Docker Compose stack does not provide these upstream indexes/provider services. Paid execution also depends on organization access and billing infrastructure. | Existing Lab Firecrawl is a search/capture service, not a local copy of Alexandria's corpus. A Cloud adapter or separately supplied upstream service is needed. |

The [Research Index provider page](https://www.firecrawl.dev/alexandria/firecrawl-research-index) lists its search capability at 0 credits. The [Developer Index page](https://www.firecrawl.dev/alexandria/firecrawl-developer-index) lists search at 2 credits per 10 results. The [Particle page](https://www.firecrawl.dev/alexandria/particle) lists episode search at 15 credits. Prices are snapshots, not a commitment about future access.

The docs do not state a fixed keyless rate allowance on the Research Index page. API source accepts search and related-paper `k` up to 500 and passage `k` up to 50. These are validation ceilings, not a recommendation to request that many results. This probe requested three search results and two passages.

Source inspection also found `RESEARCH_KEYLESS_DISABLED`, which lets a deployment disable free paper operations. Its source default disables keyless paper operations, while the live Cloud service accepted this probe. The published free path therefore depends on deployment configuration and should handle 401/403/429 responses without retry loops.

Provider terms can require an organization administrator's acceptance. The [MCP tool documentation](https://docs.firecrawl.dev/mcp-server/tools) says the agent must give an administrator the `requiresAction.url` returned by `THIRD_PARTY_DATA_TERMS_REQUIRED`. This investigation did not enter that flow.

## Small live discovery probe

Six natural-language queries each requested three results. All six returned three records with `success: true`, `partial: false`, and HTTP 200. These are retrieval observations, not a relevance benchmark, precision estimate, or count of sources missing from Frequency. Records were not compared against the live Frequency corpus.

| Query | Representative returned source | Likely value |
| --- | --- | --- |
| `auditory roughness musical consonance critical bandwidth` | [Musical consonance: a review of theory and evidence on perception and preference of auditory roughness in humans and other animals](https://arxiv.org/abs/2510.14159) | Psychoacoustics; distinguishes roughness, harmonicity, and cultural learning, and questions model evaluation. |
| `physical modeling musical string waveguide synthesis` | [The simulation of piano string vibration: from physical models to finite difference schemes and digital waveguides](https://pubmed.ncbi.nlm.nih.gov/12942987/), DOI `10.1121/1.1587146` | Wave physics and synthesis; frequency-dependent loss, dispersion, and numerical models. |
| `voice leading geometry musical harmony` | [Geometry of Music Perception](https://arxiv.org/abs/2207.11035) | Geometry, music theory, and psychoacoustics; chord spaces and roughness/harmonicity models. |
| `nonlinear oscillator entrainment musical rhythm` | [Hebbian learning with elasticity explains how the spontaneous motor tempo affects music performance synchronization](https://pmc.ncbi.nlm.nih.gov/articles/PMC10281589/) | Mathematics and psychoacoustics; a model linked to synchronization observations. |
| `musical tuning temperament harmonicity just intonation` | [Playing Music in Just Intonation: A Dynamically Adapting Tuning Scheme](https://arxiv.org/abs/1706.04338) | Music theory and mathematics; a tuning algorithm based on a system of linear equations. |
| `Fourier analysis acoustic wave resonance musical instruments` | [Teaching Fourier Analysis and Wave Physics with the Bass Guitar](https://arxiv.org/abs/physics/0605154) | Wave physics; an instrument-based demonstration of resonant modes and Fourier components. |

The geometry query also returned [Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources](https://arxiv.org/abs/2604.19960). Its abstract discusses Levi graphs, so it may overlap the project's existing geometry coverage. The proper test is deduplication against canonical source identifiers, not counting another discovery as a new source.

Two paper-read calls tested the difference between an indexed abstract and accessible text:

- `pmid:12942987` with a query about loss, dispersion, and finite-difference stability returned metadata and an abbreviated abstract, but `passages: []`.
- `arxiv:2207.11035` with a query about roughness and harmonicity returned two full-text passages with links into the arXiv HTML. Those passages contain hypotheses as well as descriptions of prior work; downstream extraction must retain that distinction.

A `references` expansion from `arxiv:2207.11035` returned three papers, including [Entropy-based Tuning of Musical Instruments](https://arxiv.org/abs/1203.5101) and [Harmony Perception by Periodicity Detection](https://arxiv.org/abs/1306.6458). The response included `truncated: true`. Related-paper responses need completeness metadata and source inspection; they are not a complete bibliography.

Several PubMed results contained abstracts cut off with an ellipsis despite the docs' description of full abstracts. Frequency should recognize abbreviated text, use the canonical source or another metadata service to complete it, and avoid presenting a truncated abstract as a full paper.

Reproduce the search without credentials:

```sh
curl -sS -G 'https://api.firecrawl.dev/v2/search/research/papers' \
  --data-urlencode 'query=musical tuning temperament harmonicity just intonation' \
  --data-urlencode 'k=3'
```

## Which parts of the library matter

Research Index is the first pilot candidate. Developer Index may help discover reproducible DSP implementations, numerical methods, and official synthesis documentation. Particle may supply practitioner interviews and transcript passages, provided music-related coverage, terms, and cost are checked. A podcast is practitioner evidence, not a substitute for experimental research.

The [Entertainment category](https://www.firecrawl.dev/alexandria/categories/entertainment) markets music releases and artists, but its six provider cards inspected here were JustWatch and five World of Warcraft sites. The category description is not evidence of an available music-data provider. No dedicated music category or provider was established by this inspection.

For the empty areas shown in the user screenshot, initial queries should ask for a concrete concept or phenomenon and its musical use. Examples are critical bands and auditory masking, tuning and temperament, resonance and dispersion, Fourier analysis, and synchronization. The geometry probe shows why bridge queries are useful, but a gap-filling campaign should spend its first retrieval budget on the underrepresented domains.

## Licensing and evidence limits

Firecrawl's API engine is primarily [AGPL-3.0](https://github.com/firecrawl/firecrawl/blob/main/LICENSE); SDKs and some UI components have separate MIT licensing. That code license does not license every indexed paper, transcript, or provider record. Provider-specific terms and the underlying work's rights still apply.

No blanket right to bulk download, redistribute, train on, or store all Research Index text was established by the inspected public docs. Before a production integration, verify Firecrawl's applicable service terms and each source's reuse conditions. Preserve source URLs, DOI/arXiv/PMID/PMCID identifiers, provider name, access date, evidence scope, and any available license metadata.

Other limits remain unmeasured: musicology recall, index freshness, citation-graph completeness, percentage of papers with full-text passages, total available arXiv coverage, and sustained keyless throughput. The 18 search records show practical candidate discovery, not balanced project coverage. The work did not inspect the authenticated full catalogue or run any paid provider capability.

## Compatibility note

The [Search docs](https://docs.firecrawl.dev/features/search) announce that `categories: ["research"]` changes on November 16, 2026. Until then it filters web results to academic websites. After that it will return Research Index paper records in `data.research` rather than URLs in `data.web`. A dedicated Research Index adapter avoids relying on that changing web-search contract.

## Primary sources and source-code snapshot

- [Alexandria launch](https://www.firecrawl.dev/blog/introducing-alexandria-series-b), September 22, 2026.
- [Alexandria docs](https://docs.firecrawl.dev/features/alexandria) and their [public MDX source](https://github.com/firecrawl/firecrawl-docs/blob/main/features/alexandria.mdx).
- [Research Index docs](https://docs.firecrawl.dev/features/research) and their [public MDX source](https://github.com/firecrawl/firecrawl-docs/blob/main/features/research.mdx).
- [Search docs](https://docs.firecrawl.dev/features/search), [MCP tools](https://docs.firecrawl.dev/mcp-server/tools), [billing](https://docs.firecrawl.dev/billing), and [open source versus Cloud](https://docs.firecrawl.dev/contributing/open-source-or-cloud).
- Public API source snapshot `f84845c864b6e2af22791c18fcf89ac2a21f1434`, committed October 10, 2026 at 23:02:40 UTC: [Alexandria runtime and billing README](https://github.com/firecrawl/firecrawl/blob/f84845c864b6e2af22791c18fcf89ac2a21f1434/apps/api/src/services/alexandria/README.md), [Alexandria upstream client](https://github.com/firecrawl/firecrawl/blob/f84845c864b6e2af22791c18fcf89ac2a21f1434/apps/api/src/services/alexandria/client.ts), [Research upstream client](https://github.com/firecrawl/firecrawl/blob/f84845c864b6e2af22791c18fcf89ac2a21f1434/apps/api/src/lib/research-upstream.ts), [Research validation and zero-credit billing](https://github.com/firecrawl/firecrawl/blob/f84845c864b6e2af22791c18fcf89ac2a21f1434/apps/api/src/controllers/v2/research-proxy.ts), and [configuration](https://github.com/firecrawl/firecrawl/blob/f84845c864b6e2af22791c18fcf89ac2a21f1434/apps/api/src/config.ts).
