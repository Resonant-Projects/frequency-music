import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import type { Example, Run } from "langsmith";
import {
  parseJsonObjectFromText,
  requireOpenRouterApiKey,
} from "../eval-helper";

// Standing cost decision: judging always runs through Claude Haiku via
// OpenRouter. Do NOT route judging through Codex or any evaluated provider —
// keeping the judge independent of what it scores avoids self-preference bias
// and keeps per-row cost bounded. This matches convex/extract.ts MODELS.haiku.
const JUDGE_MODEL = "anthropic/claude-3-5-haiku-20241022";

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

const SAFE_DEFAULT: JudgeScores = {
  grounding: 0,
  actionability: 0,
  stakeClarity: 0,
  nonRepetition: 0,
  rationale: "unparseable judge response",
};

function clamp01(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * PURE parser: extract the four 0..1 dimension scores and the rationale from
 * whatever the judge model returned (raw JSON, fenced ```json blocks, or prose
 * with an embedded object). Never throws; returns a safe all-zero default when
 * no JSON object can be recovered. Mirrors evaluators/why-matters.ts robustness.
 */
export function parseJudgeResponse(text: string): JudgeScores {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { ...SAFE_DEFAULT };
  }
  const obj = parseJsonObjectFromText(text);
  if (Object.keys(obj).length === 0) {
    return { ...SAFE_DEFAULT };
  }
  const rationale =
    typeof obj.rationale === "string" && obj.rationale.trim().length > 0
      ? obj.rationale.trim()
      : "";
  return {
    grounding: clamp01(obj.grounding),
    actionability: clamp01(obj.actionability),
    stakeClarity: clamp01(obj.stakeClarity),
    nonRepetition: clamp01(obj.nonRepetition),
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
}

/**
 * Async LLM-as-judge evaluator. Compatible with langsmith evaluate()'s async
 * evaluator signature. Returns an aggregate score with a per-dimension +
 * rationale comment.
 */
export function makeJudgeEvaluator(options: JudgeEvaluatorOptions = {}) {
  const openrouter = createOpenRouter({
    apiKey: requireOpenRouterApiKey(options.env),
  });
  return async (run: Run, example?: Example) => {
    let scores: JudgeScores;
    try {
      const { text } = await generateText({
        model: openrouter(JUDGE_MODEL),
        system: JUDGE_SYSTEM,
        prompt: buildJudgeUser(run, example, options.fewShot ?? []),
        maxOutputTokens: 500,
      });
      scores = parseJudgeResponse(text);
    } catch (error) {
      return {
        key: "judge",
        score: 0,
        comment: `judge call failed: ${(error as Error).message}`,
      };
    }
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
