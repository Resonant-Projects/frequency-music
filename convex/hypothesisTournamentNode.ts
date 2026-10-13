"use node";
/* eslint-disable no-underscore-dangle -- Convex vector results use `_id` and `_score`. */
// Metered embeddings for the hypothesis tournament. Unlike embedTexts, each
// call is one provider attempt and reports provider usage, because the
// tournament budget sums real token usage and must never guess it.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { parseEmbeddingResponse } from "./embeddings";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./shared/embeddingText";
import type { z } from "zod";
import {
  meteredEmbeddingZ,
  meteredNeighborsZ,
  TOURNAMENT_DUPLICATE_THRESHOLD,
} from "./shared/hypothesisTournament";

type MeteredNeighbors = z.infer<typeof meteredNeighborsZ>;
type Neighbor = { id: string; statement: string; similarity: number };
type BackfillPage = {
  scanned: number;
  stored: number;
  totalTokens: number;
  cursor: string | null;
  done: boolean;
};

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const NEIGHBOR_RESULT_LIMIT = 10;
const VECTOR_SEARCH_LIMIT = 24;

export type MeteredEmbeddings =
  | { ok: true; embeddings: number[][]; totalTokens: number }
  | { ok: false; totalTokens: number };

/** One attempt, no retries. HTTP failures are unbilled and report zero usage;
 * a successful response without integer usage throws (usage unknown). */
export async function fetchMeteredEmbeddings(
  texts: string[],
  options: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<MeteredEmbeddings> {
  if (texts.length === 0) return { ok: true, embeddings: [], totalTokens: 0 };
  if (texts.length > 100) throw new Error("Embedding batch exceeds 100 texts");
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, totalTokens: 0 };
  const response = await (options.fetchImpl ?? fetch)(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
      encoding_format: "float",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return { ok: false, totalTokens: 0 };
  const body = (await response.json()) as {
    usage?: { total_tokens?: unknown };
  };
  const totalTokens = body.usage?.total_tokens;
  if (
    typeof totalTokens !== "number" ||
    !Number.isSafeInteger(totalTokens) ||
    totalTokens < 0
  )
    throw new Error("Embedding usage missing from provider response");
  const embeddings = parseEmbeddingResponse(body, texts.length);
  return embeddings
    ? { ok: true, embeddings, totalTokens }
    : { ok: false, totalTokens };
}

function cosine(a: number[], b: number[]) {
  if (a.length !== b.length) return -1;
  let dot = 0;
  let left = 0;
  let right = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    left += a[i]! * a[i]!;
    right += b[i]! * b[i]!;
  }
  return dot / Math.sqrt(left * right);
}

export const embedStatement = internalAction({
  args: { text: v.string() },
  handler: async (_ctx, args): Promise<z.infer<typeof meteredEmbeddingZ>> => {
    const text = args.text.trim();
    if (!text) return { ok: false as const, totalTokens: 0 };
    const result = await fetchMeteredEmbeddings([text]);
    return meteredEmbeddingZ.parse(
      result.ok
        ? {
            ok: true,
            value: result.embeddings[0],
            totalTokens: result.totalTokens,
          }
        : result,
    );
  },
});

/** Global nearest neighbors for one statement: current hypothesis vectors,
 * hypotheses re-embedded because their vector is missing or stale, pending
 * drafts embedded now, and the archive of other runs. */
export const findNeighbors = internalAction({
  args: {
    agentRunId: v.string(),
    statement: v.string(),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args): Promise<MeteredNeighbors> => {
    if (args.embedding.length !== EMBEDDING_DIMENSIONS)
      throw new Error("Neighbor query vector has wrong dimensions");
    const corpus: {
      stale: Array<{ id: string; statement: string }>;
      drafts: Array<{ id: string; statement: string }>;
    } = await ctx.runQuery(internal.hypothesisTournament.duplicateCorpus, {});
    const fresh = [
      ...corpus.stale.map((row) => ({ ...row, kind: "hypothesis" })),
      ...corpus.drafts.map((row) => ({ ...row, kind: "draft" })),
    ];
    const embedded = await fetchMeteredEmbeddings(
      fresh.map((row) => row.statement),
    );
    if (!embedded.ok)
      return meteredNeighborsZ.parse({
        ok: false,
        totalTokens: embedded.totalTokens,
      });
    const [hypothesisHits, candidateHits] = await Promise.all([
      ctx.vectorSearch("hypothesisEmbeddings", "by_embedding", {
        vector: args.embedding,
        limit: VECTOR_SEARCH_LIMIT,
      }),
      ctx.vectorSearch("hypothesisCandidates", "by_statementEmbedding", {
        vector: args.embedding,
        limit: VECTOR_SEARCH_LIMIT,
      }),
    ]);
    const hydrated: Neighbor[] = await ctx.runQuery(
      internal.hypothesisTournament.hydrateNeighborHits,
      {
        agentRunId: args.agentRunId,
        hypothesisHits: hypothesisHits.map((hit) => ({
          id: hit._id,
          score: hit._score,
        })),
        candidateHits: candidateHits.map((hit) => ({
          id: hit._id,
          score: hit._score,
        })),
      },
    );
    const neighbors: Neighbor[] = [
      ...hydrated,
      ...fresh.map((row, index) => ({
        id: `${row.kind}:${row.id}`,
        statement: row.statement,
        similarity: cosine(args.embedding, embedded.embeddings[index]!),
      })),
    ]
      .filter((n) => Number.isFinite(n.similarity))
      .sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id))
      // Keep a few below threshold so callers can see the margin.
      .filter((n, i) => i < 3 || n.similarity >= TOURNAMENT_DUPLICATE_THRESHOLD)
      .slice(0, NEIGHBOR_RESULT_LIMIT)
      .map((n) => ({ ...n, statement: n.statement.slice(0, 4_000) }));
    return meteredNeighborsZ.parse({
      ok: true,
      value: neighbors,
      totalTokens: embedded.totalTokens,
    });
  },
});

/** Resumable, idempotent backfill of hypothesis statement vectors. Spends
 * OpenAI embedding tokens; run only with coordinator approval. */
export const backfillHypothesisEmbeddings = internalAction({
  args: {
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<BackfillPage> => {
    const page: {
      rows: Array<{ id: string; statement: string; hash: string }>;
      scanned: number;
      cursor: string | null;
      done: boolean;
    } = await ctx.runQuery(
      internal.hypothesisTournament.hypothesesNeedingEmbeddings,
      { cursor: args.cursor, batchSize: args.batchSize ?? 50 },
    );
    const embedded = await fetchMeteredEmbeddings(
      page.rows.map((row) => row.statement),
    );
    if (!embedded.ok)
      throw new Error("Embedding request failed; retry this cursor");
    const { stored }: { stored: number } = await ctx.runMutation(
      internal.hypothesisTournament.storeHypothesisEmbeddings,
      {
        rows: page.rows.map((row, index) => ({
          hypothesisId: row.id,
          statementHash: row.hash,
          embedding: embedded.embeddings[index]!,
          model: EMBEDDING_MODEL,
        })),
      },
    );
    return {
      scanned: page.scanned,
      stored,
      totalTokens: embedded.totalTokens,
      cursor: page.cursor,
      done: page.done,
    };
  },
});
