import { getCurrentRunTree } from "langsmith/traceable";

export async function resolveCurrentTraceUrl(
  provided: string | undefined,
): Promise<string | undefined> {
  if (provided) return provided;
  if (process.env.LANGSMITH_TRACING !== "true") return undefined;
  try {
    const runTree = getCurrentRunTree(true);
    if (!runTree) return undefined;
    return await runTree.client.getRunUrl({ runId: runTree.trace_id });
  } catch {
    console.warn(
      "LangSmith tracing is enabled, but the current trace URL was unavailable; continuing without trace provenance",
    );
    return undefined;
  }
}
