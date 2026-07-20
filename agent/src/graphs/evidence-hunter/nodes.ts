import { z } from "zod";
import { getResearchModel } from "../../models/index.js";
import type {
  EvidenceHunterState,
  EvidenceHunterUpdate,
  EvidenceJudgment,
  EvidenceTarget,
  SemanticClaim,
  TargetClaimSearch,
} from "../../state/evidenceHunterState.js";
import { callConvex } from "../../tools/convexTools.js";
import { evidenceSearchText, stanceJudgePrompt } from "./prompts.js";

export const stanceOutputSchema = z.object({
  stance: z.enum(["supports", "contradicts", "irrelevant"]),
  note: z.string().trim().min(1),
});

export type ToolCaller = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

function asTargets(value: unknown): EvidenceTarget[] {
  return Array.isArray(value) ? (value as EvidenceTarget[]) : [];
}

function asClaims(value: unknown): SemanticClaim[] {
  return Array.isArray(value) ? (value as SemanticClaim[]) : [];
}

async function appendAudit(
  callTool: ToolCaller,
  agentRunId: string | undefined,
  kind: "decision" | "tool_call",
  message: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!agentRunId) return;
  try {
    await callTool("appendAgentRunEvent", {
      runId: agentRunId,
      kind,
      message,
      payload,
    });
  } catch (error) {
    console.warn(`Failed to append evidence-hunter ${kind} event`, error);
  }
}

export async function pickTargetsNode(
  state: EvidenceHunterState,
): Promise<EvidenceHunterUpdate> {
  const limit = Math.min(state.limit ?? 5, 5);
  const targets = asTargets(
    await callConvex("listCorrespondenceTargets", { limit }),
  );
  await appendAudit(
    callConvex,
    state.agentRunId,
    "tool_call",
    "Picked oldest-evidence conjectures",
    { requestedLimit: limit, returned: targets.length },
  );
  return { targets };
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
    await appendAudit(
      callConvex,
      state.agentRunId,
      "tool_call",
      "Searched claims for correspondence evidence",
      { pairKey: target.pairKey, candidates: claims.length },
    );
  }
  return { searches };
}

export async function judgeStanceNode(
  state: EvidenceHunterState,
): Promise<EvidenceHunterUpdate> {
  const judge = getResearchModel({
    requiresToolBinding: true,
    temperature: 0,
  }).withStructuredOutput(stanceOutputSchema);
  const judgments: EvidenceJudgment[] = [];
  for (const search of state.searches) {
    for (const claim of search.claims) {
      const verdict = stanceOutputSchema.parse(
        await judge.invoke(stanceJudgePrompt(search.target, claim), {
          configurable: {
            agentRunId: state.agentRunId,
            traceUrl: state.traceUrl,
          },
        }),
      );
      judgments.push({ target: search.target, claim, verdict });
    }
  }
  return { judgments };
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
    const evidenceAddedByTarget: Record<string, number> = {};

    for (const judgment of state.judgments) {
      await appendAudit(
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
      await appendAudit(
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
      );
    }
    return {
      evidenceAddedCount,
      irrelevantCount,
      evidenceAddedByTarget,
    };
  };
}

export const addEvidenceNode = createAddEvidenceNode();

export async function summarizeNode(
  state: EvidenceHunterState,
): Promise<EvidenceHunterUpdate> {
  const targetSummary = Object.entries(state.evidenceAddedByTarget)
    .map(([targetId, count]) => `${targetId}: ${count}`)
    .join(", ");
  const summary =
    state.targets.length === 0
      ? "evidence-hunter completed: no conjectured targets"
      : `evidence-hunter completed: ${state.evidenceAddedCount} evidence citations added across ${state.targets.length} targets; ${state.irrelevantCount} claims irrelevant${targetSummary ? ` (${targetSummary})` : ""}`;
  if (state.agentRunId) {
    await callConvex("markAgentRunCompleted", {
      runId: state.agentRunId,
      summary,
      ...(state.traceUrl ? { traceUrl: state.traceUrl } : {}),
    });
  }
  return { summary };
}

export function routeAfterTargets(state: EvidenceHunterState) {
  return state.targets.length === 0 ? "summarize" : "search_claims";
}
