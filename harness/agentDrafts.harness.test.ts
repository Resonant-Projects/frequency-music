import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "./modules";

async function seedRunAndDraft(
  t: ReturnType<typeof convexTest>,
  payload: Record<string, unknown> | undefined,
  kind: "hypothesis_draft" | "recipe_draft",
) {
  return await t.run(async (ctx) => {
    const agentRunId = await ctx.db.insert("agentRuns", {
      graphName: "research-pipeline",
      status: "needs_review",
      input: null,
      traceUrl: "https://smith.langchain.com/r/test",
      createdAt: 1000,
      updatedAt: 1000,
    });
    const draftId = await ctx.db.insert("agentReviewDrafts", {
      agentRunId,
      graphName: "research-pipeline",
      kind,
      title: "Draft title",
      summary: "Draft summary",
      candidateIds: [],
      ...(payload ? { payload } : {}),
      status: "pending_review" as const,
      createdBy: "agent" as const,
      createdAt: 1000,
      updatedAt: 1000,
    });
    return { agentRunId, draftId };
  });
}

const hypothesisPayload = {
  title: "Polygon-angle correspondence in 9-EDO",
  question: "Do nonagon interior angles map to consonant 9-EDO intervals?",
  statement: "Nonagon angles map to low-roughness 9-EDO dyads",
  rationale: "Angle/cents correspondence from extraction",
  whyThisMatters:
    "Connects the geometric temperament work to a testable dyad-roughness prediction.",
  sourceIds: [],
  extractionIds: [],
};

