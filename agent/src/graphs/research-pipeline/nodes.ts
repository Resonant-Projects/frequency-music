import {
  appendAgentRunEvent,
  createAgentRun,
  getEditorialSignals,
  getRecentRecipes,
  getRecommendedActions,
  listActiveTheses,
  listFailureArchive,
  listRecentExtractions,
  listRecentHypotheses,
  markAgentRunCompleted,
  markAgentRunFailed,
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function runIdFrom(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const runId = (value as { runId?: unknown }).runId;
  return typeof runId === "string" ? runId : undefined;
}

async function appendRemoteAuditEvent(
  agentRunId: string | undefined,
  kind: AuditEvent["kind"],
  message: string,
  payload?: unknown,
): Promise<AuditEvent[]> {
  const localEvent = nowEvent(kind, message, payload);
  if (!agentRunId) return [localEvent];

  try {
    await appendAgentRunEvent.invoke({ runId: agentRunId, kind, message, payload });
    return [localEvent];
  } catch (error) {
    return [
      localEvent,
      nowEvent("error", "Failed to append remote agent-run audit event", {
        message: errorMessage(error),
      }),
    ];
  }
}

export async function initializeRunNode(
  state: ResearchPipelineState,
): Promise<ResearchPipelineUpdate> {
  const input = {
    dryRun: state.dryRun ?? true,
    limit: state.limit ?? 10,
    langGraphRunId: state.runId,
  };

  try {
    const created = await createAgentRun.invoke({
      graphName: "research-pipeline",
      input,
    });
    const agentRunId = runIdFrom(created);
    return {
      agentRunId,
      auditEvents: [nowEvent("status", "Initialized Convex agent-run audit record", { agentRunId })],
    };
  } catch (error) {
    return {
      auditEvents: [
        nowEvent("error", "Convex agent-run audit initialization unavailable", {
          message: errorMessage(error),
        }),
      ],
    };
  }
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
  try {
    const [
      activeTheses,
      recentExtractions,
      recentHypotheses,
      recentRecipes,
      failureArchive,
      recommendedActions,
      editorialSignals,
    ] = await Promise.all([
      listActiveTheses.invoke({ limit }),
      listRecentExtractions.invoke({ limit }),
      listRecentHypotheses.invoke({ limit }),
      getRecentRecipes.invoke({ limit }),
      listFailureArchive.invoke({ limit }),
      getRecommendedActions.invoke({}),
      getEditorialSignals.invoke({ limit: 24 }),
    ]);

    return {
      activeTheses: asRecords(activeTheses),
      recentExtractions: asRecords(recentExtractions),
      recentHypotheses: asRecords(recentHypotheses),
      recentRecipes: asRecords(recentRecipes),
      failureArchive: asRecords(failureArchive),
      recommendedActions: asRecords(recommendedActions),
      editorialSignals: asRecords(editorialSignals),
      auditEvents: await appendRemoteAuditEvent(
        state.agentRunId,
        "tool_call",
        "Loaded research-pipeline scope from Convex",
        { limit },
      ),
    };
  } catch (error) {
    const message = "Failed to load research-pipeline scope from Convex";
    return {
      errors: [`${message}: ${errorMessage(error)}`],
      auditEvents: await appendRemoteAuditEvent(state.agentRunId, "error", message, {
        message: errorMessage(error),
      }),
    };
  }
}

export async function selectCandidatesNode(state: ResearchPipelineState): Promise<ResearchPipelineUpdate> {
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
    auditEvents: await appendRemoteAuditEvent(
      state.agentRunId,
      "decision",
      "Selected research-pipeline candidate",
      {
        selectedCandidate,
        candidateCount: candidates.length,
      },
    ),
  };
}

export function routeCandidateNode(state: ResearchPipelineState): CandidateRoute {
  return state.route ?? state.selectedCandidate?.route ?? "stop";
}

export async function finalizeRunNode(state: ResearchPipelineState): Promise<ResearchPipelineUpdate> {
  const selected = state.selectedCandidate;
  const title = selected
    ? `Dry run: ${selected.title ?? selected.id}`
    : "Dry run: no candidate selected";
  const summary = selected
    ? `Selected ${selected.kind} ${selected.id} for route '${selected.route}' because: ${selected.reason}`
    : "No suitable research-pipeline candidate was found from the current Convex scope.";
  const hasErrors = state.errors.length > 0;

  const auditEvents = await appendRemoteAuditEvent(
    state.agentRunId,
    hasErrors ? "error" : "status",
    hasErrors ? "Finalized failed dry-run research-pipeline result" : "Finalized dry-run research-pipeline result",
    { summary, errorCount: state.errors.length },
  );

  if (state.agentRunId) {
    try {
      if (hasErrors) {
        await markAgentRunFailed.invoke({
          runId: state.agentRunId,
          summary,
          error: { messages: state.errors },
        });
      } else {
        await markAgentRunCompleted.invoke({ runId: state.agentRunId, summary });
      }
    } catch (error) {
      auditEvents.push(
        nowEvent("error", "Failed to mark remote agent run terminal status", {
          message: errorMessage(error),
        }),
      );
    }
  }

  return {
    draft: {
      kind: "dry_run_summary",
      title,
      summary,
      candidateIds: state.candidates.map((candidate) => candidate.id),
      needsReview: false,
    },
    auditEvents,
  };
}

export async function unsupportedWriteRouteNode(state: ResearchPipelineState): Promise<ResearchPipelineUpdate> {
  const route = state.route ?? "stop";
  const error = `Route '${route}' is recognized but write-producing specialist nodes are intentionally disabled; only agent-run audit writes are enabled.`;
  return {
    errors: [error],
    auditEvents: await appendRemoteAuditEvent(
      state.agentRunId,
      "decision",
      "Stopped before write-producing specialist route",
      { route },
    ),
  };
}
