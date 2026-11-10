import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { asWriter, seedUser } from "./testHelpers";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function seedHypothesis(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) =>
    ctx.db.insert("hypotheses", {
      title: "Role gate",
      question: "Who may delete this?",
      hypothesis: "Only a writer may delete it.",
      rationaleMd: "The role gate decides.",
      sourceIds: [],
      status: "active",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
}

async function hypothesisExists(
  t: ReturnType<typeof convexTest>,
  id: Awaited<ReturnType<typeof seedHypothesis>>,
) {
  return (await t.run((ctx) => ctx.db.get(id))) !== null;
}

describe("writer gate", () => {
  test("rejects a caller with no identity and no secret", async () => {
    vi.stubEnv("AUTH_BYPASS_ENABLED", "false");
    const t = convexTest(schema, modules);
    const id = await seedHypothesis(t);
    await expect(t.mutation(api.hypotheses.deleteById, { id })).rejects.toThrow(
      "UNAUTHORIZED",
    );
    expect(await hypothesisExists(t, id)).toBe(true);
  });

  test("rejects a signed-in user with no users row", async () => {
    const t = convexTest(schema, modules);
    const id = await seedHypothesis(t);
    await expect(
      t
        .withIdentity({ subject: "user_stranger" })
        .mutation(api.hypotheses.deleteById, { id }),
    ).rejects.toThrow("FORBIDDEN");
    expect(await hypothesisExists(t, id)).toBe(true);
  });

  test("rejects a follower", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "user_follower", "follower");
    const id = await seedHypothesis(t);
    await expect(
      t
        .withIdentity({ subject: "user_follower" })
        .mutation(api.hypotheses.deleteById, { id }),
    ).rejects.toThrow("FORBIDDEN");
    expect(await hypothesisExists(t, id)).toBe(true);
  });

  test("lets a collaborator write", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "user_collaborator", "collaborator");
    const id = await seedHypothesis(t);
    await t
      .withIdentity({ subject: "user_collaborator" })
      .mutation(api.hypotheses.deleteById, { id });
    expect(await hypothesisExists(t, id)).toBe(false);
  });

  test("lets an admin write", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "user_admin", "admin");
    const id = await seedHypothesis(t);
    await t
      .withIdentity({ subject: "user_admin" })
      .mutation(api.hypotheses.deleteById, { id });
    expect(await hypothesisExists(t, id)).toBe(false);
  });

  test("lets the service identity write with a valid bypass secret", async () => {
    vi.stubEnv("AUTH_BYPASS_ENABLED", "true");
    vi.stubEnv("AUTH_BYPASS_SECRET", "bypass");
    const t = convexTest(schema, modules);
    const id = await seedHypothesis(t);
    await t.mutation(api.hypotheses.deleteById, {
      id,
      devBypassSecret: "bypass",
    });
    expect(await hypothesisExists(t, id)).toBe(false);
  });

  test("rejects a follower calling an action", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "user_follower", "follower");
    await expect(
      t
        .withIdentity({ subject: "user_follower" })
        .action(api.sources.createFromUrlAndQueue, {
          url: "https://example.org/role-gate",
        }),
    ).rejects.toThrow("FORBIDDEN");
    expect(await t.run((ctx) => ctx.db.query("sources").collect())).toEqual([]);
  });
});

describe("users module", () => {
  test("viewer reports no viewer, an unmapped follower, and a mapped role", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.users.viewer, {})).toBeNull();
    expect(
      await t
        .withIdentity({ subject: "user_unmapped" })
        .query(api.users.viewer, {}),
    ).toEqual({ userId: null, role: "follower" });
    const userId = await seedUser(t, "user_mapped", "admin");
    expect(
      await t
        .withIdentity({ subject: "user_mapped" })
        .query(api.users.viewer, {}),
    ).toEqual({ userId, role: "admin" });
  });

  test("setRole inserts a row, then updates its role in place", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.users.setRole, {
      clerkUserId: "user_granted",
      role: "follower",
    });
    const second = await t.mutation(internal.users.setRole, {
      clerkUserId: "user_granted",
      role: "collaborator",
    });
    expect(second).toBe(first);
    const rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clerkUserId: "user_granted",
      role: "collaborator",
    });
    expect(
      await t.query(internal.users.roleBySubject, {
        clerkUserId: "user_granted",
      }),
    ).toBe("collaborator");
  });
});

type Client = Pick<
  ReturnType<typeof convexTest>,
  "query" | "mutation" | "action"
>;

/** "ok", or the gate's error code when the call is refused. */
const settle = (call: Promise<unknown>) =>
  call.then(
    () => "ok",
    (error) => /FORBIDDEN|UNAUTHORIZED/.exec(String(error))?.[0] ?? error,
  );

/** Runs one query, one mutation and one action that each call requireAuth. */
async function gateOutcomes(
  t: ReturnType<typeof convexTest>,
  client: Client,
  extra: { devBypassSecret?: string } = {},
) {
  const id = await seedHypothesis(t);
  return {
    query: await settle(client.query(api.settings.houseVoice, extra)),
    mutation: await settle(
      client.mutation(api.hypotheses.deleteById, { id, ...extra }),
    ),
    action: await settle(client.action(api.ingest.pollAllFeeds, extra)),
  };
}

const readOnly = { query: "ok", mutation: "FORBIDDEN", action: "FORBIDDEN" };
const fullAccess = { query: "ok", mutation: "ok", action: "ok" };

describe("requireAuth picks the gate from the context", () => {
  test("a signed-in user with no users row may query but not mutate or act", async () => {
    const t = convexTest(schema, modules);
    expect(
      await gateOutcomes(t, t.withIdentity({ subject: "user_stranger" })),
    ).toEqual(readOnly);
  });

  test("a follower row gets the same reader-only access as no row", async () => {
    const t = convexTest(schema, modules);
    const follower = await asWriter(t, "user_follower", "follower");
    expect(await gateOutcomes(t, follower)).toEqual(readOnly);
  });

  test.each(["collaborator", "admin"] as const)(
    "a %s may query, mutate and act",
    async (role) => {
      const t = convexTest(schema, modules);
      const writer = await asWriter(t, `user_${role}`, role);
      expect(await gateOutcomes(t, writer)).toEqual(fullAccess);
    },
  );

  test("the service secret may query, mutate and act", async () => {
    vi.stubEnv("AUTH_BYPASS_ENABLED", "true");
    vi.stubEnv("AUTH_BYPASS_SECRET", "bypass");
    const t = convexTest(schema, modules);
    expect(await gateOutcomes(t, t, { devBypassSecret: "bypass" })).toEqual(
      fullAccess,
    );
  });

  test("the system subject may query, mutate and act", async () => {
    const t = convexTest(schema, modules);
    expect(
      await gateOutcomes(t, t.withIdentity({ subject: "system" })),
    ).toEqual(fullAccess);
  });

  test("no identity and no secret is refused by every gate", async () => {
    vi.stubEnv("AUTH_BYPASS_ENABLED", "false");
    const t = convexTest(schema, modules);
    expect(await gateOutcomes(t, t)).toEqual({
      query: "UNAUTHORIZED",
      mutation: "UNAUTHORIZED",
      action: "UNAUTHORIZED",
    });
  });
});
