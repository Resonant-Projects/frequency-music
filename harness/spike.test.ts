import { describe, expect, test } from "vite-plus/test";
import { convexTest } from "convex-test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./modules";

describe("convex-test spike (GO/NO-GO gate)", () => {
  test("seeds a source via t.run and reads it back through the real query", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("sources", {
        type: "url",
        title: "Spike source",
        canonicalUrl: "https://example.com/spike",
        status: "text_ready",
        dedupeKey: "url:example.com/spike",
        visibility: "private",
        createdBy: "system",
        createdAt: 1000,
        updatedAt: 1000,
      });
    });

    const rows = await t.query(api.sources.listByStatus, {
      status: "text_ready",
      limit: 10,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("Spike source");
    expect(rows[0]!.dedupeKey).toBe("url:example.com/spike");
  });
});
