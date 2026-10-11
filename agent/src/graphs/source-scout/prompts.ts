import type {
  ScoutQuery,
  ScoutSearchHit,
  ScoutTargets,
} from "../../state/sourceScoutState.js";
import { inferDisplaySectorFromDomain } from "../../../../convex/shared/domainMappings.js";
import {
  RESEARCH_AREAS,
  RESEARCH_SOURCE_GUIDANCE,
} from "../../../../convex/shared/researchTopics.js";

export function foundationQueries(targets: ScoutTargets): ScoutQuery[] {
  return targets.thinDomains.map((target) => {
    const area = RESEARCH_AREAS.find(
      (item) => item.sector === inferDisplaySectorFromDomain(target.domain),
    );
    return {
      query: `${target.domain} ${area?.foundationQuery ?? "music acoustics primary research"}`,
      targetGap: `thin-domain:${target.domain}`,
      rationale: `Develop foundational mechanisms for ${target.domain}; the bounded census found ${target.onMissionConceptCount} on-mission concepts and ${target.sourceCount} linked sources.`,
    };
  });
}

export function targetGapLabels(targets: ScoutTargets): string[] {
  return [
    ...targets.thinDomains.map((target) => `thin-domain:${target.domain}`),
    ...targets.starvedConjectures.map(
      (target) => `starved-conjecture:${target.correspondenceId}`,
    ),
  ];
}

export function queryPlanningPrompt(targets: ScoutTargets): string {
  return `You plan need-directed web discovery for Frequency Music, a research-to-composition program connecting music with physics, mathematics, geometry, psychoacoustics, resonance, and embodied listening.

Produce at most 10 concrete search queries. Every query must use one exact targetGap label from the list below and explain how it addresses that gap. Include at least one query per thin domain, including empty domains. Use remaining queries for specific mechanisms, competing explanations, and contrary evidence. Prefer readable original papers, substantive textbook chapters, author documentation, and durable specialist sources over indexes, feed teasers, and search summaries. Do not generate generic music-AI or unrelated machine-learning searches.

${RESEARCH_SOURCE_GUIDANCE}

Research areas and measurable questions:
${JSON.stringify(
  RESEARCH_AREAS.map(({ foundationQuery: _query, ...area }) => area),
  null,
  2,
)}

Allowed targetGap labels:
${targetGapLabels(targets).join("\n")}

Gap census:
${JSON.stringify(targets, null, 2)}`;
}

export function resultJudgePrompt(hit: ScoutSearchHit): string {
  return `You judge a web-search result for Frequency Music need-directed source discovery.

Classify it as:
- source: a relevant individual research input worth canonical intake;
- feed: a relevant recurring RSS, podcast, journal feed, or YouTube channel feed worth proposing for human enablement;
- discard: generic sound/music content, generic ML content, weakly related content, duplicates in spirit, or anything that does not address the motivating gap.

${RESEARCH_SOURCE_GUIDANCE}

Accept a useful foundational or contrary source even if it is not a new journal paper. Require a substantive individual work or chapter; a book index is a discovery aid. Prefer accessible full text and give abstract-only or uncertain access an explicit note. Judge relevance from the supplied metadata only; search snippets and retrieval scores are not evidence of the paper's claims. Do not reject a counterexample because it disagrees with the project's current ideas.

The targetGap must repeat the exact motivating gap shown below. Give a short grounded relevanceNote. evidenceLevelGuess is optional and must remain a guess based only on the result metadata.

Motivating gap: ${hit.query.targetGap}
Query rationale: ${hit.query.rationale}
Search result:
${JSON.stringify({ ...hit.result, providerUrl: undefined }, null, 2)}`;
}
