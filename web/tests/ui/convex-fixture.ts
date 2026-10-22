import { createMemo, createSignal } from "solid-js";
import { getFunctionName } from "convex/server";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type { QueryStatus } from "../../src/integrations/convex/query";
export { describeError } from "../../src/integrations/convex/errors";

// Latest arguments observed by the real Agent Runs route's query consumers.
export const runQueries: Record<string, unknown> = {};

export const [queuePopulated, setQueuePopulated] = createSignal(false);
export const [intentRejected, setIntentRejected] = createSignal(false);
export const [retired, setRetired] = createSignal(false);
function draft(id: string) {
  return {
    _id: id,
    kind: "hypothesis_draft",
    title: `Synthetic ${id}`,
    summary: `Summary ${id}`,
    status: id === "terminal" || retired() ? "rejected" : "pending_review",
    createdAt: 1,
    agentRunId: "run",
    decisionNote: "Synthetic recorded decision",
    decisionSource: "telegram",
    decisionTranscript: "Synthetic transcript from signer",
    decisionIntentId: "listening",
  };
}

/** Test-only query projection. No ConvexClient is constructed. */
export function createQueryWithStatus<Q extends FunctionReference<"query">>(
  query: Q,
  args?: FunctionArgs<Q> | (() => FunctionArgs<Q> | "skip"),
): QueryStatus<FunctionReturnType<Q>> {
  const name = getFunctionName(query);
  const resolved = createMemo(() =>
    typeof args === "function"
      ? (args as () => FunctionArgs<Q> | "skip")()
      : args,
  );
  const data = createMemo(() => {
    const input = resolved();
    if (input === "skip") return undefined;
    let value: unknown;
    if (
      name === "agentRuns:listRecentPublic" ||
      name === "agentRuns:statusCountsPublic"
    ) {
      runQueries[name] = input;
      value = name === "agentRuns:listRecentPublic" ? [] : {};
    } else if (name === "agentDrafts:listPending")
      value =
        queuePopulated() && !retired() ? [draft("one"), draft("two")] : [];
    else if (name.includes("countPending"))
      value = queuePopulated() && !retired() ? 2 : 0;
    else if (name === "agentDrafts:getReviewContext") {
      const id = input?.draftId;
      if (id === "missing") return undefined;
      value = {
        draft: draft(id),
        correspondence: null,
        related: { priorHypotheses: [], failures: [] },
        runTrace: { runId: "run", traceUrl: null, summary: "Synthetic run" },
      };
    } else if (name === "decisionIntents:get") {
      const id = input?.intentId;
      value =
        id === "missing" || id === "unauthorized"
          ? null
          : {
              _id: id,
              _creationTime: 1,
              code: `D-${id}`,
              target: { kind: "composition", id: "composition-one" },
              targetRevision: 3,
              action: "createListeningSession",
              payload: {
                conditions: {
                  listeningMethod: "headphones",
                  timeOfDay: "evening",
                },
                ratings: { bodilyPleasantness: 0 },
              },
              payloadDigest: "abcdef0123456789".repeat(4),
              proposal: {
                channel: "telegram",
                conversationId: "chat",
                messageRef: "message",
                transcript: "Synthetic proposed transcript",
              },
              status: intentRejected()
                ? "rejected"
                : id === "applied"
                  ? "applied"
                  : "proposed",
              result:
                id === "applied"
                  ? { status: "applied", appliedRecordId: "session-one" }
                  : undefined,
              createdAt: 1,
              expiresAt: id === "expired" ? 1 : Date.now() + 1800000,
            };
    } else throw new Error(`Unexpected fixture query: ${name}`);
    return value as FunctionReturnType<Q>;
  });
  const error = () => {
    const input = resolved();
    if (input !== "skip" && input?.intentId === "unauthorized")
      return new Error("Human user mapping required");
    return input !== "skip" && input?.draftId === "missing"
      ? new Error("Draft not found")
      : null;
  };
  return {
    data,
    error,
    isError: () => error() !== null,
    isLoading: () => {
      const input = resolved();
      return input !== "skip" && input?.intentId === "loading";
    },
  };
}
export const [mutationCalls, setMutationCalls] = createSignal<
  Array<{ name: string; args: Record<string, unknown> }>
>([]);
let finish: ((result: unknown) => void) | undefined;
let fail: ((error: Error) => void) | undefined;
export function finishMutation(rejectDomain = false) {
  finish?.(
    rejectDomain
      ? {
          status: "rejected",
          error: "Target revision changed. Request a new proposal.",
        }
      : {
          status: mutationCalls().at(-1)?.name.endsWith("cancelWeb")
            ? "cancelled"
            : "applied",
          appliedRecordId: "session-one",
        },
  );
}
export function failMutation() {
  fail?.(new Error("Synthetic network failure"));
}
export function createMutation<M extends FunctionReference<"mutation">>(
  mutation: M,
) {
  return (args: FunctionArgs<M>): Promise<FunctionReturnType<M>> => {
    const name = getFunctionName(mutation);
    if (!name.startsWith("decisionIntents:"))
      throw new Error("Unexpected mutation");
    setMutationCalls((calls) => [...calls, { name, args }]);
    return new Promise((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
  };
}
