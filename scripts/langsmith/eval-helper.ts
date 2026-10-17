#!/usr/bin/env -S vpx tsx
import "varlock/auto-load";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { Client, type Example } from "langsmith";
import { evaluate } from "langsmith/evaluation";
import { type LlmTask, modelForTask, TOKEN_BUDGETS } from "../../convex/llm";
import {
  anthropicModelId,
  anthropicReasoningEffort,
  isDirectAnthropicModel,
} from "../../convex/shared/llmPolicy";
import {
  describeFailure,
  EvalInfrastructureError,
  type EvaluatorFn,
  type ExperimentRowLike,
  formatCompletionMarker,
  guardEvaluators,
  validateExperimentRows,
} from "./run-guard";

/**
 * Deadline for one target model call. An Opus high-effort or Sonnet medium-effort
 * call at the production output cap fits well inside it; a stalled request
 * aborts and fails its row instead of holding `evaluate()` open forever.
 */
export const EVAL_TARGET_TIMEOUT_MS = 300_000;

export interface EvalPrompt {
  system: string;
  user: (input: Record<string, unknown>) => string;
  /** Production task whose model and output cap this prompt version uses. */
  task: LlmTask;
}

export function stringifyPromptValue(value: unknown): string {
  // oxlint-disable-next-line typescript/no-base-to-string -- Preserve the legacy prompt interpolation for dataset values.
  return String(value);
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

export function requireAnthropicApiKey(
  env: Record<string, string | undefined> = process.env,
) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return apiKey;
}

/**
 * Parse the widest `{...}` span, as the deployed extraction parser does.
 * Returns null when no JSON object can be recovered, so callers can tell an
 * unparseable response from a parsed object that scores low.
 */
