import { describe, expect, test } from "bun:test";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { z } from "zod";

import {
  flattenMessagesToPrompt,
  toOutputJsonSchema,
  classifyCodexError,
  CodexAuthError,
  CodexQuotaError,
  CodexTransientError,
  CodexError,
} from "../src/models/codexSdk";

describe("flattenMessagesToPrompt", () => {
  test("collapses system messages into a leading preamble block", () => {
    const prompt = flattenMessagesToPrompt([
      new SystemMessage("You are a helpful specialist."),
      new HumanMessage("Summarize the candidate."),
    ]);
    expect(prompt).toBe(
      "System preamble:\nYou are a helpful specialist.\n\nUser: Summarize the candidate.",
    );
  });

  test("labels alternating role turns in order", () => {
    const prompt = flattenMessagesToPrompt([
      new SystemMessage("Sys A"),
      new SystemMessage("Sys B"),
      new HumanMessage("Question one"),
      new AIMessage("Answer one"),
      new ToolMessage({ content: "tool result", tool_call_id: "t1" }),
      new HumanMessage("Question two"),
    ]);
    expect(prompt).toBe(
      [
        "System preamble:\nSys A\n\nSys B",
        "User: Question one\n\nAssistant: Answer one\n\nTool: tool result\n\nUser: Question two",
      ].join("\n\n"),
    );
  });

  test("handles messages with no system preamble", () => {
    const prompt = flattenMessagesToPrompt([new HumanMessage("Hi there")]);
    expect(prompt).toBe("User: Hi there");
  });

  test("flattens array content parts into text", () => {
    const prompt = flattenMessagesToPrompt([
      new HumanMessage({
        content: [
          { type: "text", text: "part one" },
          { type: "text", text: "part two" },
        ],
      }),
    ]);
    expect(prompt).toBe("User: part one\npart two");
  });
});

describe("toOutputJsonSchema", () => {
  test("converts a Zod schema to JSON Schema", () => {
    const schema = z.object({ answer: z.number() });
    const json = toOutputJsonSchema(schema) as Record<string, unknown>;
    expect(json).toHaveProperty("type", "object");
    expect(json).toHaveProperty("properties");
  });

  test("passes through a raw JSON Schema object unchanged", () => {
    const raw = { type: "object", properties: { x: { type: "string" } } };
    expect(toOutputJsonSchema(raw)).toBe(raw);
  });
});

describe("classifyCodexError", () => {
  test("classifies auth failures", () => {
    expect(
      classifyCodexError(new Error("Not logged in: run codex login")),
    ).toBeInstanceOf(CodexAuthError);
    expect(
      classifyCodexError(new Error("HTTP 401 Unauthorized")),
    ).toBeInstanceOf(CodexAuthError);
  });

  test("classifies quota failures", () => {
    expect(
      classifyCodexError(new Error("usage limit exceeded")),
    ).toBeInstanceOf(CodexQuotaError);
    expect(
      classifyCodexError(new Error("429 too many requests")),
    ).toBeInstanceOf(CodexQuotaError);
  });

  test("classifies transient failures", () => {
    expect(classifyCodexError(new Error("connection timeout"))).toBeInstanceOf(
      CodexTransientError,
    );
    expect(
      classifyCodexError(new Error("service unavailable (503)")),
    ).toBeInstanceOf(CodexTransientError);
  });

  test("falls back to a generic CodexError for unknown messages", () => {
    const err = classifyCodexError(new Error("something unexpected happened"));
    expect(err).toBeInstanceOf(CodexError);
    expect(err).not.toBeInstanceOf(CodexTransientError);
  });

  test("returns the original error if already a CodexError", () => {
    const original = new CodexQuotaError("quota");
    expect(classifyCodexError(original)).toBe(original);
  });
});
