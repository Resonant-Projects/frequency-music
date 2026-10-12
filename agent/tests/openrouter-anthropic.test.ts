import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { z } from "zod";
import {
  getConfiguredModelProvider,
  getResearchModel,
} from "../src/models/index";
import { createOpenRouterAnthropicModel } from "../src/models/openRouterAnthropic";

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-only");
  vi.stubEnv("ANTHROPIC_API_URL", undefined);
  vi.stubEnv("WEEKLY_BRIEF_AGENT_MODEL", undefined);
});

afterEach(() => vi.unstubAllEnvs());

describe.each([
  {
    provider: "OpenRouter",
    apiKey: "test-only",
    model: "anthropic/claude-sonnet-5.5",
  },
  { provider: "Anthropic", apiKey: undefined, model: "claude-sonnet-5-5" },
])("$provider sampling parameters", ({ apiKey, model }) => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", apiKey);
    vi.stubEnv("ANTHROPIC_API_KEY", apiKey ? undefined : "test-only");
  });

  test.each([undefined, 0, 0.2, 0.8])(
    "omits Sonnet 5.5 temperature when configured as %s",
    (temperature) => {
      const params = createOpenRouterAnthropicModel({
        temperature,
      }).invocationParams({});
      expect(params.model).toBe(model);
      expect(params).not.toHaveProperty("temperature");
    },
  );

  test("omits temperature for a configured Sonnet 5.5 model", () => {
    vi.stubEnv("WEEKLY_BRIEF_AGENT_MODEL", model);
    const params = createOpenRouterAnthropicModel({
      temperature: 0,
    }).invocationParams({});
    expect(params).not.toHaveProperty("temperature");
  });

  test("omits temperature for an explicit Sonnet 5.5 dash-form override", () => {
    const params = createOpenRouterAnthropicModel({
      model: "claude-sonnet-5-5",
      temperature: 0,
    }).invocationParams({});
    expect(params.model).toBe(model);
    expect(params).not.toHaveProperty("temperature");
  });

  test("enables adaptive thinking, which Sonnet 5.5 requires", () => {
    const params = createOpenRouterAnthropicModel({ model }).invocationParams(
      {},
    );
    // Keep Sonnet 5.5's required adaptive thinking explicit even though
    // ChatAnthropic now omits thinking when it is not configured.
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(
      createOpenRouterAnthropicModel().invocationParams({}).thinking,
    ).toEqual({ type: "adaptive" });
  });

  test.each(["claude-sonnet-4-6", "claude-haiku-4-5", "claude-opus-4-6"])(
    "rejects an older override %s rather than omitting reasoning",
    (olderModel) => {
      expect(() =>
        createOpenRouterAnthropicModel({ model: olderModel }),
      ).toThrow("use Sonnet, Haiku, or Opus 5.5 with adaptive thinking");
      vi.stubEnv("WEEKLY_BRIEF_AGENT_MODEL", olderModel);
      expect(() => createOpenRouterAnthropicModel()).toThrow(
        "Unsupported worker model",
      );
    },
  );
});

describe("direct Anthropic credit routing", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "legacy-openrouter-key");
    vi.stubEnv("CODEX_ENABLED", "true");
    vi.stubEnv("CODEX_SPECIALIST", "true");
    // A legacy proxy URL must not send the Anthropic key to OpenRouter.
    vi.stubEnv("ANTHROPIC_API_URL", "https://openrouter.ai/api");
  });

  test("Anthropic takes precedence over legacy Codex and OpenRouter configuration", () => {
    expect(getConfiguredModelProvider()).toBe("anthropic");
    expect(getConfiguredModelProvider({ requiresToolBinding: true })).toBe(
      "anthropic",
    );
    const model = getResearchModel() as ReturnType<
      typeof createOpenRouterAnthropicModel
    >;
    expect(model.model).toBe("claude-sonnet-5-5");
    expect(model.apiKey).toBe("test-only");
    expect(model.apiUrl).toBe("https://api.anthropic.com");
  });

  test.each([
    {
      model: "anthropic/claude-sonnet-5.5",
      apiModel: "claude-sonnet-5-5",
      effort: "medium",
    },
    {
      model: "anthropic/claude-haiku-5.5",
      apiModel: "claude-haiku-5-5",
      effort: "medium",
    },
    {
      model: "anthropic/claude-opus-5.5",
      apiModel: "claude-opus-5-5",
      effort: "high",
    },
  ])(
    "$model preserves reasoning in plain, tool, and structured calls",
    ({ model, apiModel, effort }) => {
      const chat = createOpenRouterAnthropicModel({ model, temperature: 0 });
      const plain = chat.invocationParams({});
      expect(plain).toMatchObject({
        model: apiModel,
        thinking: { type: "adaptive" },
        output_config: { effort },
      });
      expect(plain).not.toHaveProperty("temperature");
      const toolParams = chat.invocationParams({
        tools: [
          {
            name: "lookup",
            description: "Look up evidence.",
            input_schema: { type: "object", properties: {} },
          },
        ],
      });
      expect(toolParams).toMatchObject({
        thinking: { type: "adaptive" },
        output_config: { effort },
      });
      expect(toolParams.tool_choice).not.toEqual({ type: "any" });
      const structured = chat.invocationParams({
        outputConfig: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: { accept: { type: "boolean" } },
              required: ["accept"],
              additionalProperties: false,
            },
          },
        },
      });
      expect(structured.output_config).toMatchObject({
        effort,
        format: { type: "json_schema" },
      });
      expect(structured.thinking).toEqual({ type: "adaptive" });
    },
  );

  test("native structured output sends medium effort to the direct API", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "claude-haiku-5-5",
        content: [{ type: "text", text: '{"accept":true}' }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    try {
      const judge = createOpenRouterAnthropicModel({
        model: "anthropic/claude-haiku-5.5",
      }).withStructuredOutput(z.object({ accept: z.boolean() }), {
        method: "jsonSchema",
      });
      expect(await judge.invoke("Is this relevant?")).toEqual({ accept: true });
      const [url, init] = fetch.mock.calls[0]!;
      expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
      const body = JSON.parse(init!.body as string);
      expect(body).toMatchObject({
        model: "claude-haiku-5-5",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: { type: "json_schema" } },
      });
      expect(body).not.toHaveProperty("tool_choice");
      expect(body).not.toHaveProperty("temperature");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
