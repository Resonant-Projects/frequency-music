import type {
  TranscriptCaptureState,
  TranscriptCaptureTally,
  TranscriptCaptureUpdate,
} from "../../state/transcriptCaptureState.js";
import { callConvex } from "../../tools/convexTools.js";
import {
  createYouTubeTranscriber,
  type TranscriptOutcome,
} from "../../tools/youtubeTranscript.js";
import {
  appendRemoteAuditEvent,
  finalizeRunCompleted,
  type AgentAuditEvent,
  type ToolCaller,
} from "../shared/audit.js";

// A run captures a small, paced batch; the 3-hourly cron does the rest.
export const MAX_TRANSCRIPTS_PER_RUN = 20;
export const YOUTUBE_PACE_MS = 20_000;
const MAX_BACKLOG_PAGES = 20;

type BacklogRow = { id: string; videoId: string; title?: string };

function asBacklogPage(value: unknown): {
  rows: BacklogRow[];
  continueCursor?: string;
  isDone: boolean;
} {
  const page = (value ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(page.rows)
    ? page.rows.flatMap((entry): BacklogRow[] => {
        const row = (entry ?? {}) as Record<string, unknown>;
        return typeof row.id === "string" && typeof row.videoId === "string"
          ? [
              {
                id: row.id,
                videoId: row.videoId,
                ...(typeof row.title === "string" ? { title: row.title } : {}),
              },
            ]
          : [];
      })
    : [];
  return {
    rows,
    ...(typeof page.continueCursor === "string"
      ? { continueCursor: page.continueCursor }
      : {}),
    isDone: page.isDone !== false,
  };
}

export function createCaptureTranscriptsNode(
  callTool: ToolCaller = callConvex,
  transcriber: {
    configured: boolean;
    transcribe: (videoId: string) => Promise<TranscriptOutcome>;
  } = createYouTubeTranscriber(),
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
) {
  return async (state: {
    agentRunId?: string;
  }): Promise<TranscriptCaptureUpdate> => {
    if (!state.agentRunId)
      throw new Error("transcript-capture requires agentRunId provenance");
    const tally: TranscriptCaptureTally = {
      attempted: 0,
      captured: [],
      unavailable: 0,
      failed: 0,
      rateLimited: false,
      notConfigured: !transcriber.configured,
    };
    if (!transcriber.configured) return { tally };

    const backlog: BacklogRow[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_BACKLOG_PAGES; page++) {
      const result = asBacklogPage(
        await callTool("listTranscriptBacklog", { cursor }),
      );
      backlog.push(...result.rows);
      if (
        backlog.length >= MAX_TRANSCRIPTS_PER_RUN ||
        result.isDone ||
        !result.continueCursor ||
        result.continueCursor === cursor
      )
        break;
      cursor = result.continueCursor;
    }
    backlog.splice(MAX_TRANSCRIPTS_PER_RUN);

    const auditEvents: AgentAuditEvent[] = [];
    // Whether the outcome was stored: only then does a capture count.
    const record = async (
      row: BacklogRow,
      args: Record<string, unknown>,
    ): Promise<boolean> => {
      try {
        const result = (await callTool("recordTranscriptCapture", {
          sourceId: row.id,
          agentRunId: state.agentRunId,
          ...args,
        })) as { updated?: unknown } | null;
        return result?.updated === true;
      } catch (error) {
        auditEvents.push(
          ...(await appendRemoteAuditEvent(
            callTool,
            state.agentRunId,
            "error",
            "Transcript capture could not record an outcome",
            {
              id: row.id,
              error: error instanceof Error ? error.message : String(error),
            },
          )),
        );
        return false;
      }
    };
    for (const [index, row] of backlog.entries()) {
      if (index > 0) await sleep(YOUTUBE_PACE_MS);
      tally.attempted++;
      // One video's unexpected error must not end the batch.
      const outcome: TranscriptOutcome = await transcriber
        .transcribe(row.videoId)
        .catch((error: unknown) => ({
          kind: "failed" as const,
          detail: error instanceof Error ? error.message : String(error),
        }));
      if (outcome.kind === "captured") {
        const stored = await record(row, {
          outcome: "captured",
          transcript: outcome.text,
          model: outcome.model,
          ...(outcome.language ? { language: outcome.language } : {}),
        });
        if (stored) tally.captured.push(row.title ?? row.videoId);
        else tally.failed++;
      } else if (outcome.kind === "unavailable") {
        await record(row, { outcome: "unavailable", detail: outcome.detail });
        tally.unavailable++;
      } else {
        await record(row, { outcome: "attempted", detail: outcome.detail });
        if (outcome.kind === "failed") tally.failed++;
      }
      auditEvents.push(
        ...(await appendRemoteAuditEvent(
          callTool,
          state.agentRunId,
          outcome.kind === "captured" ? "tool_call" : "decision",
          `Transcript capture: ${outcome.kind}`,
          {
            id: row.id,
            videoId: row.videoId,
            ...(outcome.kind === "captured"
              ? { chars: outcome.text.length, model: outcome.model }
              : { detail: outcome.detail }),
          },
        )),
      );
      if (outcome.kind === "rate_limited") {
        // Stop at the first rate limit; the next cron run tries again.
        tally.rateLimited = true;
        break;
      }
    }
    return { tally, auditEvents };
  };
}

export const captureTranscriptsNode = createCaptureTranscriptsNode();

export function createSummarizeNode(callTool: ToolCaller = callConvex) {
  return async (
    state: TranscriptCaptureState,
  ): Promise<TranscriptCaptureUpdate> => {
    const tally = state.tally;
    // finalizeRunCompleted identifies the graph by this prefix.
    const summary = !tally
      ? "transcript-capture completed: nothing attempted"
      : tally.notConfigured
        ? "transcript-capture completed: skipped, GROQ_API_KEY is not configured"
        : `transcript-capture completed: captured ${tally.captured.length} of ${tally.attempted} YouTube sources, ${tally.unavailable} unavailable, ${tally.failed} failed${tally.rateLimited ? ", stopped at a rate limit" : ""}${tally.captured.length ? `: ${tally.captured.join(" | ")}` : ""}`;
    const auditEvents = await finalizeRunCompleted(
      callTool,
      state.agentRunId,
      summary,
      state.traceUrl,
    );
    return { summary, auditEvents };
  };
}

export const summarizeNode = createSummarizeNode();
