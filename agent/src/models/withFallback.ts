import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { ChatResult } from "@langchain/core/outputs";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import {
  CodexError,
  CodexTransientError,
  toOutputJsonSchema,
  type CodexSdkCallOptions,
} from "./codexSdk.js";

function messageToText(content: BaseMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          // oxlint-disable-next-line typescript/no-base-to-string -- Preserve legacy coercion for structured message text.
          return String(part.text ?? "");
        }
        return "";
      })
      .join("\n");
  }
  return JSON.stringify(content);
}

/**
 * Provider fallback wrapper.
 *
 * Runs `primary` (Codex SDK) and, on a transient failure, retries it once.
 * If Codex fails for any other classified reason (auth, quota, unknown), the
 * call falls back to `fallback` (OpenRouter/Anthropic). The answering provider
 * is tagged onto `llmOutput.provider` so graph nodes can audit which provider
 * actually served each call.
 *
 * Tool binding and structured output are delegated to the fallback because the
 * Codex model refuses `bindTools`; structured output still works on the primary
 * through the fallback wrapper's own `_generate`.
 */
export class FallbackChatModel extends BaseChatModel<CodexSdkCallOptions> {
  readonly primary: BaseChatModel;
  readonly fallback: BaseChatModel;

  constructor(primary: BaseChatModel, fallback: BaseChatModel) {
    super({});
    this.primary = primary;
    this.fallback = fallback;
  }

  _llmType(): string {
    return "codex_sdk_with_fallback";
  }

  private async runFallback(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager: CallbackManagerForLLMRun | undefined,
    primaryError: unknown,
  ): Promise<ChatResult> {
    const { outputSchema, ...fallbackOptions } = options;
    const metadata = {
      provider: "openrouter-anthropic",
      primaryProvider: "codex-sdk",
      fellBackFrom:
        primaryError instanceof Error
          ? primaryError.message
          : String(primaryError),
    };

    if (outputSchema !== undefined && outputSchema !== null) {
      const structuredFallback = this.fallback.withStructuredOutput(
        outputSchema as Record<string, unknown>,
      );
      const parsed = await structuredFallback.invoke(messages, fallbackOptions);
      const text = JSON.stringify(parsed);
      return {
        generations: [{ text, message: new AIMessage(text) }],
        llmOutput: { ...metadata, structuredFallback: true },
      };
    }

    const result = await this.fallback._generate(
      messages,
      fallbackOptions,
      runManager,
    );
    return {
      ...result,
      llmOutput: {
        ...result.llmOutput,
        ...metadata,
        provider: result.llmOutput?.provider ?? metadata.provider,
      },
    };
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    try {
      const result = await this.primary._generate(
        messages,
        options,
        runManager,
      );
      return {
        ...result,
        llmOutput: {
          ...result.llmOutput,
          provider: result.llmOutput?.provider ?? "codex-sdk",
        },
      };
    } catch (primaryError) {
      // Retry once on a transient Codex error before falling back.
      if (primaryError instanceof CodexTransientError) {
        try {
          const retry = await this.primary._generate(
            messages,
            options,
            runManager,
          );
          return {
            ...retry,
            llmOutput: {
              ...retry.llmOutput,
              provider: retry.llmOutput?.provider ?? "codex-sdk",
              retried: true,
            },
          };
        } catch (retryError) {
          return this.runFallback(messages, options, runManager, retryError);
        }
      }

      // Auth / quota / unknown Codex errors fall straight through to OpenRouter.
      if (primaryError instanceof CodexError) {
        return this.runFallback(messages, options, runManager, primaryError);
      }

      // Non-Codex errors (e.g. programmer error) are not a provider-availability
      // problem — surface them rather than masking with a fallback.
      throw primaryError;
    }
  }

  // Codex cannot bind tools; delegate tool binding entirely to the fallback.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override bindTools(tools: any, kwargs?: any): any {
    return (
      this.fallback as unknown as {
        bindTools: (t: unknown, k?: unknown) => unknown;
      }
    ).bindTools(tools, kwargs);
  }

  // Structured output is supported by the primary (Codex) via outputSchema.
  // Bind the converted schema as a call option and route it through this
  // wrapper's _generate so the Codex->OpenRouter fallback still applies.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override withStructuredOutput(outputSchema: any, config?: any): any {
    const jsonSchema = toOutputJsonSchema(outputSchema);
    const bound = this.withConfig({ outputSchema: jsonSchema });
    const parseOutput = (message: BaseMessage) => {
      const text = messageToText(message.content);
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch (error) {
        throw new CodexError(
          `Structured fallback output was not valid JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error },
        );
      }
    };

    if (config?.includeRaw) {
      return RunnableSequence.from([
        bound,
        RunnableLambda.from((message: BaseMessage) => ({
          raw: message,
          parsed: parseOutput(message),
        })),
      ]);
    }
    return RunnableSequence.from([bound, RunnableLambda.from(parseOutput)]);
  }
}

export function withFallback(
  primary: BaseChatModel,
  fallback: BaseChatModel,
): FallbackChatModel {
  return new FallbackChatModel(primary, fallback);
}
