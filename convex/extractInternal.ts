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

    return await ctx.db.insert("extractions", {
      ...args,
      compositionParameters,
      createdBy: "system",
      createdAt: Date.now(),
    });
  },
});
