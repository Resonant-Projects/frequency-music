import {
  getEditorialSignals,
  getRecentRecipes,
  getRecommendedActions,
  listActiveTheses,
  listFailureArchive,
  listRecentExtractions,
  listRecentHypotheses,
} from "../../tools/convexTools.js";
import type {
  AuditEvent,
  CandidateRoute,
  ResearchCandidate,
  ResearchPipelineState,
  ResearchPipelineUpdate,
} from "../../state/researchPipelineState.js";

function nowEvent(kind: AuditEvent["kind"], message: string, payload?: unknown): AuditEvent {
  return {
    kind,
    message,
    payload,
    createdAt: new Date().toISOString(),
  };
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function idOf(record: Record<string, unknown>, fallback: string) {
  const id = record._id ?? record.id ?? record.key;
  return typeof id === "string" ? id : fallback;
}

function titleOf(record: Record<string, unknown>) {
  const title = record.title ?? record.name ?? record.headline;
  return typeof title === "string" ? title : undefined;
}

export async function loadScopeNode(
  state: ResearchPipelineState,
): Promise<ResearchPipelineUpdate> {
  const limit = state.limit ?? 10;
  const [activeTheses, recentExtractions, recentHypotheses, recentRecipes, failureArchive, recommendedActions] =
    await Promise.all([
      listActiveTheses.invoke({ limit }),
      listRecentExtractions.invoke({ limit }),
      listRecentHypotheses.invoke({ limit }),
      getRecentRecipes.invoke({ limit }),
      listFailureArchive.invoke({ limit }),
      getRecommendedActions.invoke({}),
      getEditorialSignals.invoke({ limit: 24 }),
    ]).then((results) => [
      results[0],
      results[1],
      results[2],
      results[3],
      results[4],
      results[5],
    ]);

  return {
    activeTheses: asRecords(activeTheses),
    recentExtractions: asRecords(recentExtractions),
    recentHypotheses: asRecords(recentHypotheses),
    recentRecipes: asRecords(recentRecipes),
    failureArchive: asRecords(failureArchive),
    recommendedActions: asRecords(recommendedActions),
    auditEvents: [
      nowEvent("tool_call", "Loaded research-pipeline scope from Convex", {
        limit,
      }),
    ],
  };
}

export function selectCandidatesNode(state: ResearchPipelineState): ResearchPipelineUpdate {
  const candidates: ResearchCandidate[] = [];

  asRecords(state.recommendedActions).slice(0, 5).forEach((action, index) => {
    candidates.push({
      id: idOf(action, `recommended-action-${index}`),
      kind: "recommended_action",
      route: "critique",
      title: titleOf(action),
      reason: "Convex deterministic recommended action selected for agent critique.",
      score: 100 - index,
    });
  });

  asRecords(state.recentExtractions).slice(0, 5).forEach((extraction, index) => {
    const claims = Array.isArray(extraction.claims) ? extraction.claims.length : 0;
    const params = Array.isArray(extraction.compositionParameters)
      ? extraction.compositionParameters.length
      : 0;
    if (claims >= 2 || params > 0) {
      candidates.push({
        id: idOf(extraction, `extraction-${index}`),
        kind: "extraction",
        route: "hypothesize",
        title: titleOf(extraction),
        reason: `Recent extraction has ${claims} claims and ${params} composition parameters.`,
        score: 80 + claims + params,
      });
    }
  });

  candidates.sort((left, right) => right.score - left.score);
  const selectedCandidate = candidates[0];

  return {
    candidates,
    selectedCandidate,
    route: selectedCandidate?.route ?? "stop",
    auditEvents: [
      nowEvent("decision", "Selected research-pipeline candidate", {
        selectedCandidate,
        candidateCount: candidates.length,
      }),
    ],
  };
}

export function routeCandidateNode(state: ResearchPipelineState): CandidateRoute {
  return state.route ?? state.selectedCandidate?.route ?? "stop";
}

export function finalizeRunNode(state: ResearchPipelineState): ResearchPipelineUpdate {
  const selected = state.selectedCandidate;
  const title = selected
    ? `Dry run: ${selected.title ?? selected.id}`
    : "Dry run: no candidate selected";
  const summary = selected
    ? `Selected ${selected.kind} ${selected.id} for route '${selected.route}' because: ${selected.reason}`
    : "No suitable research-pipeline candidate was found from the current Convex scope.";

  return {
    draft: {
      kind: "dry_run_summary",
      title,
      summary,
      candidateIds: state.candidates.map((candidate) => candidate.id),
      needsReview: false,
    },
    auditEvents: [nowEvent("summary", "Finalized dry-run research-pipeline result")],
  };
}

export function unsupportedWriteRouteNode(state: ResearchPipelineState): ResearchPipelineUpdate {
  const route = state.route ?? "stop";
  return {
    errors: [
      `Route '${route}' is recognized but write-producing specialist nodes are intentionally disabled until agent run audit/write tools are implemented.`,
    ],
    auditEvents: [nowEvent("decision", "Stopped before write-producing specialist route", { route })],
  };
}
