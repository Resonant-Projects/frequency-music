import type { Example, Run } from "langsmith";

/**
 * Fail-closed checks around LangSmith `evaluate()`.
 *
 * The SDK catches a target error and only logs `Error running target
 * function` (`_forward`), and catches an evaluator or feedback-logging error
 * and only logs `Error running evaluator` (`_runEvaluators`). Throwing alone
 * therefore never fails a run. These helpers record what the SDK swallows and
 * validate every completed row so an incomplete experiment exits nonzero
 * instead of averaging missing scores as zero.
 */

/** Marker line a runner prints after a fully validated experiment. */
export const COMPLETION_MARKER = "EVAL_RUN_COMPLETE";

/**
 * An infrastructure or parsing failure, as opposed to a valid low score. Its
 * message is safe to log: it never carries prompt, source or model text.
 */
export class EvalInfrastructureError extends Error {
  override name = "EvalInfrastructureError";
}

const SECRET_PATTERNS = [
  /sk-ant-[\w-]+/g,
  /sk-or-[\w-]+/g,
  /lsv2_[\w-]+/g,
  /\bBearer\s+[\w.-]+/gi,
];

function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce(
    (out, pattern) => out.replace(pattern, "[redacted]"),
    text,
  );
}

/**
 * Describe an error without request bodies, prompts or secrets. Provider
 * errors (`APICallError`) carry the full request body as a property, so only
 * the name, HTTP status and a bounded, redacted message are kept.
 */
export function describeFailure(error: unknown): string {
  if (error instanceof EvalInfrastructureError) return error.message;
  if (!(error instanceof Error)) return `non-error thrown (${typeof error})`;
  const status = (error as { statusCode?: unknown }).statusCode;
  const statusText = typeof status === "number" ? ` (HTTP ${status})` : "";
  const message = redactSecrets(error.message).replace(/\s+/g, " ").trim();
  const bounded =
    message.length > 200
      ? `${message.slice(0, 200)}…`
      : message || "no message";
  return `${error.name}${statusText}: ${bounded}`;
}

/**
 * A plain-function evaluator. The SDK calls it with the run spread into the
 * first argument (so `run.error` and `run.outputs` are readable) and the
 * reference example second.
 */
export type EvaluatorFn = (run: Run, example?: Example) => unknown;

export interface EvaluatorFailure {
  exampleId: string | undefined;
  evaluator: string;
  reason: string;
}

function isScoredResult(
  value: unknown,
): value is { key: string; score: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { key, score } = value as { key?: unknown; score?: unknown };
  return (
    typeof key === "string" &&
    key.length > 0 &&
    typeof score === "number" &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 1
  );
}

/**
 * Wrap evaluators so a failed target run is never scored, and an evaluator
 * exception or malformed result is recorded before the SDK swallows it.
 * Rethrown errors carry only a sanitized message, so neither the SDK's error
 * log nor the traced evaluator run receives private text.
 */
export function guardEvaluators(evaluators: EvaluatorFn[]) {
  const failures: EvaluatorFailure[] = [];
  const guarded = evaluators.map((evaluator, index) => {
    const label = evaluator.name || `evaluator#${index}`;
    const wrapped = async (run: Run, example?: Example) => {
      if (run.error || !run.outputs) {
        // Already reported by validateExperimentRows as a target failure.
        throw new EvalInfrastructureError(
          `${label} skipped: target run has no valid output`,
        );
      }
      let result: unknown;
      try {
        result = await evaluator(run, example);
      } catch (error) {
        const reason = describeFailure(error);
        failures.push({ exampleId: example?.id, evaluator: label, reason });
        throw new EvalInfrastructureError(`${label} failed: ${reason}`);
      }
      if (!isScoredResult(result)) {
        const reason = "returned no finite 0..1 score";
        failures.push({ exampleId: example?.id, evaluator: label, reason });
        throw new EvalInfrastructureError(`${label} ${reason}`);
      }
      return result;
    };
    // The SDK labels evaluator runs by function name.
    Object.defineProperty(wrapped, "name", { value: label });
    return wrapped;
  });
  return { evaluators: guarded, failures };
}

/** The slice of an SDK `ExperimentResultRow` the validation reads. */
export interface ExperimentRowLike {
  run: { error?: unknown; outputs?: unknown };
  example: { id: string };
  evaluationResults: { results: Array<{ key?: unknown; score?: unknown }> };
}

export interface ValidationReport {
  ok: boolean;
  problems: string[];
  evaluatorKeys: string[];
}

