// Pure cross-runtime helper: the agent's OpenAlex lookup and the backend's
// source dedupe key both read a work's DOI from its URL.

/**
 * The DOI a candidate URL names: a registry link, a publisher path, or a
 * JSTOR stable page. Host-specific routes are shared with backend identity.
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
  if (host === "nature.com") {
    // Only supported 10.1038 identifier families. Nature also hosts Palgrave
    // works with 10.1057 DOIs, so arbitrary article slugs cannot be inferred.
    const article =
      /^\/articles\/((?:nature|ncomms)\d+|s(?:41467|41586|41598)-\d{3}-\d{5}-[a-z0-9])(?:\.pdf)?\/?$/i.exec(
        path,
      );
    return article ? `10.1038/${article[1]}` : null;
  }
  if (host === "iopscience.iop.org") {
    // IOP suffixes can contain slashes (e.g. 0034-4885/69/1/R01).
    const article = /^\/article\/(10\.\d{4,9}\/.+?)(?:\/pdf)?\/?$/i.exec(path);
    const name = article?.[1];
    return name && doi.test(name) ? name : null;
  }
  if (host === "link.springer.com") {
    const work =
      /^\/(?:article|chapter|content\/pdf)\/(10\.\d{4,9}\/[^/]+?)\/?$/.exec(
        path,
      );
    const name = work?.[1]?.replace(/\.pdf$/i, "");
    return name && doi.test(name) ? name : null;
  }
  const publisher =
    /\/doi\/(?:(?:abs|full|pdf|epdf|epub|book|reader)\/)?(10\.\d{4,9}\/.+?)\/?$/.exec(
      path,
    );
  const name = publisher?.[1]?.replace(/\.pdf$/i, "");
  return name && doi.test(name) ? name : null;
}

// Publisher hosts whose /doi/<DOI> pages name their own works. A /doi/ path
// on any other host is not evidence of the work's identity.
const DOI_PUBLISHER_HOSTS = [
  "tandfonline.com",
  "onlinelibrary.wiley.com",
  "journals.sagepub.com",
  "dl.acm.org",
  "pubs.aip.org",
  "pubs.acs.org",
  "science.org",
  "pnas.org",
  "journals.uchicago.edu",
  "royalsocietypublishing.org",
  "annualreviews.org",
  "liebertpub.com",
  "pubsonline.informs.org",
  "journals.physiology.org",
  "ahajournals.org",
  "nejm.org",
  "epubs.siam.org",
];

/**
 * The DOI a URL names when its host is authoritative for it: doi.org, JSTOR,
 * or a known publisher. Used for identity (dedupe), unlike doiForUrl.
 */
export function trustedDoiForUrl(rawUrl: string): string | null {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  const trusted =
    host === "doi.org" ||
    host === "dx.doi.org" ||
    host === "jstor.org" ||
    host === "nature.com" ||
    host === "iopscience.iop.org" ||
    host === "link.springer.com" ||
    DOI_PUBLISHER_HOSTS.some(
      (publisher) => host === publisher || host.endsWith(`.${publisher}`),
    );
  return trusted ? doiForUrl(rawUrl) : null;
}
