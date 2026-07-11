#!/usr/bin/env -S vpx tsx
/**
 * Eval-gated prompt/policy promotion (plan 05, task 4).
 *
 * Runs the relevant `eval-*.ts` runner for BOTH the current baseline prompt
 * version and a candidate version, computes per-evaluator means for each from
 * the LangSmith experiment feedback, and prints PASS/FAIL per the shipping
 * rubric documented in docs/langsmith-runbook.md:
 *
 *   PASS  ⇔  no evaluator regresses beyond `--threshold`
 *            AND the judge score improves or holds (when a judge evaluator ran).
 *
 * Because LLM-as-judge scores are noisy, each experiment is run at least twice
 * (`--trials`, default 2) and EVERY trial must pass.
 *
 * On PASS this prints (a) a diff to apply to docs/eval-baselines.md and (b) the
 * version-flip a human should commit. It never auto-commits and never edits any
 * source, convex, agent, or web file.
 *
 * docs/eval-baselines.md is a plan-02 deliverable; if it is absent the promotion
 * still runs (the head-to-head baseline-vs-candidate experiments are the source
 * of truth) and the doc read degrades gracefully with a clear message.
 *
 * Usage:
 *   LANGSMITH_API_KEY=... OPENROUTER_API_KEY=... \
 *     bun scripts/langsmith/promote.ts --target hypothesis --candidate v2
 *
 * Flags:
 *   --target <hypothesis|recipe|brief|extraction>  required
 *   --candidate <version>                          required (e.g. v2)
 *   --baseline <version>                           optional; defaults per target
 *   --trials <n>                                   optional; default 2 (min 2)
 *   --threshold <float>                            optional; default 0.02
 *   --help                                         print this help and exit
 */
import "varlock/auto-load";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "langsmith";

// ---------------------------------------------------------------------------
// Target configuration
// ---------------------------------------------------------------------------

export type Target = "hypothesis" | "recipe" | "brief" | "extraction";

export interface TargetConfig {
  /** eval-*.ts runner filename, relative to this script's directory. */
  runner: string;
  /** Default baseline (currently-shipping) prompt version for this family. */
  defaultBaseline: string;
  /** Evaluator key treated as the LLM-as-judge score (plan 02 deliverable). */
  judgeKey: string;
  /** Path to the golden dataset the runner reads, for diagnostics only. */
  goldenPath: string;
}

export const TARGETS: Record<Target, TargetConfig> = {
  extraction: {
    runner: "eval-extraction.ts",
    defaultBaseline: "v2",
    judgeKey: "judge",
    goldenPath: "data/eval/extractions-golden.jsonl",
  },
  hypothesis: {
    runner: "eval-hypothesis.ts",
    defaultBaseline: "v1",
    judgeKey: "judge",
    goldenPath: "data/eval/hypotheses-golden.jsonl",
  },
  brief: {
    runner: "eval-weekly-brief.ts",
    defaultBaseline: "v1",
    judgeKey: "judge",
    goldenPath: "data/eval/weekly-briefs-golden.jsonl",
  },
  recipe: {
    runner: "eval-recipe.ts",
    defaultBaseline: "v1",
    judgeKey: "judge",
    goldenPath: "data/eval/recipes-golden.jsonl",
  },
};

const BASELINES_DOC = "docs/eval-baselines.md";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in promote.test.ts)
// ---------------------------------------------------------------------------

export interface CliArgs {
  target?: string;
  candidate?: string;
  baseline?: string;
  trials: number;
  threshold: number;
  help: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { trials: 2, threshold: 0.02, help: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--target":
        args.target = next;
        i++;
        break;
      case "--candidate":
        args.candidate = next;
        i++;
        break;
      case "--baseline":
        args.baseline = next;
        i++;
        break;
      case "--trials":
        args.trials = Math.max(2, Number(next) || 2);
        i++;
        break;
      case "--threshold":
        args.threshold = Number(next);
        if (!Number.isFinite(args.threshold)) args.threshold = 0.02;
        i++;
        break;
      default:
        break;
    }
  }
  return args;
}

/** Extract the experiment name langsmith prints when an evaluation starts. */
export function parseExperimentName(output: string): string | null {
  const m = output.match(/Starting evaluation of experiment:\s*(\S+)/);
  return m ? m[1]! : null;
}

/** Pull per-evaluator means out of a LangSmith `feedback_stats` object. */
export function extractMeans(feedbackStats: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (feedbackStats && typeof feedbackStats === "object") {
    for (const [key, value] of Object.entries(
      feedbackStats as Record<string, unknown>,
    )) {
      const avg = (value as { avg?: unknown } | null)?.avg;
      if (typeof avg === "number" && Number.isFinite(avg)) out[key] = avg;
    }
  }
  return out;
}

