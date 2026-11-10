/** A 0-5 score field: `undefined` when blank, `null` when invalid. */
export function parseScore(raw: string): number | null | undefined {
  if (raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 5 ? value : null;
}
