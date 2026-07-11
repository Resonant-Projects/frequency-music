import { z } from "zod";

export const conceptClassificationSchema = z.object({
  domains: z.array(z.string().trim().min(1)).min(1).max(3),
  missionRelevance: z.enum(["on", "off"]),
  rationale: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) => (value.match(/[.!?](?=\s|$)/g)?.length ?? 0) === 1,
      "Rationale must be exactly one terminated sentence",
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
