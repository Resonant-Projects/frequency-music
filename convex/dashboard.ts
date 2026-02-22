import { query } from "./_generated/server";
import { v } from "convex/values";

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

  if (joined.includes("math") || joined.includes("ratio") || joined.includes("topolog")) return "math";
  if (joined.includes("wave") || joined.includes("frequency") || joined.includes("reson") || joined.includes("acoust")) return "wave";
  if (joined.includes("psycho") || joined.includes("perception") || joined.includes("consonan") || joined.includes("disson")) return "psycho";
  if (joined.includes("geometr") || joined.includes("tonnetz") || joined.includes("symmetry")) return "geometry";
  if (joined.includes("synth") || joined.includes("timbre") || joined.includes("sound design") || joined.includes("production")) return "synthesis";
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
    const [sources, extractions, hypotheses, recipes, compositions, weeklyBriefs] =
      await Promise.all([
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
    const extractions = await ctx.db.query("extractions").order("desc").take(limit);

    const sectorMetrics: Record<SectorId, { sources: Set<string>; claims: number }> = {
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

export const activityFeed = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
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
