import { describe, expect, test } from "vite-plus/test";
import { doiForUrl, trustedDoiForUrl } from "./doi";
import { generateDedupeKey, normalizeUrl } from "../sourceUtils";
import { publisherDois } from "../../harness/fixtures/publisherDois";

describe("publisher DOI identity", () => {
  test.each(publisherDois)(
    "unifies $url with its registry URL",
    ({ url, doi }) => {
      expect(doiForUrl(url)).toBe(doi);
      expect(trustedDoiForUrl(url)).toBe(doi);
      const key = `doi:${doi.toLowerCase()}`;
      for (const canonicalUrl of [
        url,
        `${url}?utm_source=scout#abstract`,
        `https://doi.org/${doi}`,
        `https://doi.org/${doi.toUpperCase()}`,
        url.replace(/[^/]+$/, (suffix) => suffix.toUpperCase()),
      ]) {
        expect(generateDedupeKey("url", { canonicalUrl })).toBe(key);
      }
    },
  );

  test.each([
    [
      "https://iopscience.iop.org/article/10.1088/0034-4885/69/1/R01/pdf",
      "10.1088/0034-4885/69/1/R01",
    ],
    ["https://epubs.siam.org/doi/epdf/10.1137/100804036", "10.1137/100804036"],
    [
      "https://link.springer.com/article/10.3758%2Fs13423-021-02033-5/",
      "10.3758/s13423-021-02033-5",
    ],
    ["https://www.jstor.org/stable/1513178", "10.2307/1513178"],
    ["https://www.jstor.org/stable/pdf/1513178.pdf", "10.2307/1513178"],
    [
      "https://dx.doi.org/10.1088/0034-4885/69/1/R01",
      "10.1088/0034-4885/69/1/R01",
    ],
    ["https://pubs.aip.org/doi/10.1121/1.1234567", "10.1121/1.1234567"],
  ])("reads the named DOI in %s", (url, doi) => {
    expect(trustedDoiForUrl(url)).toBe(doi);
    expect(generateDedupeKey("url", { canonicalUrl: url })).toBe(
      `doi:${doi.toLowerCase()}`,
    );
  });

  test.each([
    "https://attacker.example/doi/10.1038/nature18635",
    "https://nature.com.attacker.example/articles/nature18635",
    "https://attacker.example/articles/nature18635",
    "https://attacker.example/article/10.1088/0034-4885/69/1/R01",
    "https://epubs.siam.org.attacker.example/doi/10.1137/100804036",
    "https://link.springer.com.attacker.example/article/10.3758/s13423-021-02033-5",
    "https://www.nature.com/articles/nature18635/related",
    "https://www.nature.com/articles/",
    "https://www.nature.com/articles/%ZZ",
    "https://iopscience.iop.org/article/not-a-doi",
    "https://link.springer.com/article/12345",
    "https://link.springer.com/search?query=10.1038/nature18635",
    "https://www.aes.org/e-lib/browse.cfm?elib=12345",
    "https://pubs.aip.org/asa/jasa/article/149/1/1/000001/Example",
  ])("keeps URL identity without an authoritative DOI: %s", (canonicalUrl) => {
    expect(trustedDoiForUrl(canonicalUrl)).toBeNull();
    expect(generateDedupeKey("url", { canonicalUrl })).toBe(
      `url:${normalizeUrl(canonicalUrl)}`,
    );
  });
});
