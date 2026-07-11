import { z } from "zod";

export const conceptClassificationSchema = z.object({
  domains: z.array(z.string().trim().min(1)).min(1).max(3),
  missionRelevance: z.enum(["on", "off"]),
  // Terminated and bounded, but NOT exactly-one-sentence: the strict count
  // rejected honest rationales containing abbreviations ("e.g.", "et al.")
  // and failed 10% of the live backfill 20 concepts at a time.
  rationale: z
    .string()
    .trim()
    .min(10)
    .max(500)
    .refine(
      (value) => /[.!?]$/.test(value),
      "Rationale must end with sentence-terminating punctuation",
    ),
});

export const conceptClassificationBatchSchema = z.object({
  classifications: z.array(conceptClassificationSchema),
});

// Anthropic's structured-output schema subset rejects array length
// constraints (minItems/maxItems) and refinements, so the LLM-facing schema
// stays permissive; parseConceptClassificationOutput applies the strict
// schema to whatever comes back.
export const conceptClassificationLlmSchema = z.object({
  classifications: z.array(
    z.object({
      domains: z.array(z.string()),
      missionRelevance: z.enum(["on", "off"]),
      rationale: z.string(),
    }),
  ),
});

export type ConceptClassification = z.infer<typeof conceptClassificationSchema>;

export function parseConceptClassificationOutput(
  value: unknown,
  expectedCount: number,
): ConceptClassification[] {
  const parsed = conceptClassificationBatchSchema.parse(value);
  if (parsed.classifications.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} classifications, received ${parsed.classifications.length}`,
    );
  }
  return parsed.classifications;
}
