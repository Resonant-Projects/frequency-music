import type { Run, Example } from "langsmith";

const STAKE_HINTS = [
  "sound",
  "listen",
  "perceiv",
  "feel",
  "harm",
  "rhythm",
  "tempo",
  "key",
  "tuning",
  "interval",
  "frequency",
  "timbre",
  "compose",
  "studio",
  "ear",
];

export const whyThisMattersEvaluator = (run: Run, _example: Example) => {
  const w = (run.outputs as Record<string, unknown> | undefined)?.whyThisMatters;
  if (typeof w !== "string" || w.trim().length < 20) {
    return { key: "why_this_matters", score: 0, comment: "missing or too short" };
  }
  const lower = w.toLowerCase();
  const hits = STAKE_HINTS.filter((h) => lower.includes(h)).length;
  return {
    key: "why_this_matters",
    score: hits >= 2 ? 1 : hits >= 1 ? 0.5 : 0,
    comment: `${hits} stake hints`,
  };
};
