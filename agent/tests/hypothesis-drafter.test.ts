import { describe, expect, test, vi } from "vite-plus/test";
import { hypothesisDraftPayloadZ } from "../../convex/shared/draftPayloads";
import {
  buildReviewDraft,
  createCheckCapacityNode,
  createGatherContextNode,
  createSelfCheckNode,
  createWriteDraftNode,
  routeAfterCapacity,
  routeAfterSelfCheck,
  selectDraftTarget,
  type DraftableCorrespondence,
} from "../src/graphs/hypothesis-drafter/nodes";

const target: DraftableCorrespondence = {
  correspondenceId: "corr-eligible",
  pairKey: "concept-a:concept-b",
  statement: "Modal spacing may predict auditory roughness.",
  rationaleMd: "Both systems expose measurable spacing relationships.",
  status: "evidenced",
  similarityScore: 0.7,
  noveltyScore: 0.8,
  conceptA: {
    id: "concept-a",
    name: "modal spacing",
    displayName: "Modal spacing",
    description: "Spacing between resonant modes.",
    domains: ["cymatics"],
  },
  conceptB: {
    id: "concept-b",
    name: "auditory roughness",
    displayName: "Auditory roughness",
    description: "Perceived beating and sensory dissonance.",
    domains: ["psychoacoustics"],
  },
  evidenceClaims: [
    {
      claimId: "claim-1",
      text: "Closer partial spacing increased measured roughness.",
      sourceId: "source-1",
      extractionId: "extraction-1",
      stance: "supports",
    },
  ],
};

describe("hypothesis drafter capacity", () => {
  test("short-circuits cleanly when three drafts await review", async () => {
    const callTool = vi.fn(async (name: string) =>
      name === "countPendingDrafts" ? 3 : { ok: true },
    );
    const result = await createCheckCapacityNode(callTool)({
      agentRunId: "run-cap",
    });

    expect(result).toMatchObject({ pendingCount: 3, capReached: true });
    expect(routeAfterCapacity(result as never)).toBe("summarize");
    expect(callTool).toHaveBeenCalledWith("countPendingDrafts", {
      kind: "hypothesis_draft",
    });
    expect(callTool).not.toHaveBeenCalledWith(
      "listDraftableCorrespondences",
      expect.anything(),
    );
  });

  test("fails closed when the capacity tool returns a malformed count", async () => {
    const callTool = vi.fn(async () => ({ count: 0 }));
    await expect(
      createCheckCapacityNode(callTool)({ agentRunId: "run-malformed" }),
    ).rejects.toThrow(/invalid count/);
    expect(callTool).not.toHaveBeenCalledWith(
      "listDraftableCorrespondences",
      expect.anything(),
    );
  });
});

describe("hypothesis drafter target selection", () => {
  test("prefers evidenced targets before higher-scoring conjectures", () => {
    const conjectured = {
      ...target,
      correspondenceId: "corr-conjectured",
      status: "conjectured" as const,
      similarityScore: 0.99,
      noveltyScore: 0.99,
    };

    const selected = selectDraftTarget([conjectured, target]);

    expect(selected.target?.correspondenceId).toBe("corr-eligible");
    expect(selected.runnerUp?.correspondenceId).toBe("corr-conjectured");
  });
});

describe("hypothesis drafter payload contract", () => {
  test("round-trips a correspondence draft through the shared payload schema", () => {
    const reviewDraft = buildReviewDraft(target, {
      title: "Modal spacing roughness micro-study",
      question: "Does reducing modal spacing increase perceived roughness?",
      statement:
        "A 20% reduction in modal spacing increases roughness ratings versus baseline.",
      rationale: "Claim claim-1 reports the same directional relationship.",
      whyThisMatters:
        "It turns the correspondence into one controllable studio variable.",
      confidence: 0.72,
    });

    expect(hypothesisDraftPayloadZ.parse(reviewDraft.payload)).toEqual({
      ...reviewDraft.payload,
      sourceIds: ["source-1"],
      extractionIds: ["extraction-1"],
      correspondenceId: "corr-eligible",
      concepts: ["modal spacing", "auditory roughness"],
    });
    expect(reviewDraft.kind).toBe("hypothesis_draft");
    expect(reviewDraft.needsReview).toBe(true);
  });
});

