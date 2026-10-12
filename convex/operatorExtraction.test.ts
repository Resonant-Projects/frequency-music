import { convexTest } from "convex-test";
import type { FunctionReturnType } from "convex/server";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MODELS } from "./llm";
import schema from "./schema";
import {
  EXTRACTION_PROMPT_VERSION,
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
  test.each([MODELS.default, MODELS.sonnet])(
    "selected operator model %s survives snapshot export and historical import",
    async (model) => {
      const { t, sourceId, inputHash } = await setup();
      const snapshot = await t.action(api.extract.beginOperatorExtraction, {
        sourceId,
        inputHash,
        model,
        devBypassSecret: BYPASS,
      });
      expect(snapshot).not.toBeNull();
      const exported = await t.query(api.sources.operatorExtractionSnapshots, {
        model,
        limit: 20,
        cursor: null,
        devBypassSecret: BYPASS,
      });
      expect(exported.page).toHaveLength(1);
      expect(exported.page[0]).toMatchObject({
        sourceId,
        snapshotId: snapshot!.snapshotId,
        inputHash,
      });
      await t
        .withIdentity({ subject: "operator" })
        .mutation(api.sources.updateText, {
          id: sourceId,
          rawText: article.repeat(3),
        });
      await expect(
        store(t, sourceId, inputHash, {
          model,
          snapshotId: snapshot!.snapshotId,
        }),
      ).resolves.toMatchObject({ success: true, model, current: false });
      const stored = await t.run((ctx) => ctx.db.query("extractions").first());
      expect(stored).toMatchObject({
        model,
        historical: true,
        snapshotId: snapshot!.snapshotId,
        inputHash,
      });
      expect((await t.run((ctx) => ctx.db.get(sourceId)))?.status).toBe(
        "text_ready",
      );
    },
  );

  test("snapshot imports reject worker provenance even without a generation lease", async () => {
    const { t, sourceId, inputHash } = await setup();
    const { attemptId } = await t.mutation(
      internal.extractInternal.beginExtraction,
      {
        sourceId,
        model: MODELS.opus,
      },
    );
    await expect(
      store(t, sourceId, inputHash, { snapshotId: attemptId }),
    ).rejects.toThrow("Operator snapshot does not match result provenance");
    const attempt = await t.run((ctx) => ctx.db.get(attemptId!));
    expect(attempt?.origin).toBe("worker");
    expect(attempt?.result).toBeUndefined();
    expect(
      await t.run((ctx) => ctx.db.query("extractions").first()),
    ).toBeNull();
  });
  test("snapshot recovery pages past 200 abandoned reservations to the live owner", async () => {
    const { t, sourceId, inputHash } = await setup();
    const snapshot = await t.action(api.extract.beginOperatorExtraction, {
      sourceId,
      inputHash,
      model: MODELS.opus,
      devBypassSecret: BYPASS,
    });
    await t.run(async (ctx) => {
      const {
        _id: _ignoredId,
        _creationTime: _ignoredTime,
        ...row
      } = (await ctx.db.get(snapshot!.snapshotId))!;
      for (let i = 0; i < 200; i++)
        await ctx.db.insert("extractionAttempts", { ...row, updatedAt: 1 });
    });
    const first = await t.query(api.sources.operatorExtractionSnapshots, {
      model: MODELS.opus,
      devBypassSecret: BYPASS,
      limit: 200,
    });
    expect(first.page).toEqual([]);
    expect(first.isDone).toBe(false);
    let page = first;
    const recovered = [];
    let pages = 1;
    while (!page.isDone && pages < 30) {
      page = await t.query(api.sources.operatorExtractionSnapshots, {
        model: MODELS.opus,
        devBypassSecret: BYPASS,
        limit: 200,
        cursor: page.continueCursor,
      });
      recovered.push(...page.page.map((row) => row.snapshotId));
      pages++;
    }
    expect(recovered).toEqual([snapshot!.snapshotId]);
    expect(page.isDone).toBe(true);
    expect(pages).toBe(26);
  });
  test("large transcript snapshots remain recoverable within transaction read limits", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const transcript = article
      .repeat(Math.ceil(400_000 / article.length))
      .slice(0, 400_000);
    const inputHash = await extractionInputHash(transcript);
    const expected = [];
    for (let i = 0; i < 40; i++) {
      const sourceId = await t.run((ctx) =>
        ctx.db.insert("sources", {
          type: "youtube",
          title: `Long transcript ${i}`,
          transcript,
          dedupeKey: `large:${i}`,
          status: "text_ready",
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 1,
        }),
      );
      const snapshot = await t.action(api.extract.beginOperatorExtraction, {
        sourceId,
        inputHash,
        model: MODELS.opus,
        devBypassSecret: BYPASS,
      });
      expected.push(snapshot!.snapshotId);
    }
    const recovered = [];
    let cursor: string | null = null;
    let done = false;
    let pages = 0;
    while (!done && pages < 10) {
      const page: FunctionReturnType<
        typeof api.sources.operatorExtractionSnapshots
      > = await t.query(api.sources.operatorExtractionSnapshots, {
        model: MODELS.opus,
        devBypassSecret: BYPASS,
        limit: 200,
        cursor,
      });
      expect(page.page.length).toBeLessThanOrEqual(8);
      recovered.push(...page.page.map((row) => row.snapshotId));
      cursor = page.continueCursor;
      done = page.isDone;
      pages++;
    }
    expect(done).toBe(true);
    expect(pages).toBe(5);
    expect(new Set(recovered)).toEqual(new Set(expected));
  });
  test("an interrupted export can recover its original snapshot and import late output as history", async () => {
    const { t, sourceId, inputHash } = await setup();
    const snapshot = await t.action(api.extract.beginOperatorExtraction, {
      sourceId,
      inputHash,
      model: MODELS.opus,
      devBypassSecret: BYPASS,
    });
    expect(snapshot).not.toBeNull();
    const resumed = await t.query(api.sources.operatorExtractionSnapshots, {
      model: MODELS.opus,
      devBypassSecret: BYPASS,
    });
    expect(resumed.page).toHaveLength(1);
    expect(resumed.page[0]).toMatchObject({
      snapshotId: snapshot!.snapshotId,
      prompt: snapshot!.prompt,
      system: snapshot!.system,
      inputHash,
    });
    await t.run((ctx) =>
      ctx.db.patch(sourceId, {
        rawText: "Different current content",
        status: "archived",
      }),
    );
    expect(
      (
        await t.query(api.sources.operatorExtractionSnapshots, {
          model: MODELS.opus,
          devBypassSecret: BYPASS,
        })
      ).page,
    ).toEqual([]);
    const stored = await t.action(api.extract.storeOperatorExtraction, {
      sourceId,
      inputHash,
      snapshotId: snapshot!.snapshotId,
      model: MODELS.opus,
      extraction,
      devBypassSecret: BYPASS,
    });
    expect(stored).toMatchObject({ success: true, current: false });
    expect((await t.run((ctx) => ctx.db.get(sourceId)))?.status).toBe(
      "archived",
    );
  });

  test("stores textbook foundations as reference evidence without asserting peer review", async () => {
    const { t, sourceId, inputHash } = await setup();
    await store(t, sourceId, inputHash, {
      extraction: {
        ...extraction,
        claims: [{ ...extraction.claims[0], evidenceLevel: "reference" }],
      },
    });
    const { claims, stored } = await t.run(async (ctx) => ({
      claims: await ctx.db.query("claims").collect(),
      stored: await ctx.db.query("extractions").collect(),
    }));
    expect(claims[0]?.evidenceLevel).toBe("reference");
    expect(stored[0]?.claims[0]?.evidenceLevel).toBe("reference");
  });

  test.each([MODELS.default, MODELS.sonnet])(
    "records the selected catalog model %s on the stored Extraction",
    async (model) => {
      const { t, sourceId, inputHash } = await setup();
      expect(await store(t, sourceId, inputHash, { model })).toMatchObject({
        success: true,
        model,
      });
      const stored = await t.query(api.extractions.getBySourceId, { sourceId });
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ model, inputHash });
      expect(
        await t.run((ctx) => ctx.db.get("sources", sourceId)),
      ).toMatchObject({
        status: "extracted",
      });
    },
  );

  test("rejects a transcription-only model before storing results", async () => {
    const { t, sourceId, inputHash } = await setup();
    await expect(
      store(t, sourceId, inputHash, { model: MODELS.transcription }),
    ).rejects.toThrow("Operator extractions record one of");
    expect(await t.query(api.extractions.getBySourceId, { sourceId })).toEqual(
      [],
    );
    expect(await t.run((ctx) => ctx.db.get("sources", sourceId))).toMatchObject(
      {
        status: "text_ready",
      },
    );
  });

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
      promptVersion: EXTRACTION_PROMPT_VERSION,
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
        model: "unregistered/model",
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

