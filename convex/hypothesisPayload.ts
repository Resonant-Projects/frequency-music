import { assertWhyThisMatters } from "./hypotheses";

export interface GeneratedHypothesisPayload {
  title: string;
  question: string;
  hypothesis: string;
  whyThisMatters: string;
  rationaleMd: string;
  concepts?: string[];
}

function requiredText(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`generated.${field} is missing`);
  }
  return value;
}

/** Keep only the fields a hypothesis uses; throw on a missing or non-string one. */
export function projectGeneratedHypothesis(
  raw: unknown,
): GeneratedHypothesisPayload {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("generated payload is not an object");
  }
  const record: Record<string, unknown> = { ...raw };
  const payload: GeneratedHypothesisPayload = {
    title: requiredText(record, "title"),
    question: requiredText(record, "question"),
    hypothesis: requiredText(record, "hypothesis"),
    // A missing or non-string value reaches the shared check as "" and is
    // rejected there with the same error a blank one gets.
    whyThisMatters: assertWhyThisMatters(
      typeof record.whyThisMatters === "string" ? record.whyThisMatters : "",
      "generated.whyThisMatters",
    ),
    rationaleMd: requiredText(record, "rationaleMd"),
  };
  if (Array.isArray(record.concepts)) {
    payload.concepts = record.concepts.filter(
      (concept): concept is string => typeof concept === "string",
    );
  }
  return payload;
}
