import { makeFunctionReference } from "convex/server";
import { httpAction } from "./_generated/server";
import { constantTimeEqual } from "./auth";
import type { AgentToolName } from "./shared/agentToolArgs";
import { AGENT_TOOL_NAMES } from "./shared/agentToolManifest";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeAgentToolHttpHandler(toolName: AgentToolName) {
  const reference = makeFunctionReference<"action">(`agentTools:${toolName}`);
  return httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;
    const secret = typeof body.secret === "string" ? body.secret : undefined;
    const expected = process.env.AGENT_TOOL_SECRET;
    if (!secret || !expected || !constantTimeEqual(secret, expected)) {
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
