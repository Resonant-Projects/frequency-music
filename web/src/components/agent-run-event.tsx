import { For, Show } from "solid-js";
import type { Doc } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import {
  type AgentRunTimes,
  eventTone,
  formatDuration,
  formatPayload,
  formatTime,
  isoTime,
} from "../lib/agent-run-format";
import { focusRingClass, helperClass, metaLine, UIBadge } from "./ui";

const eventListClass = css({
  display: "grid",
  gap: "4",
  listStyleType: "none",
  m: "0",
  p: "0",
});

const eventClass = css({
  borderColor: "zodiac.cream/12",
  borderLeftWidth: "1px",
  display: "grid",
  gap: "2",
  minW: "0",
  pl: "4",
  position: "relative",
  _before: {
    bg: "zodiac.gold",
    borderRadius: "full",
    content: '""',
    height: "2",
    left: "-1",
    position: "absolute",
    top: "2",
    width: "2",
  },
});

const eventHeaderClass = css({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "2",
  justifyContent: "space-between",
});

const eventMessageClass = css({
  color: "zodiac.cream",
  lineHeight: "1.55",
  maxW: "72ch",
  overflowWrap: "anywhere",
});

const payloadClass = css({
  bg: "zodiac.void/60",
  borderColor: "zodiac.cream/12",
  borderRadius: "l2",
  borderWidth: "1px",
  color: "zodiac.cream/72",
  fontFamily: "mono",
  fontSize: "xs",
  maxH: "18rem",
  overflow: "auto",
  p: "3",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});

/** Uppercase mono term in a run's timing list. */
const timeTermClass = cx(
  metaLine,
  css({ letterSpacing: "0.14em", textTransform: "uppercase" }),
);

/**
 * A run timestamp as `<time datetime>`, or an em dash (not a `<time>`) when
 * the moment has not happened yet.
 */
export function AgentRunTime(props: { value?: number; class?: string }) {
  return (
    <Show when={props.value} fallback={<span class={props.class}>—</span>}>
      {(value) => (
        <time class={props.class} datetime={isoTime(value())}>
          {formatTime(value())}
        </time>
      )}
    </Show>
  );
}

/** One timeline entry: kind badge, timestamp, message, optional payload. */
function AgentRunEventItem(props: {
  event: Doc<"agentRunEvents">;
  testId?: string;
}) {
  const payload = () => formatPayload(props.event.payload);
  return (
    <li class={eventClass} data-testid={props.testId}>
      <div class={eventHeaderClass}>
        <UIBadge tone={eventTone(props.event.kind)}>{props.event.kind}</UIBadge>
        <AgentRunTime class={metaLine} value={props.event.createdAt} />
      </div>
      <p class={eventMessageClass}>{props.event.message}</p>
      <Show when={payload()}>
        {(text) => (
          <pre
            role="group"
            tabIndex={0}
            aria-label={`Payload for ${props.event.kind} event`}
            class={cx(payloadClass, focusRingClass, "zodiac-scroll")}
          >
            {text()}
          </pre>
        )}
      </Show>
    </li>
  );
}

/** An agent run's event timeline as a list, shared by the index and detail pages. */
export function AgentRunEventList(props: {
  events: Doc<"agentRunEvents">[];
  /** `data-testid` for each entry. */
  itemTestId?: string;
}) {
  return (
    <ul role="list" class={eventListClass}>
      <For each={props.events}>
        {(event) => (
          <AgentRunEventItem event={event} testId={props.itemTestId} />
        )}
      </For>
    </ul>
  );
}

/** Created / Started / Finished / Duration for one run. */
export function AgentRunTimesList(props: {
  run: AgentRunTimes;
  class?: string;
}) {
  return (
    <dl
      class={cx(
        css({
          alignItems: "baseline",
          display: "grid",
          gap: "2",
          gridTemplateColumns: "auto minmax(0, 1fr)",
        }),
        props.class,
      )}
    >
      <dt class={timeTermClass}>Created</dt>
      <dd class={helperClass}>
        <AgentRunTime value={props.run.createdAt} />
      </dd>
      <dt class={timeTermClass}>Started</dt>
      <dd class={helperClass}>
        <AgentRunTime value={props.run.startedAt} />
      </dd>
      <dt class={timeTermClass}>Finished</dt>
      <dd class={helperClass}>
        <AgentRunTime value={props.run.finishedAt} />
      </dd>
      <dt class={timeTermClass}>Duration</dt>
      <dd class={helperClass}>{formatDuration(props.run)}</dd>
    </dl>
  );
}
