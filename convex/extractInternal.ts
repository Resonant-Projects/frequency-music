/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  type DatabaseReader,
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { currentExtractions, retireClaimsBatch } from "./extractions";
import {
  recordOperationFailure,
  resolveOperationFailure,
} from "./operationFailures";
import {
  claimValidator,
  compositionParameterValidator,
  extractionResultValidator,
} from "./schema";
import {
  EXTRACT_SYSTEM_PROMPT,
  EXTRACTION_PROMPT_VERSION,
  extractionInputHash,
  renderExtractionPrompt,
} from "./shared/extractionPrompt";
import { failureCause } from "./shared/failureCause";
import { advanceSourceVersion } from "./shared/sourceRecovery";
import { unextractableTextReason } from "./shared/sourceText";
import { truncateText } from "./shared/truncateText";

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
  let readBytes = 0;
  let reads = 0;
  const recordRead = (row: unknown) => {
    reads++;
    if (row)
      readBytes += new TextEncoder().encode(JSON.stringify(row)).byteLength;
  };
  const available = () => readBytes < 4_000_000 && reads < 128;
  // Always check our latest reading, then perform bounded cross-Source dedupe.
  // Retained history cannot consume this scan. Legacy duplicates may consume
  // its allowance, but cannot prevent reserving a new exact snapshot.
  const latest = (id: Id<"sources">) =>
    currentExtractions(db, id).first(recordRead);
  const own = await latest(sourceId);
  if (own?.inputHash === inputHash)
    return { extraction: own, sameSource: true };
  for (const historical of [false, undefined]) {
    if (!available()) break;
    for await (const match of db
      .query("extractions")
      .withIndex("by_inputHash_historical", (q) =>
        q.eq("inputHash", inputHash).eq("historical", historical),
      )
      .order("desc")) {
      recordRead(match);
      if (!available()) return null;
      if (match.sourceId === sourceId) continue;
      const holder = await db.get("sources", match.sourceId);
      recordRead(holder);
      if (!available()) return null;
      if (
        holder &&
        holder.status !== "archived" &&
        (await latest(holder._id))?._id === match._id
      )
        return { extraction: match, sameSource: false };
      if (!available()) return null;
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
  historical?: boolean;
  snapshotId?: Id<"extractionAttempts">;
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

  if (!args.historical) {
    // Obsolete legacy readings drain in separate transactions before this
    // atomic transition. Preserve the latest reading until all checks pass.
    const readings = await currentExtractions(ctx.db, args.sourceId).take(2);
    if (readings.length > 1)
      throw new Error("Legacy retirement needs another completion batch");
    const previousExtraction = readings[0];
    if (previousExtraction) {
      const claims: Doc<"claims">[] = [];
      let bytes = 0;
      for await (const claim of ctx.db
        .query("claims")
        .withIndex("by_extractionId_status", (q) =>
          q.eq("extractionId", previousExtraction._id).eq("status", "active"),
        )) {
        bytes += new TextEncoder().encode(JSON.stringify(claim)).byteLength;
        if (bytes > 1_000_000 || claims.length >= 1000)
          throw new Error(
            "Current Claim retirement requires review; retained output is preserved",
          );
        claims.push(claim);
      }
      for (const claim of claims)
        await ctx.db.patch(claim._id, { status: "superseded" });
      await ctx.db.patch(previousExtraction._id, { historical: true });
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
      status: args.historical ? "superseded" : "active",
      createdBy,
      createdAt,
    });
    claimIds.push(claimId);
  }
  if (claimIds.length > 0 && !args.historical) {
    await ctx.scheduler.runAfter(0, internal.embeddings.embedClaims, {
      claimIds,
    });
  }
  // Every writer (worker, workflows, operator) links concepts here, so the
  // correspondence miner sees each stored Extraction.
  if (args.topics.length > 0) {
    await ctx.scheduler.runAfter(0, internal.graph.linkExtraction, {
      extractionId,
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
  | { content: string; source: Doc<"sources">; outcome?: undefined };

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
  return { content, source };
}

async function setSourceStatus(
  ctx: MutationCtx,
  source: Doc<"sources">,
  status: Doc<"sources">["status"],
  blocked?: { reason: Doc<"sources">["blockedReason"]; details: string },
) {
  await ctx.db.patch("sources", source._id, {
    status,
    blockedReason: blocked?.reason,
    blockedDetails: blocked?.details,
    updatedAt: advanceSourceVersion(source.updatedAt),
  });
}

/** A covering Extraction settles the Source: extracted if its own, else archived as a duplicate. */
async function settleFoundExtraction(
  ctx: MutationCtx,
  source: Doc<"sources">,
  found: { extraction: Doc<"extractions">; sameSource: boolean },
) {
  await setSourceStatus(
    ctx,
    source,
    found.sameSource ? "extracted" : "archived",
    found.sameSource
      ? undefined
      : {
          reason: "duplicate",
          details: `Same text as source ${found.extraction.sourceId} (extraction ${found.extraction._id})`,
        },
  );
  // Covering output retires ownership, but preserves unfinished snapshots as history.
  await settleExtractionOwnership(ctx, source);
}

async function settleExtractionOwnership(
  ctx: MutationCtx,
  source: Doc<"sources">,
) {
  if (source.activeExtractionAttemptId) {
    await resolveOperationFailure(
      ctx,
      `extraction:${source.activeExtractionAttemptId}`,
    );
  }
  await ctx.db.patch(source._id, { activeExtractionAttemptId: undefined });
}

/** Capture admission and input in the same transaction as Source disposition. */
export const beginExtraction = internalMutation({
  args: {
    sourceId: v.id("sources"),
    model: v.string(),
    force: v.optional(v.boolean()),
    expectedInputHash: v.optional(v.string()),
  },
  returns: v.union(
    v.object({ skipped: v.literal(true), reason: v.string() }),
    v.object({
      attemptId: v.id("extractionAttempts"),
      prompt: v.string(),
      systemPrompt: v.string(),
      promptVersion: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) throw new Error("Source not found");
    if (source.status === "archived")
      return { skipped: true as const, reason: "source is archived" };
    const content = source.rawText || source.transcript || "";
    const inputHash = await extractionInputHash(content);
    if (args.expectedInputHash && inputHash !== args.expectedInputHash)
      return { skipped: true as const, reason: "Source changed since export" };
    const reason = unextractableTextReason(content);
    if (reason) {
      await setSourceStatus(ctx, source, "review_needed", {
        reason: "no_text",
        details: reason,
      });
      return { skipped: true as const, reason };
    }
    const origin = args.expectedInputHash ? "operator" : "worker";
    if (!args.force) {
      const found = await extractionForInput(ctx.db, inputHash, source._id);
      if (found) {
        await settleFoundExtraction(ctx, source, found);
        return {
          skipped: true as const,
          reason: found.sameSource
            ? "already extracted"
            : "duplicate extraction",
        };
      }
    }
    if (source.activeExtractionAttemptId) {
      const active = await ctx.db.get(source.activeExtractionAttemptId);
      if (
        active &&
        active.inputHash === inputHash &&
        active.model === args.model &&
        active.origin === origin &&
        active.title === source.title &&
        active.canonicalUrl === source.canonicalUrl &&
        active.force === (args.force === true) &&
        (active.status === "pending" ||
          active.status === "generated" ||
          active.status === "failed")
      ) {
        // Saving identical text can reset disposition without changing ownership.
        await setSourceStatus(ctx, source, "extracting");
        return {
          attemptId: active._id,
          prompt: active.prompt,
          systemPrompt: active.systemPrompt,
          promptVersion: active.promptVersion,
        };
      }
    }
    const now = Date.now();
    const prompt = renderExtractionPrompt({
      title: source.title,
      canonicalUrl: source.canonicalUrl,
      content,
    });
    const attemptId = await ctx.db.insert("extractionAttempts", {
      sourceId: source._id,
      inputHash,
      prompt,
      origin,
      systemPrompt: EXTRACT_SYSTEM_PROMPT,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      title: source.title,
      canonicalUrl: source.canonicalUrl,
      model: args.model,
      force: args.force === true,
      sourceVersion: source.updatedAt,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(source._id, {
      status: "extracting",
      activeExtractionAttemptId: attemptId,
      blockedReason: undefined,
      blockedDetails: undefined,
      updatedAt: advanceSourceVersion(source.updatedAt, now),
    });
    return {
      attemptId,
      prompt,
      systemPrompt: EXTRACT_SYSTEM_PROMPT,
      promptVersion: EXTRACTION_PROMPT_VERSION,
    };
  },
});

export const retainExtractionResult = internalMutation({
  args: {
    attemptId: v.id("extractionAttempts"),
    result: extractionResultValidator,
    generationLease: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { attemptId, result, generationLease }) => {
    const attempt = await ctx.db.get(attemptId);
    if (!attempt) throw new Error("Extraction attempt not found");
    if (attempt.generationLease && attempt.generationLease !== generationLease)
      throw new Error("Extraction generation lease changed");
    // First result wins, including after an ambiguous response or duplicate delivery.
    if (!attempt.result && attempt.status !== "completed") {
      await ctx.db.patch(attemptId, {
        result,
        status: "generated",
        error: undefined,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

const completionValidator = v.object({
  extractionId: v.id("extractions"),
  current: v.boolean(),
  model: v.string(),
  summary: v.string(),
  claimCount: v.number(),
  parameterCount: v.number(),
});

export const prepareRetirementBatch = internalMutation({
  args: {
    attemptId: v.optional(v.id("extractionAttempts")),
    sourceId: v.optional(v.id("sources")),
    inputHash: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const attempt = args.attemptId ? await ctx.db.get(args.attemptId) : null;
    if (args.attemptId && !attempt?.result)
      throw new Error("Extraction has no retained result");
    if (attempt?.extractionId) return true;
    const sourceId = attempt?.sourceId ?? args.sourceId;
    if (!sourceId) throw new Error("Source required");
    const source = await ctx.db.get(sourceId);
    if (!source) return true;
    if (attempt) {
      if (
        source.activeExtractionAttemptId !== attempt._id ||
        !["extracting", "text_ready", "review_needed"].includes(
          source.status,
        ) ||
        (source.status === "review_needed" &&
          source.blockedReason !== "ai_error") ||
        source.title !== attempt.title ||
        source.canonicalUrl !== attempt.canonicalUrl ||
        (await extractionInputHash(
          source.rawText || source.transcript || "",
          attempt.promptVersion,
        )) !== attempt.inputHash
      )
        return true;
      await ctx.db.patch(attempt._id, { updatedAt: Date.now() });
    } else if (
      source.status !== "text_ready" ||
      !args.inputHash ||
      (await extractionInputHash(source.rawText || source.transcript || "")) !==
        args.inputHash
    )
      return true;
    const readings = await currentExtractions(ctx.db, sourceId).take(2);
    const obsolete = readings[1];
    if (!obsolete) return true;
    if (await retireClaimsBatch(ctx, obsolete._id))
      await ctx.db.patch(obsolete._id, { historical: true });
    return false;
  },
});

export async function prepareRetirement(
  ctx: Pick<ActionCtx, "runMutation">,
  args: {
    attemptId?: Id<"extractionAttempts">;
    sourceId?: Id<"sources">;
    inputHash?: string;
  },
): Promise<void> {
  for (let batch = 0; batch < 512; batch++)
    if (
      await ctx.runMutation(
        internal.extractInternal.prepareRetirementBatch,
        args,
      )
    )
      return;
  throw new Error(
    "Legacy retirement needs another completion pass; retained output is preserved",
  );
}

export const completeExtraction = internalAction({
  args: { attemptId: v.id("extractionAttempts") },
  returns: completionValidator,
  handler: async (ctx, args): Promise<Infer<typeof completionValidator>> => {
    await prepareRetirement(ctx, args);
    return ctx.runMutation(internal.extractInternal.commitExtraction, args);
  },
});

export const commitExtraction = internalMutation({
  args: { attemptId: v.id("extractionAttempts") },
  returns: completionValidator,
  handler: async (
    ctx,
    { attemptId },
  ): Promise<Infer<typeof completionValidator>> => {
    const attempt = await ctx.db.get(attemptId);
    if (!attempt?.result) throw new Error("Extraction has no retained result");
    const result = attempt.result;
    const outcome = (
      extractionId: Id<"extractions">,
      current: boolean,
      stored?: Doc<"extractions"> | null,
    ) => ({
      extractionId,
      current,
      model: stored?.model ?? attempt.model,
      summary: stored?.summary ?? result.summary,
      claimCount: (stored?.claims ?? result.claims).length,
      parameterCount: (
        stored?.compositionParameters ?? result.compositionParameters
      ).length,
    });
    if (attempt.extractionId) {
      const stored = await ctx.db.get(attempt.extractionId);
      if (stored) await resolveOperationFailure(ctx, `extraction:${attemptId}`);
      return outcome(
        attempt.extractionId,
        attempt.current === true && !!stored && stored.historical !== true,
        stored,
      );
    }
    const source = await ctx.db.get(attempt.sourceId);
    if (!source)
      throw new Error("Source was deleted; retained extraction needs review");
    const content = source.rawText || source.transcript || "";
    let current =
      source.activeExtractionAttemptId === attemptId &&
      (source.status === "extracting" ||
        source.status === "text_ready" ||
        (source.status === "review_needed" &&
          source.blockedReason === "ai_error")) &&
      source.title === attempt.title &&
      source.canonicalUrl === attempt.canonicalUrl &&
      (await extractionInputHash(content, attempt.promptVersion)) ===
        attempt.inputHash;
    let extractionId: Id<"extractions">;
    const found =
      current && !attempt.force
        ? await extractionForInput(ctx.db, attempt.inputHash, attempt.sourceId)
        : null;
    if (found) {
      extractionId = found.extraction._id;
      current = found.sameSource;
      await settleFoundExtraction(ctx, source, found);
    } else {
      ({ extractionId } = await insertExtraction(ctx, {
        ...result,
        sourceId: attempt.sourceId,
        model: attempt.model,
        promptVersion: attempt.promptVersion,
        inputHash: attempt.inputHash,
        confidence: 0.8,
        snapshotId: attemptId,
        historical: !current,
      }));
      if (current) await setSourceStatus(ctx, source, "extracted");
    }
    if (current)
      await ctx.runMutation(internal.graph.linkExtractionConceptsAtomic, {
        extractionId,
      });
    else if (
      !found &&
      source.activeExtractionAttemptId === attemptId &&
      (source.status === "extracting" ||
        (source.status === "review_needed" &&
          source.blockedReason === "ai_error"))
    ) {
      // Metadata may change without a replacement admission. Release only
      // this completed owner; archives and newer owners retain their disposition.
      await ctx.db.patch(source._id, { activeExtractionAttemptId: undefined });
      await setSourceStatus(ctx, source, "text_ready");
    }
    await ctx.db.patch(attemptId, {
      extractionId,
      current,
      status: "completed",
      updatedAt: Date.now(),
    });
    await resolveOperationFailure(ctx, `extraction:${attemptId}`);
    return outcome(extractionId, current, found?.extraction);
  },
});

export const failExtraction = internalMutation({
  args: {
    attemptId: v.id("extractionAttempts"),
    error: v.string(),
    generationLease: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { attemptId, error, generationLease }) => {
    const attempt = await ctx.db.get(attemptId);
    if (
      !attempt ||
      attempt.status === "completed" ||
      (attempt.generationLease && attempt.generationLease !== generationLease)
    )
      return null;
    await ctx.db.patch(attemptId, {
      status: attempt.result ? "generated" : "failed",
      generationLease: undefined,
      generationLeaseUntil: undefined,
      error: truncateText(error, 1000),
      updatedAt: Date.now(),
    });
    await recordOperationFailure(ctx, {
      operationId: `extraction:${attemptId}`,
      causeKey: `extraction:${attempt.model}:${failureCause(error)}`,
      target: { kind: "extraction", attemptId },
      message: error,
    });
    const source = await ctx.db.get(attempt.sourceId);
    if (
      source?.activeExtractionAttemptId === attemptId &&
      (source.status === "extracting" ||
        (source.status === "review_needed" &&
          source.blockedReason === "ai_error"))
    ) {
      const matches =
        source.title === attempt.title &&
        source.canonicalUrl === attempt.canonicalUrl &&
        (await extractionInputHash(
          source.rawText || source.transcript || "",
          attempt.promptVersion,
        )) === attempt.inputHash;
      if (matches) {
        await setSourceStatus(ctx, source, "review_needed", {
          reason: "ai_error",
          details: "Extraction failed; recovery pending",
        });
      } else {
        await ctx.db.patch(source._id, {
          activeExtractionAttemptId: undefined,
        });
        await setSourceStatus(ctx, source, "text_ready");
      }
    }
    return null;
  },
});

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
      await setSourceStatus(ctx, checked.source, "review_needed", {
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
    if (found) {
      await settleFoundExtraction(ctx, checked.source, found);
      return {
        skipped: true as const,
        reason: found.sameSource ? "already extracted" : "duplicate extraction",
      };
    }
    await insertExtraction(ctx, {
      ...args,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      confidence: 0.8,
    });
    await settleExtractionOwnership(ctx, checked.source);
    await setSourceStatus(ctx, checked.source, "extracted");
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
    await setSourceStatus(ctx, checked.source, "review_needed", {
      reason: "no_text",
      details: reason,
    });
    return { parked: true, reason };
  },
});

export const getAttempt = internalQuery({
  args: { attemptId: v.id("extractionAttempts") },
  handler: (ctx, args) => ctx.db.get(args.attemptId),
});

/** A duplicate action may reuse a result but must not start a second model call. */
export const claimGeneration = internalMutation({
  args: { attemptId: v.id("extractionAttempts"), lease: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { attemptId, lease }) => {
    const attempt = await ctx.db.get(attemptId);
    if (
      !attempt ||
      attempt.result ||
      (attempt.generationLeaseUntil ?? 0) > Date.now()
    )
      return false;
    if (attempt.origin === "operator")
      throw new Error("Operator snapshot awaits an external result");
    const source = await ctx.db.get(attempt.sourceId);
    if (!source || source.status === "archived")
      throw new Error(
        "Archived or missing Source cannot start a new generation",
      );
    if (
      source.activeExtractionAttemptId !== attemptId ||
      source.title !== attempt.title ||
      source.canonicalUrl !== attempt.canonicalUrl ||
      !(
        source.status === "extracting" ||
        source.status === "text_ready" ||
        (source.status === "review_needed" &&
          source.blockedReason === "ai_error")
      ) ||
      (await extractionInputHash(
        source.rawText || source.transcript || "",
        attempt.promptVersion,
      )) !== attempt.inputHash
    )
      throw new Error("Only retained output can complete this snapshot");
    await ctx.db.patch(attemptId, {
      status: "pending",
      updatedAt: Date.now(),
      generationLease: lease,
      generationLeaseUntil: Date.now() + 15 * 60_000,
    });
    return true;
  },
});

/** Recover generation/commit interruptions even when the calling workflow disappeared. */
export const reconcileAttempts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    // Three queues share one transaction. Each row also loads its full Source
    // and worker failure handling rereads the snapshot. Leave room for those
    // reads even when documents approach Convex's 1 MiB document limit.
    let changed = false;
    for (const status of ["pending", "generated"] as const) {
      const rows =
        status === "pending"
          ? (
              await Promise.all(
                (["worker", "operator"] as const).map((origin) =>
                  ctx.db
                    .query("extractionAttempts")
                    .withIndex("by_origin_status_updated", (q) =>
                      q
                        .eq("origin", origin)
                        .eq("status", "pending")
                        .lte(
                          "updatedAt",
                          Date.now() -
                            (origin === "operator"
                              ? 24 * 60 * 60_000
                              : 15 * 60_000),
                        ),
                    )
                    .take(1),
                ),
              )
            ).flat()
          : await ctx.db
              .query("extractionAttempts")
              .withIndex("by_status_updated", (q) =>
                q
                  .eq("status", "generated")
                  .lte("updatedAt", Date.now() - 15 * 60_000),
              )
              .take(1);
      for (const row of rows) {
        if ((row.generationLeaseUntil ?? 0) > Date.now()) continue;
        if (row.origin === "operator" && row.status === "pending") {
          // External generation has no worker lease. Give it a full day, then
          // release admission while retaining the immutable snapshot for late imports.
          if (row.updatedAt > Date.now() - 24 * 60 * 60_000) continue;
          await ctx.db.patch(row._id, {
            status: "failed",
            error: "Operator snapshot expired without an imported result",
            updatedAt: Date.now(),
          });
          changed = true;
          const source = await ctx.db.get(row.sourceId);
          if (source?.activeExtractionAttemptId === row._id) {
            await ctx.db.patch(source._id, {
              activeExtractionAttemptId: undefined,
            });
            if (source.status === "extracting")
              await setSourceStatus(ctx, source, "text_ready");
          }
          continue;
        }
        await ctx.runMutation(internal.extractInternal.failExtraction, {
          attemptId: row._id,
          generationLease: row.generationLease,
          error: "Extraction interrupted before completion",
        });
        changed = true;
      }
    }
    if (changed)
      await ctx.scheduler.runAfter(
        0,
        internal.extractInternal.reconcileAttempts,
        {},
      );
    return null;
  },
});
