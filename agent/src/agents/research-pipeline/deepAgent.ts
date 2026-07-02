import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod";
import {
  getConfiguredModelProvider,
  getResearchModel,
} from "../../models/index.js";
import type {
  ResearchCandidate,
  ResearchPipelineDraft,
  ResearchPipelineDraftPayload,
} from "../../state/researchPipelineState.js";

/**
 * Zod schemas for the structured draft payloads. These MUST mirror the deployed
 * Convex `agentReviewDrafts.payload` union so a promoted draft is loss-free.
 * Unknown keys are stripped; whyThisMatters is required (the server also
 * enforces it) so a payload that omits it collapses to undefined and the draft
 * stays valid-but-non-promotable.
 */
export const hypothesisDraftPayloadSchema = z.object({
  title: z.string().min(1),
  question: z.string().min(1),
  statement: z.string().min(1),
  rationale: z.string().min(1),
  whyThisMatters: z.string().min(1),
  concepts: z.array(z.string()).optional(),
  sourceIds: z.array(z.string()),
  extractionIds: z.array(z.string()),
  thesisId: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const recipeDraftParameterSchema = z.object({
  kind: z.string().optional(),
  type: z.string().optional(),
  value: z.string(),
  details: z.string().optional(),
});

export const recipeDraftProtocolSchema = z.object({
  studyType: z.enum(["litmus", "comparison"]),
  durationSecs: z.number().positive(),
  panelPlanned: z.array(z.string()),
  listeningContext: z.string().optional(),
  listeningMethod: z.string().optional(),
  baselineArtifactId: z.string().optional(),
  whatVaries: z.array(z.string()),
  whatStaysConstant: z.array(z.string()),
});

export const recipeDraftPayloadSchema = z.object({
  hypothesisId: z.string().optional(),
  title: z.string().min(1),
  parameters: z.array(recipeDraftParameterSchema),
  protocol: recipeDraftProtocolSchema.optional(),
  whyThisMatters: z.string().min(1),
  bodyMd: z.string().optional(),
  dawChecklist: z.array(z.string()).optional(),
  instrumentationNotes: z.string().optional(),
});

/**
 * Parse a candidate payload against the schema selected by the draft kind.
 * Returns undefined (draft stays payload-less) when the shape is malformed.
 */
export function sanitizeDraftPayload(
  kind: ResearchPipelineDraft["kind"],
  value: unknown,
): ResearchPipelineDraftPayload | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (kind === "recipe_draft") {
    const result = recipeDraftPayloadSchema.safeParse(value);
    return result.success ? result.data : undefined;
  }
  if (kind === "hypothesis_draft") {
    const result = hypothesisDraftPayloadSchema.safeParse(value);
    return result.success ? result.data : undefined;
  }
  return undefined;
}

export interface ResearchDraftSpecialistInput {
  selectedCandidate?: ResearchCandidate;
  candidates: ResearchCandidate[];
  scope: {
    activeTheses: unknown[];
    recentExtractions: unknown[];
    recentHypotheses: unknown[];
    recentRecipes: unknown[];
    failureArchive: unknown[];
    editorialSignals: unknown[];
  };
  fallbackDraft: ResearchPipelineDraft;
}

export interface ResearchDraftSpecialistResult {
  draft: ResearchPipelineDraft;
  provider: string;
  usedFallback: boolean;
  warning?: string;
}

function truncateJson(value: unknown, maxChars = 8000) {
  const text = JSON.stringify(value, null, 2);
  return text.length > maxChars
    ? `${text.slice(0, maxChars)}\n...[truncated]`
    : text;
}

function contentText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("\n");
  }
  return JSON.stringify(content);
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    return undefined;
  }
}

