// oxlint-disable-next-line import/no-unassigned-import -- varlock loads env values as a side effect.
import "varlock/auto-load";

import { MODELS } from "../convex/llm.ts";
import {
  type ModelCatalog,
  compareModelCatalogs,
  parseModelCatalog,
} from "./lib/model-catalog.ts";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";
const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models";

async function fetchCatalog(
  provider: string,
  url: string,
  init?: RequestInit,
): Promise<ModelCatalog> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(
      `${provider} catalog request failed: ${response.status} ${response.statusText}`,
    );
  }
  return parseModelCatalog(await response.json());
}

async function main(): Promise<void> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY is required to check the Groq model catalog");
  }
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is required to check the Anthropic model catalog",
    );
  }

  const [openRouterCatalog, groqCatalog, anthropicCatalog] = await Promise.all([
    fetchCatalog("OpenRouter", OPENROUTER_MODELS_URL),
    fetchCatalog("Groq", GROQ_MODELS_URL, {
      headers: { Authorization: `Bearer ${groqApiKey}` },
    }),
    fetchCatalog("Anthropic", `${ANTHROPIC_MODELS_URL}?limit=1000`, {
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
    }),
  ]);

  const results = compareModelCatalogs(
    MODELS,
    openRouterCatalog,
    groqCatalog,
    anthropicCatalog,
  );
  for (const result of results) {
    console.log(
      `${result.status} ${result.name}: ${result.modelId} (${result.provider})`,
    );
  }

  if (results.some(({ status }) => status === "MISSING")) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
