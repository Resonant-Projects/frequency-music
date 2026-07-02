/**
 * Pure helpers for export-outcomes.ts (plan 05, task 2).
 *
 * Turns composition lineage (from api.compositions.getLineage) into
 * "studio outcome" eval labels and a grouped outcome-rate table. Kept free of
 * Convex/LangSmith I/O so the derivation logic is unit-testable.
 */

export type Outcome = "expand" | "repeat" | "no_expand" | "failure_archived";

/** Subset of compositionLineage.summary we derive an outcome from. */
export interface LineageSummaryLike {
  latestExpandVerdict?: "yes" | "maybe" | "no";
  localFailureStatus?: string;
  branchFailureStatus?: string;
}

/** Minimal lineage shape consumed here (matches getLineage return). */
export interface LineageLike {
  composition: { _id: string };
  recipe?: { _id: string } | null;
  hypothesis?: { _id: string } | null;
  extractions?: Array<{ model?: string; promptVersion?: string }>;
  summary: LineageSummaryLike;
}

export interface OutcomeRow {
  compositionId: string;
  hypothesisId: string | null;
  recipeId: string | null;
  outcome: Outcome;
  failureReason: string | null;
  promptVersion: string | null;
  model: string | null;
  // provider is left null until plan 01 tags llmOutput.provider.
  provider: string | null;
}

/**
 * Derive an outcome label from a lineage summary, or null when the composition
 * has no listening signal yet (unlabeled — skipped from the dataset).
 *
 * A recorded failure status is the strongest label, so it wins over the raw
 * expand verdict (the failure archive already reconciles the two).
 */
export function deriveOutcome(
  summary: LineageSummaryLike,
): { outcome: Outcome; failureReason: string | null } | null {
  const failureReason =
    summary.localFailureStatus ?? summary.branchFailureStatus ?? null;
  if (failureReason) {
    return { outcome: "failure_archived", failureReason };
  }
  switch (summary.latestExpandVerdict) {
    case "yes":
      return { outcome: "expand", failureReason: null };
    case "maybe":
      return { outcome: "repeat", failureReason: null };
    case "no":
      return { outcome: "no_expand", failureReason: null };
    default:
      return null;
  }
}

/**
 * Build an outcome row from a composition's lineage, or null when unlabeled.
 * promptVersion/model come from the extraction leg (the only leg that persists
 * them); the most-recent extraction (extractions[0]) is authoritative.
 */
export function outcomeRowFromLineage(lineage: LineageLike): OutcomeRow | null {
  const derived = deriveOutcome(lineage.summary);
  if (!derived) return null;

  const extraction = lineage.extractions?.[0];
  return {
    compositionId: lineage.composition._id,
    hypothesisId: lineage.hypothesis?._id ?? null,
    recipeId: lineage.recipe?._id ?? null,
    outcome: derived.outcome,
    failureReason: derived.failureReason,
    promptVersion: extraction?.promptVersion ?? null,
    model: extraction?.model ?? null,
    provider: null,
  };
}

export const OUTCOMES: Outcome[] = [
  "expand",
  "repeat",
  "no_expand",
  "failure_archived",
];

export interface OutcomeGroup {
  promptVersion: string;
  counts: Record<Outcome, number>;
  total: number;
  /** expand / total, as a 0..1 fraction. */
  expandRate: number;
}

/** Group outcome rows by promptVersion (null → "unknown") with per-outcome counts. */
export function groupByPromptVersion(rows: OutcomeRow[]): OutcomeGroup[] {
  const byVersion = new Map<string, Record<Outcome, number>>();
  for (const row of rows) {
    const key = row.promptVersion ?? "unknown";
    let counts = byVersion.get(key);
    if (!counts) {
      counts = { expand: 0, repeat: 0, no_expand: 0, failure_archived: 0 };
      byVersion.set(key, counts);
    }
    counts[row.outcome] += 1;
  }

  return [...byVersion.entries()]
    .map(([promptVersion, counts]) => {
      const total = OUTCOMES.reduce((sum, o) => sum + counts[o], 0);
      return {
        promptVersion,
        counts,
        total,
        expandRate: total > 0 ? counts.expand / total : 0,
      };
    })
    .toSorted((a, b) => a.promptVersion.localeCompare(b.promptVersion));
}

/** Render the grouped outcome-rate table as a fixed-width string block. */
export function formatOutcomeTable(groups: OutcomeGroup[]): string {
  const header = [
    "promptVersion".padEnd(20),
    "expand".padStart(8),
    "repeat".padStart(8),
    "no_expand".padStart(10),
    "failure".padStart(9),
    "total".padStart(7),
    "expand%".padStart(9),
  ].join("  ");

  const lines = groups.map((g) =>
    [
      g.promptVersion.padEnd(20),
      String(g.counts.expand).padStart(8),
      String(g.counts.repeat).padStart(8),
      String(g.counts.no_expand).padStart(10),
      String(g.counts.failure_archived).padStart(9),
      String(g.total).padStart(7),
      `${(g.expandRate * 100).toFixed(1)}%`.padStart(9),
    ].join("  "),
  );

  return [header, "-".repeat(header.length), ...lines].join("\n");
}

/** LangSmith example payload for a single outcome row. */
export function outcomeToExample(row: OutcomeRow) {
  return {
    inputs: {
      hypothesisId: row.hypothesisId,
      recipeId: row.recipeId,
      promptVersion: row.promptVersion,
      model: row.model,
      provider: row.provider,
    },
    outputs: {
      outcome: row.outcome,
      failureReason: row.failureReason,
    },
    metadata: {
      source: "studio_outcome",
      compositionId: row.compositionId,
    },
  };
}
