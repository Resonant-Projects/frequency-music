import { createMemo, For, Index, Show } from "solid-js";
import type { Doc } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import {
  type AgentRunTimes,
  eventTone,
  formatDuration,
  formatPayload,
  sameIds,
} from "../lib/agent-run-format";
import {
  DateTime,
  helperClass,
  jsonBlockClass,
  metaLabelClass,
  metaLine,
  UIBadge,
  UIList,
} from "./ui";

type AgentRunEvent = Doc<"agentRunEvents">;

const eventListClass = css({ display: "grid", gap: "4" });

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
  lineHeight: "prose",
  maxW: "measure",
});

const timesListClass = css({
  alignItems: "baseline",
  display: "grid",
  gap: "2",
  gridTemplateColumns: "auto minmax(0, 1fr)",
});

/** One timeline entry: kind badge, timestamp, message, optional payload. */
function AgentRunEventItem(props: { event: AgentRunEvent; testId?: string }) {
  const payload = createMemo(() => formatPayload(props.event.payload));
  return (
    <li class={eventClass} data-testid={props.testId}>
      <div class={eventHeaderClass}>
        <UIBadge tone={eventTone(props.event.kind)}>{props.event.kind}</UIBadge>
        <DateTime
          format="datetime"
          class={metaLine}
          value={props.event.createdAt}
        />
      </div>
      <p class={eventMessageClass}>{props.event.message}</p>
      <Show when={payload()}>
        {(text) => (
          <pre
            role="group"
            tabIndex={0}
            aria-label={`Payload for ${props.event.kind} event`}
            class={cx(jsonBlockClass, "zodiac-scroll")}
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
  events: AgentRunEvent[];
  /** `data-testid` for each entry. */
  itemTestId?: string;
}) {
  // Events are append-only and never edited, so rows are keyed by id and each
  // id keeps the first copy it was given: a live update mounts only the new
  // entries and never re-formats a payload already on screen.
  const ids = createMemo(() => props.events.map((event) => event._id), [], {
    equals: sameIds,
  });
  const byId = createMemo(
    (previous: ReadonlyMap<string, AgentRunEvent>) =>
      new Map(
        props.events.map((event) => [
          event._id,
          previous.get(event._id) ?? event,
        ]),
      ),
    new Map(),
  );
  return (
    <UIList class={eventListClass}>
      <For each={ids()}>
        {(id) => (
          <Show when={byId().get(id)} keyed>
            {(event) => (
              <AgentRunEventItem event={event} testId={props.itemTestId} />
            )}
          </Show>
        )}
      </For>
    </UIList>
  );
}

/** Created / Started / Finished / Duration for one run. */
export function AgentRunTimesList(props: {
  run: AgentRunTimes;
  class?: string;
}) {
  const times = (): Array<[label: string, value: number | undefined]> => [
    ["Created", props.run.createdAt],
    ["Started", props.run.startedAt],
    ["Finished", props.run.finishedAt],
  ];
  return (
    <dl class={cx(timesListClass, props.class)}>
      <Index each={times()}>
        {(entry) => (
          <>
            <dt class={metaLabelClass}>{entry()[0]}</dt>
            <dd class={helperClass}>
              <DateTime format="datetime" value={entry()[1]} />
            </dd>
          </>
        )}
      </Index>
      <dt class={metaLabelClass}>Duration</dt>
      <dd class={helperClass}>{formatDuration(props.run)}</dd>
    </dl>
  );
}
