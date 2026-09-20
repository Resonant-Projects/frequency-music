import type { JSX } from "solid-js";
import { css, cx } from "../../../styled-system/css";

const textareaClass = css({
  bg: "zodiac.glow-inner/45",
  borderColor: "zodiac.gold/28",
  borderRadius: "l2",
  borderWidth: "1px",
  color: "zodiac.cream",
  fontFamily: "mono",
  fontSize: "sm",
  minH: "28",
  px: "3",
  py: "2",
  resize: "vertical",
  width: "full",
  _coarsePointer: {
    fontSize: "md",
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

export type UITextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function UITextarea(props: UITextareaProps) {
  return <textarea {...props} class={cx(textareaClass, props.class)} />;
}
