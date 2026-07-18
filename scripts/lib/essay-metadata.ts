const EXCERPT_MAX_LENGTH = 200;

export function normalizeExcerpt(excerpt: string): string {
  const normalized = excerpt.trim().replaceAll(/\s+/g, " ");
  if (normalized.length <= EXCERPT_MAX_LENGTH) {
    return normalized;
  }

  const firstSentence = normalized.match(/^.+?[.!?](?:\s|$)/)?.[0]?.trim();
  if (firstSentence && firstSentence.length <= EXCERPT_MAX_LENGTH) {
    return firstSentence;
  }

  const candidate = normalized.slice(0, EXCERPT_MAX_LENGTH - 1);
  const lastWordBoundary = candidate.lastIndexOf(" ");
  const truncated = candidate
    .slice(0, lastWordBoundary > 0 ? lastWordBoundary : candidate.length)
    .replaceAll(/[,:;—-]+$/g, "");
  return `${truncated}…`;
}
