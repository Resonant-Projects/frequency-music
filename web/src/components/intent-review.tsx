import {
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { css } from "../../styled-system/css";
import { describeError } from "../integrations/convex/errors";
import {
  DateTime,
  helperClass,
  metaLabelClass,
  sectionTitleClass,
  UIButton,
  UICard,
  UINotice,
} from "./ui";

/**
 * Presentation props, not a wire contract. The authenticated route adapter must
 * project the shared backend contract here and bind callbacks to that intent.
 * It must throw on a rejected mutation result, not only on transport failures.
 */
export interface IntentReviewProps {
  readonly identity: string;
  readonly code: string;
  readonly targetTitle: string;
  readonly actionLabel: string;
  readonly payloadText: string;
  readonly payloadDigest: string;
  readonly note?: string;
  readonly expiresAt: number;
  readonly statusLabel: string;
  readonly statusMessage?: string;
  readonly canDecide: boolean;
  readonly onConfirm: () => Promise<void>;
  readonly onCancel: () => Promise<void>;
}

const stackClass = css({ display: "grid", gap: "3", minInlineSize: "0" });
const wrapClass = css({ overflowWrap: "anywhere" });
const payloadClass = css({
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  fontFamily: "mono",
  fontSize: "sm",
  lineHeight: "dense",
  color: "zodiac.cream/82",
  maxInlineSize: "full",
});
const actionsClass = css({ display: "flex", flexWrap: "wrap", gap: "2" });

export function IntentReview(props: IntentReviewProps) {
  // Navigation must not inherit another intent's pending or error state.
  const identity = createMemo(() =>
    JSON.stringify([props.identity, props.payloadDigest]),
  );
  return (
    <Show when={identity()} keyed>
      {(_identity) => <IntentReviewCard {...props} />}
    </Show>
  );
}

function IntentReviewCard(props: IntentReviewProps) {
  const [now, setNow] = createSignal(Date.now());
  const [pending, setPending] = createSignal<"confirm" | "cancel" | null>(null);
  const [submitted, setSubmitted] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const headingId = createUniqueId();
  let disposed = false;
  const expired = () =>
    !Number.isFinite(props.expiresAt) || now() >= props.expiresAt;
  const blocked = () =>
    !props.canDecide || expired() || pending() !== null || submitted();
  onMount(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => clearInterval(timer));
  });
  onCleanup(() => {
    disposed = true;
  });

  async function decide(verb: "confirm" | "cancel") {
    // Recheck at the event boundary, including after a suspended tab.
    setNow(Date.now());
    if (blocked()) return;
    const action = verb === "confirm" ? props.onConfirm : props.onCancel;
    setPending(verb);
    setError(null);
    try {
      await action();
      if (!disposed) setSubmitted(true);
    } catch (caught) {
      if (!disposed) setError(describeError(caught));
    } finally {
      if (!disposed) setPending(null);
    }
  }

  const notice = () => {
    if (pending())
      return pending() === "confirm"
        ? "Submitting confirmation..."
        : "Submitting cancellation...";
    if (!props.canDecide) return props.statusMessage ?? props.statusLabel;
    if (submitted())
      return "Request submitted. Waiting for the current decision status.";
    if (expired())
      return "This proposal has expired. Request a new proposal to continue.";
    return props.statusMessage;
  };

  return (
    <UICard class={stackClass} aria-labelledby={headingId}>
      <h2 id={headingId} class={sectionTitleClass}>
        Review decision {props.code}
      </h2>
      <p class={wrapClass}>
        {props.actionLabel}: {props.targetTitle}
      </p>
      <p class={metaLabelClass}>Status: {props.statusLabel}</p>
      <p class={helperClass}>
        Expires:{" "}
        <Show when={Number.isFinite(props.expiresAt)} fallback="Unavailable">
          <DateTime value={props.expiresAt} format="datetime" />
        </Show>
      </p>
      <Show when={props.note}>
        {(note) => <p class={wrapClass}>{note()}</p>}
      </Show>
      <p class={helperClass}>
        Confirm the proposal exactly as shown. To change it, cancel and request
        a new proposal.
      </p>
      <h3 class={metaLabelClass}>Proposed payload</h3>
      <pre class={payloadClass}>{props.payloadText}</pre>
      <p class={wrapClass}>
        <span class={metaLabelClass}>Payload digest: </span>
        <code>{props.payloadDigest}</code>
      </p>
      <p class={wrapClass}>
        Confirmation digest: <code>{props.payloadDigest.slice(0, 8)}</code>
      </p>
      <div class={actionsClass}>
        <UIButton
          type="button"
          variant="solid"
          aria-disabled={blocked()}
          aria-busy={pending() === "confirm"}
          onClick={() => void decide("confirm")}
        >
          Confirm {props.actionLabel}
        </UIButton>
        <UIButton
          type="button"
          variant="outline"
          aria-disabled={blocked()}
          aria-busy={pending() === "cancel"}
          onClick={() => void decide("cancel")}
        >
          Cancel
        </UIButton>
      </div>
      <UINotice status={notice()} error={error()} />
    </UICard>
  );
}
