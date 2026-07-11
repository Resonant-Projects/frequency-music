import { describe, expect, test } from "vite-plus/test";
import {
  computeExtractionEditCapture,
  extractionContentChanged,
  mergeExtractionContent,
  selectExtractionContent,
  type ExtractionEditableContent,
} from "./extractions";

function baseExtraction(): ExtractionEditableContent & {
  promptVersion: string;
  model: string;
} {
  return {
    summary: "Original summary",
    claims: [
      {
        text: "Claim one",
        evidenceLevel: "peer_reviewed",
        citations: [],
      },
    ],
    compositionParameters: [{ kind: "tempo", type: "tempo", value: "120bpm" }],
    topics: ["acoustics"],
    openQuestions: ["Does this hold at scale?"],
    confidence: 0.8,
    promptVersion: "extract_v3",
    model: "anthropic/claude-sonnet-4-6",
  };
}

describe("selectExtractionContent / mergeExtractionContent", () => {
  test("selectExtractionContent picks only the editable fields", () => {
    const extraction = baseExtraction();
    expect(selectExtractionContent(extraction)).toEqual({
      summary: extraction.summary,
      claims: extraction.claims,
      compositionParameters: extraction.compositionParameters,
      topics: extraction.topics,
      openQuestions: extraction.openQuestions,
      confidence: extraction.confidence,
    });
  });

  test("mergeExtractionContent falls back to existing values for omitted fields", () => {
    const existing = selectExtractionContent(baseExtraction());
    const merged = mergeExtractionContent(existing, {
      summary: "Edited summary",
    });
    expect(merged.summary).toBe("Edited summary");
    expect(merged.claims).toEqual(existing.claims);
    expect(merged.compositionParameters).toEqual(
      existing.compositionParameters,
    );
    expect(merged.topics).toEqual(existing.topics);
    expect(merged.openQuestions).toEqual(existing.openQuestions);
    expect(merged.confidence).toBe(existing.confidence);
  });

  test("mergeExtractionContent preserves a confidence of 0 (not treated as absent)", () => {
    const existing = selectExtractionContent(baseExtraction());
    const merged = mergeExtractionContent(existing, { confidence: 0 });
    expect(merged.confidence).toBe(0);
  });
});

describe("extractionContentChanged", () => {
  test("returns false for identical content", () => {
    const content = selectExtractionContent(baseExtraction());
    expect(extractionContentChanged(content, { ...content })).toBe(false);
  });

  test("returns true when any field differs", () => {
    const content = selectExtractionContent(baseExtraction());
    expect(
      extractionContentChanged(content, { ...content, summary: "Changed" }),
    ).toBe(true);
  });
});

describe("computeExtractionEditCapture", () => {
  test("fires on AI-origin edit with content change, carrying model/promptVersion", () => {
    const extraction = baseExtraction();
    const capture = computeExtractionEditCapture(extraction, {
      summary: "Human-tightened summary",
    });

    expect(capture).not.toBeNull();
    expect(capture?.promptVersion).toBe("extract_v3");
    expect(capture?.model).toBe("anthropic/claude-sonnet-4-6");
    expect(capture?.generated.summary).toBe("Original summary");
    expect(capture?.edited.summary).toBe("Human-tightened summary");
    // Untouched fields carry through unchanged on both sides.
    expect(capture?.generated.claims).toEqual(extraction.claims);
    expect(capture?.edited.claims).toEqual(extraction.claims);
  });

  test("does not fire when no fields are provided", () => {
    const extraction = baseExtraction();
    expect(computeExtractionEditCapture(extraction, {})).toBeNull();
  });

  test("does not fire when the provided value matches the stored value", () => {
    const extraction = baseExtraction();
    expect(
      computeExtractionEditCapture(extraction, { summary: extraction.summary }),
    ).toBeNull();
  });

  test("fires on a claims-array edit even when summary is untouched", () => {
    const extraction = baseExtraction();
    const newClaims: ExtractionEditableContent["claims"] = [
      ...extraction.claims,
      { text: "Claim two", evidenceLevel: "anecdotal", citations: [] },
    ];
    const capture = computeExtractionEditCapture(extraction, {
      claims: newClaims,
    });
    expect(capture).not.toBeNull();
    expect(capture?.edited.claims).toHaveLength(2);
    expect(capture?.generated.claims).toHaveLength(1);
  });

  // Note: extractions have no `origin` field and no human-authored insert
  // path (convex/extractInternal.ts is the only inserter), so there is no
  // "non-AI row" case to cover for this entity -- every row qualifies.
});
