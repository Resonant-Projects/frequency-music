import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import { keepsDedupeKey } from "./sources";
import { modules } from "../harness/modules";

const arxivRow = (overrides: {
  dedupeKey: string;
  rssGuid: string;
  status: Doc<"sources">["status"];
  createdAt: number;
  feedUrl?: string;
}) => ({
  type: "rss" as const,
  feedUrl: "https://arxiv.org/rss/cs.SD",
  canonicalUrl: "https://arxiv.org/abs/2603.27528",
  rawText:
    "Abstract: results of the 2025 Automatic Music Transcription Challenge.",
  visibility: "private" as const,
  createdBy: "system" as const,
  updatedAt: 1,
  ...overrides,
});

describe("dedupe key migration", () => {
  test("keeps the row that is further along, then the older one", () => {
    const row = (status: string, createdAt: number, blockedReason?: string) =>
      ({ status, createdAt, blockedReason }) as Parameters<
        typeof keepsDedupeKey
      >[0];
    expect(keepsDedupeKey(row("extracted", 2), row("text_ready", 1))).toBe(
      true,
    );
    expect(keepsDedupeKey(row("text_ready", 1), row("extracted", 2))).toBe(
      false,
    );
    expect(keepsDedupeKey(row("text_ready", 1), row("text_ready", 2))).toBe(
      true,
    );
    expect(keepsDedupeKey(row("text_ready", 2), row("text_ready", 1))).toBe(
      false,
    );
    expect(
      keepsDedupeKey(row("review_needed", 1, "no_text"), row("text_ready", 2)),
    ).toBe(false);
  });

  test("merges a re-announced arXiv paper into its extracted copy", async () => {
    const t = convexTest(schema, modules);
    const asOperator = t.withIdentity({
      subject: "operator",
      name: "Operator",
    });
    const { older, newer } = await t.run(async (ctx) => ({
      older: await ctx.db.insert(
        "sources",
        arxivRow({
          dedupeKey:
            "rss:https://arxiv.org/rss/cs.SD:oai:arXiv.org:2603.27528v1",
          rssGuid: "oai:arXiv.org:2603.27528v1",
          status: "text_ready",
          createdAt: 1,
        }),
      ),
      newer: await ctx.db.insert(
        "sources",
        arxivRow({
          dedupeKey:
            "rss:https://arxiv.org/rss/eess.AS:oai:arXiv.org:2603.27528v2",
          feedUrl: "https://arxiv.org/rss/eess.AS",
          rssGuid: "oai:arXiv.org:2603.27528v2",
          status: "extracted",
          createdAt: 2,
        }),
      ),
    }));

    const dry = await asOperator.mutation(api.sources.recomputeDedupeKeys, {
      cursor: null,
      apply: false,
    });
    expect(dry.changed).toBe(0);
    expect(dry.planned.map((p) => p.to)).toEqual([
      "arxiv:2603.27528",
      "arxiv:2603.27528",
    ]);

    await asOperator.mutation(api.sources.recomputeDedupeKeys, {
      cursor: null,
      apply: true,
    });
    const [kept, archived] = await t.run(async (ctx) => [
      await ctx.db.get(newer),
      await ctx.db.get(older),
    ]);
    expect(kept).toMatchObject({
      status: "extracted",
      dedupeKey: "arxiv:2603.27528",
    });
    expect(archived).toMatchObject({
      status: "archived",
      blockedReason: "duplicate",
      blockedDetails: `dedupe-migration: duplicate of ${newer}`,
    });
  });
});
