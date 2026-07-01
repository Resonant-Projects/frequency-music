import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { ChatResult } from "@langchain/core/outputs";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { Codex, type SandboxMode, type ThreadOptions, type Usage } from "@openai/codex-sdk";
import { z } from "zod";
import { traceable } from "langsmith/traceable";

/**
 * Codex SDK inference provider.
 *
 * Wraps the official `@openai/codex-sdk`, which drives the local `codex` CLI
 * binary via a thread API (`new Codex()` -> `startThread()` ->
 * `thread.run(prompt, { outputSchema })`) and reuses the CLI's ChatGPT
 * subscription login state from `CODEX_HOME/auth.json`. There is no HTTP
 * endpoint; the previous `codexAppServer.ts` adapter targeted a protocol that
 * does not exist and has been removed.
 *
 * This model is `invoke`-only. `bindTools` intentionally throws so the provider
 * layer routes tool-binding calls to OpenRouter (see `requiresToolBinding`).
 */

export const DEFAULT_CODEX_WORKDIR = "/tmp/codex-scratch";
export const DEFAULT_CODEX_SANDBOX_MODE: SandboxMode = "read-only";

// ---------------------------------------------------------------------------
// Typed error subclasses so the provider layer can decide fallback behaviour.
// ---------------------------------------------------------------------------

export class CodexError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "CodexError";
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/** Missing / expired ChatGPT login (no auth.json, revoked, refresh failed). */
export class CodexAuthError extends CodexError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CodexAuthError";
  }
}

/** Subscription usage / rate limit exhausted — fall back to OpenRouter. */
export class CodexQuotaError extends CodexError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CodexQuotaError";
  }
}

/** Transient failure (network, 5xx, timeout) — safe to retry once. */
export class CodexTransientError extends CodexError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CodexTransientError";
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Map an arbitrary Codex failure into one of the typed subclasses. */
export function classifyCodexError(error: unknown): CodexError {
  if (error instanceof CodexError) return error;
  const message = errorText(error);
  const lower = message.toLowerCase();

  if (
    /unauthor|not logged in|logged out|login|auth|credential|401|token (?:expired|invalid)|expired token/.test(
      lower,
    )
  ) {
    return new CodexAuthError(message, { cause: error });
  }
  if (/quota|rate.?limit|usage limit|429|too many requests|insufficient|exceeded/.test(lower)) {
    return new CodexQuotaError(message, { cause: error });
  }
  if (
    /timeout|timed out|econnreset|econnrefused|enotfound|network|temporar|unavailable|503|502|500|socket hang up/.test(
      lower,
    )
  ) {
    return new CodexTransientError(message, { cause: error });
  }
  // Unknown failures are treated as transient-but-not-retryable at the base
  // level; withFallback still routes any CodexError to the fallback provider.
  return new CodexError(message, { cause: error });
}

// ---------------------------------------------------------------------------
// Pure message flattener (exported for unit tests).
// ---------------------------------------------------------------------------

function messageContentToText(content: BaseMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .filter((chunk) => chunk.length > 0)
      .join("\n");
  }
  return JSON.stringify(content);
}

function roleLabel(message: BaseMessage): string {
  const type = message.getType();
  if (type === "ai") return "Assistant";
  if (type === "tool") return "Tool";
  if (type === "function") return "Tool";
  return "User";
}

/**
 * Flatten LangChain messages into a single Codex prompt.
 *
 * System messages collapse into a leading preamble block; the remaining
 * messages become role-labeled turns in order. Pure and deterministic.
 */
