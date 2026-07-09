import { describe, expect, test } from "bun:test";
import { parseRSSXML, stripHtml } from "./ingest";

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
