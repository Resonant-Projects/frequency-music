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
