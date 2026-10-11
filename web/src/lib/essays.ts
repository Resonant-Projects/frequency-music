import essayIndex from "virtual:essay-index";
import { type Essay, type EssaySummary, essayBody } from "./essay-parse";

const essayBodyLoaders = import.meta.glob("../../../docs/essays/*.md", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const loaderBySlug = new Map(
  Object.entries(essayBodyLoaders).map(([path, load]) => {
    const match = path.match(/\/([^/]+)\.md$/);
    return [match?.[1] ?? path, load] as const;
  }),
);

/** Build-time summaries, sorted newest first (see `compareEssays`). */
export const essayLibrary: EssaySummary[] = essayIndex;

const summaryBySlug = new Map(essayLibrary.map((entry) => [entry.slug, entry]));

/**
 * Fetches the essay's markdown body on demand and joins it to the build-time
 * summary; `null` when the slug is unknown.
 */
export async function getEssayBySlug(slug: string): Promise<Essay | null> {
  const load = loaderBySlug.get(slug);
  const summary = summaryBySlug.get(slug);
  if (!load || !summary) return null;
  return { ...summary, body: essayBody(await load()) };
}

export type { Essay, EssaySummary };
