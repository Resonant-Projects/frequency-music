import { type Accessor, createMemo } from "solid-js";

/** True when two id lists are the same ids in the same order. */
export function sameIds(previous: readonly string[], next: readonly string[]) {
  return (
    previous.length === next.length &&
    previous.every((id, index) => id === next[index])
  );
}

/**
 * Stable identity for a live Convex list. Every subscription update delivers
 * fresh row objects, and `<For>` keys by object identity, so rendering the
 * rows directly remounts every row (and drops focus from any control inside
 * one) on every update. Render `<For each={rows.ids()}>` instead and read the
 * current row through `rows.byId().get(id)`: the row node lives as long as
 * its id is listed, and its fields stay reactive.
 */
export function createKeyedRows<T>(
  source: () => readonly T[] | undefined,
  key: (row: T) => string,
): { ids: Accessor<string[]>; byId: Accessor<Map<string, T>> } {
  const ids = createMemo(() => (source() ?? []).map(key), [], {
    equals: sameIds,
  });
  const byId = createMemo(
    () => new Map((source() ?? []).map((row) => [key(row), row] as const)),
  );
  return { ids, byId };
}
