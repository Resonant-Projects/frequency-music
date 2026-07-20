import { z } from "zod";
import { callConvex } from "../../tools/convexTools.js";
import { resolveCurrentTraceUrl } from "../../tracing/currentTrace.js";
import type {
  CorrespondenceCandidate,
  CorrespondenceMinerState,
  CorrespondenceMinerUpdate,
  MinerDecision,
} from "../../state/correspondenceMinerState.js";
import {
  appendRemoteAuditEvent,
  finalizeRunCompleted,
  type AgentAuditEvent,
  type ToolCaller,
} from "../shared/audit.js";
import {
  createStructuredJudge,
  invokeJudgeOrError,
  type StructuredJudge,
} from "../shared/judge.js";
import { correspondenceJudgePrompt } from "./prompts.js";

export const judgeOutputSchema = z.object({
  accept: z.boolean(),
  statement: z.string(),
  rationaleMd: z.string(),
  relationship: z.string().optional(),
  confidenceNote: z.string(),
});

function asCandidates(value: unknown): CorrespondenceCandidate[] {
  return Array.isArray(value) ? (value as CorrespondenceCandidate[]) : [];
}

export function citedSampleClaimIds(
  candidate: CorrespondenceCandidate,
  verdictText: string,
): string[] {
  const available = [
    ...candidate.sampleClaimIds.a,
    ...candidate.sampleClaimIds.b,
  ];
  return Array.from(
    new Set(available.filter((claimId) => verdictText.includes(claimId))),
  );
}

export function buildMinerDecision(
  candidate: CorrespondenceCandidate,
  verdict: z.infer<typeof judgeOutputSchema>,
): MinerDecision {
  const supportingClaimIds = citedSampleClaimIds(
    candidate,
    verdict.rationaleMd,
  );
  return {
    candidate,
    verdict:
      verdict.accept && supportingClaimIds.length === 0
        ? {
            ...verdict,
            accept: false,
            confidenceNote: `Discard: accepted verdict cited no valid sample claim ids. ${verdict.confidenceNote}`,
          }
        : verdict,
    supportingClaimIds,
  };
}

export async function fetchCandidatesNode(
  state: CorrespondenceMinerState,
): Promise<CorrespondenceMinerUpdate> {
  const limit = state.limit ?? 20;
  const candidates = asCandidates(
    await callConvex("listCorrespondenceCandidates", { limit }),
  );
  const auditEvents = await appendRemoteAuditEvent(
    callConvex,
    state.agentRunId,
    "tool_call",
    "Fetched correspondence candidates",
    {
      requestedLimit: limit,
      returned: candidates.length,
    },
  );
  return { candidates, auditEvents };
}

function stalePairVerdict(candidate: CorrespondenceCandidate): MinerDecision {
  return {
    candidate,
    verdict: {
      accept: false,
      statement: "",
      rationaleMd: "Candidate pair already has a correspondence.",
      confidenceNote:
        "Discard: correspondence appeared after candidate generation.",
    },
    supportingClaimIds: [],
  };
}

export async function judgeLoopNode(
  state: CorrespondenceMinerState,
): Promise<CorrespondenceMinerUpdate> {
  return await createJudgeLoopNode()(state);
}

type MinerJudge = StructuredJudge<z.infer<typeof judgeOutputSchema>>;

export function createJudgeLoopNode(
  dependencies: {
    judge?: MinerJudge;
    callTool?: ToolCaller;
    resolveTraceUrl?: typeof resolveCurrentTraceUrl;
  } = {},
) {
  const callTool = dependencies.callTool ?? callConvex;
  const resolveTraceUrl =
    dependencies.resolveTraceUrl ?? resolveCurrentTraceUrl;
  const judge = dependencies.judge ?? createStructuredJudge(judgeOutputSchema);

  return async (
    state: Pick<
      CorrespondenceMinerState,
      "agentRunId" | "traceUrl" | "limit" | "candidates"
    >,
  ): Promise<CorrespondenceMinerUpdate> => {
    const decisions: MinerDecision[] = [];
    const auditEvents: AgentAuditEvent[] = [];
    let judgeErrorCount = 0;

    for (const candidate of state.candidates.slice(0, state.limit ?? 20)) {
      const existing = await callTool("getCorrespondence", {
        pairKey: candidate.pairKey,
      });
      if (existing) {
        decisions.push(stalePairVerdict(candidate));
        continue;
      }
      const judged = await invokeJudgeOrError({
        judge,
        prompt: correspondenceJudgePrompt(candidate),
        callTool,
        agentRunId: state.agentRunId,
        traceUrl: state.traceUrl,
        errorEventMessage:
          "Correspondence judge discarded candidate after judge error",
        errorEventPayload: (message) => ({
          pairKey: candidate.pairKey,
          accept: false,
          reason: "judge_error",
          message,
        }),
      });
      auditEvents.push(...judged.auditEvents);
      if (judged.judgeError) {
        judgeErrorCount += 1;
        const { message } = judged.judgeError;
        decisions.push({
          candidate,
          verdict: {
            accept: false,
            statement: "",
            rationaleMd: "",
            confidenceNote: `Discard: judge_error: ${message}`,
          },
          supportingClaimIds: [],
          discardReason: judged.judgeError,
        });
      } else {
        decisions.push(buildMinerDecision(candidate, judged.verdict));
      }
    }
    return {
      decisions,
      judgeErrorCount,
      auditEvents,
      traceUrl: await resolveTraceUrl(state.traceUrl),
    };
  };
}

