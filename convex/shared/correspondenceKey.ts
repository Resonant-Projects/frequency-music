/**
 * Canonical identity for an unordered pair of Convex concept ids.
 *
 * Keep this helper free of Convex runtime imports so every correspondence
 * write path and its tests use exactly the same ordering rule.
 */
export function pairKey(conceptAId: string, conceptBId: string): string {
  return conceptAId < conceptBId
    ? `${conceptAId}:${conceptBId}`
    : `${conceptBId}:${conceptAId}`;
}
