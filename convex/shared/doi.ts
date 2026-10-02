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
    DOI_PUBLISHER_HOSTS.some(
      (publisher) => host === publisher || host.endsWith(`.${publisher}`),
    );
  return trusted ? doiForUrl(rawUrl) : null;
}