export function sanitizeSpecialistDraft(
  value: unknown,
  fallbackDraft: ResearchPipelineDraft,
): ResearchPipelineDraft | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as {
    kind?: unknown;
    title?: unknown;
    summary?: unknown;
    candidateIds?: unknown;
    needsReview?: unknown;
    payload?: unknown;
  };
  const kind =
    raw.kind === "recipe_draft"
      ? "recipe_draft"
      : raw.kind === "hypothesis_draft"
        ? "hypothesis_draft"
        : fallbackDraft.kind;
  if (typeof raw.title !== "string" || typeof raw.summary !== "string")
    return undefined;
  const candidateIds =
    Array.isArray(raw.candidateIds) &&
    raw.candidateIds.every((id) => typeof id === "string")
      ? raw.candidateIds
      : fallbackDraft.candidateIds;
  const payload = sanitizeDraftPayload(kind, raw.payload);
  return {
    kind,
    title: raw.title.slice(0, 240),
    summary: raw.summary.slice(0, 2000),
    candidateIds,
    needsReview: true,
    // Only attach payload when it validates so payload-less drafts stay
    // structurally identical to the pre-payload contract (and remain valid).
    ...(payload ? { payload } : {}),
  };
}

export async function createResearchDeepAgentDraft(
  input: ResearchDraftSpecialistInput,
  options: { model?: BaseChatModel } = {},
): Promise<ResearchDraftSpecialistResult> {
  const provider = getConfiguredModelProvider();
  const model = options.model ?? getResearchModel({ temperature: 0.2 });
  const system = new SystemMessage(
    [
      "You are the Frequency Music research-pipeline deep-agent specialist.",
      "Given sanitized Convex context, prepare a concise human-review draft only.",
      "Do not claim you wrote domain data. Return JSON only with keys: kind, title, summary, candidateIds, needsReview, payload.",
      "kind must be hypothesis_draft or recipe_draft. needsReview must be true.",
      "",
      "CRITICAL — the `payload` object is what a human promotes into a real record, so it must be loss-free and its ids must be REAL.",
      "Only ever reference ids (sourceIds, extractionIds, thesisId, hypothesisId) that appear in the provided scope/candidate context.",
      "NEVER invent, guess, or reformat an id. A fabricated id fails the run.",
      "",
      "For kind=hypothesis_draft, payload keys:",
      "  title (string), question (string), statement (string), rationale (string), whyThisMatters (string, required and non-empty),",
      "  concepts (string[] optional), sourceIds (string[] of real Id<sources>), extractionIds (string[] of real Id<extractions>),",
      "  thesisId (optional real Id<theses>), confidence (optional number 0-1).",
      "",
      "For kind=recipe_draft, payload keys:",
      "  hypothesisId (optional real Id<hypotheses>), title (string),",
      "  parameters (array of { value:string, kind?, type?, details? }),",
      "  protocol (optional { studyType:'litmus'|'comparison', durationSecs:number, panelPlanned:string[], whatVaries:string[], whatStaysConstant:string[], baselineArtifactId?, listeningContext?, listeningMethod? }),",
      "  whyThisMatters (string, required and non-empty), bodyMd (optional), dawChecklist (string[] optional), instrumentationNotes (optional).",
      "",
      "If you cannot ground a complete, id-accurate payload, OMIT the payload key entirely (still return the other keys).",
    ].join("\n"),
  );
  const human = new HumanMessage(
    truncateJson({
      selectedCandidate: input.selectedCandidate,
      candidateCount: input.candidates.length,
      fallbackDraft: input.fallbackDraft,
      scope: input.scope,
    }),
  );

  try {
    const response = await model.invoke([system, human]);
    const parsed = extractJson(contentText(response.content));
    const draft = sanitizeSpecialistDraft(parsed, input.fallbackDraft);
    if (!draft) {
      return {
        draft: input.fallbackDraft,
        provider,
        usedFallback: true,
        warning: "Deep-agent specialist returned an unparsable draft.",
      };
    }
    return { draft, provider, usedFallback: false };
  } catch (error) {
    return {
      draft: input.fallbackDraft,
      provider,
      usedFallback: true,
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}
