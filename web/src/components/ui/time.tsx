import { Show } from "solid-js";

export type DateTimeFormat = "date" | "datetime";

const formatters: Record<DateTimeFormat, Intl.DateTimeFormat> = {
  date: new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
  datetime: new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }),
};

/** A timestamp in the reader's locale; "date" is `Oct 10, 2026`. */
export function formatDateTime(value: number, format: DateTimeFormat = "date") {
  return formatters[format].format(new Date(value));
}

/**
 * A timestamp as `<time datetime>`, or a plain em dash (not a `<time>`) when
 * the moment is unset. Always the reader's locale.
 */
export function DateTime(props: {
  value?: number | null;
  format?: DateTimeFormat;
  class?: string;
  fallback?: string;
}) {
  return (
    <Show
      when={props.value}
      fallback={<span class={props.class}>{props.fallback ?? "—"}</span>}
    >
      {(value) => (
        <time class={props.class} datetime={new Date(value()).toISOString()}>
          {formatDateTime(value(), props.format)}
        </time>
      )}
    </Show>
  );
}
