import type { JSX } from "solid-js";
import { css, cx } from "../../../styled-system/css";

const selectClass = css({
  bg: "rgba(26, 15, 53, 0.45)",
  borderColor: "rgba(200, 168, 75, 0.28)",
  borderRadius: "l2",
  borderWidth: "1px",
  color: "zodiac.cream",
  minH: "10",
  px: "3",
  width: "full",
  _focusVisible: {
    borderColor: "zodiac.gold",
    boxShadow: "0 0 0 1px rgba(200, 168, 75, 0.4)",
    outline: "none",
  },
});

export type UISelectProps = JSX.SelectHTMLAttributes<HTMLSelectElement>;

export function UISelect(props: UISelectProps) {
  return <select {...props} class={cx(selectClass, props.class)} />;
}
