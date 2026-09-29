import { describe, expect, test } from "vite-plus/test";
import { feedProposalZ } from "./feedProposals";

describe("feedProposalZ", () => {
  test("accepts the proposal metadata shared with the source scout", () => {
    expect(
      feedProposalZ.parse({
        agentRunId: "run-1",
        rationale: "Closes a cymatics coverage gap",
        sampleItems: [
          {
            title: "One",
            url: "https://example.com/one",
            snippet: "A cymatics field note",
          },
        ],
      }),
    ).toEqual({
      agentRunId: "run-1",
      rationale: "Closes a cymatics coverage gap",
      sampleItems: [
        {
          title: "One",
          url: "https://example.com/one",
          snippet: "A cymatics field note",
        },
      ],
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
