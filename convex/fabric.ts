import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";
import { requireAuth } from "./auth";

// ============================================================================
// YOUTUBE TRANSCRIPT FETCHING
// Direct fetch from YouTube's transcript API
// ============================================================================

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

interface TactiqCaption {
  text: string;
  start: number;
  dur?: number;
}

interface TactiqResponse {
  captions?: TactiqCaption[];
}

interface SupadataTranscriptSegment {
  text: string;
  start?: number;
  duration?: number;
}

interface SupadataResponse {
  content?: string;
  transcript?: SupadataTranscriptSegment[];
}

/**
 * Fetch with a timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch transcript using Supadata API (reliable third-party service)
 */
async function fetchYouTubeTranscript(videoId: string): Promise<TranscriptSegment[]> {
  // Use Supadata's free YouTube transcript API
  const apiUrl = `https://api.supadata.ai/v1/youtube/transcript?video_id=${videoId}&text=true`;

  const response = await fetchWithTimeout(apiUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    // Fall back to trying tactiq's free API
    const tactiqUrl = `https://tactiq-apps-prod.tactiq.io/transcript?videoId=${videoId}&langCode=en`;
    const tactiqResponse = await fetchWithTimeout(tactiqUrl);

    if (!tactiqResponse.ok) {
      throw new Error(`Failed to fetch transcript: ${response.status}`);
    }

    const tactiqData = (await tactiqResponse.json()) as TactiqResponse;
    if (tactiqData.captions) {
      return tactiqData.captions.map((c) => ({
        text: c.text,
        start: c.start,
        duration: c.dur || 0,
      }));
    }
    throw new Error("No transcript available");
  }

  const data = (await response.json()) as SupadataResponse;

  if (data.content) {
    // Supadata returns plain text, convert to segments
    return [
      {
        text: data.content,
        start: 0,
        duration: 0,
      },
    ];
  }

  if (data.transcript) {
    return data.transcript.map((t) => ({
      text: t.text,
      start: t.start || 0,
      duration: t.duration || 0,
    }));
  }

  throw new Error("No transcript data in response");
}

/**
 * Extract YouTube video ID from URL (handles regular videos, shorts, and embeds)
 */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, // YouTube Shorts
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Fetch YouTube transcript
 */
export const getYouTubeTranscript = action({
  args: {
    url: v.string(),
    withTimestamps: v.optional(v.boolean()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    videoId: v.string(),
    transcript: v.string(),
    withTimestamps: v.boolean(),
    segments: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const videoId = extractVideoId(args.url);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    const segments = await fetchYouTubeTranscript(videoId);

    let transcript: string;
    if (args.withTimestamps) {
      transcript = segments.map((seg) => `[${formatTime(seg.start)}] ${seg.text}`).join("\n");
    } else {
      transcript = segments.map((seg) => seg.text).join(" ");
    }

    return {
      videoId,
      transcript,
      withTimestamps: args.withTimestamps ?? false,
      segments: segments.length,
    };
  },
});

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Fetch transcript and update a source record
 */
export const fetchTranscriptForSource = action({
  args: {
    sourceId: v.id("sources"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      videoId: v.string(),
      transcriptLength: v.number(),
      segments: v.number(),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    // Get the source
    const source = await ctx.runQuery(api.sources.get, { id: args.sourceId });
    if (!source) {
      throw new Error("Source not found");
    }

    if (source.type !== "youtube") {
      throw new Error("Source is not a YouTube video");
    }

    // Extract video ID
    const videoId = source.youtubeVideoId || extractVideoId(source.canonicalUrl || "");
    if (!videoId) {
      throw new Error("Could not extract video ID");
    }

    try {
      // Fetch transcript
      const segments = await fetchYouTubeTranscript(videoId);
      const transcript = segments.map((seg) => seg.text).join(" ");

      // Update source with transcript
      await ctx.runMutation(api.sources.updateText, {
        id: args.sourceId,
        transcript,
        devBypassSecret: args.devBypassSecret,
      });

      return {
        success: true as const,
        videoId,
        transcriptLength: transcript.length,
        segments: segments.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      // Update source with error
      await ctx.runMutation(api.sources.updateStatus, {
        id: args.sourceId,
        status: "review_needed",
        blockedReason: "no_text",
        blockedDetails: `Transcript fetch failed: ${message}`,
        devBypassSecret: args.devBypassSecret,
      });
      return { success: false as const, error: message };
    }
  },
});

/**
 * Fetch transcripts for all YouTube sources without transcripts
 */
export const fetchAllYouTubeTranscripts = action({
  args: {
    limit: v.optional(v.number()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    results: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        success: v.boolean(),
        error: v.optional(v.string()),
      }),
    ),
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const limit = args.limit ?? 10;

    // Get YouTube sources that are in "ingested" status (no transcript yet)
    const sources = await ctx.runQuery(api.sources.listByStatus, {
      status: "ingested",
      limit: limit * 2, // Get more since we filter
    });

    const youtubeSources = sources.filter((s) => s.type === "youtube").slice(0, limit);

    const results: Array<{
      id: string;
      title: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const source of youtubeSources) {
      try {
        const result = await ctx.runAction(api.fabric.fetchTranscriptForSource, {
          sourceId: source._id,
          devBypassSecret: args.devBypassSecret,
        });
        results.push({
          id: source._id,
          title: source.title || "Untitled",
          success: result.success,
          error: result.success ? undefined : result.error,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        results.push({
          id: source._id,
          title: source.title || "Untitled",
          success: false,
          error: message,
        });
      }
    }

    return { results, processed: results.length };
  },
});

/**
 * Fetch full article text from URL using Jina Reader API
 * (Same as Fabric's --scrape_url but works in Convex runtime)
 */
export const fetchArticleText = action({
  args: {
    url: v.string(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    url: v.string(),
    text: v.string(),
    length: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    // Use Jina Reader API (same as Fabric uses)
    const jinaUrl = `https://r.jina.ai/${args.url}`;

    const response = await fetchWithTimeout(jinaUrl, {
      headers: {
        Accept: "text/plain",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.status}`);
    }

    const text = await response.text();
    return {
      url: args.url,
      text,
      length: text.length,
    };
  },
});

/**
 * Fetch article and create/update a source
 */
export const fetchArticleForSource = action({
  args: {
    sourceId: v.id("sources"),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      url: v.string(),
      textLength: v.number(),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const source = await ctx.runQuery(api.sources.get, { id: args.sourceId });
    if (!source) {
      throw new Error("Source not found");
    }

    if (!source.canonicalUrl) {
      throw new Error("Source has no URL");
    }

    try {
      const jinaUrl = `https://r.jina.ai/${source.canonicalUrl}`;
      const response = await fetchWithTimeout(jinaUrl, {
        headers: { Accept: "text/plain" },
      });

      if (!response.ok) {
        throw new Error(`Jina fetch failed: ${response.status}`);
      }

      const text = await response.text();

      await ctx.runMutation(api.sources.updateText, {
        id: args.sourceId,
        rawText: text,
        devBypassSecret: args.devBypassSecret,
      });

      return {
        success: true as const,
        url: source.canonicalUrl,
        textLength: text.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(api.sources.updateStatus, {
        id: args.sourceId,
        status: "review_needed",
        blockedReason: "no_text",
        blockedDetails: `Article fetch failed: ${message}`,
        devBypassSecret: args.devBypassSecret,
      });
      return { success: false as const, error: message };
    }
  },
});
