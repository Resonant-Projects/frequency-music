import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MODELS } from "./llm";
import schema from "./schema";
import {
  EXTRACT_USER_PROMPT,
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

const operator = {
  subject: "operator-claude-session",
  name: "Claude (operator session)",
};

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
  t.withIdentity(operator).action(api.extract.storeOperatorExtraction, {
    sourceId,
    model: MODELS.opus,
    inputHash,
    extraction,
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

  test("requires an authenticated caller", async () => {
    const { t, sourceId, inputHash } = await setup();
    await expect(
      t.action(api.extract.storeOperatorExtraction, {
        sourceId,
        model: MODELS.opus,
        inputHash,
        extraction,
      }),
    ).rejects.toThrow();
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
  });

  test("hashes the text with the prompt version", async () => {
    expect(await extractionInputHash("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(await extractionInputHash("abc")).not.toBe(
      await extractionInputHash("abd"),
    );
  });
});
