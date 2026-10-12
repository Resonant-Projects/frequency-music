/** Human-supplied capture limits shared by the queue form and its mutation. */
export const RECOVERY_TEXT_MAX_CHARS = 200_000;
export const RECOVERY_NOTE_MAX_CHARS = 2_000;
export const RECOVERY_KINDS = [
  "transcript",
  "article",
  "excerpt",
  "abstract",
] as const;
export type RecoveryKind = (typeof RECOVERY_KINDS)[number];

export function publicSourceUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
