#!/usr/bin/env bun
import { evaluate } from "langsmith/evaluation";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { whyThisMattersEvaluator } from "./evaluators/why-matters";
import { parameterSpecificityEvaluator } from "./evaluators/parameter-specificity";

const PROMPTS: Record<
  string,
  { system: string; user: (input: Record<string, unknown>) => string }
> = {
  v1: {
    system:
      "You are a research synthesis assistant. Generate a hypothesis with strong whyThisMatters language tied to compositional stakes.",
    user: (input) =>
      `Source: ${input.sourceTitle}\nClaims: ${JSON.stringify(input.claims)}\nComposition parameters: ${JSON.stringify(input.compositionParameters)}\nTopics: ${JSON.stringify(input.topics)}\n\nReturn JSON: {title, question, hypothesis, whyThisMatters, rationaleMd}`,
  },
};

const versionIdx = process.argv.indexOf("--version");
const version = versionIdx >= 0 ? (process.argv[versionIdx + 1] ?? "v1") : "v1";
const prompt = PROMPTS[version];
if (!prompt) {
  console.error(`Unknown prompt version: ${version}`);
  process.exit(1);
}

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });

await evaluate(
  async (input) => {
    const { text } = await generateText({
      model: openrouter("anthropic/claude-sonnet-4-6"),
      system: prompt.system,
      prompt: prompt.user(input as Record<string, unknown>),
      maxOutputTokens: 2000,
    });
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  },
  {
    data: "resonant-hypotheses-golden",
    evaluators: [whyThisMattersEvaluator, parameterSpecificityEvaluator],
    experimentPrefix: `hypothesis-${version}`,
    metadata: { promptVersion: version },
  },
);
