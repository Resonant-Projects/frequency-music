import type { JSX } from "solid-js";
import { css, cx } from "../../../styled-system/css";

const base = css({
  borderRadius: "full",
  borderWidth: "1px",
  display: "inline-flex",
  fontFamily: "mono",
  fontSize: "2xs",
  letterSpacing: "0.2em",
  px: "2.5",
  py: "1",
  textTransform: "uppercase",
});

const toneStyles = {
  gold: css({
    borderColor: "rgba(200, 168, 75, 0.45)",
    color: "zodiac.gold",
  }),
  violet: css({
    borderColor: "rgba(139, 92, 246, 0.45)",
    color: "zodiac.violet",
  }),
  cream: css({
    borderColor: "rgba(245, 240, 232, 0.38)",
    color: "zodiac.cream",
  }),
} as const;

type UIBadgeProps = JSX.HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof toneStyles;
};

export function UIBadge(props: UIBadgeProps) {
  const tone = () => props.tone ?? "gold";
  return <span {...props} class={cx(base, toneStyles[tone()], props.class)} />;
}