describe("hypothesis drafter context", () => {
  test("consults failure history and keeps only concept-related hypotheses", async () => {
    const callTool = vi.fn(
      async (name: string, args: Record<string, unknown>) => {
        if (name === "listRecentHypotheses") {
          return [
            { title: "Related", concepts: ["modal spacing"] },
            { title: "Unrelated", concepts: ["tempo"] },
          ];
        }
        if (name === "listFailureArchive") {
          return [
            {
              title: "Roughness path retired",
              summary: "Auditory roughness comparison failed.",
            },
          ];
        }
        if (name === "searchSourcesByConcept") {
          return [{ _id: `source-for-${args.conceptName}` }];
        }
        return { ok: true };
      },
    );

    const result = await createGatherContextNode(callTool)({
      agentRunId: "run-context",
      target,
    });

    expect(result.context?.priorHypotheses).toEqual([
      { title: "Related", concepts: ["modal spacing"] },
    ]);
    expect(result.context?.failureArchive).toHaveLength(1);
    expect(callTool).toHaveBeenCalledWith("listFailureArchive", { limit: 50 });
    expect(callTool).toHaveBeenCalledWith("listRecentHypotheses", {
      limit: 50,
    });
  });
});

describe("hypothesis drafter self-check", () => {
  test("allows one revision, then discards with a decision event", async () => {
    const judge = {
      invoke: vi.fn(async () => ({
        pass: false,
        testable: true,
        oneVariable: false,
        evidenceGrounded: true,
        feedback: "The draft varies tuning and tempo; keep only tuning.",
      })),
    };
    const callTool = vi.fn(async () => ({ ok: true }));
    const selfCheck = createSelfCheckNode({ judge, callTool });
    const draft = buildReviewDraft(target, {
      title: "Two-variable draft",
      question: "Do tuning and tempo change roughness?",
      statement: "Changing tuning and tempo changes roughness.",
      rationale: "Claim claim-1 motivates the comparison.",
      whyThisMatters: "A studio control could follow if isolated.",
      concepts: ["modal spacing", "auditory roughness"],
    }).payload;

    const revise = await selfCheck({
      agentRunId: "run-check",
      target,
      context: {
        evidenceClaims: target.evidenceClaims,
        sources: [],
        priorHypotheses: [],
        failureArchive: [],
      },
      draft,
      revisionCount: 0,
    });
    expect(revise.revisionCount).toBe(1);
    expect(routeAfterSelfCheck(revise as never)).toBe("draft");

    const discard = await selfCheck({
      agentRunId: "run-check",
      target,
      context: {
        evidenceClaims: target.evidenceClaims,
        sources: [],
        priorHypotheses: [],
        failureArchive: [],
      },
      draft,
      revisionCount: 1,
    });
    expect(discard.discarded).toBe(true);
    expect(routeAfterSelfCheck(discard as never)).toBe("summarize");
    expect(callTool).toHaveBeenCalledWith(
      "appendAgentRunEvent",
      expect.objectContaining({
        kind: "decision",
        message: "Discarded hypothesis draft after failed self-check",
      }),
    );
    expect(callTool).not.toHaveBeenCalledWith(
      "createAgentReviewDraft",
      expect.anything(),
    );
  });
});

describe("hypothesis drafter write guard", () => {
  test("completes cleanly when a concurrent run claims the target first", async () => {
    const callTool = vi.fn(async (name: string) => {
      if (name === "createAgentReviewDraft") {
        throw new Error("DraftTargetUnavailable: target already claimed");
      }
      return { ok: true };
    });
    const draft = buildReviewDraft(target, {
      title: "Modal spacing roughness micro-study",
      question: "Does reducing modal spacing increase perceived roughness?",
      statement:
        "A 20% reduction in modal spacing increases roughness ratings versus baseline.",
      rationale: "Claim claim-1 reports the same directional relationship.",
      whyThisMatters:
        "It turns the correspondence into one controllable studio variable.",
    }).payload;

    const result = await createWriteDraftNode(callTool)({
      agentRunId: "run-race",
      target,
      draft,
    });

    expect(result).toMatchObject({
      draftWritten: false,
      discardReason: expect.stringContaining("DraftTargetUnavailable"),
    });
    expect(callTool).toHaveBeenCalledWith(
      "appendAgentRunEvent",
      expect.objectContaining({
        kind: "status",
        message: "drafting skipped: correspondence target became unavailable",
        payload: { correspondenceId: target.correspondenceId },
      }),
    );
  });
});
