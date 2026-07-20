import { z } from "zod";
import { PENDING_DRAFT_CAP } from "../../../../convex/shared/agentContract.js";
import { hypothesisDraftPayloadZ } from "../../../../convex/shared/draftPayloads.js";
import { redactError } from "../../shared/redactError.js";
import type {
  DraftableCorrespondence,
  HypothesisDrafterState,
  HypothesisDrafterUpdate,
  HypothesisDraftContext,
} from "../../state/hypothesisDrafterState.js";
import { callConvex } from "../../tools/convexTools.js";
import { resolveCurrentTraceUrl } from "../../tracing/currentTrace.js";
import {
  appendRemoteAuditEvent,
  finalizeRunCompleted,
  type ToolCaller,
} from "../shared/audit.js";
import {
  createStructuredJudge,
  invokeJudgeOrError,
  type StructuredJudge,
} from "../shared/judge.js";
import { hypothesisDraftPrompt, hypothesisSelfCheckPrompt } from "./prompts.js";

export type { DraftableCorrespondence };

export const draftOutputSchema = hypothesisDraftPayloadZ.omit({
  sourceIds: true,
  extractionIds: true,
  correspondenceId: true,
  thesisId: true,
});

export const selfCheckOutputSchema = z.object({
  pass: z.boolean(),
  testable: z.boolean(),
  oneVariable: z.boolean(),
  evidenceGrounded: z.boolean(),
  feedback: z.string().trim().min(1),
});

type DraftOutput = z.infer<typeof draftOutputSchema>;
type DraftJudge = StructuredJudge<DraftOutput>;
type SelfCheckJudge = StructuredJudge<z.infer<typeof selfCheckOutputSchema>>;

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object",
      )
    : [];
}

function includesConcept(value: Record<string, unknown>, names: string[]) {
  const searchable = [
    value.title,
    value.question,
    value.hypothesis,
    ...(Array.isArray(value.concepts) ? value.concepts : []),
  ]
    .filter((entry): entry is string => typeof entry === "string")
    .join(" ")
    .toLowerCase();
  return names.some((name) => searchable.includes(name));
}

export function createCheckCapacityNode(callTool: ToolCaller = callConvex) {
  return async (state: {
    agentRunId?: string;
  }): Promise<HypothesisDrafterUpdate> => {
    const rawCount = await callTool("countPendingDrafts", {
      kind: "hypothesis_draft",
    });
    const pendingCount =
      typeof rawCount === "number" && Number.isFinite(rawCount) ? rawCount : 0;
    const capReached = pendingCount >= PENDING_DRAFT_CAP;
    const auditEvents = await appendRemoteAuditEvent(
      callTool,
      state.agentRunId,
      capReached ? "status" : "tool_call",
      capReached
        ? `drafting blocked: ${pendingCount} pending drafts await review`
        : "Checked pending hypothesis draft capacity",
      { pendingCount, cap: PENDING_DRAFT_CAP },
    );
    return { pendingCount, capReached, auditEvents };
  };
}

export const checkCapacityNode = createCheckCapacityNode();

export function routeAfterCapacity(
  state: Pick<HypothesisDrafterState, "capReached">,
) {
  return state.capReached ? "summarize" : "pick_target";
}

function targetScore(candidate: DraftableCorrespondence) {
  return (candidate.similarityScore ?? 0) * (candidate.noveltyScore ?? 0);
}

export function selectDraftTarget(candidates: DraftableCorrespondence[]) {
  const ranked = candidates
    .filter(
      (candidate) =>
        !candidate.hasExistingHypothesis && !candidate.hasPendingDraft,
    )
    .sort(
      (left, right) =>
        (left.status === "evidenced" ? 0 : 1) -
          (right.status === "evidenced" ? 0 : 1) ||
        targetScore(right) - targetScore(left) ||
        left.pairKey.localeCompare(right.pairKey),
    );
  return { target: ranked[0], runnerUp: ranked[1] };
}

