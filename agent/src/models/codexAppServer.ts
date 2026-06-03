import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { ChatResult } from "@langchain/core/outputs";

export interface CodexAppServerChatModelFields extends BaseChatModelParams {
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
}

interface OpenAICompatibleChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

function messageRole(message: BaseMessage): OpenAICompatibleChatMessage["role"] {
  const type = message.getType();
  if (type === "system") return "system";
  if (type === "ai") return "assistant";
  if (type === "tool") return "tool";
  return "user";
}

function messageContent(message: BaseMessage): string {
  const content = message.content;
  if (typeof content === "string") return content;
  return JSON.stringify(content);
}

function toOpenAIMessage(message: BaseMessage): OpenAICompatibleChatMessage {
  return {
    role: messageRole(message),
    content: messageContent(message),
  };
}

export class CodexAppServerChatModel extends BaseChatModel<BaseChatModelCallOptions> {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly model: string;
  readonly temperature?: number;

  constructor(fields: CodexAppServerChatModelFields) {
    super(fields);
    this.baseUrl = fields.baseUrl.replace(/\/$/, "");
    this.apiKey = fields.apiKey;
    this.model = fields.model;
    this.temperature = fields.temperature;
  }

  _llmType() {
    return "codex_app_server";
  }

  override invocationParams() {
    return {
      model: this.model,
      temperature: this.temperature,
    };
  }

  async _generate(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        messages: messages.map(toOpenAIMessage),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Codex App Server request failed: ${response.status} ${await response.text()}`,
      );
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: unknown;
      model?: string;
    };
    const text = json.choices?.[0]?.message?.content ?? "";

    return {
      generations: [
        {
          text,
          message: new AIMessage(text),
        },
      ],
      llmOutput: {
        usage: json.usage,
        model: json.model ?? this.model,
      },
    };
  }
}

export function createCodexAppServerModel(options: {
  temperature?: number;
  model?: string;
} = {}) {
  const baseUrl = process.env.CODEX_APP_SERVER_URL;
  if (!baseUrl) {
    throw new Error("CODEX_APP_SERVER_URL is required for Codex App Server model use");
  }

  return new CodexAppServerChatModel({
    baseUrl,
    apiKey: process.env.CODEX_APP_SERVER_AUTH_TOKEN,
    model: options.model ?? process.env.CODEX_APP_SERVER_MODEL ?? "codex-local",
    temperature: options.temperature ?? 0.2,
  });
}
