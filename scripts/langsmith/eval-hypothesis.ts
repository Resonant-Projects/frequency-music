#!/usr/bin/env -S vpx tsx
import { whyThisMattersEvaluator } from "./evaluators/why-matters";
import { type EvalPrompt, runEval } from "./eval-helper";

const PROMPTS: Record<string, EvalPrompt> = {
  v1: {
    system:
      "You are a research synthesis assistant. Generate a hypothesis with strong whyThisMatters language tied to compositional stakes.",
    user: (input) =>
      `Source: ${input.sourceTitle}\nClaims: ${JSON.stringify(input.claims)}\nComposition parameters: ${JSON.stringify(input.compositionParameters)}\nTopics: ${JSON.stringify(input.topics)}\n\nReturn JSON: {title, question, hypothesis, whyThisMatters, rationaleMd}`,
  },
};

await runEval({
  prompts: PROMPTS,
  defaultVersion: "v1",
  data: "resonant-hypotheses-golden",
  evaluators: [whyThisMattersEvaluator],
  experimentPrefix: "hypothesis",
  maxOutputTokens: 2000,
});
