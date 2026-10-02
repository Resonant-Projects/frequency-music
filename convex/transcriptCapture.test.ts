import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "../harness/modules";

type T = ReturnType<typeof convexTest>;

const insertRun = (t: T, graphName = "transcript-capture") =>
  t.run((ctx) =>
    ctx.db.insert("agentRuns", {
      graphName,
      status: "running",
      input: {},
      createdAt: 1,
      updatedAt: 1,
    }),
  );

const insertVideo = (t: T, key: string, extra: Record<string, unknown> = {}) =>
  t.run((ctx) =>
    ctx.db.insert("sources", {
      type: "youtube",
      canonicalUrl: `https://www.youtube.com/shorts/${key}`,
      title: `Video ${key}`,
      status: "ingested",
      dedupeKey: `yt:${key}`,
      visibility: "private",
      createdBy: "system",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...extra,
    }),
  );

const transcript =
  "Do you know why we have a perfect eclipse? The moon and the sun appear the same size from Earth because of their distances. ".repeat(
    2,
  );

afterEach(() => {
  vi.useRealTimers();
});

describe("transcript capture backlog", () => {
  test("lists ingested YouTube Sources without text, least recently tried first", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000);
    const t = convexTest(schema, modules);
    const older = await insertVideo(t, "AAAAAAAAAAA");
    const newer = await insertVideo(t, "BBBBBBBBBBB");
    await insertVideo(t, "CCCCCCCCCCC", { transcript: "already" });
    await insertVideo(t, "DDDDDDDDDDD", { status: "text_ready" });
    const first = await t.query(
      internal.transcriptCapture.listTranscriptBacklog,
      {},
    );
    expect(first.rows).toEqual([
      { id: older, videoId: "AAAAAAAAAAA", title: "Video AAAAAAAAAAA" },
      { id: newer, videoId: "BBBBBBBBBBB", title: "Video BBBBBBBBBBB" },
    ]);

    vi.setSystemTime(5_000);
    const runId = await insertRun(t);
    await t.mutation(internal.transcriptCapture.recordTranscriptCapture, {
      sourceId: older,
      agentRunId: runId,
      outcome: "attempted",
      detail: "YouTube rate limit",
    });
    const after = await t.query(
      internal.transcriptCapture.listTranscriptBacklog,
      {},
    );
    expect(after.rows.map((row) => row.id)).toEqual([newer, older]);
  });
});

describe("recording transcript capture", () => {
  test("stores a captured transcript with provenance and queues it for Extraction", async () => {
    const t = convexTest(schema, modules);
    const runId = await insertRun(t);
    const id = await insertVideo(t, "EEEEEEEEEEE");
    await t.mutation(internal.transcriptCapture.recordTranscriptCapture, {
      sourceId: id,
      agentRunId: runId,
      outcome: "captured",
      transcript,
      language: "English",
      model: "whisper-large-v3-turbo",
    });
    const source = await t.run((ctx) => ctx.db.get(id));
    expect(source).toMatchObject({
      status: "text_ready",
      transcript: transcript.trim(),
      metadata: {
        transcriptCapture: {
          audio: "yt-dlp",
          transcriber: "groq",
          model: "whisper-large-v3-turbo",
          language: "English",
          agentRunId: runId,
        },
      },
    });
    expect(source?.rawTextSha256).toMatch(/^[0-9a-f]{64}$/);
    // A second capture of the same Source changes nothing.
    expect(
      await t.mutation(internal.transcriptCapture.recordTranscriptCapture, {
        sourceId: id,
        agentRunId: runId,
        outcome: "unavailable",
        detail: "x",
      }),
    ).toEqual({ updated: false });
  });

  test("parks unavailable audio for review", async () => {
    const t = convexTest(schema, modules);
    const runId = await insertRun(t);
    const id = await insertVideo(t, "FFFFFFFFFFF");
    await t.mutation(internal.transcriptCapture.recordTranscriptCapture, {
      sourceId: id,
      agentRunId: runId,
      outcome: "unavailable",
      detail: "Video unavailable",
    });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      status: "review_needed",
      blockedReason: "no_text",
      blockedDetails: "Video unavailable",
    });
  });

  test("refuses other graphs and malformed captures", async () => {
    const t = convexTest(schema, modules);
    const scoutRun = await insertRun(t, "source-scout");
    const runId = await insertRun(t);
    const id = await insertVideo(t, "GGGGGGGGGGG");
    await expect(
      t.mutation(internal.transcriptCapture.recordTranscriptCapture, {
        sourceId: id,
        agentRunId: scoutRun as Id<"agentRuns">,
        outcome: "captured",
        transcript,
        model: "m",
      }),
    ).rejects.toThrow("transcript-capture run");
    await expect(
      t.mutation(internal.transcriptCapture.recordTranscriptCapture, {
        sourceId: id,
        agentRunId: runId,
        outcome: "captured",
        transcript: "too short",
        model: "m",
      }),
    ).rejects.toThrow("characters");
  });
});

describe("transcript capture cron", () => {
  test("queues one run only when transcripts await and none is active", async () => {
    const t = convexTest(schema, modules);
    const runs = () =>
      t.run((ctx) =>
        ctx.db
          .query("agentRuns")
          .filter((q) => q.eq(q.field("graphName"), "transcript-capture"))
          .collect(),
      );
    await t.mutation(internal.transcriptCapture.enqueueIfNeeded, {});
    expect(await runs()).toHaveLength(0);
    // Ingested videos that already hold text come first and do not count.
    for (let i = 0; i < 120; i++) {
      await insertVideo(t, `X${String(i).padStart(10, "0")}`, {
        transcript: "held",
      });
    }
    await t.mutation(internal.transcriptCapture.enqueueIfNeeded, {});
    expect(await runs()).toHaveLength(0);
    await insertVideo(t, "HHHHHHHHHHH");
    await t.mutation(internal.transcriptCapture.enqueueIfNeeded, {});
    await t.mutation(internal.transcriptCapture.enqueueIfNeeded, {});
    expect((await runs()).map((run) => run.status)).toEqual(["queued"]);
  });
});
