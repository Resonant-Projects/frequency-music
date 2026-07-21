import { ConvexError, type Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  agentDraftHypothesisPayloadValidator,
  agentDraftRecipePayloadValidator,
} from "./schema";
import { assertWhyThisMatters } from "./hypotheses";

// ============================================================================
// AGENT DRAFT PROMOTION - pure helpers
// ============================================================================
// Convex mutations cannot call ctx.runMutation, so approval promotes a draft by
// inlining ctx.db.insert with the row these builders produce. Keeping the logic
// pure (no ctx) makes every guard + row shape unit-testable without a DB harness
// (the repo has no convex-test harness).

export type AgentDraftHypothesisPayload = Infer<
  typeof agentDraftHypothesisPayloadValidator
>;
export type AgentDraftRecipePayload = Infer<
  typeof agentDraftRecipePayloadValidator
>;

export interface AgentPromotionProvenance {
  agentRunId: Id<"agentRuns">;
  agentDraftId: Id<"agentReviewDrafts">;
  traceUrl?: string;
  approvedWithEdits?: true;
  editedFields?: string[];
}

type CreatedBy = Id<"users"> | "system";

// ---------------------------------------------------------------------------
// Transition guards
// ---------------------------------------------------------------------------

export function assertDraftPending(status: string): void {
  if (status !== "pending_review") {
    throw new ConvexError({
      code: "INVALID_STATE",
      message: `Draft is "${status}", expected "pending_review"`,
      field: "status",
    });
  }
}

export function assertDecisionNote(
  note: string | undefined,
  field = "decisionNote",
): string {
  const trimmed = (note ?? "").trim();
  if (!trimmed) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `${field} is required`,
      field,
    });
  }
  return trimmed;
}

export function assertRecipeHypothesisId(
  payload: AgentDraftRecipePayload,
): Id<"hypotheses"> {
  if (!payload.hypothesisId) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message:
        "recipe_draft payload must reference a hypothesisId to be promoted",
      field: "payload.hypothesisId",
    });
  }
  return payload.hypothesisId;
}

// ---------------------------------------------------------------------------
// Synthesis for recipe fields the payload may omit (recipes table requires
// bodyMd + dawChecklist; the agent may only supply parameters/protocol).
// ---------------------------------------------------------------------------

export function synthesizeRecipeBody(payload: AgentDraftRecipePayload): string {
  if (payload.bodyMd && payload.bodyMd.trim()) return payload.bodyMd;
  const lines: string[] = [
    `# ${payload.title}`,
    "",
    `**Why this matters:** ${payload.whyThisMatters}`,
    "",
  ];
  if (payload.instrumentationNotes && payload.instrumentationNotes.trim()) {
    lines.push("## Instrumentation", payload.instrumentationNotes, "");
  }
  if (payload.parameters.length) {
    lines.push("## Parameters");
    for (const p of payload.parameters) {
      lines.push(`- **${p.kind ?? p.type ?? "parameter"}:** ${p.value}`);
    }
    lines.push("");
  }
  if (payload.protocol) {
    lines.push(
      "## Protocol",
      `- Study type: ${payload.protocol.studyType}`,
      `- Duration: ${payload.protocol.durationSecs}s`,
    );
  }
  return lines.join("\n").trim();
}

export function synthesizeDawChecklist(
  payload: AgentDraftRecipePayload,
): string[] {
  if (payload.dawChecklist && payload.dawChecklist.length)
    return payload.dawChecklist;
  const checklist = payload.parameters.map(
    (p) => `Set ${p.kind ?? p.type ?? "parameter"}: ${p.value}`,
  );
  checklist.push("Render micro-study and log listening notes");
  return checklist;
}

// ---------------------------------------------------------------------------
// Insert-row builders (the row shapes that ctx.db.insert receives)
// ---------------------------------------------------------------------------

export function buildHypothesisInsertFromPayload(input: {
  payload: AgentDraftHypothesisPayload;
  provenance: AgentPromotionProvenance;
  createdBy: CreatedBy;
  now: number;
}) {
  const { payload, provenance, createdBy, now } = input;
  return {
    title: payload.title,
    question: payload.question,
    hypothesis: payload.statement,
    whyThisMatters: assertWhyThisMatters(payload.whyThisMatters),
    rationaleMd: payload.rationale,
    ...(payload.correspondenceId
      ? { correspondenceId: payload.correspondenceId }
      : {}),
    ...(payload.thesisId ? { thesisId: payload.thesisId } : {}),
    sourceIds: payload.sourceIds,
    extractionIds: payload.extractionIds,
    ...(payload.concepts ? { concepts: payload.concepts } : {}),
    status: "draft" as const,
    visibility: "private" as const,
    origin: "agent" as const,
    agentRunId: provenance.agentRunId,
    agentDraftId: provenance.agentDraftId,
    ...(provenance.traceUrl ? { traceUrl: provenance.traceUrl } : {}),
    ...(provenance.approvedWithEdits
      ? {
          approvedWithEdits: true as const,
          editedFields: provenance.editedFields ?? [],
        }
      : {}),
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildRecipeInsertFromPayload(input: {
  payload: AgentDraftRecipePayload;
  provenance: AgentPromotionProvenance;
  createdBy: CreatedBy;
  now: number;
}) {
  const { payload, provenance, createdBy, now } = input;
  const hypothesisId = assertRecipeHypothesisId(payload);
  return {
    hypothesisId,
    title: payload.title,
    whyThisMatters: assertWhyThisMatters(payload.whyThisMatters),
    bodyMd: synthesizeRecipeBody(payload),
    parameters: payload.parameters,
    dawChecklist: synthesizeDawChecklist(payload),
    ...(payload.protocol ? { protocol: payload.protocol } : {}),
    status: "draft" as const,
    visibility: "private" as const,
    origin: "agent" as const,
    agentRunId: provenance.agentRunId,
    agentDraftId: provenance.agentDraftId,
    ...(provenance.traceUrl ? { traceUrl: provenance.traceUrl } : {}),
    ...(provenance.approvedWithEdits
      ? {
          approvedWithEdits: true as const,
          editedFields: provenance.editedFields ?? [],
        }
      : {}),
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
}
