import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  createOpenRouterAnthropicModel,
  type ChatModelOptions,
} from "./openRouterAnthropic.js";
import { createCodexAppServerModel } from "./codexAppServer.js";

export type ModelProvider = "codex-app-server" | "openrouter-anthropic";

export interface ResearchModelOptions extends ChatModelOptions {
  /**
   * Tool-using deepagents currently need a LangChain model with working bindTools.
   * The Codex App Server adapter is available for spikes, but it intentionally
   * refuses tool binding until the server protocol is confirmed.
   */
  requiresToolBinding?: boolean;
}

export function getConfiguredModelProvider(options: ResearchModelOptions = {}): ModelProvider {
  if (process.env.CODEX_APP_SERVER_URL && !options.requiresToolBinding) {
    return "codex-app-server";
  }
  return "openrouter-anthropic";
}

export function getResearchModel(options: ResearchModelOptions = {}): BaseChatModel {
  const provider = getConfiguredModelProvider(options);
  if (provider === "codex-app-server") {
    return createCodexAppServerModel(options);
  }
  return createOpenRouterAnthropicModel(options);
}

export { createCodexAppServerModel, CodexAppServerChatModel } from "./codexAppServer.js";
export { createOpenRouterAnthropicModel, normalizeOpenRouterModel } from "./openRouterAnthropic.js";
