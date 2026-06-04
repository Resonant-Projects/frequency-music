import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { getConfiguredModelProvider, getResearchModel } from "../../models/index.js";
import type { ResearchCandidate, ResearchPipelineDraft } from "../../state/researchPipelineState.js";

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
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n...[truncated]` : text;
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
  };
  const kind = raw.kind === "recipe_draft" ? "recipe_draft" : raw.kind === "hypothesis_draft" ? "hypothesis_draft" : fallbackDraft.kind;
  if (typeof raw.title !== "string" || typeof raw.summary !== "string") return undefined;
  const candidateIds = Array.isArray(raw.candidateIds) && raw.candidateIds.every((id) => typeof id === "string")
    ? raw.candidateIds
    : fallbackDraft.candidateIds;
  return {
    kind,
    title: raw.title.slice(0, 240),
    summary: raw.summary.slice(0, 2000),
    candidateIds,
    needsReview: true,
  };
}

export async function createResearchDeepAgentDraft(
  input: ResearchDraftSpecialistInput,
  options: { model?: BaseChatModel } = {},
): Promise<ResearchDraftSpecialistResult> {
  const provider = getConfiguredModelProvider();
  const model = options.model ?? getResearchModel({ temperature: 0.2 });
  const system = new SystemMessage(
    "You are the Frequency Music research-pipeline deep-agent specialist. " +
      "Given sanitized Convex context, prepare a concise human-review draft only. " +
      "Do not claim you wrote domain data. Return JSON only with keys: kind, title, summary, candidateIds, needsReview. " +
      "kind must be hypothesis_draft or recipe_draft. needsReview must be true.",
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
