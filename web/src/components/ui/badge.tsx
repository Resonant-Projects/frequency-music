import type { JSX } from "solid-js";
import { splitProps } from "solid-js";
import { css, cx } from "../../../styled-system/css";

const base = css({
  borderRadius: "full",
  borderWidth: "1px",
  display: "inline-flex",
  fontFamily: "mono",
  fontSize: "10px",
  letterSpacing: "0.2em",
  overflowWrap: "anywhere",
  px: "2.5",
  py: "1",
  textTransform: "uppercase",
});

const toneStyles = {
  gold: css({
    borderColor: "zodiac.gold/45",
    color: "zodiac.gold",
  }),
  violet: css({
    borderColor: "zodiac.violet/45",
    color: "zodiac.violet",
  }),
  cream: css({
    borderColor: "zodiac.cream/38",
    color: "zodiac.cream",
  }),
} as const;

type UIBadgeProps = JSX.HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof toneStyles;
};

export function UIBadge(props: UIBadgeProps) {
  const [local, rest] = splitProps(props, ["tone", "class"]);
  const tone = () => local.tone ?? "gold";
  return <span {...rest} class={cx(base, toneStyles[tone()], local.class)} />;
}
