#!/usr/bin/env -S vpx tsx
import { extractionSchemaEvaluator } from "./evaluators/schema";
import { parameterSpecificityEvaluator } from "./evaluators/parameter-specificity";
import { type EvalPrompt, runEval, stringifyPromptValue } from "./eval-helper";
import {
  EXTRACTION_CONTENT_MAX_CHARS,
  EXTRACT_SYSTEM_PROMPT,
  renderExtractionPrompt,
} from "../../convex/shared/extractionPrompt";

const PROMPTS: Record<string, EvalPrompt> = {
  v3: {
    system: EXTRACT_SYSTEM_PROMPT,
    user: (input) =>
      renderExtractionPrompt({
        title: stringifyPromptValue(input.sourceTitle),
        canonicalUrl:
          typeof input.sourceUrl === "string" ? input.sourceUrl : undefined,
        content: stringifyPromptValue(input.rawText),
      }),
    task: "extract_v3",
  },
  v2: {
    system:
      "Extract structured claims, composition parameters, topics, and open questions from a research source. Return strict JSON.",
    user: (input) =>
      `Title: ${stringifyPromptValue(input.sourceTitle)}\nType: ${stringifyPromptValue(input.sourceType)}\n\n${stringifyPromptValue(input.rawText).slice(0, EXTRACTION_CONTENT_MAX_CHARS)}`,
    task: "extract_v2",
  },
};

process.exitCode = await runEval({
  prompts: PROMPTS,
  defaultVersion: "v3",
  data: "resonant-extractions-golden",
  evaluators: [extractionSchemaEvaluator, parameterSpecificityEvaluator],
  experimentPrefix: "extraction",
});
