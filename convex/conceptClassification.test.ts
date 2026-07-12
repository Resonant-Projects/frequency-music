import { describe, expect, test } from "vite-plus/test";
import { parseConceptClassificationItems } from "./conceptClassification";

function parseClassifications(value: unknown, expectedCount: number) {
  return parseConceptClassificationItems(
    value,
    expectedCount,
  ).classifications.map(({ classification }) => classification);
}

describe("concept classifier output", () => {
  test("accepts the binding output shape", () => {
    expect(
      parseClassifications(
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

  test("marks invalid rows failed and rejects unsafe batch lengths", () => {
    expect(
      parseConceptClassificationItems(
        {
          classifications: [
            { domains: [], missionRelevance: "on", rationale: "Missing." },
          ],
        },
        1,
      ),
    ).toEqual({ classifications: [], failed: 1 });
    expect(
      parseConceptClassificationItems(
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
    ).toEqual({ classifications: [], failed: 1 });
    expect(() => parseClassifications({ classifications: [] }, 1)).toThrow(
      "Expected 1 classifications, received 0",
    );
    expect(
      parseConceptClassificationItems(
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
    ).toEqual({ classifications: [], failed: 1 });
  });

  test("accepts rationales with abbreviations or two sentences (live-backfill regression)", () => {
    const rationale =
      "Refers to ML codec tooling, e.g. neural vocoders. Off-mission for the research program.";
    expect(
      parseClassifications(
        {
          classifications: [
            {
              domains: ["ml-audio-engineering"],
              missionRelevance: "off",
              rationale,
            },
          ],
        },
        1,
      )[0]?.rationale,
    ).toBe(rationale);
  });

  test("keeps valid neighbors when one classification is malformed", () => {
    expect(
      parseConceptClassificationItems(
        {
          classifications: [
            {
              domains: ["cymatics"],
              missionRelevance: "on",
              rationale: "The first concept is directly on mission.",
            },
            {
              domains: [],
              missionRelevance: "on",
              rationale: "Malformed row.",
            },
            {
              domains: ["wave-physics"],
              missionRelevance: "on",
              rationale: "The third concept is directly on mission.",
            },
          ],
        },
        3,
      ),
    ).toEqual({
      classifications: [
        {
          index: 0,
          classification: {
            domains: ["cymatics"],
            missionRelevance: "on",
            rationale: "The first concept is directly on mission.",
          },
        },
        {
          index: 2,
          classification: {
            domains: ["wave-physics"],
            missionRelevance: "on",
            rationale: "The third concept is directly on mission.",
          },
        },
      ],
      failed: 1,
    });
  });

  test("rejects a missing positional row instead of shifting later concepts", () => {
    expect(() =>
      parseConceptClassificationItems(
        {
          classifications: [
            {
              domains: ["cymatics"],
              missionRelevance: "on",
              rationale: "Only one of two requested rows was returned.",
            },
          ],
        },
        2,
      ),
    ).toThrow("Expected 2 classifications, received 1");
  });
});
