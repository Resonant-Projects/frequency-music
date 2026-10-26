import { Effect } from "effect";
import { convexRequest } from "./convexHttp.js";
export { ConvexToolHttpError } from "./convexHttp.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  AGENT_TOOL_MANIFEST,
  type AgentToolManifestEntry,
} from "../../../convex/shared/agentToolManifest";
import { agentToolModelJsonSchema } from "../../../convex/shared/agentToolModelSchema";

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

export function callConvex<T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  return Effect.runPromise(
    convexRequest(path, body, signal).pipe(
      // The deterministic recovery tool must receive its retained input.
      Effect.map(
        (result) =>
          (path === "getCaptureRecovery"
            ? result
            : stripLargeTextFields(result)) as T,
      ),
    ),
  );
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
  const hidden = new Set([
    ...(definition.kind === "research_write" ? ["agentRunId"] : []),
    ...definition.graphOnlyArgs,
  ]);
  return hidden.size === 0
    ? definition.args
    : z.object(
        Object.fromEntries(
          Object.entries(definition.args.shape).filter(
            ([key]) => !hidden.has(key),
          ),
        ),
      );
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
          agentModelSchema(definition).parse(args),
          config?.configurable,
        ),
      ),
    {
      name: toSnake(definition.name),
      description: definition.description,
      schema: agentToolModelJsonSchema(agentModelSchema(definition)),
    },
  ),
);

export { stripLargeTextFields };
