import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { api } from "../convex/_generated/api";
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
  test("hypothesis draft becomes a hypotheses row with agent provenance", async () => {
    const t = convexTest(schema, modules);
    const asSystem = t.withIdentity({ subject: "system" });
    const { agentRunId, draftId } = await seedRunAndDraft(
      t,
      hypothesisPayload,
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

    const draft = await t.run((ctx) => ctx.db.get(draftId));
    expect(draft?.status).toBe("approved");
    expect(draft?.promotedId).toBe(result.promotedId);
    expect(draft?.decidedBy).toBe("human");
    const run = await t.run((ctx) => ctx.db.get(agentRunId));
    expect(run?.status).toBe("completed");
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
