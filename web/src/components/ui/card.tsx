import type { JSX } from "solid-js";
import { splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { css, cx } from "../../../styled-system/css";

const cardClass = css({
  bg: "zodiac.void/72",
  borderColor: "zodiac.gold/22",
  borderRadius: "l3",
  borderWidth: "1px",
  color: "zodiac.cream",
  p: "5",
});

const glassClass = css({
  backdropFilter: "blur(8px)",
});

type UICardProps = JSX.HTMLAttributes<HTMLElement> & {
  as?: keyof JSX.IntrinsicElements;
  glass?: boolean;
};

export function UICard(props: UICardProps) {
  const [local, rest] = splitProps(props, ["as", "class", "glass"]);
  return (
    <Dynamic
      component={local.as ?? "section"}
      {...rest}
      class={cx(cardClass, local.glass && glassClass, local.class)}
    />
  );
}
