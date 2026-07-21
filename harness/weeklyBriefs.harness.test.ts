/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { computeLoopReport } from "../convex/weeklyBriefs";
import {
  DAY_MS,
  LISTENING_DEBT_AFTER_MS,
  PENDING_DRAFT_CAP,
} from "../convex/shared/agentContract";
import schema from "../convex/schema";
import { modules } from "./modules";

const NOW = Date.UTC(2026, 6, 20, 12);

describe("weekly brief loop report", () => {
  test("computes exact movement, queue, debt, boundary, and proposal sections", async () => {
    const t = convexTest(schema, modules);

    const fixture = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "url",
        status: "extracted",
        dedupeKey: "url:weekly-brief-loop-report",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      const extractionId = await ctx.db.insert("extractions", {
        sourceId,
        model: "test-model",
        promptVersion: "test",
        inputHash: "weekly-brief-loop-report",
        summary: "Fixture extraction",
        claims: [],
        compositionParameters: [],
        topics: [],
        openQuestions: [],
        confidence: 1,
        createdBy: "system",
        createdAt: 1,
      });
      const claimId = await ctx.db.insert("claims", {
        extractionId,
        sourceId,
        ordinal: 0,
        text: "Fixture claim",
        evidenceLevel: "peer_reviewed",
        citations: [],
        status: "active",
        createdBy: "system",
        createdAt: 1,
      });
      const conceptAId = await ctx.db.insert("concepts", {
        name: "fixture-a",
        displayName: "Fixture A",
        aliases: [],
        domain: "cymatics",
        domains: ["cymatics"],
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const conceptBId = await ctx.db.insert("concepts", {
        name: "fixture-b",
        displayName: "Fixture B",
        aliases: [],
        domain: "music-theory",
        domains: ["music-theory"],
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });

      const since = NOW - 5 * DAY_MS;
      await ctx.db.insert("weeklyBriefs", {
        weekOf: "2026-07-13",
        model: "test-model",
        promptVersion: "test",
        bodyMd: "Previous brief",
        sourceIds: [],
        recommendedHypothesisIds: [],
        recommendedRecipeIds: [],
        visibility: "private",
        createdBy: "system",
        createdAt: since,
      });

      const insertCorrespondence = async (input: {
        key: string;
        statement: string;
        status: "conjectured" | "evidenced" | "contradicted" | "retired";
        createdAt: number;
        updatedAt: number;
        statusChangedAt?: number;
        statusReason?: string;
        recentEvidence: number;
      }) =>
        await ctx.db.insert("correspondences", {
          conceptAId,
          conceptBId,
          pairKey: input.key,
          statement: input.statement,
          rationaleMd: "Fixture rationale",
          evidence: [
            {
              claimId,
              stance:
                input.status === "contradicted" ? "contradicts" : "supports",
              addedBy: "agent",
              addedAt: since - 1,
            },
            ...Array.from({ length: input.recentEvidence }, (_, index) => ({
              claimId,
              stance:
                input.status === "contradicted"
                  ? ("contradicts" as const)
                  : ("supports" as const),
              addedBy: "agent" as const,
              addedAt: since + 100 + index,
            })),
          ],
          status: input.status,
          statusChangedAt: input.statusChangedAt,
          statusReason: input.statusReason,
          createdBy: "system",
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
        });

      const gainedId = await insertCorrespondence({
        key: "gained",
        statement: "Gained two evidence citations",
        status: "evidenced",
        createdAt: since - DAY_MS,
        updatedAt: since + 600,
        statusChangedAt: since + 200,
        recentEvidence: 2,
      });
      const contradictedId = await insertCorrespondence({
        key: "contradicted",
        statement: "Became contradicted",
        status: "contradicted",
        // Created in-window, then transitioned: it remains a new conjecture
        // for movement-count purposes even though its current status changed.
        createdAt: since + 50,
        updatedAt: since + 500,
        statusChangedAt: since + 300,
        recentEvidence: 1,
      });
      const autoRetiredId = await insertCorrespondence({
        key: "auto-retired",
        statement: "Retired automatically",
        status: "retired",
        createdAt: since - 100 * DAY_MS,
        updatedAt: since + 400,
        statusChangedAt: since + 400,
        statusReason: "stale conjecture (auto)",
        recentEvidence: 0,
      });
      const newId = await insertCorrespondence({
        key: "new",
        statement: "New conjecture",
        status: "conjectured",
        createdAt: since + 100,
        updatedAt: since + 300,
        recentEvidence: 0,
      });
      const manualRetiredId = await insertCorrespondence({
        key: "manual-retired",
        statement: "Retired manually",
        status: "retired",
        createdAt: since - 20 * DAY_MS,
        updatedAt: since + 200,
        statusChangedAt: since + 200,
        statusReason: "human decision",
        recentEvidence: 0,
      });
      await insertCorrespondence({
        key: "sixth-mover",
        statement: "Sixth mover beyond the cap",
        status: "evidenced",
        createdAt: since - DAY_MS,
        updatedAt: since + 100,
        statusChangedAt: since + 100,
        recentEvidence: 0,
      });

      const agentRunId = await ctx.db.insert("agentRuns", {
        graphName: "hypothesis-drafter",
        status: "needs_review",
        input: null,
        createdAt: NOW - 10 * DAY_MS,
        updatedAt: NOW - 10 * DAY_MS,
      });
      for (let index = 0; index < PENDING_DRAFT_CAP; index++) {
        await ctx.db.insert("agentReviewDrafts", {
          agentRunId,
          graphName: "hypothesis-drafter",
          kind: "hypothesis_draft",
          title: `Pending hypothesis ${index}`,
          summary: "Fixture draft",
          candidateIds: [],
          status: "pending_review",
          createdBy: "agent",
          createdAt: NOW - (9 - index) * DAY_MS,
          updatedAt: NOW - (8 - index) * DAY_MS,
        });
      }
      await ctx.db.insert("agentReviewDrafts", {
        agentRunId,
        graphName: "hypothesis-drafter",
        kind: "recipe_draft",
        title: "Pending recipe does not consume hypothesis WIP",
        summary: "Fixture draft",
        candidateIds: [],
        status: "pending_review",
        createdBy: "agent",
        createdAt: NOW - 20 * DAY_MS,
        updatedAt: NOW - 20 * DAY_MS,
      });

      const hypothesisId = await ctx.db.insert("hypotheses", {
        title: "Fixture hypothesis",
        question: "What does the fixture test?",
        hypothesis: "It tests loop debt",
        rationaleMd: "Fixture",
        sourceIds: [],
        status: "active",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      const insertRecipe = async (title: string, updatedAt: number) =>
        await ctx.db.insert("recipes", {
          hypothesisId,
          title,
          bodyMd: "Fixture recipe",
          parameters: [],
          dawChecklist: [],
          status: "in_use",
          visibility: "private",
          createdBy: "system",
          createdAt: updatedAt,
          updatedAt,
        });
      const noCompositionRecipeId = await insertRecipe(
        "No composition",
        NOW - 4 * DAY_MS,
      );
      const boundaryRecipeId = await insertRecipe(
        "Exactly at boundary",
        NOW - 30 * DAY_MS,
      );
      const overdueRecipeId = await insertRecipe(
        "Just over boundary",
        NOW - 30 * DAY_MS,
      );
      const listenedRecipeId = await insertRecipe(
        "Already listened",
        NOW - 30 * DAY_MS,
      );
      const ideaRecipeId = await insertRecipe(
        "Composition not rendered",
        NOW - 30 * DAY_MS,
      );
      const oldRenderedRecipeId = await insertRecipe(
        "Old rendered composition",
        NOW - 30 * DAY_MS,
      );

      const insertComposition = async (
        recipeId: typeof boundaryRecipeId,
        title: string,
        status: "idea" | "rendered",
        createdAt: number,
      ) =>
        await ctx.db.insert("compositions", {
          recipeId,
          title,
          artifactType: "microStudy",
          version: "v0.1",
          status,
          visibility: "private",
          createdBy: "system",
          createdAt,
          updatedAt: createdAt,
        });
      await insertComposition(
        boundaryRecipeId,
        "Boundary render",
        "rendered",
        NOW - LISTENING_DEBT_AFTER_MS,
      );
      await insertComposition(
        overdueRecipeId,
        "Overdue render",
        "rendered",
        NOW - LISTENING_DEBT_AFTER_MS - 1,
      );
      const listenedCompositionId = await insertComposition(
        listenedRecipeId,
        "Listened render",
        "rendered",
        NOW - 18 * DAY_MS,
      );
      await insertComposition(
        ideaRecipeId,
        "Unrendered composition",
        "idea",
        NOW - 20 * DAY_MS,
      );
      await insertComposition(
        oldRenderedRecipeId,
        "Old render",
        "rendered",
        NOW - 20 * DAY_MS,
      );
      await ctx.db.insert("listeningSessions", {
        compositionId: listenedCompositionId,
        participants: [],
        ratings: {},
        feedbackMd: "Fixture feedback",
        visibility: "private",
        createdBy: "system",
        createdAt: NOW - 17 * DAY_MS,
      });

      const proposedFeedId = await ctx.db.insert("feeds", {
        name: "Proposed research feed",
        url: "https://example.com/proposed.xml",
        type: "rss",
        enabled: false,
        metadata: {
          proposal: {
            agentRunId,
            rationale: "Closes a gap in cymatics coverage",
            sampleItems: [
              {
                title: "Cymatics primer",
                url: "https://example.com/cymatics",
                snippet: "Standing-wave imagery",
              },
            ],
          },
        },
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("feeds", {
        name: "Enabled proposal",
        url: "https://example.com/enabled.xml",
        type: "rss",
        enabled: true,
        metadata: {
          proposal: {
            agentRunId,
            rationale: "Already enabled",
            sampleItems: [],
          },
        },
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("feeds", {
        name: "Malformed proposal",
        url: "https://example.com/malformed.xml",
        type: "rss",
        enabled: false,
        metadata: { proposal: { rationale: 42 } },
        createdAt: 1,
        updatedAt: 1,
      });

      return {
        autoRetiredId,
        contradictedId,
        gainedId,
        manualRetiredId,
        newId,
        noCompositionRecipeId,
        oldRenderedRecipeId,
        overdueRecipeId,
        proposedFeedId,
      };
    });

    const report = await t.run((ctx) => computeLoopReport(ctx.db, NOW));

    expect(report.correspondences).toEqual({
      newConjectures: 2,
      gainedEvidence: 3,
      contradicted: 1,
      autoRetired: 1,
      topMovers: [
        {
          correspondenceId: fixture.gainedId,
          statement: "Gained two evidence citations",
          status: "evidenced",
          evidenceDelta: 2,
        },
        {
          correspondenceId: fixture.contradictedId,
          statement: "Became contradicted",
          status: "contradicted",
          evidenceDelta: 1,
        },
        {
          correspondenceId: fixture.autoRetiredId,
          statement: "Retired automatically",
          status: "retired",
          evidenceDelta: 0,
        },
        {
          correspondenceId: fixture.newId,
          statement: "New conjecture",
          status: "conjectured",
          evidenceDelta: 0,
        },
        {
          correspondenceId: fixture.manualRetiredId,
          statement: "Retired manually",
          status: "retired",
          evidenceDelta: 0,
        },
      ],
    });
    expect(report.reviewQueue).toEqual({
      pendingDrafts: PENDING_DRAFT_CAP,
      cap: PENDING_DRAFT_CAP,
      agentBlocked: true,
      oldestPendingDays: 8,
    });
    expect(report.experimentDebt).toEqual([
      {
        recipeId: fixture.oldRenderedRecipeId,
        title: "Old rendered composition",
        state: "composed_no_listening",
        ageDays: 20,
      },
      {
        recipeId: fixture.overdueRecipeId,
        title: "Just over boundary",
        state: "composed_no_listening",
        ageDays: 14,
      },
      {
        recipeId: fixture.noCompositionRecipeId,
        title: "No composition",
        state: "in_use_no_composition",
        ageDays: 4,
      },
    ]);
    expect(report.proposedFeeds).toEqual([
      {
        feedId: fixture.proposedFeedId,
        name: "Proposed research feed",
        url: "https://example.com/proposed.xml",
        rationale: "Closes a gap in cymatics coverage",
      },
    ]);
  });
});
