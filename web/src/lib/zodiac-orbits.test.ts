// @vitest-environment node
import type { Id } from "../../../convex/_generated/dataModel";
import { expect, it } from "vite-plus/test";
import { buildOrbitalItemGroups } from "./zodiac-orbits";

it("places orbiting bodies by classified concept, falling back to topic keywords", () => {
  const groups = buildOrbitalItemGroups(
    {
      sources: [
        {
          _id: "s1" as Id<"sources">,
          title: "Plates",
          status: "extracted",
          topics: ["Chladni plate", "frequency"],
          createdAt: 0,
        },
      ],
      extractions: [
        {
          _id: "e1" as Id<"extractions">,
          sourceId: "s1" as Id<"sources">,
          confidence: 0.9,
          topics: ["timbre space"],
        },
      ],
      hypotheses: [
        {
          _id: "h1" as Id<"hypotheses">,
          title: "Lattice question",
          status: "draft",
          concepts: ["tonnetz"],
        },
      ],
      recipes: [],
    },
    new Map([
      ["chladni plate", "geometry"],
      ["tonnetz", "math"],
    ]),
  );
  expect(groups.sources[0]?.sectorId).toBe("geometry");
  expect(groups.extractions[0]?.sectorId).toBe("synthesis");
  expect(groups.hypotheses[0]?.sectorId).toBe("math");
});
