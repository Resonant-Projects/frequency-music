import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { internal } from "../../convex/_generated/api";
import { signerDeliveryEnabled } from "../../convex/decisionSignerRuntime";
import schema from "../../convex/schema";
import { modules } from "../../harness/modules";
import {
  assessSignerConfiguration,
  backfillOutcome,
  describeBackfillPlan,
  initialBackfillState,
  parseBackfillState,
  runRevisionBackfill,
  type BackfillCall,
  type BackfillState,
} from "./wave2-rollout";

const TARGET = "https://convex.resonantprojects.art";
const discord = {
  DECISION_DISCORD_BOT_TOKEN: "discord-token-value",
  DECISION_DISCORD_CHANNEL_ID: "112233445566778899",
  DECISION_DISCORD_APPLICATION_ID: "998877665544332211",
  DECISION_DISCORD_PUBLIC_KEY: "ab".repeat(32),
};
const telegram = {
  DECISION_TELEGRAM_BOT_TOKEN: "12345:telegram_token-value",
  DECISION_TELEGRAM_CHAT_ID: "-100200300",
  DECISION_TELEGRAM_PATH_SECRET: "path_secret-value",
  DECISION_TELEGRAM_HEADER_SECRET: "header_secret-value",
};
const mapping = JSON.stringify({
  "discord:111": "user-discord",
  "telegram:222": "user-telegram",
});
const complete = {
  DECISION_SIGNERS_ENABLED: "true",
  DECISION_SIGNERS: mapping,
  ...discord,
  ...telegram,
};

afterEach(() => vi.unstubAllEnvs());

describe("signer readiness", () => {
  test("defaults are disabled and report every missing setting", () => {
    const report = assessSignerConfiguration({});
    expect(report.signersEnabled).toBe(false);
    expect(report.docketPreparationEnabled).toBe(false);
    expect(report.platforms.discord).toEqual({
      ready: false,
      mappedSigners: 0,
      missing: [...Object.keys(discord), "DECISION_SIGNERS"],
      invalid: [],
    });
    expect(report.platforms.telegram.missing).toContain("DECISION_SIGNERS");
  });

  test("never copies a configuration value into the report", () => {
    const serialized = JSON.stringify(
      assessSignerConfiguration({
        ...complete,
        DECISION_TELEGRAM_CHAT_ID: "not-a-number",
      }),
    );
    for (const value of [
      ...Object.values(discord),
      ...Object.values(telegram),
      "not-a-number",
      "user-discord",
      "111",
    ])
      expect(serialized).not.toContain(value);
    expect(serialized).toContain("DECISION_TELEGRAM_CHAT_ID");
  });

  const cases: Array<[string, Record<string, string>]> = [
    ["complete", complete],
    ["activation off", { ...complete, DECISION_SIGNERS_ENABLED: "false" }],
    [
      "activation not exactly true",
      { ...complete, DECISION_SIGNERS_ENABLED: "TRUE" },
    ],
    ["malformed mapping", { ...complete, DECISION_SIGNERS: "{" }],
    ["array mapping", { ...complete, DECISION_SIGNERS: '["discord:1"]' }],
    [
      "empty mapped user",
      {
        ...complete,
        DECISION_SIGNERS: JSON.stringify({ "discord:1": "", "telegram:2": 3 }),
      },
    ],
    ["short public key", { ...complete, DECISION_DISCORD_PUBLIC_KEY: "ab" }],
    ["zero channel", { ...complete, DECISION_DISCORD_CHANNEL_ID: "0" }],
    ["bad telegram token", { ...complete, DECISION_TELEGRAM_BOT_TOKEN: "abc" }],
    ["zero chat", { ...complete, DECISION_TELEGRAM_CHAT_ID: "0" }],
    ["padded chat", { ...complete, DECISION_TELEGRAM_CHAT_ID: "007" }],
    [
      "slash in path secret",
      { ...complete, DECISION_TELEGRAM_PATH_SECRET: "a/b" },
    ],
    [
      "missing header secret",
      { ...complete, DECISION_TELEGRAM_HEADER_SECRET: "" },
    ],
  ];
  test.each(cases)("matches runtime activation: %s", (_name, env) => {
    const report = assessSignerConfiguration(env);
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    expect(report.platforms.discord.ready).toBe(
      signerDeliveryEnabled({
        channel: "discord",
        conversationId: discord.DECISION_DISCORD_CHANNEL_ID,
      }),
    );
    expect(report.platforms.telegram.ready).toBe(
      signerDeliveryEnabled({
        channel: "telegram",
        conversationId: telegram.DECISION_TELEGRAM_CHAT_ID,
      }),
    );
  });

  test("counts ignored mapping entries without echoing them", () => {
    const report = assessSignerConfiguration({
      DECISION_SIGNERS: JSON.stringify({
        "discord:1": "u",
        "slack:2": "u",
        "telegram:3": 7,
      }),
    });
    expect(report.mapping).toEqual({ parsed: true, ignoredEntries: 2 });
    expect(report.platforms.discord.mappedSigners).toBe(1);
  });
});

