import { z } from "zod";
import type {
  EvidenceHunterState,
  EvidenceHunterUpdate,
  EvidenceJudgment,
  EvidenceTarget,
  SemanticClaim,
  TargetClaimSearch,
} from "../../state/evidenceHunterState.js";
import { callConvex } from "../../tools/convexTools.js";
import { resolveCurrentTraceUrl } from "../../tracing/currentTrace.js";
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
import { evidenceSearchText, stanceJudgePrompt } from "./prompts.js";

export const stanceOutputSchema = z.object({
  stance: z.enum(["supports", "contradicts", "irrelevant"]),
  note: z.string().trim().min(1),
});

function asTargets(value: unknown): EvidenceTarget[] {
  return Array.isArray(value) ? (value as EvidenceTarget[]) : [];
}

function asClaims(value: unknown): SemanticClaim[] {
  return Array.isArray(value) ? (value as SemanticClaim[]) : [];
}

export async function pickTargetsNode(
  state: EvidenceHunterState,
): Promise<EvidenceHunterUpdate> {
  const limit = Math.min(state.limit ?? 5, 5);
  const targets = asTargets(
    await callConvex("listCorrespondenceTargets", { limit }),
  );
  const auditEvents = await appendRemoteAuditEvent(
    callConvex,
    state.agentRunId,
    "tool_call",
    "Picked oldest-evidence conjectures",
    { requestedLimit: limit, returned: targets.length },
  );
  return { targets, auditEvents };
}

function mergeClaims(
  target: EvidenceTarget,
  ...groups: SemanticClaim[][]
): SemanticClaim[] {
  const existing = new Set(target.existingClaimIds);
  const byId = new Map<string, SemanticClaim>();
  for (const claim of groups.flat()) {
    if (existing.has(claim.claimId)) continue;
    const previous = byId.get(claim.claimId);
    if (!previous || claim.score > previous.score)
      byId.set(claim.claimId, claim);
  }
  return Array.from(byId.values())
    .sort(
      (left, right) =>
        right.score - left.score || left.claimId.localeCompare(right.claimId),
    )
    .slice(0, 10);
}

export async function searchClaimsNode(
  state: EvidenceHunterState,
): Promise<EvidenceHunterUpdate> {
  const searches: TargetClaimSearch[] = [];
  const auditEvents: AgentAuditEvent[] = [];
  for (const target of state.targets) {
    const [sideA, sideB] = await Promise.all([
      callConvex("searchClaimsSemantic", {
        text: evidenceSearchText(target, "a"),
        limit: 8,
      }),
      callConvex("searchClaimsSemantic", {
        text: evidenceSearchText(target, "b"),
        limit: 8,
      }),
    ]);
    const claims = mergeClaims(target, asClaims(sideA), asClaims(sideB));
    searches.push({ target, claims });
    auditEvents.push(
      ...(await appendRemoteAuditEvent(
        callConvex,
        state.agentRunId,
        "tool_call",
        "Searched claims for correspondence evidence",
        { pairKey: target.pairKey, candidates: claims.length },
      )),
    );
  }
  return { searches, auditEvents };
}

export async function judgeStanceNode(
  state: EvidenceHunterState,
): Promise<EvidenceHunterUpdate> {
  return await createJudgeStanceNode()(state);
}

type StanceJudge = StructuredJudge<z.infer<typeof stanceOutputSchema>>;

export function createJudgeStanceNode(
  dependencies: {
    judge?: StanceJudge;
    callTool?: ToolCaller;
    resolveTraceUrl?: typeof resolveCurrentTraceUrl;
  } = {},
) {
  const callTool = dependencies.callTool ?? callConvex;
  const resolveTraceUrl =
    dependencies.resolveTraceUrl ?? resolveCurrentTraceUrl;
  const judge = dependencies.judge ?? createStructuredJudge(stanceOutputSchema);

  return async (
    state: Pick<EvidenceHunterState, "agentRunId" | "traceUrl" | "searches">,
  ): Promise<EvidenceHunterUpdate> => {
    const judgments: EvidenceJudgment[] = [];
    const auditEvents: AgentAuditEvent[] = [];
    let judgeErrorCount = 0;
    for (const search of state.searches) {
      for (const claim of search.claims) {
        const judged = await invokeJudgeOrError({
          judge,
          prompt: stanceJudgePrompt(search.target, claim),
          callTool,
          agentRunId: state.agentRunId,
          traceUrl: state.traceUrl,
          errorEventMessage:
            "Evidence hunter discarded claim after judge error",
          errorEventPayload: (message) => ({
            pairKey: search.target.pairKey,
            claimId: claim.claimId,
            reason: "judge_error",
            message,
          }),
        });
        auditEvents.push(...judged.auditEvents);
        if (judged.judgeError) {
          judgeErrorCount += 1;
          judgments.push({
            target: search.target,
            claim,
            discardReason: judged.judgeError,
          });
        } else {
          judgments.push({
            target: search.target,
            claim,
            verdict: judged.verdict,
          });
        }
      }
    }
    return {
      judgments,
      judgeErrorCount,
      auditEvents,
      traceUrl: await resolveTraceUrl(state.traceUrl),
    };
  };
}

