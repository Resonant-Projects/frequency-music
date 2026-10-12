import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test, vi } from "vite-plus/test";
import {
  beginSynthesis,
  retainChunk,
  retainedKey,
  restoreChunk,
  writeCheckpoint,
} from "../src/retained";
import { synthesizeRetained } from "../src/jobs/narrate";
import type { JobContext } from "../src/jobs/types";
import { voiceById } from "../../convex/shared/voices";
import { runOnce } from "../src/runner";

const fault = vi.hoisted(() => ({
  matches: (_path: string): boolean => false,
  unreadable: "",
  syncedDirectories: [] as string[],
}));
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
        if (fault.matches(String(args[0])))
          throw new Error("Injected checkpoint sync failure");
        await sync();
        if (args[1] === "r") fault.syncedDirectories.push(String(args[0]));
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
    retainedRoot: root,
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
  test("a traversable unreadable work-root ancestor permits synthesis and completion replay", async () => {
    const root = await mkdtemp(join(tmpdir(), "media-work-root-"));
    try {
      fault.unreadable = dirname(root);
      fault.syncedDirectories = [];
      let attempts = 0;
      const tool = vi.fn(async (name: string) => {
        if (name === "claimNextMediaJob")
          return {
            ...context(root).job,
            kind: "probe",
            input: { kind: "probe", rendererVersion: "0.2.0" },
            attempts,
            leaseToken: `lease-${attempts}`,
          };
        if (name === "completeMediaJob" && attempts === 0)
          throw new Error("Completion transport failed");
        if (name === "failMediaJob") attempts++;
        return null;
      });
      const synthesize = vi.fn(async (_text, _voice, file: string) => {
        expect(fault.syncedDirectories).toContain(root);
        await writeFile(file, "paid audio");
      });
      const handler = vi.fn(async (ctx: JobContext) => {
        await synthesizeRetained(
          ctx,
          { synthesize },
          voiceById("inworld-max"),
          "Durable speech",
          join(ctx.workDir, "output.wav"),
        );
        return { kind: "probe" as const, artifacts: [] };
      });
      const config = {
        workerId: "w",
        kinds: ["probe"],
        workDir: root,
        rendererVersion: "0.2.0",
      };
      expect(
        await runOnce(
          config,
          tool as never,
          { probe: handler },
          context(root).tools,
        ),
      ).toBe("failed");
      expect(synthesize).toHaveBeenCalledTimes(1);
      expect(
        await runOnce(
          config,
          tool as never,
          { probe: handler },
          context(root).tools,
        ),
      ).toBe("done");
      expect(handler).toHaveBeenCalledTimes(1);
      expect(synthesize).toHaveBeenCalledTimes(1);
      expect(fault.syncedDirectories).toContain(join(root, "retained"));
      expect(fault.syncedDirectories).not.toContain(dirname(root));
    } finally {
      fault.unreadable = "";
      fault.syncedDirectories = [];
      await rm(root, { recursive: true, force: true });
    }
  });

  test("an escaped directory or unprovisioned boundary cannot publish a checkpoint", async () => {
    const root = await mkdtemp(join(tmpdir(), "media-boundary-"));
    try {
      const dir = join(root, "retained");
      await expect(writeCheckpoint(root, "started", {}, dir)).rejects.toThrow(
        "outside its durable work-root",
      );
      await expect(writeCheckpoint(dir, "started", {})).rejects.toMatchObject({
        code: "ENOENT",
      });
      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test.each(["intent", "directory", "parent", "root"])(
    "%s sync failure prevents a paid synthesis request",
    async (target) => {
      const root = await mkdtemp(join(tmpdir(), "media-sync-"));
      try {
        const ctx = context(root);
        fault.matches = (path) =>
          target === "intent"
            ? path.endsWith(".tmp")
            : path ===
              (target === "root"
                ? root
                : target === "directory"
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
      await beginSynthesis(dir, key, root);
      const input = join(root, "input.wav");
      await writeFile(input, "paid audio");
      fault.matches = (path) =>
        path.startsWith(`${dir}/`) && path.endsWith(".wav");
      await expect(retainChunk(dir, key, input, root)).rejects.toThrow(
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
