// Worker entrypoint. varlock/auto-load must be the first import so .env.local
// is resolved before config.ts and convex.ts read process.env.
import "varlock/auto-load";
import { mkdir } from "node:fs/promises";
import { loadConfig } from "./config";
import { callTool } from "./convex";
import { handlers } from "./jobs";
import { log, redactError } from "./log";
import { runOnce } from "./runner";

async function main(): Promise<void> {
  const config = loadConfig();
  // A kind with no handler would burn every job's attempts and park it;
  // refuse to start rather than poison the queue.
  const unknown = config.kinds.filter((kind) => !Object.hasOwn(handlers, kind));
  if (unknown.length > 0) {
    log(`no handler for job kinds: ${unknown.join(", ")}`);
    process.exit(1);
  }
  await mkdir(config.workDir, { recursive: true });
  log(
    `media worker ${config.workerId} polling every ${config.pollIntervalMs} ms for ${config.kinds.join(", ")}`,
  );
  let stopping = false;
  process.on("SIGTERM", () => {
    stopping = true;
  });
  process.on("SIGINT", () => {
    stopping = true;
  });
  while (!stopping) {
    let outcome: "idle" | "done" | "failed" = "idle";
    try {
      outcome = await runOnce(config, callTool, handlers);
    } catch (error) {
      log(`poll iteration failed: ${redactError(error)}`);
    }
    // Back off after a failure too: requeue has no server-side delay, so an
    // immediate re-claim would burn MAX_ATTEMPTS on a transient outage.
    if (outcome !== "done") {
      await new Promise((resolve) =>
        setTimeout(resolve, config.pollIntervalMs),
      );
    }
  }
  log("stopped");
}

void main();
