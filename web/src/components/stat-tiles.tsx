import type { JSX } from "solid-js";
import { For } from "solid-js";
import { css, cx } from "../../styled-system/css";

const gridClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: {
    base: "repeat(2, minmax(0, 1fr))",
    md: "repeat(4, minmax(0, 1fr))",
  },
});

const tileClass = css({
  bg: "zodiac.cream/3",
  borderColor: "zodiac.gold/22",
  borderRadius: "l2",
  borderStyle: "solid",
  borderWidth: "1px",
  // Value reads above its label while the <dt> still precedes the <dd>.
  display: "flex",
  flexDirection: "column-reverse",
  gap: "1",
  p: "3",
});

const valueClass = css({
  color: "zodiac.gold",
  fontSize: "2xl",
  margin: 0,
});

const labelClass = css({
  color: "zodiac.cream/66",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
});

export type StatTile = {
  label: string;
  value: JSX.Element;
};

/** A row of bordered stat tiles: a gold numeral over a mono uppercase label. */
export function StatTiles(props: { items: StatTile[]; class?: string }) {
  return (
    <dl class={cx(gridClass, props.class)}>
      <For each={props.items}>
        {(item) => (
          <div class={tileClass}>
            <dt class={labelClass}>{item.label}</dt>
            <dd class={valueClass}>{item.value}</dd>
          </div>
        )}
      </For>
    </dl>
  );
}
