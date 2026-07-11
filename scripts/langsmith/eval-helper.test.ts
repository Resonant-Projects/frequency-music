import { describe, expect, test } from "vite-plus/test";
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
