import type { JSX } from "solid-js";
import { css, cx } from "../../../styled-system/css";

const inputClass = css({
  bg: "zodiac.glow-inner/45",
  borderColor: "zodiac.gold/28",
  borderRadius: "l2",
  borderWidth: "1px",
  color: "zodiac.cream",
  fontFamily: "mono",
  fontSize: "sm",
  minH: "10",
  px: "3",
  py: "2",
  width: "full",
  _coarsePointer: {
    fontSize: "md",
    minH: "11",
  },
  _focusVisible: {
    borderColor: "zodiac.gold",
    outline: "2px solid",
    outlineColor: "zodiac.gold",
    outlineOffset: "1px",
  },
  _placeholder: {
    color: "zodiac.cream/50",
  },
});

export type UIInputProps = JSX.InputHTMLAttributes<HTMLInputElement>;

export function UIInput(props: UIInputProps) {
  return <input {...props} class={cx(inputClass, props.class)} />;
}
