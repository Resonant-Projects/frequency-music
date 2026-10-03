import { convexTest } from "convex-test";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MODELS } from "./llm";
import schema from "./schema";
import {
  EXTRACT_USER_PROMPT,
  extractionContent,
  extractionInputHash,
  renderExtractionPrompt,
} from "./shared/extractionPrompt";
import { modules } from "../harness/modules";

const article =
  "Pythagorean tuning stacks pure fifths with a frequency ratio of 3:2. " +
  "Twelve such fifths overshoot seven octaves by the Pythagorean comma, about 23.46 cents, " +
  "which is why keyboard temperaments distribute the comma across several fifths. ";

const extraction = {
  summary: "Explains Pythagorean tuning and the comma.",
  claims: [
    {
      text: "Twelve pure fifths exceed seven octaves by about 23.46 cents.",
      evidenceLevel: "peer_reviewed" as const,
      truthConfidence: "high" as const,
      interestLevel: "medium" as const,
      citations: [{ quote: "about 23.46 cents" }],
    },
  ],
  compositionParameters: [
    { kind: "tuningSystem", value: "Pythagorean" },
    { kind: "interval", value: "3:2", details: { ratio: 1.5 } },
    { kind: "", value: "dropped: no kind" },
  ],
  topics: ["tuning", "Pythagorean comma"],
  openQuestions: ["How do well temperaments spread the comma?"],
};

