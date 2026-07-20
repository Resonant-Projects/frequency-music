import type {
  EvidenceTarget,
  SemanticClaim,
} from "../../state/evidenceHunterState.js";

export function evidenceSearchText(
  target: EvidenceTarget,
  side: "a" | "b",
): string {
  const concept = side === "a" ? target.conceptA : target.conceptB;
  return [
    concept.displayName,
    concept.description,
    `Correspondence under evaluation: ${target.statement}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function stanceJudgePrompt(
  target: EvidenceTarget,
  claim: SemanticClaim,
): string {
  return `You are evaluating evidence for a Frequency Music cross-domain correspondence.

Classify the claim as supports, contradicts, or irrelevant to the correspondence as written. "Supports" requires the claim to supply a premise or observation that increases confidence. "Contradicts" requires tension with a premise or prediction. Shared topic or vocabulary is irrelevant. Give a short grounded note and do not infer beyond the claim text.

Correspondence:
${JSON.stringify(target, null, 2)}

Candidate claim:
${JSON.stringify(claim, null, 2)}`;
}
