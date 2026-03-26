import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

export const failureReasonValidator = v.union(
  v.literal("contradicted_hypothesis"),
  v.literal("retired_hypothesis"),
  v.literal("archived_recipe"),
  v.literal("low_expandability_composition"),
  v.literal("repeat_no_expand_composition"),
);

export const failureActionValidator = v.union(
  v.literal("revisit"),
  v.literal("compare"),
  v.literal("leave_archived"),
);

export const yieldBandValidator = v.union(
  v.literal("high"),
  v.literal("mixed"),
  v.literal("low"),
);

export type FailureReason =
  | "contradicted_hypothesis"
  | "retired_hypothesis"
  | "archived_recipe"
  | "low_expandability_composition"
  | "repeat_no_expand_composition";

export type FailureAction = "revisit" | "compare" | "leave_archived";
export type YieldBand = "high" | "mixed" | "low";

export type FailureArchiveEntry = {
  key: string;
  reason: FailureReason;
  createdAt: number;
  title: string;
  summary: string;
  thesisId?: Id<"theses">;
  hypothesisId?: Id<"hypotheses">;
  recipeId?: Id<"recipes">;
  compositionId?: Id<"compositions">;
  latestListeningSessionId?: Id<"listeningSessions">;
  revisionBranchRootId?: Id<"compositions">;
  explanation: string;
  recommendedNextAction: FailureAction;
  supportingIds: {
    hypothesisIds: Id<"hypotheses">[];
    recipeIds: Id<"recipes">[];
    compositionIds: Id<"compositions">[];
    listeningSessionIds: Id<"listeningSessions">[];
    thesisIds: Id<"theses">[];
  };
};

export type ListeningSummary = {
  latestExpandVerdict?: "yes" | "maybe" | "no";
  latestExpandability?: number;
  lowOutcomeCount: number;
  latestListeningSessionId?: Id<"listeningSessions">;
};

export type GraphSignalScore = {
  positiveSignals: number;
  negativeSignals: number;
  netYieldScore: number;
  yieldBand: YieldBand;
};

export function isLowYieldListeningSession(
  session: Pick<Doc<"listeningSessions">, "expandVerdict" | "ratings">,
): boolean {
  return (
    session.expandVerdict === "no" ||
    (session.ratings.expandability ?? Number.POSITIVE_INFINITY) <= 2
  );
}

export function summarizeListeningSessions(
  sessions: Doc<"listeningSessions">[],
): ListeningSummary {
  const sorted = [...sessions].toSorted((a, b) => b.createdAt - a.createdAt);
  const latest = sorted[0];
  const lowOutcomeCount = sorted.filter(isLowYieldListeningSession).length;

  return {
    latestExpandVerdict: latest?.expandVerdict,
    latestExpandability: latest?.ratings.expandability,
    latestListeningSessionId: latest?._id,
    lowOutcomeCount,
  };
}

export function inferFailureAction(reason: FailureReason): FailureAction {
  switch (reason) {
    case "contradicted_hypothesis":
      return "compare";
    case "retired_hypothesis":
      return "leave_archived";
    case "archived_recipe":
      return "revisit";
    case "low_expandability_composition":
      return "compare";
    case "repeat_no_expand_composition":
      return "leave_archived";
  }
}

export function classifyYieldBand(score: number): YieldBand {
  if (score >= 6) return "high";
  if (score <= -1) return "low";
  return "mixed";
}

export function scoreEditorialSignals(args: {
  linkedHypotheses: number;
  linkedRecipes: number;
  linkedCompositions: number;
  supportedHypotheses: number;
  contradictedHypotheses: number;
  retiredHypotheses: number;
  archivedRecipes: number;
  compositionsYes: number;
  compositionsMaybe: number;
  compositionsNo: number;
  compositionsLowExpandability: number;
}): GraphSignalScore {
  const positiveSignals =
    args.linkedHypotheses * 2 +
    args.linkedRecipes * 3 +
    args.linkedCompositions * 4 +
    args.supportedHypotheses * 2 +
    args.compositionsYes * 4 +
    args.compositionsMaybe * 1;

  const negativeSignals =
    args.contradictedHypotheses * 4 +
    args.retiredHypotheses * 2 +
    args.archivedRecipes * 2 +
    args.compositionsNo * 3 +
    args.compositionsLowExpandability * 2;

  const netYieldScore = positiveSignals - negativeSignals;

  return {
    positiveSignals,
    negativeSignals,
    netYieldScore,
    yieldBand: classifyYieldBand(netYieldScore),
  };
}
