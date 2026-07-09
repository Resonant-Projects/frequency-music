import { describe, expect, test } from "bun:test";
import {
  DEFAULT_MODEL,
  extractJsonObject,
  isGroqModel,
  TOKEN_BUDGETS,
} from "./llm";

describe("llm constants", () => {
  test("default model and budgets match the values the four generators used", () => {
    expect(DEFAULT_MODEL).toBe("anthropic/claude-sonnet-4-6");
    expect(TOKEN_BUDGETS.extract_v2).toBe(4096);
    expect(TOKEN_BUDGETS.hypothesis_v1).toBe(2000);
    expect(TOKEN_BUDGETS.recipe_v1).toBe(3000);
    expect(TOKEN_BUDGETS.brief_v2).toBe(4000);
  });

  test("isGroqModel routes on the groq/ prefix", () => {
    expect(isGroqModel("groq/moonshotai/kimi-k2-instruct")).toBe(true);
    expect(isGroqModel("anthropic/claude-sonnet-4-6")).toBe(false);
  });
});

describe("extractJsonObject", () => {
  test("parses a fenced ```json block", () => {
    const text = 'Here you go:\n```json\n{ "a": 1 }\n```\nDone.';
    expect(extractJsonObject(text)).toEqual({ a: 1 });
  });

  test("parses a bare JSON object (first { to last })", () => {
    const text = 'Sure: { "a": { "b": 2 } } trailing prose without braces';
    expect(extractJsonObject(text)).toEqual({ a: { b: 2 } });
  });

  test("prefers the fenced block over surrounding braces in prose", () => {
    const text =
      'Context {irrelevant} then\n```json\n{ "picked": true }\n```\nand {more}';
    expect(extractJsonObject(text)).toEqual({ picked: true });
  });

  test("throws when no JSON object is present", () => {
    expect(() => extractJsonObject("no json here at all")).toThrow(
      "No JSON object found in model response",
    );
  });

  test("throws on invalid JSON with a snippet in the message", () => {
    expect(() => extractJsonObject('```json\n{ "a": oops }\n```')).toThrow(
      /Invalid JSON/,
    );
  });
});
