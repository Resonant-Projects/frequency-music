#!/usr/bin/env bun
import { evaluate } from "langsmith/evaluation";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { extractionSchemaEvaluator } from "./evaluators/schema";
import { parameterSpecificityEvaluator } from "./evaluators/parameter-specificity";

const PROMPTS: Record<
  string,
  { system: string; user: (input: Record<string, unknown>) => string }
> = {
  v2: {
    system:
      "Extract structured claims, composition parameters, topics, and open questions from a research source. Return strict JSON.",
    user: (input) =>
      `Title: ${input.sourceTitle}\nType: ${input.sourceType}\n\n${String(input.rawText).slice(0, 30000)}`,
  },
};

const versionIdx = process.argv.indexOf("--version");
const version = versionIdx >= 0 ? (process.argv[versionIdx + 1] ?? "v2") : "v2";
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
      maxOutputTokens: 4096,
    });
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  },
  {
    data: "resonant-extractions-golden",
    evaluators: [extractionSchemaEvaluator, parameterSpecificityEvaluator],
    experimentPrefix: `extraction-${version}`,
    metadata: { promptVersion: version },
  },
);
