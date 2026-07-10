import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./modules";

describe("dashboard stats recomputation", () => {
  test("writes exact reader keys with values matching direct counts", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const ingestedId = await ctx.db.insert("sources", {
        type: "url",
        title: "Blocked private source",
        canonicalUrl: "https://example.com/blocked",
        status: "ingested",
        blockedReason: "no_text",
        dedupeKey: "url:example.com/blocked",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      });
      await ctx.db.insert("sources", {
        type: "url",
        title: "Ready private source",
        canonicalUrl: "https://example.com/ready",
        status: "text_ready",
        dedupeKey: "url:example.com/ready",
        visibility: "private",
        createdBy: "system",
        createdAt: 1001,
        updatedAt: 1001,
      });
      await ctx.db.insert("sources", {
        type: "url",
        title: "Review private source",
        canonicalUrl: "https://example.com/review",
        status: "review_needed",
        dedupeKey: "url:example.com/review",
        visibility: "private",
        createdBy: "system",
        createdAt: 1002,
        updatedAt: 1002,
      });
      await ctx.db.insert("sources", {
        type: "url",
        title: "Public source",
        canonicalUrl: "https://example.com/public",
        status: "ingested",
        blockedReason: "no_text",
        dedupeKey: "url:example.com/public",
        visibility: "public",
        createdBy: "system",
        createdAt: 1003,
        updatedAt: 1003,
      });
      for (let index = 0; index < 3; index++) {
        await ctx.db.insert("sources", {
          type: "url",
          title: `Extra public source ${index}`,
          canonicalUrl: `https://example.com/extra-${index}`,
          status: "triaged",
          dedupeKey: `url:example.com/extra-${index}`,
          visibility: "public",
          createdBy: "system",
          createdAt: 1010 + index,
          updatedAt: 1010 + index,
        });
      }
      const extraInboxSources = [
        { status: "ingested" as const, count: 3 },
        { status: "text_ready" as const, count: 2 },
        { status: "review_needed" as const, count: 1 },
      ];
      let extraInboxIndex = 0;
      for (const group of extraInboxSources) {
        for (let index = 0; index < group.count; index++) {
          await ctx.db.insert("sources", {
            type: "url",
            title: `Extra private ${group.status} source ${index}`,
            canonicalUrl: `https://example.com/${group.status}-${index}`,
            status: group.status,
            dedupeKey: `url:example.com/${group.status}-${index}`,
            visibility: "private",
            createdBy: "system",
            createdAt: 1020 + extraInboxIndex,
            updatedAt: 1020 + extraInboxIndex,
          });
          extraInboxIndex++;
        }
      }

      await ctx.db.insert("extractions", {
        sourceId: ingestedId,
        model: "test-model",
        promptVersion: "test-v1",
        inputHash: "test-input",
        summary: "Test extraction",
        claims: [],
        compositionParameters: [],
        topics: ["cymatics"],
        openQuestions: [],
        confidence: 0.8,
        createdBy: "system",
        createdAt: 1100,
      });
      for (let index = 0; index < 5; index++) {
        await ctx.db.insert("extractions", {
          sourceId: ingestedId,
          model: "test-model",
          promptVersion: "test-v1",
          inputHash: `test-input-${index}`,
          summary: `Extra test extraction ${index}`,
          claims: [],
          compositionParameters: [],
          topics: ["cymatics"],
          openQuestions: [],
          confidence: 0.8,
          createdBy: "system",
          createdAt: 1110 + index,
        });
      }
      const hypothesisId = await ctx.db.insert("hypotheses", {
        title: "Test hypothesis",
        question: "Does the test resonate?",
        hypothesis: "The test resonates",
        rationaleMd: "Harness fixture",
        sourceIds: [ingestedId],
        status: "draft",
        visibility: "private",
        createdBy: "system",
        createdAt: 1200,
        updatedAt: 1200,
      });
      for (let index = 0; index < 4; index++) {
        await ctx.db.insert("hypotheses", {
          title: `Extra test hypothesis ${index}`,
          question: `Does extra test ${index} resonate?`,
          hypothesis: `Extra test ${index} resonates`,
          rationaleMd: "Harness fixture",
          sourceIds: [ingestedId],
          status: "draft",
          visibility: "private",
          createdBy: "system",
          createdAt: 1210 + index,
          updatedAt: 1210 + index,
        });
      }
      const recipeId = await ctx.db.insert("recipes", {
        hypothesisId,
        title: "Test recipe",
        bodyMd: "Harness fixture",
        parameters: [],
        dawChecklist: [],
        status: "draft",
        visibility: "private",
        createdBy: "system",
        createdAt: 1300,
        updatedAt: 1300,
      });
      for (let index = 0; index < 3; index++) {
        await ctx.db.insert("recipes", {
          hypothesisId,
          title: `Extra test recipe ${index}`,
          bodyMd: "Harness fixture",
          parameters: [],
          dawChecklist: [],
          status: "draft",
          visibility: "private",
          createdBy: "system",
          createdAt: 1310 + index,
          updatedAt: 1310 + index,
        });
      }
      await ctx.db.insert("compositions", {
        title: "Test composition",
        recipeId,
        artifactType: "microStudy",
        version: "v0.1",
        status: "idea",
        visibility: "private",
        createdBy: "system",
        createdAt: 1400,
        updatedAt: 1400,
      });
      for (let index = 0; index < 2; index++) {
        await ctx.db.insert("compositions", {
          title: `Extra test composition ${index}`,
          recipeId,
          artifactType: "microStudy",
          version: "v0.1",
          status: "idea",
          visibility: "private",
          createdBy: "system",
          createdAt: 1410 + index,
          updatedAt: 1410 + index,
        });
      }
      await ctx.db.insert("weeklyBriefs", {
        weekOf: "2026-07-06",
        model: "test-model",
        promptVersion: "test-v1",
        bodyMd: "Harness fixture",
        sourceIds: [ingestedId],
        recommendedHypothesisIds: [hypothesisId],
        recommendedRecipeIds: [recipeId],
        visibility: "private",
        createdBy: "system",
        createdAt: 1500,
      });
      await ctx.db.insert("weeklyBriefs", {
        weekOf: "2026-07-13",
        model: "test-model",
        promptVersion: "test-v1",
        bodyMd: "Second harness fixture",
        sourceIds: [ingestedId],
        recommendedHypothesisIds: [hypothesisId],
        recommendedRecipeIds: [recipeId],
        visibility: "private",
        createdBy: "system",
        createdAt: 1501,
      });
      await ctx.db.insert("feeds", {
        name: "Test feed",
        url: "https://example.com/feed.xml",
        type: "rss",
        enabled: true,
        createdAt: 1600,
        updatedAt: 1600,
      });
    });

    await t.action(internal.dashboard.recomputeStats, {});

    const { directCounts, stats } = await t.run(async (ctx) => {
      const [
        sources,
        extractions,
        hypotheses,
        recipes,
        compositions,
        weeklyBriefs,
        feeds,
        statRows,
      ] = await Promise.all([
        ctx.db.query("sources").collect(),
        ctx.db.query("extractions").collect(),
        ctx.db.query("hypotheses").collect(),
        ctx.db.query("recipes").collect(),
        ctx.db.query("compositions").collect(),
        ctx.db.query("weeklyBriefs").collect(),
        ctx.db.query("feeds").collect(),
        ctx.db.query("stats").collect(),
      ]);
      return {
        directCounts: {
          sources: sources.length,
          extractions: extractions.length,
          hypotheses: hypotheses.length,
          recipes: recipes.length,
          compositions: compositions.length,
          weeklyBriefs: weeklyBriefs.length,
          feeds: feeds.length,
        },
        stats: Object.fromEntries(statRows.map((row) => [row.key, row.value])),
      };
    });

    expect(Object.keys(stats).toSorted()).toEqual([
      "count.compositions",
      "count.extractions",
      "count.feeds",
      "count.hypotheses",
      "count.recipes",
      "count.sources",
      "count.weeklyBriefs",
      "inbox.blocked",
      "inbox.ingested",
      "inbox.reviewNeeded",
      "inbox.textReady",
    ]);
    expect(directCounts).toEqual({
      sources: 13,
      extractions: 6,
      hypotheses: 5,
      recipes: 4,
      compositions: 3,
      weeklyBriefs: 2,
      feeds: 1,
    });
    expect(stats).toMatchObject({
      "count.sources": directCounts.sources,
      "count.extractions": directCounts.extractions,
      "count.hypotheses": directCounts.hypotheses,
      "count.recipes": directCounts.recipes,
      "count.compositions": directCounts.compositions,
      "count.weeklyBriefs": directCounts.weeklyBriefs,
      "count.feeds": directCounts.feeds,
      "inbox.ingested": 4,
      "inbox.textReady": 3,
      "inbox.reviewNeeded": 2,
      "inbox.blocked": 1,
    });

    expect(await t.query(api.dashboard.pipeline, {})).toEqual({
      sources: directCounts.sources,
      extractions: directCounts.extractions,
      hypotheses: directCounts.hypotheses,
      recipes: directCounts.recipes,
      compositions: directCounts.compositions,
      weeklyBriefs: directCounts.weeklyBriefs,
    });
    expect(await t.query(api.admin.workspaceSnapshot, {})).toEqual({
      sources: directCounts.sources,
      hypotheses: directCounts.hypotheses,
      recipes: directCounts.recipes,
      compositions: directCounts.compositions,
      weeklyBriefs: directCounts.weeklyBriefs,
      feeds: directCounts.feeds,
    });
    expect(await t.query(api.inbox.counts, {})).toEqual({
      ingested: 4,
      textReady: 3,
      reviewNeeded: 2,
      blocked: 1,
    });
  });
});
