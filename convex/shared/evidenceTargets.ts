/* eslint-disable no-underscore-dangle -- Convex document ids use underscore names. */
// Pure ordering for the evidence hunter's Correspondence targets. Like the
// rest of convex/shared/, it imports nothing from the Convex runtime.

type EvidenceRow = {
  _id: string;
  createdAt: number;
  evidence: readonly { addedAt: number }[];
};

/** When evidence was last attached, or undefined when there is none. */
export function lastEvidenceAt(row: EvidenceRow): number | undefined {
  return row.evidence.reduce<number | undefined>(
    (latest, entry) => Math.max(latest ?? 0, entry.addedAt),
    undefined,
  );
}

/** No-evidence rows first, then oldest evidence, then oldest row, then id. */
export function orderEvidenceTargets<T extends EvidenceRow>(
  rows: readonly T[],
): T[] {
  return rows.toSorted((left, right) => {
    const leftEvidence = lastEvidenceAt(left);
    const rightEvidence = lastEvidenceAt(right);
    if (leftEvidence === undefined && rightEvidence !== undefined) return -1;
    if (leftEvidence !== undefined && rightEvidence === undefined) return 1;
    return (
      (leftEvidence ?? 0) - (rightEvidence ?? 0) ||
      left.createdAt - right.createdAt ||
      left._id.localeCompare(right._id)
    );
  });
}

/** The `turn`-th window of `size` rows, cycling through the whole list. */
export function rotateWindow<T>(
  rows: readonly T[],
  size: number,
  turn: number,
): T[] {
  if (rows.length === 0 || size < 1) return [];
  const windows = Math.ceil(rows.length / size);
  const index = ((turn % windows) + windows) % windows;
  return rows.slice(index * size, index * size + size);
}
