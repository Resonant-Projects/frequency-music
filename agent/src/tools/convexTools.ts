import { tool } from "@langchain/core/tools";
import { AGENT_TOOL_MANIFEST } from "../../../convex/shared/agentToolManifest";

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

export const convexTools = AGENT_TOOL_MANIFEST.filter(
  (definition) => definition.langchain,
).map((definition) =>
  tool((args) => callConvex(definition.name, args as Record<string, unknown>), {
    name: toSnake(definition.name),
    description: definition.description,
    schema: definition.args,
  }),
);

export { stripLargeTextFields };
