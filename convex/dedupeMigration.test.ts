import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import { keepsDedupeKey } from "./sources";
import { EXTRACTION_PROMPT_VERSION } from "./shared/extractionPrompt";
import { modules } from "../harness/modules";
import { publisherDois } from "../harness/fixtures/publisherDois";
import { normalizeUrl } from "./sourceUtils";

const arxivRow = (overrides: {
  dedupeKey: string;
  rssGuid: string;
  status: Doc<"sources">["status"];
  createdAt: number;
  feedUrl?: string;
}) => ({
  type: "rss" as const,
  feedUrl: "https://arxiv.org/rss/cs.SD",
  canonicalUrl: "https://arxiv.org/abs/2603.27528",
  rawText:
    "Abstract: results of the 2025 Automatic Music Transcription Challenge.",
  visibility: "private" as const,
  createdBy: "system" as const,
  updatedAt: 1,
  ...overrides,
});

describe("dedupe key migration", () => {
  test.each(publisherDois)(
    "rekeys legacy $url rows before preflight/intake resume",
    async ({ url, doi }) => {
      const t = convexTest(schema, modules);
      const operator = t.withIdentity({ subject: "operator" });
      const legacyKey = `url:${normalizeUrl(url)}`;
      const canonicalKey = `doi:${doi.toLowerCase()}`;
      const row = {
        type: url.endsWith(".pdf") ? ("pdf" as const) : ("url" as const),
        canonicalUrl: url,
        dedupeKey: legacyKey,
        rawText: "Existing captured article text.",
        status: "text_ready" as const,
        visibility: "private" as const,
        createdBy: "system" as const,
        createdAt: 1,
        updatedAt: 1,
      };
      const id = await t.run((ctx) => ctx.db.insert("sources", row));
      const before = await t.run((ctx) => ctx.db.get(id));
      const dry = await operator.mutation(api.sources.recomputeDedupeKeys, {
        cursor: null,
        apply: false,
      });
      expect(dry).toMatchObject({
        changed: 0,
        collisionsArchived: 0,
        planned: [
          { id, from: legacyKey, to: canonicalKey, collidesWith: null },
        ],
      });
      expect(await t.run((ctx) => ctx.db.get(id))).toEqual(before);

      await operator.mutation(api.sources.recomputeDedupeKeys, {
        cursor: null,
        apply: true,
      });
      expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
        ...row,
        dedupeKey: canonicalKey,
        updatedAt: expect.any(Number),
      });
      const urls = [url, `https://doi.org/${doi.toUpperCase()}`];
      expect(
        await t.query(internal.sources.existingScoutedUrls, { urls }),
      ).toEqual(urls.map((url) => ({ url, needsText: false })));
      const agentRunId = await t.run((ctx) =>
        ctx.db.insert("agentRuns", {
          graphName: "source-scout",
          status: "running",
          input: null,
          createdAt: 1,
          updatedAt: 1,
        }),
      );
      expect(
        await t.mutation(internal.sources.createScoutedSource, {
          url: urls[1]!,
          query: "music acoustics",
          rationale: "Existing work",
          agentRunId,
        }),
      ).toEqual({ id, created: false });
      expect(
        await t.run((ctx) => ctx.db.query("sources").collect()),
      ).toHaveLength(1);
      expect(
        await operator.mutation(api.sources.recomputeDedupeKeys, {
          cursor: null,
          apply: false,
        }),
      ).toMatchObject({ planned: [] });
    },
  );

  test.each([true, false])(
    "keeps captured publisher text on a DOI collision (publisher first: %s)",
    async (publisherFirst) => {
      const t = convexTest(schema, modules);
      const operator = t.withIdentity({ subject: "operator" });
      const canonicalUrl = "https://www.nature.com/articles/nature18635";
      const key = "doi:10.1038/nature18635";
      const base = {
        type: "url" as const,
        visibility: "private" as const,
        createdBy: "system" as const,
        updatedAt: 1,
      };
      const publisher = {
        ...base,
        canonicalUrl,
        dedupeKey: `url:${normalizeUrl(canonicalUrl)}`,
        rawText: "Captured publisher text",
        status: "text_ready" as const,
        createdAt: 2,
      };
      const registry = {
        ...base,
        canonicalUrl: "https://doi.org/10.1038/nature18635",
        dedupeKey: key,
        status: "ingested" as const,
        createdAt: 1,
      };
      const [first, second] = await t.run(async (ctx) => [
        await ctx.db.insert("sources", publisherFirst ? publisher : registry),
        await ctx.db.insert("sources", publisherFirst ? registry : publisher),
      ]);
      const [winner, loser] = publisherFirst
        ? [first, second]
        : [second, first];
      const before = await t.run((ctx) => ctx.db.query("sources").collect());
      const dry = await operator.mutation(api.sources.recomputeDedupeKeys, {
        cursor: null,
        apply: false,
      });
      expect(dry.planned).toEqual([
        { id: winner, from: publisher.dedupeKey, to: key, collidesWith: loser },
      ]);
      expect(await t.run((ctx) => ctx.db.query("sources").collect())).toEqual(
        before,
      );
      // Exercise the operator script's paginated apply across row orderings.
      let cursor: string | null = null;
      let isDone = false;
      while (!isDone) {
        const result: { continueCursor: string; isDone: boolean } =
          await operator.mutation(api.sources.recomputeDedupeKeys, {
            cursor,
            batchSize: 1,
            apply: true,
          });
        cursor = result.continueCursor;
        isDone = result.isDone;
      }
      expect(await t.run((ctx) => ctx.db.get(winner))).toMatchObject({
        ...publisher,
        dedupeKey: key,
        updatedAt: expect.any(Number),
      });
      expect(await t.run((ctx) => ctx.db.get(loser))).toMatchObject({
        status: "archived",
        blockedReason: "duplicate",
        blockedDetails: `dedupe-migration: duplicate of ${winner}`,
      });
      expect(
        await t.query(internal.sources.existingScoutedUrls, {
          urls: [registry.canonicalUrl],
        }),
      ).toEqual([{ url: registry.canonicalUrl, needsText: false }]);
      expect(
        await operator.mutation(api.sources.recomputeDedupeKeys, {
          cursor: null,
          apply: true,
        }),
      ).toMatchObject({ changed: 0, collisionsArchived: 0, planned: [] });
    },
  );

  test("keeps extraction work, then text, then status, then age", () => {
    const row = (
      status: string,
      createdAt: number,
      extra: Partial<Parameters<typeof keepsDedupeKey>[0]> = {},
    ) =>
      ({
        status,
        createdAt,
        hasExtraction: status === "extracted",
        hasText: status !== "ingested",
        ...extra,
      }) as Parameters<typeof keepsDedupeKey>[0];
    expect(keepsDedupeKey(row("extracted", 2), row("text_ready", 1))).toBe(
      true,
    );
    expect(keepsDedupeKey(row("text_ready", 1), row("extracted", 2))).toBe(
      false,
    );
    expect(keepsDedupeKey(row("text_ready", 1), row("text_ready", 2))).toBe(
      true,
    );
    expect(keepsDedupeKey(row("text_ready", 2), row("text_ready", 1))).toBe(
      false,
    );
    // A promoted Source without an Extraction loses to one with an Extraction.
    expect(
      keepsDedupeKey(
        row("promoted_public", 1, { hasExtraction: false }),
        row("extracted", 2),
      ),
    ).toBe(false);
    // A failed Extraction does not outrank queued text.
    expect(
      keepsDedupeKey(
        row("review_needed", 1, { blockedReason: "ai_error" }),
        row("text_ready", 2),
      ),
    ).toBe(true);
    expect(
      keepsDedupeKey(
        row("review_needed", 1, { blockedReason: "no_text", hasText: false }),
        row("text_ready", 2),
      ),
    ).toBe(false);
  });

  test("merges a re-announced arXiv paper into its extracted copy", async () => {
    const t = convexTest(schema, modules);
    const asOperator = t.withIdentity({
      subject: "operator",
      name: "Operator",
    });
    const { older, newer } = await t.run(async (ctx) => ({
      older: await ctx.db.insert(
        "sources",
        arxivRow({
          dedupeKey:
            "rss:https://arxiv.org/rss/cs.SD:oai:arXiv.org:2603.27528v1",
          rssGuid: "oai:arXiv.org:2603.27528v1",
          status: "text_ready",
          createdAt: 1,
        }),
      ),
      newer: await ctx.db.insert(
        "sources",
        arxivRow({
          dedupeKey:
            "rss:https://arxiv.org/rss/eess.AS:oai:arXiv.org:2603.27528v2",
          feedUrl: "https://arxiv.org/rss/eess.AS",
          rssGuid: "oai:arXiv.org:2603.27528v2",
          status: "extracted",
          createdAt: 2,
        }),
      ),
    }));
    await t.run((ctx) =>
      ctx.db.insert("extractions", {
        sourceId: newer,
        model: "test-model",
        promptVersion: "extract_v2",
        inputHash: "newer-input",
        summary: "Summary",
        claims: [],
        compositionParameters: [],
        topics: [],
        openQuestions: [],
        confidence: 1,
        createdBy: "system",
        createdAt: 2,
      }),
    );

    const dry = await asOperator.mutation(api.sources.recomputeDedupeKeys, {
      cursor: null,
      apply: false,
    });
    expect(dry.changed).toBe(0);
    expect(dry.planned.map((p) => p.to)).toEqual([
      "arxiv:2603.27528",
      "arxiv:2603.27528",
    ]);

    await asOperator.mutation(api.sources.recomputeDedupeKeys, {
      cursor: null,
      apply: true,
    });
    const [kept, archived] = await t.run(async (ctx) => [
      await ctx.db.get(newer),
      await ctx.db.get(older),
    ]);
    expect(kept).toMatchObject({
      status: "extracted",
      dedupeKey: "arxiv:2603.27528",
    });
    expect(archived).toMatchObject({
      status: "archived",
      blockedReason: "duplicate",
      blockedDetails: `dedupe-migration: duplicate of ${newer}`,
    });
  });
});

