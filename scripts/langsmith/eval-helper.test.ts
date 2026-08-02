import { describe, expect, test, vi } from "vite-plus/test";

// Declared before the module under test is imported: `eval-helper` pulls in
// `varlock/auto-load`, which would otherwise resolve secrets from
// `.env.local`/1Password and make these tests environment-dependent.
vi.mock("varlock/auto-load", () => ({}));

import {
  parseJsonObjectFromText,
  requireOpenRouterApiKey,
  selectPromptVersion,
} from "./eval-helper";

describe("eval helper", () => {
  test("selects the requested prompt version from argv", () => {
    expect(
      selectPromptVersion(["bun", "eval.ts", "--version", "v2"], "v1"),
    ).toBe("v2");
  });

  test("falls back to the default prompt version", () => {
    expect(selectPromptVersion(["bun", "eval.ts"], "v1")).toBe("v1");
  });

  test("requires an OpenRouter API key before building the provider", () => {
    expect(() => requireOpenRouterApiKey({})).toThrow(
      "OPENROUTER_API_KEY is not set",
    );
    expect(requireOpenRouterApiKey({ OPENROUTER_API_KEY: "or-test" })).toBe(
      "or-test",
    );
  });

  test("parses the first JSON object from model output", () => {
    expect(parseJsonObjectFromText('prefix {"answer": true} suffix')).toEqual({
      answer: true,
    });
  });

  test("returns an empty object for malformed model JSON", () => {
    expect(parseJsonObjectFromText("prefix {not json} suffix")).toEqual({});
  });
});
