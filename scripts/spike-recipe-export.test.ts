import { describe, expect, test } from "bun:test";
import {
  buildRecipeExport,
  normalizeParameter,
  serializeBundle,
  type RecipeInput,
} from "./spike-recipe-export";

const baseRecipe: RecipeInput = {
  _id: "recipe-test-001",
  hypothesisId: "hypothesis-test-001",
  title: "Test Tuning Recipe",
  parameters: [],
  protocol: undefined,
  dawChecklist: ["Render the comparison."],
};

describe("parameter_value_v1 normalization", () => {
  test.each([
    ["432Hz", 432, "Hz"],
    ["60 BPM", 60, "BPM"],
    ["100.5 cents", 100.5, "cents"],
    ["3:2", 1.5, "ratio"],
    ["19-EDO", 19, "EDO"],
    ["12-Tone Equal Temperament (12-TET)", 12, "EDO"],
  ] as const)("normalizes %s", (raw, number, unit) => {
    expect(
      normalizeParameter({
        canonicalKind: "tuningSystem",
        registryStatus: "known",
        value: raw,
      }),
    ).toEqual({
      canonicalKind: "tuningSystem",
      registryStatus: "known",
      value: { raw, number, unit },
      lossy: false,
    });
  });

  test("keeps unparseable prose and marks it lossy", () => {
    expect(
      normalizeParameter({
        type: "tuningSystem",
        value: "Quarter-comma meantone",
        details: { role: "comparison arm B" },
      }),
    ).toEqual({
      canonicalKind: "tuningSystem",
      value: { raw: "Quarter-comma meantone" },
      lossy: true,
      details: { role: "comparison arm B" },
    });
  });
});

describe("recipe_export_v1", () => {
  test("emits a structurally valid Scala file from explicit intervals", () => {
    const intervals = [
      100.89,
      200,
      300,
      386.31371,
      498.045,
      600,
      701.955,
      800,
      884.35871,
      1000,
      1088.26871,
      "2/1",
    ];
    const result = buildRecipeExport({
      ...baseRecipe,
      title: "Geometric Temperament",
      parameters: [
        {
          type: "tuningSystem",
          value: "Geometric temperament",
          details: { intervals },
        },
        { type: "frequency", value: "432Hz" },
      ],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.content).toBe(
      "! geometric-temperament-test-001-01-geometric-temperament.scl\n" +
        "! Geometric Temperament — Geometric temperament — A=432Hz\n" +
        "12\n" +
        "!\n" +
        "100.89000\n" +
        "200.00000\n" +
        "300.00000\n" +
        "386.31371\n" +
        "498.04500\n" +
        "600.00000\n" +
        "701.95500\n" +
        "800.00000\n" +
        "884.35871\n" +
        "1000.00000\n" +
        "1088.26871\n" +
        "2/1\n",
    );

    const scalaLines = result.files[0]?.content.trimEnd().split("\n") ?? [];
    expect(scalaLines[2]).toBe("12");
    expect(scalaLines.at(-1)).toBe("2/1");
    expect(result.bundle.assets[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test("emits an equal-division scale from an EDO value", () => {
    const result = buildRecipeExport({
      ...baseRecipe,
      parameters: [{ type: "tuningSystem", value: "4-EDO" }],
    });

    expect(result.files[0]?.content).toContain(
      "4\n!\n300.00000\n600.00000\n900.00000\n2/1\n",
    );
    expect(result.bundle.assets).toHaveLength(1);
  });

  test("keeps a recipe without exportable tuning as a valid empty bundle", () => {
    const result = buildRecipeExport({
      ...baseRecipe,
      parameters: [
        { type: "tempo", value: "82 BPM" },
        { type: "tuningSystem", value: "Quarter-comma meantone" },
      ],
    });

    expect(result.files).toEqual([]);
    expect(result.bundle.assets).toEqual([]);
    expect(result.bundle.contract).toBe("recipe_export_v1");
  });

  test("is byte-deterministic unless generatedAt is explicitly injected", () => {
    const recipe = {
      ...baseRecipe,
      parameters: [{ type: "tuningSystem", value: "19-EDO" }],
    };

    const first = buildRecipeExport(recipe);
    const second = buildRecipeExport(recipe);
    expect(first).toEqual(second);
    expect(serializeBundle(first.bundle)).toBe(serializeBundle(second.bundle));
    expect(first.bundle).not.toHaveProperty("generatedAt");

    const timestamped = buildRecipeExport(recipe, {
      generatedAt: "2026-07-09T12:00:00.000Z",
    });
    expect(timestamped.bundle.generatedAt).toBe("2026-07-09T12:00:00.000Z");
  });

  test("builds a bundle for every scrubbed live-data fixture row", async () => {
    const fixture = (await Bun.file(
      new URL("./fixtures/recipe-export-sample.json", import.meta.url),
    ).json()) as RecipeInput[];

    expect(fixture).toHaveLength(3);
    for (const recipe of fixture) {
      const result = buildRecipeExport(recipe);
      expect(result.bundle.recipeId).toBe(recipe._id);
      expect(result.bundle.parameters).toHaveLength(recipe.parameters.length);
    }
  });
});