function boundedText(value: unknown): string {
  const text = redactSecrets(
    typeof value === "string" ? value : "non-string error",
  )
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

/**
 * Validate a finished experiment. It passes only when every expected example
 * produced exactly one row, no target run errored, no evaluator failed, and
 * every row carries one finite score per evaluator under a consistent key set.
 * A valid score of 0 passes; a missing score fails.
 */
export function validateExperimentRows(opts: {
  rows: ExperimentRowLike[];
  expectedExampleIds: string[];
  evaluatorCount: number;
  evaluatorFailures: EvaluatorFailure[];
}): ValidationReport {
  const { rows, expectedExampleIds, evaluatorCount, evaluatorFailures } = opts;
  const problems: string[] = [];

  if (expectedExampleIds.length === 0) {
    problems.push("dataset has no examples");
  }
  if (rows.length !== expectedExampleIds.length) {
    problems.push(
      `expected ${expectedExampleIds.length} result rows, got ${rows.length}`,
    );
  }

  const expected = new Set(expectedExampleIds);
  const seen = new Map<string, number>();
  for (const row of rows) {
    const id = row.example.id;
    seen.set(id, (seen.get(id) ?? 0) + 1);
    if (!expected.has(id)) problems.push(`example ${id}: not in the dataset`);
  }
  for (const id of expectedExampleIds) {
    const count = seen.get(id) ?? 0;
    if (count !== 1) problems.push(`example ${id}: ${count} result rows`);
  }

  let referenceKeys: string[] | null = null;
  for (const row of rows) {
    const id = row.example.id;
    if (row.run.error) {
      problems.push(
        `example ${id}: target failed: ${boundedText(row.run.error)}`,
      );
      continue;
    }
    const outputs = row.run.outputs;
    if (!outputs || typeof outputs !== "object" || Array.isArray(outputs)) {
      problems.push(`example ${id}: target returned no output object`);
      continue;
    }
    const results = row.evaluationResults.results;
    const keys = results.map((r) => r.key);
    const invalid = results.filter(
      (r) =>
        typeof r.key !== "string" ||
        typeof r.score !== "number" ||
        !Number.isFinite(r.score),
    );
    if (invalid.length > 0) {
      problems.push(
        `example ${id}: ${invalid.length} feedback without a finite score`,
      );
    }
    const uniqueKeys = [
      ...new Set(keys.filter((k): k is string => typeof k === "string")),
    ].toSorted();
    if (
      results.length !== evaluatorCount ||
      uniqueKeys.length !== evaluatorCount
    ) {
      problems.push(
        `example ${id}: expected ${evaluatorCount} evaluator scores, got ${results.length} (${uniqueKeys.join(", ") || "none"})`,
      );
      continue;
    }
    if (referenceKeys === null) {
      referenceKeys = uniqueKeys;
    } else if (referenceKeys.join("\n") !== uniqueKeys.join("\n")) {
      problems.push(
        `example ${id}: evaluator keys ${uniqueKeys.join(", ")} differ from ${referenceKeys.join(", ")}`,
      );
    }
  }

  for (const failure of evaluatorFailures) {
    problems.push(
      `example ${failure.exampleId ?? "unknown"}: evaluator ${failure.evaluator}: ${failure.reason}`,
    );
  }

  return {
    ok: problems.length === 0,
    problems,
    evaluatorKeys: referenceKeys ?? [],
  };
}

export interface CompletedExperiment {
  experiment: string;
  examples: number;
  evaluatorKeys: string[];
}

export function formatCompletionMarker(result: CompletedExperiment): string {
  return `${COMPLETION_MARKER} ${JSON.stringify(result)}`;
}

/** Parse the completion marker a runner printed; null when absent or malformed. */
export function parseCompletionMarker(
  output: string,
): CompletedExperiment | null {
  const matches = [
    ...output.matchAll(
      new RegExp(`^${COMPLETION_MARKER} (\\{.*\\})\\s*$`, "gm"),
    ),
  ];
  const json = matches.at(-1)?.[1];
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Partial<CompletedExperiment>;
    if (
      typeof parsed.experiment === "string" &&
      parsed.experiment.length > 0 &&
      typeof parsed.examples === "number" &&
      Number.isInteger(parsed.examples) &&
      parsed.examples > 0 &&
      Array.isArray(parsed.evaluatorKeys) &&
      parsed.evaluatorKeys.length > 0 &&
      parsed.evaluatorKeys.every((k) => typeof k === "string" && k.length > 0)
    ) {
      return {
        experiment: parsed.experiment,
        examples: parsed.examples,
        evaluatorKeys: parsed.evaluatorKeys,
      };
    }
  } catch {
    // Malformed marker: treated as absent.
  }
  return null;
}
