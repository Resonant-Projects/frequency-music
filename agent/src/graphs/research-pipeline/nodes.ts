import {
  appendAgentRunEvent,
  createAgentReviewDraft,
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
  markAgentRunNeedsReview,
} from "../../tools/convexTools.js";
import { createResearchDeepAgentDraft } from "../../agents/research-pipeline/deepAgent.js";
import type {
  AuditEvent,
  CandidateRoute,
  ResearchCandidate,
  ResearchPipelineDraft,
  ResearchPipelineState,
  ResearchPipelineUpdate,
} from "../../state/researchPipelineState.js";

function nowEvent(
  kind: AuditEvent["kind"],
  message: string,
  payload?: unknown,
): AuditEvent {
  return {
    kind,
    message,
    payload,
    createdAt: new Date().toISOString(),
  };
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(
      /((?:api[_-]?key|secret|token|password|passwd)\s*[=:]\s*)[^\s"'}]+/gi,
      "$1[REDACTED]",
    )
    .replace(/(PVEAPIToken=)[^\s"'}]+/gi, "$1[REDACTED]");
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
    await appendAgentRunEvent.invoke({
      runId: agentRunId,
      kind,
      message,
      payload,
    });
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
    smokeMode: state.smokeMode ?? false,
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
      auditEvents: [
        nowEvent("status", "Initialized Convex agent-run audit record", {
          agentRunId,
        }),
      ],
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

export function buildNeedsReviewDraft(input: {
  selectedCandidate?: ResearchCandidate;
  candidates: ResearchCandidate[];
}): ResearchPipelineDraft {
  const selected = input.selectedCandidate;
  const draftKind: ResearchPipelineDraft["kind"] =
    selected?.route === "recipe" ? "recipe_draft" : "hypothesis_draft";
  const title = selected
    ? `Review draft: ${selected.title ?? selected.id}`
    : "Review draft: no candidate selected";
  const summary = selected
    ? `Draft ${draftKind === "recipe_draft" ? "recipe" : "hypothesis"} candidate from ${selected.kind} ${selected.id}. Route: ${selected.route}. Rationale: ${selected.reason}`
    : "No suitable research-pipeline candidate was found from the current Convex scope.";

  return {
    kind: draftKind,
    title,
    summary,
    candidateIds: selected
      ? [selected.id]
      : input.candidates.map((candidate) => candidate.id),
    needsReview: true,
  };
}

export async function loadScopeNode(
  state: ResearchPipelineState,
): Promise<ResearchPipelineUpdate> {
  const limit = state.limit ?? 10;
  const scopeTools = [
    ["activeTheses", () => listActiveTheses.invoke({ limit })],
    ["recentExtractions", () => listRecentExtractions.invoke({ limit })],
    ["recentHypotheses", () => listRecentHypotheses.invoke({ limit })],
    ["recentRecipes", () => getRecentRecipes.invoke({ limit })],
    ["failureArchive", () => listFailureArchive.invoke({ limit })],
    ["recommendedActions", () => getRecommendedActions.invoke({})],
    ["editorialSignals", () => getEditorialSignals.invoke({ limit: 24 })],
  ] as const;

  const settled = await Promise.all(
    scopeTools.map(async ([key, invoke]) => {
      try {
        return { key, value: await invoke() };
      } catch (error) {
        return { key, error: errorMessage(error) };
      }
    }),
  );
  const values = Object.fromEntries(
    settled.map((result) => [
      result.key,
      "value" in result ? result.value : [],
    ]),
  ) as Record<string, unknown>;
  const warnings = settled
    .filter((result) => "error" in result)
    .map((result) => ({ tool: result.key, message: result.error }));
  const modeLabel = state.smokeMode ? "smoke" : "real dry-run";

  return {
    activeTheses: asRecords(values.activeTheses),
    recentExtractions: asRecords(values.recentExtractions),
    recentHypotheses: asRecords(values.recentHypotheses),
    recentRecipes: asRecords(values.recentRecipes),
    failureArchive: asRecords(values.failureArchive),
    recommendedActions: asRecords(values.recommendedActions),
    editorialSignals: asRecords(values.editorialSignals),
    auditEvents: await appendRemoteAuditEvent(
      state.agentRunId,
      warnings.length > 0 ? "status" : "tool_call",
      warnings.length > 0
        ? `Loaded research-pipeline ${modeLabel} scope from Convex with non-fatal warnings`
        : `Loaded research-pipeline ${modeLabel} scope from Convex`,
      { limit, warnings },
    ),
  };
}

export async function selectCandidatesNode(
  state: ResearchPipelineState,
): Promise<ResearchPipelineUpdate> {
  const candidates: ResearchCandidate[] = [];

  asRecords(state.recommendedActions)
    .slice(0, 5)
    .forEach((action, index) => {
      candidates.push({
        id: idOf(action, `recommended-action-${index}`),
        kind: "recommended_action",
        route: "critique",
        title: titleOf(action),
        reason:
          "Convex deterministic recommended action selected for agent critique.",
        score: 100 - index,
      });
    });

  asRecords(state.recentExtractions)
    .slice(0, 5)
    .forEach((extraction, index) => {
      const claims = Array.isArray(extraction.claims)
        ? extraction.claims.length
        : 0;
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

  if (state.smokeMode) {
    const selectedCandidate = candidates[0]
      ? {
          ...candidates[0],
          route: "stop" as const,
          reason: `Smoke mode selected this candidate for read/audit verification only. Original route: ${candidates[0].route}.`,
        }
      : undefined;
    return {
      candidates,
      selectedCandidate,
      route: "stop",
      auditEvents: await appendRemoteAuditEvent(
        state.agentRunId,
        "decision",
        "Selected research-pipeline smoke candidate",
        {
          selectedCandidate,
          candidateCount: candidates.length,
        },
      ),
    };
  }

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

export function routeCandidateNode(
  state: ResearchPipelineState,
): CandidateRoute {
  return state.route ?? state.selectedCandidate?.route ?? "stop";
}

export async function createReviewDraftNode(
  state: ResearchPipelineState,
): Promise<ResearchPipelineUpdate> {
  // TODO(plan-01 T5): behind CODEX_SPECIALIST==="true", route this specialist
  // call through `runCodexTask` (src/subagents/codexWorker.ts) to produce the
  // same ResearchPipelineDraft via sanitizeSpecialistDraft, and store the
  // returned threadId in agentRunEvents for resumeThread after restarts. Kept
  // out of this pass to avoid deep graph edits (nodes.ts is a cross-plan
  // chokepoint with plan 05).
  const fallbackDraft = buildNeedsReviewDraft({
    selectedCandidate: state.selectedCandidate,
    candidates: state.candidates,
  });
  const specialist = await createResearchDeepAgentDraft({
    selectedCandidate: state.selectedCandidate,
    candidates: state.candidates,
    fallbackDraft,
    scope: {
      activeTheses: state.activeTheses,
      recentExtractions: state.recentExtractions,
      recentHypotheses: state.recentHypotheses,
      recentRecipes: state.recentRecipes,
      failureArchive: state.failureArchive,
      editorialSignals: state.editorialSignals,
    },
  });
  const draft = specialist.draft;
  // TODO(plan-01 T3): append a per-model-call agentRunEvents event capturing
  // the provider that actually answered (read response.llmOutput.provider from
  // withFallback rather than the static getConfiguredModelProvider() label),
  // the model, usage, and threadId when Codex answered. Deferred to a later
  // Convex-coordinated wave; `specialist.provider` below is still the static
  // configured label and may not reflect the answering provider after fallback.
  const auditPayload = {
    draftKind: draft.kind,
    title: draft.title,
    candidateIds: draft.candidateIds,
    provider: specialist.provider,
    usedFallback: specialist.usedFallback,
    warning: specialist.warning ? errorMessage(specialist.warning) : undefined,
  };

  return {
    draft,
    route: "stop",
    auditEvents: await appendRemoteAuditEvent(
      state.agentRunId,
      "review_request",
      specialist.usedFallback
        ? "Prepared fallback research-pipeline draft for human review"
        : "Prepared Codex/deep-agent research-pipeline draft for human review",
      auditPayload,
    ),
  };
}

export async function finalizeRunNode(
  state: ResearchPipelineState,
): Promise<ResearchPipelineUpdate> {
  const selected = state.selectedCandidate;
  const title = selected
    ? `Dry run: ${selected.title ?? selected.id}`
    : "Dry run: no candidate selected";
  const summary = selected
    ? `Selected ${selected.kind} ${selected.id} for route '${selected.route}' because: ${selected.reason}`
    : "No suitable research-pipeline candidate was found from the current Convex scope.";
  const hasErrors = state.errors.length > 0;
  const needsReview = state.draft?.needsReview === true;

  const auditEvents = await appendRemoteAuditEvent(
    state.agentRunId,
    hasErrors ? "error" : needsReview ? "review_request" : "status",
    hasErrors
      ? "Finalized failed dry-run research-pipeline result"
      : needsReview
        ? "Finalized research-pipeline draft awaiting human review"
        : "Finalized dry-run research-pipeline result",
    { summary, errorCount: state.errors.length, needsReview },
  );

  if (state.agentRunId) {
    try {
      if (hasErrors) {
        await markAgentRunFailed.invoke({
          runId: state.agentRunId,
          summary,
          error: { messages: state.errors },
        });
      } else if (needsReview) {
        await markAgentRunNeedsReview.invoke({
          runId: state.agentRunId,
          summary,
          reviewDraft: state.draft,
        });

        const draft = state.draft;
        const reviewDraft =
          draft && draft.kind !== "dry_run_summary"
            ? {
                kind: draft.kind,
                title: draft.title,
                summary: draft.summary,
                candidateIds: draft.candidateIds,
                needsReview: true as const,
              }
            : undefined;
        if (reviewDraft) {
          try {
            const persistedDraft = await createAgentReviewDraft.invoke({
              agentRunId: state.agentRunId,
              draft: reviewDraft,
            });
            if (
              persistedDraft &&
              typeof persistedDraft === "object" &&
              "draftId" in persistedDraft
            ) {
              auditEvents.push(
                nowEvent(
                  "draft_write",
                  "Persisted research-pipeline human-review draft",
                  {
                    draftId: (persistedDraft as { draftId?: unknown }).draftId,
                  },
                ),
              );
            }
          } catch (error) {
            auditEvents.push(
              ...(await appendRemoteAuditEvent(
                state.agentRunId,
                "error",
                "Failed to persist human-review draft row",
                {
                  message: errorMessage(error),
                },
              )),
            );
          }
        }
      } else {
        await markAgentRunCompleted.invoke({
          runId: state.agentRunId,
          summary,
        });
      }
    } catch (error) {
      auditEvents.push(
        nowEvent("error", "Failed to mark remote agent run terminal status", {
          message: errorMessage(error),
        }),
      );
    }
  }

  const finalDraft = needsReview
    ? state.draft
    : {
        kind: "dry_run_summary" as const,
        title,
        summary,
        candidateIds: state.candidates.map((candidate) => candidate.id),
        needsReview: false,
      };

  return {
    draft: finalDraft,
    auditEvents,
  };
}

export async function unsupportedWriteRouteNode(
  state: ResearchPipelineState,
): Promise<ResearchPipelineUpdate> {
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
