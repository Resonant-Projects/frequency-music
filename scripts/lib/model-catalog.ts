import { isGroqModel } from "../../convex/llm.ts";
import {
  anthropicModelId,
  isDirectAnthropicModel,
} from "../../convex/shared/llmPolicy.ts";

export type ModelProvider = "Anthropic" | "Groq" | "OpenRouter";
export type ModelCatalogStatus = "OK" | "MISSING";

export interface ModelCatalogEntry {
  id: string;
}

export interface ModelCatalog {
  data: ModelCatalogEntry[];
}

export interface ModelCatalogResult {
  name: string;
  modelId: string;
  provider: ModelProvider;
  status: ModelCatalogStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseModelCatalog(value: unknown): ModelCatalog {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new Error("Model catalog response must contain a data array");
  }

  const data = value.data.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string") {
      throw new Error("Every model catalog entry must contain a string id");
    }
    return { id: entry.id };
  });

  return { data };
}

function catalogIds(catalog: ModelCatalog): Set<string> {
  return new Set(catalog.data.map(({ id }) => id));
}

export function compareModelCatalogs(
  models: Readonly<Record<string, string>>,
  openRouterCatalog: ModelCatalog,
  groqCatalog: ModelCatalog,
  anthropicCatalog: ModelCatalog,
): ModelCatalogResult[] {
  const openRouterIds = catalogIds(openRouterCatalog);
  const groqIds = catalogIds(groqCatalog);
  const anthropicIds = catalogIds(anthropicCatalog);

  return Object.entries(models).map(([name, modelId]) => {
    const isGroq = isGroqModel(modelId);
    const isAnthropic = isDirectAnthropicModel(modelId);
    const provider = isAnthropic ? "Anthropic" : isGroq ? "Groq" : "OpenRouter";
    const providerModelId = isAnthropic
      ? anthropicModelId(modelId)
      : isGroq
        ? modelId.slice("groq/".length)
        : modelId;
    const ids = isAnthropic ? anthropicIds : isGroq ? groqIds : openRouterIds;

    return {
      name,
      modelId,
      provider,
      status: ids.has(providerModelId) ? "OK" : "MISSING",
    };
  });
}
