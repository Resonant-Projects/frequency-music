import type { GenericDatabaseReader } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { resolveDomainsForSector } from "./domainMappings";
import { scoreEditorialSignals } from "./phase2";
import { activityFeedItemValidator } from "./validators";

type SectorId = "math" | "wave" | "music" | "psycho" | "geometry" | "synthesis";

type DbReader = GenericDatabaseReader<DataModel>;

const EXTRACTION_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const BRIEF_STALE_AFTER_MS = 8 * 24 * 60 * 60 * 1000;

export function computeLoopHealth(
  now: number,
  lastExtractionAt: number | null,
  lastBriefAt: number | null,
) {
  const extractionStale =
    lastExtractionAt === null ||
    now - lastExtractionAt > EXTRACTION_STALE_AFTER_MS;
  const briefStale =
    lastBriefAt === null || now - lastBriefAt > BRIEF_STALE_AFTER_MS;
  return {
    extractionStale,
    briefStale,
    staleCount: Number(extractionStale) + Number(briefStale),
  };
}

// A missing row deliberately reads 0 rather than falling back to a live
// count — the fallback would reintroduce the full-table scans this cache
// exists to remove. The operator must run dashboard:recomputeStats once
// after deploy (see plans/005); the cron keeps it fresh thereafter.
export async function readStat(db: DbReader, key: string): Promise<number> {
  const row = await db
    .query("stats")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  return row?.value ?? 0;
}

const COUNTED_TABLES = [
  "sources",
  "extractions",
  "hypotheses",
  "recipes",
  "compositions",
  "weeklyBriefs",
  "feeds",
] as const;
type CountedTable = (typeof COUNTED_TABLES)[number];
type CountPageResult = {
  count: number;
  inbox: {
    ingested: number;
    textReady: number;
    reviewNeeded: number;
    blocked: number;
  };
  cursor: string | null;
  isDone: boolean;
};

