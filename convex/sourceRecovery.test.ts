import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "../harness/modules";
import { extractionInputHash } from "./shared/extractionPrompt";

import { body, seed } from "../harness/sourceRecoveryFixtures";

afterEach(() => vi.unstubAllEnvs());

describe("source recovery from the Action Queue", () => {
  test.each(["text", "archive", "access"] as const)(
    "external intake preserves operator-owned %s and its provenance",
    async (recovery) => {
      const t = convexTest(schema, modules);
      const id = await seed(t, {
        type: "url",
        canonicalUrl: "https://example.org/protected",
        dedupeKey: "url:example.org/protected",
      });
      const reader = t.withIdentity({ subject: "reader" });
      if (recovery === "text") {
        await reader.mutation(api.sources.provideRecoveryText, {
          id,
          expectedUpdatedAt: 2,
          kind: "article",
          text: body,
        });
      } else if (recovery === "archive") {
        await reader.mutation(api.sources.archiveRecoverySource, {
          id,
          expectedUpdatedAt: 2,
        });
      }
      if (recovery === "access") {
        await reader.mutation(api.sources.requestSourceRecovery, {
          id,
          expectedUpdatedAt: 2,
          note: "Access changed; retry the new capture snapshot.",
        });
      }
      const protectedSource = await t.query(api.sources.get, { id });
      for (const stale of [
        { rawText: `${body}Old automatic article.` },
        { transcript: `${body}Old automatic transcript.` },
        { title: "Old title", metadata: { feedName: "Old metadata" } },
      ]) {
        expect(
          await t.mutation(internal.sources.upsertExternal, {
            type: "url",
            dedupeKey: "url:example.org/protected",
            ...stale,
          }),
        ).toEqual({ id, created: false, contentChanged: false });
        expect(await t.query(api.sources.get, { id })).toEqual(protectedSource);
      }
    },
  );

  test.each([
    ["article", "resolved"],
    ["transcript", "needsReview"],
  ] as const)(
    "human %s recovery settles capture only when its completion contract is satisfied",
    async (kind, expectedStatus) => {
      vi.useFakeTimers();
      vi.setSystemTime(50_000);
      try {
        const t = convexTest({ schema, modules, transactionLimits: true });
        const url = "https://example.org/human-recovery";
        const id = await seed(t, {
          type: "url",
          canonicalUrl: url,
          dedupeKey: "url:example.org/human-recovery",
        });
        const scoutRunId = await t.run((ctx) =>
          ctx.db.insert("agentRuns", {
            graphName: "source-scout",
            status: "running",
            input: {},
            createdAt: 1,
            updatedAt: 1,
          }),
        );
        const failureId = await t.mutation(
          internal.operationFailures.reportCaptureFailure,
          {
            agentRunId: scoutRunId,
            input: {
              url,
              query: "resonance",
              rationale: "Missing article text",
            },
            stage: "capture",
            diagnostic: "HTTP 403: capture needs operator access",
          },
        );
        await t.run((ctx) =>
          ctx.db.patch(failureId, { attempts: 2, nextAttemptAt: 0 }),
        );
        await t.mutation(internal.operationFailures.claimRecovery, {
          failureId,
        });
        const failure = (await t.run((ctx) => ctx.db.get(failureId)))!;
        const investigationId = failure.investigationRunId!;
        await t.run((ctx) =>
          ctx.db.patch(investigationId, { status: "running" }),
        );
        await t.mutation(internal.operationFailures.submitDiagnosis, {
          agentRunId: investigationId,
          result: {
            diagnosis: "Human article access is required",
            recover: false,
          },
        });
        expect((await t.run((ctx) => ctx.db.get(failureId)))!.status).toBe(
          "needsReview",
        );
        await t
          .withIdentity({ subject: "reader" })
          .mutation(api.sources.provideRecoveryText, {
            id,
            expectedUpdatedAt: 2,
            kind,
            text: body,
          });
        expect((await t.run((ctx) => ctx.db.get(failureId)))!.status).toBe(
          expectedStatus,
        );
        expect((await t.query(api.sources.get, { id }))!.status).toBe(
          "text_ready",
        );
      } finally {
        vi.clearAllTimers();
        vi.useRealTimers();
      }
    },
  );

  test("external intake still updates a Source that has no operator recovery ownership", async () => {
    const t = convexTest(schema, modules);
    const id = await seed(t, {
      type: "url",
      canonicalUrl: "https://example.org/ordinary-intake",
      dedupeKey: "url:example.org/ordinary-intake",
    });
    expect(
      await t.mutation(internal.sources.upsertExternal, {
        type: "url",
        dedupeKey: "url:example.org/ordinary-intake",
        rawText: body,
        metadata: { feedName: "New automatic capture" },
      }),
    ).toEqual({ id, created: false, contentChanged: true });
    expect(await t.query(api.sources.get, { id })).toMatchObject({
      rawText: body,
      status: "text_ready",
      metadata: { feedName: "New automatic capture" },
    });
  });
  test("successful legacy text writes clear obsolete no-text blocks and advance the inbox", async () => {
    const t = convexTest(schema, modules);
    const id = await seed(t);
    await t
      .withIdentity({ subject: "reader" })
      .mutation(api.sources.updateText, {
        id,
        expectedUpdatedAt: 2,
        transcript: body,
      });
    const source = await t.query(api.sources.get, { id });
    expect(source?.status).toBe("text_ready");
    expect(source?.blockedReason).toBeUndefined();
    expect(source?.blockedDetails).toBeUndefined();
    expect(
      (await t.query(api.inbox.list, {})).find((row) => row._id === id)
        ?.nextAction,
    ).toBe("Run extraction");
  });
  test("explicit excerpts retain bot/minimum checks and remain extractable despite truncation markers", async () => {
    const t = convexTest(schema, modules),
      id = await seed(t),
      reader = t.withIdentity({ subject: "reader" });
    const excerpt =
      "A recovered source explains how resonance depends on frequency damping and boundary conditions. Its measurements describe the physical system and do not establish a musical listening effect. The investigators compared multiple measurements and reported their uncertainty ...";
    await expect(
      reader.mutation(api.sources.provideRecoveryText, {
        id,
        expectedUpdatedAt: 2,
        text: excerpt,
        kind: "article",
      }),
    ).rejects.toThrow(/feed excerpt/);
    await expect(
      reader.mutation(api.sources.provideRecoveryText, {
        id,
        expectedUpdatedAt: 2,
        text: "Just a moment... Checking your browser.",
        kind: "excerpt",
      }),
    ).rejects.toThrow(/bot wall/);
    await expect(
      reader.mutation(api.sources.provideRecoveryText, {
        id,
        expectedUpdatedAt: 2,
        text: "A title only...",
        kind: "excerpt",
      }),
    ).rejects.toThrow(/words/);
    await reader.mutation(api.sources.provideRecoveryText, {
      id,
      expectedUpdatedAt: 2,
      text: excerpt,
      kind: "excerpt",
    });
    const s = await t.query(api.sources.get, { id });
    expect(s?.rawText).toContain(excerpt);
    expect(s?.rawText).toContain("Excerpt only");
    expect(
      await t.mutation(internal.extractInternal.parkOperatorUnextractable, {
        sourceId: id,
        inputHash: await extractionInputHash(s!.rawText!),
      }),
    ).toEqual({ parked: false, reason: "text is extractable" });
  });
  test("repeated access updates and subsequent text preserve the original failure evidence", async () => {
    const t = convexTest(schema, modules),
      id = await seed(t, { type: "url" }),
      reader = t.withIdentity({ subject: "reader" });
    for (const note of ["Signed in.", "Publisher access now works."]) {
      const s = await t.query(api.sources.get, { id });
      await reader.mutation(api.sources.requestSourceRecovery, {
        id,
        expectedUpdatedAt: s!.updatedAt,
        note,
      });
      expect(
        (await t.query(api.sources.get, { id }))?.metadata.sourceRecovery
          .previousBlock,
      ).toBe("This video is unavailable");
    }
    const s = await t.query(api.sources.get, { id });
    await reader.mutation(api.sources.provideRecoveryText, {
      id,
      expectedUpdatedAt: s!.updatedAt,
      text: body,
      kind: "article",
    });
    expect(
      (await t.query(api.sources.get, { id }))?.metadata.sourceRecovery
        .previousBlock,
    ).toBe("This video is unavailable");
  });
  test("YouTube access updates without a usable video ID stay parked and cannot create empty runs", async () => {
    const t = convexTest(schema, modules),
      reader = t.withIdentity({ subject: "reader" });
    const id = await seed(t, {
      canonicalUrl: undefined,
      youtubeVideoId: "invalid",
    });
    expect(
      await reader.mutation(api.sources.requestSourceRecovery, {
        id,
        expectedUpdatedAt: 2,
        note: "I can open it in my browser.",
      }),
    ).toEqual({ transcriptQueued: false, pdfQueued: false });
    expect((await t.query(api.sources.get, { id }))?.status).toBe(
      "review_needed",
    );
    await seed(t, {
      dedupeKey: "malformed-ingested",
      status: "ingested",
      canonicalUrl: undefined,
    });
    await t.mutation(internal.transcriptCapture.enqueueIfNeeded, {});
    expect(await t.run((ctx) => ctx.db.query("agentRuns").collect())).toEqual(
      [],
    );
    const valid = await seed(t, {
      dedupeKey: "invalid-id-valid-url",
      youtubeVideoId: "invalid",
      status: "ingested",
    });
    const page = await t.query(
      internal.transcriptCapture.listTranscriptBacklog,
      {},
    );
    expect(page.rows).toContainEqual({
      id: valid,
      videoId: "AAAAAAAAAAA",
      title: "Blocked video",
      updatedAt: 2,
    });
  });
  test("archive retains evidence privately, leaves the inbox and rejects stale or completed rows", async () => {
    const t = convexTest(schema, modules),
      id = await seed(t),
      reader = t.withIdentity({ subject: "reader" });
    await expect(
      t.mutation(api.sources.archiveRecoverySource, {
        id,
        expectedUpdatedAt: 2,
      }),
    ).rejects.toThrow(/Authentication/);
    await expect(
      reader.mutation(api.sources.archiveRecoverySource, {
        id,
        expectedUpdatedAt: 1,
      }),
    ).rejects.toThrow(/changed/i);
    await reader.mutation(api.sources.archiveRecoverySource, {
      id,
      expectedUpdatedAt: 2,
    });
    expect(await t.query(api.sources.get, { id })).toMatchObject({
      status: "archived",
      visibility: "private",
      blockedDetails: "This video is unavailable",
      metadata: {
        feedName: "Preserve me",
        sourceRecovery: { archivedBy: "reader" },
      },
    });
    expect(
      (await t.query(api.inbox.list, { limit: 24 })).map((s) => s._id),
    ).not.toContain(id);
    await expect(
      reader.mutation(api.sources.provideRecoveryText, {
        id,
        expectedUpdatedAt: 2,
        text: body,
        kind: "article",
      }),
    ).rejects.toThrow(/queue/i);
  });
  test("transcripts replace unusable teasers and recovery cannot write a source made public", async () => {
    const t = convexTest(schema, modules),
      id = await seed(t, { rawText: "Old teaser" }),
      reader = t.withIdentity({ subject: "reader" });
    await t.run((ctx) =>
      ctx.db.patch("sources", id, { visibility: "followers" }),
    );
    await expect(
      reader.mutation(api.sources.provideRecoveryText, {
        id,
        expectedUpdatedAt: 2,
        text: body,
        kind: "transcript",
      }),
    ).rejects.toThrow(/queue/i);
    await t.run((ctx) =>
      ctx.db.patch("sources", id, { visibility: "private" }),
    );
    await reader.mutation(api.sources.provideRecoveryText, {
      id,
      expectedUpdatedAt: 2,
      text: body,
      kind: "transcript",
    });
    const s = await t.query(api.sources.get, { id });
    expect(s?.transcript).toContain(body.trim());
    expect(s?.rawText).toBeUndefined();
  });
  test("saves labelled evidence atomically, clears the block and preserves privacy and provenance", async () => {
    const t = convexTest(schema, modules),
      id = await seed(t);
    await t
      .withIdentity({ subject: "reader" })
      .mutation(api.sources.provideRecoveryText, {
        id,
        expectedUpdatedAt: 2,
        text: body,
        kind: "abstract",
        provenanceUrl: "https://example.org/paper",
        note: "Verified author abstract; full text unavailable.",
      });
    const s = await t.query(api.sources.get, { id });
    expect(s).toMatchObject({
      status: "text_ready",
      visibility: "private",
      metadata: {
        feedName: "Preserve me",
        sourceRecovery: {
          kind: "abstract",
          providedBy: "reader",
          provenanceUrl: "https://example.org/paper",
        },
      },
    });
    expect(s?.blockedReason).toBeUndefined();
    expect(s?.blockedDetails).toBeUndefined();
    expect(s?.rawText).toContain("Abstract only");
    expect(s?.rawText).toContain(body.trim());
    expect(s?.transcript).toBeUndefined();
    expect(s?.rawTextSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(await t.run((ctx) => ctx.db.query("extractions").collect())).toEqual(
      [],
    );
  });
  test("rejects stale changes, completed sources, challenges and insufficient text", async () => {
    const t = convexTest(schema, modules),
      id = await seed(t),
      reader = t.withIdentity({ subject: "reader" });
    await expect(
      reader.mutation(api.sources.provideRecoveryText, {
        id,
        expectedUpdatedAt: 1,
        text: body,
        kind: "transcript",
      }),
    ).rejects.toThrow(/changed/i);
    await expect(
      reader.mutation(api.sources.provideRecoveryText, {
        id,
        expectedUpdatedAt: 2,
        text: "Just a moment... Checking your browser before accessing this website.",
        kind: "article",
      }),
    ).rejects.toThrow();
    await expect(
      reader.mutation(api.sources.provideRecoveryText, {
        id,
        expectedUpdatedAt: 2,
        text: "Thank you.",
        kind: "transcript",
      }),
    ).rejects.toThrow();
    await t.run((ctx) => ctx.db.patch("sources", id, { status: "triaged" }));
    await expect(
      reader.mutation(api.sources.provideRecoveryText, {
        id,
        expectedUpdatedAt: 2,
        text: body,
        kind: "article",
      }),
    ).rejects.toThrow(/queue/i);
  });
  test("requires authentication and rejects unsafe provenance links", async () => {
    const t = convexTest(schema, modules),
      id = await seed(t);
    await expect(
      t.mutation(api.sources.provideRecoveryText, {
        id,
        expectedUpdatedAt: 2,
        text: body,
        kind: "article",
      }),
    ).rejects.toThrow(/Authentication/);
    await expect(
      t
        .withIdentity({ subject: "reader" })
        .mutation(api.sources.provideRecoveryText, {
          id,
          expectedUpdatedAt: 2,
          text: body,
          kind: "article",
          provenanceUrl: "javascript:alert(1)",
        }),
    ).rejects.toThrow(/URL/);
  });
  test("access changes requeue a blocked empty YouTube source and retain the failed attempt", async () => {
    const t = convexTest(schema, modules),
      id = await seed(t);
    await t
      .withIdentity({ subject: "reader" })
      .mutation(api.sources.requestSourceRecovery, {
        id,
        expectedUpdatedAt: 2,
        note: "Video now plays publicly.",
      });
    const s = await t.query(api.sources.get, { id });
    expect(s).toMatchObject({
      status: "ingested",
      visibility: "private",
      metadata: {
        transcriptCapture: { attempts: 0, lastAttemptDetail: "403" },
        sourceRecovery: {
          previousBlock: "This video is unavailable",
          accessNote: "Video now plays publicly.",
          requestedBy: "reader",
        },
      },
    });
    expect(s?.blockedReason).toBeUndefined();
    const page = await t.query(
      internal.transcriptCapture.listTranscriptBacklog,
      {},
    );
    expect(page.rows.map((r) => r.id)).toContain(id);
  });
  test("records access changes for articles without pretending capture succeeded", async () => {
    const t = convexTest(schema, modules),
      id = await seed(t, {
        type: "url",
        canonicalUrl: "https://example.org/paper",
        rawText: "Feed teaser",
      });
    await t
      .withIdentity({ subject: "reader" })
      .mutation(api.sources.requestSourceRecovery, {
        id,
        expectedUpdatedAt: 2,
        note: "Signed in to the publisher in the integrated browser.",
      });
    const s = await t.query(api.sources.get, { id });
    expect(s).toMatchObject({
      status: "review_needed",
      blockedReason: "no_text",
      rawText: "Feed teaser",
      visibility: "private",
      metadata: {
        sourceRecovery: {
          accessNote: "Signed in to the publisher in the integrated browser.",
        },
      },
    });
    expect(s?.blockedDetails).toContain("Access updated");
  });
});
