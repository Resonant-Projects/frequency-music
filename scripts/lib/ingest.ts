/**
 * Deep source-ingestion module. Hides dedupe checks, text fetch and cap,
 * source creation, refetch-by-status flow, rate limiting, and auth bypass.
 */
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { SourceStatus } from "../../convex/shared/statuses";
import { getConvexClient, getDevBypassSecret } from "./convexClient";
import { type FetchResult, TEXT_CAP, capText, fetchViaJina } from "./fetchText";

export type SourceType =
  | "notion"
  | "rss"
  | "url"
  | "youtube"
  | "pdf"
  | "podcast";

export interface SourceManifestItem {
  type: SourceType;
  title: string;
  dedupeKey: string;
  url?: string;
  canonicalUrl?: string;
  author?: string;
  publishedAt?: number;
  rawText?: string;
  transcript?: string;
  notionPageId?: string;
  youtubeVideoId?: string;
  rssGuid?: string;
  feedUrl?: string;
  tags?: string[];
  topics?: string[];
  metadata?: Record<string, unknown>;
  fetchText?: boolean;
}

export interface IngestSummary {
  created: number;
  skipped: number;
  failed: number;
}

export interface RefetchSummary {
  updated: number;
  skipped: number;
  failed: number;
}

export interface RefetchOptions {
  limit?: number;
  minLength?: number;
  types?: SourceType[];
  reExtract?: boolean;
}

export type MinimalClient = Pick<ConvexHttpClient, "query" | "mutation">;

interface SourceRow {
  _id: string;
  type: string;
  status: string;
  canonicalUrl?: string;
  rawText?: string;
  title?: string;
}

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createSourceIngestor(
  opts: {
    client?: MinimalClient;
    rateMs?: number;
    fetchText?: (url: string) => Promise<FetchResult>;
    log?: (line: string) => void;
  } = {},
) {
  const client = opts.client ?? getConvexClient();
  const rateMs = opts.rateMs ?? 1000;
  const fetchText = opts.fetchText ?? fetchViaJina;
  const log = opts.log ?? console.log;
  const devBypassSecret = getDevBypassSecret();

  async function alreadyIngested(dedupeKey: string): Promise<boolean> {
    const existing = await client.query(api.sources.getByDedupeKey, {
      dedupeKey,
    });
    return existing !== null;
  }

  async function ingest(items: SourceManifestItem[]): Promise<IngestSummary> {
    const summary: IngestSummary = { created: 0, skipped: 0, failed: 0 };
    for (const item of items) {
      try {
        if (await alreadyIngested(item.dedupeKey)) {
          log(`  ⏭ exists: ${item.title}`);
          summary.skipped++;
          continue;
        }

        let text = item.rawText;
        const shouldFetch =
          item.fetchText !== false && item.url && text === undefined;
        if (shouldFetch && item.url) {
          const result = await fetchText(item.url);
          if (result.ok) text = result.text;
          else log(`  ⚠ fetch failed (${result.error}): ${item.title}`);
        }

        const result = await client.mutation(api.sources.create, {
          type: item.type,
          title: item.title,
          author: item.author,
          publishedAt: item.publishedAt,
          canonicalUrl: item.canonicalUrl ?? item.url,
          notionPageId: item.notionPageId,
          rssGuid: item.rssGuid,
          feedUrl: item.feedUrl,
          youtubeVideoId: item.youtubeVideoId,
          rawText: text !== undefined ? capText(text) : undefined,
          transcript: item.transcript,
          tags: item.tags,
          topics: item.topics,
          metadata: item.metadata,
          dedupeKey: item.dedupeKey,
          devBypassSecret,
        });

        if (result.created) {
          log(`  ✓ created: ${item.title}`);
          summary.created++;
        } else {
          log(`  ⏭ duplicate: ${item.title}`);
          summary.skipped++;
        }
        if (rateMs > 0) await sleep(rateMs);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        log(`  ✗ failed: ${item.title} — ${message}`);
        summary.failed++;
      }
    }
    return summary;
  }

  async function refetchByStatus(
    statuses: SourceStatus[],
    refetchOpts: RefetchOptions = {},
  ): Promise<RefetchSummary> {
    const {
      limit = 20,
      minLength = 1000,
      types,
      reExtract = false,
    } = refetchOpts;
    const summary: RefetchSummary = { updated: 0, skipped: 0, failed: 0 };

    const all: SourceRow[] = [];
    for (const status of statuses) {
      const batch = (await client.query(api.sources.listByStatus, {
        status,
        limit: limit * 2,
      })) as SourceRow[];
      all.push(...batch);
    }

    const candidates = all
      .filter((source) => {
        const textLength = (source.rawText ?? "").length;
        const hasUrl = source.canonicalUrl?.startsWith("http") ?? false;
        const typeMatches =
          types === undefined || types.includes(source.type as SourceType);
        return typeMatches && hasUrl && textLength < minLength;
      })
      .slice(0, limit);

    const toReExtract: string[] = [];
    for (const source of candidates) {
      const currentLength = (source.rawText ?? "").length;
      log(`📄 ${source.title?.slice(0, 60)} (${currentLength} chars)`);
      try {
        const result = await fetchText(source.canonicalUrl as string);
        if (!result.ok || result.text.length <= currentLength) {
          log(`  ⏭ no better text${result.ok ? "" : ` (${result.error})`}`);
          summary.skipped++;
        } else {
          await client.mutation(api.sources.updateText, {
            id: source._id as Id<"sources">,
            rawText: result.text.slice(0, TEXT_CAP),
            devBypassSecret,
          });
          log(`  ✓ updated: ${result.text.length} chars`);
          summary.updated++;
          if (reExtract && source.status === "extracted") {
            toReExtract.push(source._id);
          }
        }
        if (rateMs > 0) await sleep(rateMs);
      } catch (error: unknown) {
        log(`  ✗ ${error instanceof Error ? error.message : String(error)}`);
        summary.failed++;
      }
    }

    for (const id of toReExtract) {
      await client.mutation(api.sources.updateStatus, {
        id: id as Id<"sources">,
        status: "text_ready",
        devBypassSecret,
      });
    }
    if (toReExtract.length > 0) {
      log(`Reset ${toReExtract.length} sources to text_ready`);
    }

    return summary;
  }

  return { alreadyIngested, ingest, refetchByStatus };
}