describe("agentDrafts.approve promotes through the real interface", () => {
  test("correspondence-linked hypothesis draft preserves lineage on promotion", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const correspondenceId = await t.run(async (ctx) => {
      const conceptAId = await ctx.db.insert("concepts", {
        name: "nonagon angles",
        displayName: "Nonagon angles",
        aliases: [],
        domain: "geometry",
        domains: ["geometry"],
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const conceptBId = await ctx.db.insert("concepts", {
        name: "9-EDO",
        displayName: "9-EDO",
        aliases: [],
        domain: "microtuning",
        domains: ["microtuning"],
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      return await ctx.db.insert("correspondences", {
        conceptAId,
        conceptBId,
        pairKey: `${conceptAId}:${conceptBId}`,
        statement: "Nonagon angles may map to 9-EDO intervals.",
        rationaleMd: "Seeded correspondence for promotion coverage.",
        evidence: [],
        status: "conjectured",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const { agentRunId, draftId } = await seedRunAndDraft(
      t,
      { ...hypothesisPayload, correspondenceId },
      "hypothesis_draft",
    );

    const result = await asSystem.mutation(api.agentDrafts.approve, {
      draftId,
    });

    expect(result.promotedKind).toBe("hypothesis");
    const hypothesis = await t.run((ctx) =>
      ctx.db.get(result.promotedId as Id<"hypotheses">),
    );
    expect(hypothesis?.origin).toBe("agent");
    expect(hypothesis?.agentRunId).toBe(agentRunId);
    expect(hypothesis?.agentDraftId).toBe(draftId);
    expect(hypothesis?.traceUrl).toBe("https://smith.langchain.com/r/test");
    expect(hypothesis?.hypothesis).toBe(hypothesisPayload.statement);
    expect(hypothesis?.correspondenceId).toBe(correspondenceId);

    const draft = await t.run((ctx) => ctx.db.get(draftId));
    expect(draft?.status).toBe("approved");
    expect(draft?.promotedId).toBe(result.promotedId);
    expect(draft?.decidedBy).toBe("human");
    const run = await t.run((ctx) => ctx.db.get(agentRunId));
    expect(run?.status).toBe("completed");

    const events = await t.run((ctx) =>
      ctx.db
        .query("agentRunEvents")
        .withIndex("by_runId_createdAt", (q) => q.eq("runId", agentRunId))
        .collect(),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        kind: "decision",
        payload: expect.objectContaining({
          correspondenceId,
          hypothesisId: result.promotedId,
          draftId,
        }),
      }),
    );
  });

  test("recipe draft becomes a recipes row with generated parameter kind", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const hypothesisId = await t.run((ctx) =>
      ctx.db.insert("hypotheses", {
        title: "432Hz warmth hypothesis",
        question: "Does 432Hz tuning change perceived warmth?",
        hypothesis: "Retuning to 432Hz increases perceived warmth",
        rationaleMd: "Seeded for recipe promotion harness coverage",
        sourceIds: [],
        status: "draft",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      }),
    );
    const { agentRunId, draftId } = await seedRunAndDraft(
      t,
      {
        hypothesisId,
        title: "432Hz warmth litmus",
        parameters: [
          { kind: "tuning", type: "tuning", value: "432Hz reference" },
        ],
        whyThisMatters: "Tests an audible prediction from the hypothesis.",
      },
      "recipe_draft",
    );

    const result = await asSystem.mutation(api.agentDrafts.approve, {
      draftId,
    });

    expect(result.promotedKind).toBe("recipe");
    const recipe = await t.run((ctx) =>
      ctx.db.get(result.promotedId as Id<"recipes">),
    );
    expect(recipe?.hypothesisId).toBe(hypothesisId);
    expect(recipe?.parameters[0]!.kind).toBe("tuning");
    expect(recipe?.origin).toBe("agent");
    expect(recipe?.agentRunId).toBe(agentRunId);
    expect(recipe?.agentDraftId).toBe(draftId);
  });

  test("payload-less draft is acknowledge-only: approve throws INVALID_STATE", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { draftId } = await seedRunAndDraft(t, undefined, "hypothesis_draft");

    await expect(
      asSystem.mutation(api.agentDrafts.approve, { draftId }),
    ).rejects.toThrow(/acknowledge-only|INVALID_STATE/);
  });

  test("approve on an already-decided draft throws", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { draftId } = await seedRunAndDraft(
      t,
      hypothesisPayload,
      "hypothesis_draft",
    );
    await asSystem.mutation(api.agentDrafts.approve, { draftId });

    await expect(
      asSystem.mutation(api.agentDrafts.approve, { draftId }),
    ).rejects.toThrow();
  });
});

describe("agentDrafts pending hypothesis WIP cap", () => {
  test("blocks the fourth hypothesis draft, ignores recipes, and reopens after approval", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const agentRunId = await t.run((ctx) =>
      ctx.db.insert("agentRuns", {
        graphName: "hypothesis-drafter",
        status: "needs_review",
        input: null,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const createDraft = async (
      kind: "hypothesis_draft" | "recipe_draft",
      suffix: string,
    ) =>
      await t.mutation(internal.agentDrafts.createFromAgentRun, {
        agentRunId,
        draft: {
          kind,
          title: `${kind} ${suffix}`,
          summary: `Cap harness ${suffix}`,
          candidateIds: [`candidate-${suffix}`],
          needsReview: true,
          ...(kind === "hypothesis_draft"
            ? {
                payload: {
                  ...hypothesisPayload,
                  title: `Hypothesis ${suffix}`,
                },
              }
            : {}),
        },
      });

    const first = await createDraft("hypothesis_draft", "1");
    await createDraft("hypothesis_draft", "2");
    await createDraft("hypothesis_draft", "3");

    await expect(createDraft("hypothesis_draft", "4-blocked")).rejects.toThrow(
      /DraftCapExceeded/,
    );
    await expect(createDraft("recipe_draft", "recipe")).resolves.toMatchObject({
      status: "pending_review",
    });
    await expect(
      t.query(internal.agentDrafts.countPending, { kind: "hypothesis_draft" }),
    ).resolves.toBe(3);
    await expect(
      t.query(internal.agentDrafts.countPending, { kind: "recipe_draft" }),
    ).resolves.toBe(1);

    await asSystem.mutation(api.agentDrafts.approve, {
      draftId: first.draftId,
    });
    await expect(
      createDraft("hypothesis_draft", "4-reopened"),
    ).resolves.toMatchObject({ status: "pending_review" });
  });
});

describe("agentDrafts.getReviewContext", () => {
  test("hydrates the correspondence story and bounded related work", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const correspondenceId = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "url",
        title: "Auditory geometry study",
        canonicalUrl: "https://example.test/auditory-geometry",
        status: "extracted",
        dedupeKey: "auditory-geometry",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      const extractionId = await ctx.db.insert("extractions", {
        sourceId,
        model: "test-model",
        promptVersion: "test",
        inputHash: "review-context",
        summary: "Review-context evidence.",
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
        text: "Ninefold geometry produces a measurable tuning relation.",
        evidenceLevel: "peer_reviewed",
        truthConfidence: "high",
        citations: [],
        status: "active",
        createdBy: "system",
        createdAt: 1,
      });
      const conceptAId = await ctx.db.insert("concepts", {
        name: "ninefold geometry",
        displayName: "Ninefold geometry",
        description: "Geometry organized around ninefold symmetry.",
        aliases: [],
        domain: "geometry",
        domains: ["geometry"],
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      const conceptBId = await ctx.db.insert("concepts", {
        name: "nine edo",
        displayName: "9-EDO",
        description: "Equal division of the octave into nine steps.",
        aliases: [],
        domain: "microtuning",
        domains: ["microtuning", "psychoacoustics"],
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      const seededCorrespondenceId = await ctx.db.insert("correspondences", {
        conceptAId,
        conceptBId,
        pairKey: `${conceptAId}:${conceptBId}`,
        statement: "Ninefold geometry may organize audible 9-EDO relations.",
        rationaleMd:
          "The shared ninefold structure motivates a listening test.",
        evidence: [
          {
            claimId,
            stance: "supports",
            addedBy: "human",
            addedAt: 1,
          },
        ],
        status: "evidenced",
        similarityScore: 0.82,
        noveltyScore: 0.71,
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("hypotheses", {
        title: "Earlier ninefold listening test",
        question: "Did the first test work?",
        hypothesis: "The first test predicts a clear preference.",
        rationaleMd: "Seeded prior work.",
        correspondenceId: seededCorrespondenceId,
        sourceIds: [],
        status: "retired",
        resolution: "contradicted",
        visibility: "private",
        createdBy: "system",
        createdAt: 2,
        updatedAt: 2,
      });
      return seededCorrespondenceId;
    });
    const seeded = await seedRunAndDraft(
      t,
      { ...hypothesisPayload, correspondenceId },
      "hypothesis_draft",
    );
    await t.run((ctx) =>
      ctx.db.patch(seeded.agentRunId, {
        summary: "Drafted from the strongest evidenced correspondence.",
      }),
    );

    const result = await asSystem.query(api.agentDrafts.getReviewContext, {
      draftId: seeded.draftId,
    });

    expect(result.draft._id).toBe(seeded.draftId);
    expect(result.correspondence?.row._id).toBe(correspondenceId);
    expect(result.correspondence?.conceptA).toEqual({
      displayName: "Ninefold geometry",
      description: "Geometry organized around ninefold symmetry.",
      domains: ["geometry"],
    });
    expect(result.correspondence?.evidence).toEqual([
      {
        claim: {
          text: "Ninefold geometry produces a measurable tuning relation.",
          evidenceLevel: "peer_reviewed",
          truthConfidence: "high",
        },
        stance: "supports",
        sourceTitle: "Auditory geometry study",
        sourceUrl: "https://example.test/auditory-geometry",
      },
    ]);
    expect(result.related.priorHypotheses).toEqual([
      {
        title: "Earlier ninefold listening test",
        status: "retired",
        resolution: "contradicted",
      },
    ]);
    expect(result.related.failures).toEqual([
      {
        title: "Earlier ninefold listening test",
        reason: "contradicted_hypothesis",
      },
      {
        title: "Earlier ninefold listening test",
        reason: "retired_hypothesis",
      },
    ]);
    expect(result.runTrace).toMatchObject({
      traceUrl: "https://smith.langchain.com/r/test",
      summary: "Drafted from the strongest evidenced correspondence.",
    });
  });

  test("legacy payload-less and correspondence-less drafts return null context", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const payloadless = await seedRunAndDraft(t, undefined, "hypothesis_draft");
    const correspondenceLess = await seedRunAndDraft(
      t,
      hypothesisPayload,
      "hypothesis_draft",
    );

    for (const draftId of [payloadless.draftId, correspondenceLess.draftId]) {
      const result = await asSystem.query(api.agentDrafts.getReviewContext, {
        draftId,
      });
      expect(result.correspondence).toBeNull();
      expect(result.related).toEqual({ priorHypotheses: [], failures: [] });
      expect(result.runTrace.runId).toBeDefined();
    }
  });
});

describe("agentDrafts draftable correspondence read", () => {
  test("excludes targets without evidence, with an existing hypothesis, or with a pending draft", async () => {
    const t = convexTest(schema, modules);
    const {
      agentRunId: seededRunId,
      eligibleId,
      pendingId: seededPendingId,
      pendingDraftId,
    } = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "url",
        title: "Roughness study",
        status: "extracted",
        dedupeKey: "roughness-study",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      const extractionId = await ctx.db.insert("extractions", {
        sourceId,
        model: "test-model",
        promptVersion: "test",
        inputHash: "roughness-input",
        summary: "Roughness evidence.",
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
        text: "Closer partial spacing increased measured roughness.",
        evidenceLevel: "peer_reviewed",
        citations: [],
        status: "active",
        createdBy: "system",
        createdAt: 1,
      });
      const conceptAId = await ctx.db.insert("concepts", {
        name: "modal spacing",
        displayName: "Modal spacing",
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
        name: "auditory roughness",
        displayName: "Auditory roughness",
        aliases: [],
        domain: "psychoacoustics",
        domains: ["psychoacoustics"],
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const makeCorrespondence = (suffix: string, withEvidence = true) =>
        ctx.db.insert("correspondences", {
          conceptAId,
          conceptBId,
          pairKey: `${conceptAId}:${conceptBId}:${suffix}`,
          statement: `Correspondence ${suffix}`,
          rationaleMd: "Harness rationale.",
          evidence: withEvidence
            ? [
                {
                  claimId,
                  stance: "supports" as const,
                  addedBy: "human" as const,
                  addedAt: 1,
                },
              ]
            : [],
          status: withEvidence
            ? ("evidenced" as const)
            : ("conjectured" as const),
          similarityScore: 0.8,
          noveltyScore: 0.7,
          createdBy: "system" as const,
          createdAt: 1,
          updatedAt: 1,
        });
      const existingId = await makeCorrespondence("existing");
      const pendingId = await makeCorrespondence("pending");
      const draftableId = await makeCorrespondence("eligible");
      await makeCorrespondence("no-evidence", false);
      await ctx.db.insert("hypotheses", {
        title: "Existing hypothesis",
        question: "Already drafted?",
        hypothesis: "Already covered.",
        rationaleMd: "Existing lineage.",
        sourceIds: [],
        status: "draft" as const,
        visibility: "private" as const,
        createdBy: "system" as const,
        createdAt: 1,
        updatedAt: 1,
        correspondenceId: existingId,
      });
      const agentRunId = await ctx.db.insert("agentRuns", {
        graphName: "hypothesis-drafter",
        status: "running",
        input: null,
        createdAt: 1,
        updatedAt: 1,
      });
      const createdPendingDraftId = await ctx.db.insert("agentReviewDrafts", {
        agentRunId,
        graphName: "hypothesis-drafter",
        kind: "hypothesis_draft",
        title: "Pending hypothesis",
        summary: "Already awaiting review.",
        candidateIds: [pendingId],
        payload: { ...hypothesisPayload, correspondenceId: pendingId },
        status: "pending_review",
        createdBy: "agent",
        createdAt: 1,
        updatedAt: 1,
      });
      return {
        agentRunId,
        eligibleId: draftableId,
        pendingId,
        pendingDraftId: createdPendingDraftId,
      };
    });

    const rows = await t.query(
      internal.agentDrafts.listDraftableCorrespondences,
      {
        limit: 20,
      },
    );
    expect(rows.map((row) => row.correspondenceId)).toEqual([eligibleId]);

    await expect(
      t.mutation(internal.agentDrafts.createFromAgentRun, {
        agentRunId: seededRunId,
        draft: {
          kind: "hypothesis_draft",
          title: "Duplicate target",
          summary: "Must not enter the review queue.",
          candidateIds: [seededPendingId],
          needsReview: true,
          payload: {
            ...hypothesisPayload,
            correspondenceId: seededPendingId,
          },
        },
      }),
    ).resolves.toMatchObject({ draftId: pendingDraftId });

    const competingRunId = await t.run((ctx) =>
      ctx.db.insert("agentRuns", {
        graphName: "hypothesis-drafter",
        status: "running",
        input: null,
        createdAt: 2,
        updatedAt: 2,
      }),
    );
    await expect(
      t.mutation(internal.agentDrafts.createFromAgentRun, {
        agentRunId: competingRunId,
        draft: {
          kind: "hypothesis_draft",
          title: "Duplicate target",
          summary: "Must not enter the review queue.",
          candidateIds: [seededPendingId],
          needsReview: true,
          payload: {
            ...hypothesisPayload,
            correspondenceId: seededPendingId,
          },
        },
      }),
    ).rejects.toThrow(/DraftTargetUnavailable/);
  });

  test("honors requested limits above the default of twenty", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "url",
        title: "Limit study",
        status: "extracted",
        dedupeKey: "limit-study",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      });
      const extractionId = await ctx.db.insert("extractions", {
        sourceId,
        model: "test-model",
        promptVersion: "test",
        inputHash: "limit-input",
        summary: "Limit evidence.",
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
        text: "Limit evidence claim.",
        evidenceLevel: "peer_reviewed",
        citations: [],
        status: "active",
        createdBy: "system",
        createdAt: 1,
      });
      const conceptAId = await ctx.db.insert("concepts", {
        name: "limit concept a",
        displayName: "Limit concept A",
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
        name: "limit concept b",
        displayName: "Limit concept B",
        aliases: [],
        domain: "psychoacoustics",
        domains: ["psychoacoustics"],
        missionRelevance: "on",
        mentionCount: 1,
        hypothesisCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      for (let index = 0; index < 25; index += 1) {
        await ctx.db.insert("correspondences", {
          conceptAId,
          conceptBId,
          pairKey: `${conceptAId}:${conceptBId}:${String(index)}`,
          statement: `Correspondence ${String(index)}`,
          rationaleMd: "Harness rationale.",
          evidence: [
            {
              claimId,
              stance: "supports",
              addedBy: "human",
              addedAt: 1,
            },
          ],
          status: "evidenced",
          createdBy: "system",
          createdAt: index + 1,
          updatedAt: index + 1,
        });
      }
    });

    await expect(
      t.query(internal.agentDrafts.listDraftableCorrespondences, {}),
    ).resolves.toHaveLength(20);
    await expect(
      t.query(internal.agentDrafts.listDraftableCorrespondences, { limit: 25 }),
    ).resolves.toHaveLength(25);
  });
});

describe("agentDrafts.reject requires a decision note", () => {
  test("reject stores the note and an audit event", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { agentRunId, draftId } = await seedRunAndDraft(
      t,
      hypothesisPayload,
      "hypothesis_draft",
    );

    await asSystem.mutation(api.agentDrafts.reject, {
      draftId,
      decisionNote: "Statement is not falsifiable as written.",
    });

    const draft = await t.run((ctx) => ctx.db.get(draftId));
    expect(draft?.status).toBe("rejected");
    expect(draft?.decisionNote).toBe(
      "Statement is not falsifiable as written.",
    );

    const events = await t.run((ctx) =>
      ctx.db
        .query("agentRunEvents")
        .withIndex("by_runId_createdAt", (q) => q.eq("runId", agentRunId))
        .collect(),
    );
    expect(events.some((event) => event.kind === "decision")).toBe(true);
    const run = await t.run((ctx) => ctx.db.get(agentRunId));
    expect(run?.status).toBe("completed");
  });

  test("reject with a whitespace note throws", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { draftId } = await seedRunAndDraft(
      t,
      hypothesisPayload,
      "hypothesis_draft",
    );

    await expect(
      asSystem.mutation(api.agentDrafts.reject, {
        draftId,
        decisionNote: "  ",
      }),
    ).rejects.toThrow();
  });

  test("keeps the run in review until its final pending draft is resolved", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { agentRunId, draftId } = await seedRunAndDraft(
      t,
      hypothesisPayload,
      "hypothesis_draft",
    );
    const secondDraftId = await t.run((ctx) =>
      ctx.db.insert("agentReviewDrafts", {
        agentRunId,
        graphName: "research-pipeline",
        kind: "hypothesis_draft",
        title: "Second draft",
        summary: "Second pending review",
        candidateIds: [],
        payload: hypothesisPayload,
        status: "pending_review",
        createdBy: "agent",
        createdAt: 1100,
        updatedAt: 1100,
      }),
    );

    await asSystem.mutation(api.agentDrafts.reject, {
      draftId,
      decisionNote: "Not ready to promote.",
    });

    const stillPending = await t.run((ctx) => ctx.db.get(agentRunId));
    expect(stillPending?.status).toBe("needs_review");

    await asSystem.mutation(api.agentDrafts.reject, {
      draftId: secondDraftId,
      decisionNote: "Also not ready to promote.",
    });
    const completed = await t.run((ctx) => ctx.db.get(agentRunId));
    expect(completed?.status).toBe("completed");
    expect(completed?.finishedAt).toBeDefined();
  });
});

describe("agentDrafts.supersede closes the resolved draft's run", () => {
  test("completes the original run when its superseding draft belongs to another run", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const original = await seedRunAndDraft(
      t,
      hypothesisPayload,
      "hypothesis_draft",
    );
    const replacement = await seedRunAndDraft(
      t,
      hypothesisPayload,
      "hypothesis_draft",
    );

    await asSystem.mutation(api.agentDrafts.supersede, {
      draftId: original.draftId,
      byDraftId: replacement.draftId,
    });

    const runs = await t.run(async (ctx) => ({
      original: await ctx.db.get(original.agentRunId),
      replacement: await ctx.db.get(replacement.agentRunId),
    }));
    expect(runs.original?.status).toBe("completed");
    expect(runs.replacement?.status).toBe("needs_review");
  });
});
