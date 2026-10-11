import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vite-plus/test";
import {
  beginSynthesis,
  retainChunk,
  retainedKey,
  restoreChunk,
} from "../src/retained";
import { synthesizeRetained } from "../src/jobs/narrate";
import type { JobContext } from "../src/jobs/types";
import { voiceById } from "../../convex/shared/voices";

const fault = vi.hoisted(() => ({
  matches: (_path: string): boolean => false,
}));
vi.mock("node:fs/promises", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...fs,
    open: async (...args: Parameters<typeof fs.open>) => {
      const handle = await fs.open(...args);
      const sync = handle.sync.bind(handle);
      vi.spyOn(handle, "sync").mockImplementation(async () => {
        if (fault.matches(String(args[0])))
          throw new Error("Injected checkpoint sync failure");
        await sync();
      });
      return handle;
    },
  };
});

function context(root: string): JobContext {
  return {
    job: {
      jobId: "j",
      kind: "shootout",
      leaseToken: "L",
      leaseExpiresAt: Date.now() + 60_000,
      attempts: 0,
      input: {
        kind: "shootout",
        passage: ["Durable speech"],
        voiceIds: ["inworld-max"],
        title: "T",
        rendererVersion: "0.2.0",
      },
    },
    workDir: root,
    retainedDir: join(root, "retained", "job"),
    rendererVersion: "0.2.0",
    signal: new AbortController().signal,
    tools: {
      generateAudioUploadUrl: vi.fn(),
      attachAudioStorage: vi.fn(),
      uploadBytes: vi.fn(),
    },
  };
}

describe("retained media storage failures", () => {
  test.each(["intent", "directory", "parent"])(
    "%s sync failure prevents a paid synthesis request",
    async (target) => {
      const root = await mkdtemp(join(tmpdir(), "media-sync-"));
      try {
        const ctx = context(root);
        fault.matches = (path) =>
          target === "intent"
            ? path.endsWith(".tmp")
            : path ===
              (target === "directory"
                ? ctx.retainedDir
                : join(root, "retained"));
        const synthesize = vi.fn(async () => {});
        await expect(
          synthesizeRetained(
            ctx,
            { synthesize },
            voiceById("inworld-max"),
            "Durable speech",
            join(root, "output.wav"),
          ),
        ).rejects.toThrow("Injected checkpoint sync failure");
        expect(synthesize).not.toHaveBeenCalled();
      } finally {
        fault.matches = () => false;
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  test("audio sync failure leaves the intent unfinished and refuses paid regeneration", async () => {
    const root = await mkdtemp(join(tmpdir(), "media-audio-sync-"));
    try {
      const dir = join(root, "retained");
      const key = retainedKey("chunk");
      await beginSynthesis(dir, key);
      const input = join(root, "input.wav");
      await writeFile(input, "paid audio");
      fault.matches = (path) =>
        path.startsWith(`${dir}/`) && path.endsWith(".wav");
      await expect(retainChunk(dir, key, input)).rejects.toThrow(
        "Injected checkpoint sync failure",
      );
      fault.matches = () => false;
      await expect(
        restoreChunk(dir, key, join(root, "restored.wav")),
      ).rejects.toThrow("unfinished chunk");
      const audio = (await readdir(dir)).find((file) => file.endsWith(".wav"));
      expect(await readFile(join(dir, audio!), "utf8")).toBe("paid audio");
    } finally {
      fault.matches = () => false;
      await rm(root, { recursive: true, force: true });
    }
  });
});
