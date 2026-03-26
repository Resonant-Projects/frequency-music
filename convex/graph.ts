import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, mutation, query } from "./_generated/server";
import {
  getDefaultDomainsForSector,
  inferDisplaySectorFromDomain,
  normalizeSectorId,
} from "./domainMappings";
import { conceptReturnValidator, edgeReturnValidator } from "./validators";

function parseNodeId(nodeId: string): { type: string; id: string } {
  const firstColon = nodeId.indexOf(":");
  return {
    type: firstColon >= 0 ? nodeId.slice(0, firstColon) : "unknown",
    id: firstColon >= 0 ? nodeId.slice(firstColon + 1) : nodeId,
  };
}

// ============================================================================
// CONCEPT QUERIES
// ============================================================================

/**
 * Get a concept by canonical name
 */
export const getConcept = query({
  args: { name: v.string() },
  returns: v.union(conceptReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const normalized = args.name.toLowerCase().trim();
    return await ctx.db
      .query("concepts")
      .withIndex("by_name", (q) => q.eq("name", normalized))
      .first();
  },
});

/**
 * Search concepts by name or alias
 */
export const searchConcepts = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(conceptReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    // Use search index
    const results = await ctx.db
      .query("concepts")
      .withSearchIndex("search_concepts", (q) =>
        q.search("displayName", args.query),
      )
      .take(limit);

    return results;
  },
});

/**
 * List concepts by domain
 */
export const listByDomain = query({
  args: { domain: v.string(), limit: v.optional(v.number()) },
  returns: v.array(conceptReturnValidator),
  handler: async (ctx, args) => {
    const normalized = args.domain.toLowerCase().trim();
    return await ctx.db
      .query("concepts")
      .withIndex("by_domain", (q) => q.eq("domain", normalized))
      .take(args.limit ?? 50);
  },
});

/**
 * Get top concepts by mention count
 */
export const getTopConcepts = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(conceptReturnValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("concepts")
      .withIndex("by_mentionCount")
      .order("desc")
      .take(args.limit ?? 20);
  },
});

// ============================================================================
// CONCEPT MUTATIONS
// ============================================================================

/**
 * Create or update a concept
 */