describe("dedupe key migration with archived rows", () => {
  test("never archives a live row in favour of an archived one", async () => {
    const t = convexTest(schema, modules);
    const asOperator = t.withIdentity({
      subject: "operator",
      name: "Operator",
    });
    const { live, archived } = await t.run(async (ctx) => {
      const archived = await ctx.db.insert(
        "sources",
        arxivRow({
          dedupeKey: "arxiv:2603.27528",
          rssGuid: "oai:arXiv.org:2603.27528v1",
          status: "archived",
          createdAt: 1,
        }),
      );
      await ctx.db.insert("extractions", {
        sourceId: archived,
        model: "test-model",
        promptVersion: "extract_v2",
        inputHash: "archived-input",
        summary: "Summary",
        claims: [],
        compositionParameters: [],
        topics: [],
        openQuestions: [],
        confidence: 1,
        createdBy: "system",
        createdAt: 1,
      });
      const live = await ctx.db.insert(
        "sources",
        arxivRow({
          dedupeKey:
            "rss:https://arxiv.org/rss/cs.SD:oai:arXiv.org:2603.27528v2",
          rssGuid: "oai:arXiv.org:2603.27528v2",
          status: "text_ready",
          createdAt: 2,
        }),
      );
      return { live, archived };
    });
    await asOperator.mutation(api.sources.recomputeDedupeKeys, {
      cursor: null,
      apply: true,
    });
    expect(await t.run((ctx) => ctx.db.get(live))).toMatchObject({
      status: "text_ready",
      dedupeKey: "arxiv:2603.27528",
    });
    expect(await t.run((ctx) => ctx.db.get(archived))).toMatchObject({
      status: "archived",
    });
  });
});