async function seed() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (let i = 0; i < 5; i++)
      await ctx.db.insert("feeds", {
        name: `Feed ${i}`,
        url: `https://example.test/${i}`,
        type: "rss",
        enabled: false,
        createdAt: 1,
        updatedAt: 1,
        ...(i === 2 ? { revision: 7 } : {}),
      });
    const runId = await ctx.db.insert("agentRuns", {
      graphName: "test",
      status: "needs_review",
      input: null,
      createdAt: 1,
      updatedAt: 1,
    });
    for (let i = 0; i < 3; i++)
      await ctx.db.insert("agentReviewDrafts", {
        agentRunId: runId,
        graphName: "test",
        kind: "hypothesis_draft",
        title: `Draft ${i}`,
        summary: "Summary",
        candidateIds: [],
        status: "pending_review",
        createdBy: "agent",
        createdAt: 1,
        updatedAt: 1,
      });
  });
  const call: BackfillCall = (args) =>
    t.mutation(internal.decisionIntentsMigrations.backfillRevisions, args);
  const revisions = () =>
    t.run(async (ctx) => ({
      feeds: (await ctx.db.query("feeds").collect()).map((row) => row.revision),
      drafts: (await ctx.db.query("agentReviewDrafts").collect()).map(
        (row) => row.revision,
      ),
    }));
  return { t, call, revisions };
}

