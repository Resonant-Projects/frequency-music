import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test, vi } from "vite-plus/test";
import { SCOUTED_TEXT_MAX_CHARS } from "../../convex/shared/agentContract";
import { DurableOutbox } from "../src/shared/outbox.js";
import { ConvexToolHttpError } from "../src/tools/convexTools.js";

const fault = vi.hoisted(() => ({ path: "", unreadable: "" }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...fs,
    open: async (...args: Parameters<typeof fs.open>) => {
      if (String(args[0]) === fault.unreadable)
        throw Object.assign(new Error("Unreadable ancestor"), {
          code: "EACCES",
        });
      const handle = await fs.open(...args);
      const sync = handle.sync.bind(handle);
      vi.spyOn(handle, "sync").mockImplementation(async () => {
        if (String(args[0]) === fault.path) {
          const error = new Error("Injected storage sync failure");
          Object.assign(error, { code: "EIO" });
          throw error;
        }
        await sync();
      });
      return handle;
    },
  };
});

describe("outbox storage failures", () => {
  test("nested first-use outboxes sync their provisioned boundary and preserve quarantine retries", async () => {
    const root = await mkdtemp(join(tmpdir(), "outbox-first-use-"));
    try {
      const dir = join(root, "state", "outbox");
      const outbox = new DurableOutbox(dir, root);
      fault.path = join(root, "state");
      await expect(
        outbox.enqueue({
          tool: "reportCaptureFailure",
          args: { deliveryId: "retained" },
        }),
      ).rejects.toThrow("Injected storage sync failure");
      fault.path = root;
      const reject = async () => {
        throw new ConvexToolHttpError("permanent rejection", 400);
      };
      await expect(outbox.flush(reject)).rejects.toThrow(
        "Injected storage sync failure",
      );
      expect(await readdir(dir)).toEqual(["0.spool", "dead-letter"]);
      fault.path = "";
      await expect(new DurableOutbox(dir, root).flush(reject)).rejects.toThrow(
        "permanent rejection",
      );
      expect(await readdir(dir)).toEqual(["dead-letter"]);
      expect(await readdir(join(dir, "dead-letter"))).toEqual(["slot-0.json"]);
    } finally {
      fault.path = "";
      await rm(root, { recursive: true, force: true });
    }
  });

  test("an unreadable traversable ancestor does not block delivery or quarantine", async () => {
    const dir = await mkdtemp(join(tmpdir(), "outbox-boundary-"));
    try {
      fault.unreadable = dirname(dir);
      const outbox = new DurableOutbox(dir);
      await outbox.enqueue({
        tool: "appendAgentRunEvent",
        args: { deliveryId: "rejected" },
      });
      await outbox.enqueue({
        tool: "reportCaptureFailure",
        args: { deliveryId: "later" },
      });
      const delivered: unknown[] = [];
      await expect(
        new DurableOutbox(dir).flush(async (_tool, args) => {
          if (args.deliveryId === "rejected")
            throw new ConvexToolHttpError("permanent rejection", 400);
          delivered.push(args.deliveryId);
          return null;
        }),
      ).rejects.toThrow("permanent rejection");
      expect(delivered).toEqual(["later"]);
      expect(await readdir(dir)).toEqual(["dead-letter"]);
      expect(
        JSON.parse(
          await readFile(join(dir, "dead-letter", "slot-0.json"), "utf8"),
        ).delivery.args.deliveryId,
      ).toBe("rejected");
    } finally {
      fault.unreadable = "";
      await rm(dir, { recursive: true, force: true });
    }
  });

  test.each([false, true])(
    "quarantine reuses an interrupted diagnostic link after sync recovers (full: %s)",
    async (full) => {
      const dir = await mkdtemp(join(tmpdir(), "outbox-sync-retry-"));
      try {
        const outbox = new DurableOutbox(dir);
        await outbox.enqueue({
          tool: "appendAgentRunEvent",
          args: { deliveryId: "retained" },
        });
        const reject = async () => {
          throw new ConvexToolHttpError("permanent rejection", 400);
        };
        fault.path = join(dir, "dead-letter");
        for (let i = 0; i < 3; i++) {
          await expect(outbox.flush(reject)).rejects.toThrow(
            "Injected storage sync failure",
          );
          expect(await readdir(join(dir, "dead-letter"))).toEqual([
            "slot-0.json",
          ]);
        }
        if (full)
          await Promise.all(
            Array.from({ length: 1999 }, (_, index) =>
              writeFile(
                join(dir, "dead-letter", `legacy-${index}.json`),
                "retained legacy diagnostic",
              ),
            ),
          );
        fault.path = "";
        await expect(new DurableOutbox(dir).flush(reject)).rejects.toThrow(
          "permanent rejection",
        );
        expect(await readdir(dir)).toEqual(["dead-letter"]);
        expect((await readdir(join(dir, "dead-letter"))).length).toBe(
          full ? 2000 : 1,
        );
        expect(
          JSON.parse(
            await readFile(join(dir, "dead-letter", "slot-0.json"), "utf8"),
          ).delivery.args.deliveryId,
        ).toBe("retained");
        if (!full) {
          await outbox.enqueue({
            tool: "reportCaptureFailure",
            args: { deliveryId: "next" },
          });
          await expect(outbox.flush(reject)).rejects.toThrow(
            "permanent rejection",
          );
          expect(await readdir(dir)).toEqual(["dead-letter"]);
          expect((await readdir(join(dir, "dead-letter"))).length).toBe(2);
        }
      } finally {
        fault.path = "";
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
  test.each(["record", "directory"])(
    "enqueue reports a %s sync failure and preserves its replayable report",
    async (target) => {
      const dir = await mkdtemp(join(tmpdir(), "outbox-sync-"));
      try {
        fault.path = target === "record" ? join(dir, "0.spool") : dir;
        await expect(
          new DurableOutbox(dir).enqueue({
            tool: "reportCaptureFailure",
            args: { deliveryId: "retained" },
          }),
        ).rejects.toThrow("Injected storage sync failure");
        expect(await readdir(dir)).toEqual(["0.spool"]);
        fault.path = "";
        const deliver = vi.fn(async () => null);
        await new DurableOutbox(dir).flush(deliver);
        expect(deliver).toHaveBeenCalledExactlyOnceWith(
          "reportCaptureFailure",
          {
            deliveryId: "retained",
          },
        );
        expect(await readdir(dir)).toEqual([]);
      } finally {
        fault.path = "";
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test.each(["record", "parent", "child"])(
    "failed quarantine %s persistence keeps the active report and continues later deliveries",
    async (target) => {
      const dir = await mkdtemp(join(tmpdir(), "outbox-quarantine-sync-"));
      try {
        const outbox = new DurableOutbox(dir);
        await outbox.enqueue({
          tool: "appendAgentRunEvent",
          args: { deliveryId: "rejected" },
        });
        await outbox.enqueue({
          tool: "appendAgentRunEvent",
          args: { deliveryId: "later" },
        });
        const original = await readFile(join(dir, "0.spool"), "utf8");
        fault.path =
          target === "record"
            ? join(dir, "0.spool")
            : target === "parent"
              ? dir
              : join(dir, "dead-letter");
        const delivered: unknown[] = [];
        await expect(
          outbox.flush(async (_tool, args) => {
            if (args.deliveryId === "rejected")
              throw new ConvexToolHttpError("permanent rejection", 400);
            delivered.push(args.deliveryId);
            return null;
          }),
        ).rejects.toThrow("Injected storage sync failure");
        expect(delivered).toEqual(["later"]);
        expect(await readdir(dir)).toEqual(["0.spool", "dead-letter"]);
        expect(await readFile(join(dir, "0.spool"), "utf8")).toBe(original);
        expect(await readdir(join(dir, "dead-letter"))).toEqual(
          target === "record" ? [] : ["slot-0.json"],
        );
      } finally {
        fault.path = "";
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
});

describe("outbox record size", () => {
  test("spools the largest capture intake accepts, even fully JSON-escaped", async () => {
    const dir = await mkdtemp(join(tmpdir(), "outbox-record-size-"));
    try {
      // JSON writes a control character as \u00XX: six bytes per character.
      const escaped = (length: number) => "\u0001".repeat(length);
      const args = {
        agentRunId: "run",
        input: {
          url: `https://example.org/${"a".repeat(2_000)}`,
          title: escaped(1_000),
          query: escaped(4_000),
          rationale: escaped(4_000),
          rawText: escaped(SCOUTED_TEXT_MAX_CHARS),
          contentProvider: "crawl4ai",
        },
        stage: "intake",
        diagnostic: escaped(1_000),
      };
      const outbox = new DurableOutbox(dir);
      await outbox.enqueue({ tool: "reportCaptureFailure", args });
      const deliver = vi.fn(async () => undefined);
      await outbox.flush(deliver);
      expect(deliver).toHaveBeenCalledWith("reportCaptureFailure", args);
      await expect(
        outbox.enqueue({
          tool: "reportCaptureFailure",
          args: {
            ...args,
            input: {
              ...args.input,
              rawText: escaped(2 * SCOUTED_TEXT_MAX_CHARS),
            },
          },
        }),
      ).rejects.toThrow("Recovery outbox record exceeds limit");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
