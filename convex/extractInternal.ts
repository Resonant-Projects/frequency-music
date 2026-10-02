/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type DatabaseReader,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { claimValidator, compositionParameterValidator } from "./schema";

/**
 * The Extraction that already covers this text for this Source, or for
 * another live Source. An archived Source's Extraction does not count, so a
 * live copy is never archived in favour of it.
 */
async function extractionForInput(
  db: DatabaseReader,
  inputHash: string,
  sourceId: Id<"sources">,
): Promise<{ extraction: Doc<"extractions">; sameSource: boolean } | null> {
  const matches = await db
    .query("extractions")
    .withIndex("by_inputHash", (q) => q.eq("inputHash", inputHash))
    .take(25);
  const own = matches.find((match) => match.sourceId === sourceId);
  if (own) return { extraction: own, sameSource: true };
  for (const match of matches) {
    const holder = await db.get("sources", match.sourceId);
    if (holder && holder.status !== "archived") {
      return { extraction: match, sameSource: false };
    }
  }
  return null;
}

export const findExtractionForInput = internalQuery({
  args: { inputHash: v.string(), sourceId: v.id("sources") },
  returns: v.union(
    v.null(),
    v.object({
      extractionId: v.id("extractions"),
      sourceId: v.id("sources"),
      sameSource: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const found = await extractionForInput(
      ctx.db,
      args.inputHash,
      args.sourceId,
    );
    return found
      ? {
          extractionId: found.extraction._id,
          sourceId: found.extraction.sourceId,
          sameSource: found.sameSource,
        }
      : null;
  },
});

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
    // A forced re-extraction may repeat text another Source already holds.
    allowDuplicateInput: v.optional(v.boolean()),
  },
  returns: v.object({
    extractionId: v.id("extractions"),
    // Set when an Extraction of this text already existed and none was stored.
    existing: v.optional(v.boolean()),
    duplicateOfSource: v.optional(v.id("sources")),
  }),
  handler: async (
    ctx,
    { allowDuplicateInput, ...args },
  ): Promise<{
    extractionId: Id<"extractions">;
    existing?: boolean;
    duplicateOfSource?: Id<"sources">;
  }> => {
    // Checked inside this transaction, so two concurrent Extractions of the
    // same text cannot both store claims.
    if (!allowDuplicateInput) {
      const found = await extractionForInput(
        ctx.db,
        args.inputHash,
        args.sourceId,
      );
      // A concurrent call for this Source or another live one stored it first.
      if (found) {
        return {
          extractionId: found.extraction._id,
          existing: true,
          ...(found.sameSource
            ? {}
            : { duplicateOfSource: found.extraction.sourceId }),
        };
      }
    }
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

    const claimIds: Id<"claims">[] = [];
    for (const [ordinal, claim] of args.claims.entries()) {
      const claimId = await ctx.db.insert("claims", {
        extractionId,
        sourceId: args.sourceId,
        ordinal,
        ...claim,
        status: "active",
        createdBy,
        createdAt,
      });
      claimIds.push(claimId);
    }
    if (claimIds.length > 0) {
      await ctx.scheduler.runAfter(0, internal.embeddings.embedClaims, {
        claimIds,
      });
    }

    return { extractionId };
  },
});
