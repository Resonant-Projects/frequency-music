"use node";

import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import { requireAuth } from "./auth";
import { chunkArray, conceptEmbeddingText } from "./shared/embeddingText";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const MAX_BATCH_SIZE = 100;
const RETRY_DELAYS_MS = [250, 500] as const;

type EmbeddingResult = {
  embeddings: number[][];
  model: string;
};

type FetchEmbeddingOptions = {
  texts: string[];
  apiKey?: string;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  warn?: (...args: unknown[]) => void;
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function parseEmbeddingResponse(value: unknown, expectedCount: number) {
  if (!value || typeof value !== "object" || !("data" in value)) return null;
  const data = (value as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length !== expectedCount) return null;
  const ordered = data.toSorted((left, right) => {
    const leftIndex =
      typeof left === "object" && left && "index" in left
        ? Number(left.index)
        : 0;
    const rightIndex =
      typeof right === "object" && right && "index" in right
        ? Number(right.index)
        : 0;
    return leftIndex - rightIndex;
  });
  const embeddings = ordered.map((item) => {
    if (!item || typeof item !== "object" || !("embedding" in item)) {
      return null;
    }
    const embedding = item.embedding;
    if (
      !Array.isArray(embedding) ||
      embedding.length !== EMBEDDING_DIMENSIONS
    ) {
      return null;
    }
    const numbers: number[] = [];
    for (const value of embedding) {
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      numbers.push(value);
    }
    return numbers;
  });
  return embeddings.every(
    (embedding): embedding is number[] => embedding !== null,
  )
    ? embeddings
    : null;
}

export async function fetchEmbeddingBatch(
  options: FetchEmbeddingOptions,
): Promise<EmbeddingResult | null> {
  const warn = options.warn ?? console.warn;
  if (options.texts.length === 0) {
    return { embeddings: [], model: EMBEDDING_MODEL };
  }
  if (options.texts.length > MAX_BATCH_SIZE) {
    warn(`Embedding batch skipped: maximum size is ${MAX_BATCH_SIZE}`);
    return null;
  }
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    warn("Embedding batch skipped: OPENAI_API_KEY is not configured");
    return null;
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const wait = options.sleep ?? sleep;
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetchImpl(OPENAI_EMBEDDINGS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: options.texts,
          dimensions: EMBEDDING_DIMENSIONS,
          encoding_format: "float",
        }),
      });
      if (!response.ok) {
        throw new Error(
          `OpenAI embeddings request failed (${response.status})`,
        );
      }
      const embeddings = parseEmbeddingResponse(
        await response.json(),
        options.texts.length,
      );
      if (!embeddings) {
        throw new Error("OpenAI embeddings response had an invalid shape");
      }
      return { embeddings, model: EMBEDDING_MODEL };
    } catch (error) {
      lastError = error;
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) await wait(delay);
    }
  }
  warn(
    "Embedding batch failed after retries; skipping",
    lastError instanceof Error ? lastError.message : String(lastError),
  );
  return null;
}

const embeddingActionResultValidator = v.object({
  requested: v.number(),
  embedded: v.number(),
  skipped: v.number(),
});

type EmbeddingActionResult = {
  requested: number;
  embedded: number;
  skipped: number;
};

type ClaimEmbeddingRow = {
  claimId: Id<"claims">;
  text: string;
  embedding?: number[];
  embeddingModel?: string;
};

type ConceptEmbeddingRow = {
  conceptId: Id<"concepts">;
  displayName: string;
  description?: string;
  aliases: string[];
  embedding?: number[];
  embeddingModel?: string;
};

type BackfillPage = {
  claimIds: Id<"claims">[];
  conceptIds: Id<"concepts">[];
  scanned: number;
  pendingChars: number;
  isDone: boolean;
  continueCursor: string;
};

type BackfillBatchResult = {
  kind: "claims" | "concepts";
  scanned: number;
  pending: number;
  pendingChars: number;
  embedded: number;
  remaining: number;
  isDone: boolean;
  continueCursor: string;
};

const getClaimsRef = makeFunctionReference<
  "query",
  { claimIds: Id<"claims">[] },
  ClaimEmbeddingRow[]
>("embeddingsStore:getClaims");
const getConceptsRef = makeFunctionReference<
  "query",
  { conceptIds: Id<"concepts">[] },
  ConceptEmbeddingRow[]
>("embeddingsStore:getConcepts");
const getBackfillPageRef = makeFunctionReference<
  "query",
  {
    kind: "claims" | "concepts";
    cursor: string | null;
    batchSize: number;
    model: string;
  },
  BackfillPage
>("embeddingsStore:getBackfillPage");
const storeClaimEmbeddingsRef = makeFunctionReference<
  "mutation",
  {
    entries: Array<{
      claimId: Id<"claims">;
      embedding: number[];
      model: string;
    }>;
  },
  number
>("embeddingsStore:storeClaimEmbeddings");
const storeConceptEmbeddingsRef = makeFunctionReference<
  "mutation",
  {
    entries: Array<{
      conceptId: Id<"concepts">;
      embedding: number[];
      model: string;
    }>;
  },
  number
>("embeddingsStore:storeConceptEmbeddings");

const embedClaimsRef = makeFunctionReference<
  "action",
  { claimIds: Id<"claims">[] },
  EmbeddingActionResult
>("embeddings:embedClaims");
const embedConceptsRef = makeFunctionReference<
  "action",
  { conceptIds: Id<"concepts">[] },
  EmbeddingActionResult
