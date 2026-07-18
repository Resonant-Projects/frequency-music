#!/usr/bin/env -S vpx tsx
import type { Example, Run } from "langsmith";
import {
  type EvalPrompt,
  runEval,
  stringifyPromptValue,
} from "./eval-helper";
import { makeJudgeEvaluator } from "./evaluators/judge";

// Required sections a well-formed weekly brief body must surface. schema-lite:
// we only check that the generated bodyMd names each section, not its quality.
const REQUIRED_SECTIONS = ["thesis", "recommend", "studio", "todo"];

/** schema-lite: bodyMd exists and mentions each required section heading. */
const briefSchemaLite = (run: Run, _example?: Example) => {
  const outputs = run.outputs as Record<string, unknown> | undefined;
  const body = outputs?.bodyMd;
  if (typeof body !== "string" || body.trim().length < 40) {
    return { key: "brief_schema_lite", score: 0, comment: "missing bodyMd" };
  }
  const lower = body.toLowerCase();
  const present = REQUIRED_SECTIONS.filter((s) => lower.includes(s));
  return {
    key: "brief_schema_lite",
    score: present.length / REQUIRED_SECTIONS.length,
    comment: `${present.length}/${REQUIRED_SECTIONS.length} sections`,
  };
};

/** thesis-reference: brief references at least one active thesis by title. */
const thesisReferenceCheck = (run: Run, example?: Example) => {
  const bodyValue = (run.outputs as Record<string, unknown> | undefined)?.bodyMd;
  const body = stringifyPromptValue(bodyValue ?? "").toLowerCase();
  const theses = ((example?.inputs as Record<string, unknown> | undefined)
    ?.theses ?? []) as Array<Record<string, unknown>>;
  if (!Array.isArray(theses) || theses.length === 0) {
    return {
      key: "thesis_reference",
      score: 0,
      comment: "no theses supplied",
    };
  }
  const referenced = theses.some((t) => {
    const title = stringifyPromptValue(t.title ?? t.statement ?? "")
      .toLowerCase()
      .trim();
    return title.length >= 4 && body.includes(title);
  });
  return {
    key: "thesis_reference",
    score: referenced ? 1 : 0,
    comment: referenced ? "references a thesis" : "no thesis referenced",
  };
};

const CONTRADICTION_RE =
  /(contradiction|low-yield|low yield|weak path|weak-path|failure|dead end|dead-end)/i;

/** contradiction-mention: brief surfaces a contradiction / low-yield / weak path. */
const contradictionMentionCheck = (run: Run, _example?: Example) => {
  const bodyValue = (run.outputs as Record<string, unknown> | undefined)?.bodyMd;
  const body = stringifyPromptValue(bodyValue ?? "");
  const hit = CONTRADICTION_RE.test(body);
  return {
    key: "contradiction_mention",
    score: hit ? 1 : 0,
    comment: hit ? "mentions a contradiction/weak path" : "none surfaced",
  };
};

const PROMPTS: Record<string, EvalPrompt> = {
  v1: {
    system:
      "You are a research studio editor. Write a weekly brief that surfaces active theses, recommends concrete studio actions grounded in the cited hypotheses and recipes, names at least one contradiction or low-yield/weak path from the failure archive, and states the compositional stake in musical terms.",
    user: (input) =>
      `Week of: ${stringifyPromptValue(input.weekOf)}\nHypotheses: ${JSON.stringify(input.hypotheses)}\nRecipes: ${JSON.stringify(input.recipes)}\nActive theses: ${JSON.stringify(input.theses)}\nFailure archive: ${JSON.stringify(input.failures)}\n\nReturn JSON: {bodyMd, studioPrompts, todo}. bodyMd must include Thesis, Recommendations, Studio, and Todo sections.`,
  },
};

await runEval({
  prompts: PROMPTS,
  defaultVersion: "v1",
  data: "resonant-weekly-briefs-golden",
  evaluators: [
    briefSchemaLite,
    thesisReferenceCheck,
    contradictionMentionCheck,
    makeJudgeEvaluator(),
  ],
  experimentPrefix: "weekly-brief",
  maxOutputTokens: 4000,
});
