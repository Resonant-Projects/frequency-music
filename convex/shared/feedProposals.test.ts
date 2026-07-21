import { describe, expect, test } from "vite-plus/test";
import { feedProposalZ } from "./feedProposals";

describe("feedProposalZ", () => {
  test("accepts the proposal metadata shared with the source scout", () => {
    expect(
      feedProposalZ.parse({
        agentRunId: "run-1",
        rationale: "Closes a cymatics coverage gap",
        sampleItems: ["https://example.com/one"],
      }),
    ).toEqual({
      agentRunId: "run-1",
      rationale: "Closes a cymatics coverage gap",
      sampleItems: ["https://example.com/one"],
    });
  });

  test("rejects malformed proposal metadata", () => {
    expect(
      feedProposalZ.safeParse({
        agentRunId: "run-1",
        rationale: "Closes a cymatics coverage gap",
        sampleItems: "not-an-array",
      }).success,
    ).toBe(false);
  });
});
