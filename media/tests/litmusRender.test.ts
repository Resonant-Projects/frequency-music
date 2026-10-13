// The litmusRender handler with the renderer injected: real ffmpeg files
// stand in for SuperCollider output so upload, measurement, and cleanup run
// on hosts without SC. sc-real.test.ts covers the actual engine.
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { ClaimedMediaJob } from "../../convex/shared/mediaJobs";
import { runFfmpeg } from "../src/audio/ffmpeg";
import {
  litmusRenderHandler,
  type RenderLitmus,
} from "../src/jobs/litmusRender";
import type { NewArtifact, ToolClient } from "../src/jobs/types";

const hasFfmpeg = ["ffmpeg", "ffprobe"].every(
  (executable) =>
    spawnSync(executable, ["-version"], { timeout: 5000, stdio: "ignore" })
      .status === 0,
);

const roots: string[] = [];
async function root() {
  const path = await mkdtemp(join(tmpdir(), "litmus-job-"));
  roots.push(path);
  return path;
}
afterEach(async () => {
  for (const path of roots.splice(0))
    await rm(path, { recursive: true, force: true });
});

const plan = {
  version: 1 as const,
  engine: "sc-litmus" as const,
  tuning: { kind: "edo" as const, divisions: 19 },
  referenceHz: 432,
  normalize: false,
  variable: { kind: "referenceHz" as const, variants: [440] },
  tempoBpm: 120,
  durationSecs: 1,
  seed: [{ degree: 1, octave: 0, startBeat: 0, beats: 2, velocity: 100 }],
};

function job(renderPlan: typeof plan | Record<string, unknown> = plan) {
  return {
    jobId: "job-1",
    kind: "litmusRender",
    leaseToken: "lease",
    leaseExpiresAt: Date.now() + 60_000,
    attempts: 0,
    input: {
      kind: "litmusRender",
      recipeId: "recipe-1",
      recipeUpdatedAt: 7,
      rendererVersion: "0.3.0",
      renderPlan,
    },
  } as unknown as ClaimedMediaJob;
}

function fakeTools(failOn?: string) {
  const minted: NewArtifact[] = [];
  const tools: ToolClient = {
    generateAudioUploadUrl: async ({ artifact }) => {
      minted.push(artifact);
      return { artifactId: `a${minted.length}`, uploadUrl: "memory://" };
    },
    uploadBytes: async (_url, path) => {
      if (failOn && path.endsWith(failOn))
        throw new Error("upload failed: 502");
      expect((await stat(path)).size).toBeGreaterThan(0);
      return { storageId: "s" };
    },
    attachAudioStorage: async () => null,
  };
  return { tools, minted };
}

// Renders each member as a quiet sine, as the SC engine's output contract.
function fakeRender(log: string[]): RenderLitmus {
  return async (input, options) => {
    const members = 1 + ((input as typeof plan).variable?.variants.length ?? 0);
    const directory = await mkdtemp(join(options!.tempRoot!, "fake-sc-"));
    const artifacts = [];
    for (let index = 0; index < members; index++) {
      const master = join(directory, `${index}-master.wav`);
      const delivery = join(directory, `${index}-delivery.mp3`);
      const tone = `sine=frequency=${432 + index}:sample_rate=48000:duration=1`;
      await runFfmpeg([
        "-f",
        "lavfi",
        "-i",
        tone,
        "-af",
        "volume=-20dB",
        "-ac",
        "2",
        "-c:a",
        "pcm_s24le",
        master,
      ]);
      await runFfmpeg([
        "-i",
        master,
        "-c:a",
        "libmp3lame",
        "-b:a",
        "256k",
        delivery,
      ]);
      artifacts.push({ master, delivery, durationSecs: 1 });
    }
    return {
      directory,
      artifacts,
      dispose: async () => {
        log.push("disposed");
        await rm(directory, { recursive: true, force: true });
      },
    } as Awaited<ReturnType<RenderLitmus>>;
  };
}

const context = async (claimed: ClaimedMediaJob, tools: ToolClient) => ({
  job: claimed,
  workDir: await root(),
  tools,
  rendererVersion: "0.3.0",
  signal: new AbortController().signal,
});

describe.skipIf(!hasFfmpeg)("litmusRender handler", () => {
  it("uploads every member as a raw master and delivery for normalize:false", async () => {
    const log: string[] = [];
    const { tools, minted } = fakeTools();
    const result = await litmusRenderHandler(
      await context(job(), tools),
      fakeRender(log),
    );
    expect(result.kind).toBe("litmusRender");
    expect(result.members.map((member) => member.member)).toEqual([0, 1]);
    expect(minted.map((artifact) => artifact.role)).toEqual([
      "masterRaw",
      "delivery",
      "masterRaw",
      "delivery",
    ]);
    for (const artifact of minted) {
      expect(artifact).toMatchObject({
        kind: "litmusRender",
        access: "private",
        metadataStripped: true,
        normalization: "skipped",
      });
      expect(artifact.validation).toBeUndefined();
    }
    // Delivery points at its own member's master.
    expect(minted[1]!.masterArtifactId).toBe("a1");
    expect(minted[3]!.masterArtifactId).toBe("a3");
    // Retries of the same job hash identically; members never collide.
    const hashes = minted.map((artifact) => artifact.contentHash);
    expect(new Set(hashes).size).toBe(4);
    const again = fakeTools();
    await litmusRenderHandler(
      await context(job(), again.tools),
      fakeRender([]),
    );
    expect(again.minted.map((artifact) => artifact.contentHash)).toEqual(
      hashes,
    );
    // Measured, not policy-checked: these files sit far below -18 LUFS.
    expect(result.members[0]!.master.loudnessLufs).toBeLessThan(-25);
    expect(log).toEqual(["disposed"]);
  });

  it("holds normalized renders to the music loudness policy", async () => {
    const { tools, minted } = fakeTools();
    await expect(
      litmusRenderHandler(
        await context(job({ ...plan, normalize: true }), tools),
        fakeRender([]),
      ),
    ).rejects.toThrow(/outside -18/);
    expect(minted).toEqual([]);
  });

  it("disposes the render when an upload fails", async () => {
    const log: string[] = [];
    const { tools } = fakeTools("1-delivery.mp3");
    await expect(
      litmusRenderHandler(await context(job(), tools), fakeRender(log)),
    ).rejects.toThrow(/upload failed: 502/);
    expect(log).toEqual(["disposed"]);
  });

  it("refuses another job kind", async () => {
    const { tools } = fakeTools();
    const other = { ...job(), input: { kind: "probe" } } as never;
    await expect(
      litmusRenderHandler(await context(other, tools), fakeRender([])),
    ).rejects.toThrow(/another kind/);
  });
});
