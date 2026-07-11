#!/usr/bin/env -S vpx tsx
import { extractionSchemaEvaluator } from "./evaluators/schema";
import { parameterSpecificityEvaluator } from "./evaluators/parameter-specificity";
import { type EvalPrompt, runEval } from "./eval-helper";

const PROMPTS: Record<string, EvalPrompt> = {
  v2: {
    system:
      "Extract structured claims, composition parameters, topics, and open questions from a research source. Return strict JSON.",
    user: (input) =>
      `Title: ${input.sourceTitle}\nType: ${input.sourceType}\n\n${String(input.rawText).slice(0, 30000)}`,
  },
};

await runEval({
  prompts: PROMPTS,
  defaultVersion: "v2",
  data: "resonant-extractions-golden",
  evaluators: [extractionSchemaEvaluator, parameterSpecificityEvaluator],
  experimentPrefix: "extraction",
  maxOutputTokens: 4096,
});