>("embeddings:embedConcepts");

export const embedTexts = internalAction({
  args: { texts: v.array(v.string()) },
  returns: v.object({
    embeddings: v.array(v.array(v.float64())),
    model: v.string(),
  }),
  handler: async (_ctx, args) => {
    const result = await fetchEmbeddingBatch({ texts: args.texts });
    return result ?? { embeddings: [], model: EMBEDDING_MODEL };
  },
});

export const embedClaims = internalAction({
  args: { claimIds: v.array(v.id("claims")) },
  returns: embeddingActionResultValidator,
  handler: async (ctx, args) => {
    try {
      const claims = await ctx.runQuery(getClaimsRef, {
        claimIds: args.claimIds,
      });
      const pending = claims.filter(
        (claim) => !claim.embedding || claim.embeddingModel !== EMBEDDING_MODEL,
      );
      let embedded = 0;
      for (const batch of chunkArray(pending, MAX_BATCH_SIZE)) {
        const result = await fetchEmbeddingBatch({
          texts: batch.map((claim) => claim.text),
        });
        if (!result) continue;
        embedded += await ctx.runMutation(storeClaimEmbeddingsRef, {
          entries: batch.map((claim, index) => ({
            claimId: claim.claimId,
            embedding: result.embeddings[index]!,
            model: result.model,
          })),
        });
      }
      return {
        requested: args.claimIds.length,
        embedded,
        skipped: args.claimIds.length - embedded,
      };
    } catch (error) {
      console.warn(
        "Claim embedding failed; skipping",
        error instanceof Error ? error.message : String(error),
      );
      return {
        requested: args.claimIds.length,
        embedded: 0,
        skipped: args.claimIds.length,
      };
    }
  },
});

export const embedConcepts = internalAction({
  args: { conceptIds: v.array(v.id("concepts")) },
  returns: embeddingActionResultValidator,
  handler: async (ctx, args) => {
    try {
      const concepts = await ctx.runQuery(getConceptsRef, {
        conceptIds: args.conceptIds,
      });
      const pending = concepts.filter(
        (concept) =>
          !concept.embedding || concept.embeddingModel !== EMBEDDING_MODEL,
      );
      let embedded = 0;
      for (const batch of chunkArray(pending, MAX_BATCH_SIZE)) {
        const result = await fetchEmbeddingBatch({
          texts: batch.map(conceptEmbeddingText),
        });
        if (!result) continue;
        embedded += await ctx.runMutation(storeConceptEmbeddingsRef, {
          entries: batch.map((concept, index) => ({
            conceptId: concept.conceptId,
            embedding: result.embeddings[index]!,
            model: result.model,
          })),
        });
      }
      return {
        requested: args.conceptIds.length,
        embedded,
        skipped: args.conceptIds.length - embedded,
      };
    } catch (error) {
      console.warn(
        "Concept embedding failed; skipping",
        error instanceof Error ? error.message : String(error),
      );
      return {
        requested: args.conceptIds.length,
        embedded: 0,
        skipped: args.conceptIds.length,
      };
    }
  },
});

export const backfillBatch = action({
  args: {
    kind: v.union(v.literal("claims"), v.literal("concepts")),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.number(),
    apply: v.boolean(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    kind: v.union(v.literal("claims"), v.literal("concepts")),
    scanned: v.number(),
    pending: v.number(),
    pendingChars: v.number(),
    embedded: v.number(),
    remaining: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args): Promise<BackfillBatchResult> => {
    await requireAuth(ctx, args);
    const page = await ctx.runQuery(getBackfillPageRef, {
      kind: args.kind,
      cursor: args.cursor,
      batchSize: args.batchSize,
      model: EMBEDDING_MODEL,
    });
    const pending =
      args.kind === "claims" ? page.claimIds.length : page.conceptIds.length;
    let embedded = 0;
    if (args.apply && pending > 0) {
      const result =
        args.kind === "claims"
          ? await ctx.runAction(embedClaimsRef, { claimIds: page.claimIds })
          : await ctx.runAction(embedConceptsRef, {
              conceptIds: page.conceptIds,
            });
      embedded = result.embedded;
    }
    return {
      kind: args.kind,
      scanned: page.scanned,
      pending,
      pendingChars: page.pendingChars,
      embedded,
      remaining: pending - embedded,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const sweepMissingEmbeddings = internalAction({
  args: {},
  returns: v.object({
    claimsScheduled: v.number(),
    conceptsScheduled: v.number(),
  }),
  handler: async (ctx) => {
    const [claimPage, conceptPage] = await Promise.all([
      ctx.runQuery(getBackfillPageRef, {
        kind: "claims",
        cursor: null,
        batchSize: 500,
        model: EMBEDDING_MODEL,
      }),
      ctx.runQuery(getBackfillPageRef, {
        kind: "concepts",
        cursor: null,
        batchSize: 500,
        model: EMBEDDING_MODEL,
      }),
    ]);
    if (claimPage.claimIds.length > 0) {
      await ctx.scheduler.runAfter(0, embedClaimsRef, {
        claimIds: claimPage.claimIds,
      });
    }
    if (conceptPage.conceptIds.length > 0) {
      await ctx.scheduler.runAfter(0, embedConceptsRef, {
        conceptIds: conceptPage.conceptIds,
      });
    }
    return {
      claimsScheduled: claimPage.claimIds.length,
      conceptsScheduled: conceptPage.conceptIds.length,
    };
  },
});
