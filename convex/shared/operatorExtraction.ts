import { MODELS } from "../llm";

/** Registered text models may produce operator results; speech-to-text cannot. */
export const OPERATOR_EXTRACTION_MODELS: readonly string[] = [
  ...new Set(
    Object.entries(MODELS)
      .filter(([name]) => name !== "transcription")
      .map(([, model]) => model),
  ),
];

export function operatorExtractionModel(model: string = MODELS.opus): string {
  if (!OPERATOR_EXTRACTION_MODELS.includes(model)) {
    throw new Error(
      `Operator extractions record one of: ${OPERATOR_EXTRACTION_MODELS.join(", ")}`,
    );
  }
  return model;
}