export const countPage = internalQuery({
  args: { table: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    count: v.number(),
    inbox: v.object({
      ingested: v.number(),
      textReady: v.number(),
      reviewNeeded: v.number(),
      blocked: v.number(),
    }),
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query(args.table as CountedTable)
      .paginate({ cursor: args.cursor, numItems: 500 });
    const inbox = {
      ingested: 0,
      textReady: 0,
      reviewNeeded: 0,
      blocked: 0,
    };
    if (args.table === "sources") {
      for (const row of page.page as Doc<"sources">[]) {
        if (row.visibility !== "private") continue;
        if (row.status === "ingested") inbox.ingested++;
        if (row.status === "text_ready") inbox.textReady++;
        if (row.status === "review_needed") inbox.reviewNeeded++;
        if (
          (row.status === "ingested" ||
            row.status === "text_ready" ||
            row.status === "review_needed") &&
          Boolean(row.blockedReason)
        )
          inbox.blocked++;
      }
    }
    return {
      count: page.page.length,
      inbox,
      cursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const writeStat = internalMutation({
  args: { key: v.string(), value: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stats")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch("stats", existing._id, {
        value: args.value,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("stats", {
        key: args.key,
        value: args.value,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const readLoopTimestamps = internalQuery({
  args: {},
  returns: v.object({
    lastExtractionAt: v.union(v.number(), v.null()),
    lastBriefAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const [extraction, brief] = await Promise.all([
      ctx.db.query("extractions").order("desc").first(),
      ctx.db.query("weeklyBriefs").order("desc").first(),
    ]);
    return {
      lastExtractionAt: extraction?._creationTime ?? null,
      lastBriefAt: brief?._creationTime ?? null,
    };
  },
});

export const recordBatchExtractionOutcome = internalMutation({
  args: {
    attempted: v.number(),
    succeeded: v.number(),
    failed: v.number(),
    allFailed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const values = {
      "batchExtraction.attempted": args.attempted,
      "batchExtraction.succeeded": args.succeeded,
      "batchExtraction.failed": args.failed,
      "batchExtraction.completedAt": now,
      "loopHealth.batchExtractionAllFailed": Number(args.allFailed),
      ...(args.allFailed ? { "batchExtraction.lastAllFailedAt": now } : {}),
    };
    for (const [key, value] of Object.entries(values)) {
      const existing = await ctx.db
        .query("stats")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (existing) {
        await ctx.db.patch("stats", existing._id, { value, updatedAt: now });
      } else {
        await ctx.db.insert("stats", { key, value, updatedAt: now });
      }
    }
    return null;
  },
});

export const recomputeStats = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const table of COUNTED_TABLES) {
      let cursor: string | null = null;
      let total = 0;
      const inboxTotals = {
        ingested: 0,
        textReady: 0,
        reviewNeeded: 0,
        blocked: 0,
      };
      while (true) {
        const page: CountPageResult = await ctx.runQuery(
          internal.dashboard.countPage,
          {
            table,
            cursor,
          },
        );
        total += page.count;
        inboxTotals.ingested += page.inbox.ingested;
        inboxTotals.textReady += page.inbox.textReady;
        inboxTotals.reviewNeeded += page.inbox.reviewNeeded;
        inboxTotals.blocked += page.inbox.blocked;
        if (page.isDone) break;
        cursor = page.cursor;
      }
      await ctx.runMutation(internal.dashboard.writeStat, {
        key: `count.${table}`,
        value: total,
      });
      if (table === "sources") {
        for (const [key, value] of Object.entries(inboxTotals)) {
          await ctx.runMutation(internal.dashboard.writeStat, {
            key: `inbox.${key}`,
            value,
          });
        }
      }
    }

    const now = Date.now();
    const { lastExtractionAt, lastBriefAt } = await ctx.runQuery(
      internal.dashboard.readLoopTimestamps,
      {},
    );
    const loopHealth = computeLoopHealth(now, lastExtractionAt, lastBriefAt);
    const healthStats = {
      lastExtractionAt: lastExtractionAt ?? 0,
      lastBriefAt: lastBriefAt ?? 0,
      loopHealth: loopHealth.staleCount,
      "loopHealth.extractionStale": Number(loopHealth.extractionStale),
      "loopHealth.briefStale": Number(loopHealth.briefStale),
      "loopHealth.checkedAt": now,
    };
    for (const [key, value] of Object.entries(healthStats)) {
      await ctx.runMutation(internal.dashboard.writeStat, { key, value });
    }
    if (loopHealth.staleCount > 0) {
      console.error("Research loop is stale", {
        lastExtractionAt,
        lastBriefAt,
        ...loopHealth,
      });
    }
    return null;
  },
});

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
      readStat(ctx.db, "count.sources"),
      readStat(ctx.db, "count.extractions"),
      readStat(ctx.db, "count.hypotheses"),
      readStat(ctx.db, "count.recipes"),
      readStat(ctx.db, "count.compositions"),
      readStat(ctx.db, "count.weeklyBriefs"),
    ]);

    return {
      sources,
      extractions,
      hypotheses,
      recipes,
      compositions,
      weeklyBriefs,
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
    const allRegisteredDomains = await ctx.db.query("conceptDomains").collect();
    const { domains } = resolveDomainsForSector(
      allRegisteredDomains,
      args.domain,
    );

    // Fetch concepts using the by_domain index for each matching domain
    const conceptLists = await Promise.all(
      domains.map((domain) =>
        ctx.db
          .query("concepts")
          .withIndex("by_domain", (q) => q.eq("domain", domain))
          .collect(),
      ),
    );

    // Deduplicate in case a concept appears in multiple domains
    const seen = new Set<string>();
    const allConcepts: Doc<"concepts">[] = [];
    for (const list of conceptLists) {
      for (const concept of list) {
        if (!seen.has(concept._id)) {
          seen.add(concept._id);
          allConcepts.push(concept);
        }
      }
    }

    if (allConcepts.length === 0) return [];

    // Get is_a and part_of edges to find natural clusters
    const parentEdges = await Promise.all(
      allConcepts.map(async (concept) => {
        const outEdges = await ctx.db
          .query("edges")
          .withIndex("by_from", (q) =>
            q.eq("fromType", "concept").eq("fromId", concept.name),
          )
          .collect();
        return (
          outEdges.find(
            (edge) =>
              edge.relationship === "is_a" || edge.relationship === "part_of",
          ) ?? null
        );
      }),
    );
    const parentMap = new Map<string, string>();
    allConcepts.forEach((concept, index) => {
      const edge = parentEdges[index];
      if (edge) parentMap.set(concept.name, edge.toId);
    });

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
        const words = concept.displayName
          .split(/\s+/)
          .map((w: string) => w.toLowerCase());
        const keyword =
          words.find((w: string) => w.length > 3) ?? concept.domain ?? "other";
        if (!groups.has(keyword)) groups.set(keyword, []);
        groups.get(keyword)!.push(concept.name);
      }
      // If still <=1 group, split alphabetically into 2-3 buckets
      if (groups.size <= 1) {
        groups.clear();
        const sorted = [...allConcepts].toSorted((a, b) =>
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
      .toSorted((a, b) => b[1].length - a[1].length)
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

export async function computeEditorialSignals(db: DbReader, limit = 24) {
  const [concepts, hypotheses, recipes, compositions, listeningSessions] =
    (await Promise.all([
      db.query("concepts").collect(),
      db.query("hypotheses").collect(),
      db.query("recipes").collect(),
      db.query("compositions").collect(),
      db.query("listeningSessions").collect(),
    ])) as [
      Doc<"concepts">[],
      Doc<"hypotheses">[],
      Doc<"recipes">[],
      Doc<"compositions">[],
      Doc<"listeningSessions">[],
    ];

  const recipesByHypothesisId = new Map<string, Doc<"recipes">[]>();
  for (const recipe of recipes) {
    const existing =
      recipesByHypothesisId.get(String(recipe.hypothesisId)) ?? [];
    existing.push(recipe);
    recipesByHypothesisId.set(String(recipe.hypothesisId), existing);
  }

  const hypothesesByConcept = new Map<string, Doc<"hypotheses">[]>();
  for (const hypothesis of hypotheses) {
    for (const raw of hypothesis.concepts ?? []) {
      const key = raw.toLowerCase().trim();
      const existing = hypothesesByConcept.get(key) ?? [];
      existing.push(hypothesis);
      hypothesesByConcept.set(key, existing);
    }
  }

  const compositionsByRecipeId = new Map<string, Doc<"compositions">[]>();
  for (const composition of compositions) {
    const existing =
      compositionsByRecipeId.get(String(composition.recipeId)) ?? [];
    existing.push(composition);
    compositionsByRecipeId.set(String(composition.recipeId), existing);
  }

  const sessionsByCompositionId = new Map<string, Doc<"listeningSessions">[]>();
  for (const session of listeningSessions) {
    const existing =
      sessionsByCompositionId.get(String(session.compositionId)) ?? [];
    existing.push(session);
    sessionsByCompositionId.set(String(session.compositionId), existing);
  }

  const rows = concepts.map((concept: Doc<"concepts">) => {
    const linkedHypotheses = hypothesesByConcept.get(concept.name) ?? [];
    const linkedRecipes = linkedHypotheses.flatMap(
      (hypothesis: Doc<"hypotheses">) =>
        recipesByHypothesisId.get(String(hypothesis._id)) ?? [],
    );
    const linkedCompositions = linkedRecipes.flatMap(
      (recipe: Doc<"recipes">) =>
        compositionsByRecipeId.get(String(recipe._id)) ?? [],
    );

    let supportedHypotheses = 0;
    let contradictedHypotheses = 0;
    let retiredHypotheses = 0;
    for (const hypothesis of linkedHypotheses) {
      if (hypothesis.resolution === "supported") supportedHypotheses += 1;
      if (hypothesis.resolution === "contradicted") contradictedHypotheses += 1;
      if (hypothesis.status === "retired") retiredHypotheses += 1;
    }

    let archivedRecipes = 0;
    for (const recipe of linkedRecipes) {
      if (recipe.status === "archived") archivedRecipes += 1;
    }

    let compositionsYes = 0;
    let compositionsMaybe = 0;
    let compositionsNo = 0;
    let compositionsLowExpandability = 0;
    for (const composition of linkedCompositions) {
      const sessions = (
        sessionsByCompositionId.get(String(composition._id)) ?? []
      ).toSorted((a, b) => b.createdAt - a.createdAt);
      const latest = sessions[0];
      if (!latest) continue;
      if (latest.expandVerdict === "yes") compositionsYes += 1;
      if (latest.expandVerdict === "maybe") compositionsMaybe += 1;
      if (latest.expandVerdict === "no") compositionsNo += 1;
      if ((latest.ratings.expandability ?? Number.POSITIVE_INFINITY) <= 2) {
        compositionsLowExpandability += 1;
      }
    }

    return {
      conceptName: concept.name,
      displayName: concept.displayName,
      domain: concept.domain,
      mentionCount: concept.mentionCount,
      // Computed from hypothesis.concepts like the rest of this row — the
      // stored concept.hypothesisCount field is never incremented by the
      // graph link actions and reads 0 forever.
      hypothesisCount: linkedHypotheses.length,
      linkedRecipes: linkedRecipes.length,
      linkedCompositions: linkedCompositions.length,
      ...scoreEditorialSignals({
        linkedHypotheses: linkedHypotheses.length,
        linkedRecipes: linkedRecipes.length,
        linkedCompositions: linkedCompositions.length,
        supportedHypotheses,
        contradictedHypotheses,
        retiredHypotheses,
        archivedRecipes,
        compositionsYes,
        compositionsMaybe,
        compositionsNo,
        compositionsLowExpandability,
      }),
    };
  });

  const sorted = [...rows].toSorted(
    (a, b) => b.netYieldScore - a.netYieldScore,
  );
  const topRows = sorted.slice(0, limit);

  const byDomain = new Map<
    string,
    {
      domain: string;
      conceptNames: string[];
      score: number;
      yieldBand: "high" | "mixed" | "low";
    }
  >();
  for (const row of rows) {
    const existing = byDomain.get(row.domain) ?? {
      domain: row.domain,
      conceptNames: [],
      score: 0,
      yieldBand: row.yieldBand,
    };
    existing.conceptNames.push(row.displayName);
    existing.score += row.netYieldScore;
    existing.yieldBand =
      existing.score >= 6 ? "high" : existing.score <= -1 ? "low" : "mixed";
    byDomain.set(row.domain, existing);
  }

  const clusters = [...byDomain.values()]
    .map((cluster) => ({
      ...cluster,
      conceptNames: cluster.conceptNames.slice(0, 4),
    }))
    .toSorted((a, b) => b.score - a.score);

  return {
    concepts: topRows,
    highYieldClusters: clusters
      .filter((cluster) => cluster.yieldBand === "high")
      .slice(0, 4),
    lowYieldClusters: [...clusters]
      .filter((cluster) => cluster.yieldBand === "low")
      .toReversed()
      .slice(0, 4),
  };
}

export const editorialSignals = query({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    concepts: v.array(
      v.object({
        conceptName: v.string(),
        displayName: v.string(),
        domain: v.string(),
        mentionCount: v.number(),
        hypothesisCount: v.number(),
        linkedRecipes: v.number(),
        linkedCompositions: v.number(),
        positiveSignals: v.number(),
        negativeSignals: v.number(),
        netYieldScore: v.number(),
        yieldBand: v.union(
          v.literal("high"),
          v.literal("mixed"),
          v.literal("low"),
        ),
      }),
    ),
    highYieldClusters: v.array(
      v.object({
        domain: v.string(),
        conceptNames: v.array(v.string()),
        score: v.number(),
        yieldBand: v.union(
          v.literal("high"),
          v.literal("mixed"),
          v.literal("low"),
        ),
      }),
    ),
    lowYieldClusters: v.array(
      v.object({
        domain: v.string(),
        conceptNames: v.array(v.string()),
        score: v.number(),
        yieldBand: v.union(
          v.literal("high"),
          v.literal("mixed"),
          v.literal("low"),
        ),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    return await computeEditorialSignals(ctx.db as DbReader, args.limit ?? 24);
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
      const isFrom =
        edge.fromType === args.itemType && edge.fromId === args.itemId;
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
          const h = await ctx.db.get("hypotheses", otherId as Id<"hypotheses">);
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
