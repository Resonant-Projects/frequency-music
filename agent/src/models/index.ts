import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  createOpenRouterAnthropicModel,
  type ChatModelOptions,
} from "./openRouterAnthropic.js";
import { createCodexSdkModel } from "./codexSdk.js";
import { withFallback } from "./withFallback.js";

export type ModelProvider = "anthropic" | "codex-sdk" | "openrouter-anthropic";

export interface ResearchModelOptions extends ChatModelOptions {
  /**
   * Tool-using deepagents need a LangChain model with working bindTools.
   * The Codex SDK provider refuses tool binding (it is invoke-only), so
   * tool-binding call paths always resolve to OpenRouter/Anthropic.
   */
  requiresToolBinding?: boolean;
}

/**
 * Direct Anthropic takes precedence. Without its key, Codex is the legacy
 * non-tool provider when `CODEX_ENABLED === "true"`.
 * Binary availability is checked lazily at first use inside the SDK adapter;
 * any auth/quota/transient failure is caught by the fallback wrapper.
 */
export function isCodexEnabled(): boolean {
  return !process.env.ANTHROPIC_API_KEY && process.env.CODEX_ENABLED === "true";
}

export function getConfiguredModelProvider(
  options: ResearchModelOptions = {},
): ModelProvider {
  if (options.requireDirectAnthropic || process.env.ANTHROPIC_API_KEY)
    return "anthropic";
  if (isCodexEnabled() && !options.requiresToolBinding) {
    return "codex-sdk";
  }
  return "openrouter-anthropic";
}

export function getResearchModel(
  options: ResearchModelOptions = {},
): BaseChatModel {
  if (options.requireDirectAnthropic || process.env.ANTHROPIC_API_KEY)
    return createOpenRouterAnthropicModel(options);
  // Tool-binding calls always resolve directly to OpenRouter/Anthropic.
  if (options.requiresToolBinding) {
    return createOpenRouterAnthropicModel(options);
  }

  if (isCodexEnabled()) {
    // Legacy Codex primary with automatic OpenRouter fallback on auth/quota/transient
    // failure. The wrapper tags llmOutput.provider with whichever answered.
    return withFallback(
      createCodexSdkModel(options),
      createOpenRouterAnthropicModel(options),
    );
  }

  return createOpenRouterAnthropicModel(options);
}

export {
  createCodexSdkModel,
  CodexSdkChatModel,
  flattenMessagesToPrompt,
} from "./codexSdk.js";
export {
  CodexError,
  CodexAuthError,
  CodexQuotaError,
  CodexTransientError,
  classifyCodexError,
} from "./codexSdk.js";
export { withFallback, FallbackChatModel } from "./withFallback.js";
export {
  createOpenRouterAnthropicModel,
  normalizeOpenRouterModel,
} from "./openRouterAnthropic.js";
