import { expect, test, vi } from "vite-plus/test";
import {
  EXTRACT_SYSTEM_PROMPT,
  renderExtractionPrompt,
} from "../../convex/shared/extractionPrompt";

const { runEval } = vi.hoisted(() => ({ runEval: vi.fn() }));
vi.mock("./eval-helper", () => ({
  runEval,
  stringifyPromptValue: (value: unknown) => String(value),
}));
test("the default v3 evaluation uses the deployed extraction prompt", async () => {
  await import("./eval-extraction");
  const options = runEval.mock.calls[0]?.[0];
  expect(options.defaultVersion).toBe("v3");
  expect(options.prompts.v3.system).toBe(EXTRACT_SYSTEM_PROMPT);
  // Model and output cap come from the deployed extraction task.
  expect(options.prompts.v3.task).toBe("extract_v3");
  expect(options.prompts.v2.task).toBe("extract_v2");
  expect(options).not.toHaveProperty("maxOutputTokens");
  const input = {
    sourceTitle: "Fourier textbook",
    sourceUrl: "https://example.org",
    rawText: "x".repeat(30_001),
  };
  expect(options.prompts.v3.user(input)).toBe(
    renderExtractionPrompt({
      title: input.sourceTitle,
      canonicalUrl: input.sourceUrl,
      content: input.rawText,
    }),
  );
  expect(options.prompts.v2).toBeDefined();
});
