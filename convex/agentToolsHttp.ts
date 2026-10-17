import { makeFunctionReference } from "convex/server";
import { httpAction } from "./_generated/server";
import { agentToolSecretRejection, recordAuthFailure } from "./auth";
import type { AgentToolName } from "./shared/agentToolArgs";
import { agentToolSurface } from "./shared/authFailures";
import { AGENT_TOOL_NAMES } from "./shared/agentToolManifest";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Removes a presented secret a caller echoed into a retained header. */
function redactPresented(value: string | undefined, presented?: string) {
  return value && presented ? value.replaceAll(presented, "[REDACTED]") : value;
}

function makeAgentToolHttpHandler(toolName: AgentToolName) {
  const reference = makeFunctionReference<"action">(`agentTools:${toolName}`);
  return httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;
    const secret = typeof body.secret === "string" ? body.secret : undefined;
    const rejection = agentToolSecretRejection(secret);
    if (rejection || !secret) {
      await recordAuthFailure(ctx, {
        surface: agentToolSurface(toolName),
        reason: rejection ?? "missing_secret",
        operation: `http:${toolName}`,
        // The one header kept, truncated by the recorder.
        userAgent: redactPresented(
          request.headers.get("user-agent") ?? undefined,
          secret,
        ),
      });
      return json({ error: "Forbidden" }, 403);
    }

    const { secret: _secret, ...args } = body;
    const result = await ctx.runAction(reference, {
      agentSecret: secret,
      ...args,
    });
    return json(result);
  });
}

export const agentToolHttpHandlers = Object.fromEntries(
  AGENT_TOOL_NAMES.map((name) => [name, makeAgentToolHttpHandler(name)]),
) as Record<AgentToolName, ReturnType<typeof httpAction>>;
