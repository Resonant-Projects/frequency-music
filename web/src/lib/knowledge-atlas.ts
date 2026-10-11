import { conceptDomainToSector, SECTORS } from "./zodiac-data";
import type {
  ConstellationConcept,
  OrbitalSource,
  OrbitalExtraction,
  OrbitalHypothesis,
  OrbitalRecipe,
} from "./zodiac-types";

export const ATLAS_LAYERS = [
  "concept",
  "source",
  "extraction",
  "hypothesis",
  "recipe",
] as const;
export type AtlasKind = (typeof ATLAS_LAYERS)[number] | "domain";
export interface AtlasNode {
  id: string;
  recordId: string;
  kind: AtlasKind;
  title: string;
  domain?: string;
  status?: string;
  mentions?: number;
}
export interface AtlasEdge {
  from: string;
  to: string;
  label: string;
}
export interface AtlasGraph {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
}
export interface AtlasPipeline {
  sources: OrbitalSource[];
  extractions: OrbitalExtraction[];
  hypotheses: OrbitalHypothesis[];
  recipes: OrbitalRecipe[];
}
export const atlasId = (kind: string, id: string) => `${kind}:${id}`;
export const normalizeConcept = (name: string) => name.trim().toLowerCase();

export function mergeDiscoveredNodes(
  previous: AtlasNode[],
  additions: AtlasNode[],
): AtlasNode[] {
  const nodes = new Map(previous.map((node) => [node.id, node]));
  for (const node of additions) {
    const existing = nodes.get(node.id);
    nodes.set(node.id, {
      ...existing,
      ...node,
      domain: node.domain ?? existing?.domain,
      status: node.status ?? existing?.status,
      mentions: node.mentions ?? existing?.mentions,
    });
  }
  return [...nodes.values()];
}

/** Organization is spatial. Lines represent only relationships returned by data. */
export function buildAtlas(
  concepts: Array<ConstellationConcept & { sector?: string }>,
  conceptEdges: Array<{ fromId: string; toId: string; relationship: string }>,
  pipeline?: AtlasPipeline,
): AtlasGraph {
  const nodes = new Map<string, AtlasNode>();
  const edges: AtlasEdge[] = [];
  for (const domain of SECTORS) {
    const id = atlasId("domain", domain.id);
    nodes.set(id, {
      id,
      recordId: domain.id,
      title: domain.label,
      kind: "domain",
      domain: domain.id,
    });
  }
  const names = new Map<string, string>();
  for (const concept of concepts) {
    const id = atlasId("concept", concept._id);
    names.set(normalizeConcept(concept.name), id);
    nodes.set(id, {
      id,
      recordId: concept._id,
      title: concept.displayName,
      kind: "concept",
      domain: concept.sector ?? conceptDomainToSector(concept.domain),
      mentions: concept.mentionCount,
    });
  }
  for (const edge of conceptEdges) {
    const from = names.get(normalizeConcept(edge.fromId));
    const to = names.get(normalizeConcept(edge.toId));
    if (from && to) edges.push({ from, to, label: edge.relationship });
  }
  function tags(id: string, values: string[] | undefined, label: string) {
    for (const name of values ?? []) {
      const to = names.get(normalizeConcept(name));
      if (to) edges.push({ from: id, to, label });
    }
  }
  for (const source of pipeline?.sources ?? []) {
    const id = atlasId("source", source._id);
    nodes.set(id, {
      id,
      recordId: source._id,
      title: source.title || "Untitled source",
      kind: "source",
      status: source.status,
    });
    tags(id, source.topics, "tagged with");
  }
  for (const extraction of pipeline?.extractions ?? []) {
    const id = atlasId("extraction", extraction._id);
    const source = nodes.get(atlasId("source", extraction.sourceId));
    nodes.set(id, {
      id,
      recordId: extraction._id,
      title: `Extraction: ${source?.title ?? (extraction.topics.slice(0, 2).join(", ") || "research claims")}`,
      kind: "extraction",
    });
    edges.push({
      from: atlasId("source", extraction.sourceId),
      to: id,
      label: "extracted into",
    });
    tags(id, extraction.topics, "tagged with");
  }
  for (const hypothesis of pipeline?.hypotheses ?? []) {
    const id = atlasId("hypothesis", hypothesis._id);
    nodes.set(id, {
      id,
      recordId: hypothesis._id,
      title: hypothesis.title,
      kind: "hypothesis",
      status: hypothesis.status,
    });
    tags(id, hypothesis.concepts, "investigates");
  }
  for (const recipe of pipeline?.recipes ?? []) {
    const id = atlasId("recipe", recipe._id);
    nodes.set(id, {
      id,
      recordId: recipe._id,
      title: recipe.title,
      kind: "recipe",
      status: recipe.status,
    });
    edges.push({
      from: atlasId("hypothesis", recipe.hypothesisId),
      to: id,
      label: "developed into",
    });
  }
  return mergeAtlas({ nodes: [...nodes.values()], edges }, [], []);
}

