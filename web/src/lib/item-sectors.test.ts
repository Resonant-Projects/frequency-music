// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
import { conceptSectorLookupNames, itemSector } from "./item-sectors";

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
