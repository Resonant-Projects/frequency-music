// @vitest-environment node
import type { Id } from "../../../convex/_generated/dataModel";
import { describe, expect, it } from "vite-plus/test";
import {
  atlasId,
  atlasPosition,
  buildAtlas,
  connectedIds,
  mergeAtlas,
  mergeDiscoveredNodes,
  relationshipLabel,
  type AtlasNode,
  type AtlasPipeline,
} from "./knowledge-atlas";
import type { ConstellationConcept } from "./zodiac-types";

const concept = (id: string, name: string, domain = "mathematics") =>
  ({
    _id: id,
    name,
    displayName: name,
    domain,
    mentionCount: 4,
  }) as ConstellationConcept;
const pipeline: AtlasPipeline = {
  sources: [
    {
      _id: "s1" as Id<"sources">,
      title: "A source",
      status: "extracted",
      topics: [" Resonance "],
      createdAt: 0,
    },
  ],
  extractions: [
    {
      _id: "e1" as Id<"extractions">,
      sourceId: "s1" as Id<"sources">,
      confidence: 0.8,
      topics: [],
    },
  ],
  hypotheses: [
    {
      _id: "h1" as Id<"hypotheses">,
      title: "A question",
      status: "draft",
      concepts: ["resonance"],
    },
  ],
  recipes: [
    {
      _id: "r1" as Id<"recipes">,
      title: "An experiment",
      hypothesisId: "h1" as Id<"hypotheses">,
      status: "draft",
    },
  ],
};

describe("knowledge atlas relationships", () => {
  it("retains discovered metadata when later relations return sparse records", () => {
    const source: AtlasNode = {
      id: "source:older",
      recordId: "older",
      kind: "source",
      title: "Earlier source",
      status: "extracted",
    };
    const stub: AtlasNode = {
      id: source.id,
      recordId: source.recordId,
      kind: source.kind,
      title: "Updated source title",
    };
    const discovered = mergeDiscoveredNodes(
      mergeDiscoveredNodes([], [source]),
      [stub],
    );
    expect(
      mergeAtlas(buildAtlas([], []), discovered, []).nodes.find(
        (node) => node.id === source.id,
      ),
    ).toEqual({ ...source, title: stub.title });
    expect(mergeDiscoveredNodes([stub], [source])).toEqual([source]);
    expect(
      mergeDiscoveredNodes(discovered, [{ ...source, status: "archived" }]),
    ).toEqual([{ ...source, status: "archived" }]);
  });
  it("joins canonical concept names to record IDs and removes missing endpoints", () => {
    const graph = buildAtlas(
      [concept("a", "Resonance"), concept("b", "Harmonics")],
      [
        {
          fromId: " resonance ",
          toId: "HARMONICS",
          relationship: "related_to",
        },
        { fromId: "resonance", toId: "missing", relationship: "related_to" },
      ],
      pipeline,
    );
    expect(graph.edges).toContainEqual({
      from: "concept:a",
      to: "concept:b",
      label: "related_to",
    });
    expect(graph.edges).toContainEqual({
      from: "source:s1",
      to: "concept:a",
      label: "tagged with",
    });
    expect(graph.edges).toContainEqual({
      from: "source:s1",
      to: "extraction:e1",
      label: "extracted into",
    });
    expect(graph.edges).toContainEqual({
      from: "hypothesis:h1",
      to: "recipe:r1",
      label: "developed into",
    });
    expect(graph.edges.some((edge) => edge.to.includes("missing"))).toBe(false);
  });
  it("does not invent edges from a shared domain or spatial proximity", () => {
    const graph = buildAtlas(
      [concept("a", "Resonance"), concept("b", "Harmonics")],
      [],
    );
    expect(graph.edges).toEqual([]);
    expect([...connectedIds(graph, "concept:a")]).toEqual(["concept:a"]);
    expect(connectedIds(graph, "domain:math").has("concept:b")).toBe(true);
  });
  it("deduplicates shared concepts and relationship records without losing distinct semantics", () => {
    const graph = buildAtlas(
      [concept("a", "Resonance"), concept("a", "Resonance")],
      [],
      pipeline,
    );
    const original = graph.edges[0];
    const merged = mergeAtlas(
      graph,
      [],
      [original, { ...original, label: "supports" }],
    );
    expect(merged.nodes.filter((node) => node.id === "concept:a")).toHaveLength(
      1,
    );
    expect(
      merged.edges.filter(
        (edge) => edge.from === original.from && edge.to === original.to,
      ),
    ).toHaveLength(2);
  });
  it("adds discovered records to the graph and traces inbound as well as outbound links", () => {
    const graph = buildAtlas([], [], pipeline);
    const node: AtlasNode = {
      id: atlasId("source", "older"),
      recordId: "older",
      title: "Earlier evidence",
      kind: "source",
    };
    const merged = mergeAtlas(
      graph,
      [node],
      [{ from: node.id, to: "hypothesis:h1", label: "supports" }],
    );
    expect(connectedIds(merged, "hypothesis:h1")).toEqual(
      new Set(["hypothesis:h1", "recipe:r1", node.id]),
    );
    expect(atlasPosition(node)).toEqual(
      atlasPosition({ ...node, title: "Updated title" }),
    );
  });
});