/**
 * Best-effort parse of per-evaluator baseline means from docs/eval-baselines.md.
 * The exact table shape is owned by plan 02 Task 4 and not yet created, so this
 * is deliberately lenient: within the section whose heading mentions the target
 * (or across the whole doc if it has no headings), any markdown table row whose
 * first cell is a label and whose last cell parses as a number is treated as
 * `{ evaluatorKey: mean }`.
 */
export function parseBaselinesDoc(
  md: string,
  target: string,
): Record<string, number> {
  const means: Record<string, number> = {};
  let sawHeading = false;
  let inScope = false;
  for (const rawLine of md.split("\n")) {
    const line = rawLine.trim();
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      sawHeading = true;
      inScope = heading[1]!.toLowerCase().includes(target.toLowerCase());
      continue;
    }
    if (!(inScope || !sawHeading)) continue;
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 2) continue;
    const key = cells[0];
    const last = cells[cells.length - 1];
    if (key === undefined || last === undefined) continue;
    if (/^-+$/.test(key) || /^-+$/.test(last)) continue; // separator row
    const num = Number(last);
    if (key && Number.isFinite(num)) means[key] = num;
  }
  return means;
}

export interface RubricRow {
  key: string;
  baseline: number | null;
  candidate: number | null;
  delta: number | null;
  regressed: boolean;
  isJudge: boolean;
}

export interface RubricResult {
  pass: boolean;
  rows: RubricRow[];
  judgeEvaluated: boolean;
  notes: string[];
}

const pad = (s: string, n: number) => s.padEnd(n);

/**
 * Head-to-head rubric: candidate must not regress any evaluator beyond
 * `threshold`, and (when a judge evaluator ran on both sides) the judge score
 * must improve or hold.
 */
export function evaluateRubric(opts: {
  baselineMeans: Record<string, number>;
  candidateMeans: Record<string, number>;
  judgeKey: string;
  threshold: number;
}): RubricResult {
  const { baselineMeans, candidateMeans, judgeKey, threshold } = opts;
  const keys = [
    ...new Set([...Object.keys(baselineMeans), ...Object.keys(candidateMeans)]),
  ].toSorted();

  const rows: RubricRow[] = [];
  const notes: string[] = [];
  let pass = true;
  let judgeEvaluated = false;

  for (const key of keys) {
    const b = key in baselineMeans ? baselineMeans[key]! : null;
    const c = key in candidateMeans ? candidateMeans[key]! : null;
    const isJudge = key === judgeKey;

    if (b === null || c === null) {
      notes.push(
        `Evaluator "${key}" missing on one side (baseline=${b}, candidate=${c}); cannot compare — skipped.`,
      );
      rows.push({
        key,
        baseline: b,
        candidate: c,
        delta: null,
        regressed: false,
        isJudge,
      });
      continue;
    }

    const delta = c - b;
    let regressed = false;
    if (isJudge) {
      judgeEvaluated = true;
      // Judge must improve or hold.
      if (delta < -1e-9) regressed = true;
    } else if (delta < -threshold) {
      regressed = true;
    }
    if (regressed) pass = false;
    rows.push({ key, baseline: b, candidate: c, delta, regressed, isJudge });
  }

  if (!judgeEvaluated) {
    notes.push(
      `Judge evaluator "${judgeKey}" did not run on both sides. It is a plan-02 deliverable; PASS is based only on the non-judge evaluators above. Wire a judge evaluator to enforce the "judge improves or holds" clause.`,
    );
  }

  return { pass, rows, judgeEvaluated, notes };
}

