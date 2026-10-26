import { Effect } from "effect";
import { attempt } from "./effects";

// Thin HTTP client for /agent-tools/*. The secret travels in the body, as the
// worker does; error text never includes it.
export function callTool<T>(
  name: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const base = process.env.CONVEX_SITE_URL;
      const secret = process.env.AGENT_TOOL_SECRET;
      if (!base) throw new Error("CONVEX_SITE_URL is required");
      if (!secret) throw new Error("AGENT_TOOL_SECRET is required");
      const response = yield* attempt((fiberSignal) =>
        fetch(`${base.replace(/\/$/, "")}/agent-tools/${name}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ secret, ...body }),
          // The secret is in the body; never let a redirect carry it to another
          // host or scheme.
          redirect: "error",
          // A caller's signal (the job deadline) still rides alongside the
          // per-call timeout so neither can outlive the other.
          signal: AbortSignal.any([
            fiberSignal,
            AbortSignal.timeout(60_000),
            ...(signal ? [signal] : []),
          ]),
        }),
      );
      if (!response.ok) {
        const text = (yield* attempt(() => response.text()))
          .replaceAll(secret, "[REDACTED]")
          .slice(0, 500);
        throw new Error(
          `Convex tool ${name} failed: ${response.status} ${text}`,
        );
      }
      return (yield* attempt(() => response.json())) as T;
    }),
  );
}
