// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
import { createComputed, createRoot, createSignal } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  conceptSectorLookupNames,
  createConceptSectorLookupNames,
  itemSector,
  pipelineItemNames,
} from "./item-sectors";
import type { PipelineItems } from "./zodiac-types";

const classified = new Map([
  ["tonnetz", "geometry"],
  ["chladni plate", "wave"],
  ["standing wave", "wave"],
  ["timbre", "synthesis"],
]);

describe("item sectors", () => {
  it("places an item in the sector of its classified concepts", () => {
    expect(itemSector([" Tonnetz "], classified)).toBe("geometry");
  });

  it("takes the sector most of its classified concepts share", () => {
    expect(
      itemSector(["timbre", "chladni plate", "standing wave"], classified),
    ).toBe("wave");
  });

  it("counts each concept once, however often its name repeats", () => {
    // A source's own topics can repeat its extraction's topics.
    expect(
      itemSector(
        ["Timbre", "timbre", "standing wave", "chladni plate"],
        classified,
      ),
    ).toBe("wave");
  });

  it("breaks a tie by the item's first classified concept", () => {
    expect(itemSector(["timbre", "tonnetz"], classified)).toBe("synthesis");
    expect(itemSector(["tonnetz", "timbre"], classified)).toBe("geometry");
  });

  it("ignores unclassified topics when any concept is classified", () => {
    // "frequency ratio" alone would match the keyword fallback's math sector.
    expect(itemSector(["frequency ratio", "tonnetz"], classified)).toBe(
      "geometry",
    );
  });

  it("falls back to topic keywords when no concept is classified", () => {
    expect(itemSector(["Frequency ratio"], classified)).toBe("math");
    expect(itemSector(["perception of beating"], new Map())).toBe("psycho");
    expect(itemSector(["unrelated"], classified)).toBe("music");
  });

  it("leaves an item with no topics at all unplaced", () => {
    expect(itemSector(undefined, classified)).toBeUndefined();
    expect(itemSector([], classified)).toBeUndefined();
  });
});

describe("concept sector lookup names", () => {
  it("normalizes and deduplicates names across items", () => {
    expect(
      conceptSectorLookupNames([[" Tonnetz ", "timbre"], ["tonnetz"]], 10),
    ).toEqual(["tonnetz", "timbre"]);
  });

  it("reaches every item's leading topics before any item's later ones", () => {
    expect(
      conceptSectorLookupNames(
        [["a1", "a2", "a3"], undefined, ["b1"], ["c1", "c2"]],
        4,
      ),
    ).toEqual(["a1", "b1", "c1", "a2"]);
  });
});

describe("pipeline item names", () => {
  it("looks up a source's linked concepts and its extraction's topics", () => {
    expect(
      pipelineItemNames({
        sources: [
          {
            _id: "s1" as Id<"sources">,
            title: "Plates",
            status: "extracted",
            topics: ["Plates"],
            conceptNames: ["chladni plate"],
            createdAt: 0,
          },
        ],
        extractions: [
          {
            _id: "e1" as Id<"extractions">,
            sourceId: "s1" as Id<"sources">,
            confidence: 0.9,
            topics: ["standing wave"],
          },
        ],
        hypotheses: [
          {
            _id: "h1" as Id<"hypotheses">,
            title: "Lattice",
            status: "draft",
            concepts: ["tonnetz"],
          },
        ],
        recipes: [],
      }),
    ).toEqual([
      ["standing wave", "Plates", "chladni plate"],
      ["standing wave"],
      ["tonnetz"],
    ]);
  });
});

describe("concept sector lookup", () => {
  const items = (topics: string[]): PipelineItems => ({
    sources: [],
    extractions: [
      {
        _id: "e1" as Id<"extractions">,
        sourceId: "s1" as Id<"sources">,
        confidence: 0.9,
        topics,
      },
    ],
    hypotheses: [],
    recipes: [],
  });

  it("keeps its identity while a refreshed item list asks for the same names", () => {
    createRoot((dispose) => {
      const [current, setCurrent] = createSignal<PipelineItems | undefined>();
      const names = createConceptSectorLookupNames(current, 10);
      const seen: string[][] = [];
      createComputed(() => seen.push(names()));

      setCurrent(items(["Tonnetz"]));
      // A live query re-emits fresh objects with the same content.
      setCurrent(items([" tonnetz "]));
      setCurrent(items(["tonnetz", "timbre"]));

      expect(seen).toEqual([[], ["tonnetz"], ["tonnetz", "timbre"]]);
      dispose();
    });
  });
});
