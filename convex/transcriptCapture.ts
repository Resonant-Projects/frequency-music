import { literals } from "convex-helpers/validators";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { insertQueuedRun } from "./agentRuns";
import {
  TRANSCRIPT_MAX_CHARS,
  TRANSCRIPT_MIN_CHARS,
} from "./shared/agentContract";
import { extractYouTubeVideoId } from "./sourceUtils";

// YouTube Sources reach "ingested" without text; the transcript-capture graph
// downloads their audio with yt-dlp and transcribes it with Groq Whisper.
const BACKLOG_PAGE_SIZE = 100;
const DETAIL_MAX_CHARS = 500;
// Failed attempts (not rate limits) before a video is parked for review: a
// deleted or region-locked video otherwise takes a slot in every run.
export const MAX_TRANSCRIPT_ATTEMPTS = 5;

function awaitsTranscript(source: Doc<"sources">): boolean {
  return (
    source.type === "youtube" &&
    source.status === "ingested" &&
    !source.transcript &&
    !source.rawText
  );
}

function videoIdOf(source: Doc<"sources">): string | null {
  return (
    source.youtubeVideoId ??
    (source.canonicalUrl ? extractYouTubeVideoId(source.canonicalUrl) : null)
  );
}

/**
 * One page of YouTube Sources awaiting a transcript, least recently tried
 * first. A failed attempt touches the Source, so it moves behind untried ones.
 */
export const listTranscriptBacklog = internalQuery({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({
    rows: v.array(
      v.object({
        id: v.id("sources"),
        videoId: v.string(),
        title: v.optional(v.string()),
      }),
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("sources")
      .withIndex("by_status_type_updatedAt", (q) =>
        q.eq("status", "ingested").eq("type", "youtube"),
      )
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems: BACKLOG_PAGE_SIZE });
    const rows = page.page.flatMap((source) => {
      const videoId = videoIdOf(source);
      if (!awaitsTranscript(source) || !videoId) return [];
      return [
        {
          id: source._id,
          videoId,
          ...(source.title ? { title: source.title } : {}),
        },
      ];
    });
    return { rows, continueCursor: page.continueCursor, isDone: page.isDone };
  },
});

/**
 * Record one transcript-capture outcome for a YouTube Source:
 * - captured: the transcript enters text_ready with its provenance;
 * - unavailable: the video has no usable audio or speech (review_needed);
 * - attempted: a failure; the Source moves behind untried ones, and after
 *   MAX_TRANSCRIPT_ATTEMPTS of them it is parked for review;
 * - rate_limited: YouTube or Groq refused the request; the Source moves
 *   behind untried ones without counting against it.
 */
export const recordTranscriptCapture = internalMutation({
  args: {
    sourceId: v.id("sources"),
    agentRunId: v.id("agentRuns"),
    outcome: literals("captured", "unavailable", "attempted", "rate_limited"),
    transcript: v.optional(v.string()),
    language: v.optional(v.string()),
    model: v.optional(v.string()),
    detail: v.optional(v.string()),
  },
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx, args) => {
    const agentRun = await ctx.db.get("agentRuns", args.agentRunId);
    if (!agentRun || agentRun.graphName !== "transcript-capture") {
      throw new Error("Transcript capture requires a transcript-capture run");
    }
    const source = await ctx.db.get("sources", args.sourceId);
    if (!source || !awaitsTranscript(source)) return { updated: false };
    const now = Date.now();
    const metadata = (source.metadata ?? {}) as Record<string, unknown>;
    const previous = (metadata.transcriptCapture ?? {}) as Record<
      string,
      unknown
    >;
    const detail = args.detail?.slice(0, DETAIL_MAX_CHARS);
    if (args.outcome === "captured") {
      const transcript = args.transcript?.trim() ?? "";
      if (
        transcript.length < TRANSCRIPT_MIN_CHARS ||
        transcript.length > TRANSCRIPT_MAX_CHARS
      ) {
        throw new Error(
          `A transcript must be ${TRANSCRIPT_MIN_CHARS}-${TRANSCRIPT_MAX_CHARS} characters`,
        );
      }
      if (!args.model) throw new Error("A captured transcript names its model");
      await ctx.db.patch("sources", source._id, {
        transcript,
        rawTextSha256: await sha256Hex(transcript),
        status: "text_ready",
        blockedReason: undefined,
        blockedDetails: undefined,
        metadata: {
          ...metadata,
          transcriptCapture: {
            audio: "yt-dlp",
            transcriber: "groq",
            model: args.model,
            ...(args.language ? { language: args.language } : {}),
            agentRunId: args.agentRunId,
            capturedAt: now,
          },
        },
        updatedAt: now,
      });
      return { updated: true };
    }
    const previousAttempts =
      typeof previous.attempts === "number" ? previous.attempts : 0;
    const attempts =
      args.outcome === "attempted" ? previousAttempts + 1 : previousAttempts;
    const attempt = {
      ...previous,
      attempts,
      lastAttemptAt: now,
      lastAttemptRunId: args.agentRunId,
      ...(detail ? { lastAttemptDetail: detail } : {}),
    };
    const exhausted =
      args.outcome === "attempted" && attempts >= MAX_TRANSCRIPT_ATTEMPTS;
    // A detail-less final attempt still parks with the last recorded reason.
    const parkingDetail =
      typeof attempt.lastAttemptDetail === "string"
        ? attempt.lastAttemptDetail
        : undefined;
    await ctx.db.patch("sources", source._id, {
      ...(args.outcome === "unavailable" || exhausted
        ? {
            status: "review_needed" as const,
            blockedReason: "no_text" as const,
            blockedDetails: exhausted
              ? `Transcript capture failed ${attempts} times${parkingDetail ? `: ${parkingDetail}` : ""}`.slice(
                  0,
                  DETAIL_MAX_CHARS,
                )
              : (detail ?? "No transcript could be captured"),
          }
        : {}),
      metadata: { ...metadata, transcriptCapture: attempt },
      updatedAt: now,
    });
    return { updated: true };
  },
});

/**
 * Cron entry point: queue a transcript-capture run when YouTube Sources await
 * transcripts and no run is already queued or running.
 */
export const enqueueIfNeeded = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Stops at the first Source awaiting a transcript; ingested YouTube Sources
    // that already hold text are rare, so this reads little.
    let awaiting = false;
    for await (const source of ctx.db
      .query("sources")
      .withIndex("by_status_type_updatedAt", (q) =>
        q.eq("status", "ingested").eq("type", "youtube"),
      )) {
      if (awaitsTranscript(source)) {
        awaiting = true;
        break;
      }
    }
    if (!awaiting) return null;
    for (const status of ["queued", "running"] as const) {
      const active = await ctx.db
        .query("agentRuns")
        .withIndex("by_status_graphName_updatedAt", (q) =>
          q.eq("status", status).eq("graphName", "transcript-capture"),
        )
        .first();
      if (active) return null;
    }
    await insertQueuedRun(ctx, { graphName: "transcript-capture", input: {} });
    return null;
  },
});

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
