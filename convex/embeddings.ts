"use node";
/* eslint-disable no-underscore-dangle -- Convex vector results use `_id` and `_score`. */

import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import { requireAuth } from "./auth";
import {
  chunkArray,
  conceptEmbeddingText,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  needsEmbedding,
} from "./shared/embeddingText";

export { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL };
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const MAX_BATCH_SIZE = 100;
const RETRY_DELAYS_MS = [250, 500] as const;
const MAX_RETRY_AFTER_MS = 10_000;

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

export function parseEmbeddingResponse(value: unknown, expectedCount: number) {
  if (!value || typeof value !== "object" || !("data" in value)) return null;
  const data = (value as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length !== expectedCount) return null;
  // Place each item at its declared index; every item must carry a unique
  // integer index in [0, expectedCount) or the whole response is rejected —
  // a silently defaulted index could pair an embedding with the wrong text.
  const embeddings: (number[] | null)[] = Array.from(
    { length: expectedCount },
    () => null,
  );
  for (const item of data) {
    if (!item || typeof item !== "object" || !("embedding" in item)) {
      return null;
    }
    const index = "index" in item ? item.index : undefined;
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= expectedCount ||
      embeddings[index] !== null
    ) {
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
    embeddings[index] = numbers;
  }
  return embeddings.every(
    (embedding): embedding is number[] => embedding !== null,
  )
    ? embeddings
    : null;
}

class EmbeddingRequestError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return undefined;
  return Math.min(Math.max(retryAt - Date.now(), 0), MAX_RETRY_AFTER_MS);
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
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new EmbeddingRequestError(
          `OpenAI embeddings request failed (${response.status})`,
          response.status === 429
            ? parseRetryAfter(response.headers.get("Retry-After"))
            : undefined,
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
      const defaultDelay = RETRY_DELAYS_MS[attempt];
      if (defaultDelay !== undefined) {
        const retryAfterDelay =
          error instanceof EmbeddingRequestError
            ? error.retryAfterMs
            : undefined;
        await wait(retryAfterDelay ?? defaultDelay);
      }
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

type EmbeddingActionResult = Infer<typeof embeddingActionResultValidator>;

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

type ProbeClaim = {
  claimId: Id<"claims">;
  text: string;
  embedding?: number[];
  embeddingModel?: string;
};

type ProbeMatch = {
  claimId: Id<"claims">;
  score: number;
  text: string;
  sourceTitle: string;
  domains: string[];
};

type ProbeResult = {
  queryText: string;
  reusedStoredEmbedding: boolean;
  results: ProbeMatch[];
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
const getSweepCandidatesRef = makeFunctionReference<
  "query",
  { limit: number; model: string },
  { claimIds: Id<"claims">[]; conceptIds: Id<"concepts">[] }
>("embeddingsStore:getSweepCandidates");
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
const getProbeClaimRef = makeFunctionReference<
  "query",
  { claimId: Id<"claims"> },
  ProbeClaim | null
>("embeddingsStore:getProbeClaim");
const hydrateProbeMatchesRef = makeFunctionReference<
  "query",
  { matches: Array<{ claimId: Id<"claims">; score: number }> },
  ProbeMatch[]
>("embeddingsStore:hydrateProbeMatches");

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

type EmbedRowsOptions<Row, StoreEntry> = {
  fetchRows: () => Promise<Row[]>;
  toText: (row: Row) => string;
  toStoreEntry: (row: Row, embedding: number[], model: string) => StoreEntry;
  store: (entries: StoreEntry[]) => Promise<number>;
  label: string;
};

async function embedRows<
  Row extends { embedding?: unknown[]; embeddingModel?: string },
  StoreEntry,
>(
  requestedIds: readonly unknown[],
  options: EmbedRowsOptions<Row, StoreEntry>,
): Promise<EmbeddingActionResult> {
  try {
    const rows = await options.fetchRows();
    const pending = rows.filter((row) => needsEmbedding(row, EMBEDDING_MODEL));
    let embedded = 0;
    for (const batch of chunkArray(pending, MAX_BATCH_SIZE)) {
      const result = await fetchEmbeddingBatch({
        texts: batch.map(options.toText),
      });
      if (!result) continue;
      embedded += await options.store(
        batch.map((row, index) =>
          options.toStoreEntry(row, result.embeddings[index]!, result.model),
        ),
      );
    }
    return {
      requested: requestedIds.length,
      embedded,
      skipped: requestedIds.length - embedded,
    };
  } catch (error) {
    console.warn(
      `${options.label} embedding failed; skipping`,
      error instanceof Error ? error.message : String(error),
    );
    return {
      requested: requestedIds.length,
      embedded: 0,
      skipped: requestedIds.length,
    };
  }
}

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
  handler: async (ctx, args) =>
    await embedRows(args.claimIds, {
      fetchRows: async () =>
        await ctx.runQuery(getClaimsRef, {
          claimIds: args.claimIds,
        }),
      toText: (claim) => claim.text,
      toStoreEntry: (claim, embedding, model) => ({
        claimId: claim.claimId,
        embedding,
        model,
      }),
      store: async (entries) =>
        await ctx.runMutation(storeClaimEmbeddingsRef, { entries }),
      label: "Claim",
    }),
});

