import { describe, expect, test, vi } from "vite-plus/test";
import { z } from "zod";

const withStructuredOutput = vi.fn(() => ({ invoke: vi.fn() }));
const getResearchModel = vi.fn(() => ({ withStructuredOutput }));
vi.mock("../src/models/index.js", () => ({ getResearchModel }));

const { createStructuredJudge } = await import("../src/graphs/shared/judge");

describe("structured judges", () => {
  test("preserves selected models and bounded investigation options together", () => {
    createStructuredJudge(
      z.object({ accept: z.boolean() }),
      "anthropic/claude-haiku-5.5",
      { maxTokens: 4096, maxRetries: 0 },
    );
    expect(getResearchModel).toHaveBeenLastCalledWith({
      requiresToolBinding: true,
      model: "anthropic/claude-haiku-5.5",
      temperature: 0,
      maxTokens: 4096,
      maxRetries: 0,
    });
  });
  test("use native JSON-schema output on the tool-binding model", () => {
    const schema = z.object({ accept: z.boolean() });
    createStructuredJudge(schema);
    expect(getResearchModel).toHaveBeenCalledWith({
      requiresToolBinding: true,
      model: "anthropic/claude-haiku-5.5",
      temperature: 0,
    });
    // Forced tool calling (the default method) is rejected by Sonnet 5.5.
    expect(withStructuredOutput).toHaveBeenCalledWith(schema, {
      method: "jsonSchema",
    });
  });
});