export function flattenMessagesToPrompt(messages: BaseMessage[]): string {
  const systemBlocks: string[] = [];
  const turns: string[] = [];

  for (const message of messages) {
    const text = messageContentToText(message.content).trim();
    if (message.getType() === "system") {
      if (text.length > 0) systemBlocks.push(text);
      continue;
    }
    turns.push(`${roleLabel(message)}: ${text}`);
  }

  const sections: string[] = [];
  if (systemBlocks.length > 0) {
    sections.push(`System preamble:\n${systemBlocks.join("\n\n")}`);
  }
  if (turns.length > 0) {
    sections.push(turns.join("\n\n"));
  }
  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// Structured-output schema conversion.
// ---------------------------------------------------------------------------

function isZodSchema(schema: unknown): boolean {
  return Boolean(
    schema &&
      typeof schema === "object" &&
      ("_def" in (schema as object) || "_zod" in (schema as object)) &&
      typeof (schema as { parse?: unknown }).parse === "function",
  );
}

/**
 * Convert a Zod schema (or pass through a raw JSON Schema object) into the
 * JSON Schema shape Codex expects for `outputSchema`.
 *
 * The plan calls for `zod-to-json-schema` with `target: "openAi"`, but that
 * package is typed against Zod v3 and this workspace runs Zod v4. Zod v4 ships
 * a built-in `z.toJSONSchema` that emits the same OpenAI-compatible dialect
 * (`additionalProperties: false`, explicit `required`), so we use it directly
 * and keep the dependency install per the plan.
 */
export function toOutputJsonSchema(schema: unknown): unknown {
  if (isZodSchema(schema)) {
    return z.toJSONSchema(schema as z.ZodType, {
      target: "draft-2020-12",
      // Ensure objects are closed so Codex/OpenAI structured output stays strict.
      unrepresentable: "any",
    });
  }
  return schema;
}

// ---------------------------------------------------------------------------
// Chat model.
// ---------------------------------------------------------------------------

export interface CodexSdkCallOptions extends BaseChatModelCallOptions {
  /** Resume an existing thread instead of starting a fresh one. */
  threadId?: string;
  /** JSON Schema (already converted) describing the expected structured output. */
  outputSchema?: unknown;
}

export interface CodexSdkChatModelFields extends BaseChatModelParams {
  model?: string;
  sandboxMode?: SandboxMode;
  workingDirectory?: string;
  /** Retained for interface parity; the Codex CLI does not accept temperature. */
  temperature?: number;
}

interface CodexUsageOutput {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
}

function mapUsage(usage: Usage | null): CodexUsageOutput | undefined {
  if (!usage) return undefined;
  return {
    input_tokens: usage.input_tokens,
    cached_input_tokens: usage.cached_input_tokens,
    output_tokens: usage.output_tokens,
    reasoning_output_tokens: usage.reasoning_output_tokens,
    total_tokens: usage.input_tokens + usage.output_tokens,
  };
}

// One Codex client per process. The SDK spawns the `codex` CLI per turn and
// reuses login state from CODEX_HOME, so a shared client is safe and cheap.
let sharedClient: Codex | undefined;

function getCodexClient(): Codex {
  if (!sharedClient) {
    // No options: let the CLI inherit CODEX_HOME/auth from process.env so the
    // subscription login is reused. Passing `env` would opt out of inheritance.
    sharedClient = new Codex();
  }
  return sharedClient;
}

/** Reset the shared client (tests only). */
export function __resetCodexClientForTests(): void {
  sharedClient = undefined;
}

export class CodexSdkChatModel extends BaseChatModel<CodexSdkCallOptions> {
  readonly model?: string;
  readonly sandboxMode: SandboxMode;
  readonly workingDirectory: string;
  readonly temperature?: number;

  constructor(fields: CodexSdkChatModelFields = {}) {
    super(fields);
    this.model = fields.model ?? process.env.CODEX_MODEL ?? undefined;
    this.sandboxMode =
      fields.sandboxMode ??
      (process.env.CODEX_SANDBOX_MODE as SandboxMode | undefined) ??
      DEFAULT_CODEX_SANDBOX_MODE;
    this.workingDirectory =
      fields.workingDirectory ?? process.env.CODEX_WORKDIR ?? DEFAULT_CODEX_WORKDIR;
    this.temperature = fields.temperature;
  }

  _llmType(): string {
    return "codex_sdk";
  }

  override invocationParams() {
    return {
      model: this.model,
      sandboxMode: this.sandboxMode,
    };
  }

  private threadOptions(): ThreadOptions {
    const options: ThreadOptions = {
      workingDirectory: this.workingDirectory,
      skipGitRepoCheck: true,
      sandboxMode: this.sandboxMode,
    };
    if (this.model) options.model = this.model;
    return options;
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const prompt = flattenMessagesToPrompt(messages);
    const client = getCodexClient();
    const threadId = options.threadId;
    const thread = threadId
      ? client.resumeThread(threadId, this.threadOptions())
      : client.startThread(this.threadOptions());

    const outputSchema = options.outputSchema;
    const structuredOutput = outputSchema !== undefined;

    const runTurn = async () =>
      thread.run(prompt, {
        ...(structuredOutput ? { outputSchema } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });

    const tracingEnabled = process.env.LANGSMITH_TRACING === "true";
    const invokeTurn = tracingEnabled
      ? traceable(runTurn, {
          name: "codex_sdk.run",
          metadata: {
            model: this.model ?? "codex-default",
            sandboxMode: this.sandboxMode,
            threadId: threadId ?? null,
            structuredOutput,
          },
        })
      : runTurn;

    let turn;
    try {
      turn = await invokeTurn();
    } catch (error) {
      throw classifyCodexError(error);
    }

    const text = turn.finalResponse ?? "";

    return {
      generations: [
        {
          text,
          message: new AIMessage(text),
        },
      ],
      llmOutput: {
        usage: mapUsage(turn.usage),
        model: this.model ?? "codex-default",
        threadId: thread.id ?? threadId ?? undefined,
        provider: "codex-sdk",
      },
    };
  }

  override bindTools(): never {
    throw new Error(
      "Codex SDK provider does not support LangChain tool binding; route tool-binding calls to OpenRouter",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override withStructuredOutput(outputSchema: any, config?: any): any {
    const jsonSchema = toOutputJsonSchema(outputSchema);
    const bound = this.withConfig({ outputSchema: jsonSchema });

    const parseOutput = (message: BaseMessage) => {
      const text = messageContentToText(message.content);
      return JSON.parse(text) as Record<string, unknown>;
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

export function createCodexSdkModel(
  options: { temperature?: number; model?: string; sandboxMode?: SandboxMode; workingDirectory?: string } = {},
): CodexSdkChatModel {
  return new CodexSdkChatModel({
    model: options.model,
    sandboxMode: options.sandboxMode,
    workingDirectory: options.workingDirectory,
    temperature: options.temperature,
  });
}
