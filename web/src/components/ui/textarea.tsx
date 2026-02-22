import type { JSX } from "solid-js";
import { css, cx } from "../../../styled-system/css";

const textareaClass = css({
  bg: "rgba(26, 15, 53, 0.45)",
  borderColor: "rgba(200, 168, 75, 0.28)",
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
  _focusVisible: {
    borderColor: "zodiac.gold",
    boxShadow: "0 0 0 1px rgba(200, 168, 75, 0.4)",
    outline: "none",
  },
  _placeholder: {
    color: "rgba(245, 240, 232, 0.4)",
  },
});

export type UITextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function UITextarea(props: UITextareaProps) {
  return <textarea {...props} class={cx(textareaClass, props.class)} />;
}
