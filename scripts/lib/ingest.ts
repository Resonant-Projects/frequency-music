/**
 * Deep source-ingestion module. Hides dedupe checks, text fetch and cap,
 * source creation, refetch-by-status flow, rate limiting, and auth bypass.
 */
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { SourceStatus } from "../../convex/shared/statuses";
import {
  computeCanonicalDedupeKey,
  generateDedupeKey,
} from "../../convex/sourceUtils";
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
  fileSha256?: string;
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
  _id: Id<"sources">;
  type: SourceType;
  status: SourceStatus;
  canonicalUrl?: string;
  rawText?: string;
  title?: string;
}

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function manifestDedupeKey(item: SourceManifestItem): string {
  if (item.type === "pdf") {
    if (!item.fileSha256) {
      throw new Error(`PDF manifest item requires fileSha256: ${item.title}`);
    }
    return generateDedupeKey("pdf", { fileSha256: item.fileSha256 });
  }

  const dedupeKey = computeCanonicalDedupeKey({
    type: item.type,
    notionPageId: item.notionPageId,
    feedUrl: item.feedUrl,
    rssGuid: item.rssGuid,
    canonicalUrl: item.canonicalUrl ?? item.url,
    youtubeVideoId: item.youtubeVideoId,
  });
  if (!dedupeKey) {
    throw new Error(`Cannot compute canonical dedupe key: ${item.title}`);
  }
  return dedupeKey;
}

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
        const dedupeKey = manifestDedupeKey(item);
        if (await alreadyIngested(dedupeKey)) {
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
          dedupeKey,
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
      const batch: SourceRow[] = await client.query(api.sources.listByStatus, {
        status,
        limit: limit * 2,
      });
      all.push(...batch);
    }

    const candidates = all
      .filter((source): source is SourceRow & { canonicalUrl: string } => {
        const textLength = (source.rawText ?? "").length;
        const hasUrl = source.canonicalUrl?.startsWith("http") ?? false;
        const typeMatches = types === undefined || types.includes(source.type);
        return typeMatches && hasUrl && textLength < minLength;
      })
      .slice(0, limit);

    const toReExtract: Id<"sources">[] = [];
    for (const source of candidates) {
      const currentLength = (source.rawText ?? "").length;
      log(`📄 ${source.title?.slice(0, 60)} (${currentLength} chars)`);
      try {
        const result = await fetchText(source.canonicalUrl);
        if (!result.ok || result.text.length <= currentLength) {
          log(`  ⏭ no better text${result.ok ? "" : ` (${result.error})`}`);
          summary.skipped++;
        } else {
          await client.mutation(api.sources.updateText, {
            id: source._id,
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
        id,
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
