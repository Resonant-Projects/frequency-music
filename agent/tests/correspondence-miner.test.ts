import { describe, expect, test, vi } from "vite-plus/test";
import {
  buildMinerDecision,
  createWriteOrDiscardNode,
  judgeOutputSchema,
} from "../src/graphs/correspondence-miner/nodes";
import type { MinerDecision } from "../src/state/correspondenceMinerState";

const candidate = {
  conceptAId: "concept-a",
  conceptBId: "concept-b",
  pairKey: "concept-a:concept-b",
  similarityScore: 0.91,
  noveltyScore: 0.5,
  domainsA: ["cymatics"],
  domainsB: ["psychoacoustics"],
  sampleClaimIds: { a: ["claim-a"], b: ["claim-b"] },
  conceptA: {
    id: "concept-a",
    name: "chladni patterns",
    displayName: "Chladni patterns",
    domains: ["cymatics"],
  },
  conceptB: {
    id: "concept-b",
    name: "roughness perception",
    displayName: "Roughness perception",
    domains: ["psychoacoustics"],
  },
  sampleClaims: {
    a: [
      {
        id: "claim-a",
        text: "Plate modes reorganize at discrete forcing frequencies.",
        sourceId: "source-a",
        sourceTitle: "Plate modes",
      },
    ],
    b: [
      {
        id: "claim-b",
        text: "Auditory roughness peaks at bounded beating rates.",
        sourceId: "source-b",
        sourceTitle: "Roughness",
      },
    ],
  },
};

describe("correspondence miner judge schema", () => {
  test("round-trips the binding verdict shape", () => {
    const verdict = {
      accept: true,
      statement:
        "Changing forcing-frequency spacing predicts a bounded change in perceived roughness.",
      rationaleMd: "Claims `claim-a` and `claim-b` provide the two premises.",
      relationship: "predicts",
      confidenceNote:
        "Moderate confidence; the causal bridge still needs testing.",
    };

    expect(judgeOutputSchema.parse(verdict)).toEqual(verdict);
    expect(() =>
      judgeOutputSchema.parse({ ...verdict, confidenceNote: undefined }),
    ).toThrow();
  });

  test("turns an accepted verdict without a valid sample citation into a discard", () => {
    const decision = buildMinerDecision(candidate, {
      accept: true,
      statement: "A specific prediction.",
      rationaleMd: "This rationale cites no addressable sample claim.",
      confidenceNote: "Moderate confidence.",
    });

    expect(decision.verdict.accept).toBe(false);
    expect(decision.verdict.confidenceNote).toMatch(
      /cited no valid sample claim ids/,
    );
    expect(decision.supportingClaimIds).toEqual([]);
  });

  test("does not treat a confidence caveat as supporting evidence", () => {
    const decision = buildMinerDecision(candidate, {
      accept: true,
      statement: "A specific prediction involving claim-a.",
      rationaleMd: "The rationale does not cite an addressable sample claim.",
      confidenceNote: "Caveat: claim-b may point in another direction.",
    });

    expect(decision.verdict.accept).toBe(false);
    expect(decision.supportingClaimIds).toEqual([]);
  });
});

describe("correspondence miner write node", () => {
  test("writes accepted correspondence and cited evidence with run provenance", async () => {
    const callTool = vi.fn(
      async (name: string, _args: Record<string, unknown>) =>
        name === "upsertCorrespondence"
          ? { id: "correspondence-1", created: true }
          : { added: true, status: "evidenced" },
    );
    const decision: MinerDecision = {
      candidate,
      verdict: {
        accept: true,
        statement:
          "Changing forcing-frequency spacing predicts a bounded change in perceived roughness.",
        rationaleMd: "Claims `claim-a` and `claim-b` provide the premises.",
        relationship: "predicts",
        confidenceNote: "Moderate confidence.",
      },
      supportingClaimIds: ["claim-a", "claim-b"],
    };

    const result = await createWriteOrDiscardNode(callTool)({
      agentRunId: "run-1",
      traceUrl: "https://trace.example/run-1",
      decisions: [decision],
    });

    expect(callTool).toHaveBeenCalledWith(
      "upsertCorrespondence",
      expect.objectContaining({
        conceptAId: "concept-a",
        conceptBId: "concept-b",
        similarityScore: 0.91,
        noveltyScore: 0.5,
        agentRunId: "run-1",
        traceUrl: "https://trace.example/run-1",
      }),
    );
    expect(
      callTool.mock.calls
        .filter(([name]) => name === "addCorrespondenceEvidence")
        .map(([, args]) => args),
    ).toEqual([
      {
        correspondenceId: "correspondence-1",
        claimId: "claim-a",
        stance: "supports",
        note: "Moderate confidence.",
        agentRunId: "run-1",
      },
      {
        correspondenceId: "correspondence-1",
        claimId: "claim-b",
        stance: "supports",
        note: "Moderate confidence.",
        agentRunId: "run-1",
      },
    ]);
    expect(result.acceptedCount).toBe(1);
    expect(result.evidenceAddedCount).toBe(2);
  });

  test("logs a discard decision without research writes", async () => {
    const callTool = vi.fn(
      async (_name: string, _args: Record<string, unknown>) => ({ ok: true }),
    );
    const decision: MinerDecision = {
      candidate,
      verdict: {
        accept: false,
        statement: "Both concepts involve sound.",
        rationaleMd: "The proposed link is generic.",
        confidenceNote: "Discard: no falsifiable cross-domain mechanism.",
      },
      supportingClaimIds: [],
    };

    const result = await createWriteOrDiscardNode(callTool)({
      agentRunId: "run-2",
      decisions: [decision],
    });

    expect(callTool).toHaveBeenCalledWith(
      "appendAgentRunEvent",
      expect.objectContaining({
        runId: "run-2",
        kind: "decision",
        payload: expect.objectContaining({
          pairKey: "concept-a:concept-b",
          accept: false,
          reason: "Discard: no falsifiable cross-domain mechanism.",
        }),
      }),
    );
    expect(
      callTool.mock.calls.some(([name]) => name === "upsertCorrespondence"),
    ).toBe(false);
    expect(result.discardedCount).toBe(1);
  });
});
