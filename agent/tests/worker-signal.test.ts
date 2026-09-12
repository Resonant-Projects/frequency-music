import { spawn } from "node:child_process";
import { describe, expect, test } from "vite-plus/test";

import type { ChildProcess } from "node:child_process";

type WorkerMessage = {
  type: "claimed" | "drain-requested" | "done";
  polls?: number;
  effects?: number;
};

function waitForMessage(child: ChildProcess, type: WorkerMessage["type"]) {
  return new Promise<WorkerMessage>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for worker message: ${type}`));
    }, 5000);
    const onMessage = (message: WorkerMessage) => {
      if (message.type !== type) return;
      cleanup();
      resolve(message);
    };
    const onExit = (code: number | null, signal: string | null) => {
      cleanup();
      reject(new Error(`Worker exited before ${type}: ${code}/${signal}`));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      child.off("message", onMessage);
      child.off("exit", onExit);
    };
    child.on("message", onMessage);
    child.once("exit", onExit);
  });
}

describe("worker operating-system signal drain", () => {
  test("SIGTERM keeps active work alive until release, then exits after one effect", async () => {
    const lifecycleUrl = new URL("../src/worker/lifecycle.ts", import.meta.url)
      .href;
    // Node 24 strips TypeScript natively. Import only the lifecycle: no runtime
    // environment loader, graph provider, queue client, or inherited credentials.
    const source = `
      import { runWorkerLoop } from ${JSON.stringify(lifecycleUrl)};
      let polls = 0;
      let effects = 0;
      let release;
      const active = new Promise(resolve => { release = resolve; });
      process.on("message", message => {
        if (message === "release") release();
      });
      await runWorkerLoop({
        signals: process,
        pollIntervalMs: 60000,
        log(message) {
          if (message.startsWith("received SIGTERM")) {
            process.send({ type: "drain-requested" });
          }
        },
        onPollError(error) { throw error; },
        async poll() {
          polls += 1;
          process.send({ type: "claimed" });
          await active;
          effects += 1;
          return true;
        },
      });
      process.send({ type: "done", polls, effects }, () => process.disconnect());
    `;
    const child = spawn(
      process.execPath,
      ["--input-type=module", "--eval", source],
      {
        env: { APP_ENV: "test" },
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      },
    );
    const messages: WorkerMessage[] = [];
    let stderr = "";
    child.on("message", (message: WorkerMessage) => messages.push(message));
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const exited = new Promise<{ code: number | null; signal: string | null }>(
      (resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => resolve({ code, signal }));
      },
    );
    const cleanupTimer = setTimeout(() => child.kill("SIGKILL"), 10_000);
    try {
      await waitForMessage(child, "claimed");
      const draining = waitForMessage(child, "drain-requested");
      expect(child.kill("SIGTERM")).toBe(true);
      await draining;
      expect(child.exitCode).toBeNull();
      expect(child.signalCode).toBeNull();
      expect(messages.some((message) => message.type === "done")).toBe(false);
      const done = waitForMessage(child, "done");
      child.send("release");
      expect(await done).toEqual({ type: "done", polls: 1, effects: 1 });
      expect(await exited, stderr).toEqual({ code: 0, signal: null });
      expect(
        messages.filter((message) => message.type === "claimed"),
      ).toHaveLength(1);
    } finally {
      clearTimeout(cleanupTimer);
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
      await exited;
    }
  }, 15_000);
});
