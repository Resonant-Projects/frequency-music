import type { Example, Run } from "langsmith";
import { MODELS, TOKEN_BUDGETS } from "../../../convex/llm";
import {
  type GenerateTextFn,
  generateModelText,
  parseJsonObjectFromText,
  requireAnthropicApiKey,
} from "../eval-helper";
import { EvalInfrastructureError } from "../run-guard";

// Standing cost decision: judging always runs on the registered bounded Haiku
// model, called directly through Anthropic like the deployed generators. Do
// NOT route judging through Codex or any evaluated provider — keeping the
// judge independent of what it scores avoids self-preference bias and keeps
// per-row cost bounded.
export const JUDGE_MODEL = MODELS.haiku;
// Adaptive thinking tokens count against the output cap, so the judge shares
// the bounded Haiku classification budget instead of its former 500 tokens.
export const JUDGE_MAX_OUTPUT_TOKENS = TOKEN_BUDGETS.concept_classifier_v1;
export const JUDGE_TIMEOUT_MS = 120_000;

// The four rubric dimensions. Keys mirror the JSON the judge is asked to emit.
export const JUDGE_DIMENSIONS = [
  "grounding",
  "actionability",
  "stakeClarity",
  "nonRepetition",
] as const;

export type JudgeDimension = (typeof JUDGE_DIMENSIONS)[number];

export interface JudgeScores {
  /** grounding-in-cited-claims: are assertions traceable to supplied claims? */
  grounding: number;
  /** musical-actionability: could a composer act on this in the studio? */
  actionability: number;
  /** stake-clarity: is the "why this matters" stake explicit and concrete? */
  stakeClarity: number;
  /** non-repetition-of-failure-archived-ground: avoids re-proposing dead ends. */
  nonRepetition: number;
  /** one-line rationale from the judge. */
  rationale: string;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function dimensionScore(obj: Record<string, unknown>, key: JudgeDimension) {
  const raw = obj[key];
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim().length > 0
        ? Number(raw)
        : Number.NaN;
  if (!Number.isFinite(n)) {
    throw new EvalInfrastructureError(
      `judge response has no numeric ${key} score`,
    );
  }
  return clamp01(n);
}

/**
 * PURE parser: extract the four 0..1 dimension scores and the rationale from
 * whatever the judge model returned (raw JSON, fenced ```json blocks, or prose
 * with an embedded object). Numeric strings are coerced and out-of-range
 * numbers clamped. A response with no JSON object or a missing or non-numeric
 * dimension throws `EvalInfrastructureError`: an unparseable verdict is a
 * failed judgment, not a zero score. Explicit zeros remain valid scores.
 */
export function parseJudgeResponse(text: string): JudgeScores {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new EvalInfrastructureError("judge response is empty");
  }
  const obj = parseJsonObjectFromText(text);
  if (!obj) {
    throw new EvalInfrastructureError("judge response is not a JSON object");
  }
  const rationale =
    typeof obj.rationale === "string" && obj.rationale.trim().length > 0
      ? obj.rationale.trim()
      : "";
  return {
    grounding: dimensionScore(obj, "grounding"),
    actionability: dimensionScore(obj, "actionability"),
    stakeClarity: dimensionScore(obj, "stakeClarity"),
    nonRepetition: dimensionScore(obj, "nonRepetition"),
    rationale,
  };
}

/** Mean of the four dimensions — the aggregate judge score. */
export function aggregateJudgeScore(scores: JudgeScores): number {
  return (
    (scores.grounding +
      scores.actionability +
      scores.stakeClarity +
      scores.nonRepetition) /
    JUDGE_DIMENSIONS.length
  );
}

const JUDGE_SYSTEM = [
  "You are a rigorous editorial judge scoring a weekly research brief for a",
  "music/physics/mathematics research-to-composition studio.",
  "Score four dimensions, each a real number from 0.0 (fails) to 1.0 (excellent):",
  "- grounding: every claim in the brief is traceable to the supplied cited claims/theses; no invented facts.",
  "- actionability: the brief gives concrete musical moves a composer could act on in the studio (tunings, intervals, tempos, timbres).",
  "- stakeClarity: the brief makes the compositional stake explicit — why this matters for sound, not just abstract theory.",
  "- nonRepetition: the brief does NOT re-propose ground already recorded in the failure archive (avoids known dead ends).",
  "Return ONLY a JSON object:",
  '{"grounding": <0..1>, "actionability": <0..1>, "stakeClarity": <0..1>, "nonRepetition": <0..1>, "rationale": "<one line>"}',
].join("\n");

function buildJudgeUser(
  run: Run,
  example?: Example,
  fewShot: string[] = [],
): string {
  const inputs = (example?.inputs ?? {}) as Record<string, unknown>;
  const outputs = (run.outputs ?? {}) as Record<string, unknown>;
  const sections: string[] = [];
  if (fewShot.length > 0) {
    sections.push(`ANCHOR EXAMPLES:\n${fewShot.join("\n\n")}`);
  }
  sections.push(
    `CITED CLAIMS / THESES:\n${JSON.stringify(inputs.hypotheses ?? inputs.claims ?? inputs.theses ?? [])}`,
  );
  sections.push(
    `FAILURE-ARCHIVED GROUND (do not repeat):\n${JSON.stringify(inputs.failures ?? [])}`,
  );
  sections.push(
    `BRIEF UNDER REVIEW:\n${JSON.stringify({
      bodyMd: outputs.bodyMd,
      studioPrompts: outputs.studioPrompts,
      todo: outputs.todo,
    })}`,
  );
  return sections.join("\n\n");
}

export interface JudgeEvaluatorOptions {
  /**
   * Optional few-shot anchor strings injected into the judge prompt. Plan 05
   * feeds outcome rows here without needing a rewrite of this evaluator.
   */
  fewShot?: string[];
  env?: Record<string, string | undefined>;
  /** Test seam for the model call. */
  generate?: GenerateTextFn;
}

/**
 * Async LLM-as-judge evaluator. Compatible with langsmith evaluate()'s async
 * evaluator signature. Returns an aggregate score with a per-dimension +
 * rationale comment. A failed call or unparseable verdict throws, and the
 * runner's guard turns that into a failed run rather than a zero score.
 */
export function makeJudgeEvaluator(options: JudgeEvaluatorOptions = {}) {
  const apiKey = requireAnthropicApiKey(options.env);
  return async function judge(run: Run, example?: Example) {
    const text = await generateModelText(
      {
        apiKey,
        model: JUDGE_MODEL,
        system: JUDGE_SYSTEM,
        prompt: buildJudgeUser(run, example, options.fewShot ?? []),
        maxOutputTokens: JUDGE_MAX_OUTPUT_TOKENS,
        abortSignal: AbortSignal.timeout(JUDGE_TIMEOUT_MS),
      },
      options.generate,
    );
    const scores = parseJudgeResponse(text);
    const score = aggregateJudgeScore(scores);
    const comment = [
      `grounding=${scores.grounding.toFixed(2)}`,
      `actionability=${scores.actionability.toFixed(2)}`,
      `stakeClarity=${scores.stakeClarity.toFixed(2)}`,
      `nonRepetition=${scores.nonRepetition.toFixed(2)}`,
      scores.rationale ? `— ${scores.rationale}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return { key: "judge", score, comment };
  };
}
