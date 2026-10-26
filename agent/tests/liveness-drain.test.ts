import { afterEach, expect, test, vi } from "vite-plus/test";
import {
  createLivenessReporter,
  LIVENESS_PUSH_INTERVAL_MS,
  LIVENESS_PUSH_TIMEOUT_MS,
} from "../src/worker/liveness";

afterEach(() => {
  vi.useRealTimers();
});

test("liveness stop drains its bounded pending push and never starts another", async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  const fetchImpl = vi.fn(
    (_url: URL | RequestInfo, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        signal = init!.signal!;
        signal.addEventListener(
          "abort",
          () => reject(new Error("synthetic timeout")),
          { once: true },
        );
      }),
  );
  const reporter = createLivenessReporter({
    pushUrl: new URL("https://synthetic.invalid/push/private-token"),
    log: vi.fn(),
    redact: () => "redacted",
    fetchImpl: fetchImpl as typeof fetch,
  });
  await vi.advanceTimersByTimeAsync(LIVENESS_PUSH_INTERVAL_MS);
  let stopped = false;
  const stopping = reporter.stop().then(() => {
    stopped = true;
  });
  await vi.advanceTimersByTimeAsync(LIVENESS_PUSH_TIMEOUT_MS - 1);
  expect(stopped).toBe(false);
  expect(signal?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await stopping;
  expect(signal?.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(LIVENESS_PUSH_INTERVAL_MS);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
