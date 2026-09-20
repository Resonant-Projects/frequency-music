import { EventEmitter } from "node:events";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import {
  createLivenessReporter,
  LIVENESS_PUSH_INTERVAL_MS,
  LIVENESS_STALE_AFTER_MS,
  parseLivenessPushUrl,
} from "../src/worker/liveness";
import { runWorkerLoop } from "../src/worker/lifecycle";
import { HEARTBEAT_INTERVAL_MS } from "../../convex/shared/agentContract";

const PUSH_URL = "https://uptime.example/api/push/secret-token";

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

function reporter(overrides: Record<string, unknown> = {}) {
  let clock = 0;
  const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
  const log = vi.fn();
  const instance = createLivenessReporter({
    pushUrl: new URL(PUSH_URL),
    log,
    redact: (error) => String(error),
    now: () => clock,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    ...overrides,
  });
  return {
    instance,
    fetchImpl,
    log,
    advance: async (ms: number) => {
      clock += ms;
      await vi.advanceTimersByTimeAsync(ms);
    },
  };
}

describe("liveness reporter", () => {
  test("pushes on the declared interval while progress is fresh", async () => {
    vi.useFakeTimers();
    const r = reporter();
    expect(r.fetchImpl).not.toHaveBeenCalled();

    await r.advance(LIVENESS_PUSH_INTERVAL_MS);
    expect(r.fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(r.fetchImpl.mock.calls[0]?.[0])).toBe(PUSH_URL);

    r.instance.markAlive();
    await r.advance(LIVENESS_PUSH_INTERVAL_MS);
    expect(r.fetchImpl).toHaveBeenCalledTimes(2);
    await r.instance.stop();
  });

  test("withholds pushes once progress goes stale, rather than pushing down", async () => {
    vi.useFakeTimers();
    const r = reporter();

    // Never mark alive again: progress ages past the threshold.
    await r.advance(LIVENESS_STALE_AFTER_MS + LIVENESS_PUSH_INTERVAL_MS);
    const pushesWhileFresh = r.fetchImpl.mock.calls.length;

    await r.advance(LIVENESS_PUSH_INTERVAL_MS * 3);
    expect(r.fetchImpl).toHaveBeenCalledTimes(pushesWhileFresh);
    expect(r.log.mock.calls.flat().join(" ")).toContain("withholding pushes");
    await r.instance.stop();
  });

  test("resumes pushing when progress returns", async () => {
    vi.useFakeTimers();
    const r = reporter();
    await r.advance(LIVENESS_STALE_AFTER_MS + LIVENESS_PUSH_INTERVAL_MS * 2);
    const stalled = r.fetchImpl.mock.calls.length;

    r.instance.markAlive();
    await r.advance(LIVENESS_PUSH_INTERVAL_MS);
    expect(r.fetchImpl.mock.calls.length).toBe(stalled + 1);
    expect(r.log.mock.calls.flat().join(" ")).toContain("progress resumed");
    await r.instance.stop();
  });

  // The regression this design exists for: a claimed run blocks the poll loop
  // for as long as the graph takes, so poll settles cannot carry liveness.
  test("a busy run kept alive only by run heartbeats keeps pushing", async () => {
    vi.useFakeTimers();
    const r = reporter();

    // Simulate four run-heartbeat intervals with no poll ever settling.
    for (let i = 0; i < 4; i += 1) {
      await r.advance(HEARTBEAT_INTERVAL_MS);
      r.instance.markAlive();
    }
    await r.advance(LIVENESS_PUSH_INTERVAL_MS);

    expect(r.log.mock.calls.flat().join(" ")).not.toContain("withholding");
    expect(r.fetchImpl.mock.calls.length).toBeGreaterThan(0);
    await r.instance.stop();
  });

  test("stale threshold clears the run-heartbeat interval", () => {
    expect(LIVENESS_STALE_AFTER_MS).toBeGreaterThan(HEARTBEAT_INTERVAL_MS);
  });

  test("a failing push is swallowed and never logs the token", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => {
      throw new Error(`connect ECONNREFUSED ${PUSH_URL}`);
    });
    const r = reporter({
      fetchImpl,
      redact: () => "connect ECONNREFUSED <redacted>",
    });

    await r.advance(LIVENESS_PUSH_INTERVAL_MS);
    const logged = r.log.mock.calls.flat().join(" ");
    expect(logged).toContain("liveness push failed");
    expect(logged).not.toContain("secret-token");
    await r.instance.stop();
  });

  test("a non-ok response is reported without the token", async () => {
    vi.useFakeTimers();
    const r = reporter({
      fetchImpl: vi.fn(async () => ({ ok: false, status: 404 }) as Response),
    });
    await r.advance(LIVENESS_PUSH_INTERVAL_MS);
    const logged = r.log.mock.calls.flat().join(" ");
    expect(logged).toContain("404");
    expect(logged).not.toContain("secret-token");
    await r.instance.stop();
  });

  test("stop halts further pushes", async () => {
    vi.useFakeTimers();
    const r = reporter();
    await r.advance(LIVENESS_PUSH_INTERVAL_MS);
    const before = r.fetchImpl.mock.calls.length;
    await r.instance.stop();
    await r.advance(LIVENESS_PUSH_INTERVAL_MS * 3);
    expect(r.fetchImpl.mock.calls.length).toBe(before);
  });
});

// The push URL's path is the monitor's token, so a cleartext scheme would put
// that token on the wire.
describe("parseLivenessPushUrl", () => {
  test("accepts an https URL", () => {
    expect(parseLivenessPushUrl(PUSH_URL)?.href).toBe(PUSH_URL);
  });

  test("rejects http, so the token is never sent in cleartext", () => {
    expect(
      parseLivenessPushUrl("http://uptime.example/api/push/tok"),
    ).toBeNull();
  });

  test("rejects other schemes and unparseable values", () => {
    expect(parseLivenessPushUrl("ftp://uptime.example/push/tok")).toBeNull();
    expect(parseLivenessPushUrl("uptime.example/api/push/tok")).toBeNull();
    expect(parseLivenessPushUrl("")).toBeNull();
  });
});

describe("runWorkerLoop onPollSettled", () => {
  test("fires after a poll that claimed nothing and after a poll that threw", async () => {
    const signals = new EventEmitter();
    const onPollSettled = vi.fn();
    const onPollError = vi.fn();
    let calls = 0;
    const loop = runWorkerLoop({
      poll: async () => {
        calls += 1;
        if (calls === 1) return false;
        if (calls === 2) throw new Error("poll exploded");
        signals.emit("SIGTERM");
        return false;
      },
      pollIntervalMs: 0,
      signals,
      log: vi.fn(),
      onPollError,
      onPollSettled,
    });
    await loop;
    expect(onPollError).toHaveBeenCalledTimes(1);
    // One per attempt, including the throwing one.
    expect(onPollSettled.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  test("is optional", async () => {
    const signals = new EventEmitter();
    const loop = runWorkerLoop({
      poll: async () => {
        signals.emit("SIGTERM");
        return false;
      },
      pollIntervalMs: 0,
      signals,
      log: vi.fn(),
      onPollError: vi.fn(),
    });
    await expect(loop).resolves.toBeUndefined();
  });
});
