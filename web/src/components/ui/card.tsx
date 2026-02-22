import { JSX } from "solid-js";
import { css, cx } from "../../../styled-system/css";

const cardClass = css({
  backdropFilter: "blur(8px)",
  bg: "rgba(13, 6, 32, 0.72)",
  borderColor: "rgba(200, 168, 75, 0.22)",
  borderRadius: "l3",
  borderWidth: "1px",
  color: "zodiac.cream",
  p: "5",
});

type UICardProps = JSX.HTMLAttributes<HTMLElement> & {
  as?: never;
};

export function UICard(props: UICardProps) {
  return <section {...props} class={cx(cardClass, props.class)} />;
}
