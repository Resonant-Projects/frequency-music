import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { useConvexClient } from "./provider";

export function createMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
): (args?: FunctionArgs<Mutation>) => Promise<FunctionReturnType<Mutation>> {
  const convex = useConvexClient();

  return async (args?: FunctionArgs<Mutation>) => {
    return convex.mutation(
      mutation,
      (args ?? {}) as FunctionArgs<Mutation>,
    ) as Promise<FunctionReturnType<Mutation>>;
  };
}
