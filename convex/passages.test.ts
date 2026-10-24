import { MockEmbeddingModelV4 } from "ai/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import {
  PASSAGE_EMBEDDING_DIMENSIONS,
  PASSAGE_EMBEDDING_MODEL,
  type PassageSearchResult,
} from "./shared/passages";

// A deterministic bag-of-words embedder stands in for OpenAI: no network,
// and texts sharing words land near each other.
const embedder = vi.hoisted(() => ({
  texts: [] as string[],
  fail: false,
  // Fail every embedding call after this many have succeeded.
  failAfterCalls: Number.POSITIVE_INFINITY,
  calls: 0,
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: {
    embedding: (modelId: string) =>
      new MockEmbeddingModelV4({
        provider: "openai.embedding",
        modelId,
        maxEmbeddingsPerCall: 2048,
        doEmbed: async ({ values }) => {
          if (embedder.fail || embedder.calls >= embedder.failAfterCalls)
            throw new Error("embedding provider unavailable");
          // Bytes bound tokens from above; reject what the provider could.
          if (
            values.some(
              (value) => new TextEncoder().encode(value).length > 8192,
            )
          )
            throw new Error("embedding input exceeds the token limit");
          embedder.calls++;
          embedder.texts.push(...values);
          return {
            embeddings: values.map(embed),
            usage: { tokens: values.join(" ").length },
            warnings: [],
          };
        },
      }),
  },
}));

function embed(text: string): number[] {
  const vector = Array.from({ length: PASSAGE_EMBEDDING_DIMENSIONS }, () => 0);
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    let hash = 0;
    for (const char of word) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    const index = hash % PASSAGE_EMBEDDING_DIMENSIONS;
    vector[index] = (vector[index] ?? 0) + 1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => value / norm);
}

// @convex-dev/rag/test ships as TypeScript source, which the root typecheck
// would otherwise compile under this repo's stricter settings. Load it at
// runtime only; vitest still transforms its import.meta.glob.
const RAG_TEST_MODULE = "@convex-dev/rag/test";
const { register: registerRag } = (await import(
  /* @vite-ignore */ RAG_TEST_MODULE
)) as { register: (t: ReturnType<typeof convexTest>) => void };

const BYPASS = "local-passage-test-bypass";
const AGENT_SECRET = "local-passage-test-secret";

// Each paragraph exceeds half the default chunker's 1,000-character soft
// limit, so every paragraph becomes its own chunk.
const paragraph = (topic: string, n: number) =>
  `${topic} marker${"x".repeat(n)}. ` +
  `This passage discusses ${topic} in enough detail to stand alone as one chunk of prose for retrieval testing purposes. `.repeat(
    5,
  );

const cymatics = [1, 2, 3].map((n) => paragraph("cymatics", n)).join("\n\n");
const tuning = [1, 2, 3].map((n) => paragraph("tuning", n)).join("\n\n");