it("reads a pipeline connection correctly from either endpoint", () => {
  const edge = {
    from: "hypothesis:h1",
    to: "recipe:r1",
    label: "developed into",
  };
  expect(relationshipLabel(edge, "hypothesis:h1")).toBe("developed into");
  expect(relationshipLabel(edge, "recipe:r1")).toBe("developed from");
});
it("honors the domain query's registered display-sector mapping", () => {
  const graph = buildAtlas(
    [
      {
        ...concept("custom", "Custom concept", "spectral-composition"),
        sector: "synthesis",
      },
    ],
    [],
  );
  expect(graph.nodes.find((node) => node.id === "concept:custom")?.domain).toBe(
    "synthesis",
  );
});
it("places pipeline items in the domain of their classified concepts", () => {
  const graph = buildAtlas(
    [],
    [],
    pipeline,
    new Map([["resonance", "geometry"]]),
  );
  const domainOf = (id: string) =>
    graph.nodes.find((node) => node.id === id)?.domain;
  expect(domainOf("source:s1")).toBe("geometry");
  expect(domainOf("hypothesis:h1")).toBe("geometry");
  // No topics at all: unplaced rather than defaulted into Music.
  expect(domainOf("extraction:e1")).toBeUndefined();
  // Recipes carry no topics and stay outside the domain sectors.
  expect(domainOf("recipe:r1")).toBeUndefined();
  expect(connectedIds(graph, "domain:geometry").has("source:s1")).toBe(true);
});
it("places an extracted source by its current extraction's topics", () => {
  // Extraction topics live on the extraction row and the source's concept
  // edges; sources.topics is usually unset once a source is extracted.
  const graph = buildAtlas(
    [],
    [],
    {
      ...pipeline,
      sources: [
        { ...pipeline.sources[0], topics: undefined },
        {
          _id: "s2" as Id<"sources">,
          title: "Unextracted",
          status: "text_ready",
          createdAt: 0,
        },
      ],
      extractions: [{ ...pipeline.extractions[0], topics: ["Tonnetz"] }],
    },
    new Map([["tonnetz", "geometry"]]),
  );
  const domainOf = (id: string) =>
    graph.nodes.find((node) => node.id === id)?.domain;
  expect(domainOf("source:s1")).toBe("geometry");
  // No topics anywhere: unplaced, so no domain lists or highlights it.
  expect(domainOf("source:s2")).toBeUndefined();
  expect(connectedIds(graph, "domain:music").has("source:s2")).toBe(false);
});
it("places a source by its linked concepts when its extraction is outside the sample", () => {
  const graph = buildAtlas(
    [],
    [],
    {
      ...pipeline,
      sources: [
        {
          ...pipeline.sources[0],
          topics: undefined,
          conceptNames: ["tonnetz"],
        },
      ],
      extractions: [],
    },
    new Map([["tonnetz", "geometry"]]),
  );
  expect(graph.nodes.find((node) => node.id === "source:s1")?.domain).toBe(
    "geometry",
  );
});
it("breaks a source's tie by its current extraction's topic order, not link order", () => {
  // Edges keep the order concepts were first linked; a re-extraction that
  // reorders the topics leaves them as they were.
  const graph = buildAtlas(
    [],
    [],
    {
      ...pipeline,
      sources: [
        {
          ...pipeline.sources[0],
          topics: undefined,
          conceptNames: ["timbre", "tonnetz"],
        },
      ],
      extractions: [
        { ...pipeline.extractions[0], topics: ["tonnetz", "timbre"] },
      ],
    },
    new Map([
      ["timbre", "synthesis"],
      ["tonnetz", "geometry"],
    ]),
  );
  const domainOf = (id: string) =>
    graph.nodes.find((node) => node.id === id)?.domain;
  expect(domainOf("extraction:e1")).toBe("geometry");
  expect(domainOf("source:s1")).toBe("geometry");
});
it("falls back to topic keywords for items without classified concepts", () => {
  const graph = buildAtlas([], [], pipeline);
  expect(graph.nodes.find((node) => node.id === "source:s1")?.domain).toBe(
    "wave",
  );
});
