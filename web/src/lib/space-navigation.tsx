import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type ParentProps,
  type Setter,
} from "solid-js";
import type { AtlasNode } from "./knowledge-atlas";

const SpaceNavigation = createContext<{
  pending: Accessor<AtlasNode | null>;
  select: Setter<AtlasNode | null>;
}>();

export function SpaceNavigationProvider(props: ParentProps) {
  const [pending, select] = createSignal<AtlasNode | null>(null);
  return (
    <SpaceNavigation.Provider value={{ pending, select }}>
      {props.children}
    </SpaceNavigation.Provider>
  );
}

export function useSpaceNavigation() {
  const value = useContext(SpaceNavigation);
  if (!value) throw new Error("Space navigation requires the app shell");
  return value;
}
