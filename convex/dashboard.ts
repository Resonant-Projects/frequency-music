import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { activityFeedItemValidator } from "./validators";

type SectorId = "math" | "wave" | "music" | "psycho" | "geometry" | "synthesis";

const emptySectors: Record<SectorId, { sources: number; claims: number }> = {
  math: { sources: 0, claims: 0 },
  wave: { sources: 0, claims: 0 },
  music: { sources: 0, claims: 0 },
  psycho: { sources: 0, claims: 0 },
  geometry: { sources: 0, claims: 0 },
  synthesis: { sources: 0, claims: 0 },
};

function inferSector(topics: string[]): SectorId {
  const joined = topics.join(" ").toLowerCase();

  if (
    joined.includes("math") ||
    joined.includes("ratio") ||
    joined.includes("topolog")
  )
    return "math";
  if (
    joined.includes("wave") ||
    joined.includes("frequency") ||
    joined.includes("reson") ||
    joined.includes("acoust")
  )
    return "wave";
  if (
    joined.includes("psycho") ||
    joined.includes("perception") ||
    joined.includes("consonan") ||
    joined.includes("disson")
  )
    return "psycho";
  if (
    joined.includes("geometr") ||
    joined.includes("tonnetz") ||
    joined.includes("symmetry")
  )
    return "geometry";
  if (
    joined.includes("synth") ||
    joined.includes("timbre") ||
    joined.includes("sound design") ||
    joined.includes("production")
  )
    return "synthesis";
  return "music";
}

export const pipeline = query({
  args: {},
  returns: v.object({
    sources: v.number(),
    extractions: v.number(),
    hypotheses: v.number(),
    recipes: v.number(),
    compositions: v.number(),
    weeklyBriefs: v.number(),
  }),
  handler: async (ctx) => {
    const [
      sources,
      extractions,
      hypotheses,
      recipes,
      compositions,
      weeklyBriefs,
    ] = await Promise.all([
      ctx.db.query("sources").collect(),
      ctx.db.query("extractions").collect(),
      ctx.db.query("hypotheses").collect(),
      ctx.db.query("recipes").collect(),
      ctx.db.query("compositions").collect(),
      ctx.db.query("weeklyBriefs").collect(),
    ]);

    return {
      sources: sources.length,
      extractions: extractions.length,
      hypotheses: hypotheses.length,
      recipes: recipes.length,
      compositions: compositions.length,
      weeklyBriefs: weeklyBriefs.length,
    };
  },
});

export const zodiacSectors = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      id: v.string(),
      sources: v.number(),
      claims: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 120;
    const extractions = await ctx.db
      .query("extractions")
      .order("desc")
      .take(limit);

    const sectorMetrics: Record<
      SectorId,
      { sources: Set<string>; claims: number }
    > = {
      math: { sources: new Set(), claims: 0 },
      wave: { sources: new Set(), claims: 0 },
      music: { sources: new Set(), claims: 0 },
      psycho: { sources: new Set(), claims: 0 },
      geometry: { sources: new Set(), claims: 0 },
      synthesis: { sources: new Set(), claims: 0 },
    };

    for (const extraction of extractions) {
      const sector = inferSector(extraction.topics);
      sectorMetrics[sector].sources.add(String(extraction.sourceId));
      sectorMetrics[sector].claims += extraction.claims.length;
    }

    return (Object.keys(emptySectors) as SectorId[]).map((id) => ({
      id,
      sources: sectorMetrics[id].sources.size,
      claims: sectorMetrics[id].claims,
    }));
  },
});

// ============================================================================
// SUB-TOPIC CLUSTERING (Phase 2 — Armillary Rings)
// ============================================================================

