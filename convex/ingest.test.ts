import { describe, expect, test } from "vite-plus/test";
import {
  assertPublicHttpUrl,
  buildJinaReaderUrl,
  classifyUrlTextFetchError,
  MAX_URL_TEXT_CHARS,
  parseRSSXML,
  responseToUrlTextResult,
  stripHtml,
} from "./ingest";

describe("assertPublicHttpUrl", () => {
  test.each([
    "https://example.com/article",
    "http://example.com:8080/x",
    "https://93.184.216.34/",
  ])("accepts public HTTP URL %s", (url) => {
    expect(assertPublicHttpUrl(url).toString()).toBe(url);
  });

  test.each([
    "file:///etc/passwd",
    "ftp://example.com",
  ])("rejects unsupported scheme in %s", (url) => {
    expect(() => assertPublicHttpUrl(url)).toThrow(
      "invalid_url: only HTTP and HTTPS URLs are supported",
    );
  });

  test("rejects embedded credentials", () => {
    expect(() => assertPublicHttpUrl("https://user:pass@example.com")).toThrow(
      "invalid_url: URLs with embedded credentials are rejected",
    );
  });

  test.each([
    "http://localhost/",
    "http://service.localhost/",
    "http://printer.local/",
    "http://foo.internal/",
    "http://0.0.0.0/",
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.1.2.3/",
    "http://172.16.0.1/",
    "http://192.168.1.1/",
    "http://100.64.0.1/",
    "http://[::]/",
    "http://[::1]/",
    "http://[fe80::1]/",
    "http://[fc00::1]/",
    "http://[fd00::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:10.0.0.1]/",
    "http://[::ffff:8.8.8.8]/",
    "http://0.1.2.3/",
    // Trailing DNS root dot resolves identically to the dotless form and must
    // not slip past the internal-hostname suffix checks.
    "http://localhost./",
    "http://service.localhost./",
    "http://printer.local./",
    "http://foo.internal./",
  ])("rejects private or internal target %s", (url) => {
    expect(() => assertPublicHttpUrl(url)).toThrow(
      "blocked_url: refusing to fetch a private or loopback address",
    );
  });

  test("rejects malformed URLs", () => {
    expect(() => assertPublicHttpUrl("not a url")).toThrow(
      "invalid_url: URL is not valid",
    );
  });
});

describe("URL text fetch helpers", () => {
  test("builds the Jina Reader URL for HTTP and HTTPS sources", () => {
    expect(buildJinaReaderUrl("https://example.com/article?part=1")).toBe(
      "https://r.jina.ai/https://example.com/article?part=1",
    );
    expect(buildJinaReaderUrl("http://example.com/article")).toBe(
      "https://r.jina.ai/http://example.com/article",
    );
  });

  test("rejects malformed, credentialed, and non-HTTP source URLs", () => {
    expect(() => buildJinaReaderUrl("not a URL")).toThrow("invalid_url");
    expect(() => buildJinaReaderUrl("ftp://example.com/article")).toThrow(
      "invalid_url",
    );
    expect(() =>
      buildJinaReaderUrl("https://user:secret@example.com/article"),
    ).toThrow("invalid_url");
  });

  test("shapes a successful response into trimmed text", () => {
    expect(
      responseToUrlTextResult({
        ok: true,
        status: 200,
        statusText: "OK",
        text: "  readable article text  ",
      }),
    ).toEqual({ ok: true, text: "readable article text", status: 200 });
  });

  test("shapes HTTP, empty, and oversized responses into stable errors", () => {
    expect(
      responseToUrlTextResult({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: "",
      }),
    ).toEqual({
      ok: false,
      error: "http_error: Jina Reader returned HTTP 429 Too Many Requests",
      status: 429,
    });

    expect(
      responseToUrlTextResult({
        ok: true,
        status: 200,
        statusText: "OK",
        text: "   ",
      }),
    ).toEqual({
      ok: false,
      error: "no_text: Jina Reader returned an empty response",
      status: 200,
    });

    expect(
      responseToUrlTextResult({
        ok: true,
        status: 200,
        statusText: "OK",
        text: "x".repeat(MAX_URL_TEXT_CHARS + 1),
      }),
    ).toEqual({
      ok: false,
      error: `response_too_large: Jina Reader returned ${MAX_URL_TEXT_CHARS + 1} characters (limit ${MAX_URL_TEXT_CHARS})`,
      status: 200,
    });
  });

  test("classifies timeout, network, invalid URL, and unknown failures", () => {
    const timeout = new Error("This operation was aborted");
    timeout.name = "AbortError";

    expect(classifyUrlTextFetchError(timeout)).toBe(
      "timeout: Jina Reader request exceeded 30 seconds",
    );
    expect(classifyUrlTextFetchError(new TypeError("fetch failed"))).toBe(
      "network_error: fetch failed",
    );
    expect(
      classifyUrlTextFetchError(new Error("invalid_url: malformed URL")),
    ).toBe("invalid_url: malformed URL");
    expect(classifyUrlTextFetchError("unavailable")).toBe(
      "unknown_error: unavailable",
    );
  });
});

