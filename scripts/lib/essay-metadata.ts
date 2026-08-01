const EXCERPT_MAX_LENGTH = 200;

/**
 * Collapses whitespace and enforces the 200-character excerpt budget the blog
 * card layout assumes. The model is asked for a short excerpt but is not bound
 * by it, so this is the enforcement point rather than a formatting nicety.
 *
 * Prefers cutting at a sentence boundary; otherwise falls back to the last word
 * boundary and appends an ellipsis, trimming dangling punctuation. The word-
 * boundary step is best-effort: an excerpt with no spaces in its first 199
 * characters has no boundary to cut on and is truncated mid-token.
 */
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
