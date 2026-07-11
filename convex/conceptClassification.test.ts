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
              rationale: "Directly relevant",
            },
          ],
        },
        1,
      ),
    ).toThrow("Rationale must end with sentence-terminating punctuation");
  });

  test("accepts rationales with abbreviations or two sentences (live-backfill regression)", () => {
    const rationale =
      "Refers to ML codec tooling, e.g. neural vocoders. Off-mission for the research program.";
    expect(
      parseConceptClassificationOutput(
        {
          classifications: [
            { domains: ["ml-audio-engineering"], missionRelevance: "off", rationale },
          ],
        },
        1,
      )[0]?.rationale,
    ).toBe(rationale);
  });
});