export function createPickTargetNode(callTool: ToolCaller = callConvex) {
  return async (state: {
    agentRunId?: string;
  }): Promise<HypothesisDrafterUpdate> => {
    const rawCandidates = await callTool("listDraftableCorrespondences", {
      limit: 20,
    });
    const candidates = Array.isArray(rawCandidates)
      ? (rawCandidates as DraftableCorrespondence[])
      : [];
    const { target, runnerUp } = selectDraftTarget(candidates);
    const auditEvents = await appendRemoteAuditEvent(
      callTool,
      state.agentRunId,
      target ? "decision" : "status",
      target
        ? "Selected correspondence for hypothesis drafting"
        : "No draftable correspondence target found",
      target
        ? {
            selected: {
              correspondenceId: target.correspondenceId,
              pairKey: target.pairKey,
              status: target.status,
              score: targetScore(target),
            },
            runnerUp: runnerUp
              ? {
                  correspondenceId: runnerUp.correspondenceId,
                  pairKey: runnerUp.pairKey,
                  status: runnerUp.status,
                  score: targetScore(runnerUp),
                }
              : null,
          }
        : { candidates: candidates.length },
    );
    return { candidates, target, runnerUp, auditEvents };
  };
}

export const pickTargetNode = createPickTargetNode();

export function routeAfterTarget(
  state: Pick<HypothesisDrafterState, "target">,
) {
  return state.target ? "gather_context" : "summarize";
}

export function createGatherContextNode(callTool: ToolCaller = callConvex) {
  return async (state: {
    agentRunId?: string;
    target?: DraftableCorrespondence;
  }): Promise<HypothesisDrafterUpdate> => {
    if (!state.target) return { context: undefined };
    const names = [state.target.conceptA.name, state.target.conceptB.name].map(
      (name) => name.toLowerCase(),
    );
    const [sourcesA, sourcesB, recentHypotheses, failureArchive] =
      await Promise.all([
        callTool("searchSourcesByConcept", {
          conceptName: state.target.conceptA.name,
          limit: 10,
        }),
        callTool("searchSourcesByConcept", {
          conceptName: state.target.conceptB.name,
          limit: 10,
        }),
        callTool("listRecentHypotheses", { limit: 50 }),
        callTool("listFailureArchive", { limit: 50 }),
      ]);
    const sources = Array.from(
      new Map(
        [...asRecords(sourcesA), ...asRecords(sourcesB)].map((source) => [
          String(source._id ?? JSON.stringify(source)),
          source,
        ]),
      ).values(),
    );
    const context: HypothesisDraftContext = {
      evidenceClaims: state.target.evidenceClaims,
      sources,
      priorHypotheses: asRecords(recentHypotheses).filter((hypothesis) =>
        includesConcept(hypothesis, names),
      ),
      failureArchive: asRecords(failureArchive),
    };
    const auditEvents = await appendRemoteAuditEvent(
      callTool,
      state.agentRunId,
      "tool_call",
      "Gathered failure-aware hypothesis drafting context",
      {
        correspondenceId: state.target.correspondenceId,
        evidenceClaims: context.evidenceClaims.length,
        sources: context.sources.length,
        priorHypotheses: context.priorHypotheses.length,
        failureArchiveEntries: context.failureArchive.length,
      },
    );
    return { context, auditEvents };
  };
}

export const gatherContextNode = createGatherContextNode();

export function buildReviewDraft(
  target: DraftableCorrespondence,
  output: DraftOutput,
) {
  const payload = hypothesisDraftPayloadZ.parse({
    ...output,
    sourceIds: Array.from(
      new Set(target.evidenceClaims.map((claim) => claim.sourceId)),
    ),
    extractionIds: Array.from(
      new Set(target.evidenceClaims.map((claim) => claim.extractionId)),
    ),
    correspondenceId: target.correspondenceId,
  });
  return {
    kind: "hypothesis_draft" as const,
    title: payload.title,
    summary: payload.statement,
    candidateIds: [
      target.correspondenceId,
      ...target.evidenceClaims.map((claim) => claim.claimId),
    ],
    needsReview: true as const,
    payload,
  };
}

