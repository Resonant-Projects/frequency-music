import essayIndex from "virtual:essay-index";
import { type Essay, type EssaySummary, parseEssay } from "./essay-parse";

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

/** Fetches the essay's markdown body on demand; `null` when the slug is unknown. */
export async function getEssayBySlug(slug: string): Promise<Essay | null> {
  const load = loaderBySlug.get(slug);
  if (!load) return null;
  return parseEssay(slug, await load());
}

export type { Essay, EssaySummary };
