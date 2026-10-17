import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import {
  AUTH_FAILURE_ALERT_MARKER,
  AUTH_FAILURE_ALERT_THRESHOLD,
  AUTH_FAILURE_LOG_MARKER,
  AUTH_FAILURE_RETENTION_MS,
  AUTH_FAILURE_USER_AGENT_MAX,
  boundedLabel,
  classifyBypassRejection,
  windowStartFor,
} from "./shared/authFailures";

// Synthetic values only; the assertions prove neither reaches a row or log.
const AGENT_SECRET = "synthetic-agent-tool-secret-for-tests";
const BYPASS_SECRET = "synthetic-bypass-secret-for-tests";
const STALE_SECRET = "synthetic-stale-pre-rotation-secret";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function rows(t: ReturnType<typeof convexTest>) {
  return t.run((ctx) => ctx.db.query("authFailureCounters").collect());
}

function postTool(
  t: ReturnType<typeof convexTest>,
  name: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return t.fetch(`/agent-tools/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function logged(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
}

describe("auth failure contract", () => {
  test("labels are printable, single-spaced, bounded, and never empty", () => {
    expect(boundedLabel("a\u0000b\n\tc  d", 80)).toBe("a b c d");
    expect(boundedLabel("x".repeat(200), 10)).toBe("x".repeat(10));
    expect(boundedLabel("", 10)).toBe("unknown");
    expect(boundedLabel(undefined, 10)).toBe("unknown");
  });

  test("an absent bypass secret is not a bypass attempt", () => {
    expect(
      classifyBypassRejection({ provided: undefined, enabled: true }),
    ).toBe(null);
    expect(classifyBypassRejection({ provided: "", enabled: true })).toBe(
      "missing_secret",
    );
    expect(classifyBypassRejection({ provided: "x", enabled: true })).toBe(
      "secret_mismatch",
    );
    expect(classifyBypassRejection({ provided: "x", enabled: false })).toBe(
      "bypass_disabled",
    );
  });
});

describe("/agent-tools/* rejections", () => {
  test("a stale secret is refused and counted without secret material", async () => {
    vi.stubEnv("AGENT_TOOL_SECRET", AGENT_SECRET);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    const response = await postTool(
      t,
      "countPendingDrafts",
      { secret: STALE_SECRET, kind: "hypothesis_draft" },
      { "user-agent": `stale-cron/1.0 ${"z".repeat(300)}` },
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });

    const [row, ...rest] = await rows(t);
    expect(rest).toEqual([]);
    expect(row).toMatchObject({
      surface: "agent_tool",
      reason: "secret_mismatch",
      operation: "http:countPendingDrafts",
      count: 1,
    });
    expect(row?.lastUserAgent?.startsWith("stale-cron/1.0 ")).toBe(true);
    expect(row?.lastUserAgent?.length).toBe(AUTH_FAILURE_USER_AGENT_MAX);
    const serialized = JSON.stringify(row) + logged(warn);
    expect(serialized).not.toContain(STALE_SECRET);
    expect(serialized).not.toContain(AGENT_SECRET);
    expect(logged(warn)).toContain(
      `${AUTH_FAILURE_LOG_MARKER} surface=agent_tool reason=secret_mismatch operation=http:countPendingDrafts persisted=true`,
    );
  });

  test("a presented secret echoed in the User-Agent is redacted", async () => {
    vi.stubEnv("AGENT_TOOL_SECRET", AGENT_SECRET);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    const response = await postTool(
      t,
      "countPendingDrafts",
      { secret: STALE_SECRET, kind: "hypothesis_draft" },
      { "user-agent": `curl/8 key=${STALE_SECRET} again=${STALE_SECRET}` },
    );
    expect(response.status).toBe(403);
    const [row] = await rows(t);
    expect(row?.lastUserAgent).toBe("curl/8 key=[REDACTED] again=[REDACTED]");
  });

  test("a media lifecycle call without a secret is a media_tool rejection", async () => {
    vi.stubEnv("AGENT_TOOL_SECRET", AGENT_SECRET);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    const response = await postTool(t, "claimNextMediaJob", {
      workerId: "media",
    });
    expect(response.status).toBe(403);
    expect(await rows(t)).toMatchObject([
      {
        surface: "media_tool",
        reason: "missing_secret",
        operation: "http:claimNextMediaJob",
      },
    ]);
  });

  test("a server without AGENT_TOOL_SECRET records server_unconfigured", async () => {
    vi.stubEnv("AGENT_TOOL_SECRET", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    const response = await postTool(t, "countPendingDrafts", {
      secret: STALE_SECRET,
      kind: "hypothesis_draft",
    });
    expect(response.status).toBe(403);
    expect(await rows(t)).toMatchObject([{ reason: "server_unconfigured" }]);
  });

  test("an accepted call records nothing", async () => {
    vi.stubEnv("AGENT_TOOL_SECRET", AGENT_SECRET);
    vi.stubEnv("FREQUENCY_WORKER_CLAIMS_PAUSED", "true");
    const t = convexTest(schema, modules);
    const response = await postTool(t, "claimNextPendingRun", {
      secret: AGENT_SECRET,
      workerId: "worker",
    });
    expect(response.status).toBe(200);
    expect(await rows(t)).toEqual([]);
  });

  test("repeated rejections share one hourly row and alert exactly once", async () => {
    vi.stubEnv("AGENT_TOOL_SECRET", AGENT_SECRET);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    const attempts = AUTH_FAILURE_ALERT_THRESHOLD + 2;
    for (let i = 0; i < attempts; i++) {
      // Two tools: the alert threshold is per surface, not per operation.
      const name = i % 2 === 0 ? "countPendingDrafts" : "listActiveTheses";
      const response = await postTool(t, name, {
        secret: STALE_SECRET,
        kind: "hypothesis_draft",
        limit: 1,
      });
      expect(response.status).toBe(403);
    }
    const counters = await rows(t);
    expect(counters).toHaveLength(2);
    expect(counters.reduce((sum, row) => sum + row.count, 0)).toBe(attempts);
    const alerts = error.mock.calls
      .map((call) => String(call[0]))
      .filter((line) => line.startsWith(AUTH_FAILURE_ALERT_MARKER));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain("surface=agent_tool");
    expect(alerts[0]).toContain(`rejections=${AUTH_FAILURE_ALERT_THRESHOLD}`);
    expect(alerts[0]).not.toContain(STALE_SECRET);
  });
});

describe("alert emission", () => {
  test("the counter mutation never logs; only its committed caller alerts", async () => {
    // Convex keeps console output from attempts that lose an OCC race, so an
    // alert written inside the mutation could repeat.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    const results = [];
    for (let i = 0; i < AUTH_FAILURE_ALERT_THRESHOLD; i++)
      results.push(
        await t.mutation(internal.authFailures.record, {
          surface: "agent_tool",
          reason: "secret_mismatch",
          operation: "http:countPendingDrafts",
        }),
      );
    expect(error).not.toHaveBeenCalled();
    expect(results.map((r) => r.surfaceTotal)).toEqual([1, 2, 3]);
    expect(new Set(results.map((r) => r.windowStart)).size).toBe(1);
  });
});

describe("agent-tool action rejections", () => {
  test("a direct action call with a stale secret is refused and counted", async () => {
    vi.stubEnv("AGENT_TOOL_SECRET", AGENT_SECRET);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    await expect(
      t.action(api.agentTools.countPendingDrafts, {
        agentSecret: STALE_SECRET,
        kind: "hypothesis_draft",
      } as { agentSecret: string }),
    ).rejects.toThrow(/Invalid agent tool secret/);
    expect(await rows(t)).toMatchObject([
      {
        surface: "agent_tool",
        reason: "secret_mismatch",
        operation: "action:countPendingDrafts",
        count: 1,
      },
    ]);
  });

  test("a transactional proposal rejection is logged, not persisted", async () => {
    vi.stubEnv("AGENT_TOOL_SECRET", AGENT_SECRET);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    const feedId = await t.run((ctx) =>
      ctx.db.insert("feeds", {
        name: "Feed",
        url: "https://example.com/rss",
        type: "rss",
        enabled: false,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await expect(
      t.mutation(api.decisionIntents.propose, {
        secret: STALE_SECRET,
        command: {
          action: "enableFeed",
          target: { kind: "feedProposal", id: feedId },
          payload: {},
        },
        proposal: {
          channel: "telegram",
          conversationId: "chat",
          messageRef: "voice",
          transcript: "Enable this feed",
        },
      }),
    ).rejects.toThrow(/Invalid agent tool secret/);
    expect(await rows(t)).toEqual([]);
    expect(logged(warn)).toContain(
      `${AUTH_FAILURE_LOG_MARKER} surface=agent_tool reason=secret_mismatch operation=mutation:decisionIntents.propose persisted=false`,
    );
    expect(logged(warn)).not.toContain(STALE_SECRET);
  });
});

describe("devBypassSecret rejections", () => {
  test("a stale bypass secret on a mutation is logged; the transaction stays empty", async () => {
    vi.stubEnv("AUTH_BYPASS_ENABLED", "true");
    vi.stubEnv("AUTH_BYPASS_SECRET", BYPASS_SECRET);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("sources", {
        type: "url",
        canonicalUrl: "https://example.test/a",
        dedupeKey: "url:https://example.test/a",
        status: "ingested",
        visibility: "private",
        createdBy: "system",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await expect(
      t.mutation(api.sources.updateText, {
        id,
        rawText: "text",
        devBypassSecret: STALE_SECRET,
      }),
    ).rejects.toThrow(/Authentication required/);
    expect(await rows(t)).toEqual([]);
    expect(logged(warn)).toContain(
      `${AUTH_FAILURE_LOG_MARKER} surface=bypass reason=secret_mismatch operation=requireAuth:transaction persisted=false`,
    );
    expect(logged(warn)).not.toContain(STALE_SECRET);
    expect(logged(warn)).not.toContain(BYPASS_SECRET);
  });

  test("a stale bypass secret on an action is counted", async () => {
    vi.stubEnv("AUTH_BYPASS_ENABLED", "true");
    vi.stubEnv("AUTH_BYPASS_SECRET", BYPASS_SECRET);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    await expect(
      t.action(api.admin.pollFeedsNow, { devBypassSecret: STALE_SECRET }),
    ).rejects.toThrow(/Authentication required/);
    expect(await rows(t)).toMatchObject([
      {
        surface: "bypass",
        reason: "secret_mismatch",
        operation: "requireAuth:action",
        count: 1,
      },
    ]);
  });

  test("a presented secret while bypass is disabled is bypass_disabled", async () => {
    vi.stubEnv("AUTH_BYPASS_ENABLED", "false");
    vi.stubEnv("AUTH_BYPASS_SECRET", BYPASS_SECRET);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    await expect(
      t.action(api.admin.pollFeedsNow, { devBypassSecret: BYPASS_SECRET }),
    ).rejects.toThrow(/Authentication required/);
    expect(await rows(t)).toMatchObject([{ reason: "bypass_disabled" }]);
  });

  test("an anonymous call without a bypass secret is not a bypass failure", async () => {
    vi.stubEnv("AUTH_BYPASS_ENABLED", "true");
    vi.stubEnv("AUTH_BYPASS_SECRET", BYPASS_SECRET);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    await expect(t.action(api.admin.pollFeedsNow, {})).rejects.toThrow(
      /Authentication required/,
    );
    expect(await rows(t)).toEqual([]);
    expect(logged(warn)).not.toContain(AUTH_FAILURE_LOG_MARKER);
  });
});

describe("authFailureCounters retention and summary", () => {
  test("a new bucket prunes rows past retention", async () => {
    const t = convexTest(schema, modules);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const expired = windowStartFor(Date.now() - AUTH_FAILURE_RETENTION_MS) - 1;
    await t.run((ctx) =>
      ctx.db.insert("authFailureCounters", {
        windowStart: windowStartFor(expired),
        surface: "agent_tool",
        reason: "secret_mismatch",
        operation: "http:old",
        count: 9,
        firstAt: expired,
        lastAt: expired,
      }),
    );
    await t.mutation(internal.authFailures.record, {
      surface: "bypass",
      reason: "secret_mismatch",
      operation: "requireAuth:action",
    });
    expect((await rows(t)).map((row) => row.operation)).toEqual([
      "requireAuth:action",
    ]);
  });

  test("the summary requires authentication and reports alerting surfaces", async () => {
    vi.stubEnv("AUTH_BYPASS_ENABLED", "true");
    vi.stubEnv("AUTH_BYPASS_SECRET", BYPASS_SECRET);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = convexTest(schema, modules);
    for (let i = 0; i < AUTH_FAILURE_ALERT_THRESHOLD; i++) {
      await t.mutation(internal.authFailures.record, {
        surface: "media_tool",
        reason: "secret_mismatch",
        operation: "http:claimNextMediaJob",
      });
    }
    await t.mutation(internal.authFailures.record, {
      surface: "agent_tool",
      reason: "missing_secret",
      operation: "http:countPendingDrafts",
    });
    await expect(t.query(api.authFailures.summary, {})).rejects.toThrow(
      /Authentication required/,
    );
    const summary = await t.query(api.authFailures.summary, {
      devBypassSecret: BYPASS_SECRET,
    });
    expect(summary.threshold).toBe(AUTH_FAILURE_ALERT_THRESHOLD);
    expect(summary.alertingSurfaces).toEqual(["media_tool"]);
    expect(summary.totals).toEqual({
      bypass: 0,
      agent_tool: 1,
      media_tool: AUTH_FAILURE_ALERT_THRESHOLD,
    });
    expect(summary.counters).toHaveLength(2);
    expect(summary.countersTruncated).toBe(false);
  });

  test("totals and alerts cover every bucket even when details are capped", async () => {
    vi.stubEnv("AUTH_BYPASS_ENABLED", "true");
    vi.stubEnv("AUTH_BYPASS_SECRET", BYPASS_SECRET);
    const t = convexTest(schema, modules);
    const now = windowStartFor(Date.now());
    await t.run(async (ctx) => {
      // The oldest hour holds the only media_tool burst; 250 newer agent_tool
      // buckets would push it out of a capped read.
      await ctx.db.insert("authFailureCounters", {
        windowStart: now - 22 * 60 * 60 * 1000,
        surface: "media_tool",
        reason: "secret_mismatch",
        operation: "http:claimNextMediaJob",
        count: AUTH_FAILURE_ALERT_THRESHOLD,
        firstAt: now,
        lastAt: now,
      });
      for (let i = 0; i < 250; i++)
        await ctx.db.insert("authFailureCounters", {
          windowStart: now - (i % 20) * 60 * 60 * 1000,
          surface: "agent_tool",
          reason: "secret_mismatch",
          operation: `http:tool${i}`,
          count: 1,
          firstAt: now,
          lastAt: now,
        });
    });
    const summary = await t.query(api.authFailures.summary, {
      devBypassSecret: BYPASS_SECRET,
    });
    expect(summary.totals).toEqual({
      bypass: 0,
      agent_tool: 250,
      media_tool: AUTH_FAILURE_ALERT_THRESHOLD,
    });
    expect(summary.alertingSurfaces).toEqual(["agent_tool", "media_tool"]);
    expect(summary.counters).toHaveLength(200);
    expect(summary.countersTruncated).toBe(true);
  });
});
