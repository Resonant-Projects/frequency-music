import { getCurrentRunTree } from "langsmith/traceable";

export async function resolveCurrentTraceUrl(
  provided: string | undefined,
): Promise<string | undefined> {
  if (provided) return provided;
  if (process.env.LANGSMITH_TRACING !== "true") return undefined;
  try {
    const runTree = getCurrentRunTree(true);
    if (!runTree) return undefined;
    const project = await runTree.client.readProject({
      projectName: runTree.project_name,
    });
    // Preserve the root trace link even when called within a nested run.
    const { url } = await runTree.client.runs.getURL(runTree.trace_id, {
      project_id: project.id,
      trace_id: runTree.trace_id,
    });
    return url;
  } catch {
    console.warn(
      "LangSmith tracing is enabled, but the current trace URL was unavailable; continuing without trace provenance",
    );
    return undefined;
  }
}
