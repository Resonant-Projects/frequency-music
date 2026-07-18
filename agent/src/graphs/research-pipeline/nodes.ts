import { z } from "zod";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { callConvex } from "../../tools/convexTools.js";
import {
  createResearchDeepAgentDraft,
  hypothesisDraftPayloadSchema,
  recipeDraftPayloadSchema,
  RESEARCH_DRAFT_SPECIALIST_INSTRUCTIONS,
  sanitizeSpecialistDraft,
  type ResearchDraftSpecialistInput,
} from "../../agents/research-pipeline/deepAgent.js";
import { runCodexTask } from "../../subagents/codexWorker.js";
import { findHallucinatedIds, hallucinatedIdError } from "./idGate.js";
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
    .replaceAll(
      /((?:api[_-]?key|secret|token|password|passwd)\s*[=:]\s*)[^\s"'}]+/gi,
      "$1[REDACTED]",
    )
    .replaceAll(/(PVEAPIToken=)[^\s"'}]+/gi, "$1[REDACTED]");
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
    await callConvex("appendAgentRunEvent", {
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
  // Double-create guard: when the production worker claims a pre-queued
  // agentRun it threads the claimed Convex run id in as `agentRunId`. In that
  // case we must NOT call createAgentRun again (which would spawn a second
  // audit record); we reuse the claimed id and only record a status event.
  if (state.agentRunId) {
    return {
      agentRunId: state.agentRunId,
      auditEvents: await appendRemoteAuditEvent(
        state.agentRunId,
        "status",
        "Reused claimed Convex agent-run audit record",
        { agentRunId: state.agentRunId, langGraphRunId: state.runId },
      ),
    };
  }

  const input = {
    dryRun: state.dryRun ?? true,
    smokeMode: state.smokeMode ?? false,
    limit: state.limit ?? 10,
    langGraphRunId: state.runId,
  };

  try {
    const created = await callConvex("createAgentRun", {
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

// Reference fields whose values become "seen" ids the hallucinated-ID gate
// trusts. We record the primary id of every read row PLUS any nested reference
// ids (an extraction carries its sourceId, a recipe its hypothesisId, etc.).
const ID_STRING_FIELDS = [
  "_id",
  "sourceId",
  "thesisId",
  "hypothesisId",
  "recipeId",
  "extractionId",
];
const ID_ARRAY_FIELDS = ["sourceIds", "extractionIds", "hypothesisIds"];

function collectRecordIds(record: Record<string, unknown>): string[] {
  const ids: string[] = [];
  for (const field of ID_STRING_FIELDS) {
    const value = record[field];
    if (typeof value === "string" && value.length > 0) ids.push(value);
  }
  for (const field of ID_ARRAY_FIELDS) {
    const value = record[field];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.length > 0) ids.push(item);
      }
    }
  }
  return ids;
}

/** Gather every id the run read across the provided scope result groups. */
function collectScopeIds(...groups: unknown[]): string[] {
  const ids: string[] = [];
  for (const group of groups) {
    for (const record of asRecords(group)) {
      ids.push(...collectRecordIds(record));
    }
  }
  return ids;
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
    ["activeTheses", () => callConvex("listActiveTheses", { limit })],
    ["recentExtractions", () => callConvex("listRecentExtractions", { limit })],
    ["recentHypotheses", () => callConvex("listRecentHypotheses", { limit })],
    ["recentRecipes", () => callConvex("getRecentRecipes", { limit })],
    ["failureArchive", () => callConvex("listFailureArchive", { limit })],
    ["recommendedActions", () => callConvex("getRecommendedActions", {})],
    [
      "editorialSignals",
      () => callConvex("getEditorialSignals", { limit: 24 }),
    ],
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
    // Record every id the scope read so the hallucinated-ID gate can trust
    // exactly these — and reject any payload id the model fabricates.
    seenIds: collectScopeIds(
      values.activeTheses,
      values.recentExtractions,
      values.recentHypotheses,
      values.recentRecipes,
      values.failureArchive,
      values.recommendedActions,
    ),
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
      seenIds: candidates.map((candidate) => candidate.id),
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
    seenIds: candidates.map((candidate) => candidate.id),
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

// Output shape Codex must produce for the CODEX_SPECIALIST path. Mirrors the
// OpenRouter specialist's JSON contract (RESEARCH_DRAFT_SPECIALIST_INSTRUCTIONS)
// so both paths pass through the same `sanitizeSpecialistDraft` gate below.
const codexSpecialistOutputSchema = z.object({
  kind: z.enum(["hypothesis_draft", "recipe_draft"]),
  title: z.string(),
  summary: z.string(),
  candidateIds: z.array(z.string()),
  needsReview: z.boolean(),
  payload: z
    .union([hypothesisDraftPayloadSchema, recipeDraftPayloadSchema])
    .optional(),
});

/** provider/model/usage/threadId for the per-model-call agentRunEvents event. */
interface ModelCallInfo {
  provider: string;
  model?: string;
  usage?: unknown;
  threadId?: string;
}

interface SpecialistOutcome {
  draft: ResearchPipelineDraft;
  provider: string;
  usedFallback: boolean;
  warning?: string;
  /** Present whenever a model actually answered; absent on a total failure. */
  modelCall?: ModelCallInfo;
}

function specialistContext(input: ResearchDraftSpecialistInput) {
  return {
    selectedCandidate: input.selectedCandidate,
    candidateCount: input.candidates.length,
    fallbackDraft: input.fallbackDraft,
    scope: input.scope,
  };
}

async function createReviewDraftViaOpenRouter(
  input: ResearchDraftSpecialistInput,
  options: { model?: BaseChatModel } = {},
): Promise<SpecialistOutcome> {
  const specialist = await createResearchDeepAgentDraft(input, options);
  const llmOutput = specialist.llmOutput;
  // withFallback tags llmOutput.provider with whichever provider actually
  // answered (codex-sdk or openrouter-anthropic), which is more accurate than
  // the static getConfiguredModelProvider() label specialist.provider carries.
  const answeringProvider =
    typeof llmOutput?.provider === "string"
      ? llmOutput.provider
      : specialist.provider;
  return {
    draft: specialist.draft,
    provider: answeringProvider,
    usedFallback: specialist.usedFallback,
    warning: specialist.warning,
    modelCall: llmOutput
      ? {
          provider: answeringProvider,
          model:
            typeof llmOutput.model === "string" ? llmOutput.model : undefined,
          usage: llmOutput.usage,
          threadId:
            typeof llmOutput.threadId === "string"
              ? llmOutput.threadId
              : undefined,
        }
      : undefined,
  };
}

/**
 * CODEX_SPECIALIST=true alternative specialist implementation: delegates the
 * whole draft subtask to a Codex thread (default read-only sandbox) instead
 * of a single OpenRouter completion, then passes the parsed result through
 * the same `sanitizeSpecialistDraft` gate as the OpenRouter path so the node
 * output shape is identical either way. On any Codex failure this falls back
 * to the OpenRouter specialist path — Codex being down must never fail the
 * run (plan's standing rule).
 */
async function createReviewDraftViaCodex(
  input: ResearchDraftSpecialistInput,
  codexRunner: typeof runCodexTask,
  fallbackOptions: { model?: BaseChatModel } = {},
): Promise<SpecialistOutcome> {
  // One variable feeds both the thread's model override and the audit label,
  // so the model_call event never reports a model the thread didn't run with.
  const codexModel = process.env.CODEX_MODEL || undefined;
  try {
    const result = await codexRunner({
      instructions: RESEARCH_DRAFT_SPECIALIST_INSTRUCTIONS,
      context: specialistContext(input),
      outputSchema: codexSpecialistOutputSchema,
      model: codexModel,
    });
    const draft = sanitizeSpecialistDraft(result.output, input.fallbackDraft);
    return {
      draft: draft ?? input.fallbackDraft,
      provider: "codex-sdk",
      usedFallback: !draft,
      warning: draft
        ? undefined
        : "Codex specialist returned an unparsable draft.",
      // Store the thread id in the model_call audit event so a long-running
      // task can be resumed with resumeThread after a worker restart.
      modelCall: {
        provider: "codex-sdk",
        model: codexModel ?? "codex-default",
        usage: result.usage ?? undefined,
        threadId: result.threadId ?? undefined,
      },
    };
  } catch (error) {
    const fallback = await createReviewDraftViaOpenRouter(
      input,
      fallbackOptions,
    );
    const codexMessage = errorMessage(error);
    return {
      ...fallback,
      usedFallback: true,
      warning: fallback.warning
        ? `Codex specialist unavailable (${codexMessage}); ${fallback.warning}`
        : `Codex specialist unavailable (${codexMessage}); used OpenRouter fallback.`,
    };
  }
}

/**
 * `runCodexTask` and `model` are injectable so routing can be unit-tested
 * without a live Codex CLI or configured model provider.
 */
export async function createSpecialistOutcome(
  input: ResearchDraftSpecialistInput,
  options: { runCodexTask?: typeof runCodexTask; model?: BaseChatModel } = {},
): Promise<SpecialistOutcome> {
  if (process.env.CODEX_SPECIALIST === "true") {
    return createReviewDraftViaCodex(
      input,
      options.runCodexTask ?? runCodexTask,
      {
        model: options.model,
      },
    );
  }
  return createReviewDraftViaOpenRouter(input, { model: options.model });
}

export async function createReviewDraftNode(
  state: ResearchPipelineState,
): Promise<ResearchPipelineUpdate> {
  const fallbackDraft = buildNeedsReviewDraft({
    selectedCandidate: state.selectedCandidate,
    candidates: state.candidates,
  });
  const specialistInput: ResearchDraftSpecialistInput = {
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
  };

  const outcome = await createSpecialistOutcome(specialistInput);
  const draft = outcome.draft;

  // Per-model-call quota audit trail called for in 00-master-sequence.md:
  // provider used, model, usage, and threadId when Codex answered.
  const modelCallEvents = outcome.modelCall
    ? await appendRemoteAuditEvent(
        state.agentRunId,
        "model_call",
        `Recorded ${outcome.modelCall.provider} specialist model call`,
        outcome.modelCall,
      )
    : [];

  // Hallucinated-ID gate: a payload-bearing draft may only reference ids the
  // run actually read. If the specialist fabricated any id we FAIL the run
  // loudly (push to errors) so finalizeRunNode marks it failed and never
  // persists the draft.
  if (draft.payload) {
    const hallucinatedIds = findHallucinatedIds(draft.payload, state.seenIds);
    if (hallucinatedIds.length > 0) {
      const gateError = hallucinatedIdError(hallucinatedIds);
      return {
        draft,
        route: "stop",
        errors: [gateError],
        auditEvents: [
          ...modelCallEvents,
          ...(await appendRemoteAuditEvent(
            state.agentRunId,
            "error",
            "Rejected research-pipeline draft: hallucinated-ID gate tripped",
            { hallucinatedIds, draftKind: draft.kind, title: draft.title },
          )),
        ],
      };
    }
  }

  const auditPayload = {
    draftKind: draft.kind,
    title: draft.title,
    candidateIds: draft.candidateIds,
    provider: outcome.provider,
    usedFallback: outcome.usedFallback,
    warning: outcome.warning ? errorMessage(outcome.warning) : undefined,
  };

  return {
    draft,
    route: "stop",
    auditEvents: [
      ...modelCallEvents,
      ...(await appendRemoteAuditEvent(
        state.agentRunId,
        "review_request",
        outcome.usedFallback
          ? "Prepared fallback research-pipeline draft for human review"
          : "Prepared Codex/deep-agent research-pipeline draft for human review",
        auditPayload,
      )),
    ],
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
        await callConvex("markAgentRunFailed", {
          runId: state.agentRunId,
          summary,
          error: { messages: state.errors },
        });
      } else if (needsReview) {
        await callConvex("markAgentRunNeedsReview", {
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
                // Forward the validated payload so promotion is loss-free. The
                // server re-validates it; a payload-less draft stays acknowledged-only.
                ...(draft.payload
                  ? {
                      payload: draft.payload as unknown as Record<
                        string,
                        unknown
                      >,
                    }
                  : {}),
              }
            : undefined;
        if (reviewDraft) {
          try {
            const persistedDraft = await callConvex("createAgentReviewDraft", {
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
          } catch (draftError) {
            // A needs_review run with no persisted draft can never be closed by a
            // human. Fail the run so it leaves the review queue instead of
            // wedging. See plan 013.
            const draftFailureMessage = errorMessage(draftError);
            auditEvents.push(
              ...(await appendRemoteAuditEvent(
                state.agentRunId,
                "error",
                "Failed to persist human-review draft row",
                {
                  message: draftFailureMessage,
                },
              )),
            );
            try {
              await callConvex("markAgentRunFailed", {
                runId: state.agentRunId,
                summary,
                error: { messages: [...state.errors, draftFailureMessage] },
              });
            } catch (markError) {
              // Swallow like runner.ts markFailed: the reconcile cron is the
              // backstop for a run this path could not transition.
              auditEvents.push(
                nowEvent(
                  "error",
                  "Failed to mark run failed after draft-write error",
                  {
                    message: errorMessage(markError),
                  },
                ),
              );
            }
          }
        }
      } else {
        await callConvex("markAgentRunCompleted", {
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