afterEach(() => {
  embedder.texts = [];
  embedder.fail = false;
  embedder.failAfterCalls = Number.POSITIVE_INFINITY;
  embedder.calls = 0;
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function setup() {
  vi.stubEnv("AUTH_BYPASS_ENABLED", "true");
  vi.stubEnv("AUTH_BYPASS_SECRET", BYPASS);
  vi.stubEnv("AGENT_TOOL_SECRET", AGENT_SECRET);
  const t = convexTest(schema, modules);
  registerRag(t);
  return t;
}

type T = ReturnType<typeof setup>;

const enable = (t: T, enabled = true) =>
  t.mutation(internal.passages.setIndexingEnabled, { enabled });

const insertSource = (t: T, key: string, extra: Record<string, unknown> = {}) =>
  t.run((ctx) =>
    ctx.db.insert("sources", {
      type: "url",
      title: `Source ${key}`,
      canonicalUrl: `https://example.org/${key}`,
      status: "text_ready",
      dedupeKey: `url:${key}`,
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
      ...extra,
    }),
  );

const scheduledIndexing = (t: T) =>
  t.run(async (ctx) =>
    (await ctx.db.system.query("_scheduled_functions").collect())
      .filter((job) => job.name.startsWith("passages:"))
      .map((job) => ({ name: job.name, args: job.args[0] })),
  );

const entryKeys = (t: T, sourceId: Id<"sources">) =>
  t.run(async (ctx) => {
    const namespace = await ctx.runQuery(components.rag.namespaces.get, {
      namespace: "sources",
      modelId: PASSAGE_EMBEDDING_MODEL,
      dimension: PASSAGE_EMBEDDING_DIMENSIONS,
      filterNames: ["type"],
    });
    if (!namespace) return [];
    const page = await ctx.runQuery(components.rag.entries.list, {
      namespaceId: namespace.namespaceId,
      status: "ready",
      order: "asc",
      paginationOpts: { cursor: null, numItems: 50 },
    });
    return page.page
      .filter((entry) => entry.key === sourceId)
      .map((entry) => entry.contentHash);
  });

async function indexedCorpus(t: T) {
  await enable(t);
  const article = await insertSource(t, "article", { rawText: cymatics });
  const video = await insertSource(t, "video", {
    type: "youtube",
    transcript: cymatics.replaceAll("prose", "speech"),
  });
  const other = await insertSource(t, "other", { rawText: tuning });
  for (const sourceId of [article, video, other])
    await t.action(internal.passages.indexSource, { sourceId });
  return { article, video, other };
}

// The agent-tool action's args are derived from the shared zod schema at
// runtime, so its static type only names the transport secret.
const searchTool = (t: T, args: Record<string, unknown>) =>
  t.action(api.agentTools.searchSourcePassages, {
    agentSecret: AGENT_SECRET,
    ...args,
  } as never) as Promise<PassageSearchResult<Id<"sources">>>;

describe("passage indexing hooks", () => {
  test("text writes schedule indexing instead of indexing inline", async () => {
    const t = setup();
    const created = await t.mutation(api.sources.create, {
      type: "url",
      canonicalUrl: "https://example.org/created",
      rawText: cymatics,
      dedupeKey: "url:created",
      devBypassSecret: BYPASS,
    });
    const empty = await t.mutation(api.sources.create, {
      type: "url",
      canonicalUrl: "https://example.org/empty",
      dedupeKey: "url:empty",
      devBypassSecret: BYPASS,
    });
    await t.mutation(api.sources.updateText, {
      id: empty.id,
      rawText: tuning,
      devBypassSecret: BYPASS,
    });
    expect(embedder.texts).toEqual([]);
    expect(await scheduledIndexing(t)).toEqual([
      { name: "passages:indexSource", args: { sourceId: created.id } },
      { name: "passages:indexSource", args: { sourceId: empty.id } },
    ]);
  });

  test("an indexing failure never fails or rolls back the source write", async () => {
    vi.useFakeTimers();
    const t = setup();
    await enable(t);
    embedder.fail = true;
    const created = await t.mutation(api.sources.create, {
      type: "url",
      canonicalUrl: "https://example.org/fails",
      rawText: cymatics,
      dedupeKey: "url:fails",
      devBypassSecret: BYPASS,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const source = await t.run((ctx) => ctx.db.get(created.id));
    expect(source?.rawText).toBe(cymatics);
    expect(source?.status).toBe("text_ready");
    expect(
      await t.action(internal.passages.indexSource, { sourceId: created.id }),
    ).toBe("failed");
  });

  test("hard delete schedules removal of the source's passages", async () => {
    const t = setup();
    const id = await insertSource(t, "deleted", { rawText: cymatics });
    await t.mutation(api.sources.deleteById, {
      id,
      devBypassSecret: BYPASS,
    });
    expect(await scheduledIndexing(t)).toEqual([
      { name: "passages:removeSource", args: { sourceId: id } },
    ]);
  });
});

describe("indexSource", () => {
  test("does nothing paid while indexing is disabled", async () => {
    const t = setup();
    const id = await insertSource(t, "gated", { rawText: cymatics });
    expect(
      await t.action(internal.passages.indexSource, { sourceId: id }),
    ).toBe("disabled");
    expect(embedder.texts).toEqual([]);
  });

  test("indexes once, skips unchanged text without embedding, and replaces changed text", async () => {
    const t = setup();
    await enable(t);
    const id = await insertSource(t, "cycle", { rawText: cymatics });
    expect(
      await t.action(internal.passages.indexSource, { sourceId: id }),
    ).toBe("indexed");
    expect(embedder.texts.length).toBe(3);
    const [firstHash] = await entryKeys(t, id);

    expect(
      await t.action(internal.passages.indexSource, { sourceId: id }),
    ).toBe("unchanged");
    expect(embedder.texts.length).toBe(3);

    await t.run((ctx) => ctx.db.patch(id, { rawText: tuning }));
    expect(
      await t.action(internal.passages.indexSource, { sourceId: id }),
    ).toBe("indexed");
    const hashes = await entryKeys(t, id);
    expect(hashes).toHaveLength(1);
    expect(hashes[0]).not.toBe(firstHash);
  });

  test("cleared or deleted text removes entries even with indexing disabled", async () => {
    const t = setup();
    await enable(t);
    const id = await insertSource(t, "cleared", { rawText: cymatics });
    await t.action(internal.passages.indexSource, { sourceId: id });
    expect(await entryKeys(t, id)).toHaveLength(1);
    await enable(t, false);
    await t.run((ctx) => ctx.db.patch(id, { rawText: undefined }));
    expect(
      await t.action(internal.passages.indexSource, { sourceId: id }),
    ).toBe("removed");
    expect(await entryKeys(t, id)).toHaveLength(0);
  });

  test("a first index that fails after one batch leaves no searchable passages", async () => {
    const t = setup();
    await enable(t);
    // Over 100 chunks forces batched insertion; the second batch fails.
    const long = Array.from({ length: 120 }, (_, n) =>
      paragraph("resonance", n + 1),
    ).join("\n\n");
    const id = await insertSource(t, "partial", { rawText: long });
    embedder.failAfterCalls = 1;
    expect(
      await t.action(internal.passages.indexSource, { sourceId: id }),
    ).toBe("failed");
    embedder.failAfterCalls = Number.POSITIVE_INFINITY;
    const result = await t.action(internal.passages.searchForAgent, {
      query: "resonance",
    });
    expect(result.passages).toEqual([]);
    const pending = await t.run(async (ctx) => {
      const namespace = await ctx.runQuery(components.rag.namespaces.get, {
        namespace: "sources",
        modelId: PASSAGE_EMBEDDING_MODEL,
        dimension: PASSAGE_EMBEDDING_DIMENSIONS,
        filterNames: ["type"],
      });
      return namespace
        ? (
            await ctx.runQuery(components.rag.entries.list, {
              namespaceId: namespace.namespaceId,
              status: "pending",
              order: "asc",
              paginationOpts: { cursor: null, numItems: 50 },
            })
          ).page
        : [];
    });
    expect(pending).toEqual([]);
  });

  test("indexes a long single-line CJK transcript within the input limit", async () => {
    const t = setup();
    await enable(t);
    const id = await insertSource(t, "cjk", {
      type: "youtube",
      transcript: "共鸣".repeat(5000),
    });
    expect(
      await t.action(internal.passages.indexSource, { sourceId: id }),
    ).toBe("indexed");
    expect(embedder.texts.join("")).toBe("共鸣".repeat(5000));
  });

  test("indexes a long line whose chunk split falls inside an emoji", async () => {
    const t = setup();
    await enable(t);
    const id = await insertSource(t, "emoji", {
      transcript: `${"a".repeat(5999)}🎵${"b".repeat(5999)}`,
    });
    expect(
      await t.action(internal.passages.indexSource, { sourceId: id }),
    ).toBe("indexed");
    expect(embedder.texts.every((text) => text.isWellFormed())).toBe(true);
  });

  test("removeSource drops a hard-deleted source's entries", async () => {
    const t = setup();
    await enable(t);
    const id = await insertSource(t, "removed", { rawText: cymatics });
    await t.action(internal.passages.indexSource, { sourceId: id });
    await t.run((ctx) => ctx.db.delete(id));
    await t.action(internal.passages.removeSource, { sourceId: id });
    expect(await entryKeys(t, id)).toHaveLength(0);
  });
});

describe("searchSourcePassages", () => {
  test("retrieves a phrase-specific transcript despite stronger broad vector matches", async () => {
    const t = setup();
    await enable(t);
    const phrase = "432 Hz precise temperament tuning";
    const specific = await insertSource(t, "precise-transcript", {
      type: "youtube",
      transcript: `${"spoken introduction ".repeat(250)}${phrase}.`,
    });
    await t.action(internal.passages.indexSource, { sourceId: specific });
    const article = await insertSource(t, "precise-article", {
      rawText: Array.from(
        { length: 14 },
        () =>
          `${phrase}. Compare the 432 Hz tuning ratios. ${"tuning ".repeat(100)}`,
      ).join("\n\n"),
    });
    await t.action(internal.passages.indexSource, { sourceId: article });
    // These passages dominate the simple vector model on the word "tuning",
    // but do not answer the phrase-specific query.
    for (let n = 0; n < 14; n++) {
      const sourceId = await insertSource(t, `broad-tuning-${n}`, {
        type: "youtube",
        transcript: `${"tuning ".repeat(100)}general discussion ${n}.`,
      });
      await t.action(internal.passages.indexSource, { sourceId });
    }
    const result = await searchTool(t, {
      query: phrase,
      limit: 8,
      types: ["youtube"],
    });
    expect(
      result.passages.some((passage) => passage.sourceId === specific),
    ).toBe(true);
    expect(
      result.passages.find((passage) => passage.sourceId === specific)?.text,
    ).toContain(phrase);
    expect(
      result.passages.reduce((sum, passage) => sum + passage.text.length, 0),
    ).toBeLessThanOrEqual(12_000);
    const beforeMixedQuery = embedder.calls;
    const mixed = await searchTool(t, { query: phrase, limit: 8 });
    expect(embedder.calls - beforeMixedQuery).toBe(1);
    const mixedSources = new Set(
      mixed.passages.map((passage) => passage.sourceId),
    );
    expect(mixedSources.has(article)).toBe(true);
    expect(mixedSources.has(specific)).toBe(true);
  });

  test("returns verbatim passages with live provenance through the agent tool", async () => {
    const t = setup();
    const { article } = await indexedCorpus(t);
    await t.run((ctx) => ctx.db.patch(article, { status: "extracted" }));
    const result = await searchTool(t, {
      query: "cymatics markerxx",
      limit: 3,
    });
    expect(result.passages.length).toBe(3);
    expect(result.truncated).toBe(false);
    const hit = result.passages.find((passage) => passage.sourceId === article);
    expect(hit).toMatchObject({
      title: "Source article",
      canonicalUrl: "https://example.org/article",
      status: "extracted",
    });
    expect(cymatics).toContain(hit?.text.split("\n")[0] ?? "missing");
  });

  test("excludes archived sources after search and filters by type", async () => {
    const t = setup();
    const { article, video } = await indexedCorpus(t);
    await t.run((ctx) => ctx.db.patch(article, { status: "archived" }));
    const result = await searchTool(t, { query: "cymatics", limit: 8 });
    const ids = new Set(result.passages.map((passage) => passage.sourceId));
    expect(ids.has(article)).toBe(false);
    expect(ids.has(video)).toBe(true);

    const videos = await searchTool(t, {
      query: "cymatics",
      types: ["youtube"],
    });
    expect(videos.passages.every((passage) => passage.sourceId === video)).toBe(
      true,
    );
  });

  test("clamps the limit and attaches one neighbouring chunk either side", async () => {
    const t = setup();
    await indexedCorpus(t);
    const result = await searchTool(t, {
      query: "markerxx",
      limit: 1,
      types: ["url"],
    });
    expect(result.passages).toHaveLength(1);
    // The middle chunk of three carries both neighbours.
    expect(result.passages[0]).toMatchObject({ order: 1 });
    for (const marker of ["markerx.", "markerxx.", "markerxxx."])
      expect(result.passages[0]?.text).toContain(marker);
    // Out-of-range limits reach the clamp through the agent tool.
    const many = await searchTool(t, { query: "passage", limit: 500 });
    expect(many.passages.length).toBeLessThanOrEqual(8);
    expect(many.passages.length).toBeGreaterThan(5);
    const one = await searchTool(t, { query: "passage", limit: 0 });
    expect(one.passages).toHaveLength(1);
  });

  test("an empty index answers without a paid query embedding", async () => {
    const t = setup();
    expect(
      await t.action(internal.passages.searchForAgent, { query: "anything" }),
    ).toEqual({ passages: [], truncated: false, omitted: 0 });
    expect(embedder.texts).toEqual([]);
  });

  test("the agent tool rejects a wrong secret", async () => {
    const t = setup();
    await expect(
      t.action(api.agentTools.searchSourcePassages, {
        agentSecret: "wrong",
        query: "cymatics",
      } as never),
    ).rejects.toThrow();
  });
});

describe("sweep and backfill", () => {
  test("the sweep is inert while disabled and indexes only stale sources when enabled", async () => {
    vi.useFakeTimers();
    const t = setup();
    const id = await insertSource(t, "swept", { rawText: cymatics });
    await insertSource(t, "textless", { status: "ingested" });
    await t.action(internal.passages.sweep, {});
    expect(embedder.texts).toEqual([]);

    await enable(t);
    await t.action(internal.passages.sweep, {});
    expect(await entryKeys(t, id)).toHaveLength(1);
    const embedded = embedder.texts.length;
    await t.action(internal.passages.sweep, {});
    expect(embedder.texts.length).toBe(embedded);
  });

  test("the backfill dry run reports pending work and apply requires the gate", async () => {
    const t = setup();
    await insertSource(t, "one", { rawText: cymatics });
    await insertSource(t, "two", { transcript: tuning, type: "youtube" });
    await insertSource(t, "none", { status: "ingested" });
    const dry = await t.action(api.passages.backfillBatch, {
      cursor: null,
      apply: false,
      devBypassSecret: BYPASS,
    });
    expect(dry).toMatchObject({
      enabled: false,
      scanned: 3,
      textBearing: 2,
      pending: 2,
      pendingChars: cymatics.length + tuning.length,
      indexed: 0,
      isDone: true,
    });
    expect(embedder.texts).toEqual([]);
    await expect(
      t.action(api.passages.backfillBatch, {
        cursor: null,
        apply: true,
        devBypassSecret: BYPASS,
      }),
    ).rejects.toThrow(/disabled/);

    await enable(t);
    const applied = await t.action(api.passages.backfillBatch, {
      cursor: null,
      apply: true,
      devBypassSecret: BYPASS,
    });
    expect(applied).toMatchObject({ pending: 2, indexed: 2, failed: 0 });
    const converged = await t.action(api.passages.backfillBatch, {
      cursor: null,
      apply: false,
      devBypassSecret: BYPASS,
    });
    expect(converged.pending).toBe(0);
  });
});