describe("RSS and Atom source parsing", () => {
  test("parses a minimal RSS source item", () => {
    const xml = `
      <rss>
        <channel>
          <title>Research Notes</title>
          <item>
            <title>Resonant Forms</title>
            <link>https://example.com/resonant-forms</link>
            <pubDate>Wed, 09 Jul 2026 12:00:00 GMT</pubDate>
            <description>A study of resonant geometry.</description>
            <guid>source-1</guid>
          </item>
        </channel>
      </rss>
    `;

    expect(parseRSSXML(xml)).toEqual({
      title: "Research Notes",
      items: [
        {
          title: "Resonant Forms",
          link: "https://example.com/resonant-forms",
          pubDate: "Wed, 09 Jul 2026 12:00:00 GMT",
          description: "A study of resonant geometry.",
          guid: "source-1",
          content: undefined,
        },
      ],
    });
  });

  test("parses an Atom source entry equivalently", () => {
    const xml = `
      <feed>
        <title>Atom Research</title>
        <entry>
          <title>Harmonic Space</title>
          <link href="https://example.com/harmonic-space" />
          <published>2026-07-09T12:00:00Z</published>
          <summary>Mapping intervals into geometry.</summary>
          <id>urn:source:2</id>
        </entry>
      </feed>
    `;

    expect(parseRSSXML(xml)).toEqual({
      title: "Atom Research",
      items: [
        {
          title: "Harmonic Space",
          link: "https://example.com/harmonic-space",
          pubDate: "2026-07-09T12:00:00Z",
          description: "Mapping intervals into geometry.",
          guid: "urn:source:2",
          content: undefined,
        },
      ],
    });
  });

  test("unwraps CDATA in source titles and descriptions", () => {
    const xml = `
      <rss>
        <channel>
          <title><![CDATA[Field Notes]]></title>
          <item>
            <title><![CDATA[Cymatic <Patterns>]]></title>
            <link>https://example.com/cymatics</link>
            <description><![CDATA[Visible & audible forms]]></description>
          </item>
        </channel>
      </rss>
    `;

    const parsed = parseRSSXML(xml);
    expect(parsed.title).toBe("Field Notes");
    expect(parsed.items[0]?.title).toBe("Cymatic <Patterns>");
    expect(parsed.items[0]?.description).toBe("Visible & audible forms");
  });

  test("skips a source item without a link", () => {
    const xml = `
      <rss>
        <channel>
          <title>Incomplete Sources</title>
          <item>
            <title>Missing Location</title>
            <description>This item has no link.</description>
          </item>
        </channel>
      </rss>
    `;

    // NOTE: Source items without links are silently discarded.
    expect(parseRSSXML(xml)).toEqual({
      title: "Incomplete Sources",
      items: [],
    });
  });

  test("returns an unknown empty feed for empty input", () => {
    expect(parseRSSXML("")).toEqual({ title: "Unknown Feed", items: [] });
  });

  test("ignores a malformed truncated source item", () => {
    const xml = `
      <rss>
        <channel>
          <title>Interrupted Feed</title>
          <item>
            <title>Unfinished Source</title>
            <link>https://example.com/unfinished</link>
        </channel>
      </rss>
    `;

    // NOTE: Truncated item blocks are silently ignored instead of rejected.
    expect(parseRSSXML(xml)).toEqual({
      title: "Interrupted Feed",
      items: [],
    });
  });

  test("exposes content:encoded as source content", () => {
    const xml = `
      <rss>
        <channel>
          <title>Full Text</title>
          <item>
            <title>Complete Article</title>
            <link>https://example.com/complete</link>
            <content:encoded><![CDATA[<p>Full article text</p>]]></content:encoded>
          </item>
        </channel>
      </rss>
    `;

    expect(parseRSSXML(xml).items[0]?.content).toBe("<p>Full article text</p>");
  });

  test("preserves source item order", () => {
    const xml = `
      <rss>
        <channel>
          <title>Ordered Sources</title>
          <item>
            <title>First</title>
            <link>https://example.com/first</link>
          </item>
          <item>
            <title>Second</title>
            <link>https://example.com/second</link>
          </item>
        </channel>
      </rss>
    `;

    expect(parseRSSXML(xml).items.map((item) => item.title)).toEqual([
      "First",
      "Second",
    ]);
  });
});

describe("source HTML stripping", () => {
  test("removes tags and decodes supported entities", () => {
    const html =
      "<p>Sound&nbsp;&amp;&nbsp;form: &lt;wave&gt; &quot;quoted&quot; &#39;single&#39;</p><script>alert(1)</script>hi";

    // BUG: Tag stripping leaves script element content in the source text.
    expect(stripHtml(html)).toBe(
      "Sound & form: <wave> \"quoted\" 'single' alert(1) hi",
    );
  });
});
