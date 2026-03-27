import { v } from "convex/values";
import { getSeedConceptDomainEntries } from "./domainMappings";
import { internalMutation, query } from "./_generated/server";
import { registryStatusValidator } from "./schema";

const KNOWN_PARAMETER_KINDS = new Set([
  "tempo",
  "key",
  "tuningSystem",
  "rootNote",
  "chordProgression",
  "rhythm",
  "instrument",
  "synthWaveform",
  "harmonicProfile",
  "frequency",
  "note",
]);

const KNOWN_CONCEPT_DOMAINS = new Set([
  "tuning",
  "acoustics",
  "psychoacoustics",
  "theory",
  "production",
  "mathematics",
  "geometry",
  "instrument",
  "general",
]);

const KNOWN_RELATIONSHIP_KINDS = new Set([
  "cites",
  "related_to",
  "contradicts",
  "supports",
  "mentions",
  "defines",
  "tests",
  "applies",
  "is_a",
  "part_of",
  "derived_from",
  "extracted_from",
  "generated_from",
  "implements",
]);

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function inferStatus(
  name: string,
  knownSet: Set<string>,
): "known" | "provisional" {
  return knownSet.has(name) ? "known" : "provisional";
}

export const ensureParameterKind = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.object({
    status: registryStatusValidator,
  }),
  handler: async (ctx, args) => {
    const name = normalizeName(args.name);
    if (!name) return { status: "provisional" };

    const existing = await ctx.db
      .query("parameterKinds")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (existing) return { status: existing.status };

    const now = Date.now();
    const status = inferStatus(name, KNOWN_PARAMETER_KINDS);
    await ctx.db.insert("parameterKinds", {
      name,
      status,
      description: args.description,
      introducedBy: "system",
      createdAt: now,
      updatedAt: now,
    });
    return { status };
  },
});

export const ensureConceptDomain = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    sectorMapping: v.optional(v.string()),
  },
  returns: v.object({
    status: registryStatusValidator,
  }),
  handler: async (ctx, args) => {
    const name = normalizeName(args.name);
    if (!name) return { status: "provisional" };

    const existing = await ctx.db
      .query("conceptDomains")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (existing) {
      if (args.sectorMapping && existing.sectorMapping !== args.sectorMapping) {
        await ctx.db.patch(existing._id, {
          sectorMapping: args.sectorMapping,
          updatedAt: Date.now(),
        });
      }
      return { status: existing.status };
    }

    const now = Date.now();
    const status = inferStatus(name, KNOWN_CONCEPT_DOMAINS);
    await ctx.db.insert("conceptDomains", {
      name,
      status,
      description: args.description,
      introducedBy: "system",
      sectorMapping: args.sectorMapping,
      createdAt: now,
      updatedAt: now,
    });
    return { status };
  },
});

export const seedConceptDomains = internalMutation({
  args: {},
  returns: v.object({
    seeded: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let seeded = 0;
    let updated = 0;

    for (const entry of getSeedConceptDomainEntries()) {
      const existing = await ctx.db
        .query("conceptDomains")
        .withIndex("by_name", (q) => q.eq("name", entry.name))
        .first();

      if (!existing) {
        await ctx.db.insert("conceptDomains", {
          name: entry.name,
          status: "known",
          introducedBy: "system",
          sectorMapping: entry.sectorMapping,
          createdAt: now,
          updatedAt: now,
        });
        seeded += 1;
        continue;
      }

      if (existing.status !== "known" || existing.sectorMapping !== entry.sectorMapping) {
        await ctx.db.patch(existing._id, {
          status: "known",
          sectorMapping: entry.sectorMapping,
          updatedAt: now,
        });
        updated += 1;
      }
    }

    return { seeded, updated };
  },
});

export const ensureRelationshipKind = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.object({
    status: registryStatusValidator,
  }),
  handler: async (ctx, args) => {
    const name = normalizeName(args.name);
    if (!name) return { status: "provisional" };

    const existing = await ctx.db
      .query("relationshipKinds")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (existing) return { status: existing.status };

    const now = Date.now();
    const status = inferStatus(name, KNOWN_RELATIONSHIP_KINDS);
    await ctx.db.insert("relationshipKinds", {
      name,
      status,
      description: args.description,
      introducedBy: "system",
      createdAt: now,
      updatedAt: now,
    });
    return { status };
  },
});

export const reviewSummary = query({
  args: {},
  returns: v.object({
    provisionalParameterKinds: v.array(v.string()),
    provisionalConceptDomains: v.array(v.string()),
    provisionalRelationshipKinds: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const [parameterKinds, conceptDomains, relationshipKinds] =
      await Promise.all([
        ctx.db
          .query("parameterKinds")
          .withIndex("by_status", (q) => q.eq("status", "provisional"))
          .collect(),
        ctx.db
          .query("conceptDomains")
          .withIndex("by_status", (q) => q.eq("status", "provisional"))
          .collect(),
        ctx.db
          .query("relationshipKinds")
          .withIndex("by_status", (q) => q.eq("status", "provisional"))
          .collect(),
      ]);

    return {
      provisionalParameterKinds: parameterKinds.map((item) => item.name),
      provisionalConceptDomains: conceptDomains.map((item) => item.name),
      provisionalRelationshipKinds: relationshipKinds.map((item) => item.name),
    };
  },
});
