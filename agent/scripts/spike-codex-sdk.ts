/**
 * Spike: prove one structured-output Codex call works with ChatGPT
 * subscription auth and no API key.
 *
 * Prereqs:
 *   - `codex` CLI installed and `codex login` completed on this machine, so
 *     auth.json exists under CODEX_HOME (default ~/.codex).
 *   - OPENAI_API_KEY / CODEX_API_KEY UNSET, so the SDK reuses login state.
 *
 * Run: `bun scripts/spike-codex-sdk.ts`
 *
 * Prints ONLY: parsed JSON, thread id, and usage. Never prints token or
 * auth.json contents.
 *
 * Observed (2026-07-01, ChatGPT subscription auth, no API key):
 *   - latency: ~7.2s first run / ~4.5s resumed run
 *   - usage shape: { input_tokens, cached_input_tokens, output_tokens,
 *                    reasoning_output_tokens } (first run ~21k input / 91 output)
 *   - resumeThread reuses the same thread id and structured output round-trips
 *   - default model served: the `codex` CLI default (codex-default; no override
 *     passed). Set CODEX_MODEL to pin a specific model.
 */

import { Codex } from "@openai/codex-sdk";
import { z } from "zod";

const workingDirectory = process.env.CODEX_WORKDIR ?? "/tmp/codex-scratch";
const sandboxMode = "read-only" as const;

// Small structured schema so we can confirm outputSchema round-trips.
const schema = z.object({
  provider: z.string().describe("Name of the inference provider responding"),
  confirmation: z
    .string()
    .describe("One short sentence confirming the call worked"),
  answer: z.number().describe("The result of 6 multiplied by 7"),
});

const outputSchema = z.toJSONSchema(schema, { target: "draft-2020-12" });

const prompt =
  "You are confirming the Codex SDK works. Set provider to 'codex-sdk', " +
  "write a one-sentence confirmation, and compute 6 * 7 into answer. " +
  "Respond only via the structured output schema.";

async function main() {
  const codex = new Codex();

  const started = Date.now();
  const thread = codex.startThread({
    workingDirectory,
    skipGitRepoCheck: true,
    sandboxMode,
  });
  const first = await thread.run(prompt, { outputSchema });
  const firstLatency = Date.now() - started;

  const threadId = thread.id;
  const parsed = JSON.parse(first.finalResponse);

  console.log(
    JSON.stringify(
      {
        run: "first",
        latencyMs: firstLatency,
        threadId,
        usage: first.usage,
        parsed,
      },
      null,
      2,
    ),
  );

  if (!threadId) {
    console.error("No thread id returned; cannot exercise resumeThread.");
    process.exit(1);
  }

  // Second run via resumeThread to confirm CODEX_HOME/sessions persistence.
  const resumeStarted = Date.now();
  const resumed = codex.resumeThread(threadId, {
    workingDirectory,
    skipGitRepoCheck: true,
    sandboxMode,
  });
  const second = await resumed.run(
    "Repeat the previous answer number in the 'answer' field and set confirmation to 'resumed ok'.",
    { outputSchema },
  );
  const resumeLatency = Date.now() - resumeStarted;

  console.log(
    JSON.stringify(
      {
        run: "resumed",
        latencyMs: resumeLatency,
        threadId: resumed.id,
        usage: second.usage,
        parsed: JSON.parse(second.finalResponse),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  // Print a sanitized message only; never dump auth material.
  console.error(
    "spike-codex-sdk failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
