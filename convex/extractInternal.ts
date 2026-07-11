/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { claimValidator, compositionParameterValidator } from "./schema";

export const storeExtraction = internalMutation({
  args: {
    sourceId: v.id("sources"),
    model: v.string(),
    promptVersion: v.string(),
    inputHash: v.string(),
    summary: v.string(),
    claims: v.array(claimValidator),
    compositionParameters: v.array(compositionParameterValidator),
    topics: v.array(v.string()),
    openQuestions: v.array(v.string()),
    confidence: v.number(),
  },
  returns: v.id("extractions"),
  handler: async (ctx, args): Promise<Id<"extractions">> => {
    const compositionParameters: Doc<"extractions">["compositionParameters"] =
      await Promise.all(
        args.compositionParameters.map(
          async (
            parameter,
          ): Promise<Doc<"extractions">["compositionParameters"][number]> => {
            const kind = (parameter.kind ?? parameter.type ?? "").trim();
            const registry:
              | {
                  status: NonNullable<
                    Doc<"extractions">["compositionParameters"][number]["registryStatus"]
                  >;
                }
              | undefined = kind
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
              registryStatus:
                registry?.status ??
                (parameter.registryStatus as Doc<"extractions">["compositionParameters"][number]["registryStatus"]),
              canonicalKind,
            };
          },
        ),
      );

    const previousExtraction = await ctx.db
      .query("extractions")
      .withIndex("by_sourceId_createdAt", (q) =>
        q.eq("sourceId", args.sourceId),
      )
      .order("desc")
      .first();
    if (previousExtraction) {
      const previousClaims = await ctx.db
        .query("claims")
        .withIndex("by_extractionId_ordinal", (q) =>
          q.eq("extractionId", previousExtraction._id),
        )
        .take(previousExtraction.claims.length);
      for (const claim of previousClaims) {
        if (claim.status === "active") {
          await ctx.db.patch("claims", claim._id, { status: "superseded" });
        }
      }
    }

    const createdBy = "system" as const;
    const createdAt = Date.now();
    const extractionId = await ctx.db.insert("extractions", {
      ...args,
      compositionParameters,
      createdBy,
      createdAt,
    });

    for (const [ordinal, claim] of args.claims.entries()) {
      await ctx.db.insert("claims", {
        extractionId,
        sourceId: args.sourceId,
        ordinal,
        ...claim,
        status: "active",
        createdBy,
        createdAt,
      });
    }

    return extractionId;
  },
});
