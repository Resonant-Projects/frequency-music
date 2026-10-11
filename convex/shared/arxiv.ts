/**
 * The version-less arXiv identifier an arxiv.org URL or OAI guid names, so a
 * paper's revisions and cross-listed announcements key as one source.
 */
export function arxivIdForUrl(value: string): string | null {
  const id =
    "((?:\\d{4}\\.\\d{4,5})|(?:[a-z-]+(?:\\.[A-Z]{2})?\\/\\d{7}))(?:v\\d+)?";
  // A legacy id's subject class is optional ("math.CA/0611800" is
  // "math/0611800"), so the identity is the lowercase archive and number.
  const canonical = (raw: string | undefined) =>
    raw?.replace(
      /^([a-z-]+)(?:\.[a-z]{2})?\//i,
      (_m, archive: string) => `${archive.toLowerCase()}/`,
    ) ?? null;
  const oai = new RegExp(`^oai:arXiv\\.org:${id}$`, "i").exec(value.trim());
  if (oai) return canonical(oai[1]);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  // Only arXiv itself names arXiv papers.
  if (host !== "arxiv.org" && !host.endsWith(".arxiv.org")) return null;
  const path = new RegExp(
    `^\\/(?:abs|pdf|html)\\/${id}(?:\\.pdf)?\\/?$`,
    "i",
  ).exec(url.pathname);
  return canonical(path?.[1]);
}