export function createAddEvidenceNode(callTool: ToolCaller = callConvex) {
  return async (state: {
    agentRunId?: string;
    judgments: EvidenceJudgment[];
  }): Promise<EvidenceHunterUpdate> => {
    if (!state.agentRunId) {
      throw new Error("evidence-hunter requires agentRunId provenance");
    }
    let evidenceAddedCount = 0;
    let irrelevantCount = 0;
    let discardedCount = 0;
    const evidenceAddedByTarget: Record<string, number> = {};
    const auditEvents: AgentAuditEvent[] = [];

    for (const judgment of state.judgments) {
      if (judgment.discardReason) {
        discardedCount += 1;
        continue;
      }
      auditEvents.push(
        ...(await appendRemoteAuditEvent(
          callTool,
          state.agentRunId,
          "decision",
          "Evidence hunter judged claim stance",
          {
            pairKey: judgment.target.pairKey,
            claimId: judgment.claim.claimId,
            stance: judgment.verdict.stance,
            note: judgment.verdict.note,
          },
        )),
      );
      if (judgment.verdict.stance === "irrelevant") {
        irrelevantCount += 1;
        continue;
      }
      const result = (await callTool("addCorrespondenceEvidence", {
        correspondenceId: judgment.target.correspondenceId,
        claimId: judgment.claim.claimId,
        stance: judgment.verdict.stance,
        note: judgment.verdict.note,
        agentRunId: state.agentRunId,
      })) as { added?: unknown; status?: unknown };
      if (result.added === true) {
        evidenceAddedCount += 1;
        evidenceAddedByTarget[judgment.target.correspondenceId] =
          (evidenceAddedByTarget[judgment.target.correspondenceId] ?? 0) + 1;
      }
      auditEvents.push(
        ...(await appendRemoteAuditEvent(
          callTool,
          state.agentRunId,
          "tool_call",
          "Added judged correspondence evidence",
          {
            correspondenceId: judgment.target.correspondenceId,
            claimId: judgment.claim.claimId,
            stance: judgment.verdict.stance,
            added: result.added === true,
            observedStatus: result.status,
          },
        )),
      );
    }
    return {
      evidenceAddedCount,
      irrelevantCount,
      discardedCount,
      evidenceAddedByTarget,
      auditEvents,
    };
  };
}

export const addEvidenceNode = createAddEvidenceNode();

export function createSummarizeNode(callTool: ToolCaller = callConvex) {
  return async (state: EvidenceHunterState): Promise<EvidenceHunterUpdate> => {
    const targetSummary = Object.entries(state.evidenceAddedByTarget)
      .map(([targetId, count]) => `${targetId}: ${count}`)
      .join(", ");
    const allJudgesFailed =
      state.judgments.length > 0 &&
      state.judgeErrorCount === state.judgments.length;
    const summary =
      state.targets.length === 0
        ? "evidence-hunter completed: no conjectured targets"
        : allJudgesFailed
          ? `evidence-hunter completed: zero judgments; ${state.judgeErrorCount} judge errors discarded across ${state.targets.length} targets`
          : `evidence-hunter completed: ${state.evidenceAddedCount} evidence citations added across ${state.targets.length} targets; ${state.irrelevantCount} claims irrelevant, ${state.discardedCount} discarded${targetSummary ? ` (${targetSummary})` : ""}`;
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

export function routeAfterTargets(state: EvidenceHunterState) {
  return state.targets.length === 0 ? "summarize" : "search_claims";
}