export function createDraftNode(
  dependencies: {
    judge?: DraftJudge;
    callTool?: ToolCaller;
    resolveTraceUrl?: typeof resolveCurrentTraceUrl;
  } = {},
) {
  const callTool = dependencies.callTool ?? callConvex;
  const resolveTraceUrl =
    dependencies.resolveTraceUrl ?? resolveCurrentTraceUrl;
  const judge = dependencies.judge ?? createStructuredJudge(draftOutputSchema);
  return async (
    state: Pick<
      HypothesisDrafterState,
      | "agentRunId"
      | "traceUrl"
      | "target"
      | "context"
      | "revisionCount"
      | "selfCheck"
    >,
  ): Promise<HypothesisDrafterUpdate> => {
    if (!state.target || !state.context) {
      return {
        discarded: true,
        discardReason: "missing target or gathered context",
      };
    }
    const generated = await invokeJudgeOrError({
      judge,
      prompt: hypothesisDraftPrompt(
        state.target,
        state.context,
        state.revisionCount > 0 ? state.selfCheck : undefined,
      ),
      callTool,
      agentRunId: state.agentRunId,
      traceUrl: state.traceUrl,
      errorEventMessage: "Discarded hypothesis draft after generation error",
      errorEventPayload: (message) => ({
        correspondenceId: state.target?.correspondenceId,
        reason: "draft_error",
        message,
      }),
    });
    if (generated.judgeError) {
      return {
        discarded: true,
        discardReason: generated.judgeError.message,
        auditEvents: generated.auditEvents,
      };
    }
    return {
      draft: buildReviewDraft(state.target, generated.verdict).payload,
      discarded: false,
      auditEvents: generated.auditEvents,
      traceUrl: await resolveTraceUrl(state.traceUrl),
    };
  };
}

export async function draftNode(
  state: Pick<
    HypothesisDrafterState,
    | "agentRunId"
    | "traceUrl"
    | "target"
    | "context"
    | "revisionCount"
    | "selfCheck"
  >,
): Promise<HypothesisDrafterUpdate> {
  return await createDraftNode()(state);
}

export function createSelfCheckNode(
  dependencies: { judge?: SelfCheckJudge; callTool?: ToolCaller } = {},
) {
  const callTool = dependencies.callTool ?? callConvex;
  const judge =
    dependencies.judge ?? createStructuredJudge(selfCheckOutputSchema);
  return async (
    state: Pick<
      HypothesisDrafterState,
      | "agentRunId"
      | "traceUrl"
      | "target"
      | "context"
      | "draft"
      | "revisionCount"
      | "discarded"
      | "discardReason"
    >,
  ): Promise<HypothesisDrafterUpdate> => {
    if (!state.target || !state.context || !state.draft) {
      return {
        discarded: true,
        discardReason:
          state.discardReason ?? "draft generation produced no payload",
      };
    }
    const checked = await invokeJudgeOrError({
      judge,
      prompt: hypothesisSelfCheckPrompt(
        state.target,
        state.context,
        state.draft,
      ),
      callTool,
      agentRunId: state.agentRunId,
      traceUrl: state.traceUrl,
      errorEventMessage: "Hypothesis self-check failed with judge error",
      errorEventPayload: (message) => ({
        correspondenceId: state.target?.correspondenceId,
        reason: "judge_error",
        message,
      }),
    });
    const rawVerdict = checked.judgeError
      ? {
          pass: false,
          testable: false,
          oneVariable: false,
          evidenceGrounded: false,
          feedback: checked.judgeError.message,
        }
      : checked.verdict;
    const verdict = {
      ...rawVerdict,
      pass:
        rawVerdict.pass &&
        rawVerdict.testable &&
        rawVerdict.oneVariable &&
        rawVerdict.evidenceGrounded,
    };
    if (verdict.pass) {
      return {
        selfCheck: verdict,
        discarded: false,
        auditEvents: checked.auditEvents,
      };
    }
    if (state.revisionCount < 1) {
      return {
        selfCheck: verdict,
        revisionCount: 1,
        discarded: false,
        auditEvents: checked.auditEvents,
      };
    }
    const auditEvents = [
      ...checked.auditEvents,
      ...(await appendRemoteAuditEvent(
        callTool,
        state.agentRunId,
        "decision",
        "Discarded hypothesis draft after failed self-check",
        {
          correspondenceId: state.target.correspondenceId,
          revisionCount: state.revisionCount,
          verdict,
        },
      )),
    ];
    return {
      selfCheck: verdict,
      discarded: true,
      discardReason: verdict.feedback,
      auditEvents,
    };
  };
}

