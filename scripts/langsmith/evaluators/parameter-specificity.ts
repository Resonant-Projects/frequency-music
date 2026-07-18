import type { Run, Example } from "langsmith";
import { stringifyPromptValue } from "../eval-helper";

const UNIT_TOKENS = ["hz", "bpm", "cents", "ratio", "tet", ":", "/", "°"];

export const parameterSpecificityEvaluator = (run: Run, _example?: Example) => {
  const params = (run.outputs as Record<string, unknown> | undefined)
    ?.compositionParameters as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(params) || params.length === 0) {
    return { key: "parameter_specificity", score: 0, comment: "no parameters" };
  }
  const specific = params.filter((p) => {
    const v = stringifyPromptValue(p.value ?? "").toLowerCase();
    return /\d/.test(v) || UNIT_TOKENS.some((t) => v.includes(t));
  });
  const ratio = specific.length / params.length;
  return {
    key: "parameter_specificity",
    score: ratio,
    comment: `${specific.length}/${params.length} specific`,
  };
};
