import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { generateDedupeKey } from "./sourceUtils";
import { modules } from "../harness/modules";

async function seedAgentRun(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) =>
    ctx.db.insert("agentRuns", {
      graphName: "source-scout",
      status: "running",
      input: null,
      createdAt: 1,
      updatedAt: 1,
    }),
  );
}

describe("source scout canonical writes", () => {
  test("stores crawler text as text_ready and preserves it on duplicate scout intake", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const input = {
      url: "https://example.org/resonance",
      title: "Resonance experiment",
      query: "measured resonance",
      rationale: "Thin domain",
      agentRunId,
      rawText:
        "# Experimental setup\n" + "The measured resonant modes. ".repeat(5),
      contentProvider: "crawl4ai" as const,
    };
    const first = await t.mutation(internal.sources.createScoutedSource, input);
    const duplicate = await t.mutation(internal.sources.createScoutedSource, {
      ...input,
      rawText: "Must not overwrite. ".repeat(7),
      title: "Must not overwrite",
    });
    expect(duplicate).toEqual({ id: first.id, created: false });
    const source = await t.run((ctx) => ctx.db.get(first.id));
    expect(source).toMatchObject({
      status: "text_ready",
      rawText: input.rawText,
      title: input.title,
      rawTextSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      metadata: { scoutedBy: { contentProvider: "crawl4ai", agentRunId } },
    });
  });

  test("rejects oversized or unprovenanced scout text before writing", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const input = {
      url: "https://example.org/paper",
      query: "modal study",
      rationale: "Thin domain",
      agentRunId,
    };
    await expect(
      t.mutation(internal.sources.createScoutedSource, {
        ...input,
        rawText: "a".repeat(30_001),
        contentProvider: "crawl4ai",
      }),
    ).rejects.toThrow("100-30000 characters");
    await expect(
      t.mutation(internal.sources.createScoutedSource, {
        ...input,
        rawText: "Unattributed content",
      }),
    ).rejects.toThrow("must be supplied together");
    await expect(
      t.mutation(internal.sources.createScoutedSource, {
        ...input,
        rawText: "Short text",
        contentProvider: "crawl4ai",
      }),
    ).rejects.toThrow("100-30000 characters");
    await expect(
      t.mutation(internal.sources.createScoutedSource, {
        ...input,
        contentProvider: "crawl4ai",
      }),
    ).rejects.toThrow("must be supplied together");
    expect(await t.run((ctx) => ctx.db.query("sources").collect())).toEqual([]);
  });

  test("creates a provenance-stamped source and treats a canonical duplicate as a no-op", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const input = {
      url: "https://example.org/research/?b=2&a=1",
      title: "Original source title",
      publishedAt: 1_700_000_000_000,
      query: "cymatics modal geometry",
      rationale: "Fills the thin cymatics domain.",
      agentRunId,
    };

    const first = await t.mutation(internal.sources.createScoutedSource, input);
    const duplicate = await t.mutation(internal.sources.createScoutedSource, {
      ...input,
      url: "http://EXAMPLE.ORG/research?b=2&a=1",
      title: "Duplicate must not overwrite",
      rationale: "Duplicate must not overwrite provenance.",
    });

    expect(first.created).toBe(true);
    expect(duplicate).toEqual({ id: first.id, created: false });
    const rows = await t.run((ctx) => ctx.db.query("sources").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      _id: first.id,
      type: "url",
      title: "Original source title",
      canonicalUrl: input.url,
      dedupeKey: generateDedupeKey("url", { canonicalUrl: input.url }),
      status: "ingested",
      visibility: "private",
      createdBy: "system",
      metadata: {
        scoutedBy: {
          agentRunId,
          query: input.query,
          rationale: input.rationale,
        },
      },
    });
  });

  test("reports existing candidates by the same dedupe key intake uses", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    await t.mutation(internal.sources.createScoutedSource, {
      url: "https://example.org/research/?b=2&a=1",
      query: "cymatics modal geometry",
      rationale: "Fills the thin cymatics domain.",
      agentRunId,
    });

    await expect(
      t.query(internal.sources.existingScoutedUrls, {
        urls: [
          "http://EXAMPLE.ORG/research?b=2&a=1",
          "https://example.org/new-paper",
        ],
      }),
    ).resolves.toEqual([
      { url: "http://EXAMPLE.ORG/research?b=2&a=1", needsText: true },
    ]);
  });

  test("accepts crawler text only from a source-scout run", async () => {
    const t = convexTest(schema, modules);
    const otherRunId = await t.run((ctx) =>
      ctx.db.insert("agentRuns", {
        graphName: "weekly-brief",
        status: "running",
        input: null,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await expect(
      t.mutation(internal.sources.createScoutedSource, {
        url: "https://example.org/fabricated",
        query: "modal study",
        rationale: "Thin domain",
        agentRunId: otherRunId,
        rawText: `# Fabricated\n${"Not fetched by the crawler. ".repeat(5)}`,
        contentProvider: "crawl4ai",
      }),
    ).rejects.toThrow("requires a source-scout run");
    expect(await t.run((ctx) => ctx.db.query("sources").collect())).toEqual([]);
  });

  test("captures text later only for scout-created URL-only sources", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const base = {
      url: "https://example.org/outage",
      query: "modal study",
      rationale: "Thin domain",
      agentRunId,
    };
    const rawText = `# Recovered page\n${"Measured resonant modes. ".repeat(6)}`;
    const first = await t.mutation(internal.sources.createScoutedSource, base);
    const retry = await t.mutation(internal.sources.createScoutedSource, {
      ...base,
      rawText,
      contentProvider: "crawl4ai",
    });
    expect(retry).toEqual({ id: first.id, created: false, enriched: true });
    await expect(
      t.mutation(internal.sources.createScoutedSource, {
        ...base,
        rawText: "Must not overwrite. ".repeat(7),
        contentProvider: "crawl4ai",
      }),
    ).resolves.toEqual({ id: first.id, created: false });
    expect(await t.run((ctx) => ctx.db.get(first.id))).toMatchObject({
      status: "text_ready",
      rawText,
      rawTextSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      metadata: {
        scoutedBy: {
          query: "modal study",
          contentProvider: "crawl4ai",
          capturedByAgentRunId: agentRunId,
        },
      },
    });
    await expect(
      t.query(internal.sources.existingScoutedUrls, { urls: [base.url] }),
    ).resolves.toEqual([{ url: base.url, needsText: false }]);

    const manualUrl = "https://example.org/manual";
    const manualId = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        canonicalUrl: manualUrl,
        dedupeKey: generateDedupeKey("url", { canonicalUrl: manualUrl }),
        status: "ingested",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await expect(
      t.mutation(internal.sources.createScoutedSource, {
        ...base,
        url: manualUrl,
        rawText,
        contentProvider: "crawl4ai",
      }),
    ).resolves.toEqual({ id: manualId, created: false });
    expect(await t.run((ctx) => ctx.db.get(manualId))).toMatchObject({
      status: "ingested",
    });
  });

  test("proposes feeds disabled with exact proposal metadata and leaves duplicate URLs untouched", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const sampleItems = [
      {
        title: "Measured resonance result",
        url: "https://example.org/items/1",
        snippet: "A measured result.",
        publishedAt: "2026-06-01",
      },
    ];
    const proposal = await t.mutation(internal.feeds.proposeFeed, {
      name: "Acoustics journal feed",
      url: "https://example.org/feed.xml",
      type: "rss",
      rationale: "Recurring evidence for a starved conjecture.",
      sampleItems,
      agentRunId,
    });

    expect(proposal.created).toBe(true);
    const proposed = await t.run((ctx) => ctx.db.get(proposal.id));
    expect(proposed).toMatchObject({
      name: "Acoustics journal feed",
      url: "https://example.org/feed.xml",
      type: "rss",
      enabled: false,
      metadata: {
        proposal: {
          agentRunId,
          rationale: "Recurring evidence for a starved conjecture.",
          sampleItems,
        },
      },
    });

    const existingId = await t.run((ctx) =>
      ctx.db.insert("feeds", {
        name: "Existing human-enabled feed",
        url: "https://example.org/existing.xml",
        type: "rss",
        enabled: true,
        metadata: { owner: "human" },
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const duplicate = await t.mutation(internal.feeds.proposeFeed, {
      name: "Scout duplicate",
      url: "https://example.org/existing.xml",
      type: "rss",
      rationale: "Must not overwrite.",
      sampleItems: [],
      agentRunId,
    });
    expect(duplicate).toEqual({ id: existingId, created: false });
    expect(await t.run((ctx) => ctx.db.get(existingId))).toMatchObject({
      name: "Existing human-enabled feed",
      enabled: true,
      metadata: { owner: "human" },
    });
  });
});

describe("scout capture providers and repair", () => {
  const article =
    "# Experimental setup\n" + "The measured resonant modes. ".repeat(5);

  test("accepts OpenAlex abstract provenance", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const created = await t.mutation(internal.sources.createScoutedSource, {
      url: "https://www.jstor.org/stable/1513178",
      query: "l-systems melody",
      rationale: "Thin domain",
      agentRunId,
      rawText:
        "Abstract from OpenAlex (W2328530878; DOI 10.2307/1513178). The full text was not captured.\n\n# L-Systems, Melodies and Musical Structure (1994)\n\n" +
        "Among musical symmetries and self-similarities are those produced by L-system curves. ".repeat(
          2,
        ),
      contentProvider: "openalex",
    });
    expect(await t.run((ctx) => ctx.db.get(created.id))).toMatchObject({
      status: "text_ready",
      metadata: { scoutedBy: { contentProvider: "openalex" } },
    });
  });

  test("accepts Firecrawl provenance and rejects bot challenge text", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const input = {
      url: "https://example.org/paper.pdf",
      query: "modal study",
      rationale: "Thin domain",
      agentRunId,
    };
    const created = await t.mutation(internal.sources.createScoutedSource, {
      ...input,
      rawText: article,
      contentProvider: "firecrawl",
    });
    const source = await t.run((ctx) => ctx.db.get(created.id));
    expect(source).toMatchObject({
      status: "text_ready",
      metadata: { scoutedBy: { contentProvider: "firecrawl" } },
    });
    const walled = await t.mutation(internal.sources.createScoutedSource, {
      ...input,
      url: "https://www.jstor.org/stable/1513178",
      rawText:
        "A required part of this site couldn’t load. Please check your connection, disable any ad blockers, or try using a different browser. \nis verifying your browser...",
      contentProvider: "crawl4ai",
    });
    // The wall is dropped, but the URL-only Source is kept for a later run.
    expect(walled.created).toBe(true);
    const kept = await t.run((ctx) => ctx.db.get(walled.id));
    expect(kept).toMatchObject({ status: "ingested" });
    expect(kept?.rawText).toBeUndefined();
    const keptMetadata = kept?.metadata as
      | { scoutedBy?: Record<string, unknown> }
      | undefined;
    expect(keptMetadata?.scoutedBy).toBeDefined();
    expect(keptMetadata?.scoutedBy).not.toHaveProperty("contentProvider");

    // A wall shorter than the minimum text length is still a failed capture.
    const shortWall = await t.mutation(internal.sources.createScoutedSource, {
      ...input,
      url: "https://example.org/walled",
      rawText: "Please complete the CAPTCHA to continue.",
      contentProvider: "firecrawl",
    });
    expect(shortWall.created).toBe(true);
    const shortKept = await t.run((ctx) => ctx.db.get(shortWall.id));
    expect(shortKept).toMatchObject({ status: "ingested" });
    expect(shortKept?.rawText).toBeUndefined();
  });

  test("resets a bad capture so a later Scout run can capture it again", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const asOperator = t.withIdentity({
      subject: "operator",
      name: "Operator",
    });
    const input = {
      url: "https://example.org/resonance",
      query: "measured resonance",
      rationale: "Thin domain",
      agentRunId,
    };
    const { id } = await t.mutation(internal.sources.createScoutedSource, {
      ...input,
      rawText: article,
      contentProvider: "crawl4ai",
    });

    await asOperator.mutation(api.sources.resetScoutCapture, {
      id,
      reason: "Captured a bot wall",
    });
    const reset = await t.run((ctx) => ctx.db.get(id));
    expect(reset).toMatchObject({
      status: "ingested",
      blockedReason: "no_text",
      blockedDetails: "Captured a bot wall",
      metadata: { scoutedBy: { agentRunId } },
    });
    expect(reset?.rawText).toBeUndefined();
    expect(reset?.rawTextSha256).toBeUndefined();
    const resetMetadata = reset?.metadata as
      | { scoutedBy?: Record<string, unknown> }
      | undefined;
    expect(resetMetadata?.scoutedBy).toBeDefined();
    expect(resetMetadata?.scoutedBy).not.toHaveProperty("contentProvider");

    const recaptured = await t.mutation(internal.sources.createScoutedSource, {
      ...input,
      rawText: article + " Captured again.",
      contentProvider: "firecrawl",
    });
    expect(recaptured).toEqual({ id, created: false, enriched: true });
    const enriched = await t.run((ctx) => ctx.db.get(id));
    expect(enriched).toMatchObject({
      status: "text_ready",
      metadata: { scoutedBy: { contentProvider: "firecrawl" } },
    });
    expect(enriched?.blockedReason).toBeUndefined();
    expect(enriched?.blockedDetails).toBeUndefined();
  });

  test("resets a capture the extraction gate parked as no_text", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const asOperator = t.withIdentity({
      subject: "operator",
      name: "Operator",
    });
    const { id } = await t.mutation(internal.sources.createScoutedSource, {
      url: "https://example.org/excerpt",
      query: "q",
      rationale: "r",
      agentRunId,
      rawText: article,
      contentProvider: "crawl4ai",
    });
    await t.run((ctx) =>
      ctx.db.patch(id, {
        status: "review_needed",
        blockedReason: "no_text",
        blockedDetails: "Captured text is a 40-word feed excerpt",
      }),
    );
    await asOperator.mutation(api.sources.resetScoutCapture, {
      id,
      reason: "Recapture the full text",
    });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      status: "ingested",
      blockedReason: "no_text",
      blockedDetails: "Recapture the full text",
    });

    // Extraction errors are not capture problems and stay refused.
    await t.run((ctx) =>
      ctx.db.patch(id, { status: "review_needed", blockedReason: "ai_error" }),
    );
    await expect(
      asOperator.mutation(api.sources.resetScoutCapture, { id, reason: "x" }),
    ).rejects.toThrow("Only an unextracted Source Scout capture");
  });

  test("refuses to reset unauthenticated, non-scout, or extracted Sources", async () => {
    const t = convexTest(schema, modules);
    const agentRunId = await seedAgentRun(t);
    const asOperator = t.withIdentity({
      subject: "operator",
      name: "Operator",
    });
    const { id } = await t.mutation(internal.sources.createScoutedSource, {
      url: "https://example.org/extracted",
      query: "q",
      rationale: "r",
      agentRunId,
      rawText: article,
      contentProvider: "crawl4ai",
    });
    await expect(
      t.mutation(api.sources.resetScoutCapture, { id, reason: "x" }),
    ).rejects.toThrow();

    const urlOnly = await t.mutation(internal.sources.createScoutedSource, {
      url: "https://example.org/url-only",
      query: "q",
      rationale: "r",
      agentRunId,
    });
    await expect(
      asOperator.mutation(api.sources.resetScoutCapture, {
        id: urlOnly.id,
        reason: "x",
      }),
    ).rejects.toThrow("Only an unextracted Source Scout capture");

    await t.run((ctx) =>
      ctx.db.insert("extractions", {
        sourceId: id,
        model: "test-model",
        promptVersion: "test",
        inputHash: "test-input",
        summary: "Summary",
        claims: [],
        compositionParameters: [],
        topics: [],
        openQuestions: [],
        confidence: 1,
        createdBy: "system",
        createdAt: 1,
      }),
    );
    await expect(
      asOperator.mutation(api.sources.resetScoutCapture, { id, reason: "x" }),
    ).rejects.toThrow("already has an Extraction");
  });
});
