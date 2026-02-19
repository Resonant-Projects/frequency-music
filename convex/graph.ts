import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

// ============================================================================
// CONCEPT QUERIES
// ============================================================================

/**
 * Get a concept by canonical name
 */
export const getConcept = query({
  args: { name: v.string() },
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
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    
    // Use search index
    const results = await ctx.db
      .query("concepts")
      .withSearchIndex("search_concepts", (q) => q.search("displayName", args.query))
      .take(limit);
    
    return results;
  },
});

/**
 * List concepts by domain
 */
export const listByDomain = query({
  args: { domain: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("concepts")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain as any))
      .take(args.limit ?? 50);
  },
});

/**
 * Get top concepts by mention count
 */
export const getTopConcepts = query({
  args: { limit: v.optional(v.number()) },
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
  handler: async (ctx, args) => {
    const normalized = args.name.toLowerCase().trim();
    const existing = await ctx.db
      .query("concepts")
      .withIndex("by_name", (q) => q.eq("name", normalized))
      .first();
    
    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        displayName: args.displayName ?? existing.displayName,
        description: args.description ?? existing.description,
        domain: (args.domain as any) ?? existing.domain,
        aliases: args.aliases ?? existing.aliases,
        wikipedia: args.wikipedia ?? existing.wikipedia,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new
      return await ctx.db.insert("concepts", {
        name: normalized,
        displayName: args.displayName ?? args.name,
        description: args.description,
        domain: (args.domain as any) ?? "general",
        aliases: args.aliases ?? [],
        wikipedia: args.wikipedia,
        mentionCount: 0,
        hypothesisCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Increment concept mention count
 */
export const incrementMentions = mutation({
  args: { conceptId: v.id("concepts"), amount: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const concept = await ctx.db.get(args.conceptId);
    if (!concept) return;
    
    await ctx.db.patch(args.conceptId, {
      mentionCount: concept.mentionCount + (args.amount ?? 1),
      updatedAt: Date.now(),
    });
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
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("edges")
      .withIndex("by_from", (q) => 
        q.eq("fromType", args.fromType as any).eq("fromId", args.fromId)
      );
    
    const edges = await q.collect();
    
    if (args.relationship) {
      return edges.filter((e) => e.relationship === args.relationship);
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
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("edges")
      .withIndex("by_to", (q) => 
        q.eq("toType", args.toType as any).eq("toId", args.toId)
      );
    
    const edges = await q.collect();
    
    if (args.relationship) {
      return edges.filter((e) => e.relationship === args.relationship);
    }
    return edges;
  },
});

/**
 * Get related sources for a source (via shared concepts or direct links)
 */
export const getRelatedSources = query({
  args: { sourceId: v.id("sources"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    
    // Get direct relationships
    const directEdges = await ctx.db
      .query("edges")
      .withIndex("by_from", (q) => 
        q.eq("fromType", "source").eq("fromId", args.sourceId)
      )
      .filter((q) => q.eq(q.field("toType"), "source"))
      .take(limit);
    
    // Get concepts this source mentions
    const conceptEdges = await ctx.db
      .query("edges")
      .withIndex("by_from", (q) => 
        q.eq("fromType", "source").eq("fromId", args.sourceId)
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
          q.eq("toType", "concept").eq("toId", conceptId)
        )
        .filter((q) => 
          q.and(
            q.eq(q.field("fromType"), "source"),
            q.neq(q.field("fromId"), args.sourceId)
          )
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
  handler: async (ctx, args) => {
    const edges = await ctx.db
      .query("edges")
      .withIndex("by_from", (q) => 
        q.eq("fromType", args.entityType as any).eq("fromId", args.entityId)
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
      })
    );
    
    return concepts.filter(Boolean);
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
  handler: async (ctx, args) => {
    // Check if edge already exists
    const existing = await ctx.db
      .query("edges")
      .withIndex("by_from", (q) => 
        q.eq("fromType", args.fromType as any).eq("fromId", args.fromId)
      )
      .filter((q) => 
        q.and(
          q.eq(q.field("toType"), args.toType),
          q.eq(q.field("toId"), args.toId),
          q.eq(q.field("relationship"), args.relationship)
        )
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
      relationship: args.relationship as any,
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
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
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
  handler: async (ctx, args) => {
    const extractions = await ctx.runQuery(api.extractions.listRecent, {
      limit: args.limit ?? 100,
    });
    
    let processed = 0;
    let conceptsLinked = 0;
    
    for (const extraction of extractions) {
      try {
        const result = await ctx.runAction(api.graph.linkExtractionConcepts, {
          extractionId: extraction._id,
        });
        conceptsLinked += result.linked;
        processed++;
      } catch (e) {
        // Continue on error
      }
    }
    
    return { processed, conceptsLinked };
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
  handler: async (ctx, args) => {
    const depth = args.depth ?? 2;
    
    // Get all concepts as nodes
    const concepts = await ctx.db.query("concepts").take(100);
    
    // Get all edges
    const edges = await ctx.db.query("edges").take(500);
    
    // Build node list
    const nodes = concepts.map((c) => ({
      id: `concept:${c.name}`,
      label: c.displayName,
      type: "concept",
      domain: c.domain,
      size: Math.min(c.mentionCount * 2 + 10, 50),
    }));
    
    // Build edge list for visualization
    const links = edges.map((e) => ({
      source: `${e.fromType}:${e.fromId}`,
      target: `${e.toType}:${e.toId}`,
      relationship: e.relationship,
      weight: e.weight ?? 1,
    }));
    
    return { nodes, links };
  },
});
