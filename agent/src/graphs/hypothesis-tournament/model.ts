// Metered model adapter for the tournament core: direct Anthropic through the
// shared llmPolicy (adaptive thinking, policy effort), one attempt per call,
// and usage read from the provider response.
import { z } from "zod";
import {
  TASK_MODELS,
  TOURNAMENT_TOKEN_BUDGETS,
} from "../../../../convex/shared/llmPolicy.js";
import { createOpenRouterAnthropicModel } from "../../models/openRouterAnthropic.js";
import { BudgetExhausted } from "./budget.js";
import { tournamentPrompt } from "./prompts.js";
import type { CallContext, Metered, ModelRequest } from "./types.js";

type TournamentTask = keyof typeof TOURNAMENT_TOKEN_BUDGETS;

export const TOURNAMENT_TASKS: Record<ModelRequest["kind"], TournamentTask> = {
  generation: "tournament_generation_v1",
  grounding: "tournament_grounding_v1",
  revision: "tournament_revision_v1",
  scoring: "tournament_scoring_v1",
  finalist: "tournament_finalist_v1",
  selfCheck: "tournament_self_check_v1",
  duplicate: "tournament_duplicate_v1",
};

// Provider-facing shapes carry no numeric or length constraints, which
// structured outputs reject; the core validates strictly after the call.
const generation = z.object({
  title: z.string(),
  question: z.string(),
  statement: z.string(),
  rationale: z.string(),
  whyThisMatters: z.string(),
  concepts: z.array(z.string()).optional(),
});
const payload = generation.extend({
  sourceIds: z.array(z.string()),
  extractionIds: z.array(z.string()),
  correspondenceId: z.string().optional(),
});
export const PROVIDER_SCHEMAS: Record<ModelRequest["kind"], z.ZodType> = {
  generation,
  grounding: payload,
  revision: payload,
  scoring: z.object({
    stake: z.number(),
    novelty: z.number(),
    falsifiability: z.number(),
  }),
  selfCheck: z.object({
    pass: z.boolean(),
    testable: z.boolean(),
    oneVariable: z.boolean(),
    evidenceGrounded: z.boolean(),
    feedback: z.string(),
  }),
  duplicate: z.object({
    kind: z.enum(["duplicate", "inversion", "refinement"]),
  }),
  finalist: z.object({ winner: z.enum(["left", "right", "tie"]) }),
};

// Never fewer output tokens than this; below it the call is not made.
const MIN_OUTPUT_TOKENS = 1024;
const REQUEST_OVERHEAD_TOKENS = 256;

/** A strict upper bound on input tokens: no tokenizer emits more than one
 * token per UTF-8 byte, so bytes of prompt plus schema bound the input. */
export function inputTokenBound(prompt: string, schema: z.ZodType) {
  const bytes = (text: string) => new TextEncoder().encode(text).length;
  return (
    bytes(prompt) +
    bytes(JSON.stringify(z.toJSONSchema(schema))) +
    REQUEST_OVERHEAD_TOKENS
  );
}

type StructuredResult = {
  raw?: { usage_metadata?: { total_tokens?: unknown } };
  parsed?: unknown;
};
export type StructuredInvoker = (input: {
  model: string;
  maxTokens: number;
  schema: z.ZodType;
  prompt: string;
  signal: AbortSignal;
}) => Promise<StructuredResult>;

const invokeAnthropic: StructuredInvoker = async ({
  model,
  maxTokens,
  schema,
  prompt,
  signal,
}) =>
  (await createOpenRouterAnthropicModel({
    model,
    maxTokens,
    // Each invocation is one counted attempt; the core owns retries.
    maxRetries: 0,
    requireDirectAnthropic: true,
  })
    .withStructuredOutput(schema, { method: "jsonSchema", includeRaw: true })
    .invoke(prompt, { signal })) as StructuredResult;

function providerStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

export function createTournamentModel(
  invoke: StructuredInvoker = invokeAnthropic,
) {
  return async (
    request: ModelRequest,
    context: CallContext,
  ): Promise<Metered<unknown>> => {
    const task = TOURNAMENT_TASKS[request.kind];
    const schema = PROVIDER_SCHEMAS[request.kind];
    const prompt = tournamentPrompt(request);
    const maxTokens = Math.min(
      TOURNAMENT_TOKEN_BUDGETS[task],
      context.maxTotalTokens - inputTokenBound(prompt, schema),
    );
    if (maxTokens < MIN_OUTPUT_TOKENS) throw new BudgetExhausted("tokens");
    let result: StructuredResult;
    try {
      result = await invoke({
        model: TASK_MODELS[task],
        maxTokens,
        schema,
        prompt,
        signal: context.signal,
      });
    } catch (error) {
      // A rejected HTTP request is unbilled. Aborts, network failures and
      // anything else have unknown usage and must stop the run.
      const status = providerStatus(error);
      if (!context.signal.aborted && status !== undefined && status >= 400)
        return { ok: false, totalTokens: 0 };
      throw error;
    }
    const totalTokens = result.raw?.usage_metadata?.total_tokens;
    if (
      typeof totalTokens !== "number" ||
      !Number.isSafeInteger(totalTokens) ||
      totalTokens < 0
    )
      throw new Error("Provider usage missing from model response");
    return result.parsed === null || result.parsed === undefined
      ? { ok: false, totalTokens }
      : { ok: true, value: result.parsed, totalTokens };
  };
}
