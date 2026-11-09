import { describe, expect, test, vi } from "vite-plus/test";
import { publisherDois } from "../../harness/fixtures/publisherDois";
import { createOpenAlexAbstract } from "../src/tools/crawlTool";

describe("publisher URL OpenAlex lookup", () => {
  test.each([
    "https://www.nature.com/articles/palcomms2016103",
    "https://www.nature.com/articles/s41599-020-00669-6",
  ])(
    "does not fabricate a DOI lookup for unsupported Nature identifiers: %s",
    async (url) => {
      const fetchImpl = vi.fn(() =>
        Promise.resolve(new Response(null, { status: 404 })),
      );
      const lookup = createOpenAlexAbstract({ fetchImpl });
      expect(await lookup(url)).toBeNull();
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  test.each(publisherDois)(
    "looks up the DOI named by $url",
    async ({ url, doi }) => {
      const abstract =
        "Measured acoustic modes and musical perception provide evidence for this scholarly work and its experimentally tested claims.";
      const index: Record<string, number[]> = {};
      abstract.split(" ").forEach((word, offset) => {
        (index[word] ??= []).push(offset);
      });
      const fetchImpl = vi.fn((_input: string | URL | Request) =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              id: "https://openalex.org/W1234567890",
              doi: `https://doi.org/${doi}`,
              title: "Recorded publisher lookup fixture",
              abstract_inverted_index: index,
            }),
            { status: 200 },
          ),
        ),
      );
      const lookup = createOpenAlexAbstract({ fetchImpl });
      expect((await lookup(url))?.provider).toBe("openalex");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [input] = fetchImpl.mock.calls[0];
      const requested = new URL(input instanceof Request ? input.url : input);
      expect(decodeURIComponent(requested.pathname)).toBe(`/works/doi:${doi}`);
      expect(requested.searchParams.has("search")).toBe(false);
    },
  );
});
