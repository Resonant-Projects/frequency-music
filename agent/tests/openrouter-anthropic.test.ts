import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
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
  beforeEach(() => vi.stubEnv("OPENROUTER_API_KEY", apiKey));

  test.each([
    undefined,
    0,
    0.2,
    0.8,
  ])("omits Sonnet 5.5 temperature when configured as %s", (temperature) => {
    const params = createOpenRouterAnthropicModel({
      temperature,
    }).invocationParams({});
    expect(params.model).toBe(model);
    expect(params).not.toHaveProperty("temperature");
  });

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
    // The installed ChatAnthropic otherwise sends thinking: disabled, which
    // Sonnet 5.5 rejects ("Reasoning is mandatory ... cannot be disabled").
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(
      createOpenRouterAnthropicModel().invocationParams({}).thinking,
    ).toEqual({ type: "adaptive" });
  });

  test("keeps the library's thinking default for older models", () => {
    const params = createOpenRouterAnthropicModel({
      model: "claude-sonnet-4-6",
    }).invocationParams({});
    expect(params.thinking).toEqual({ type: "disabled" });
  });

  test("preserves the default temperature for older models", () => {
    const params = createOpenRouterAnthropicModel({
      model: "claude-sonnet-4-6",
    }).invocationParams({});
    expect(params.temperature).toBe(0.2);
  });

  test("preserves temperature overrides for older models", () => {
    const params = createOpenRouterAnthropicModel({
      model: "claude-sonnet-4-6",
      temperature: 0,
    }).invocationParams({});
    expect(params.temperature).toBe(0);
  });
});
