import { describe, expect, test } from "bun:test";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import type { ChatResult } from "@langchain/core/outputs";

import { withFallback } from "../src/models/withFallback";
import { CodexTransientError, CodexQuotaError } from "../src/models/codexSdk";

class ScriptedModel extends BaseChatModel<BaseChatModelCallOptions> {
  calls = 0;
  constructor(
    private readonly behaviour: () => ChatResult,
    private readonly llmType = "scripted",
  ) {
    super({});
  }
  _llmType() {
    return this.llmType;
  }
  _generate(): Promise<ChatResult> {
    this.calls += 1;
    return Promise.resolve(this.behaviour());
  }
}

function textResult(text: string, provider?: string): ChatResult {
  return {
    generations: [{ text, message: new AIMessage(text) }],
    llmOutput: provider ? { provider } : {},
  };
}

function invoke(model: BaseChatModel, msg = "hi"): Promise<BaseMessage> {
  return model.invoke([new AIMessage(msg)]);
}

describe("withFallback", () => {
  test("uses primary and tags provider codex-sdk", async () => {
    const primary = new ScriptedModel(() => textResult("primary answer"));
    const fallback = new ScriptedModel(() => textResult("fallback answer"));
    const model = withFallback(primary, fallback);
    const res = await invoke(model);
    expect(res.content).toBe("primary answer");
    expect(fallback.calls).toBe(0);
  });

  test("retries once on transient error then succeeds on primary", async () => {
    let n = 0;
    const primary = new ScriptedModel(() => {
      n += 1;
      if (n === 1) throw new CodexTransientError("timeout");
      return textResult("primary retry ok");
    });
    const fallback = new ScriptedModel(() => textResult("fallback answer"));
    const model = withFallback(primary, fallback);
    const res = await invoke(model);
    expect(res.content).toBe("primary retry ok");
    expect(primary.calls).toBe(2);
    expect(fallback.calls).toBe(0);
  });

  test("falls back on quota error", async () => {
    const primary = new ScriptedModel(() => {
      throw new CodexQuotaError("usage limit exceeded");
    });
    const fallback = new ScriptedModel(() =>
      textResult("fallback answer", "openrouter-anthropic"),
    );
    const model = withFallback(primary, fallback);
    const res = await invoke(model);
    expect(res.content).toBe("fallback answer");
    expect(fallback.calls).toBe(1);
  });

  test("falls back after transient retry also fails", async () => {
    const primary = new ScriptedModel(() => {
      throw new CodexTransientError("network down");
    });
    const fallback = new ScriptedModel(() => textResult("fallback answer"));
    const model = withFallback(primary, fallback);
    const res = await invoke(model);
    expect(res.content).toBe("fallback answer");
    expect(primary.calls).toBe(2);
    expect(fallback.calls).toBe(1);
  });

  test("rethrows non-Codex errors without falling back", async () => {
    const primary = new ScriptedModel(() => {
      throw new Error("programmer error");
    });
    const fallback = new ScriptedModel(() => textResult("fallback answer"));
    const model = withFallback(primary, fallback);
    await expect(invoke(model)).rejects.toThrow("programmer error");
    expect(fallback.calls).toBe(0);
  });
});
