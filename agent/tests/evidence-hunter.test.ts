import { describe, expect, test, vi } from "vite-plus/test";
import {
  createAddEvidenceNode,
  createJudgeStanceNode,
  createSummarizeNode,
  stanceOutputSchema,
} from "../src/graphs/evidence-hunter/nodes";
import type {
  EvidenceJudgment,
  EvidenceTarget,
} from "../src/state/evidenceHunterState";

const target: EvidenceTarget = {
  correspondenceId: "correspondence-1",
  pairKey: "concept-a:concept-b",
  statement: "Mode spacing predicts a bounded change in auditory roughness.",
  rationaleMd: "A cross-domain prediction.",
  existingClaimIds: [],
  conceptA: {
    id: "concept-a",
    name: "mode spacing",
    displayName: "Mode spacing",
    domains: ["cymatics"],
  },
  conceptB: {
    id: "concept-b",
    name: "auditory roughness",
    displayName: "Auditory roughness",
    domains: ["psychoacoustics"],
  },
};

function judgment(
  claimId: string,
  stance: "supports" | "contradicts" | "irrelevant",
): EvidenceJudgment {
  return {
    target,
    claim: {
      claimId,
      score: 0.88,
      text: `Claim ${claimId}`,
      sourceId: "source-1",
      sourceTitle: "Source",
      domains: ["psychoacoustics"],
    },
    verdict: { stance, note: `${stance} because of a measured relationship.` },
  };
}

describe("evidence hunter stance schema", () => {
  test("round-trips all three stance values with a note", () => {
    for (const stance of ["supports", "contradicts", "irrelevant"] as const) {
      expect(
        stanceOutputSchema.parse({ stance, note: "Grounded explanation." }),
      ).toEqual({ stance, note: "Grounded explanation." });
    }
    expect(() =>
      stanceOutputSchema.parse({ stance: "supports", note: "" }),
    ).toThrow();
  });
});

describe("evidence hunter add-evidence node", () => {
  test("writes only non-irrelevant judgments with run provenance", async () => {
    const callTool = vi.fn(
      async (name: string, _args: Record<string, unknown>) =>
        name === "addCorrespondenceEvidence"
          ? { added: true, status: "evidenced" }
          : { ok: true },
    );

    const result = await createAddEvidenceNode(callTool)({
      agentRunId: "run-hunter",
      judgments: [
        judgment("claim-supports", "supports"),
        judgment("claim-contradicts", "contradicts"),
        judgment("claim-irrelevant", "irrelevant"),
      ],
    });

    expect(
      callTool.mock.calls
        .filter(([name]) => name === "addCorrespondenceEvidence")
        .map(([, args]) => args),
    ).toEqual([
      {
        correspondenceId: "correspondence-1",
        claimId: "claim-supports",
        stance: "supports",
        note: "supports because of a measured relationship.",
        agentRunId: "run-hunter",
      },
      {
        correspondenceId: "correspondence-1",
        claimId: "claim-contradicts",
        stance: "contradicts",
        note: "contradicts because of a measured relationship.",
        agentRunId: "run-hunter",
      },
    ]);
    expect(result.evidenceAddedCount).toBe(2);
    expect(result.irrelevantCount).toBe(1);
    expect(result.evidenceAddedByTarget).toEqual({
      "correspondence-1": 2,
    });
  });
});

describe("evidence hunter judge resilience", () => {
  test("discards one judge error and still writes successful judgments", async () => {
    const claims = ["supports", "broken", "contradicts"].map((suffix) => ({
      claimId: `claim-${suffix}`,
      score: 0.88,
      text: `Claim ${suffix}`,
      sourceId: "source-1",
      sourceTitle: "Source",
      domains: ["psychoacoustics"],
    }));
    const judge = {
      invoke: vi
        .fn()
        .mockResolvedValueOnce({
          stance: "supports" as const,
          note: "Supplies a measured premise.",
        })
        .mockRejectedValueOnce(
          new Error("transient secret=private judge failure"),
        )
        .mockResolvedValueOnce({
          stance: "contradicts" as const,
          note: "Conflicts with the predicted direction.",
        }),
    };
    const callTool = vi.fn(async (name: string) =>
      name === "addCorrespondenceEvidence"
        ? { added: true, status: "evidenced" }
        : { ok: true },
    );
    const judgeNode = createJudgeStanceNode({
      judge,
      callTool,
      resolveTraceUrl: async (traceUrl) => traceUrl,
    });

    const judged = await judgeNode({
      agentRunId: "run-hunter-resilient",
      searches: [{ target, claims }],
    });
    const written = await createAddEvidenceNode(callTool)({
      agentRunId: "run-hunter-resilient",
      judgments: judged.judgments ?? [],
    });

    expect(written.evidenceAddedCount).toBe(2);
    expect(written.irrelevantCount).toBe(0);
    expect(written.discardedCount).toBe(1);
    expect(
      callTool.mock.calls.filter(
        ([name]) => name === "addCorrespondenceEvidence",
      ),
    ).toHaveLength(2);
    expect(callTool).toHaveBeenCalledWith(
      "appendAgentRunEvent",
      expect.objectContaining({
        runId: "run-hunter-resilient",
        kind: "decision",
        payload: expect.objectContaining({
          claimId: "claim-broken",
          reason: "judge_error",
          message: "transient secret=[REDACTED] judge failure",
        }),
      }),
    );
    expect(
      callTool.mock.calls.filter(
        ([name, args]) =>
          name === "appendAgentRunEvent" &&
          (args as { payload?: { claimId?: string } }).payload?.claimId ===
            "claim-broken",
      ),
    ).toHaveLength(1);
  });

  test("summarizes all judge errors as zero judgments", async () => {
    const summary = await createSummarizeNode(vi.fn())({
      agentRunId: undefined,
      traceUrl: undefined,
      targets: [target],
      searches: [],
      judgments: [judgment("claim-error", "irrelevant")],
      judgeErrorCount: 1,
      evidenceAddedCount: 0,
      irrelevantCount: 1,
      discardedCount: 1,
      evidenceAddedByTarget: {},
      auditEvents: [],
    });

    expect(summary.summary).toMatch(/zero judgments; 1 judge error/);
  });

  test("terminal completion failure is retained as an audit event", async () => {
    const callTool = vi.fn(async () => {
      throw new Error("temporary password=private finalize failure");
    });

    const result = await createSummarizeNode(callTool)({
      agentRunId: "run-finalize",
      traceUrl: undefined,
      targets: [],
      searches: [],
      judgments: [],
      judgeErrorCount: 0,
      evidenceAddedCount: 0,
      irrelevantCount: 0,
      discardedCount: 0,
      evidenceAddedByTarget: {},
      auditEvents: [],
    });

    expect(result.summary).toBe(
      "evidence-hunter completed: no conjectured targets",
    );
    expect(result.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "error",
          payload: {
            message: "temporary password=[REDACTED] finalize failure",
          },
        }),
      ]),
    );
  });
});