export async function selfCheckNode(
  state: Pick<
    HypothesisDrafterState,
    | "agentRunId"
    | "traceUrl"
    | "target"
    | "context"
    | "draft"
    | "revisionCount"
    | "discarded"
    | "discardReason"
  >,
): Promise<HypothesisDrafterUpdate> {
  return await createSelfCheckNode()(state);
}

export function routeAfterSelfCheck(
  state: Pick<
    HypothesisDrafterState,
    "discarded" | "selfCheck" | "revisionCount"
  >,
) {
  if (state.discarded) return "summarize";
  if (state.selfCheck?.pass) return "write_draft";
  return state.revisionCount > 0 ? "draft" : "summarize";
}

export function createWriteDraftNode(callTool: ToolCaller = callConvex) {
  return async (
    state: Pick<HypothesisDrafterState, "agentRunId" | "target" | "draft">,
  ): Promise<HypothesisDrafterUpdate> => {
    if (!state.agentRunId || !state.target || !state.draft) {
      throw new Error("hypothesis-drafter requires run, target, and draft");
    }
    const reviewDraft = buildReviewDraft(state.target, state.draft);
    try {
      const persisted = (await callTool("createAgentReviewDraft", {
        agentRunId: state.agentRunId,
        draft: reviewDraft,
      })) as { draftId?: unknown };
      if (typeof persisted.draftId !== "string") {
        throw new Error("createAgentReviewDraft returned no draftId");
      }
      await callTool("markAgentRunNeedsReview", {
        runId: state.agentRunId,
        summary: `Hypothesis draft ${persisted.draftId} awaits human review`,
        reviewDraft: {
          kind: reviewDraft.kind,
          title: reviewDraft.title,
          summary: reviewDraft.summary,
          candidateIds: reviewDraft.candidateIds,
          needsReview: true,
        },
      });
      return { draftWritten: true, draftId: persisted.draftId };
    } catch (error) {
      const message = redactError(error);
      if (message.includes("DraftCapExceeded")) {
        const auditEvents = await appendRemoteAuditEvent(
          callTool,
          state.agentRunId,
          "status",
          "drafting blocked: pending draft cap reached during write",
          { correspondenceId: state.target.correspondenceId },
        );
        return {
          capReached: true,
          pendingCount: PENDING_DRAFT_CAP,
          draftWritten: false,
          discardReason: message,
          auditEvents,
        };
      }
      throw error;
    }
  };
}

export const writeDraftNode = createWriteDraftNode();

export function createSummarizeNode(callTool: ToolCaller = callConvex) {
  return async (
    state: HypothesisDrafterState,
  ): Promise<HypothesisDrafterUpdate> => {
    const summary = state.capReached
      ? `hypothesis-drafter completed: drafting blocked: ${state.pendingCount} pending drafts await review`
      : !state.target
        ? "hypothesis-drafter completed: no draftable correspondences"
        : state.discarded
          ? `hypothesis-drafter completed: discarded after self-check: ${state.discardReason ?? "quality gate failed"}`
          : state.draftWritten
            ? `hypothesis-drafter completed: draft ${state.draftId} awaits human review`
            : "hypothesis-drafter completed: no draft written";
    const auditEvents = state.draftWritten
      ? []
      : await finalizeRunCompleted(
          callTool,
          state.agentRunId,
          summary,
          state.traceUrl,
        );
    return { summary, auditEvents };
  };
}

export const summarizeNode = createSummarizeNode();
