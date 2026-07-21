import type {
  DraftableCorrespondence,
  HypothesisDraftContext,
  HypothesisSelfCheck,
} from "../../state/hypothesisDrafterState.js";

export function hypothesisDraftPrompt(
  target: DraftableCorrespondence,
  context: HypothesisDraftContext,
  revision?: HypothesisSelfCheck,
): string {
  return `You are drafting one testable Frequency Music hypothesis from a cross-domain correspondence.

Design a 30-90 second micro-study that varies exactly ONE controllable musical variable. The statement must make a directional or otherwise falsifiable prediction. Cite the supplied evidence claim ids literally in the rationale. Do not invent source ids, extraction ids, correspondence ids, or evidence. Explain the concrete musical stake in whyThisMatters.

Correspondence target:
${JSON.stringify(target, null, 2)}

Gathered context, including prior hypotheses and the Failure Archive:
${JSON.stringify(context, null, 2)}

${
  revision
    ? `This is the single allowed revision. Fix this self-check feedback:\n${JSON.stringify(revision, null, 2)}`
    : "Produce the first draft."
}`;
}

export function hypothesisSelfCheckPrompt(
  target: DraftableCorrespondence,
  context: HypothesisDraftContext,
  draft: unknown,
): string {
  return `Audit this hypothesis draft strictly before it consumes a human review slot.

Pass only if all three conditions hold:
1. It is falsifiable in a 30-90 second micro-study.
2. It varies exactly ONE controllable musical variable.
3. Its rationale cites supplied evidence claim ids and does not overstate them.

Return booleans for pass, testable, oneVariable, and evidenceGrounded plus concise revision feedback.

Correspondence:
${JSON.stringify(target, null, 2)}

Evidence-aware context:
${JSON.stringify(context, null, 2)}

Draft:
${JSON.stringify(draft, null, 2)}`;
}
