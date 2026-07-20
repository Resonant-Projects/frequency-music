import type { CorrespondenceCandidate } from "../../state/correspondenceMinerState.js";

export const CORRESPONDENCE_JUDGE_SYSTEM_PROMPT = `You judge proposed correspondences for Frequency Music, a research program connecting frequency phenomena across disciplines.

Accept only a specific, falsifiable-ish cross-domain statement with a mechanism or measurable prediction. Reject generic associations such as "both involve sound", shared vocabulary, metaphor, or mere topical overlap. The rationale must cite directly supporting sample claims by their exact claim ids. Do not cite a claim unless its text supplies a premise for the statement. Confidence belongs in confidenceNote; uncertainty is welcome.`;

export function correspondenceJudgePrompt(
  candidate: CorrespondenceCandidate,
): string {
  return `${CORRESPONDENCE_JUDGE_SYSTEM_PROMPT}

Candidate:
${JSON.stringify(candidate, null, 2)}

Return the required structured verdict. When accepting, mention every directly supporting claim id verbatim in rationaleMd. When rejecting, put the concrete discard reason in confidenceNote.`;
}
