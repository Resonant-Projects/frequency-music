import { HumanMessage } from "@langchain/core/messages";

/**
 * A prompt whose `shared` text repeats byte-for-byte across sequential calls
 * in one run, with the same model and output schema. `toModelInput` puts an
 * Anthropic cache breakpoint (5-minute TTL) at the end of `shared`, so later
 * calls read that prefix from the cache. Below the model's minimum cacheable
 * length (512 tokens on the 5.5 models) the marker is a silent no-op.
 *
 * Mark only prefixes that repeat: a write with no later read costs 1.25x.
 */
export type CachedPrompt = { readonly shared: string; readonly rest: string };

/** A plain string carries no cache breakpoint. */
export type ModelPrompt = string | CachedPrompt;

export function cachedPrompt(shared: string, rest: string): CachedPrompt {
  if (!shared || !rest) {
    throw new Error(
      "A cached prompt needs a shared prefix and a per-call rest",
    );
  }
  return { shared, rest };
}

/**
 * A prompt split at `shared`, marked only when a later call in the same run
 * repeats that prefix; a single call gets the plain joined text.
 */
export function splitPrompt(
  shared: string,
  rest: string,
  reused: boolean,
): ModelPrompt {
  return reused ? cachedPrompt(shared, rest) : shared + rest;
}

/** The text the model reads: the shared prefix followed by the rest. */
export function promptText(prompt: ModelPrompt): string {
  return typeof prompt === "string" ? prompt : prompt.shared + prompt.rest;
}

/**
 * Model input for a LangChain chat model. A string passes through unchanged;
 * a cached prompt becomes one human message of two text blocks, with
 * `cache_control` on the shared block only.
 */
export function toModelInput(prompt: ModelPrompt): string | HumanMessage[] {
  if (typeof prompt === "string") return prompt;
  return [
    new HumanMessage({
      content: [
        {
          type: "text",
          text: prompt.shared,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: prompt.rest },
      ],
    }),
  ];
}