export const domainSubTopics = query({
  args: { domain: v.string() },
  returns: v.array(
    v.object({
      label: v.string(),
      conceptNames: v.array(v.string()),
      itemCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // Map zodiac sector IDs to concept domains — include "general"
    const domainMap: Record<string, Doc<"concepts">["domain"][]> = {
      math: ["mathematics", "general"],
      phys: ["acoustics", "general"],
      music: ["tuning", "theory", "general"],
      psycho: ["psychoacoustics", "general"],
      geo: ["geometry", "general"],
      synth: ["production", "instrument", "general"],
    };

    const conceptDomains = domainMap[args.domain] ?? ["general"];
    const allConcepts: Doc<"concepts">[] = [];
    const seen = new Set<Id<"concepts">>();

    for (const d of conceptDomains) {
      const concepts = await ctx.db
        .query("concepts")
        .withIndex("by_domain", (q) => q.eq("domain", d))
        .take(100);
      for (const c of concepts) {
        if (!seen.has(c._id)) {
          seen.add(c._id);
          allConcepts.push(c);
        }
      }
    }

    if (allConcepts.length === 0) return [];

    // Get is_a and part_of edges to find natural clusters
    const parentMap = new Map<string, string>();
    for (const concept of allConcepts) {
      const edges = await ctx.db
        .query("edges")
        .withIndex("by_from", (q) =>
          q.eq("fromType", "concept").eq("fromId", concept.name),
        )
        .filter((q) =>
          q.or(
            q.eq(q.field("relationship"), "is_a"),
            q.eq(q.field("relationship"), "part_of"),
          ),
        )
        .first();
      if (edges) parentMap.set(concept.name, edges.toId);
    }

    // Group by parent concept, or fall back to keyword clustering
    const groups = new Map<string, string[]>();
    for (const concept of allConcepts) {
      const parent = parentMap.get(concept.name);
      const key = parent ?? "ungrouped";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(concept.name);
    }

    // If <=1 group and >=4 concepts, cluster by meaningful keyword from displayName
    if (groups.size <= 1 && allConcepts.length >= 4) {
      groups.clear();
      // Use first significant word (>3 chars) from displayName
      for (const concept of allConcepts) {
        const words = concept.displayName.split(/\s+/).map((w: string) => w.toLowerCase());
        const keyword = words.find((w: string) => w.length > 3) ?? concept.domain ?? "other";
        if (!groups.has(keyword)) groups.set(keyword, []);
        groups.get(keyword)!.push(concept.name);
      }
      // If still <=1 group, split alphabetically into 2-3 buckets
      if (groups.size <= 1) {
        groups.clear();
        const sorted = [...allConcepts].sort((a, b) =>
          a.displayName.localeCompare(b.displayName),
        );
        const bucketSize = Math.ceil(sorted.length / 3);
        sorted.forEach((concept, i) => {
          const bucketIdx = Math.floor(i / bucketSize);
          const label = `Group ${bucketIdx + 1}`;
          if (!groups.has(label)) groups.set(label, []);
          groups.get(label)!.push(concept.name);
        });
      }
    }

    // Take top 4 clusters by size
    const sorted = [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4);

    return sorted.map(([key, names]) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      conceptNames: names,
      itemCount: names.length,
    }));
  },
});

// ============================================================================
// PIPELINE ITEMS (Phase 3 — Planetary Orrery)
// ============================================================================

