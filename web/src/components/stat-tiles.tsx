import type { JSX } from "solid-js";
import { Index } from "solid-js";
import { css, cx } from "../../styled-system/css";
import { metaLabelClass } from "./ui/detail-styles";

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
  borderWidth: "1px",
  // Value reads above its label while the <dt> still precedes the <dd>.
  display: "flex",
  flexDirection: "column-reverse",
  gap: "1",
  p: "3",
});

const valueClass = css({ fontSize: "2xl", margin: "0" });

const toneClass = {
  gold: css({ color: "zodiac.gold" }),
  violet: css({ color: "zodiac.violet" }),
  cream: css({ color: "zodiac.cream" }),
  error: css({ color: "zodiac.error" }),
} as const;

export type StatTile = {
  label: string;
  value: JSX.Element;
  /** Colour of the numeral; gold (confirmed) unless the count is speculative or failing. */
  tone?: keyof typeof toneClass;
};

/** A row of bordered stat tiles: a numeral over a mono uppercase label. */
export function StatTiles(props: { items: StatTile[]; class?: string }) {
  return (
    <dl class={cx(gridClass, props.class)}>
      <Index each={props.items}>
        {(item) => (
          <div class={tileClass}>
            <dt class={metaLabelClass}>{item().label}</dt>
            <dd class={cx(valueClass, toneClass[item().tone ?? "gold"])}>
              {item().value}
            </dd>
          </div>
        )}
      </Index>
    </dl>
  );
}
