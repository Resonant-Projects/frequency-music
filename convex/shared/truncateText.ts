/** Keep a UTF-16 length cap without splitting a supplementary character. */
export function truncateText(text: string, maxCodeUnits: number): string {
  const cut = text.slice(0, maxCodeUnits);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}