export const embedConcepts = internalAction({
  args: { conceptIds: v.array(v.id("concepts")) },
  returns: embeddingActionResultValidator,
  handler: async (ctx, args) =>
    await embedRows(args.conceptIds, {
      fetchRows: async () =>
        await ctx.runQuery(getConceptsRef, {
          conceptIds: args.conceptIds,
        }),
      toText: conceptEmbeddingText,
      toStoreEntry: (concept, embedding, model) => ({
        conceptId: concept.conceptId,
        embedding,
        model,
      }),
      store: async (entries) =>
        await ctx.runMutation(storeConceptEmbeddingsRef, { entries }),
      label: "Concept",
    }),
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
    const candidates = await ctx.runQuery(getSweepCandidatesRef, {
      limit: 500,
      model: EMBEDDING_MODEL,
    });
    if (candidates.claimIds.length > 0) {
      await ctx.scheduler.runAfter(0, embedClaimsRef, {
        claimIds: candidates.claimIds,
      });
    }
    if (candidates.conceptIds.length > 0) {
      await ctx.scheduler.runAfter(0, embedConceptsRef, {
        conceptIds: candidates.conceptIds,
      });
    }
    return {
      claimsScheduled: candidates.claimIds.length,
      conceptsScheduled: candidates.conceptIds.length,
    };
  },
});

export const probe = action({
  args: {
    claimId: v.optional(v.id("claims")),
    text: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    queryText: v.string(),
    reusedStoredEmbedding: v.boolean(),
    results: v.array(
      v.object({
        claimId: v.id("claims"),
        score: v.float64(),
        text: v.string(),
        sourceTitle: v.string(),
        domains: v.array(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args): Promise<ProbeResult> => {
    await requireAuth(ctx, args);
    const suppliedText = args.text?.trim();
    if ((args.claimId ? 1 : 0) + (suppliedText ? 1 : 0) !== 1) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Provide exactly one claimId or non-empty text",
      });
    }

    let queryText = suppliedText ?? "";
    let vector: number[] | undefined;
    let reusedStoredEmbedding = false;
    if (args.claimId) {
      const claim = await ctx.runQuery(getProbeClaimRef, {
        claimId: args.claimId,
      });
      if (!claim) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: `Claim ${args.claimId} was not found`,
        });
      }
      queryText = claim.text;
      if (
        claim.embeddingModel === EMBEDDING_MODEL &&
        claim.embedding?.length === EMBEDDING_DIMENSIONS
      ) {
        vector = claim.embedding;
        reusedStoredEmbedding = true;
      }
    }
    if (!vector) {
      const embedded = await fetchEmbeddingBatch({ texts: [queryText] });
      vector = embedded?.embeddings[0];
    }
    if (!vector) return { queryText, reusedStoredEmbedding, results: [] };

    const matches = await ctx.vectorSearch("claims", "by_embedding", {
      vector,
      limit: 10,
      filter: (q) => q.eq("status", "active"),
    });
    const results = await ctx.runQuery(hydrateProbeMatchesRef, {
      matches: matches.map((match) => ({
        claimId: match._id,
        score: match._score,
      })),
    });
    return { queryText, reusedStoredEmbedding, results };
  },
});
