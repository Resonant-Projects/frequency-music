import { describe, expect, test, vi } from "vite-plus/test";
import {
  createAddEvidenceNode,
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
