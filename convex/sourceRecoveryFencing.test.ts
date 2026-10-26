import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { z } from "zod";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "../harness/modules";

import { body, seed } from "../harness/sourceRecoveryFixtures";

afterEach(() => vi.unstubAllEnvs());

describe("source recovery capture version fencing", () => {
  test.each(["text", "status", "extraction", "promotion", "admin"] as const)(
    "same-millisecond %s writes cannot revive an invalidated capture version",
    async (write) => {
      // Freeze time before the first committed fixture: transaction clocks
      // cannot move backwards behind an existing snapshot.
      vi.useFakeTimers();
      vi.setSystemTime(2);
      try {
        const t = convexTest(schema, modules);
        const id = await seed(t);
        const reader = t.withIdentity({ subject: "reader" });
        await reader.mutation(api.sources.provideRecoveryText, {
          id,
          expectedUpdatedAt: 2,
          kind: "article",
          text: body,
        });
        const recovered = (await t.query(api.sources.get, { id }))!;
        expect(recovered.updatedAt).toBe(3);
        if (write === "text") {
          await reader.mutation(api.sources.updateText, {
            id,
            expectedUpdatedAt: recovered.updatedAt,
            rawText: `${body}Fresh versioned capture.`,
          });
        } else if (write === "status") {
          await reader.mutation(api.sources.updateStatus, {
            id,
            expectedUpdatedAt: recovered.updatedAt,
            status: "review_needed",
          });
        } else if (write === "extraction") {
          await t.mutation(internal.extractInternal.beginExtraction, {
            sourceId: id,
            model: "test",
          });
        } else if (write === "promotion") {
          await reader.mutation(api.admin.promoteVisibility, {
            input: { entityType: "sources", id, visibility: "private" },
          });
        } else {
          await reader.mutation(api.admin.setSourceStatus, {
            id,
            status: "review_needed",
          });
        }
        const fresh = await t.query(api.sources.get, { id });
        await expect(
          reader.mutation(api.sources.updateText, {
            id,
            expectedUpdatedAt: 2,
            rawText: `${body}Old capture that must be discarded.`,
          }),
        ).rejects.toThrow("Source changed during capture");
        expect(await t.query(api.sources.get, { id })).toEqual(fresh);
        expect(fresh?.updatedAt).toBeGreaterThan(recovered.updatedAt);
      } finally {
        vi.clearAllTimers();
        vi.useRealTimers();
      }
    },
  );
  test("a fresh transcript attempt cannot revive the version preceding an access update", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(2);
    try {
      const t = convexTest(schema, modules);
      const id = await seed(t, { status: "ingested" });
      const runId = await t.run((ctx) =>
        ctx.db.insert("agentRuns", {
          graphName: "transcript-capture",
          status: "running",
          input: {},
          createdAt: 1,
          updatedAt: 1,
        }),
      );
      await t
        .withIdentity({ subject: "reader" })
        .mutation(api.sources.requestSourceRecovery, {
          id,
          expectedUpdatedAt: 2,
          note: "Access changed.",
        });
      expect(
        await t.mutation(internal.transcriptCapture.recordTranscriptCapture, {
          sourceId: id,
          expectedUpdatedAt: 3,
          agentRunId: runId,
          outcome: "attempted",
          detail: "Fresh temporary failure",
        }),
      ).toEqual({ updated: true });
      const fresh = await t.query(api.sources.get, { id });
      expect(
        await t.mutation(internal.transcriptCapture.recordTranscriptCapture, {
          sourceId: id,
          expectedUpdatedAt: 2,
          agentRunId: runId,
          outcome: "captured",
          transcript: body,
          model: "whisper-large-v3-turbo",
        }),
      ).toEqual({ updated: false });
      expect(await t.query(api.sources.get, { id })).toEqual(fresh);
      expect(fresh?.updatedAt).toBe(4);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
  test.each(["captured", "unavailable", "attempted", "rate_limited"] as const)(
    "access updates discard stale automatic %s outcomes and allow fresh attempts",
    async (outcome) => {
      vi.stubEnv("AGENT_TOOL_SECRET", "synthetic-recovery-test-secret");
      const t = convexTest(schema, modules);
      const callTool = async (name: string, args = {}) => {
        const response = await t.fetch(`/agent-tools/${name}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            secret: "synthetic-recovery-test-secret",
            ...args,
          }),
        });
        expect(response.status).toBe(200);
        return response.json();
      };
      const pageShape = z.object({
        rows: z.array(z.object({ updatedAt: z.number() })),
      });
      const id = await seed(t, { status: "ingested" });
      const agentRunId = await t.run((ctx) =>
        ctx.db.insert("agentRuns", {
          graphName: "transcript-capture",
          status: "running",
          input: {},
          createdAt: 1,
          updatedAt: 1,
        }),
      );
      const oldPage = pageShape.parse(await callTool("listTranscriptBacklog"));
      const clock = vi.spyOn(Date, "now").mockReturnValue(2);
      try {
        await t
          .withIdentity({ subject: "reader" })
          .mutation(api.sources.requestSourceRecovery, {
            id,
            expectedUpdatedAt: 2,
            note: "Video now plays publicly.",
          });
      } finally {
        clock.mockRestore();
      }
      const before = await t.query(api.sources.get, { id });
      for (const expectedUpdatedAt of [oldPage.rows[0]!.updatedAt, undefined]) {
        expect(
          await callTool("recordTranscriptCapture", {
            sourceId: id,
            expectedUpdatedAt,
            agentRunId,
            outcome,
            transcript: body,
            model: "whisper-large-v3-turbo",
            detail: "Old access outcome",
          }),
        ).toEqual({ updated: false });
        expect(await t.query(api.sources.get, { id })).toEqual(before);
      }
      const freshPage = pageShape.parse(
        await callTool("listTranscriptBacklog"),
      );
      expect(
        await callTool("recordTranscriptCapture", {
          sourceId: id,
          expectedUpdatedAt: freshPage.rows[0]!.updatedAt,
          agentRunId,
          outcome: "attempted",
          detail: "Fresh access outcome",
        }),
      ).toEqual({ updated: true });
      expect(
        (await t.query(api.sources.get, { id }))?.metadata.transcriptCapture,
      ).toMatchObject({
        attempts: 1,
        lastAttemptDetail: "Fresh access outcome",
      });
    },
  );
  test("same-millisecond recovery and Archive invalidate in-flight article and transcript actions", async () => {
    for (const type of ["url", "youtube"] as const) {
      for (const recovery of ["text", "archive"]) {
        const t = convexTest(schema, modules),
          id = await seed(t, { type }),
          reader = t.withIdentity({ subject: "reader" });
        const entered = Promise.withResolvers<void>(),
          release = Promise.withResolvers<void>();
        const clock = vi.spyOn(Date, "now").mockReturnValue(2);
        const fetchMock = vi
          .spyOn(globalThis, "fetch")
          .mockImplementation(async () => {
            entered.resolve();
            await release.promise;
            return new Response(
              type === "youtube" ? JSON.stringify({ content: body }) : body,
            );
          });
        try {
          const job = reader.action(
            type === "youtube"
              ? api.fabric.fetchTranscriptForSource
              : api.fabric.fetchArticleForSource,
            { sourceId: id },
          );
          await entered.promise;
          if (recovery === "text")
            await reader.mutation(api.sources.provideRecoveryText, {
              id,
              expectedUpdatedAt: 2,
              text: body,
              kind: type === "youtube" ? "transcript" : "article",
            });
          else
            await reader.mutation(api.sources.archiveRecoverySource, {
              id,
              expectedUpdatedAt: 2,
            });
          const before = await t.query(api.sources.get, { id });
          release.resolve();
          await expect(job).rejects.toThrow(/discard/);
          expect(before?.updatedAt).toBeGreaterThan(2);
          expect(await t.query(api.sources.get, { id })).toEqual(before);
        } finally {
          release.resolve();
          fetchMock.mockRestore();
          clock.mockRestore();
        }
      }
    }
  });
  test("legacy capture writes reject stale snapshots and cannot replace recovered text or revive archives", async () => {
    const t = convexTest(schema, modules),
      reader = t.withIdentity({ subject: "reader" });
    for (const recovery of ["text", "archive"]) {
      const id = await seed(t, { dedupeKey: `legacy-${recovery}` });
      if (recovery === "text")
        await reader.mutation(api.sources.provideRecoveryText, {
          id,
          expectedUpdatedAt: 2,
          text: body,
          kind: "transcript",
        });
      else
        await reader.mutation(api.sources.archiveRecoverySource, {
          id,
          expectedUpdatedAt: 2,
        });
      const before = await t.query(api.sources.get, { id });
      if (recovery === "archive") {
        await expect(
          reader.mutation(api.sources.updateStatus, {
            id,
            status: "text_ready",
          }),
        ).rejects.toThrow(/discard/);
      }
      for (const expectedUpdatedAt of [undefined, 2]) {
        await expect(
          reader.mutation(api.sources.updateText, {
            id,
            transcript: "Stale worker text",
            expectedUpdatedAt,
          }),
        ).rejects.toThrow(/discard/);
        await expect(
          reader.mutation(api.sources.updateStatus, {
            id,
            status: "review_needed",
            blockedReason: "no_text",
            expectedUpdatedAt,
          }),
        ).rejects.toThrow(/discard/);
      }
      expect(await t.query(api.sources.get, { id })).toEqual(before);
    }
  });
  test.each(["text", "status"] as const)(
    "legacy %s cannot overwrite an access update without its new version",
    async (write) => {
      const t = convexTest(schema, modules);
      const reader = t.withIdentity({ subject: "reader" });
      const id = await seed(t);
      await reader.mutation(api.sources.requestSourceRecovery, {
        id,
        expectedUpdatedAt: 2,
        note: "The video is now available publicly.",
      });
      const before = await t.query(api.sources.get, { id });
      const capture = (expectedUpdatedAt?: number) =>
        write === "text"
          ? reader.mutation(api.sources.updateText, {
              id,
              transcript: body,
              expectedUpdatedAt,
            })
          : reader.mutation(api.sources.updateStatus, {
              id,
              status: "review_needed",
              blockedReason: "no_text",
              expectedUpdatedAt,
            });
      await expect(capture()).rejects.toThrow(/discard/);
      expect(await t.query(api.sources.get, { id })).toEqual(before);
      await capture(before!.updatedAt);
      expect(
        (await t.query(api.sources.get, { id }))!.updatedAt,
      ).toBeGreaterThan(before!.updatedAt);
    },
  );

  test("late automatic captures cannot overwrite supplied text or revive archived sources", async () => {
    const t = convexTest(schema, modules),
      reader = t.withIdentity({ subject: "reader" });
    const agentRunId = await t.run((ctx) =>
      ctx.db.insert("agentRuns", {
        graphName: "transcript-capture",
        status: "running",
        input: {},
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const supplied = await seed(t, { status: "ingested" });
    const archived = await seed(t, {
      dedupeKey: "yt:BBBBBBBBBBB",
      status: "ingested",
    });
    await reader.mutation(api.sources.provideRecoveryText, {
      id: supplied,
      expectedUpdatedAt: 2,
      text: body,
      kind: "transcript",
    });
    await reader.mutation(api.sources.archiveRecoverySource, {
      id: archived,
      expectedUpdatedAt: 2,
    });
    for (const sourceId of [supplied, archived]) {
      expect(
        await t.mutation(internal.transcriptCapture.recordTranscriptCapture, {
          sourceId,
          agentRunId,
          outcome: "captured",
          transcript: "Late worker transcript",
          model: "whisper-large-v3-turbo",
        }),
      ).toEqual({ updated: false });
    }
    expect(
      (await t.query(api.sources.get, { id: supplied }))?.transcript,
    ).toContain(body.trim());
    expect((await t.query(api.sources.get, { id: archived }))?.status).toBe(
      "archived",
    );
  });
});
