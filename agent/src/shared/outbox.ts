import { randomUUID } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ToolCaller } from "../graphs/shared/audit.js";
import { redactError } from "./redactError.js";

const OUTBOX_TOOLS = ["appendAgentRunEvent", "reportCaptureFailure"] as const;
type Delivery = {
  tool: (typeof OUTBOX_TOOLS)[number];
  args: Record<string, unknown>;
};
/** Bounded disk spool. Callers supply domain IDs, never HTTP credentials. */
export class DurableOutbox {
  private lastAttemptedFile = "";
  constructor(private readonly dir: string) {}
  async enqueue(delivery: Delivery) {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    if ((await readdir(this.dir)).length >= 2000)
      throw new Error("Recovery outbox capacity reached");
    const bytes = JSON.stringify(delivery);
    if (Buffer.byteLength(bytes) > 256_000)
      throw new Error("Recovery outbox record exceeds limit");
    const id = randomUUID();
    const temporary = join(this.dir, `${id}.tmp`);
    await writeFile(temporary, bytes, { mode: 0o600 });
    await rename(temporary, join(this.dir, `${id}.json`));
  }
  async flush(callTool: ToolCaller) {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const pending = (await readdir(this.dir))
      .filter((file) => /^[a-f0-9-]+\.json$/.test(file))
      .sort();
    // Failed records stay durable, but cannot monopolize every poll's batch.
    const files = [
      ...pending.filter((file) => file > this.lastAttemptedFile),
      ...pending.filter((file) => file <= this.lastAttemptedFile),
    ].slice(0, 5);
    let lastError: unknown;
    for (const file of files) {
      this.lastAttemptedFile = file;
      try {
        const path = join(this.dir, file);
        const delivery = JSON.parse(await readFile(path, "utf8")) as Delivery;
        if (!OUTBOX_TOOLS.includes(delivery.tool))
          throw new Error("Invalid outbox action");
        await callTool(delivery.tool, delivery.args);
        await unlink(path);
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
  }
}
// Unit tests inject their own temporary spool; never write test events into the worker's spool.
export const workerOutbox =
  process.env.NODE_ENV === "test"
    ? undefined
    : new DurableOutbox(
        process.env.AGENT_OUTBOX_DIR ??
          join(homedir(), ".local", "state", "frequency-agent", "outbox"),
      );

/** Deliver now, or spool `spooled` args for replay; returns the delivery error, if any. */
export async function deliverOrSpool(
  callTool: ToolCaller,
  tool: Delivery["tool"],
  args: Delivery["args"],
  spooled: Delivery["args"] = args,
): Promise<{ error: unknown } | undefined> {
  try {
    await callTool(tool, args);
    return undefined;
  } catch (error) {
    try {
      await workerOutbox?.enqueue({ tool, args: spooled });
    } catch (spoolError) {
      console.error(`${tool} outbox write failed:`, redactError(spoolError));
    }
    return { error };
  }
}