export function createWriteOrDiscardNode(callTool: ToolCaller = callConvex) {
  return async (state: {
    agentRunId?: string;
    traceUrl?: string;
    decisions: MinerDecision[];
  }): Promise<CorrespondenceMinerUpdate> => {
    if (!state.agentRunId) {
      throw new Error("correspondence-miner requires agentRunId provenance");
    }
    let acceptedCount = 0;
    let discardedCount = 0;
    let evidenceAddedCount = 0;
    const auditEvents: AgentAuditEvent[] = [];

    for (const decision of state.decisions) {
      if (!decision.discardReason) {
        auditEvents.push(
          ...(await appendRemoteAuditEvent(
            callTool,
            state.agentRunId,
            "decision",
            decision.verdict.accept
              ? "Correspondence judge accepted candidate"
              : "Correspondence judge discarded candidate",
            {
              pairKey: decision.candidate.pairKey,
              accept: decision.verdict.accept,
              reason: decision.verdict.confidenceNote,
              supportingClaimIds: decision.supportingClaimIds,
            },
          )),
        );
      }
      if (!decision.verdict.accept) {
        discardedCount += 1;
        continue;
      }
      const result = (await callTool("upsertCorrespondence", {
        conceptAId: decision.candidate.conceptAId,
        conceptBId: decision.candidate.conceptBId,
        statement: decision.verdict.statement,
        rationaleMd: decision.verdict.rationaleMd,
        ...(decision.verdict.relationship
          ? { relationship: decision.verdict.relationship }
          : {}),
        similarityScore: decision.candidate.similarityScore,
        noveltyScore: decision.candidate.noveltyScore,
        agentRunId: state.agentRunId,
        ...(state.traceUrl ? { traceUrl: state.traceUrl } : {}),
      })) as { id?: unknown; created?: unknown };
      if (typeof result.id !== "string") {
        throw new Error(
          `upsertCorrespondence returned no id for ${decision.candidate.pairKey}`,
        );
      }
      acceptedCount += 1;
      auditEvents.push(
        ...(await appendRemoteAuditEvent(
          callTool,
          state.agentRunId,
          "tool_call",
          "Upserted accepted correspondence",
          {
            pairKey: decision.candidate.pairKey,
            correspondenceId: result.id,
            created: result.created === true,
          },
        )),
      );

      for (const claimId of decision.supportingClaimIds) {
        const evidence = (await callTool("addCorrespondenceEvidence", {
          correspondenceId: result.id,
          claimId,
          stance: "supports",
          note: decision.verdict.confidenceNote,
          agentRunId: state.agentRunId,
        })) as { added?: unknown; status?: unknown };
        if (evidence.added === true) evidenceAddedCount += 1;
        auditEvents.push(
          ...(await appendRemoteAuditEvent(
            callTool,
            state.agentRunId,
            "tool_call",
            "Added miner-cited correspondence evidence",
            {
              correspondenceId: result.id,
              claimId,
              added: evidence.added === true,
              status: evidence.status,
            },
          )),
        );
      }
    }
    return {
      acceptedCount,
      discardedCount,
      evidenceAddedCount,
      auditEvents,
    };
  };
}

export const writeOrDiscardNode = createWriteOrDiscardNode();

export function createSummarizeNode(callTool: ToolCaller = callConvex) {
  return async (
    state: CorrespondenceMinerState,
  ): Promise<CorrespondenceMinerUpdate> => {
    const allJudgesFailed =
      state.decisions.length > 0 &&
      state.judgeErrorCount === state.decisions.length;
    const summary =
      state.candidates.length === 0
        ? "correspondence-miner completed: no candidates"
        : allJudgesFailed
          ? `correspondence-miner completed: zero judgments; ${state.judgeErrorCount} judge errors discarded`
          : `correspondence-miner completed: ${state.acceptedCount} accepted, ${state.discardedCount} discarded, ${state.evidenceAddedCount} evidence citations added`;
    const auditEvents = await finalizeRunCompleted(
      callTool,
      state.agentRunId,
      summary,
      state.traceUrl,
    );
    return { summary, auditEvents };
  };
}

export const summarizeNode = createSummarizeNode();

export function routeAfterFetch(state: CorrespondenceMinerState) {
  return state.candidates.length === 0 ? "summarize" : "judge_loop";
}
