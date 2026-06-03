import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

export const storeExtraction = internalMutation({
  args: {
    sourceId: v.id("sources"),
    model: v.string(),
    promptVersion: v.string(),
    inputHash: v.string(),
    summary: v.string(),
    claims: v.array(
      v.object({
        text: v.string(),
        evidenceLevel: v.union(
          v.literal("peer_reviewed"),
          v.literal("preprint"),
          v.literal("anecdotal"),
          v.literal("speculative"),
          v.literal("personal"),
        ),
        citations: v.array(
          v.object({
            label: v.optional(v.string()),
            url: v.optional(v.string()),
            quote: v.optional(v.string()),
          }),
        ),
        truthConfidence: v.optional(
          v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
        ),
        interestLevel: v.optional(
          v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
        ),
      }),
    ),
    compositionParameters: v.array(
      v.object({
        kind: v.optional(v.string()),
        type: v.optional(v.string()),
        value: v.string(),
        details: v.optional(v.any()),
        registryStatus: v.optional(v.string()),
        canonicalKind: v.optional(v.string()),
      }),
    ),
    topics: v.array(v.string()),
    openQuestions: v.array(v.string()),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const compositionParameters = await Promise.all(
      args.compositionParameters.map(async (parameter) => {
        const kind = (parameter.kind ?? parameter.type ?? "").trim();
        const registry = kind
          ? await ctx.runMutation(internal.vocabulary.ensureParameterKind, {
              name: kind,
            })
          : undefined;
        const canonicalKind =
          parameter.canonicalKind?.trim() || kind || undefined;
        return {
          kind,
          type: parameter.type ?? kind,
          value: parameter.value,
          details: parameter.details,
          registryStatus: registry?.status ?? parameter.registryStatus,
          canonicalKind,
        };
      }),
    );

    return await ctx.db.insert("extractions", {
      ...args,
      compositionParameters,
      createdBy: "system",
      createdAt: Date.now(),
    });
  },
});