const BYPASS = "operator-secret";
beforeEach(() => {
  vi.stubEnv("AUTH_BYPASS_ENABLED", "true");
  vi.stubEnv("AUTH_BYPASS_SECRET", BYPASS);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function setup(rawText = article.repeat(2), status = "text_ready") {
  const t = convexTest(schema, modules);
  const sourceId = await t.run((ctx) =>
    ctx.db.insert("sources", {
      type: "url",
      canonicalUrl: "https://example.org/pythagorean",
      dedupeKey: "url:example.org/pythagorean",
      title: "Pythagorean tuning",
      rawText,
      status: status as "text_ready",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  return { t, sourceId, inputHash: await extractionInputHash(rawText) };
}

const store = (
  t: ReturnType<typeof convexTest>,
  sourceId: Id<"sources">,
  inputHash: string,
  overrides: Record<string, unknown> = {},
) =>
  t.action(api.extract.storeOperatorExtraction, {
    sourceId,
    model: MODELS.opus,
    inputHash,
    extraction,
    devBypassSecret: BYPASS,
    ...overrides,
  });

describe("operator extraction", () => {
  test("stores an operator Extraction and marks the Source extracted", async () => {
    const { t, sourceId, inputHash } = await setup();
    expect(await store(t, sourceId, inputHash)).toEqual({
      success: true,
      model: "anthropic/claude-opus-5.5",
      summary: extraction.summary,
      claimCount: 1,
      parameterCount: 2,
    });
    const { source, stored, claims } = await t.run(async (ctx) => ({
      source: await ctx.db.get("sources", sourceId),
      stored: await ctx.db
        .query("extractions")
        .withIndex("by_sourceId_createdAt", (q) => q.eq("sourceId", sourceId))
        .collect(),
      claims: await ctx.db.query("claims").collect(),
    }));
    expect(source?.status).toBe("extracted");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      model: "anthropic/claude-opus-5.5",
      promptVersion: "extract_v2",
      inputHash,
      topics: ["tuning", "Pythagorean comma"],
    });
    expect(claims.map((claim) => claim.text)).toEqual([
      extraction.claims[0]?.text,
    ]);
  });

  test("refuses stale text, other statuses, and unlisted models", async () => {
    const { t, sourceId } = await setup();
    expect(await store(t, sourceId, "0".repeat(64))).toEqual({
      skipped: true,
      reason: "source text changed since export; export it again",
    });
    await expect(
      store(t, sourceId, await extractionInputHash(article.repeat(2)), {
        model: "openai/gpt-6.1-sol",
      }),
    ).rejects.toThrow("Operator extractions record one of");
    await expect(
      store(t, sourceId, await extractionInputHash(article.repeat(2)), {
        extraction: { ...extraction, summary: "  " },
      }),
    ).rejects.toThrow("needs a summary");
    const extracted = await setup(article.repeat(2), "extracted");
    expect(
      await store(extracted.t, extracted.sourceId, extracted.inputHash),
    ).toEqual({ skipped: true, reason: "source is extracted" });
    // Nothing was stored for the refused calls.
    expect(
      await t.run((ctx) => ctx.db.query("extractions").collect()),
    ).toHaveLength(0);
  });

  test("requires the operator service identity, not a signed-in user", async () => {
    const { t, sourceId, inputHash } = await setup();
    await expect(
      store(t, sourceId, inputHash, { devBypassSecret: undefined }),
    ).rejects.toThrow();
    await expect(
      t
        .withIdentity({ subject: "user_123", name: "Someone" })
        .action(api.extract.storeOperatorExtraction, {
          sourceId,
          model: MODELS.opus,
          inputHash,
          extraction,
        }),
    ).rejects.toThrow("requires the operator bypass secret");
    expect(await t.run((ctx) => ctx.db.get("sources", sourceId))).toMatchObject(
      { status: "text_ready" },
    );
  });

  test("a stale export never parks or archives the Source", async () => {
    // The text became a teaser after export: report stale, change nothing.
    const { t, sourceId } = await setup("Read more at the link.");
    expect(
      await store(t, sourceId, await extractionInputHash(article.repeat(2))),
    ).toEqual({
      skipped: true,
      reason: "source text changed since export; export it again",
    });
    expect(await t.run((ctx) => ctx.db.get("sources", sourceId))).toMatchObject(
      { status: "text_ready" },
    );
  });

  test("parks exported unextractable text without a model, and only that", async () => {
    const short = "Read more at the link.";
    const { t, sourceId, inputHash } = await setup(short);
    const park = (id: Id<"sources">, hash: string) =>
      t.action(api.extract.parkOperatorUnextractable, {
        sourceId: id,
        inputHash: hash,
        devBypassSecret: BYPASS,
      });
    expect(await park(sourceId, "0".repeat(64))).toEqual({
      parked: false,
      reason: "source text changed since export; export it again",
    });
    expect(await park(sourceId, inputHash)).toMatchObject({ parked: true });
    expect(await t.run((ctx) => ctx.db.get("sources", sourceId))).toMatchObject(
      { status: "review_needed", blockedReason: "no_text" },
    );
    const usable = await setup();
    expect(
      await usable.t.action(api.extract.parkOperatorUnextractable, {
        sourceId: usable.sourceId,
        inputHash: usable.inputHash,
        devBypassSecret: BYPASS,
      }),
    ).toEqual({ parked: false, reason: "text is extractable" });
  });

  test("parks unextractable text instead of storing an Extraction", async () => {
    const short = "Read more at the link.";
    const { t, sourceId, inputHash } = await setup(short);
    const outcome = await store(t, sourceId, inputHash);
    expect(outcome).toMatchObject({ skipped: true });
    expect(await t.run((ctx) => ctx.db.get("sources", sourceId))).toMatchObject(
      { status: "review_needed", blockedReason: "no_text" },
    );
  });

  test("archives a Source whose text another Source already extracted", async () => {
    const { t, sourceId, inputHash } = await setup();
    await store(t, sourceId, inputHash);
    const copy = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        canonicalUrl: "https://mirror.example.org/pythagorean",
        dedupeKey: "url:mirror.example.org/pythagorean",
        title: "Pythagorean tuning (mirror)",
        rawText: article.repeat(2),
        status: "text_ready",
        visibility: "private",
        createdBy: "system",
        createdAt: 2,
        updatedAt: 2,
      }),
    );
    expect(await store(t, copy, inputHash)).toEqual({
      skipped: true,
      reason: "duplicate extraction",
    });
    expect(await t.run((ctx) => ctx.db.get("sources", copy))).toMatchObject({
      status: "archived",
      blockedReason: "duplicate",
    });
  });

  test("lists models within the return validator", async () => {
    const t = convexTest(schema, modules);
    expect(await t.action(api.extract.listModels, {})).toMatchObject({
      opus: "anthropic/claude-opus-5.5",
      default: MODELS.default,
    });
  });
});

