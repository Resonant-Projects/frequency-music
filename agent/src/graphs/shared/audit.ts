import type { AgentRunEventKind } from "../../../../convex/shared/agentContract.js";
import type { AgentToolName } from "../../../../convex/shared/agentToolArgs.js";

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

function redactedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replaceAll(
      /((?:api[_-]?key|secret|token|password|passwd)\s*[=:]\s*)[^\s"'}]+/gi,
      "$1[REDACTED]",
    )
    .replaceAll(/(PVEAPIToken=)[^\s"'}]+/gi, "$1[REDACTED]");
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
        message: redactedError(error),
      }),
    ];
  }
}
