import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { createEffect, createMemo, createSignal, onCleanup, type Accessor } from "solid-js";
import { useConvexClient } from "./provider";

export interface QueryStatus<T> {
  data: Accessor<T | undefined>;
  error: Accessor<Error | null>;
  isLoading: Accessor<boolean>;
  isError: Accessor<boolean>;
}

export function createQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args?: FunctionArgs<Query> | (() => FunctionArgs<Query>),
): Accessor<FunctionReturnType<Query> | undefined> {
  const convex = useConvexClient();
  const [data, setData] = createSignal<FunctionReturnType<Query> | undefined>(
    undefined,
  );

  const resolvedArgs = createMemo(
    () =>
      (typeof args === "function" ? (args as () => FunctionArgs<Query>)() : args) ??
      ({} as FunctionArgs<Query>),
  );

  let unsubscribe: (() => void) | null = null;

  createEffect(() => {
    const nextArgs = resolvedArgs();
    unsubscribe?.();
    unsubscribe = convex.onUpdate(query, nextArgs, (result) => {
      setData(() => result);
    });
  });

  onCleanup(() => {
    unsubscribe?.();
    unsubscribe = null;
  });

  return data;
}

export function createQueryWithStatus<Query extends FunctionReference<"query">>(
  query: Query,
  args?: FunctionArgs<Query> | (() => FunctionArgs<Query>),
): QueryStatus<FunctionReturnType<Query>> {
  const convex = useConvexClient();

  const [data, setData] = createSignal<FunctionReturnType<Query> | undefined>(
    undefined,
  );
  const [error, setError] = createSignal<Error | null>(null);

  const resolvedArgs = createMemo(
    () =>
      (typeof args === "function" ? (args as () => FunctionArgs<Query>)() : args) ??
      ({} as FunctionArgs<Query>),
  );

  let unsubscribe: (() => void) | null = null;
  let hasReceivedData = false;
  let isMounted = true;

  createEffect(() => {
    const nextArgs = resolvedArgs();

    hasReceivedData = false;
    setData(() => undefined);
    setError(() => null);

    unsubscribe?.();
    unsubscribe = convex.onUpdate(
      query,
      nextArgs,
      (result: FunctionReturnType<Query>) => {
        hasReceivedData = true;
        setData(() => result);
        setError(() => null);
      },
      (err: unknown) => {
        if (!isMounted) return;
        setError(() =>
          err instanceof Error ? err : new Error(String(err ?? "Unknown error")),
        );
      },
    );

    convex
      .query(query, nextArgs)
      .then((result: FunctionReturnType<Query>) => {
        if (!isMounted || hasReceivedData) return;
        hasReceivedData = true;
        setData(() => result);
      })
      .catch((err: unknown) => {
        if (!isMounted || hasReceivedData) return;
        setError(() =>
          err instanceof Error ? err : new Error(String(err ?? "Unknown error")),
        );
      });
  });

  onCleanup(() => {
    isMounted = false;
    unsubscribe?.();
    unsubscribe = null;
  });

  const isLoading = createMemo(() => data() === undefined && error() === null);
  const isError = createMemo(() => error() !== null);

  return { data, error, isLoading, isError };
}
