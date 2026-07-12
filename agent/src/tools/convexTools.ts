import { tool } from "@langchain/core/tools";
import {
  AGENT_TOOL_MANIFEST,
  type AgentToolManifestEntry,
} from "../../../convex/shared/agentToolManifest";

const rawTextKeys = new Set(["rawText", "transcript"]);

function stripLargeTextFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripLargeTextFields);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (rawTextKeys.has(key)) continue;
    result[key] = stripLargeTextFields(child);
  }
  return result;
}

export async function callConvex<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const convexUrl = process.env.CONVEX_SITE_URL;
  const agentSecret = process.env.AGENT_TOOL_SECRET;
  if (!convexUrl) throw new Error("CONVEX_SITE_URL is required");
  if (!agentSecret) throw new Error("AGENT_TOOL_SECRET is required");

  const resp = await fetch(
    convexUrl.replace(/\/$/, "") + "/agent-tools/" + path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: agentSecret, ...body }),
    },
  );
  if (!resp.ok) {
    throw new Error(
      "Convex tool " +
        path +
        " failed: " +
        resp.status +
        " " +
        (await resp.text()),
    );
  }
  return stripLargeTextFields(await resp.json()) as T;
}

function toSnake(name: string): string {
  return name.replaceAll(
    /[A-Z]/g,
    (character) => `_${character.toLowerCase()}`,
  );
}

export function bindAgentRunContext(
  definition: Pick<AgentToolManifestEntry, "kind" | "name">,
  args: Record<string, unknown>,
  configurable: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (definition.kind !== "research_write") return args;
  const agentRunId = configurable?.agentRunId;
  if (typeof agentRunId !== "string" || !agentRunId) {
    throw new Error(`${definition.name} requires agentRunId in run context`);
  }
  const traceUrl = configurable?.traceUrl;
  return {
    ...args,
    agentRunId,
    ...(typeof traceUrl === "string" && traceUrl ? { traceUrl } : {}),
  };
}

export function agentModelSchema(definition: AgentToolManifestEntry) {
  return definition.kind === "research_write"
    ? definition.args.omit({ agentRunId: true })
    : definition.args;
}

export const convexTools = AGENT_TOOL_MANIFEST.filter(
  (definition) => definition.langchain,
).map((definition) =>
  tool(
    (args, config) =>
      callConvex(
        definition.name,
        bindAgentRunContext(
          definition,
          args as Record<string, unknown>,
          config?.configurable,
        ),
      ),
    {
      name: toSnake(definition.name),
      description: definition.description,
      schema: agentModelSchema(definition),
    },
  ),
);

export { stripLargeTextFields };