export const pipelineItems = query({
  args: {},
  returns: v.object({
    sources: v.array(
      v.object({
        _id: v.id("sources"),
        title: v.optional(v.string()),
        status: v.string(),
        topics: v.optional(v.array(v.string())),
        createdAt: v.number(),
      }),
    ),
    extractions: v.array(
      v.object({
        _id: v.id("extractions"),
        sourceId: v.id("sources"),
        confidence: v.number(),
        topics: v.array(v.string()),
      }),
    ),
    hypotheses: v.array(
      v.object({
        _id: v.id("hypotheses"),
        title: v.string(),
        status: v.string(),
        concepts: v.optional(v.array(v.string())),
      }),
    ),
    recipes: v.array(
      v.object({
        _id: v.id("recipes"),
        title: v.string(),
        hypothesisId: v.id("hypotheses"),
        status: v.string(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const [sources, extractions, hypotheses, recipes] = await Promise.all([
      ctx.db.query("sources").order("desc").take(200),
      ctx.db.query("extractions").order("desc").take(100),
      ctx.db.query("hypotheses").collect(),
      ctx.db.query("recipes").collect(),
    ]);

    return {
      sources: sources.map((s) => ({
        _id: s._id,
        title: s.title,
        status: s.status,
        topics: s.topics,
        createdAt: s.createdAt,
      })),
      extractions: extractions.map((e) => ({
        _id: e._id,
        sourceId: e.sourceId,
        confidence: e.confidence,
        topics: e.topics,
      })),
      hypotheses: hypotheses.map((h) => ({
        _id: h._id,
        title: h.title,
        status: h.status,
        concepts: h.concepts,
      })),
      recipes: recipes.map((r) => ({
        _id: r._id,
        title: r.title,
        hypothesisId: r.hypothesisId,
        status: r.status,
      })),
    };
  },
});

export const itemRelations = query({
  args: { itemId: v.string(), itemType: v.string() },
  returns: v.array(
    v.object({
      id: v.string(),
      type: v.string(),
      title: v.string(),
      relationship: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const edgesFrom = await ctx.db
      .query("edges")
      .withIndex("by_from", (q) =>
        q.eq("fromType", args.itemType as any).eq("fromId", args.itemId),
      )
      .take(30);

    const edgesTo = await ctx.db
      .query("edges")
      .withIndex("by_to", (q) =>
        q.eq("toType", args.itemType as any).eq("toId", args.itemId),
      )
      .take(30);

    const results: Array<{
      id: string;
      type: string;
      title: string;
      relationship: string;
    }> = [];

    for (const edge of [...edgesFrom, ...edgesTo]) {
      const isFrom = edge.fromType === args.itemType && edge.fromId === args.itemId;
      const otherId = isFrom ? edge.toId : edge.fromId;
      const otherType = isFrom ? edge.toType : edge.fromType;

      // Skip concept edges — those are shown via constellation
      if (otherType === "concept") continue;

      let title = otherId;
      try {
        if (otherType === "source") {
          const s = await ctx.db.get("sources", otherId as Id<"sources">);
          if (s) title = s.title ?? "Untitled source";
        } else if (otherType === "hypothesis") {
          const h = await ctx.db.get(
            "hypotheses",
            otherId as Id<"hypotheses">,
          );
          if (h) title = h.title;
        } else if (otherType === "recipe") {
          const r = await ctx.db.get("recipes", otherId as Id<"recipes">);
          if (r) title = r.title;
        } else if (otherType === "extraction") {
          const e = await ctx.db.get(
            "extractions",
            otherId as Id<"extractions">,
          );
          if (e) title = `Extraction (${e.topics.slice(0, 2).join(", ")})`;
        }
      } catch {
        // Entity may have been deleted
      }

      results.push({
        id: otherId,
        type: otherType,
        title,
        relationship: edge.relationship,
      });
    }

    return results;
  },
});

export const activityFeed = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(activityFeedItemValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 12;

    const [sources, hypotheses, recipes, compositions] = await Promise.all([
      ctx.db.query("sources").order("desc").take(limit),
      ctx.db.query("hypotheses").order("desc").take(limit),
      ctx.db.query("recipes").order("desc").take(limit),
      ctx.db.query("compositions").order("desc").take(limit),
    ]);

    const merged = [
      ...sources.map((item) => ({
        kind: "source",
        id: item._id,
        title: item.title ?? "Untitled source",
        status: item.status,
        updatedAt: item.updatedAt,
      })),
      ...hypotheses.map((item) => ({
        kind: "hypothesis",
        id: item._id,
        title: item.title,
        status: item.status,
        updatedAt: item.updatedAt,
      })),
      ...recipes.map((item) => ({
        kind: "recipe",
        id: item._id,
        title: item.title,
        status: item.status,
        updatedAt: item.updatedAt,
      })),
      ...compositions.map((item) => ({
        kind: "composition",
        id: item._id,
        title: item.title,
        status: item.status,
        updatedAt: item.updatedAt,
      })),
    ];

    merged.sort((a, b) => b.updatedAt - a.updatedAt);
    return merged.slice(0, limit);
  },
});
