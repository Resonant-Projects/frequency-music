import type { JSX } from "solid-js";
import { css, cx } from "../../../styled-system/css";

const selectClass = css({
  bg: "zodiac.glow-inner/45",
  borderColor: "zodiac.gold/28",
  borderRadius: "l2",
  borderWidth: "1px",
  color: "zodiac.cream",
  minH: "10",
  px: "3",
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
});

export type UISelectProps = JSX.SelectHTMLAttributes<HTMLSelectElement>;

export function UISelect(props: UISelectProps) {
  return <select {...props} class={cx(selectClass, props.class)} />;
}