export function parseJsonObjectFromText(
  text: string,
): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed: unknown = JSON.parse(match[0]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Provider options for a direct current-catalog Anthropic call: adaptive
 * thinking, high effort on Opus and medium otherwise, matching the deployed
 * generators (`convex/llmNode.ts`). Adaptive thinking takes no sampling
 * parameters, so none are sent.
 */
export function anthropicEvalProviderOptions(model: string) {
  return {
    anthropic: {
      thinking: { type: "adaptive" as const },
      effort: anthropicReasoningEffort(model),
    },
  };
}

/** Model, output cap and provider options for one production task. */
export function evalInferenceConfig(task: LlmTask) {
  const model = modelForTask(task);
  if (!isDirectAnthropicModel(model)) {
    throw new Error(
      `Task ${task} routes to ${model}, which is not a direct Anthropic model`,
    );
  }
  return {
    task,
    model,
    maxOutputTokens: TOKEN_BUDGETS[task],
    providerOptions: anthropicEvalProviderOptions(model),
  };
}

export interface ModelTextCall {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  abortSignal?: AbortSignal;
}

export type GenerateTextFn = (
  args: Parameters<typeof generateText>[0],
) => Promise<{ text: string; finishReason: string }>;

/**
 * One direct Anthropic text call that fails closed: a transport error, an
 * empty response, a truncated response or any finish other than `stop`
 * throws an `EvalInfrastructureError` whose message carries no prompt or
 * response text.
 */
export async function generateModelText(
  call: ModelTextCall,
  generate: GenerateTextFn = generateText as unknown as GenerateTextFn,
): Promise<string> {
  if (!isDirectAnthropicModel(call.model)) {
    throw new EvalInfrastructureError(
      `${call.model} is not a direct Anthropic model`,
    );
  }
  let result: { text: string; finishReason: string };
  try {
    result = await generate({
      model: createAnthropic({ apiKey: call.apiKey })(
        anthropicModelId(call.model),
      ),
      system: call.system,
      prompt: call.prompt,
      maxOutputTokens: call.maxOutputTokens,
      providerOptions: anthropicEvalProviderOptions(call.model),
      abortSignal: call.abortSignal,
    });
  } catch (error) {
    throw new EvalInfrastructureError(
      `${call.model} request failed: ${describeFailure(error)}`,
    );
  }
  if (result.finishReason === "length") {
    throw new EvalInfrastructureError(
      `${call.model} response truncated at ${call.maxOutputTokens} output tokens`,
    );
  }
  if (result.finishReason !== "stop") {
    throw new EvalInfrastructureError(
      `${call.model} finished with ${result.finishReason}`,
    );
  }
  if (!result.text || result.text.trim().length === 0) {
    throw new EvalInfrastructureError(
      `${call.model} returned an empty response`,
    );
  }
  return result.text;
}

interface RunEvalOptions {
  prompts: Record<string, EvalPrompt>;
  defaultVersion: string;
  data: string;
  evaluators: EvaluatorFn[];
  experimentPrefix: string;
  argv?: string[];
}

interface EvaluateResultsLike {
  experimentName: string;
  results: ExperimentRowLike[];
}

export interface RunEvalDeps {
  env: Record<string, string | undefined>;
  loadExamples: (datasetName: string) => Promise<Example[]>;
  evaluate: (
    target: (
      input: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>,
    options: Record<string, unknown>,
  ) => Promise<EvaluateResultsLike>;
  generate: GenerateTextFn;
  log: (line: string) => void;
  error: (line: string) => void;
}

function defaultDeps(): RunEvalDeps {
  const client = new Client();
  return {
    env: process.env,
    loadExamples: async (datasetName) => {
      const examples: Example[] = [];
      for await (const example of client.listExamples({ datasetName })) {
        examples.push(example);
      }
      return examples;
    },
    evaluate: (target, options) =>
      evaluate(target, {
        ...options,
        client,
      } as Parameters<
        typeof evaluate
      >[1]) as unknown as Promise<EvaluateResultsLike>,
    generate: generateText as unknown as GenerateTextFn,
    log: (line) => console.log(line),
    error: (line) => console.error(line),
  };
}

/**
 * Run one experiment and return a process exit code. 0 means every example
 * produced a parsed output and every evaluator returned a finite score; any
 * missing, failed or malformed result returns 1 even though the LangSmith SDK
 * itself swallowed the error.
 */
export async function runEval(
  {
    prompts,
    defaultVersion,
    data,
    evaluators,
    experimentPrefix,
    argv = process.argv,
  }: RunEvalOptions,
  deps: RunEvalDeps = defaultDeps(),
): Promise<number> {
  const version = selectPromptVersion(argv, defaultVersion);
  const prompt = prompts[version];
  if (!prompt) {
    deps.error(`Unknown prompt version: ${version}`);
    return 1;
  }

  let apiKey: string;
  let config: ReturnType<typeof evalInferenceConfig>;
  try {
    apiKey = requireAnthropicApiKey(deps.env);
    config = evalInferenceConfig(prompt.task);
  } catch (error) {
    deps.error((error as Error).message);
    return 1;
  }

  const guard = guardEvaluators(evaluators);

  let examples: Example[];
  let results: EvaluateResultsLike;
  try {
    examples = await deps.loadExamples(data);
    if (examples.length === 0) {
      deps.error(`Dataset ${data} has no examples; nothing was evaluated.`);
      return 1;
    }
    results = await deps.evaluate(
      async (input) => {
        try {
          const text = await generateModelText(
            {
              apiKey,
              model: config.model,
              system: prompt.system,
              prompt: prompt.user(input),
              maxOutputTokens: config.maxOutputTokens,
              abortSignal: AbortSignal.timeout(EVAL_TARGET_TIMEOUT_MS),
            },
            deps.generate,
          );
          const parsed = parseJsonObjectFromText(text);
          if (!parsed) {
            throw new EvalInfrastructureError(
              `${config.model} response is not a JSON object (${text.length} chars)`,
            );
          }
          return parsed;
        } catch (error) {
          // Only a safe message reaches the SDK's log and the traced run.
          throw error instanceof EvalInfrastructureError
            ? error
            : new EvalInfrastructureError(
                `target failed: ${describeFailure(error)}`,
              );
        }
      },
      {
        data: examples,
        evaluators: guard.evaluators,
        experimentPrefix: `${experimentPrefix}-${version}`,
        metadata: {
          promptVersion: version,
          task: config.task,
          model: config.model,
          provider: "anthropic-direct",
          thinking: "adaptive",
          effort: config.providerOptions.anthropic.effort,
          maxOutputTokens: config.maxOutputTokens,
        },
      },
    );
  } catch (error) {
    deps.error(`Evaluation did not complete: ${describeFailure(error)}`);
    return 1;
  }

  // `evaluate()` has already consumed every row; `results.results` holds them
  // all. Its async iterator starts exhausted, so it is not read here.
  const report = validateExperimentRows({
    rows: results.results,
    expectedExampleIds: examples.map((example) => example.id),
    evaluatorCount: evaluators.length,
    evaluatorFailures: guard.failures,
  });
  if (!report.ok) {
    deps.error(
      `EVAL RUN FAILED: experiment ${results.experimentName} is incomplete or invalid; do not record its scores.`,
    );
    for (const problem of report.problems) deps.error(`  - ${problem}`);
    return 1;
  }

  deps.log(
    formatCompletionMarker({
      experiment: results.experimentName,
      examples: examples.length,
      evaluatorKeys: report.evaluatorKeys,
    }),
  );
  return 0;
}
