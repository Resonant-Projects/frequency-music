import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import type { Id } from "./_generated/dataModel";
import {
  REJECTED_DRAFT_REST_MS,
  restingCorrespondenceIds,
} from "./draftTargetExclusions";
import schema from "./schema";

const NOW = 1_800_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

type DraftSeed = {
  kind?: "hypothesis_draft" | "recipe_draft";
  status: "pending_review" | "approved" | "rejected";
  updatedAt?: number;
};

/** One Correspondence with one hypothesis-shaped draft that names it. */
async function seedDraftedCorrespondence(
  t: ReturnType<typeof convexTest>,
  draft: DraftSeed,
): Promise<string> {
  return await t.run(async (ctx) => {
    const concept = (name: string) =>
      ctx.db.insert("concepts", {
        name,
        displayName: name,
        aliases: [],
        domain: "cymatics",
        domains: ["cymatics"],
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
    const [conceptAId, conceptBId] = [await concept("a"), await concept("b")];
    const correspondenceId: Id<"correspondences"> = await ctx.db.insert(
      "correspondences",
      {
        conceptAId,
        conceptBId,
        pairKey: `${conceptAId}:${conceptBId}`,
        statement: "Modal spacing tracks roughness.",
        rationaleMd: "Test rationale.",
        evidence: [],
        status: "conjectured",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      },
    );
    const agentRunId = await ctx.db.insert("agentRuns", {
      graphName: "hypothesis-drafter",
      status: "running",
      input: null,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("agentReviewDrafts", {
      agentRunId,
      graphName: "hypothesis-drafter",
      kind: draft.kind ?? "hypothesis_draft",
      title: "Draft",
      summary: "Draft summary",
      candidateIds: [correspondenceId],
      payload: {
        title: "Modal roughness",
        question: "Does modal spacing predict roughness?",
        statement: "Closer modes sound rougher.",
        rationale: "Test rationale.",
        whyThisMatters: "Links cymatics to a listening prediction.",
        sourceIds: [],
        extractionIds: [],
        correspondenceId,
      },
      status: draft.status,
      createdBy: "agent",
      createdAt: 1,
      updatedAt: draft.updatedAt ?? NOW - DAY_MS,
    });
    return String(correspondenceId);
  });
}

async function restsAfter(draft: DraftSeed) {
  const t = convexTest(schema, modules);
  const correspondenceId = await seedDraftedCorrespondence(t, draft);
  // t.run returns Convex values only, so the Set crosses as an array.
  const resting = await t.run(async (ctx) => [
    ...(await restingCorrespondenceIds(ctx, NOW)),
  ]);
  return resting.includes(correspondenceId);
}

describe("restingCorrespondenceIds", () => {
  test("a draft awaiting review rests its Correspondence", async () => {
    expect(await restsAfter({ status: "pending_review" })).toBe(true);
  });

  test("a draft rejected one day ago rests its Correspondence", async () => {
    expect(
      await restsAfter({ status: "rejected", updatedAt: NOW - DAY_MS }),
    ).toBe(true);
  });

  test("a draft rejected 29 days ago no longer rests its Correspondence", async () => {
    expect(REJECTED_DRAFT_REST_MS).toBe(28 * DAY_MS);
    expect(
      await restsAfter({ status: "rejected", updatedAt: NOW - 29 * DAY_MS }),
    ).toBe(false);
  });

  test("an approved draft is left to the existing-hypothesis check", async () => {
    expect(await restsAfter({ status: "approved" })).toBe(false);
  });

  test("a recipe draft never rests a Correspondence", async () => {
    for (const status of ["pending_review", "rejected"] as const) {
      expect(await restsAfter({ kind: "recipe_draft", status })).toBe(false);
    }
  });
});