describe("revision backfill driver", () => {
  test("resumes from a serialized checkpoint and verifies with zero updates", async () => {
    const { call, revisions } = await seed();
    const checkpoints: string[] = [];
    const checkpoint = (state: BackfillState) => {
      checkpoints.push(JSON.stringify(state));
    };
    const partial = await runRevisionBackfill({
      state: initialBackfillState(TARGET, 2),
      call,
      checkpoint,
      maxPages: 2,
    });
    expect(backfillOutcome(partial).complete).toBe(false);
    // One checkpoint before and one after each page.
    expect(checkpoints).toHaveLength(4);
    expect(describeBackfillPlan(partial).nextStep).toMatchObject({
      function: "decisionIntentsMigrations:backfillRevisions",
      phase: "backfill",
      args: { table: "feeds", batchSize: 2 },
    });
    const resumed = await runRevisionBackfill({
      state: parseBackfillState(JSON.parse(checkpoints.at(-1)!), TARGET),
      call,
      checkpoint,
    });
    const outcome = backfillOutcome(resumed);
    expect(outcome).toMatchObject({ complete: true, verified: true });
    expect(outcome.tables.feeds).toMatchObject({
      backfilled: 4,
      verifyUpdated: 0,
    });
    expect(outcome.tables.agentReviewDrafts.backfilled).toBe(3);
    expect(await revisions()).toEqual({
      feeds: [0, 0, 7, 0, 0],
      drafts: [0, 0, 0],
    });
  });

  test("an interrupted page resumes from the last committed cursor", async () => {
    const { call, revisions } = await seed();
    let saved = initialBackfillState(TARGET, 2);
    let calls = 0;
    const flaky: BackfillCall = async (args) => {
      if (++calls === 2) throw new Error("connection reset");
      return call(args);
    };
    await expect(
      runRevisionBackfill({
        state: saved,
        call: flaky,
        checkpoint: (state) => {
          saved = structuredClone(state);
        },
      }),
    ).rejects.toThrow("connection reset");
    expect(saved.tables.feeds.backfill.pages).toBe(1);
    const done = await runRevisionBackfill({
      state: saved,
      call,
      checkpoint: () => {},
    });
    expect(backfillOutcome(done).verified).toBe(true);
    expect((await revisions()).feeds).toEqual([0, 0, 7, 0, 0]);
  });

  test("a lost verification response restarts that verification pass", async () => {
    const { t, call } = await seed();
    let saved = await runRevisionBackfill({
      state: initialBackfillState(TARGET, 2),
      call,
      checkpoint: () => {},
      maxPages: 3,
    });
    expect(saved.tables.feeds.backfill.done).toBe(true);
    // Advance the feeds verification pass by one clean page.
    saved = await runRevisionBackfill({
      state: saved,
      call,
      checkpoint: () => {},
      maxPages: 1,
    });
    expect(saved.tables.feeds.verify).toMatchObject({ pages: 1, updated: 0 });
    // A row in the second page loses its revision; the next verification page
    // fixes it, then the response is lost before its count is checkpointed.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("feeds").collect();
      const { _id, _creationTime, revision: _revision, ...rest } = rows[3]!;
      await ctx.db.replace(_id, rest);
    });
    const lost: BackfillCall = async (args) => {
      await call(args);
      throw new Error("response lost");
    };
    await expect(
      runRevisionBackfill({
        state: saved,
        call: lost,
        checkpoint: (state) => {
          saved = structuredClone(state);
        },
      }),
    ).rejects.toThrow("response lost");
    expect(saved.tables.feeds.verify).toMatchObject({
      pending: true,
      pages: 1,
    });
    expect(describeBackfillPlan(saved).nextStep).toMatchObject({
      phase: "verify",
      args: { table: "feeds", cursor: null },
    });
    const done = await runRevisionBackfill({
      state: saved,
      call,
      checkpoint: () => {},
    });
    // The restarted pass covers every feed from the beginning.
    expect(done.tables.feeds.verify).toMatchObject({
      updated: 0,
      pending: false,
      done: true,
    });
    expect(done.tables.feeds.verify.pages).toBeGreaterThanOrEqual(3);
    expect(backfillOutcome(done).verified).toBe(true);
  });

  test("verification fails when legacy rows appear after the backfill pass", async () => {
    const { t, call } = await seed();
    let state = initialBackfillState(TARGET, 100);
    // Finish only the feeds backfill pass.
    state = await runRevisionBackfill({
      state,
      call,
      checkpoint: () => {},
      maxPages: 1,
    });
    await t.run((ctx) =>
      ctx.db.insert("feeds", {
        name: "Late legacy",
        url: "https://example.test/late",
        type: "rss",
        enabled: false,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    state = await runRevisionBackfill({ state, call, checkpoint: () => {} });
    const outcome = backfillOutcome(state);
    expect(outcome.complete).toBe(true);
    expect(outcome.verified).toBe(false);
    expect(outcome.tables.feeds.verifyUpdated).toBe(1);
  });

  test("rejects invalid pages, stalled cursors and foreign state", async () => {
    const state = initialBackfillState(TARGET, 2);
    const run = (page: unknown) =>
      runRevisionBackfill({
        state,
        call: async () => page,
        checkpoint: () => {},
      });
    await expect(run({ cursor: "c", done: false, updated: 3 })).rejects.toThrow(
      "Invalid backfill page",
    );
    await expect(run({ cursor: 1, done: true, updated: 0 })).rejects.toThrow(
      "Invalid backfill page",
    );
    const stalled = { ...state, tables: structuredClone(state.tables) };
    stalled.tables.feeds.backfill.cursor = "same";
    await expect(
      runRevisionBackfill({
        state: stalled,
        call: async () => ({ cursor: "same", done: false, updated: 0 }),
        checkpoint: () => {},
      }),
    ).rejects.toThrow("did not advance");
    expect(() => parseBackfillState(state, "https://example.test")).toThrow(
      "does not match",
    );
    expect(() =>
      parseBackfillState({ ...state, batchSize: 500 }, TARGET),
    ).toThrow("does not match");
    expect(() => initialBackfillState(TARGET, 0)).toThrow("Batch size");
  });
});
