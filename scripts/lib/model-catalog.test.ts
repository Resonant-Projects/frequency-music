import { describe, expect, test } from "vite-plus/test";
import { compareModelCatalogs } from "./model-catalog";

describe("compareModelCatalogs", () => {
  test("routes groq-prefixed models to Groq and all other models to OpenRouter", () => {
    const results = compareModelCatalogs(
      {
        fast: "groq/openai/gpt-oss-120b",
        default: "openai/gpt-5.6-terra",
        quality: "openai/gpt-5.6-terra",
        missingGroq: "groq/moonshotai/retired-model",
        missingOpenRouter: "anthropic/retired-model",
      },
      {
        data: [
          { id: "openai/gpt-5.6-terra" },
          { id: "anthropic/claude-sonnet-4-6" },
        ],
      },
      {
        data: [{ id: "openai/gpt-oss-120b" }],
      },
    );

    expect(results).toEqual([
      {
        name: "fast",
        modelId: "groq/openai/gpt-oss-120b",
        provider: "Groq",
        status: "OK",
      },
      {
        name: "default",
        modelId: "openai/gpt-5.6-terra",
        provider: "OpenRouter",
        status: "OK",
      },
      {
        name: "quality",
        modelId: "openai/gpt-5.6-terra",
        provider: "OpenRouter",
        status: "OK",
      },
      {
        name: "missingGroq",
        modelId: "groq/moonshotai/retired-model",
        provider: "Groq",
        status: "MISSING",
      },
      {
        name: "missingOpenRouter",
        modelId: "anthropic/retired-model",
        provider: "OpenRouter",
        status: "MISSING",
      },
    ]);
  });
});