export function mergeAtlas(
  graph: AtlasGraph,
  additions: AtlasNode[],
  links: AtlasEdge[],
): AtlasGraph {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const node of additions)
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  const edges = new Map<string, AtlasEdge>();
  for (const edge of [...graph.edges, ...links]) {
    if (edge.from === edge.to || !nodes.has(edge.from) || !nodes.has(edge.to))
      continue;
    edges.set(JSON.stringify([edge.from, edge.to, edge.label]), edge);
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export function connectedIds(
  graph: AtlasGraph,
  selected: string | null,
): Set<string> {
  const ids = new Set<string>();
  if (!selected) return ids;
  ids.add(selected);
  const node = graph.nodes.find((item) => item.id === selected);
  if (node?.kind === "domain") {
    for (const item of graph.nodes)
      if (item.domain === node.domain) ids.add(item.id);
  } else {
    for (const edge of graph.edges) {
      if (edge.from === selected) ids.add(edge.to);
      if (edge.to === selected) ids.add(edge.from);
    }
  }
  return ids;
}

function hash(value: string): number {
  let result = 2166136261;
  for (const c of value) result = Math.imul(result ^ c.charCodeAt(0), 16777619);
  return result >>> 0;
}

export function domainPosition(domain: string): [number, number, number] {
  const index = Math.max(
    0,
    SECTORS.findIndex((item) => item.id === domain),
  );
  const angle = (index / SECTORS.length) * Math.PI * 2 + Math.PI / 6;
  return [
    Math.cos(angle) * 235,
    index % 2 === 0 ? 28 : -12,
    Math.sin(angle) * 235,
  ];
}

/** Identity-based placement stays stable as subscriptions and selections change. */
export function atlasPosition(node: AtlasNode): [number, number, number] {
  const h = hash(node.id);
  const angle = ((h % 10000) / 10000) * Math.PI * 2;
  if (node.kind === "domain") return domainPosition(node.domain ?? "music");
  if (node.kind === "concept") {
    const center = domainPosition(node.domain ?? "music");
    const radius = 27 + ((h >>> 8) % 58);
    return [
      center[0] + Math.cos(angle) * radius,
      center[1] + 12 + ((h >>> 16) % 60),
      center[2] + Math.sin(angle) * radius,
    ];
  }
  const layer = ATLAS_LAYERS.indexOf(node.kind);
  const radius = 42 + layer * 24 + ((h >>> 8) % 15);
  return [
    Math.cos(angle) * radius,
    -30 + layer * 25 + ((h >>> 16) % 16),
    Math.sin(angle) * radius,
  ];
}

/** Known data relationships have an inverse reading when selected at the target. */
export function relationshipLabel(edge: AtlasEdge, selected: string): string {
  if (edge.from === selected) return edge.label;
  const inverse: Record<string, string> = {
    "developed into": "developed from",
    "extracted into": "extracted from",
    "tagged with": "tagged research",
    investigates: "investigated by",
  };
  return inverse[edge.label] ?? edge.label;
}
