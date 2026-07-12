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

// Anthropic's structured-output schema subset rejects array length
// constraints (minItems/maxItems) and refinements, so the LLM-facing schema
// stays permissive; parseConceptClassificationItems applies the strict schema
// to each row while retaining its positional concept index.
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

export type ParsedConceptClassifications = {
  classifications: Array<{
    index: number;
    classification: ConceptClassification;
  }>;
  failed: number;
};

const conceptClassificationRowsSchema = z.object({
  classifications: z.array(z.unknown()),
});

export function parseConceptClassificationItems(
  value: unknown,
  expectedCount: number,
): ParsedConceptClassifications {
  const parsed = conceptClassificationRowsSchema.parse(value);
  if (parsed.classifications.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} classifications, received ${parsed.classifications.length}`,
    );
  }
  const classifications: ParsedConceptClassifications["classifications"] = [];

  for (let index = 0; index < expectedCount; index++) {
    const result = conceptClassificationSchema.safeParse(
      parsed.classifications[index],
    );
    if (result.success) {
      classifications.push({ index, classification: result.data });
    }
  }

  return {
    classifications,
    failed: expectedCount - classifications.length,
  };
}
