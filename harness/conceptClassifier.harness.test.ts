/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./modules";

describe("mission concept-domain seed", () => {
  test("dry-runs, applies, and converges idempotently by name", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const entries = [
      { name: "cymatics", description: "Visible wave patterns." },
      { name: "wave-physics", description: "Physical wave behavior." },
    ];
    expect(
      await asSystem.mutation(api.vocabulary.seedMissionConceptDomains, {
        entries,
        apply: false,
      }),
    ).toEqual({ created: 2, updated: 0, unchanged: 0 });
    expect(
      await t.run((ctx) => ctx.db.query("conceptDomains").collect()),
    ).toEqual([]);
    expect(
      await asSystem.mutation(api.vocabulary.seedMissionConceptDomains, {
        entries,
        apply: true,
      }),
    ).toEqual({ created: 2, updated: 0, unchanged: 0 });
    expect(
      await asSystem.mutation(api.vocabulary.seedMissionConceptDomains, {
        entries,
        apply: true,
      }),
    ).toEqual({ created: 0, updated: 0, unchanged: 2 });
  });
});

describe("concept classification persistence", () => {
  test("assigns only registered domains and stages unknown proposals", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const conceptId = await t.run(async (ctx) => {
      const now = 1000;
      await ctx.db.insert("conceptDomains", {
        name: "cymatics",
        status: "known",
        description: "Visible wave patterns.",
        introducedBy: "system",
        createdAt: now,
        updatedAt: now,
      });
      return await ctx.db.insert("concepts", {
        name: "chladni-figures",
        displayName: "Chladni figures",
        aliases: [],
        domain: "general",
        domains: ["general"],
        missionRelevance: "unreviewed",
        mentionCount: 3,
        hypothesisCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    });

    const unknown = await asSystem.mutation(
      api.conceptClassifier.writeClassifications,
      {
        classifications: [
          {
            conceptId,
            domains: ["invented-domain"],
            missionRelevance: "on",
            rationale: "The model invented a taxonomy label.",
          },
        ],
        model: "test-model",
        force: false,
      },
    );
    expect(unknown).toMatchObject({ assigned: 0, unreviewed: 1, skipped: 0 });

    const afterUnknown = await t.run(async (ctx) => ({
      concept: await ctx.db.get("concepts", conceptId),
      provisional: await ctx.db
        .query("conceptDomains")
        .withIndex("by_name", (q) => q.eq("name", "invented-domain"))
        .unique(),
    }));
    expect(afterUnknown.provisional?.status).toBe("provisional");
    expect(afterUnknown.concept).toMatchObject({
      domain: "general",
      domains: ["general"],
      missionRelevance: "unreviewed",
      relevanceRationale: "classifier proposed unknown domain: invented-domain",
      classifierModel: "test-model",
    });
    expect(afterUnknown.concept?.classifiedAt).toBeUndefined();

    const stillUnreviewed = await asSystem.mutation(
      api.conceptClassifier.writeClassifications,
      {
        classifications: [
          {
            conceptId,
            domains: ["invented-domain", "cymatics"],
            missionRelevance: "on",
            rationale: "Both labels now exist in the registry.",
          },
        ],
        model: "test-model",
        force: false,
      },
    );
    expect(stillUnreviewed).toMatchObject({
      assigned: 0,
      unreviewed: 1,
      skipped: 0,
    });
    await t.run(async (ctx) => {
      if (!afterUnknown.provisional) throw new Error("Missing provisional row");
      await ctx.db.patch("conceptDomains", afterUnknown.provisional._id, {
        status: "known",
        updatedAt: 2000,
      });
    });
    const assigned = await asSystem.mutation(
      api.conceptClassifier.writeClassifications,
      {
        classifications: [
          {
            conceptId,
            domains: ["invented-domain", "cymatics"],
            missionRelevance: "on",
            rationale: "Human registry promotion now permits both labels.",
          },
        ],
        model: "test-model",
        force: false,
      },
    );
    expect(assigned).toMatchObject({ assigned: 1, unreviewed: 0, skipped: 0 });
    expect(
      await t.run((ctx) => ctx.db.get("concepts", conceptId)),
    ).toMatchObject({
      domain: "invented-domain",
      domains: ["invented-domain", "cymatics"],
      missionRelevance: "on",
      relevanceRationale: "Human registry promotion now permits both labels.",
      classifierModel: "test-model",
    });

    const converged = await asSystem.mutation(
      api.conceptClassifier.writeClassifications,
      {
        classifications: [
          {
            conceptId,
            domains: ["cymatics"],
            missionRelevance: "off",
            rationale: "This must be skipped without force.",
          },
        ],
        model: "test-model",
        force: false,
      },
    );
    expect(converged).toMatchObject({ assigned: 0, unreviewed: 0, skipped: 1 });
  });

  test("cursor pages converge after concepts are classified", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const conceptIds = await t.run(async (ctx) => {
      const ids = [];
      for (const name of ["one", "two", "three"]) {
        ids.push(
          await ctx.db.insert("concepts", {
            name,
            displayName: name,
            aliases: [],
            domain: "general",
            missionRelevance: "unreviewed",
            mentionCount: 0,
            hypothesisCount: 0,
            createdAt: 1000,
            updatedAt: 1000,
          }),
        );
      }
      return ids;
    });

    const first = await asSystem.query(
      api.conceptClassifier.listClassificationCandidates,
      { cursor: null, batchSize: 2, force: false },
    );
    expect(first.conceptIds).toHaveLength(2);
    expect(first.isDone).toBe(false);
    const second = await asSystem.query(
      api.conceptClassifier.listClassificationCandidates,
      { cursor: first.continueCursor, batchSize: 2, force: false },
    );
    expect(second.conceptIds).toHaveLength(1);
    expect(second.isDone).toBe(true);

    await t.run(async (ctx) => {
      for (const conceptId of conceptIds) {
        await ctx.db.patch("concepts", conceptId, { classifiedAt: 2000 });
      }
    });
    const convergence = await asSystem.query(
      api.conceptClassifier.listClassificationCandidates,
      { cursor: null, batchSize: 20, force: false },
    );
    expect(convergence).toMatchObject({ conceptIds: [], isDone: true });
    const forced = await asSystem.query(
      api.conceptClassifier.listClassificationCandidates,
      { cursor: null, batchSize: 20, force: true },
    );
    expect(forced.conceptIds).toHaveLength(3);
  });
});

