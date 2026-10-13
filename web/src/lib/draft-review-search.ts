/** URL input only. Convex still validates IDs and authorizes the lookup. */
export function parseDraftReviewSearch(search: Record<string, unknown>): {
  draft?: string;
  intent?: string;
  invalidReviewLink?: boolean;
} {
  const result: {
    draft?: string;
    intent?: string;
    invalidReviewLink?: boolean;
  } = {};
  for (const key of ["draft", "intent"] as const) {
    const value = search[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
      result.invalidReviewLink = true;
    } else {
      result[key] = value;
    }
  }
  // Never choose one of two conflicting decision targets silently.
  if (result.draft && result.intent) result.invalidReviewLink = true;
  return result;
}
