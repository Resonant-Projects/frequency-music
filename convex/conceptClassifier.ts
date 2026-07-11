/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireAuth } from "./auth";
import { MODELS } from "./llm";

const classificationValidator = v.object({
  conceptId: v.id("concepts"),
  domains: v.array(v.string()),
  missionRelevance: v.union(v.literal("on"), v.literal("off")),
  rationale: v.string(),
});

const writeResultValidator = v.object({
  assigned: v.number(),
  unreviewed: v.number(),
  skipped: v.number(),
});

const batchResultValidator = v.object({
  classifications: v.array(classificationValidator),
  assigned: v.number(),
  unreviewed: v.number(),
  skipped: v.number(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  llmCalls: v.number(),
});

type ClassificationWrite = {
  conceptId: Id<"concepts">;
  domains: string[];
  missionRelevance: "on" | "off";
  rationale: string;
};

type ClassificationInputBatch = {
  domains: Array<{ name: string; description?: string }>;
  concepts: Array<{
    conceptId: Id<"concepts">;
    displayName: string;
    aliases: string[];
    description?: string;
    coMentionedConcepts: string[];
  }>;
};

type GeneratedClassificationBatch = {
  classifications: Array<{
    domains: string[];
    missionRelevance: "on" | "off";
    rationale: string;
  }>;
  inputTokens: number;
  outputTokens: number;
};

type BatchResult = {
  classifications: ClassificationWrite[];
  assigned: number;
  unreviewed: number;
  skipped: number;
  inputTokens: number;
  outputTokens: number;
  llmCalls: number;
};

const getClassificationInputsRef = makeFunctionReference<
  "query",
  { conceptIds: Id<"concepts">[]; force: boolean },
  ClassificationInputBatch
>("conceptClassifier:getClassificationInputs");
const generateClassificationsRef = makeFunctionReference<
  "action",
  { system: string; prompt: string; model: string; expectedCount: number },
  GeneratedClassificationBatch
>("conceptClassifierInternal:generateClassifications");
const writeClassificationsInternalRef = makeFunctionReference<
  "mutation",
  { classifications: ClassificationWrite[]; model: string; force: boolean },
  { assigned: number; unreviewed: number; skipped: number }
>("conceptClassifier:writeClassificationsInternal");
const classifyConceptBatchRef = makeFunctionReference<
  "action",
  {
    conceptIds: Id<"concepts">[];
    model?: string;
    force?: boolean;
    apply?: boolean;
  },
  BatchResult
>("conceptClassifier:classifyConceptBatch");
const listStaleUnreviewedRef = makeFunctionReference<
  "query",
  { cutoff: number; limit: number },
  Id<"concepts">[]
>("conceptClassifier:listStaleUnreviewed");

function normalizeDomain(name: string): string {
  return name.trim().toLowerCase();
}

async function persistClassifications(
  ctx: MutationCtx,
  args: {
    classifications: ClassificationWrite[];
    model: string;
    force: boolean;
  },
) {
  const registry = await ctx.db.query("conceptDomains").collect();
  const registryNames = new Set(registry.map((entry) => entry.name));
  const assignableRegistryNames = new Set(
    registry
      .filter(
        (entry) => entry.status === "known" || entry.status === "experimental",
      )
      .map((entry) => entry.name),
  );
  const stagedProvisionalNames = new Set<string>();
  let assigned = 0;
  let unreviewed = 0;
  let skipped = 0;

  for (const classification of args.classifications) {
    const concept = await ctx.db.get("concepts", classification.conceptId);
    if (!concept || (concept.classifiedAt !== undefined && !args.force)) {
      skipped++;
      continue;
    }
    const domains = Array.from(
      new Set(classification.domains.map(normalizeDomain).filter(Boolean)),
    ).slice(0, 3);
    const unknownDomains = domains.filter(
      (name) => !assignableRegistryNames.has(name),
    );
    if (unknownDomains.length > 0) {
      const now = Date.now();
      for (const name of unknownDomains) {
        if (!registryNames.has(name) && !stagedProvisionalNames.has(name)) {
          await ctx.db.insert("conceptDomains", {
            name,
            status: "provisional",
            introducedBy: "system",
            notes: "Proposed by concept classifier; requires registry review.",
            createdAt: now,
            updatedAt: now,
          });
          stagedProvisionalNames.add(name);
        }
      }
      await ctx.db.patch("concepts", classification.conceptId, {
        missionRelevance: "unreviewed",
        relevanceRationale: `classifier proposed unknown domain: ${unknownDomains.join(", ")}`,
        classifierModel: args.model,
        updatedAt: now,
      });
      unreviewed++;
      continue;
    }
    if (domains.length === 0) {
      await ctx.db.patch("concepts", classification.conceptId, {
        missionRelevance: "unreviewed",
        relevanceRationale: "classifier returned no usable domain",
        classifierModel: args.model,
        updatedAt: Date.now(),
      });
      unreviewed++;
      continue;
    }
    const [primaryDomain] = domains;
    if (!primaryDomain) {
      throw new Error("Validated classification has no primary domain");
    }
    const now = Date.now();
    await ctx.db.patch("concepts", classification.conceptId, {
      domain: primaryDomain,
      domains,
      missionRelevance: classification.missionRelevance,
      relevanceRationale: classification.rationale.trim(),
      classifiedAt: now,
      classifierModel: args.model,
      updatedAt: now,
    });
    assigned++;
  }
  return { assigned, unreviewed, skipped };
}

export const writeClassifications = mutation({
  args: {
    classifications: v.array(classificationValidator),
    model: v.string(),
    force: v.boolean(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: writeResultValidator,
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    return await persistClassifications(ctx, args);
  },
});

export const writeClassificationsInternal = internalMutation({
  args: {
    classifications: v.array(classificationValidator),
    model: v.string(),
    force: v.boolean(),
  },
  returns: writeResultValidator,
  handler: persistClassifications,
});

export const listClassificationCandidates = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    batchSize: v.number(),
    force: v.boolean(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    conceptIds: v.array(v.id("concepts")),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const batchSize = Math.min(Math.max(args.batchSize, 1), 20);
    const page = await ctx.db
      .query("concepts")
      .paginate({ cursor: args.cursor, numItems: batchSize });
    return {
      conceptIds: page.page
        .filter((concept) => args.force || concept.classifiedAt === undefined)
        .map((concept) => concept._id),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const getClassificationInputs = internalQuery({
  args: {
    conceptIds: v.array(v.id("concepts")),
    force: v.boolean(),
  },
  returns: v.object({
    domains: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
      }),
    ),
    concepts: v.array(
      v.object({
        conceptId: v.id("concepts"),
        displayName: v.string(),
        aliases: v.array(v.string()),
        description: v.optional(v.string()),
        coMentionedConcepts: v.array(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const registry = await ctx.db.query("conceptDomains").collect();
    const concepts = [];
    for (const conceptId of args.conceptIds) {
      const concept = await ctx.db.get("concepts", conceptId);
      if (!concept || (concept.classifiedAt !== undefined && !args.force)) {
        continue;
      }
      const sourceEdges = await ctx.db
        .query("edges")
        .withIndex("by_to_fromType", (q) =>
          q
            .eq("toType", "concept")
            .eq("toId", concept.name)
            .eq("fromType", "source"),
        )
        .take(5);
      const coMentioned = new Set<string>();
      for (const sourceEdge of sourceEdges) {
        const siblingEdges = await ctx.db
          .query("edges")
          .withIndex("by_from", (q) =>
            q.eq("fromType", "source").eq("fromId", sourceEdge.fromId),
          )
          .take(20);
        for (const edge of siblingEdges) {
          if (edge.toType === "concept" && edge.toId !== concept.name) {
            coMentioned.add(edge.toId);
          }
          if (coMentioned.size >= 8) break;
        }
        if (coMentioned.size >= 8) break;
      }
      concepts.push({
        conceptId,
        displayName: concept.displayName,
        aliases: concept.aliases,
        description: concept.description,
        coMentionedConcepts: Array.from(coMentioned),
      });
    }
    return {
      domains: registry
        .filter(
          (entry) =>
            entry.status === "known" || entry.status === "experimental",
        )
        .map(({ name, description }) => ({ name, description })),
      concepts,
    };
  },
});

const SYSTEM_PROMPT = `You classify concepts for a research-to-composition program spanning music, physics, mathematics, geometry, consciousness, and sound. Use only the supplied registry domain names. Mark incidental ML/software/general science capture off-mission. Return one classification per concept in the same order, with 1-3 domains (primary first), on/off mission relevance, and a one-sentence rationale.`;

export const classifyConceptBatch = internalAction({
  args: {
    conceptIds: v.array(v.id("concepts")),
    model: v.optional(v.string()),
    force: v.optional(v.boolean()),
    apply: v.optional(v.boolean()),
  },
  returns: batchResultValidator,
  handler: async (ctx, args): Promise<BatchResult> => {
    const model = args.model ?? MODELS.sonnet;
    const force = args.force ?? false;
    const apply = args.apply ?? true;
    const totals = {
      classifications: [] as ClassificationWrite[],
      assigned: 0,
      unreviewed: 0,
      skipped: 0,
      inputTokens: 0,
      outputTokens: 0,
      llmCalls: 0,
    };
    for (let offset = 0; offset < args.conceptIds.length; offset += 20) {
      const conceptIds = args.conceptIds.slice(offset, offset + 20);
      const input = await ctx.runQuery(getClassificationInputsRef, {
        conceptIds,
        force,
      });
      if (input.concepts.length === 0) {
        totals.skipped += conceptIds.length;
        continue;
      }
      const generated = await ctx.runAction(generateClassificationsRef, {
        system: SYSTEM_PROMPT,
        prompt: JSON.stringify({
          registryDomains: input.domains,
          concepts: input.concepts.map(
            ({ conceptId: _conceptId, ...concept }) => concept,
          ),
        }),
        model,
        expectedCount: input.concepts.length,
      });
      const classifications = generated.classifications.map(
        (classification, index) => {
          const concept = input.concepts[index];
          if (!concept) {
            throw new Error(
              `Missing concept input at classification index ${index}`,
            );
          }
          return { conceptId: concept.conceptId, ...classification };
        },
      );
      totals.classifications.push(...classifications);
      totals.inputTokens += generated.inputTokens;
      totals.outputTokens += generated.outputTokens;
      totals.llmCalls++;
      if (apply) {
        const written = await ctx.runMutation(writeClassificationsInternalRef, {
          classifications,
          model,
          force,
        });
        totals.assigned += written.assigned;
        totals.unreviewed += written.unreviewed;
        totals.skipped += written.skipped;
      }
    }
    return totals;
  },
});

export const classifyConcepts = action({
  args: {
    conceptIds: v.array(v.id("concepts")),
    model: v.optional(v.string()),
    force: v.boolean(),
    apply: v.boolean(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: batchResultValidator,
  handler: async (ctx, args): Promise<BatchResult> => {
    await requireAuth(ctx, args);
    return await ctx.runAction(classifyConceptBatchRef, {
      conceptIds: args.conceptIds,
      model: args.model,
      force: args.force,
      apply: args.apply,
    });
  },
});

export const listStaleUnreviewed = internalQuery({
  args: { cutoff: v.number(), limit: v.number() },
  returns: v.array(v.id("concepts")),
  handler: async (ctx, args) => {
    const concepts = await ctx.db
      .query("concepts")
      .withIndex("by_missionRelevance", (q) =>
        q.eq("missionRelevance", "unreviewed"),
      )
      .take(Math.min(Math.max(args.limit, 1), 20));
    return concepts
      .filter((concept) => concept.createdAt <= args.cutoff)
      .map((concept) => concept._id);
  },
});

export const sweepUnreviewedConcepts = internalAction({
  args: {},
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx): Promise<{ scheduled: number }> => {
    const conceptIds: Id<"concepts">[] = await ctx.runQuery(
      listStaleUnreviewedRef,
      { cutoff: Date.now() - 60 * 60 * 1000, limit: 20 },
    );
    if (conceptIds.length > 0) {
      await ctx.scheduler.runAfter(0, classifyConceptBatchRef, { conceptIds });
    }
    return { scheduled: conceptIds.length };
  },
});