export const upsertConcept = mutation({
  args: {
    name: v.string(),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    domain: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    wikipedia: v.optional(v.string()),
  },
  returns: v.id("concepts"),
  handler: async (ctx, args) => {
    const normalized = args.name.toLowerCase().trim();
    const existing = await ctx.db
      .query("concepts")
      .withIndex("by_name", (q) => q.eq("name", normalized))
      .first();

    // Only default to "general" on insert; preserve existing domain on update
    const domain = args.domain
      ? args.domain.toLowerCase().trim()
      : (existing?.domain ?? "general");

    await ctx.runMutation(internal.vocabulary.ensureConceptDomain, {
      name: domain,
      sectorMapping: inferDisplaySectorFromDomain(domain),
    });

    if (existing) {
      // Update existing — only change domain if explicitly provided
      const patchDomain = args.domain ? domain : existing.domain;
      const patchDomains = args.domain
        ? Array.from(
            new Set([...(existing.domains ?? [existing.domain]), domain]),
          )
        : (existing.domains ?? [existing.domain]);
      await ctx.db.patch(existing._id, {
        displayName: args.displayName ?? existing.displayName,
        description: args.description ?? existing.description,
        domain: patchDomain,
        domains: patchDomains,
        aliases: args.aliases ?? existing.aliases,
        wikipedia: args.wikipedia ?? existing.wikipedia,
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    // Create new
    return await ctx.db.insert("concepts", {
      name: normalized,
      displayName: args.displayName ?? args.name,
      description: args.description,
      domain,
      domains: [domain],
      aliases: args.aliases ?? [],
      wikipedia: args.wikipedia,
      mentionCount: 0,
      hypothesisCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Increment concept mention count
 */
export const incrementMentions = mutation({
  args: { conceptId: v.id("concepts"), amount: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const concept = await ctx.db.get("concepts", args.conceptId);
    if (!concept) return null;

    await ctx.db.patch("concepts", args.conceptId, {
      mentionCount: concept.mentionCount + (args.amount ?? 1),
      updatedAt: Date.now(),
    });
    return null;
  },
});

// ============================================================================
// EDGE QUERIES
// ============================================================================

/**
 * Get all edges from an entity
 */
export const getEdgesFrom = query({
  args: {
    fromType: v.string(),
    fromId: v.string(),
    relationship: v.optional(v.string()),
  },
  returns: v.array(edgeReturnValidator),
  handler: async (ctx, args) => {
    const q = ctx.db
      .query("edges")
      .withIndex("by_from", (q) =>
        q.eq("fromType", args.fromType as any).eq("fromId", args.fromId),
      );

    const edges = await q.collect();

    if (args.relationship) {
      const normalized = args.relationship.toLowerCase().trim();
      return edges.filter((e) => e.relationship === normalized);
    }
    return edges;
  },
});

/**
 * Get all edges to an entity
 */
export const getEdgesTo = query({
  args: {
    toType: v.string(),
    toId: v.string(),
    relationship: v.optional(v.string()),
  },
  returns: v.array(edgeReturnValidator),
  handler: async (ctx, args) => {
    const q = ctx.db
      .query("edges")
      .withIndex("by_to", (q) =>
        q.eq("toType", args.toType as any).eq("toId", args.toId),
      );

    const edges = await q.collect();

    if (args.relationship) {
      const normalized = args.relationship.toLowerCase().trim();
      return edges.filter((e) => e.relationship === normalized);
    }
    return edges;
  },
});

/**
 * Get related sources for a source (via shared concepts or direct links)
 */
export const getRelatedSources = query({
  args: { sourceId: v.id("sources"), limit: v.optional(v.number()) },
  returns: v.array(edgeReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    // Get direct relationships
    const directEdges = await ctx.db
      .query("edges")
      .withIndex("by_from", (q) =>
        q.eq("fromType", "source").eq("fromId", args.sourceId),
      )
      .filter((q) => q.eq(q.field("toType"), "source"))
      .take(limit);

    // Get concepts this source mentions
    const conceptEdges = await ctx.db
      .query("edges")
      .withIndex("by_from", (q) =>
        q.eq("fromType", "source").eq("fromId", args.sourceId),
      )
      .filter((q) => q.eq(q.field("toType"), "concept"))
      .collect();

    const conceptIds = conceptEdges.map((e) => e.toId);

    // Find other sources mentioning the same concepts
    const relatedViaConceptsEdges = [];
    for (const conceptId of conceptIds.slice(0, 5)) {
      const otherSources = await ctx.db
        .query("edges")
        .withIndex("by_to", (q) =>
          q.eq("toType", "concept").eq("toId", conceptId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("fromType"), "source"),
            q.neq(q.field("fromId"), args.sourceId),
          ),
        )
        .take(3);
      relatedViaConceptsEdges.push(...otherSources);
    }

    // Combine and dedupe
    const allEdges = [...directEdges, ...relatedViaConceptsEdges];
    const seen = new Set<string>();
    const unique = allEdges.filter((e) => {
      if (seen.has(e.fromId)) return false;
      seen.add(e.fromId);
      return true;
    });

    return unique.slice(0, limit);
  },
});

/**
 * Get concepts for an entity
 */
export const getConceptsFor = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
  },
  returns: v.array(
    v.object({
      ...conceptReturnValidator.fields,
      relationship: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const edges = await ctx.db
      .query("edges")
      .withIndex("by_from", (q) =>
        q.eq("fromType", args.entityType as any).eq("fromId", args.entityId),
      )
      .filter((q) => q.eq(q.field("toType"), "concept"))
      .collect();

    // Fetch concept details
    const concepts = await Promise.all(
      edges.map(async (edge) => {
        const concept = await ctx.db
          .query("concepts")
          .withIndex("by_name", (q) => q.eq("name", edge.toId))
          .first();
        return concept ? { ...concept, relationship: edge.relationship } : null;
      }),
    );

    return concepts.filter((c): c is NonNullable<typeof c> => c !== null);
  },
});

// ============================================================================
// EDGE MUTATIONS
// ============================================================================

/**
 * Create an edge between two entities
 */
export const createEdge = mutation({
  args: {
    fromType: v.string(),
    fromId: v.string(),
    toType: v.string(),
    toId: v.string(),
    relationship: v.string(),
    weight: v.optional(v.number()),
    context: v.optional(v.string()),
    autoGenerated: v.optional(v.boolean()),
  },
  returns: v.id("edges"),
  handler: async (ctx, args) => {
    const relationship = args.relationship.toLowerCase().trim();

    await ctx.runMutation(internal.vocabulary.ensureRelationshipKind, {
      name: relationship,
    });

    // Check if edge already exists
    const existing = await ctx.db
      .query("edges")
      .withIndex("by_from", (q) =>
        q.eq("fromType", args.fromType as any).eq("fromId", args.fromId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("toType"), args.toType),
          q.eq(q.field("toId"), args.toId),
          q.eq(q.field("relationship"), relationship),
        ),
      )
      .first();

    if (existing) {
      // Update weight if provided
      if (args.weight !== undefined) {
        await ctx.db.patch(existing._id, { weight: args.weight });
      }
      return existing._id;
    }

    return await ctx.db.insert("edges", {
      fromType: args.fromType as any,
      fromId: args.fromId,
      toType: args.toType as any,
      toId: args.toId,
      relationship,
      weight: args.weight,
      context: args.context,
      autoGenerated: args.autoGenerated ?? false,
      createdAt: Date.now(),
      createdBy: "system",
    });
  },
});

/**
 * Delete an edge
 */
export const deleteEdge = mutation({
  args: { id: v.id("edges") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete("edges", args.id);
    return null;
  },
});

// ============================================================================
// GRAPH BUILDING ACTIONS
// ============================================================================

/**
 * Link an extraction's topics to concepts
 * Called after extraction to build concept graph
 */
export const linkExtractionConcepts = action({
  args: { extractionId: v.id("extractions") },
  returns: v.object({
    linked: v.number(),
    concepts: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const extraction = await ctx.runQuery(api.extractions.get, {
      id: args.extractionId,
    });

    if (!extraction) throw new Error("Extraction not found");

    const linkedConcepts = [];

    for (const topic of extraction.topics) {
      // Upsert the concept
      const conceptId = await ctx.runMutation(api.graph.upsertConcept, {
        name: topic,
      });

      // Create edge from source to concept
      await ctx.runMutation(api.graph.createEdge, {
        fromType: "source",
        fromId: extraction.sourceId,
        toType: "concept",
        toId: topic.toLowerCase().trim(),
        relationship: "mentions",
        autoGenerated: true,
      });

      // Increment mention count
      await ctx.runMutation(api.graph.incrementMentions, {
        conceptId,
      });

      linkedConcepts.push(topic);
    }

    return { linked: linkedConcepts.length, concepts: linkedConcepts };
  },
});

/**
 * Link a hypothesis to its concepts
 */
export const linkHypothesisConcepts = action({
  args: { hypothesisId: v.id("hypotheses") },
  returns: v.object({
    linked: v.number(),
    concepts: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const hypothesis = await ctx.runQuery(api.hypotheses.get, {
      id: args.hypothesisId,
    });

    if (!hypothesis) throw new Error("Hypothesis not found");

    const concepts = hypothesis.concepts || [];
    const linkedConcepts = [];

    for (const concept of concepts) {
      // Upsert the concept
      await ctx.runMutation(api.graph.upsertConcept, {
        name: concept,
      });

      // Create edge from hypothesis to concept
      await ctx.runMutation(api.graph.createEdge, {
        fromType: "hypothesis",
        fromId: args.hypothesisId,
        toType: "concept",
        toId: concept.toLowerCase().trim(),
        relationship: "tests",
        autoGenerated: true,
      });

      linkedConcepts.push(concept);
    }

    // Also link to source concepts
    for (const sourceId of hypothesis.sourceIds) {
      await ctx.runMutation(api.graph.createEdge, {
        fromType: "hypothesis",
        fromId: args.hypothesisId,
        toType: "source",
        toId: sourceId,
        relationship: "derived_from",
        autoGenerated: true,
      });
    }

    return { linked: linkedConcepts.length, concepts: linkedConcepts };
  },
});

/**
 * Build graph for all existing extractions
 */
export const buildGraphFromExtractions = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    conceptsLinked: v.number(),
    failures: v.array(
      v.object({
        extractionId: v.string(),
        error: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const extractions = await ctx.runQuery(api.extractions.listRecent, {
      limit: args.limit ?? 100,
    });

    let processed = 0;
    let conceptsLinked = 0;
    const failures: Array<{ extractionId: string; error: string }> = [];

    for (const extraction of extractions) {
      try {
        const result = await ctx.runAction(api.graph.linkExtractionConcepts, {
          extractionId: extraction._id,
        });
        conceptsLinked += result.linked;
        processed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("graph linking failed", {
          extractionId: extraction._id,
          error: message,
        });
        failures.push({ extractionId: String(extraction._id), error: message });
      }
    }

    return { processed, conceptsLinked, failures };
  },
});

// ============================================================================
// VISUALIZATION QUERIES (used by zodiac 3D frontend)
// ============================================================================

/**
 * Get concepts for a display domain (maps concept domains to zodiac sectors)
 */
export const getConceptsForDomain = query({
  args: { domain: v.string(), limit: v.optional(v.number()) },
  returns: v.array(conceptReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const sector = normalizeSectorId(args.domain);
    const specificDomains = new Set(getDefaultDomainsForSector(sector));

    // Find all domains that map to this sector via registry
    const registeredDomains = await ctx.db.query("conceptDomains").collect();
    const matchingDomains = new Set<string>();
    for (const entry of registeredDomains) {
      const entrySector =
        entry.sectorMapping ?? inferDisplaySectorFromDomain(entry.name);
      if (entrySector === sector) {
        matchingDomains.add(entry.name);
      }
    }

    // Fetch concepts using by_domain index for each matching domain
    const conceptLists = await Promise.all(
      [...matchingDomains].map((domain) =>
        ctx.db
          .query("concepts")
          .withIndex("by_domain", (q) => q.eq("domain", domain))
          .collect(),
      ),
    );

    // Deduplicate
    const seen = new Set<string>();
    const results: (typeof conceptLists)[0] = [];
    for (const list of conceptLists) {
      for (const concept of list) {
        if (!seen.has(concept._id)) {
          seen.add(concept._id);
          results.push(concept);
        }
      }
    }

    // Sort: domain-specific concepts first, then general, all by mentionCount desc
    results.sort((a, b) => {
      const aSpecific = specificDomains.has(a.domain) ? 0 : 1;
      const bSpecific = specificDomains.has(b.domain) ? 0 : 1;
      if (aSpecific !== bSpecific) return aSpecific - bSpecific;
      return b.mentionCount - a.mentionCount;
    });

    return results.slice(0, limit);
  },
});

/**
 * Get edges between a set of concept names (for constellation lines)
 */
export const getConceptEdges = query({
  args: { conceptNames: v.array(v.string()) },
  returns: v.array(edgeReturnValidator),
  handler: async (ctx, args) => {
    const nameSet = new Set(
      args.conceptNames.map((n) => n.toLowerCase().trim()),
    );
    const results: Doc<"edges">[] = [];

    // Get edges where both ends are in our concept set
    for (const name of nameSet) {
      const edges = await ctx.db
        .query("edges")
        .withIndex("by_from", (q) =>
          q.eq("fromType", "concept").eq("fromId", name),
        )
        .filter((q) => q.eq(q.field("toType"), "concept"))
        .collect();
      for (const edge of edges) {
        if (nameSet.has(edge.toId)) {
          results.push(edge);
        }
      }
    }

    return results;
  },
});

/**
 * Get full concept detail with linked pipeline items (for sidebar drill-down)
 */
export const getConceptDetail = query({
  args: { conceptId: v.optional(v.id("concepts")) },
  returns: v.union(
    v.object({
      concept: conceptReturnValidator,
      linkedSources: v.array(
        v.object({
          _id: v.id("sources"),
          title: v.optional(v.string()),
          status: v.string(),
        }),
      ),
      linkedHypotheses: v.array(
        v.object({
          _id: v.id("hypotheses"),
          title: v.string(),
          status: v.string(),
        }),
      ),
      linkedRecipes: v.array(
        v.object({
          _id: v.id("recipes"),
          title: v.string(),
          status: v.string(),
        }),
      ),
      edgeCount: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    if (!args.conceptId) return null;
    const concept = await ctx.db.get("concepts", args.conceptId);
    if (!concept) return null;

    // Get all edges mentioning this concept
    const edgesTo = await ctx.db
      .query("edges")
      .withIndex("by_to", (q) =>
        q.eq("toType", "concept").eq("toId", concept.name),
      )
      .collect();

    const edgesFrom = await ctx.db
      .query("edges")
      .withIndex("by_from", (q) =>
        q.eq("fromType", "concept").eq("fromId", concept.name),
      )
      .collect();

    const allEdges = [...edgesTo, ...edgesFrom];

    // Collect linked entity IDs by type
    const sourceIds = new Set<Id<"sources">>();
    const hypothesisIds = new Set<Id<"hypotheses">>();
    const recipeIds = new Set<Id<"recipes">>();

    for (const edge of allEdges) {
      const otherId = edge.fromType === "concept" ? edge.toId : edge.fromId;
      const otherType =
        edge.fromType === "concept" ? edge.toType : edge.fromType;
      if (otherType === "source") sourceIds.add(otherId as Id<"sources">);
      if (otherType === "hypothesis") {
        hypothesisIds.add(otherId as Id<"hypotheses">);
      }
      if (otherType === "recipe") recipeIds.add(otherId as Id<"recipes">);
    }

    // Fetch linked items (limit to 20 each)
    const linkedSources = (
      await Promise.all(
        [...sourceIds].slice(0, 20).map(async (id) => {
          try {
            const s = await ctx.db.get("sources", id);
            if (!s || s.visibility !== "public") return null;
            return { _id: s._id, title: s.title, status: s.status };
          } catch {
            return null;
          }
        }),
      )
    ).filter((s): s is NonNullable<typeof s> => s !== null);

    const linkedHypotheses = (
      await Promise.all(
        [...hypothesisIds].slice(0, 20).map(async (id) => {
          try {
            const h = await ctx.db.get("hypotheses", id);
            if (!h || h.visibility !== "public") return null;
            return { _id: h._id, title: h.title, status: h.status };
          } catch {
            return null;
          }
        }),
      )
    ).filter((h): h is NonNullable<typeof h> => h !== null);

    const linkedRecipes = (
      await Promise.all(
        [...recipeIds].slice(0, 20).map(async (id) => {
          try {
            const r = await ctx.db.get("recipes", id);
            if (!r || r.visibility !== "public") return null;
            return { _id: r._id, title: r.title, status: r.status };
          } catch {
            return null;
          }
        }),
      )
    ).filter((r): r is NonNullable<typeof r> => r !== null);

    return {
      concept,
      linkedSources,
      linkedHypotheses,
      linkedRecipes,
      edgeCount: allEdges.length,
    };
  },
});

// ============================================================================
// GRAPH EXPORT (for visualization)
// ============================================================================

/**
 * Export graph data for visualization (e.g., D3, Cytoscape)
 */
export const exportForVisualization = query({
  args: {
    centerType: v.optional(v.string()),
    centerId: v.optional(v.string()),
    depth: v.optional(v.number()),
  },
  returns: v.object({
    nodes: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        type: v.string(),
        domain: v.optional(v.string()),
        size: v.number(),
      }),
    ),
    links: v.array(
      v.object({
        source: v.string(),
        target: v.string(),
        relationship: v.string(),
        weight: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    if (
      (args.centerType !== undefined && args.centerId === undefined) ||
      (args.centerType === undefined && args.centerId !== undefined)
    ) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Both centerType and centerId must be provided together",
      });
    }

    const maxDepth = Math.max(0, Math.floor(args.depth ?? 2));

    // Get all concepts as nodes
    const concepts = await ctx.db.query("concepts").take(100);

    // Get all edges
    const edges = await ctx.db.query("edges").take(500);

    const allNodes = new Map<
      string,
      {
        id: string;
        label: string;
        type: string;
        domain?: string;
        size: number;
      }
    >(
      concepts.map((c) => [
        `concept:${c.name}`,
        {
          id: `concept:${c.name}`,
          label: c.displayName,
          type: "concept",
          domain: c.domain,
          size: Math.min(c.mentionCount * 2 + 10, 50),
        },
      ]),
    );

    const allLinks = edges.map((e) => ({
      source: `${e.fromType}:${e.fromId}`,
      target: `${e.toType}:${e.toId}`,
      relationship: e.relationship,
      weight: e.weight ?? 1,
    }));

    for (const link of allLinks) {
      if (!allNodes.has(link.source)) {
        const parsed = parseNodeId(link.source);
        allNodes.set(link.source, {
          id: link.source,
          label: parsed.id || link.source,
          type: parsed.type,
          size: 12,
        });
      }
      if (!allNodes.has(link.target)) {
        const parsed = parseNodeId(link.target);
        allNodes.set(link.target, {
          id: link.target,
          label: parsed.id || link.target,
          type: parsed.type,
          size: 12,
        });
      }
    }

    if (!args.centerType || !args.centerId) {
      return { nodes: [...allNodes.values()], links: allLinks };
    }

    const centerNode = `${args.centerType}:${args.centerId}`;
    if (!allNodes.has(centerNode)) {
      return { nodes: [], links: [] };
    }

    const adjacency = new Map<string, Set<string>>();
    for (const link of allLinks) {
      if (!adjacency.has(link.source)) adjacency.set(link.source, new Set());
      if (!adjacency.has(link.target)) adjacency.set(link.target, new Set());
      adjacency.get(link.source)?.add(link.target);
      adjacency.get(link.target)?.add(link.source);
    }

    const visitedDepth = new Map<string, number>([[centerNode, 0]]);
    const queue: Array<{ node: string; depth: number }> = [
      { node: centerNode, depth: 0 },
    ];
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      if (next.depth >= maxDepth) continue;
      const neighbors = adjacency.get(next.node) ?? new Set<string>();
      for (const neighbor of neighbors) {
        if (visitedDepth.has(neighbor)) continue;
        const depth = next.depth + 1;
        visitedDepth.set(neighbor, depth);
        queue.push({ node: neighbor, depth });
      }
    }

    const allowedNodes = new Set(visitedDepth.keys());
    const nodes = [...allNodes.values()].filter((node) =>
      allowedNodes.has(node.id),
    );
    const links = allLinks.filter(
      (link) => allowedNodes.has(link.source) && allowedNodes.has(link.target),
    );

    return { nodes, links };
  },
});
