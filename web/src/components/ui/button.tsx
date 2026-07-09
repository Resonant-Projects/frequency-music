import type { JSX } from "solid-js";
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
  px: "3",
  py: "2",
  textTransform: "uppercase",
  transitionDuration: "normal",
  transitionProperty: "background-color, color, border-color",
  transitionTimingFunction: "default",
  _disabled: {
    cursor: "not-allowed",
    opacity: "0.5",
  },
});

const variantStyles: Record<ButtonVariant, string> = {
  solid: css({
    bg: "zodiac.gold",
    borderColor: "zodiac.gold",
    color: "zodiac.void",
    _hover: {
      bg: "accent.10",
      borderColor: "accent.10",
    },
  }),
  outline: css({
    bg: "transparent",
    borderColor: "colorPalette.7",
    color: "zodiac.cream",
    _hover: {
      borderColor: "colorPalette.9",
      color: "white",
    },
  }),
  ghost: css({
    bg: "transparent",
    borderColor: "transparent",
    color: "fg.muted",
    _hover: {
      bg: "bg.subtle",
      color: "fg.default",
    },
  }),
};

type UIButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function UIButton(props: UIButtonProps) {
  const variant = () => props.variant ?? "outline";

  return (
    <button
      {...props}
      class={cx(base, variantStyles[variant()], props.class)}
    />
  );
}