describe("concept creation classification scheduling", () => {
  test("new concepts start unreviewed and schedule asynchronous classification", async () => {
    const t = convexTest(schema, modules);
    const extractionId = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "url",
        status: "extracted",
        dedupeKey: "url:example.com/concept-scheduling",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      });
      return await ctx.db.insert("extractions", {
        sourceId,
        model: "test-model",
        promptVersion: "extract_v2",
        inputHash: "schedule",
        summary: "Scheduling fixture",
        claims: [],
        compositionParameters: [],
        topics: ["new resonance term"],
        openQuestions: [],
        confidence: 0.8,
        createdBy: "system",
        createdAt: 1000,
      });
    });
    await t.action(internal.graph.linkExtractionConcepts, { extractionId });
    const state = await t.run(async (ctx) => ({
      concept: await ctx.db
        .query("concepts")
        .withIndex("by_name", (q) => q.eq("name", "new resonance term"))
        .unique(),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
      edges: await ctx.db
        .query("edges")
        .withIndex("by_to", (q) =>
          q.eq("toType", "concept").eq("toId", "new resonance term"),
        )
        .collect(),
    }));
    expect(state.concept?.missionRelevance).toBe("unreviewed");
    expect(state.edges).toHaveLength(1);
    expect(state.scheduled).toHaveLength(1);
    expect(state.scheduled[0]?.name).toContain(
      "conceptClassifier:classifyConceptBatch",
    );
  });

  test("the retry sweep selects only unreviewed concepts older than one hour", async () => {
    const t = convexTest(schema, modules);
    const now = 10_000_000;
    const { oldId } = await t.run(async (ctx) => {
      const insert = (name: string, createdAt: number) =>
        ctx.db.insert("concepts", {
          name,
          displayName: name,
          aliases: [],
          domain: "general",
          missionRelevance: "unreviewed" as const,
          mentionCount: 0,
          hypothesisCount: 0,
          createdAt,
          updatedAt: createdAt,
        });
      return {
        oldId: await insert("old", now - 60 * 60 * 1000 - 1),
        newId: await insert("new", now - 60 * 60 * 1000 + 1),
      };
    });
    expect(
      await t.query(internal.conceptClassifier.listStaleUnreviewed, {
        cutoff: now - 60 * 60 * 1000,
        limit: 20,
      }),
    ).toEqual([oldId]);
  });
});
