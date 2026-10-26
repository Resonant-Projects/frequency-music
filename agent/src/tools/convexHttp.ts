import { Effect } from "effect";

// Keep the existing timeout policy; claims and arbitrary research writes have
// no new retry or deadline policy in this migration.
const BOUNDED_TOOLS = new Set([
  "appendAgentRunEvent",
  "reportCaptureFailure",
  "ingestScoutedSource",
  "getCaptureRecovery",
  "finishCaptureRecovery",
  "markAgentRunCompleted",
  "markAgentRunFailed",
  "getAgentRun",
]);

export class ConvexToolHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function convexRequest(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
) {
  return Effect.gen(function* () {
    const convexUrl = process.env.CONVEX_SITE_URL;
    const secret = process.env.AGENT_TOOL_SECRET;
    if (!convexUrl)
      return yield* Effect.fail(new Error("CONVEX_SITE_URL is required"));
    if (!secret)
      return yield* Effect.fail(new Error("AGENT_TOOL_SECRET is required"));
    const bounded =
      signal ??
      (BOUNDED_TOOLS.has(path) ? AbortSignal.timeout(30_000) : undefined);
    const lifetime = yield* Effect.acquireRelease(
      Effect.sync(() => new AbortController()),
      (controller) => Effect.sync(() => controller.abort()),
    );
    const response = yield* Effect.tryPromise({
      try: async (fiberSignal) =>
        fetch(`${convexUrl.replace(/\/$/, "")}/agent-tools/${path}`, {
          method: "POST",
          signal: AbortSignal.any([
            lifetime.signal,
            fiberSignal,
            ...(bounded ? [bounded] : []),
          ]),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret, ...body }),
        }),
      catch: (error) => error,
    });
    if (!response.ok) {
      const text = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: (error) => error,
      });
      return yield* Effect.fail(
        new ConvexToolHttpError(
          `Convex tool ${path} failed: ${response.status} ${text}`,
          response.status,
        ),
      );
    }
    return yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (error) => error,
    });
  }).pipe(Effect.scoped);
}
