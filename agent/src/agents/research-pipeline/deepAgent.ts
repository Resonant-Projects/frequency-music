import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ChatGeneration, LLMResult } from "@langchain/core/outputs";
import {
  hypothesisDraftPayloadZ,
  recipeDraftPayloadZ,
} from "../../../../convex/shared/draftPayloads";
import {
  getConfiguredModelProvider,
  getResearchModel,
} from "../../models/index.js";
import type {
  ResearchCandidate,
  ResearchPipelineDraft,
  ResearchPipelineDraftPayload,
} from "../../state/researchPipelineState.js";

// Aliases preserve the existing agent interface while the zod schemas now live
// at the shared seam and derive the Convex validators too.
export const hypothesisDraftPayloadSchema = hypothesisDraftPayloadZ;
export const recipeDraftPayloadSchema = recipeDraftPayloadZ;

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
  /**
   * Raw `llmOutput` from the model call (provider/model/usage/threadId when
   * codexSdk/withFallback populated it). Present whenever the model actually
   * responded, even if the response was unparsable; absent only when the
   * call itself threw before any provider answered. Graph nodes read this to
   * append the per-model-call agentRunEvents audit event.
   */
  llmOutput?: Record<string, unknown>;
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

/**
 * System instructions shared by both specialist implementations: the default
 * OpenRouter/Codex-via-getResearchModel chat call below, and the
 * CODEX_SPECIALIST=true `runCodexTask` path in
 * `graphs/research-pipeline/nodes.ts` (which passes this same text as Codex
 * thread `instructions`). Keeping one copy avoids the two specialists
 * drifting out of sync on the payload contract.
 */
export const RESEARCH_DRAFT_SPECIALIST_INSTRUCTIONS = [
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
].join("\n");

/**
 * Recover the model call's llmOutput from a real generate() result. LangChain
 * only populates result.llmOutput via `_combineLLMOutput`, which none of our
 * chat models (CodexSdkChatModel, FallbackChatModel, ChatAnthropic) implement;
 * for a single generation it instead merges the per-call llmOutput into the
 * message's response_metadata. Prefer that, fall back to result.llmOutput
 * (mocked models in tests return it directly). ChatAnthropic reports token
 * counts under `usage`/`tokenUsage` metadata keys — normalize onto `usage` so
 * the model_call audit event carries usage regardless of answering provider.
 */
function extractLlmOutput(
  generated: LLMResult,
  message: BaseMessage | undefined,
): Record<string, unknown> | undefined {
  const metadata = message?.response_metadata as
    | Record<string, unknown>
    | undefined;
  const base =
    metadata && Object.keys(metadata).length > 0
      ? metadata
      : (generated.llmOutput as Record<string, unknown> | undefined);
  if (!base) return undefined;
  if (base.usage === undefined && base.tokenUsage !== undefined) {
    return { ...base, usage: base.tokenUsage };
  }
  return base;
}

export async function createResearchDeepAgentDraft(
  input: ResearchDraftSpecialistInput,
  options: { model?: BaseChatModel } = {},
): Promise<ResearchDraftSpecialistResult> {
  const provider = getConfiguredModelProvider();
  const model = options.model ?? getResearchModel({ temperature: 0.2 });
  const system = new SystemMessage(RESEARCH_DRAFT_SPECIALIST_INSTRUCTIONS);
  const human = new HumanMessage(
    truncateJson({
      selectedCandidate: input.selectedCandidate,
      candidateCount: input.candidates.length,
      fallbackDraft: input.fallbackDraft,
      scope: input.scope,
    }),
  );

  try {
    // Use generate() rather than invoke() so llmOutput (provider/model/usage/
    // threadId, populated by codexSdk/withFallback) survives the call — the
    // per-model-call audit event in nodes.ts needs it, and invoke() discards
    // llmOutput, returning only the bare message.
    const generated = await model.generate([[system, human]]);
    const generation = generated.generations[0]?.[0] as
      | ChatGeneration
      | undefined;
    const message = generation?.message;
    const llmOutput = extractLlmOutput(generated, message);
    if (!message) {
      return {
        draft: input.fallbackDraft,
        provider,
        usedFallback: true,
        warning: "Deep-agent specialist returned no message.",
        llmOutput,
      };
    }
    const parsed = extractJson(contentText(message.content));
    const draft = sanitizeSpecialistDraft(parsed, input.fallbackDraft);
    if (!draft) {
      return {
        draft: input.fallbackDraft,
        provider,
        usedFallback: true,
        warning: "Deep-agent specialist returned an unparsable draft.",
        llmOutput,
      };
    }
    return { draft, provider, usedFallback: false, llmOutput };
  } catch (error) {
    return {
      draft: input.fallbackDraft,
      provider,
      usedFallback: true,
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}
