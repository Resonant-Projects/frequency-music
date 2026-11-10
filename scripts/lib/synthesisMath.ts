// Pure helpers for scripts/synthesize-from-convex.ts.

export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function normalizedScore(
  base: number,
  min: number,
  max: number,
): number {
  if (max === min) return 1;
  return (base - min) / (max - min);
}

export function timestampSlug(date: Date): string {
  return date.toISOString().replaceAll(/[:.]/g, "-");
}
