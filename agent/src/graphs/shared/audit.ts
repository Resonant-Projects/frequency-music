import type { AgentRunEventKind } from "../../../../convex/shared/agentContract.js";
import type { AgentToolName } from "../../../../convex/shared/agentToolArgs.js";
import { redactError } from "../../shared/redactError.js";

export type ToolCaller = (
  name: AgentToolName,
  args: Record<string, unknown>,
) => Promise<unknown>;

export type AgentAuditEvent = {
  kind: AgentRunEventKind;
  message: string;
  payload?: unknown;
  createdAt: string;
};

function localEvent(
  kind: AgentRunEventKind,
  message: string,
  payload?: unknown,
): AgentAuditEvent {
  return { kind, message, payload, createdAt: new Date().toISOString() };
}

export async function appendRemoteAuditEvent(
  callTool: ToolCaller,
  agentRunId: string | undefined,
  kind: AgentRunEventKind,
  message: string,
  payload?: unknown,
): Promise<AgentAuditEvent[]> {
  const event = localEvent(kind, message, payload);
  if (!agentRunId) return [event];
  try {
    await callTool("appendAgentRunEvent", {
      runId: agentRunId,
      kind,
      message,
      payload,
    });
    return [event];
  } catch (error) {
    return [
      event,
      localEvent("error", "Failed to append remote agent-run audit event", {
        message: redactError(error),
      }),
    ];
  }
}
