import type { JSX } from "solid-js";
import { splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "../../../styled-system/css";
import { plainListClass } from "./form-styles";

type UIListProps = JSX.HTMLAttributes<HTMLUListElement | HTMLOListElement> & {
  as?: "ul" | "ol";
};

/**
 * A bullet-less list that keeps its list semantics. Panda's preflight sets
 * `list-style: none`, which makes Safari/VoiceOver drop the list role, so the
 * explicit `role="list"` is the point of this component.
 */
export function UIList(props: UIListProps) {
  const [local, rest] = splitProps(props, ["as", "class"]);
  return (
    <Dynamic
      component={local.as ?? "ul"}
      role="list"
      {...rest}
      class={cx(plainListClass, local.class)}
    />
  );
}
