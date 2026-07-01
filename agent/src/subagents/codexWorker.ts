import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Codex, type SandboxMode, type Usage } from "@openai/codex-sdk";
import { traceable } from "langsmith/traceable";
import { classifyCodexError, toOutputJsonSchema } from "../models/codexSdk.js";

/**
 * Codex specialist worker.
 *
 * Delegates a whole subtask to a Codex thread (with its own sandboxed tool use)
 * rather than using Codex as a bare completion model. It seeds a scratch
 * workspace with context files, runs one thread turn with a structured
 * `outputSchema`, and returns the parsed output plus thread id and usage.
 *
 * Default `sandboxMode: "read-only"`. `workspace-write` is reserved for the
 * plan-05 verification sandbox.
 */

export interface CodexTaskContextFile {
  /** Relative filename written into the scratch workspace (e.g. "candidate.json"). */
  name: string;
  /** File contents. Objects are JSON-serialized. */
  content: string | unknown;
}

export interface RunCodexTaskInput {
  /** Natural-language instructions for the subtask. */
  instructions: string;
  /**
   * Context seeded into the scratch workspace. Provide an object (written as
   * context.json), an array of named files, or a raw string (context.md).
   */
  context?: Record<string, unknown> | CodexTaskContextFile[] | string;
  /** JSON Schema or Zod schema describing the expected structured output. */
  outputSchema?: unknown;
  /** Defaults to "read-only". */
  sandboxMode?: SandboxMode;
  /** Existing scratch dir to reuse; otherwise a temp dir is created. */
  workdir?: string;
  /** Optional model override. */
  model?: string;
  /** Resume an existing thread instead of starting fresh. */
  threadId?: string;
}

export interface RunCodexTaskResult<T = unknown> {
  /** Parsed structured output when an outputSchema was provided, else raw text. */
  output: T;
  /** Raw final response text from the turn. */
  rawText: string;
  /** Thread id — store in agentRunEvents so long tasks resume after restarts. */
  threadId: string | null;
  usage: Usage | null;
  workdir: string;
}

let sharedClient: Codex | undefined;

function getClient(): Codex {
  if (!sharedClient) sharedClient = new Codex();
  return sharedClient;
}

/** Reset the shared client (tests only). */
export function __resetCodexWorkerClientForTests(): void {
  sharedClient = undefined;
}

async function seedWorkspace(
  workdir: string,
  context: RunCodexTaskInput["context"],
): Promise<void> {
  await mkdir(workdir, { recursive: true });
  if (context === undefined) return;

  if (typeof context === "string") {
    await writeFile(join(workdir, "context.md"), context, "utf8");
    return;
  }

  if (Array.isArray(context)) {
    await Promise.all(
      context.map((file) => {
        const body =
          typeof file.content === "string" ? file.content : JSON.stringify(file.content, null, 2);
        return writeFile(join(workdir, file.name), body, "utf8");
      }),
    );
    return;
  }

  await writeFile(join(workdir, "context.json"), JSON.stringify(context, null, 2), "utf8");
}

export async function runCodexTask<T = unknown>(
  input: RunCodexTaskInput,
): Promise<RunCodexTaskResult<T>> {
  const sandboxMode: SandboxMode = input.sandboxMode ?? "read-only";
  const workdir =
    input.workdir ??
    (await mkdtemp(join(process.env.CODEX_WORKDIR ?? tmpdir(), "codex-task-")));

  await seedWorkspace(workdir, input.context);

  const client = getClient();
  const threadOptions = {
    workingDirectory: workdir,
    skipGitRepoCheck: true,
    sandboxMode,
    ...(input.model ? { model: input.model } : {}),
  };
  const thread = input.threadId
    ? client.resumeThread(input.threadId, threadOptions)
    : client.startThread(threadOptions);

  const outputSchema =
    input.outputSchema !== undefined ? toOutputJsonSchema(input.outputSchema) : undefined;
  const structuredOutput = outputSchema !== undefined;

  const runTurn = async () =>
    thread.run(input.instructions, structuredOutput ? { outputSchema } : {});

  const tracingEnabled = process.env.LANGSMITH_TRACING === "true";
  const invokeTurn = tracingEnabled
    ? traceable(runTurn, {
        name: "codex_sdk.worker",
        metadata: {
          model: input.model ?? "codex-default",
          sandboxMode,
          threadId: input.threadId ?? null,
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

  const rawText = turn.finalResponse ?? "";
  const output = (structuredOutput ? JSON.parse(rawText) : rawText) as T;

  return {
    output,
    rawText,
    threadId: thread.id,
    usage: turn.usage,
    workdir,
  };
}
