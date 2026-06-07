import { describe, expect, test } from "bun:test";
import {
  buildLangSmithMetadata,
  isLangSmithTracingEnabled,
} from "./tracing";
import {
  sanitizeExtractionForAgent,
  validateAgentToolSecretValue,
} from "./agentTools";

describe("LangSmith tracing helpers", () => {
  test("tracing only enables for true-like values with an API key", () => {
    expect(isLangSmithTracingEnabled({ LANGSMITH_TRACING: "true", LANGSMITH_API_KEY: "lsv2_key" })).toBe(
      true,
    );
    expect(isLangSmithTracingEnabled({ LANGSMITH_TRACING: "1", LANGSMITH_API_KEY: "lsv2_key" })).toBe(
      true,
    );
    expect(isLangSmithTracingEnabled({ LANGSMITH_TRACING: "false", LANGSMITH_API_KEY: "lsv2_key" })).toBe(
      false,
    );
    expect(isLangSmithTracingEnabled({ LANGSMITH_TRACING: "true" })).toBe(false);
  });

  test("metadata omits undefined values but keeps stable run fields", () => {
    expect(
      buildLangSmithMetadata("extract_v1", {
        sourceId: "src_123",
        model: "anthropic/claude-sonnet-4-6",
        promptVersion: "v1",
        ignored: undefined,
      }),
    ).toEqual({
      workflow: "resonant-research-pipeline",
      runName: "extract_v1",
      sourceId: "src_123",
      model: "anthropic/claude-sonnet-4-6",
      promptVersion: "v1",
    });
  });
});

describe("Convex agent tool helpers", () => {
  test("agent tool secret validation is fail-closed", () => {
    expect(validateAgentToolSecretValue("expected", "expected")).toBe(true);
    expect(validateAgentToolSecretValue("expected", "wrong")).toBe(false);
    expect(validateAgentToolSecretValue(undefined, "expected")).toBe(false);
    expect(validateAgentToolSecretValue("expected", undefined)).toBe(false);
  });

  test("extraction sanitizer preserves useful fields and removes raw text blobs", () => {
    const sanitized = sanitizeExtractionForAgent({
      _id: "ext_1",
      sourceId: "src_1",
      rawText: "too much source text",
      transcript: "also too much",
      summary: "A useful summary",
      claims: [{ text: "Claim", evidenceLevel: "peer_reviewed", citations: [] }],
      compositionParameters: [{ kind: "frequency", value: "432 Hz" }],
      topics: ["tuning"],
      openQuestions: ["What changes perceptually?"],
      model: "anthropic/claude-sonnet-4-6",
      promptVersion: "v1",
      createdAt: 123,
    });

    expect(sanitized).toEqual({
      id: "ext_1",
      sourceId: "src_1",
      summary: "A useful summary",
      claims: [{ text: "Claim", evidenceLevel: "peer_reviewed", citations: [] }],
      compositionParameters: [{ kind: "frequency", value: "432 Hz" }],
      topics: ["tuning"],
      openQuestions: ["What changes perceptually?"],
      model: "anthropic/claude-sonnet-4-6",
      promptVersion: "v1",
      createdAt: 123,
    });
    expect("rawText" in sanitized).toBe(false);
    expect("transcript" in sanitized).toBe(false);
  });
});
