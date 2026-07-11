import { describe, expect, test } from "vite-plus/test";
import { parseConceptClassificationOutput } from "./conceptClassification";

describe("concept classifier output", () => {
  test("accepts the binding output shape", () => {
    expect(
      parseConceptClassificationOutput(
        {
          classifications: [
            {
              domains: ["cymatics", "wave-physics"],
              missionRelevance: "on",
              rationale:
                "The concept directly describes visible wave patterns.",
            },
          ],
        },
        1,
      ),
    ).toEqual([
      {
        domains: ["cymatics", "wave-physics"],
        missionRelevance: "on",
        rationale: "The concept directly describes visible wave patterns.",
      },
    ]);
  });

  test("rejects invalid domain counts, relevance values, and batch lengths", () => {
    expect(() =>
      parseConceptClassificationOutput(
        {
          classifications: [
            { domains: [], missionRelevance: "on", rationale: "Missing." },
          ],
        },
        1,
      ),
    ).toThrow();
    expect(() =>
      parseConceptClassificationOutput(
        {
          classifications: [
            {
              domains: ["cymatics"],
              missionRelevance: "maybe",
              rationale: "Invalid relevance.",
            },
          ],
        },
        1,
      ),
    ).toThrow();
    expect(() =>
      parseConceptClassificationOutput({ classifications: [] }, 1),
    ).toThrow("Expected 1 classifications, received 0");
    expect(() =>
      parseConceptClassificationOutput(
        {
          classifications: [
            {
              domains: ["cymatics"],
              missionRelevance: "on",
              rationale: "This is one sentence. This is another.",
            },
          ],
        },
        1,
      ),
    ).toThrow("Rationale must be exactly one terminated sentence");
    expect(() =>
      parseConceptClassificationOutput(
        {
          classifications: [
            {
              domains: ["cymatics"],
              missionRelevance: "on",
              rationale: "Directly relevant",
            },
          ],
        },
        1,
      ),
    ).toThrow("Rationale must be exactly one terminated sentence");
  });
});
