import type { Run, Example } from "langsmith";

type Output = {
  summary?: unknown;
  claims?: unknown;
  compositionParameters?: unknown;
  topics?: unknown;
  openQuestions?: unknown;
};

export const extractionSchemaEvaluator = (run: Run, _example?: Example) => {
  const output = run.outputs as Output | undefined;
  if (!output) return { key: "schema_valid", score: 0, comment: "no output" };
  try {
    if (typeof output.summary !== "string") throw new Error("summary missing");
    if (!Array.isArray(output.claims)) throw new Error("claims missing");
    if (!Array.isArray(output.compositionParameters))
      throw new Error("compositionParameters missing");
    if (!Array.isArray(output.topics)) throw new Error("topics missing");
    if (!Array.isArray(output.openQuestions))
      throw new Error("openQuestions missing");
    for (const c of output.claims) {
      if (typeof (c as Record<string, unknown>)?.text !== "string")
        throw new Error("claim.text missing");
    }
    return { key: "schema_valid", score: 1 };
  } catch (e) {
    return { key: "schema_valid", score: 0, comment: (e as Error).message };
  }
};