describe("duplicate Extraction text", () => {
  const sha256 = async (text: string) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
      ),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  test("archives a Source whose text another Source already extracted", async () => {
    const t = convexTest(schema, modules);
    const asOperator = t.withIdentity({
      subject: "operator",
      name: "Operator",
    });
    const text =
      "Abstract: This paper presents the results of the 2025 Automatic Music Transcription Challenge, an online competition to benchmark progress in multi-instrument transcription. Eight teams submitted systems, and the best ones improved note-level F1 on unseen recordings by a wide margin.";
    const inputHash = await sha256(`${text}${EXTRACTION_PROMPT_VERSION}`);
    const { copy, holder, extraction } = await t.run(async (ctx) => {
      const holder = await ctx.db.insert(
        "sources",
        arxivRow({
          dedupeKey: "arxiv:2603.27528",
          rssGuid: "oai:arXiv.org:2603.27528v1",
          status: "extracted",
          createdAt: 1,
        }),
      );
      const copy = await ctx.db.insert("sources", {
        ...arxivRow({
          dedupeKey: "rss:https://arxiv.org/rss/eess.AS:x",
          rssGuid: "x",
          status: "text_ready",
          createdAt: 2,
        }),
        rawText: text,
      });
      const extraction = await ctx.db.insert("extractions", {
        sourceId: holder,
        model: "test-model",
        promptVersion: EXTRACTION_PROMPT_VERSION,
        inputHash,
        summary: "Summary",
        claims: [],
        compositionParameters: [],
        topics: [],
        openQuestions: [],
        confidence: 1,
        createdBy: "system",
        createdAt: 1,
      });
      return { copy, holder, extraction };
    });

    // No model is configured in tests: reaching it would throw.
    await expect(
      asOperator.action(api.extract.extractSource, { sourceId: copy }),
    ).resolves.toEqual({ skipped: true, reason: "duplicate extraction" });
    expect(await t.run((ctx) => ctx.db.get(copy))).toMatchObject({
      status: "archived",
      blockedReason: "duplicate",
      blockedDetails: `Same text as source ${holder} (extraction ${extraction})`,
    });
  });
});
