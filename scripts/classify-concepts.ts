/** Cursor-paginated concept classification backfill. Dry-run defaults to 30 concepts. */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import type { Id } from "../convex/_generated/dataModel";
import { api } from "../convex/_generated/api";
import { MODELS } from "../convex/llm";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";

function numericArg(name: string): number | undefined {
  const prefix = `--${name}=`;
  const raw = process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return value;
}

function stringArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");
const all = process.argv.includes("--all") || apply;
const limit = numericArg("limit") ?? (all ? Number.POSITIVE_INFINITY : 30);
const batchSize = Math.min(numericArg("batch-size") ?? 15, 20);
const model = stringArg("model") ?? MODELS.sonnet;
const client = getConvexClient();
const devBypassSecret = getDevBypassSecret();
let cursor: string | null = null;
let isDone = false;
let selected = 0;
const totals = {
  classified: 0,
  assigned: 0,
  unreviewed: 0,
  skipped: 0,
  inputTokens: 0,
  outputTokens: 0,
  llmCalls: 0,
  failed: 0,
};

type CandidatePage = {
  conceptIds: Id<"concepts">[];
  isDone: boolean;
  continueCursor: string;
};

while (!isDone && selected < limit) {
  const page: CandidatePage = await client.query(
    api.conceptClassifier.listClassificationCandidates,
    { cursor, batchSize, force, devBypassSecret },
  );
  const remaining = limit - selected;
  const conceptIds = page.conceptIds.slice(0, remaining);
  if (conceptIds.length > 0) {
    selected += conceptIds.length;
    try {
      const result = await client.action(
        api.conceptClassifier.classifyConcepts,
        {
          conceptIds,
          model,
          force,
          apply,
          devBypassSecret,
        },
      );
      totals.classified += result.classifications.length;
      totals.assigned += result.assigned;
      totals.unreviewed += result.unreviewed;
      totals.skipped += result.skipped;
      totals.inputTokens += result.inputTokens;
      totals.outputTokens += result.outputTokens;
      totals.llmCalls += result.llmCalls;
      totals.failed += result.failed;
      if (!apply) {
        for (const classification of result.classifications) {
          console.log(
            `${classification.conceptId}: ${classification.domains.join(", ")} | ${classification.missionRelevance} | ${classification.rationale}`,
          );
        }
      }
    } catch (error) {
      totals.failed += conceptIds.length;
      console.error("\nclassification page failed; continuing", {
        conceptIds,
        model,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  cursor = page.continueCursor;
  isDone = page.isDone;
  process.stderr.write(`\rscanned page; selected ${selected} concepts...`);
}

const sonnetEstimate =
  model === MODELS.sonnet
    ? (totals.inputTokens * 3 + totals.outputTokens * 15) / 1_000_000
    : undefined;
console.log("\n");
console.log(apply ? "APPLIED" : "DRY RUN (use --apply to execute)");
console.log(
  `model=${model} batchSize=${batchSize} llmCalls=${totals.llmCalls}`,
);
console.log(
  `selected=${selected} classified=${totals.classified} assigned=${totals.assigned} unreviewed=${totals.unreviewed} skipped=${totals.skipped} failed=${totals.failed}`,
);
console.log(
  `inputTokens=${totals.inputTokens} outputTokens=${totals.outputTokens}${sonnetEstimate === undefined ? "" : ` estimatedUsd=${sonnetEstimate.toFixed(2)}`}`,
);
if (apply) {
  console.log(
    "convergence=pending (review provisional domains, promote approved rows, rerun --apply, then dry-run --all)",
  );
} else {
  console.log(`converged=${selected === 0 && isDone ? "yes" : "no"}`);
}
