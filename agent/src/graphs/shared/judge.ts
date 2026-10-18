import type { z } from "zod";
import { ANTHROPIC_MODELS } from "../../../../convex/shared/llmPolicy.js";
import { getResearchModel } from "../../models/index.js";
import { type ModelPrompt, toModelInput } from "../../models/promptCache.js";
import { redactError } from "../../shared/redactError.js";
import {
  appendRemoteAuditEvent,
  type AgentAuditEvent,
  type ToolCaller,
} from "./audit.js";

type JudgeConfig = {
  signal?: AbortSignal;
  configurable: { agentRunId?: string; traceUrl?: string };
};

export type StructuredJudge<Verdict> = {
  invoke: (prompt: ModelPrompt, options: JudgeConfig) => Promise<Verdict>;
};

export function createStructuredJudge<Schema extends z.ZodType>(
  schema: Schema,
  model: string = ANTHROPIC_MODELS.haiku,
  options: {
    maxTokens?: number;
    maxRetries?: number;
    requireDirectAnthropic?: boolean;
  } = {},
): StructuredJudge<z.infer<Schema>> {
  // Native JSON-schema output, not a forced tool call: Sonnet 5.5 rejects
  // forced tool_choice and refuses to disable reasoning, which is what the
  // default tool-calling method sends.
  const runnable = getResearchModel({
    ...options,
    requiresToolBinding: true,
    model,
    temperature: 0,
  }).withStructuredOutput(schema, {
    method: "jsonSchema",
  });
  return {
    invoke: async (prompt, config) =>
      (await runnable.invoke(toModelInput(prompt), config)) as z.infer<Schema>,
  };
}

type JudgeError = { reason: "judge_error"; message: string };

type JudgeResult<Verdict> =
  | { verdict: Verdict; judgeError?: never; auditEvents: AgentAuditEvent[] }
  | { verdict?: never; judgeError: JudgeError; auditEvents: AgentAuditEvent[] };

export async function invokeJudgeOrError<Verdict>(args: {
  judge: StructuredJudge<Verdict>;
  prompt: ModelPrompt;
  callTool: ToolCaller;
  agentRunId?: string;
  traceUrl?: string;
  errorEventMessage: string;
  errorEventPayload: (message: string) => unknown;
}): Promise<JudgeResult<Verdict>> {
  try {
    return {
      verdict: await args.judge.invoke(args.prompt, {
        configurable: {
          agentRunId: args.agentRunId,
          traceUrl: args.traceUrl,
        },
      }),
      auditEvents: [],
    };
  } catch (error) {
    const message = redactError(error);
    return {
      judgeError: { reason: "judge_error", message },
      auditEvents: await appendRemoteAuditEvent(
        args.callTool,
        args.agentRunId,
        "decision",
        args.errorEventMessage,
        args.errorEventPayload(message),
      ),
    };
  }
}
