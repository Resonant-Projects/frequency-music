import type { AgentRunEventKind } from "../../../../convex/shared/agentContract.js";
import type { AgentToolName } from "../../../../convex/shared/agentToolArgs.js";
import { redactError } from "../../shared/redactError.js";

export type ToolCaller = (
  name: AgentToolName,
  args: Record<string, unknown>,
) => Promise<unknown>;

export type AgentAuditEvent<
  Kind extends AgentRunEventKind = AgentRunEventKind,
> = {
  kind: Kind;
  message: string;
  payload?: unknown;
  createdAt: string;
};

function localEvent<Kind extends AgentRunEventKind>(
  kind: Kind,
  message: string,
  payload?: unknown,
): AgentAuditEvent<Kind> {
  return { kind, message, payload, createdAt: new Date().toISOString() };
}

export async function appendRemoteAuditEvent<Kind extends AgentRunEventKind>(
  callTool: ToolCaller,
  agentRunId: string | undefined,
  kind: Kind,
  message: string,
  payload?: unknown,
): Promise<AgentAuditEvent<Kind | "error">[]> {
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

export async function finalizeRunCompleted(
  callTool: ToolCaller,
  agentRunId: string | undefined,
  summary: string,
  traceUrl?: string,
): Promise<AgentAuditEvent<"error">[]> {
  if (!agentRunId) return [];
  try {
    await callTool("markAgentRunCompleted", {
      runId: agentRunId,
      summary,
      ...(traceUrl ? { traceUrl } : {}),
    });
    return [];
  } catch (error) {
    const payload = { message: redactError(error) };
    const graphName = summary.match(/^([a-z]+(?:-[a-z]+)*) completed:/)?.[1];
    if (!graphName) {
      return [
        localEvent(
          "error",
          "Failed to mark remote agent run terminal status",
          payload,
        ),
      ];
    }
    return await appendRemoteAuditEvent(
      callTool,
      agentRunId,
      "error",
      `Failed to mark ${graphName} run completed`,
      payload,
    );
  }
}
