/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type DatabaseReader,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { claimValidator, compositionParameterValidator } from "./schema";
import {
  EXTRACTION_PROMPT_VERSION,
  extractionInputHash,
} from "./shared/extractionPrompt";
import { unextractableTextReason } from "./shared/sourceText";

/**
 * The current Extraction that already covers this text for this Source, or
 * for another live Source. An archived Source's Extraction, or one a later
 * Extraction superseded, does not count.
 */
async function extractionForInput(
  db: DatabaseReader,
  inputHash: string,
  sourceId: Id<"sources">,
): Promise<{ extraction: Doc<"extractions">; sameSource: boolean } | null> {
  // Only a Source's latest Extraction is current; storing a new one
  // supersedes the claims of the earlier ones.
  const latest = (id: Id<"sources">) =>
    db
      .query("extractions")
      .withIndex("by_sourceId_createdAt", (q) => q.eq("sourceId", id))
      .order("desc")
      .first();
  const own = await latest(sourceId);
  if (own?.inputHash === inputHash)
    return { extraction: own, sameSource: true };
  // Streams every match, stopping at the first live holder whose current
  // Extraction it is.
  for await (const match of db
    .query("extractions")
    .withIndex("by_inputHash", (q) => q.eq("inputHash", inputHash))) {
    if (match.sourceId === sourceId) continue;
    const holder = await db.get("sources", match.sourceId);
    if (
      holder &&
      holder.status !== "archived" &&
      (await latest(holder._id))?._id === match._id
    ) {
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

type StoreExtractionArgs = {
  sourceId: Id<"sources">;
  model: string;
  promptVersion: string;
  inputHash: string;
  summary: string;
  claims: Infer<typeof claimValidator>[];
  compositionParameters: Infer<typeof compositionParameterValidator>[];
  topics: string[];
  openQuestions: string[];
  confidence: number;
};

/**
 * Inserts an Extraction and its claims, superseding the Source's earlier
 * claims and registering parameter kinds. Callers check duplicates first.
 */
async function insertExtraction(
  ctx: MutationCtx,
  args: StoreExtractionArgs,
): Promise<{ extractionId: Id<"extractions"> }> {
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
    .withIndex("by_sourceId_createdAt", (q) => q.eq("sourceId", args.sourceId))
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
}

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
    return await insertExtraction(ctx, args);
  },
});

const operatorOutcomeValidator = v.union(
  v.object({ skipped: v.literal(true), reason: v.string() }),
  v.object({
    success: v.literal(true),
    model: v.string(),
    summary: v.string(),
    claimCount: v.number(),
    parameterCount: v.number(),
  }),
);

type OperatorSourceCheck =
  | { outcome: { skipped: true; reason: string } }
  | { content: string; outcome?: undefined };

/**
 * The operator's export is still current: the Source is text_ready and its
 * text hashes to the exported inputHash. Read inside the writing transaction,
 * so ingestion that changes the Source cannot slip in between.
 */
async function currentOperatorText(
  ctx: MutationCtx,
  sourceId: Id<"sources">,
  inputHash: string,
): Promise<OperatorSourceCheck> {
  const source = await ctx.db.get("sources", sourceId);
  if (!source) throw new Error("Source not found");
  if (source.status !== "text_ready") {
    return { outcome: { skipped: true, reason: `source is ${source.status}` } };
  }
  const content = source.rawText || source.transcript;
  if (!content || (await extractionInputHash(content)) !== inputHash) {
    return {
      outcome: {
        skipped: true,
        reason: "source text changed since export; export it again",
      },
    };
  }
  return { content };
}

async function setSourceStatus(
  ctx: MutationCtx,
  sourceId: Id<"sources">,
  status: Doc<"sources">["status"],
  blocked?: { reason: Doc<"sources">["blockedReason"]; details: string },
) {
  await ctx.db.patch("sources", sourceId, {
    status,
    blockedReason: blocked?.reason,
    blockedDetails: blocked?.details,
    updatedAt: Date.now(),
  });
}

/**
 * Stores an operator-written Extraction in one transaction: the export is
 * current, the text passes the extraction gate, no current Extraction covers
 * it, then the Extraction is stored and the Source marked extracted. The
 * caller (extract.storeOperatorExtraction) authorizes the operator.
 */
export const storeOperatorExtraction = internalMutation({
  args: {
    sourceId: v.id("sources"),
    model: v.string(),
    inputHash: v.string(),
    summary: v.string(),
    claims: v.array(claimValidator),
    compositionParameters: v.array(compositionParameterValidator),
    topics: v.array(v.string()),
    openQuestions: v.array(v.string()),
  },
  returns: operatorOutcomeValidator,
  handler: async (ctx, args) => {
    const checked = await currentOperatorText(
      ctx,
      args.sourceId,
      args.inputHash,
    );
    if (checked.outcome) return checked.outcome;
    const refused = unextractableTextReason(checked.content);
    if (refused) {
      await setSourceStatus(ctx, args.sourceId, "review_needed", {
        reason: "no_text",
        details: refused,
      });
      return { skipped: true as const, reason: refused };
    }
    const found = await extractionForInput(
      ctx.db,
      args.inputHash,
      args.sourceId,
    );
    if (found?.sameSource) {
      await setSourceStatus(ctx, args.sourceId, "extracted");
      return { skipped: true as const, reason: "already extracted" };
    }
    if (found) {
      await setSourceStatus(ctx, args.sourceId, "archived", {
        reason: "duplicate",
        details: `Same text as source ${found.extraction.sourceId} (extraction ${found.extraction._id})`,
      });
      return { skipped: true as const, reason: "duplicate extraction" };
    }
    await insertExtraction(ctx, {
      ...args,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      confidence: 0.8,
    });
    await setSourceStatus(ctx, args.sourceId, "extracted");
    return {
      success: true as const,
      model: args.model,
      summary: args.summary,
      claimCount: args.claims.length,
      parameterCount: args.compositionParameters.length,
    };
  },
});

/**
 * Parks a text_ready Source in one transaction when its text is still the
 * exported text and the extraction gate refuses it. Never extracts.
 */
export const parkOperatorUnextractable = internalMutation({
  args: { sourceId: v.id("sources"), inputHash: v.string() },
  returns: v.object({ parked: v.boolean(), reason: v.string() }),
  handler: async (ctx, args) => {
    const checked = await currentOperatorText(
      ctx,
      args.sourceId,
      args.inputHash,
    );
    if (checked.outcome) {
      return { parked: false, reason: checked.outcome.reason };
    }
    const reason = unextractableTextReason(checked.content);
    if (!reason) return { parked: false, reason: "text is extractable" };
    await setSourceStatus(ctx, args.sourceId, "review_needed", {
      reason: "no_text",
      details: reason,
    });
    return { parked: true, reason };
  },
});
