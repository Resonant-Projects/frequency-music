import {
  link,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  stat,
  unlink,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ToolCaller } from "../graphs/shared/audit.js";
import { redactError } from "./redactError.js";
import { ConvexToolHttpError } from "../tools/convexTools.js";

const OUTBOX_TOOLS = ["appendAgentRunEvent", "reportCaptureFailure"] as const;
const OUTBOX_CAPACITY = 2000;
const TEMP_WRITE_GRACE_MS = 15 * 60_000;
const READY_OFFSET = '{"ready":'.length;
const ACTIVE_SLOTS = Array.from(
  { length: OUTBOX_CAPACITY },
  (_, index) => `${index.toString(16)}.spool`,
);
const DEAD_LETTER_SLOTS = Array.from(
  { length: OUTBOX_CAPACITY },
  (_, index) => `slot-${index}.json`,
);
const flushQueues = new Map<string, Promise<void>>();
type Delivery = {
  tool: (typeof OUTBOX_TOOLS)[number];
  args: Record<string, unknown>;
};
/** Bounded disk spool with one worker consumer. Callers supply domain IDs, never HTTP credentials. */
export class DurableOutbox {
  private lastAttemptedFile = "";
  constructor(private readonly dir: string) {}
  async enqueue(delivery: Delivery) {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const bytes = JSON.stringify({ ready: 0, delivery });
    if (Buffer.byteLength(bytes) > 256_000)
      throw new Error("Recovery outbox record exceeds limit");
    const existing = new Set(
      (await readdir(this.dir)).filter((file) =>
        /\.(json|tmp|spool)$/.test(file),
      ),
    );
    // Legacy records consume capacity too. Concurrent writers compete for the
    // same remaining slots, and exclusive creation reserves before writing.
    const slots = ACTIVE_SLOTS.filter((slot) => !existing.has(slot)).slice(
      0,
      Math.max(0, OUTBOX_CAPACITY - existing.size),
    );
    for (const slot of slots) {
      let handle;
      try {
        handle = await open(join(this.dir, slot), "wx", 0o600);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
        throw error;
      }
      try {
        await handle.writeFile(bytes);
        // Publish with one byte on the reserved inode. Keeping its filename
        // stable avoids releasing capacity or overwriting another writer.
        const result = await handle.write("1", READY_OFFSET, "utf8");
        if (result.bytesWritten !== 1)
          throw new Error("Recovery outbox completion marker failed");
      } finally {
        await handle.close();
      }
      return;
    }
    throw new Error("Recovery outbox capacity reached");
  }
  private async quarantine(path: string) {
    const dir = join(this.dir, "dead-letter");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const existing = new Set(await readdir(dir));
    // Legacy UUID files remain intact and count against the same capacity.
    const availableSlots = DEAD_LETTER_SLOTS.filter(
      (slot) => !existing.has(slot),
    ).slice(0, Math.max(0, OUTBOX_CAPACITY - existing.size));
    for (const slot of availableSlots) {
      try {
        // Exclusive hard links bound concurrent writers without overwriting reports.
        // A crash before unlink leaves a durable copy in both queues.
        await link(path, join(dir, slot));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
        throw error;
      }
      await unlink(path);
      return;
    }
    throw new Error("Recovery outbox dead-letter capacity reached");
  }
  async flush(callTool: ToolCaller) {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const key = await realpath(this.dir);
    const previous = flushQueues.get(key);
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    flushQueues.set(key, current);
    await previous;
    try {
      // Slot names are reusable. Serialize local consumers so a late
      // acknowledgment cannot unlink a later writer's record at the same slot.
      await this.flushBatch(callTool);
    } finally {
      release();
      if (flushQueues.get(key) === current) flushQueues.delete(key);
    }
  }
  private async flushBatch(callTool: ToolCaller) {
    const pending = (await readdir(this.dir))
      .filter((file) => /^[a-f0-9-]+\.(json|tmp|spool)$/.test(file))
      .sort();
    // Failed records stay durable, but cannot monopolize every poll's batch.
    const files = [
      ...pending.filter((file) => file > this.lastAttemptedFile),
      ...pending.filter((file) => file <= this.lastAttemptedFile),
    ].slice(0, 5);
    let lastError: unknown;
    for (const file of files) {
      this.lastAttemptedFile = file;
      const path = join(this.dir, file);
      let invalidRecord = false;
      try {
        // A recent temporary file may still be in an enqueue's write/rename
        // window. Older writes are replayed with the same validation and
        // acknowledgment rules as committed records; partial JSON is retained
        // in quarantine rather than silently discarded.
        if (
          file.endsWith(".tmp") &&
          Date.now() - (await stat(path)).mtimeMs < TEMP_WRITE_GRACE_MS
        )
          continue;
        const bytes = await readFile(path, "utf8");
        const reserved = file.endsWith(".spool");
        if (
          reserved &&
          bytes[READY_OFFSET] !== "1" &&
          Date.now() - (await stat(path)).mtimeMs < TEMP_WRITE_GRACE_MS
        )
          continue;
        invalidRecord = true;
        const record = JSON.parse(bytes);
        if (reserved && (!record || ![0, 1].includes(record.ready)))
          throw new Error("Invalid outbox reservation");
        const delivery = (reserved ? record.delivery : record) as Delivery;
        if (
          !delivery ||
          !OUTBOX_TOOLS.includes(delivery.tool) ||
          !delivery.args ||
          typeof delivery.args !== "object" ||
          Array.isArray(delivery.args)
        )
          throw new Error("Invalid outbox action");
        invalidRecord = false;
        await callTool(delivery.tool, delivery.args);
        await unlink(path);
      } catch (error) {
        lastError = error;
        const permanentlyRejected =
          error instanceof ConvexToolHttpError &&
          error.status >= 400 &&
          error.status < 500 &&
          ![408, 409, 425, 429].includes(error.status);
        if (invalidRecord || permanentlyRejected) {
          try {
            await this.quarantine(path);
          } catch (moveError) {
            if ((moveError as NodeJS.ErrnoException).code !== "ENOENT")
              lastError = moveError;
          }
        }
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
