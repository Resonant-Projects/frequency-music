import { describe, expect, test } from "vite-plus/test";
import type { Doc } from "./_generated/dataModel";
import {
  computeRecommendedActionContext,
  isCampaignVisibleToViewer,
  listCampaignSelectionRows,
} from "./campaigns";
import { makeDb } from "./testHelpers";

describe("campaign recommendation context", () => {
  test("prefers untested recipes and recipe-less active hypotheses inside the active campaign", async () => {
    const campaignId = "campaign-1" as Doc<"campaigns">["_id"];
    const thesisId = "thesis-1" as Doc<"theses">["_id"];
    const hypothesisWithRecipeId = "hyp-1" as Doc<"hypotheses">["_id"];
    const hypothesisWithoutRecipeId = "hyp-2" as Doc<"hypotheses">["_id"];
    const contradictedHypothesisId = "hyp-3" as Doc<"hypotheses">["_id"];
    const recipeId = "recipe-1" as Doc<"recipes">["_id"];

    const db = makeDb({
      campaigns: [
        {
          _id: campaignId,
          title: "Campaign",
          question: "What should survive?",
          thesisIds: [thesisId],
          status: "active",
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 10,
        },
      ],
      theses: [
        {
          _id: thesisId,
          title: "Thesis",
          statement: "Test the drift idea",
          status: "active",
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 10,
        },
      ],
      hypotheses: [
        {
          _id: hypothesisWithRecipeId,
          title: "Recipe-backed hypothesis",
          question: "Q1",
          hypothesis: "H1",
          rationaleMd: "R1",
          thesisId,
          sourceIds: [],
          status: "active",
          visibility: "private",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 10,
        },
        {
          _id: hypothesisWithoutRecipeId,
          title: "No recipe hypothesis",
          question: "Q2",
          hypothesis: "H2",
          rationaleMd: "R2",
          thesisId,
          sourceIds: [],
          status: "active",
          visibility: "private",
          createdBy: "system",
          createdAt: 2,
          updatedAt: 11,
        },
        {
          _id: contradictedHypothesisId,
          title: "Contradicted hypothesis",
          question: "Q3",
          hypothesis: "H3",
          rationaleMd: "R3",
          thesisId,
          sourceIds: [],
          status: "evaluated",
          resolution: "contradicted",
          visibility: "private",
          createdBy: "system",
          createdAt: 3,
          updatedAt: 12,
        },
      ],
      recipes: [
        {
          _id: recipeId,
          hypothesisId: hypothesisWithRecipeId,
          title: "Untested recipe",
          bodyMd: "Body",
          parameters: [],
          dawChecklist: [],
          status: "draft",
          visibility: "private",
          createdBy: "system",
          createdAt: 3,
          updatedAt: 12,
        },
      ],
      compositions: [],
      listeningSessions: [],
    });

    const result = await computeRecommendedActionContext(db as any, {
      campaignId,
      limit: 5,
    });

    expect(result.campaign?._id).toBe(campaignId);
    expect(
      result.actions.some((action) => action.kind === "advance_recipe"),
    ).toBe(true);
    expect(
      result.actions.some(
        (action) =>
          action.kind === "prototype_hypothesis" &&
          action.targetId === hypothesisWithoutRecipeId,
      ),
    ).toBe(true);
    expect(
      result.actions.some(
        (action) => action.targetId === contradictedHypothesisId,
      ),
    ).toBe(false);
  });

  test("returns every campaign for selection instead of truncating at twenty", async () => {
    const campaigns = Array.from({ length: 24 }, (_, index) => ({
      _id: `campaign-${index + 1}` as Doc<"campaigns">["_id"],
      title: `Campaign ${index + 1}`,
      question: `Question ${index + 1}`,
      thesisIds: [],
      status: "paused" as const,
      visibility: "public" as const,
      createdBy: "system" as const,
      createdAt: index + 1,
      updatedAt: index + 1,
    }));

    const db = makeDb({
      campaigns,
      theses: [],
      hypotheses: [],
      recipes: [],
      compositions: [],
      listeningSessions: [],
    });

    const result = await listCampaignSelectionRows(db as any);

    expect(result).toHaveLength(24);
    expect(result[0]?._id).toBe("campaign-24");
    expect(result.at(-1)?._id).toBe("campaign-1");
  });

  test("keeps active campaigns with no theses empty-scoped", async () => {
    const campaignId = "campaign-empty" as Doc<"campaigns">["_id"];
    const unrelatedHypothesisId = "hyp-unrelated" as Doc<"hypotheses">["_id"];

    const db = makeDb({
      campaigns: [
        {
          _id: campaignId,
          title: "Empty campaign",
          question: "What should I attach?",
          thesisIds: [],
          status: "active",
          visibility: "public",
          createdBy: "system",
          createdAt: 1,
          updatedAt: 10,
        },
      ],
      theses: [],
      hypotheses: [
        {
          _id: unrelatedHypothesisId,
          title: "Unrelated hypothesis",
          question: "Q1",
          hypothesis: "H1",
          rationaleMd: "R1",
          sourceIds: [],
          status: "active",
          visibility: "public",
          createdBy: "system",
          createdAt: 2,
          updatedAt: 11,
        },
      ],
      recipes: [],
      compositions: [],
      listeningSessions: [],
    });

    const result = await computeRecommendedActionContext(db as any);

    expect(result.campaign?._id).toBe(campaignId);
    expect(result.theses).toHaveLength(0);
    expect(result.hypotheses).toHaveLength(0);
    expect(result.recipes).toHaveLength(0);
    expect(result.actions).toHaveLength(0);
  });
});

describe("campaign visibility", () => {
  const publicCampaign = {
    visibility: "public",
    createdBy: "system",
  } as const;
  const followersCampaign = {
    visibility: "followers",
    createdBy: "system",
  } as const;
  const privateCampaign = {
    visibility: "private",
    createdBy: "user-1",
  } as const;

  test("allows anonymous viewers to read public campaigns", () => {
    expect(isCampaignVisibleToViewer(publicCampaign as any, null)).toBe(true);
  });

  test("blocks anonymous viewers from follower and private campaigns", () => {
    expect(isCampaignVisibleToViewer(followersCampaign as any, null)).toBe(
      false,
    );
    expect(isCampaignVisibleToViewer(privateCampaign as any, null)).toBe(false);
  });

  test("allows authenticated non-owners to read follower campaigns", () => {
    expect(
      isCampaignVisibleToViewer(followersCampaign as any, {
        subject: "user-2",
        isBypass: false,
      }),
    ).toBe(true);
  });

  test("blocks authenticated non-owners from private campaigns", () => {
    expect(
      isCampaignVisibleToViewer(privateCampaign as any, {
        subject: "user-2",
        isBypass: false,
      }),
    ).toBe(false);
  });

  test("allows private campaign owners and bypass viewers", () => {
    expect(
      isCampaignVisibleToViewer(privateCampaign as any, {
        subject: "user-1",
        isBypass: false,
      }),
    ).toBe(true);
    expect(
      isCampaignVisibleToViewer(privateCampaign as any, {
        subject: "system",
        isBypass: true,
      }),
    ).toBe(true);
  });
});
