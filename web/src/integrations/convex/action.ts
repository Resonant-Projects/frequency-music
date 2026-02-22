import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { useConvexClient } from "./provider";

export function createAction<Action extends FunctionReference<"action">>(
  action: Action,
): (args?: FunctionArgs<Action>) => Promise<FunctionReturnType<Action>> {
  const convex = useConvexClient();

  return async (args?: FunctionArgs<Action>) => {
    return convex.action(
      action,
      (args ?? {}) as FunctionArgs<Action>,
    ) as Promise<FunctionReturnType<Action>>;
  };
}