describe("operator export page", () => {
  test("pages text_ready Sources with full-text hashes and prompt-sized text", async () => {
    const t = convexTest(schema, modules);
    const long = `${article.repeat(400)}TAIL`;
    const insert = (n: number, rawText: string, status = "text_ready") =>
      t.run((ctx) =>
        ctx.db.insert("sources", {
          type: "url",
          canonicalUrl: `https://example.org/${n}`,
          dedupeKey: `url:example.org/${n}`,
          title: `S${n}`,
          rawText,
          status: status as "text_ready",
          visibility: "private",
          createdBy: "system",
          createdAt: n,
          updatedAt: n,
        }),
      );
    for (let n = 1; n <= 21; n++) await insert(n, article.repeat(2));
    const longId = await insert(22, long);
    const teaserId = await insert(23, "Read more at the link.");
    await insert(24, article.repeat(2), "extracted");
    const page = (cursor: string | null) =>
      t.query(api.sources.operatorExtractionPage, {
        cursor,
        devBypassSecret: BYPASS,
      });
    const first = await page(null);
    expect(first.page).toHaveLength(20);
    expect(first.isDone).toBe(false);
    // Newest first: the teaser (23) and the long text (22) lead.
    const [teaser, longRow] = first.page;
    expect(teaser).toMatchObject({
      sourceId: teaserId,
      unextractable: expect.any(String),
    });
    expect(longRow?.sourceId).toBe(longId);
    expect(longRow?.inputHash).toBe(await extractionInputHash(long));
    expect(longRow?.content).toHaveLength(30_000);
    expect(longRow?.unextractable).toBeUndefined();
    const second = await page(first.continueCursor);
    expect(second.page).toHaveLength(3);
    expect(second.isDone).toBe(true);
    // The extracted Source (24) is never exported.
    const ids = [...first.page, ...second.page].map((row) => row.title);
    expect(ids).not.toContain("S24");
  });

  test("is operator-only", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t
        .withIdentity({ subject: "user_123" })
        .query(api.sources.operatorExtractionPage, {}),
    ).rejects.toThrow();
    await expect(
      t.query(api.sources.operatorExtractionPage, {}),
    ).rejects.toThrow();
  });
});

describe("extraction prompt", () => {
  test("renders title, URL and text cut to 30,000 characters, literally", () => {
    const prompt = renderExtractionPrompt({
      title: "Costs $& and $'",
      canonicalUrl: "https://example.org/x",
      content: `${"a".repeat(30_000)}TAIL`,
    });
    expect(prompt).toContain("Title: Costs $& and $'");
    expect(prompt).toContain("URL: https://example.org/x");
    expect(prompt).not.toContain("TAIL");
    expect(
      prompt.startsWith(EXTRACT_USER_PROMPT.split("{{title}}")[0] ?? ""),
    ).toBe(true);
    expect(renderExtractionPrompt({ content: "x" })).toContain(
      "Title: Untitled",
    );
    // A title holding a placeholder is inserted literally, never rescanned.
    const injected = renderExtractionPrompt({
      title: "{{content}} and {{url}}",
      canonicalUrl: "https://example.org/y",
      content: "REAL TEXT",
    });
    expect(injected).toContain("Title: {{content}} and {{url}}");
    expect(injected.match(/REAL TEXT/g)).toHaveLength(1);
  });

  test("never cuts an emoji in half at the 30,000-character limit", () => {
    const text = `${"a".repeat(29_999)}😀tail`;
    expect(extractionContent(text)).toBe("a".repeat(29_999));
    expect(extractionContent("short 😀")).toBe("short 😀");
    expect(renderExtractionPrompt({ content: text }).includes("\uD83D")).toBe(
      false,
    );
  });

  test("hashes the text with the prompt version", async () => {
    expect(await extractionInputHash("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(await extractionInputHash("abc")).not.toBe(
      await extractionInputHash("abd"),
    );
  });
});
