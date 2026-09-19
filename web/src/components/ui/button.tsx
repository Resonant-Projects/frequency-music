import type { JSX } from "solid-js";
import { splitProps } from "solid-js";
import { css, cx } from "../../../styled-system/css";

type ButtonVariant = "solid" | "outline" | "ghost";

const base = css({
  alignItems: "center",
  borderRadius: "l2",
  borderWidth: "1px",
  cursor: "pointer",
  display: "inline-flex",
  fontFamily: "mono",
  fontSize: "xs",
  gap: "2",
  justifyContent: "center",
  letterSpacing: "0.18em",
  minHeight: "9",
  px: "3",
  py: "2",
  textTransform: "uppercase",
  transitionDuration: "normal",
  transitionProperty: "background-color, color, border-color",
  transitionTimingFunction: "default",
  _coarsePointer: {
    minHeight: "11",
    px: "4",
  },
  _disabled: {
    cursor: "not-allowed",
    opacity: "0.5",
  },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "zodiac.gold",
    outlineOffset: "2px",
  },
});

const variantStyles: Record<ButtonVariant, string> = {
  solid: css({
    bg: "zodiac.gold",
    borderColor: "zodiac.gold",
    color: "zodiac.void",
    _hover: {
      bg: "zodiac.goldBright",
      borderColor: "zodiac.goldBright",
    },
  }),
  outline: css({
    bg: "transparent",
    borderColor: "zodiac.gold/45",
    color: "zodiac.cream",
    _hover: {
      borderColor: "zodiac.gold/75",
      color: "zodiac.cream",
    },
  }),
  ghost: css({
    bg: "transparent",
    borderColor: "transparent",
    color: "zodiac.cream/72",
    _hover: {
      bg: "zodiac.gold/8",
      color: "zodiac.cream",
    },
  }),
};

type UIButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function UIButton(props: UIButtonProps) {
  const [local, rest] = splitProps(props, ["variant", "class"]);
  const variant = () => local.variant ?? "outline";

  return (
    <button {...rest} class={cx(base, variantStyles[variant()], local.class)} />
  );
}
