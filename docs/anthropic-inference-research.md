# Direct Anthropic inference research

Checked October 12, 2026 against Anthropic, Vercel AI SDK, and LangChain primary sources. Scope is the user-selected Anthropic API for Convex and the research worker, with at least medium reasoning on every task.

## Model IDs and task roles

All three requested models exist and are active on the direct Claude API. Anthropic released Haiku 5.5 on October 7, 2026. Its ID has no date suffix or separate alias. Direct API IDs use hyphens, unlike the repository's existing OpenRouter IDs. [Anthropic model overview](https://platform.claude.com/docs/en/about-claude/models/overview), [Haiku overview](https://platform.claude.com/docs/en/models/haiku-5-5/overview), [Haiku migration guide](https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide).

| Model | Direct API ID | Intended role | Input / output price per million tokens |
| --- | --- | --- | --- |
| Sonnet 5.5 | `claude-sonnet-5-5` | Default research, synthesis, extraction, and tool use | $2 / $10 |
| Haiku 5.5 | `claude-haiku-5-5` | Classification, routing, and bounded checks | $0.10 / $0.50 for prompts up to 100,000 tokens; $0.50 / $2.50 above that |
| Opus 5.5 | `claude-opus-5-5` | Explicit escalation for demanding reasoning | $4 / $20 |

Anthropic describes Haiku as suitable for classification, extraction, routing, and subagent tasks. Assigning the repository's task roles is an implementation decision, not a vendor guarantee of equivalent extraction quality. [Sonnet overview](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Haiku overview](https://platform.claude.com/docs/en/models/haiku-5-5/overview), [Opus overview](https://platform.claude.com/docs/en/models/opus-5-5/overview).

## Reasoning configuration

All three models accept adaptive thinking and `output_config.effort: "medium"`. They also support `high`, `xhigh`, and `max`. Sonnet defaults to high effort; Haiku and Opus default to medium. Set effort explicitly so the repository's minimum does not depend on a provider default. Adaptive thinking lets the model decide how much to think, so medium effort does not guarantee a minimum number of thinking tokens. [Effort reference](https://platform.claude.com/docs/en/build-with-claude/effort), [Haiku migration guide, configure thinking](https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide#configure-thinking).

The direct Messages API request uses:

```json
{
  "model": "claude-haiku-5-5",
  "max_tokens": 16000,
  "thinking": { "type": "adaptive" },
  "output_config": { "effort": "medium" },
  "messages": [{ "role": "user", "content": "..." }]
}
```

For Convex's AI SDK calls, put both options on every text and object generation:

```ts
providerOptions: {
  anthropic: {
    thinking: { type: "adaptive" },
    effort: "medium",
  },
}
```

`createAnthropic({ apiKey })` creates the provider; `anthropic("claude-sonnet-5-5")` selects the model. The provider reads `ANTHROPIC_API_KEY` by default and sends `x-api-key`. The installed `@ai-sdk/anthropic` 4.0.78 accepts all requested IDs and effort levels. Its `src/anthropic-language-model.ts` serializes `providerOptions.anthropic.effort` into `output_config.effort`. [AI SDK Anthropic provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic). The installed package source confirmed the wire mapping during this research.

For the worker's LangChain model constructor:

```ts
new ChatAnthropic({
  model: "claude-sonnet-5-5",
  apiKey: process.env.ANTHROPIC_API_KEY,
  thinking: { type: "adaptive" },
  outputConfig: { effort: "medium" },
});
```

LangChain's upstream package version is 1.5.12, matching `agent/package.json`. Its constructor documents `outputConfig.effort`, merges constructor and call options, and serializes them to `output_config`. That merge retains effort when native structured output adds its `format`. [LangChain JavaScript Anthropic integration](https://docs.langchain.com/oss/javascript/integrations/chat/anthropic), [LangChain implementation](https://github.com/langchain-ai/langchainjs/blob/main/libs/providers/langchain-anthropic/src/chat_models.ts), [package version](https://github.com/langchain-ai/langchainjs/blob/main/libs/providers/langchain-anthropic/package.json).

## Compatibility requirements

- Omit `temperature`, `top_p`, and `top_k` for every 5.5 model. Non-default sampling values return 400 errors. The worker currently exposes temperature options, so the Anthropic adapter must avoid forwarding those values. [Sonnet overview](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Haiku migration guide](https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide#remove-sampling-parameters).
- Sonnet 5.5 and Opus 5.5 reject forced tool choice. Use native JSON-schema structured output. AI SDK's `auto` structured output mode selects native `output_config.format`; LangChain supports `.withStructuredOutput(schema, { method: "jsonSchema" })`. LangChain's default method remains function calling, so keep the method explicit. [Sonnet overview](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Opus overview](https://platform.claude.com/docs/en/models/opus-5-5/overview), [AI SDK provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic), [LangChain implementation](https://github.com/langchain-ai/langchainjs/blob/main/libs/providers/langchain-anthropic/src/chat_models.ts).
- Sonnet and Opus 5.5 cannot disable thinking. Haiku can disable thinking at medium effort, but adaptive thinking should remain explicit to satisfy the user's reasoning requirement. Thinking and final text share the output-token cap. Check truncation and empty final text, especially for small classifier budgets. [Effort reference](https://platform.claude.com/docs/en/build-with-claude/effort), [Haiku migration guide](https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide#configure-thinking).
- Preserve thinking blocks unchanged through tool turns. They bind to the originating account, model, and conversation. Switching providers or editing earlier messages can invalidate replay. [Sonnet overview](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Haiku migration guide](https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide).

## Account availability and validation

Public documentation establishes that these models exist. It does not establish this user's account access, credit balance, quota, or successful inference. Validate the resolved 1Password key against `GET https://api.anthropic.com/v1/models`, using `x-api-key` and `anthropic-version: 2023-06-01`. The response lists available models and capability fields. Follow `has_more` using `after_id`, or request an adequate page size. A Messages API smoke call then verifies actual inference. [Models API](https://platform.claude.com/docs/en/api/models/list).

This research did not read credentials, query the authenticated account, or run paid inference. Those checks belong to the implementation and deployment validation. The repository's catalog checker must validate direct Anthropic IDs against Anthropic's catalog rather than OpenRouter's dot-form identifiers. Worker provider selection must choose direct Anthropic even when legacy OpenRouter credentials or `CODEX_ENABLED=true` remain configured.
