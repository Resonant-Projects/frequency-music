import { describe, expect, test } from "vite-plus/test";
import { compareModelCatalogs } from "./model-catalog";

describe("compareModelCatalogs", () => {
  test("routes models to their actual inference provider", () => {
    const results = compareModelCatalogs(
      {
        fast: "groq/openai/gpt-oss-120b",
        default: "openai/gpt-5.6-terra",
        quality: "openai/gpt-5.6-terra",
        missingGroq: "groq/moonshotai/retired-model",
        sonnet: "anthropic/claude-sonnet-5.5",
        legacyHaiku: "anthropic/claude-haiku-4.5",
        missingAnthropic: "anthropic/retired-model",
        missingOpenRouter: "google/retired-model",
      },
      {
        data: [
          { id: "openai/gpt-5.6-terra" },
          { id: "anthropic/claude-haiku-4.5" },
          { id: "anthropic/claude-sonnet-4-6" },
        ],
      },
      {
        data: [{ id: "openai/gpt-oss-120b" }],
      },
      { data: [{ id: "claude-sonnet-5-5" }] },
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
        name: "sonnet",
        modelId: "anthropic/claude-sonnet-5.5",
        provider: "Anthropic",
        status: "OK",
      },
      {
        name: "legacyHaiku",
        modelId: "anthropic/claude-haiku-4.5",
        provider: "OpenRouter",
        status: "OK",
      },
      {
        name: "missingAnthropic",
        modelId: "anthropic/retired-model",
        provider: "OpenRouter",
        status: "MISSING",
      },
      {
        name: "missingOpenRouter",
        modelId: "google/retired-model",
        provider: "OpenRouter",
        status: "MISSING",
      },
    ]);
  });
});
