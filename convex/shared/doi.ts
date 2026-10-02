// Pure cross-runtime helper: the agent's OpenAlex lookup and the backend's
// source dedupe key both read a work's DOI from its URL.

/**
 * The DOI a candidate URL names: a doi.org link, a publisher /doi/ path, or a
 * JSTOR stable page, whose DOI is 10.2307/<stable id>.
 */
export function doiForUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const doi = /^10\.\d{4,9}\/\S+$/;
  if (host === "doi.org" || host === "dx.doi.org") {
    const name = path.replace(/^\//, "");
    return doi.test(name) ? name : null;
  }
  if (host === "jstor.org") {
    const stable = /^\/stable\/(?:pdf\/)?(\d+)(?:\.pdf)?\/?$/.exec(path);
    if (stable) return `10.2307/${stable[1]}`;
    const named = /^\/stable\/(10\.\d{4,9}\/[^/]+)\/?$/.exec(path);
    return named?.[1] ?? null;
  }
  const publisher =
    /\/doi\/(?:(?:abs|full|pdf|epdf|epub|book|reader)\/)?(10\.\d{4,9}\/.+?)\/?$/.exec(
      path,
    );
  const name = publisher?.[1]?.replace(/\.pdf$/i, "");
  return name && doi.test(name) ? name : null;
}
