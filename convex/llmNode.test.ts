import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { z } from "zod";
import { MODELS, TASK_MODELS, TOKEN_BUDGETS } from "./llm";
import { generateLlmObject, generateLlmText } from "./llmNode";

describe("installed AI SDK provider compatibility", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-only");
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-test-only");
    vi.stubEnv("GROQ_API_KEY", "test-only");
    vi.stubEnv("LANGSMITH_TRACING", "false");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function mockCompletion(content: string) {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({
        id: "test-completion",
        object: "chat.completion",
        created: 0,
        model: "test-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 21, completion_tokens: 9, total_tokens: 30 },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  function mockAnthropic(content: string) {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5-5",
        content: [{ type: "text", text: content }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 21, output_tokens: 9 },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  test.each([
    { model: MODELS.sonnet, apiModel: "claude-sonnet-5-5", effort: "medium" },
    { model: MODELS.haiku, apiModel: "claude-haiku-5-5", effort: "medium" },
    { model: MODELS.opus, apiModel: "claude-opus-5-5", effort: "high" },
  ])(
    "$model uses direct Anthropic with $effort reasoning",
    async ({ model, apiModel, effort }) => {
      const fetch = mockAnthropic("A concise extraction.");
      const result = await generateLlmText({
        task: "extract_v3",
        model,
        system: "Extract claims.",
        prompt: "Source text.",
      });
      expect(result.text).toBe("A concise extraction.");
      const [url, init] = fetch.mock.calls[0]!;
      expect(url).toBe("https://api.anthropic.com/v1/messages");
      expect(new Headers(init!.headers).get("x-api-key")).toBe(
        "anthropic-test-only",
      );
      const body = JSON.parse(init!.body as string);
      expect(body).toMatchObject({
        model: apiModel,
        max_tokens: TOKEN_BUDGETS.extract_v3,
        thinking: { type: "adaptive" },
        output_config: { effort },
      });
      expect(body).not.toHaveProperty("temperature");
    },
  );

  test("task defaults select Opus for hypothesis design", async () => {
    const fetch = mockAnthropic("A musical hypothesis.");
    await generateLlmText({
      task: "hypothesis_v1",
      system: "Use evidence.",
      prompt: "Propose a hypothesis.",
    });
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string).model).toBe(
      "claude-opus-5-5",
    );
    expect(TASK_MODELS.hypothesis_v1).toBe(MODELS.opus);
  });

  test("missing Anthropic credentials fail without an OpenRouter fallback", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    await expect(
      generateLlmText({
        task: "extract_v3",
        system: "Extract.",
        prompt: "Source.",
      }),
    ).rejects.toThrow("ANTHROPIC_API_KEY not configured");
  });

  test("OpenRouter preserves reasoning, instructions, and the task token cap", async () => {
    const fetch = mockCompletion("A musical hypothesis.");
    const result = await generateLlmText({
      task: "hypothesis_v1",
      model: "openai/gpt-6.1-sol",
      system: "Use the supplied evidence.",
      prompt: "Propose a hypothesis.",
    });

    expect(result.text).toBe("A musical hypothesis.");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(JSON.parse(init!.body as string)).toMatchObject({
      model: "openai/gpt-6.1-sol",
      max_tokens: TOKEN_BUDGETS.hypothesis_v1,
      reasoning: { effort: "medium" },
      messages: [
        {
          role: "system",
          content: [{ type: "text", text: "Use the supplied evidence." }],
        },
        { role: "user", content: "Propose a hypothesis." },
      ],
    });
  });

  test("Groq routing strips its prefix and retains an explicit token cap", async () => {
    const fetch = mockCompletion("A concise extraction.");
    const result = await generateLlmText({
      task: "extract_v2",
      model: "groq/openai/gpt-oss-120b",
      system: "Extract claims.",
      prompt: "Source text.",
      maxOutputTokens: 100,
    });

    expect(result.text).toBe("A concise extraction.");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(JSON.parse(init!.body as string)).toMatchObject({
      model: "openai/gpt-oss-120b",
      max_tokens: 100,
    });
  });

  test("structured outputs validate with Zod and retain provider token counts", async () => {
    const fetch = mockAnthropic('{"claim":"Interval ratios matter."}');
    const result = await generateLlmObject({
      task: "extract_v2",
      system: "Return one claim.",
      prompt: "Source text.",
      schema: z.object({ claim: z.string() }),
      schemaName: "extraction",
      schemaDescription: "One extracted claim.",
    });

    expect(result).toEqual({
      object: { claim: "Interval ratios matter." },
      inputTokens: 21,
      outputTokens: 9,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = fetch.mock.calls[0]!;
    expect(JSON.parse(init!.body as string)).toMatchObject({
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: {
          type: "json_schema",
          schema: { type: "object", required: ["claim"] },
        },
      },
    });
    expect(JSON.parse(init!.body as string)).not.toHaveProperty("tool_choice");
  });
});
