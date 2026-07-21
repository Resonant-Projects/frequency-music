import type {
  ScoutSearchHit,
  ScoutTargets,
} from "../../state/sourceScoutState.js";

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

Produce at most 10 concrete search queries. Every query must use one exact targetGap label from the list below and explain how it addresses that gap. Prefer primary research, peer-reviewed work, durable specialist sources, and credible recurring feeds. Do not generate generic sound, generic music-AI, or unrelated machine-learning searches.

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

The targetGap must repeat the exact motivating gap shown below. Give a short grounded relevanceNote. evidenceLevelGuess is optional and must remain a guess based only on the result metadata.

Motivating gap: ${hit.query.targetGap}
Query rationale: ${hit.query.rationale}
Search result:
${JSON.stringify(hit.result, null, 2)}`;
}
