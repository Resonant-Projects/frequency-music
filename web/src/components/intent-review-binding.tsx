import type { FunctionReturnType } from "convex/server";
import { createSignal, onCleanup, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  AUDIO_SCORE_KEYS,
  type AudioScoreKey,
} from "../../../convex/shared/audioRatingKeys";
import type { DecisionResult } from "../../../convex/shared/decisionIntents";
import { createMutation, createQueryWithStatus } from "../integrations/convex";
import { IntentReview } from "./intent-review";
import { UINotice } from "./ui";

type Intent = NonNullable<FunctionReturnType<typeof api.decisionIntents.get>>;
const ratingNames = [
  "bodilyPleasantness",
  "goosebumps",
  "perceivedConsonance",
  "musicality",
  "easeOfComposability",
  "expandability",
] as const;

function payloadText(intent: Intent) {
  const exact = JSON.stringify(intent.payload, null, 2);
  if (intent.action === "rateAudio" && "scores" in intent.payload) {
    const scores: Partial<Record<AudioScoreKey, number>> =
      intent.payload.scores;
    return `${exact}\n\nAudio scores:\n${AUDIO_SCORE_KEYS.map((name) => `${name}: ${scores[name] ?? "not given"}`).join("\n")}`;
  }
  if (intent.action !== "createListeningSession") return exact;
  const ratings =
    "ratings" in intent.payload ? intent.payload.ratings : undefined;
  return `${exact}\n\nSubjective ratings:\n${ratingNames.map((name) => `${name}: ${ratings?.[name] ?? "not given"}`).join("\n")}`;
}

/** Mounted per route identity; requests never update a subsequent review. */
export function IntentReviewBinding(props: {
  intentId: Id<"decisionIntents">;
}) {
  const query = createQueryWithStatus(api.decisionIntents.get, () => ({
    intentId: props.intentId,
  }));
  const apply = createMutation(api.decisionIntents.applyWeb);
  const cancel = createMutation(api.decisionIntents.cancelWeb);
  return (
    <>
      <UINotice
        error={
          query.error()
            ? `Unable to load decision. Sign in with your registered human account. ${query.error()!.message}`
            : null
        }
        status={
          query.isLoading()
            ? "Loading decision..."
            : !query.error() && !query.data()
              ? "Decision not found."
              : null
        }
      />
      <Show
        when={
          !query.isLoading() &&
          !query.error() &&
          query.data()?._id === props.intentId &&
          query.data()
        }
      >
        {(intent) => (
          <BoundIntent intent={intent()} apply={apply} cancel={cancel} />
        )}
      </Show>
    </>
  );
}

function BoundIntent(props: {
  intent: Intent;
  apply: ReturnType<typeof createMutation<typeof api.decisionIntents.applyWeb>>;
  cancel: ReturnType<
    typeof createMutation<typeof api.decisionIntents.cancelWeb>
  >;
}) {
  const [result, setResult] = createSignal<DecisionResult>();
  // Reuse an event after an uncertain transport failure. Confirm and cancel
  // are distinct human actions and must never share the replay receipt.
  const eventIds = new Map<string, string>();
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  const currentResult = () => props.intent.result ?? result();
  const status = () =>
    props.intent.status === "proposed"
      ? (currentResult()?.status ?? "proposed")
      : props.intent.status;
  async function submit(verb: "confirm" | "cancel") {
    const intent = props.intent;
    const digest8 = intent.payloadDigest.slice(0, 8);
    const key = `${intent._id}:${intent.payloadDigest}:${verb}`;
    const eventId = eventIds.get(key) ?? crypto.randomUUID();
    eventIds.set(key, eventId);
    const response = await (verb === "confirm"
      ? props.apply({ intentId: intent._id, digest8, eventId })
      : props.cancel({ intentId: intent._id, eventId }));
    if (!disposed) setResult(response);
    if (response.status !== (verb === "confirm" ? "applied" : "cancelled"))
      throw new Error(
        response.error ??
          `Decision ${response.status}. Request a new proposal to continue.`,
      );
  }
  return (
    <IntentReview
      identity={props.intent._id}
      code={props.intent.code}
      targetTitle={`${props.intent.target.kind} ${props.intent.target.id} (revision ${props.intent.targetRevision ?? 0})`}
      actionLabel={props.intent.action}
      payloadText={payloadText(props.intent)}
      payloadDigest={props.intent.payloadDigest}
      note={props.intent.proposal.transcript}
      expiresAt={props.intent.expiresAt}
      statusLabel={status()}
      statusMessage={
        currentResult() ? JSON.stringify(currentResult(), null, 2) : undefined
      }
      canDecide={status() === "proposed"}
      onConfirm={() => submit("confirm")}
      onCancel={() => submit("cancel")}
    />
  );
}
