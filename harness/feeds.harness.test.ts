import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { MAX_FEED_ENABLE_STATE_IDS } from "../convex/shared/agentContract";
import { modules } from "./modules";

describe("feed enable-state lookup", () => {
  test("returns only id and current enabled state for requested feeds", async () => {
    const t = convexTest(schema, modules);
    const [disabledId, enabledId] = await t.run(async (ctx) => {
      const insertedDisabledId = await ctx.db.insert("feeds", {
        name: "Disabled proposal",
        url: "https://example.com/disabled.xml",
        type: "rss",
        enabled: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const insertedEnabledId = await ctx.db.insert("feeds", {
        name: "Enabled proposal",
        url: "https://example.com/enabled.xml",
        type: "rss",
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
      });
      return [insertedDisabledId, insertedEnabledId] as const;
    });

    await expect(
      t.query(api.feeds.getByIds, { ids: [disabledId, enabledId] }),
    ).resolves.toEqual([
      { id: disabledId, enabled: false },
      { id: enabledId, enabled: true },
    ]);
  });

  test("rejects lookups larger than the public bound", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const rows = [];
      for (let index = 0; index <= MAX_FEED_ENABLE_STATE_IDS; index++) {
        rows.push(
          await ctx.db.insert("feeds", {
            name: `Feed ${index}`,
            url: `https://example.com/${index}.xml`,
            type: "rss",
            enabled: false,
            createdAt: index,
            updatedAt: index,
          }),
        );
      }
      return rows;
    });

    await expect(t.query(api.feeds.getByIds, { ids })).rejects.toThrow(
      `at most ${MAX_FEED_ENABLE_STATE_IDS}`,
    );
  });
});
