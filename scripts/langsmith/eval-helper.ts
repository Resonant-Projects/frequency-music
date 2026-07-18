#!/usr/bin/env -S vpx tsx
import "varlock/auto-load";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { evaluate, type EvaluatorT } from "langsmith/evaluation";

export interface EvalPrompt {
  system: string;
  user: (input: Record<string, unknown>) => string;
}

export function stringifyPromptValue(value: unknown): string {
  // oxlint-disable-next-line typescript/no-base-to-string -- Preserve the legacy prompt interpolation for dataset values.
  return String(value);
}

interface RunEvalOptions {
  prompts: Record<string, EvalPrompt>;
  defaultVersion: string;
  data: string;
  evaluators: EvaluatorT[];
  experimentPrefix: string;
  maxOutputTokens: number;
  argv?: string[];
}

export function selectPromptVersion(
  argv: string[] = process.argv,
  defaultVersion: string,
) {
  const versionIdx = argv.indexOf("--version");
  return versionIdx >= 0
    ? (argv[versionIdx + 1] ?? defaultVersion)
    : defaultVersion;
}

export function requireOpenRouterApiKey(
  env: Record<string, string | undefined> = process.env,
) {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  return apiKey;
}

export function parseJsonObjectFromText(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};

  try {
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function runEval({
  prompts,
  defaultVersion,
  data,
  evaluators,
  experimentPrefix,
  maxOutputTokens,
  argv = process.argv,
}: RunEvalOptions) {
  const version = selectPromptVersion(argv, defaultVersion);
  const prompt = prompts[version];
  if (!prompt) {
    console.error(`Unknown prompt version: ${version}`);
    process.exit(1);
  }

  let apiKey: string;
  try {
    apiKey = requireOpenRouterApiKey();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  const openrouter = createOpenRouter({ apiKey });

  await evaluate(
    async (input) => {
      const { text } = await generateText({
        model: openrouter("anthropic/claude-sonnet-4.6"),
        system: prompt.system,
        prompt: prompt.user(input as Record<string, unknown>),
        maxOutputTokens,
      });
      return parseJsonObjectFromText(text);
    },
    {
      data,
      evaluators,
      experimentPrefix: `${experimentPrefix}-${version}`,
      metadata: { promptVersion: version },
    },
  );
}
