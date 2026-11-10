import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { api, internal } from "./_generated/api";
import type { AppIdentity } from "./auth";
import { readerLimit } from "./readerQuery";
import schema from "./schema";

afterEach(() => vi.unstubAllEnvs());

type T = ReturnType<typeof convexTest>;

async function seedSources(t: T, count: number) {
  return await t.run(async (ctx) => {
    const ids = [];
    for (let index = 0; index < count; index++)
      ids.push(
        await ctx.db.insert("sources", {
          type: "url",
          title: `Source ${index}`,
          dedupeKey: `url:example.org/${index}`,
          status: "text_ready",
          visibility: "private",
          createdBy: "system",
          createdAt: index,
          updatedAt: index,
        }),
      );
    return ids;
  });
}

function enableBypass() {
  vi.stubEnv("AUTH_BYPASS_ENABLED", "true");
  vi.stubEnv("AUTH_BYPASS_SECRET", "bypass");
}

describe("tier 1 reads require a reader", () => {
  test("an anonymous Source read is rejected", async () => {
    const t = convexTest(schema, modules);
    const [id] = await seedSources(t, 1);
    await expect(t.query(api.sources.get, { id: id! })).rejects.toThrow(
      "Authentication required",
    );
  });

  test("anonymous recent-Source and listening reads are rejected", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.sources.listRecent, {})).rejects.toThrow(
      "Authentication required",
    );
    await expect(t.query(api.listening.listRecent, {})).rejects.toThrow(
      "Authentication required",
    );
  });

  test("a signed-in user with no users row can read", async () => {
    const t = convexTest(schema, modules);
    const [id] = await seedSources(t, 1);
    const reader = t.withIdentity({ subject: "reader" });
    expect(await reader.query(api.sources.get, { id: id! })).toMatchObject({
      _id: id,
    });
    expect(await reader.query(api.sources.listRecent, {})).toHaveLength(1);
    expect(await reader.query(api.listening.listRecent, {})).toEqual([]);
  });

  test("the service secret reads with no identity", async () => {
    enableBypass();
    const t = convexTest(schema, modules);
    const [id] = await seedSources(t, 1);
    expect(
      await t.query(api.sources.get, { id: id!, devBypassSecret: "bypass" }),
    ).toMatchObject({ _id: id });
  });

  test("the internal twin reads with no identity", async () => {
    const t = convexTest(schema, modules);
    const [id] = await seedSources(t, 1);
    expect(await t.query(internal.sourceReads.get, { id: id! })).toMatchObject({
      _id: id,
    });
  });
});

describe("list reads clamp signed-in users only", () => {
  test("a signed-in user asking for 1,000 rows gets at most 200", async () => {
    const t = convexTest(schema, modules);
    await seedSources(t, 201);
    const reader = t.withIdentity({ subject: "reader" });
    const asked = { limit: 1000 };
    expect(await reader.query(api.sources.listRecent, asked)).toHaveLength(200);
    expect(
      await reader.query(api.sources.listByStatus, {
        ...asked,
        status: "text_ready",
      }),
    ).toHaveLength(200);
    expect(
      await reader.query(api.sources.listByType, { ...asked, type: "url" }),
    ).toHaveLength(200);
  });

  test("the service identity asking for more than 200 is not cut to 200", async () => {
    enableBypass();
    const t = convexTest(schema, modules);
    await seedSources(t, 201);
    const asked = { limit: 1000, devBypassSecret: "bypass" };
    expect(await t.query(api.sources.listRecent, asked)).toHaveLength(201);
    expect(
      await t.query(api.sources.listByStatus, {
        ...asked,
        status: "text_ready",
      }),
    ).toHaveLength(201);
    expect(
      await t.query(api.sources.listByType, { ...asked, type: "url" }),
    ).toHaveLength(201);
  });

  test("readerLimit spares only the service identity", () => {
    const user: AppIdentity = {
      subject: "user_1",
      tokenIdentifier: "token",
      isBypass: false,
    };
    expect(readerLimit(user, 1000)).toBe(200);
    expect(readerLimit(user, 50)).toBe(50);
    expect(readerLimit({ ...user, isBypass: true }, 1000)).toBe(1000);
    expect(readerLimit({ ...user, subject: "system" }, 1000)).toBe(1000);
  });
});
