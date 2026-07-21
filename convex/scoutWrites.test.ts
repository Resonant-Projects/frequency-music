import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { internal } from "./_generated/api";
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