/** Mean of the candidate means across trials, per evaluator key. */
export function averageMeans(
  perTrial: Array<Record<string, number>>,
): Record<string, number> {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const trial of perTrial) {
    for (const [key, val] of Object.entries(trial)) {
      sums[key] = (sums[key] ?? 0) + val;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  const out: Record<string, number> = {};
  for (const key of Object.keys(sums)) out[key] = sums[key]! / counts[key]!;
  return out;
}

/** Render the markdown snippet to paste into docs/eval-baselines.md on PASS. */
export function renderBaselineDiff(
  target: string,
  candidate: string,
  means: Record<string, number>,
): string {
  const keys = Object.keys(means).toSorted();
  const lines: string[] = [];
  lines.push(`## ${target} (${candidate})`);
  lines.push("");
  lines.push("| evaluator | mean |");
  lines.push("| --- | --- |");
  for (const key of keys) lines.push(`| ${key} | ${means[key]!.toFixed(4)} |`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Effectful helpers
// ---------------------------------------------------------------------------

const HELP = `promote.ts — eval-gated prompt/policy promotion (plan 05, task 4)

Runs the eval-*.ts runner for a prompt family against BOTH its baseline and a
candidate version, reads per-evaluator means from the resulting LangSmith
experiments, and prints PASS/FAIL per the shipping rubric. Each experiment is
run at least twice (judge scores are noisy) and every trial must pass.

Usage:
  bun scripts/langsmith/promote.ts --target <t> --candidate <version> [options]

Required:
  --target <hypothesis|recipe|brief|extraction>
  --candidate <version>          e.g. v2 (must exist in the runner's PROMPTS map)

Options:
  --baseline <version>           current shipping version (default per target:
                                   extraction=v2, hypothesis=v1, brief=v1, recipe=v1)
  --trials <n>                   experiments per side; default 2, minimum 2
  --threshold <float>            max allowed per-evaluator regression; default 0.02
  --help, -h                     show this help

Rubric (PASS):
  no non-judge evaluator regresses by more than --threshold, AND the judge
  evaluator (plan-02 "${TARGETS.hypothesis.judgeKey}" key) improves or holds when present, on EVERY trial.

Environment:
  LANGSMITH_API_KEY   read experiment feedback stats (required)
  OPENROUTER_API_KEY  used by the eval runners to call the model (required)

Notes:
  - docs/eval-baselines.md (a plan-02 deliverable) is read for reference if it
    exists; the head-to-head baseline-vs-candidate experiments are the source of
    truth, so promotion still works without it.
  - On PASS this prints the docs/eval-baselines.md diff to apply and the
    version-flip to commit. It NEVER auto-commits or edits any file.
`;

const RUNNER_DIR = fileURLToPath(new URL(".", import.meta.url));

function resolveRunner(config: TargetConfig): string {
  return `${RUNNER_DIR}${config.runner}`;
}

/** Run one eval experiment as a subprocess; return its LangSmith experiment name. */
export function runExperiment(runnerPath: string, version: string): string {
  const result = spawnSync("bun", [runnerPath, "--version", version], {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(
      `Runner exited with status ${result.status} for version "${version}". See output above.`,
    );
  }
  const name = parseExperimentName(combined);
  if (!name) {
    throw new Error(
      `Could not parse experiment name from runner output for version "${version}".`,
    );
  }
  return name;
}

/** Poll LangSmith until the experiment's feedback_stats are populated. */
export async function readMeansForExperiment(
  client: Client,
  experimentName: string,
  attempts = 6,
  delayMs = 2500,
): Promise<Record<string, number>> {
  let lastMeans: Record<string, number> = {};
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const project = await client.readProject({
        projectName: experimentName,
        includeStats: true,
      });
      lastMeans = extractMeans(project.feedback_stats);
      if (Object.keys(lastMeans).length > 0) return lastMeans;
    } catch (error) {
      if (attempt === attempts - 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return lastMeans;
}

function formatRubric(result: RubricResult): string {
  const lines: string[] = [];
  lines.push(
    `  ${pad("evaluator", 26)}${pad("baseline", 11)}${pad("candidate", 11)}${pad("delta", 11)}status`,
  );
  for (const row of result.rows) {
    const b = row.baseline === null ? "—" : row.baseline.toFixed(4);
    const c = row.candidate === null ? "—" : row.candidate.toFixed(4);
    const d =
      row.delta === null
        ? "—"
        : `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(4)}`;
    const status =
      row.baseline === null || row.candidate === null
        ? "SKIP"
        : row.regressed
          ? "REGRESSED"
          : "ok";
    const judge = row.isJudge ? " (judge)" : "";
    lines.push(
      `  ${pad(row.key + judge, 26)}${pad(b, 11)}${pad(c, 11)}${pad(d, 11)}${status}`,
    );
  }
  for (const note of result.notes) lines.push(`  note: ${note}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main(argv: string[] = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help || argv.length === 0) {
    console.log(HELP);
    return args.help ? 0 : 1;
  }

  if (!args.target || !(args.target in TARGETS)) {
    console.error(
      `--target must be one of: ${Object.keys(TARGETS).join(", ")}. Got: ${args.target ?? "(none)"}`,
    );
    return 1;
  }
  if (!args.candidate) {
    console.error("--candidate <version> is required.");
    return 1;
  }

  const target = args.target as Target;
  const config = TARGETS[target];
  const baseline = args.baseline ?? config.defaultBaseline;
  const candidate = args.candidate;

  if (baseline === candidate) {
    console.error(
      `--candidate (${candidate}) must differ from the baseline (${baseline}).`,
    );
    return 1;
  }

  const runnerPath = resolveRunner(config);
  if (!existsSync(runnerPath)) {
    console.error(
      `Runner not found: ${runnerPath}\n` +
        `The "${target}" eval family has no runner yet — eval-weekly-brief.ts / eval-recipe.ts are plan-02 deliverables not created in this phase.`,
    );
    return 1;
  }

  if (!process.env.LANGSMITH_API_KEY && !process.env.LANGCHAIN_API_KEY) {
    console.error(
      "LANGSMITH_API_KEY (or LANGCHAIN_API_KEY) must be set to read experiment feedback stats.",
    );
    return 1;
  }

  console.log(
    `Promotion gate: target=${target} baseline=${baseline} candidate=${candidate} trials=${args.trials} threshold=${args.threshold}`,
  );
  console.log(`Runner: ${config.runner}   Golden: ${config.goldenPath}\n`);

  // Reference baseline means from the (optional) baselines doc.
  let docMeans: Record<string, number> | null = null;
  try {
    const docText = await readFile(BASELINES_DOC, "utf8");
    docMeans = parseBaselinesDoc(docText, target);
    if (Object.keys(docMeans).length === 0) {
      console.log(
        `Note: ${BASELINES_DOC} exists but has no parseable "${target}" means; using head-to-head experiments only.\n`,
      );
    } else {
      console.log(
        `Reference baseline means from ${BASELINES_DOC}: ${JSON.stringify(docMeans)}\n`,
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log(
        `Note: ${BASELINES_DOC} not found (it is a plan-02 deliverable). Proceeding with head-to-head baseline-vs-candidate experiments as the source of truth.\n`,
      );
    } else {
      console.log(
        `Note: could not read ${BASELINES_DOC} (${(error as Error).message}); proceeding with head-to-head experiments only.\n`,
      );
    }
  }

  const client = new Client();
  const candidateTrialMeans: Array<Record<string, number>> = [];
  let allPass = true;

  for (let trial = 1; trial <= args.trials; trial++) {
    console.log(
      `── Trial ${trial}/${args.trials} ─────────────────────────────`,
    );

    console.log(`Running baseline experiment (${baseline})…`);
    const baselineExp = runExperiment(runnerPath, baseline);
    const baselineMeans = await readMeansForExperiment(client, baselineExp);

    console.log(`Running candidate experiment (${candidate})…`);
    const candidateExp = runExperiment(runnerPath, candidate);
    const candidateMeans = await readMeansForExperiment(client, candidateExp);
    candidateTrialMeans.push(candidateMeans);

    if (
      Object.keys(baselineMeans).length === 0 ||
      Object.keys(candidateMeans).length === 0
    ) {
      console.error(
        `Trial ${trial}: no feedback stats returned (baseline keys=${Object.keys(baselineMeans).length}, candidate keys=${Object.keys(candidateMeans).length}). ` +
          `Check that the golden dataset is uploaded and evaluators emitted scores.`,
      );
      allPass = false;
      continue;
    }

    const rubric = evaluateRubric({
      baselineMeans,
      candidateMeans,
      judgeKey: config.judgeKey,
      threshold: args.threshold,
    });
    console.log(formatRubric(rubric));
    console.log(`Trial ${trial}: ${rubric.pass ? "PASS" : "FAIL"}\n`);
    if (!rubric.pass) allPass = false;
  }

  console.log("═══════════════════════════════════════════════");
  if (!allPass) {
    console.log(
      `RESULT: FAIL — candidate "${candidate}" does not clear the gate.`,
    );
    console.log(
      "Do not flip the shipping version. Iterate on the candidate prompt and re-run.",
    );
    return 2;
  }

  const avgCandidate = averageMeans(candidateTrialMeans);
  console.log(
    `RESULT: PASS — candidate "${candidate}" clears the gate on all ${args.trials} trials.`,
  );
  console.log(
    "\nApply this diff to docs/eval-baselines.md (append or replace the target section):\n",
  );
  console.log(renderBaselineDiff(target, candidate, avgCandidate));
  console.log(
    "\nThen flip the shipping version (human commit — not automated):",
  );
  console.log(
    `  1. In scripts/langsmith/${config.runner}, set defaultVersion: "${candidate}" (and keep "${baseline}" in PROMPTS for regression runs).`,
  );
  console.log(
    `  2. Update the production ${target} prompt constant to match PROMPTS["${candidate}"] in convex/ (hypotheses.ts / recipes.ts / weeklyBriefs.ts / extract.ts as applicable).`,
  );
  console.log(
    "  3. Commit both changes together with the eval evidence in the message.",
  );
  return 0;
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
