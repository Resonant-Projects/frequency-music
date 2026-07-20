import type { z } from "zod";
import { getResearchModel } from "../../models/index.js";
import { redactError } from "../../shared/redactError.js";
import {
  appendRemoteAuditEvent,
  type AgentAuditEvent,
  type ToolCaller,
} from "./audit.js";

type JudgeConfig = {
  configurable: { agentRunId?: string; traceUrl?: string };
};

export type StructuredJudge<Verdict> = {
  invoke: (prompt: string, options: JudgeConfig) => Promise<Verdict>;
};

export function createStructuredJudge<Schema extends z.ZodType>(
  schema: Schema,
): StructuredJudge<z.infer<Schema>> {
  return getResearchModel({
    requiresToolBinding: true,
    temperature: 0,
  }).withStructuredOutput(schema) as unknown as StructuredJudge<
    z.infer<Schema>
  >;
}

type JudgeError = { reason: "judge_error"; message: string };

type JudgeResult<Verdict> =
  | { verdict: Verdict; judgeError?: never; auditEvents: AgentAuditEvent[] }
  | { verdict?: never; judgeError: JudgeError; auditEvents: AgentAuditEvent[] };

export async function invokeJudgeOrError<Verdict>(args: {
  judge: StructuredJudge<Verdict>;
  prompt: string;
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