describe("concept linking", () => {
  // Fake timers keep scheduled jobs pending so the queue can be inspected.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const jobs = (t: ReturnType<typeof convexTest>) =>
    t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  const graph = (t: ReturnType<typeof convexTest>) =>
    t.run(async (ctx) => ({
      edges: await ctx.db.query("edges").collect(),
      mentions: Object.fromEntries(
        (await ctx.db.query("concepts").collect()).map((concept) => [
          concept.name,
          concept.mentionCount,
        ]),
      ),
    }));

  test("a stored operator Extraction schedules its concept links", async () => {
    const { t, sourceId, inputHash } = await setup();
    await store(t, sourceId, inputHash);
    const [stored] = await t.query(api.extractions.getBySourceId, {
      sourceId,
    });
    const link = (await jobs(t)).find((job) =>
      /^graph(\.js)?:linkExtraction$/.test(job.name),
    );
    expect(link?.args).toEqual([{ extractionId: stored?._id }]);
  });

  test.each(["historical", "archived"] as const)(
    "scheduled links and backfill cannot promote a late %s snapshot",
    async (disposition) => {
      const { t, sourceId, inputHash } = await setup();
      const snapshot = await t.action(api.extract.beginOperatorExtraction, {
        sourceId,
        inputHash,
        model: MODELS.opus,
        devBypassSecret: BYPASS,
      });
      const reader = t.withIdentity({ subject: "operator" });
      if (disposition === "historical") {
        await reader.mutation(api.sources.updateText, {
          id: sourceId,
          rawText: article.repeat(3),
        });
      } else {
        await reader.mutation(api.sources.updateStatus, {
          id: sourceId,
          status: "archived",
        });
      }
      await expect(
        store(t, sourceId, inputHash, { snapshotId: snapshot!.snapshotId }),
      ).resolves.toMatchObject({ success: true, current: false });
      const stored = (await t.run((ctx) =>
        ctx.db.query("extractions").first(),
      ))!;
      expect(stored.historical).toBe(true);
      expect(
        (await jobs(t)).find((job) =>
          /^graph(\.js)?:linkExtraction$/.test(job.name),
        )?.args,
      ).toEqual([{ extractionId: stored._id }]);
      expect(
        await t.mutation(internal.graph.linkExtraction, {
          extractionId: stored._id,
        }),
      ).toEqual({ linked: 0, concepts: [] });
      // The archive fence must hold independently of the history marker.
      if (disposition === "archived")
        await t.run((ctx) => ctx.db.patch(stored._id, { historical: false }));
      expect(
        await t.mutation(internal.graph.linkExtractionConceptsAtomic, {
          extractionId: stored._id,
        }),
      ).toEqual({ linked: 0, concepts: [] });
      expect(
        await t.action(internal.graph.linkExtractionConcepts, {
          extractionId: stored._id,
        }),
      ).toEqual({ linked: 0, concepts: [] });
      expect(
        await t.mutation(internal.graph.buildGraphFromExtractions, {}),
      ).toEqual({ processed: 1, conceptsLinked: 0, isDone: true });
      expect(await graph(t)).toEqual({ edges: [], mentions: {} });
      expect(
        (await jobs(t)).filter((job) =>
          /^conceptClassifier(\.js)?:classifyConceptBatch$/.test(job.name),
        ),
      ).toEqual([]);
    },
  );

  test("linking again adds no edges, mentions, or classifier jobs", async () => {
    const { t, sourceId, inputHash } = await setup();
    await store(t, sourceId, inputHash, {
      extraction: { ...extraction, topics: ["Tuning", " tuning ", "  "] },
    });
    const [stored] = await t.query(api.extractions.getBySourceId, {
      sourceId,
    });
    const extractionId = stored!._id;
    expect(
      await t.mutation(internal.graph.linkExtraction, { extractionId }),
    ).toEqual({ linked: 1, concepts: ["Tuning"] });
    // The workflows' action step relinks after the scheduled link: a no-op.
    expect(
      await t.action(internal.graph.linkExtractionConcepts, { extractionId }),
    ).toEqual({ linked: 0, concepts: [] });
    // Only the call that created the Concept queued its classification.
    const classify = (await jobs(t)).filter((job) =>
      /^conceptClassifier(\.js)?:classifyConceptBatch$/.test(job.name),
    );
    expect(classify).toHaveLength(1);
    const { edges, mentions } = await graph(t);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      fromType: "source",
      fromId: sourceId,
      toType: "concept",
      toId: "tuning",
      relationship: "mentions",
    });
    expect(mentions).toEqual({ tuning: 1 });
  });

  test("scheduled linking resumes topics without duplicate counts or classification", async () => {
    const { t, sourceId, inputHash } = await setup();
    await store(t, sourceId, inputHash);
    const [stored] = await t.query(api.extractions.getBySourceId, { sourceId });
    const first = await t.mutation(internal.graph.linkExtraction, {
      extractionId: stored!._id,
    });
    expect(first.linked).toBe(1);
    const continuation = (await jobs(t)).at(-1)!;
    expect(continuation.name).toMatch(/^graph(\.js)?:linkExtraction$/);
    expect(continuation.args[0]).toMatchObject({
      extractionId: stored!._id,
      topicOffset: 1,
    });
    expect(
      await t.mutation(internal.graph.linkExtraction, continuation.args[0]),
    ).toMatchObject({ linked: 1 });
    const before = await graph(t);
    await t.mutation(internal.graph.linkExtraction, continuation.args[0]);
    expect(await graph(t)).toEqual(before);
  });

  test.each(["scheduled", "backfill"] as const)(
    "%s topic continuation restarts when a supported edit shifts remaining topics",
    async (mode) => {
      const { t, sourceId, inputHash } = await setup();
      await store(t, sourceId, inputHash, {
        extraction: { ...extraction, topics: ["a", "b"] },
      });
      const [stored] = await t.query(api.extractions.getBySourceId, {
        sourceId,
      });
      if (mode === "scheduled")
        await t.mutation(internal.graph.linkExtraction, {
          extractionId: stored!._id,
        });
      else await t.mutation(internal.graph.buildGraphFromExtractions, {});
      const continuation = (await jobs(t)).at(-1)!;
      await t.mutation(api.extractions.editExtraction, {
        id: stored!._id,
        topics: ["b"],
        devBypassSecret: BYPASS,
      });
      if (mode === "scheduled")
        await t.mutation(internal.graph.linkExtraction, continuation.args[0]);
      else
        await t.mutation(
          internal.graph.buildGraphFromExtractions,
          continuation.args[0],
        );
      expect((await graph(t)).mentions).toEqual({ a: 1, b: 1 });
      const classify = (await jobs(t)).filter((job) =>
        /^conceptClassifier(\.js)?:classifyConceptBatch$/.test(job.name),
      );
      expect(classify).toHaveLength(2);
    },
  );

  test("only the operator service identity starts the backfill", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.extractions.startConceptBackfill, {}),
    ).rejects.toThrow();
    await expect(
      t
        .withIdentity({ subject: "user_123", name: "Someone" })
        .mutation(api.extractions.startConceptBackfill, {}),
    ).rejects.toThrow("requires the operator bypass secret");
    expect(await jobs(t)).toEqual([]);
    await t.mutation(api.extractions.startConceptBackfill, {
      devBypassSecret: BYPASS,
    });
    const scheduled = await jobs(t);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.name).toMatch(
      /^graph(\.js)?:buildGraphFromExtractions$/,
    );
    expect(scheduled[0]?.args).toEqual([{}]);
  });

  test("the backfill pages through every Extraction and is safe to rerun", async () => {
    const { t, sourceId, inputHash } = await setup();
    await store(t, sourceId, inputHash);
    const otherText =
      `${article}Meantone tempers fifths to purify thirds. `.repeat(2);
    const other = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        canonicalUrl: "https://example.org/meantone",
        dedupeKey: "url:example.org/meantone",
        title: "Meantone",
        rawText: otherText,
        status: "text_ready",
        visibility: "private",
        createdBy: "system",
        createdAt: 2,
        updatedAt: 2,
      }),
    );
    await store(t, other, await extractionInputHash(otherText), {
      extraction: { ...extraction, topics: ["tuning", "meantone"] },
    });

    const drain = async (batchSize?: number) => {
      let args: Record<string, unknown> = { batchSize };
      let processed = 0;
      let conceptsLinked = 0;
      for (let tick = 0; tick < 10; tick++) {
        const result = await t.mutation(
          internal.graph.buildGraphFromExtractions,
          args,
        );
        processed += result.processed;
        conceptsLinked += result.conceptsLinked;
        if (result.isDone) return { processed, conceptsLinked };
        const next = (await jobs(t)).at(-1)!;
        expect(next.name).toMatch(/^graph(\.js)?:buildGraphFromExtractions$/);
        expect(next.args[0]).toMatchObject({ batchSize: 1 });
        args = next.args[0];
      }
      throw new Error("Backfill did not drain");
    };
    expect(await drain(1)).toEqual({ processed: 2, conceptsLinked: 4 });
    const linked = await graph(t);
    expect(linked.edges).toHaveLength(4);
    expect(linked.mentions).toEqual({
      tuning: 2,
      "pythagorean comma": 1,
      meantone: 1,
    });
    // Invalid old batch sizes cannot enlarge transactions; reruns remain no-ops.
    expect(await drain(0)).toEqual({ processed: 2, conceptsLinked: 0 });
    expect(await drain()).toEqual({ processed: 2, conceptsLinked: 0 });
    expect(await graph(t)).toEqual(linked);
  });

  test("unmarked legacy history never creates obsolete concept evidence", async () => {
    const { t, sourceId, inputHash } = await setup();
    const ids = await t.run(async (ctx) => {
      const rows = [];
      for (const [createdAt, topic] of [
        [1, "obsolete geometry"],
        [2, "current tuning"],
      ] as const)
        rows.push(
          await ctx.db.insert("extractions", {
            ...extraction,
            sourceId,
            inputHash,
            compositionParameters: [],
            topics: [topic],
            model: "legacy",
            promptVersion: "old",
            confidence: 0.8,
            createdBy: "system",
            createdAt,
          }),
        );
      return rows;
    });
    expect(
      (await t.query(api.extractions.getBySourceId, { sourceId })).map(
        (row) => row._id,
      ),
    ).toEqual([ids[1]]);
    await t.mutation(internal.graph.buildGraphFromExtractions, {
      batchSize: 1,
    });
    const next = (await jobs(t)).find((job) =>
      /^graph(\.js)?:buildGraphFromExtractions$/.test(job.name),
    );
    await t.mutation(internal.graph.buildGraphFromExtractions, next!.args[0]);
    expect((await graph(t)).mentions).toEqual({ "current tuning": 1 });
    expect(
      await t.action(internal.graph.linkExtractionConcepts, {
        extractionId: ids[0]!,
      }),
    ).toEqual({ linked: 0, concepts: [] });
  });

  test("replay of 2500 existing topic edges stays within index-range limits", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const topics = Array.from({ length: 2500 }, (_, index) => `topic ${index}`);
    const extractionId = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "url",
        rawText: article,
        status: "extracted",
        dedupeKey: "many-existing-topics",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      return await ctx.db.insert("extractions", {
        ...extraction,
        sourceId,
        inputHash: "many-existing-topics",
        compositionParameters: [],
        topics,
        historical: false,
        model: "legacy",
        promptVersion: "old",
        confidence: 0.8,
        createdBy: "system",
        createdAt: 1,
      });
    });
    const sourceId = (await t.run((ctx) => ctx.db.get(extractionId)))!.sourceId;
    for (let offset = 0; offset < topics.length; offset += 100)
      await t.run(async (ctx) => {
        for (const name of topics.slice(offset, offset + 100)) {
          await ctx.db.insert("concepts", {
            name,
            displayName: name,
            aliases: [],
            domain: "science",
            hypothesisCount: 0,
            mentionCount: 1,
            createdAt: 1,
            updatedAt: 1,
          });
          await ctx.db.insert("edges", {
            fromType: "source",
            fromId: sourceId,
            toType: "concept",
            toId: name,
            relationship: "mentions",
            autoGenerated: true,
            createdAt: 1,
            createdBy: "system",
          });
        }
      });
    expect(
      await t.mutation(internal.graph.linkExtractionConceptsAtomic, {
        extractionId,
      }),
    ).toEqual({ linked: 0, concepts: [] });
    expect(await jobs(t)).toEqual([]);
    expect((await graph(t)).edges).toHaveLength(topics.length);
    expect(Object.values((await graph(t)).mentions)).toEqual(
      topics.map(() => 1),
    );
  });

  test("backfill resumes unlinked topics before advancing to the next Extraction", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const topics = Array.from(
      { length: 2500 },
      (_, index) => `unlinked topic ${index}`,
    );
    for (const [index, rowTopics] of [topics, ["later topic"]].entries()) {
      await t.run(async (ctx) => {
        const sourceId = await ctx.db.insert("sources", {
          type: "url",
          rawText: article,
          status: "extracted",
          dedupeKey: `unlinked:${index}`,
          visibility: "private",
          createdBy: "system",
          createdAt: index,
          updatedAt: index,
        });
        await ctx.db.insert("extractions", {
          ...extraction,
          sourceId,
          topics: rowTopics,
          historical: false,
          inputHash: `unlinked:${index}`,
          compositionParameters: [],
          model: "legacy",
          promptVersion: "old",
          confidence: 0.8,
          createdBy: "system",
          createdAt: index,
        });
      });
    }
    for (let offset = 0; offset < topics.length; offset += 100)
      await t.run(async (ctx) => {
        for (const name of topics.slice(offset, offset + 100))
          await ctx.db.insert("concepts", {
            name,
            displayName: name,
            aliases: [],
            domain: "science",
            mentionCount: 0,
            hypothesisCount: 0,
            createdAt: 1,
            updatedAt: 1,
          });
      });
    let args = {};
    let linked = 0;
    let processed = 0;
    let done = false;
    for (let tick = 0; tick < 2502; tick++) {
      const result = await t.mutation(
        internal.graph.buildGraphFromExtractions,
        args,
      );
      linked += result.conceptsLinked;
      processed += result.processed;
      if (result.isDone) {
        done = true;
        break;
      }
      const next = (await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").order("desc").first(),
      ))!;
      expect(next.name).toMatch(/^graph(\.js)?:buildGraphFromExtractions$/);
      args = next.args[0];
    }
    expect(done).toBe(true);
    expect(processed).toBe(2);
    expect(linked).toBe(2501);
    const linkedGraph = await graph(t);
    expect(linkedGraph.edges).toHaveLength(2501);
    expect(Object.values(linkedGraph.mentions)).toEqual(
      Array.from({ length: 2501 }, () => 1),
    );
  }, 60000);

  test("large backfill rows drain through separate transactions", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    for (let index = 0; index < 10; index++)
      await t.run(async (ctx) => {
        const sourceId = await ctx.db.insert("sources", {
          type: "url",
          rawText: "x".repeat(900_000),
          status: "extracted",
          dedupeKey: `large-backfill:${index}`,
          visibility: "private",
          createdBy: "system",
          createdAt: index,
          updatedAt: index,
        });
        await ctx.db.insert("extractions", {
          ...extraction,
          sourceId,
          summary: "x".repeat(900_000),
          inputHash: `large-backfill:${index}`,
          compositionParameters: [],
          topics: [`backfill topic ${index}`],
          model: "legacy",
          promptVersion: "old",
          confidence: 0.8,
          createdBy: "system",
          createdAt: index,
        });
      });
    let args: { cursor?: string | null; batchSize?: number } = {
      batchSize: 50,
    };
    let processed = 0;
    let linked = 0;
    for (let page = 0; page < 10; page++) {
      const result = await t.mutation(
        internal.graph.buildGraphFromExtractions,
        args,
      );
      expect(result.processed).toBe(1);
      processed += result.processed;
      linked += result.conceptsLinked;
      if (result.isDone) break;
      const next = (await jobs(t)).at(-1)!;
      expect(next.name).toMatch(/^graph(\.js)?:buildGraphFromExtractions$/);
      args = next.args[0];
    }
    expect(processed).toBe(10);
    expect(linked).toBe(10);
    expect((await graph(t)).edges).toHaveLength(10);
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
