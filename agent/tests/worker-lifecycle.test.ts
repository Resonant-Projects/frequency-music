import { EventEmitter } from "node:events";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
const mocks = vi.hoisted(() => ({ callConvex: vi.fn(), stream: vi.fn() }));
vi.mock("../src/tools/convexTools.js", () => ({
  callConvex: mocks.callConvex,
}));
vi.mock("../src/graphs/research-pipeline/index.js", () => ({ graph: {} }));
vi.mock("../src/graphs/correspondence-miner/index.js", () => ({ graph: {} }));
vi.mock("../src/graphs/evidence-hunter/index.js", () => ({ graph: {} }));
vi.mock("../src/graphs/hypothesis-drafter/index.js", () => ({ graph: {} }));
vi.mock("../src/graphs/source-scout/index.js", () => ({ graph: {} }));
vi.mock("../src/agents/weekly-brief/index.js", () => ({
  agent: { stream: mocks.stream },
}));
vi.mock("../scripts/smoke-research-pipeline.js", () => ({
  loadRootEnvLocalForResearchSmoke: vi.fn(),
}));
import { runWorkerLoop } from "../src/worker/lifecycle";
import { pollOnce } from "../src/worker/runner";
import { HEARTBEAT_INTERVAL_MS } from "../../convex/shared/agentContract";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const claim = { runId: "synthetic-run", graphName: "weekly-brief", input: {} };
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
function start(poll = () => pollOnce("synthetic-worker")) {
  const signals = new EventEmitter();
  const log = vi.fn();
  const onPollError = vi.fn();
  const done = vi.fn();
  const loop = runWorkerLoop({
    poll,
    pollIntervalMs: 60_000,
    signals,
    log,
    onPollError,
  }).then(done);
  return { signals, log, onPollError, done, loop };
}
describe("worker graceful drain with synthetic queue and graph", () => {
  test("drains a late claim, graph effect, and terminal write once despite repeated signals", async () => {
    const pendingClaim = deferred<typeof claim>();
    const graphGate = deferred<void>();
    const terminalGate = deferred<void>();
    const graphStarted = deferred<void>();
    const terminalStarted = deferred<void>();
    let effects = 0;
    mocks.callConvex.mockImplementation(async (name: string) => {
      if (name === "claimNextPendingRun") return pendingClaim.promise;
      if (name === "markAgentRunCompleted") {
        terminalStarted.resolve();
        await terminalGate.promise;
      }
    });
    mocks.stream.mockImplementation(async function* () {
      graphStarted.resolve();
      await graphGate.promise;
      effects += 1;
      yield { agent: { messages: ["synthetic"] } };
    });
    const worker = start();
    worker.signals.emit("SIGTERM");
    pendingClaim.resolve(claim);
    await graphStarted.promise;
    worker.signals.emit("SIGINT");
    worker.signals.emit("SIGTERM");
    expect(worker.done).not.toHaveBeenCalled();
    expect(
      mocks.callConvex.mock.calls.some(
        ([name]) => name === "markAgentRunFailed",
      ),
    ).toBe(false);
    graphGate.resolve();
    await terminalStarted.promise;
    expect(worker.done).not.toHaveBeenCalled();
    terminalGate.resolve();
    await worker.loop;
    expect(effects).toBe(1);
    expect(mocks.stream).toHaveBeenCalledTimes(1);
    expect(
      mocks.callConvex.mock.calls.filter(
        ([name]) => name === "claimNextPendingRun",
      ),
    ).toHaveLength(1);
    expect(
      mocks.callConvex.mock.calls.filter(
        ([name]) => name === "markAgentRunCompleted",
      ),
    ).toHaveLength(1);
    expect(worker.signals.listenerCount("SIGTERM")).toBe(0);
    expect(worker.signals.listenerCount("SIGINT")).toBe(0);
    expect(worker.onPollError).not.toHaveBeenCalled();
  });
  test("an active graph error drains its failure write without retry or signal-induced failure", async () => {
    const graphGate = deferred<void>();
    const graphStarted = deferred<void>();
    const failureStarted = deferred<void>();
    const failureGate = deferred<void>();
    mocks.callConvex.mockImplementation(async (name: string) => {
      if (name === "claimNextPendingRun") return claim;
      if (name === "markAgentRunFailed") {
        failureStarted.resolve();
        await failureGate.promise;
      }
    });
    mocks.stream.mockImplementation(async function* () {
      graphStarted.resolve();
      await graphGate.promise;
      throw new Error("synthetic graph failure");
    });
    const worker = start();
    await graphStarted.promise;
    worker.signals.emit("SIGINT");
    graphGate.resolve();
    await failureStarted.promise;
    expect(worker.done).not.toHaveBeenCalled();
    failureGate.resolve();
    await worker.loop;
    const failures = mocks.callConvex.mock.calls.filter(
      ([name]) => name === "markAgentRunFailed",
    );
    expect(failures).toHaveLength(1);
    expect(failures[0][1].error.reason).toBe("graph_execution_error");
    expect(
      mocks.callConvex.mock.calls.filter(
        ([name]) => name === "claimNextPendingRun",
      ),
    ).toHaveLength(1);
  });
  test("keeps heartbeats during drain and waits for an outstanding heartbeat", async () => {
    vi.useFakeTimers();
    const graphStarted = deferred<void>();
    const graphGate = deferred<void>();
    const heartbeatGate = deferred<void>();
    const terminalStarted = deferred<void>();
    mocks.callConvex.mockImplementation(
      async (name: string, args: Record<string, unknown>) => {
        if (name === "claimNextPendingRun") return claim;
        if (
          name === "appendAgentRunEvent" &&
          args.message === "Worker heartbeat"
        )
          await heartbeatGate.promise;
        if (name === "markAgentRunCompleted") terminalStarted.resolve();
      },
    );
    mocks.stream.mockImplementation(async function* () {
      graphStarted.resolve();
      await graphGate.promise;
    });
    const worker = start();
    await graphStarted.promise;
    worker.signals.emit("SIGTERM");
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(
      mocks.callConvex.mock.calls.some(
        ([name, args]) =>
          name === "appendAgentRunEvent" && args.message === "Worker heartbeat",
      ),
    ).toBe(true);
    graphGate.resolve();
    await terminalStarted.promise;
    expect(worker.done).not.toHaveBeenCalled();
    heartbeatGate.resolve();
    await worker.loop;
    expect(worker.done).toHaveBeenCalledTimes(1);
  });

  test("wakes idle sleep immediately without another claim", async () => {
    vi.useFakeTimers();
    const poll = vi.fn().mockResolvedValue(false);
    const worker = start(poll);
    await Promise.resolve();
    worker.signals.emit("SIGTERM");
    await worker.loop;
    expect(poll).toHaveBeenCalledTimes(1);
    expect(worker.done).toHaveBeenCalledTimes(1);
  });
  test("waits for a rejected outstanding claim without retry after shutdown", async () => {
    const pending = deferred<boolean>();
    const poll = vi.fn(() => pending.promise);
    const worker = start(poll);
    worker.signals.emit("SIGTERM");
    expect(worker.done).not.toHaveBeenCalled();
    pending.reject(new Error("synthetic ambiguous claim failure"));
    await worker.loop;
    expect(poll).toHaveBeenCalledTimes(1);
    expect(worker.onPollError).toHaveBeenCalledTimes(1);
    expect(worker.log).toHaveBeenLastCalledWith(
      "worker drain finished; local poll settled",
    );
  });
});
