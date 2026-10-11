import { type Accessor, createSignal, onCleanup } from "solid-js";
import { css, cx } from "../../../styled-system/css";

// While empty, a region is visually hidden (sr-only) rather than display:none,
// so it stays in the accessibility tree and the arrival of text is an update
// to an existing live region, not the insertion of a new one.
const emptyCollapse = {
  _empty: {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: "0",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  },
} as const;

const statusClass = css({
  color: "zodiac.cream/75",
  fontFamily: "display",
  fontSize: "md",
  lineHeight: "1.6",
  overflowWrap: "anywhere",
  ...emptyCollapse,
});

const alertClass = css({
  color: "zodiac.error",
  fontFamily: "display",
  fontSize: "md",
  lineHeight: "1.6",
  overflowWrap: "anywhere",
  ...emptyCollapse,
});

/**
 * Collapses a card that holds only a notice while the notice is empty, so the
 * load-state card on a detail page reserves no row. `UINotice` already
 * collapses itself; this is for the wrapper around it.
 */
export const collapsedNoticeClass = css({ display: "contents" });

/**
 * While neither region has text, take the wrapper out of layout too. Without
 * this an empty notice is still a zero-height grid item, so a `gap`-spaced
 * page reserves a full gutter for a message that is not there.
 */
const wrapperClass = css({
  "&:not(:has(> p:not(:empty)))": {
    display: "contents",
  },
});

type UINoticeProps = {
  /** Non-error status text: results, confirmations, loading. Announced politely. */
  status?: string | null;
  /** Failure text. Announced assertively via role="alert". */
  error?: string | null;
  class?: string;
};

/**
 * Two always-mounted live regions. Keep this rendered unconditionally (never
 * inside a <Show>) so assistive tech observes the region before text lands in
 * it. Empty regions are visually hidden via `:empty` but remain in the
 * accessibility tree, so they cost nothing at rest and still announce.
 */
export function UINotice(props: UINoticeProps) {
  return (
    <div class={cx(wrapperClass, props.class)}>
      <p role="status" aria-live="polite" class={statusClass}>
        {props.status ?? ""}
      </p>
      <p role="alert" class={alertClass}>
        {props.error ?? ""}
      </p>
    </div>
  );
}

/**
 * A self-retiring status message for `UINotice status`. `announce` clears the
 * region first so identical text is read again, and the message retires after
 * `retireMs` so a stale confirmation does not linger beside the next action.
 */
export function createAnnouncer(
  retireMs = 5000,
): [Accessor<string | null>, (text: string) => void] {
  const [message, setMessage] = createSignal<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const announce = (text: string) => {
    clearTimeout(timer);
    setMessage(null);
    queueMicrotask(() => {
      setMessage(text);
      timer = setTimeout(() => setMessage(null), retireMs);
    });
  };
  return [message, announce];
}
