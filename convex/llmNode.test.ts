import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { z } from "zod";
import { DEFAULT_MODEL, MODELS, TOKEN_BUDGETS } from "./llm";
import { generateLlmObject, generateLlmText } from "./llmNode";

describe("installed AI SDK provider compatibility", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-only");
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

  test("OpenRouter preserves reasoning, instructions, and the task token cap", async () => {
    const fetch = mockCompletion("A musical hypothesis.");
    const result = await generateLlmText({
      task: "hypothesis_v1",
      system: "Use the supplied evidence.",
      prompt: "Propose a hypothesis.",
    });

    expect(result.text).toBe("A musical hypothesis.");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(JSON.parse(init!.body as string)).toMatchObject({
      model: DEFAULT_MODEL,
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
      model: MODELS.fast,
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
    const fetch = mockCompletion('{"claim":"Interval ratios matter."}');
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
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "extraction",
          schema: { type: "object", required: ["claim"] },
        },
      },
    });
  });
});
