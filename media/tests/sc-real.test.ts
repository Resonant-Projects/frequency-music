// Real SuperCollider renders. Skipped unless sclang, scsynth, ffmpeg, and
// ffprobe are on PATH (the media image; this host has no SuperCollider).
// These prove the engine runs and lands pitch on the tuning table; they say
// nothing about musical or listening validity (plan 11 steps 3-4).
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  generateSeedEvents,
  prepareDegreeToHz,
  type TuningSpec,
} from "../../convex/shared/tuning";
import type { ClaimedMediaJob } from "../../convex/shared/mediaJobs";
import { runFfmpeg } from "../src/audio/ffmpeg";
import { measure } from "../src/audio/loudness";
import { renderLocal } from "../src/engines/sc";
import { litmusRenderHandler } from "../src/jobs/litmusRender";
import type { NewArtifact, ToolClient } from "../src/jobs/types";

const hasSuperCollider = ["sclang", "scsynth", "ffmpeg", "ffprobe"].every(
  (executable) =>
    spawnSync("sh", ["-c", `command -v ${executable}`], { stdio: "ignore" })
      .status === 0,
);

const roots: string[] = [];
async function root() {
  const path = await mkdtemp(join(tmpdir(), "sc-real-"));
  roots.push(path);
  return path;
}
afterEach(async () => {
  for (const path of roots.splice(0))
    await rm(path, { recursive: true, force: true });
});

let decodes = 0;

// Hann-windowed DTFT peak of the decoded master near the expected
// fundamental: a 0.5-cent grid over ±30 cents, then 0.005 cents over ±1.
async function measuredFundamentalHz(
  wav: string,
  expectedHz: number,
  dir: string,
): Promise<number> {
  const raw = join(dir, `decoded-${decodes++}.f32`);
  await runFfmpeg([
    "-i",
    wav,
    "-ac",
    "1",
    "-ss",
    "0.4",
    "-t",
    "1.2",
    "-f",
    "f32le",
    "-c:a",
    "pcm_f32le",
    raw,
  ]);
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(raw);
  const samples = new Float32Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 4,
  );
  const n = samples.length;
  const windowed = new Float64Array(n);
  for (let i = 0; i < n; i++)
    windowed[i] = samples[i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
  const magnitude = (hz: number) => {
    const step = (2 * Math.PI * hz) / 48000;
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      re += windowed[i]! * Math.cos(step * i);
      im -= windowed[i]! * Math.sin(step * i);
    }
    return re * re + im * im;
  };
  const search = (centerHz: number, spanCents: number, stepCents: number) => {
    let best = centerHz;
    let bestMagnitude = -1;
    for (let cents = -spanCents; cents <= spanCents; cents += stepCents) {
      const hz = centerHz * 2 ** (cents / 1200);
      const value = magnitude(hz);
      if (value > bestMagnitude) {
        bestMagnitude = value;
        best = hz;
      }
    }
    return best;
  };
  return search(search(expectedHz, 30, 0.5), 1, 0.005);
}

const kits: { name: string; tuning: TuningSpec; referenceHz: number }[] = [
  {
    name: "19-EDO at 432 Hz",
    tuning: { kind: "edo", divisions: 19 },
    referenceHz: 432,
  },
  {
    name: "5-limit JI at 261.63 Hz",
    tuning: {
      kind: "ji",
      ratios: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"],
    },
    referenceHz: 261.63,
  },
  {
    name: "12-EDO at 440 Hz",
    tuning: { kind: "edo", divisions: 12 },
    referenceHz: 440,
  },
];

const evidence: Record<string, unknown>[] = [];

describe.skipIf(!hasSuperCollider)("real SuperCollider litmus renders", () => {
  afterEach(async () => {
    const path = process.env.SC_EVIDENCE_PATH;
    if (path) await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`);
  });

  it.each(kits)(
    "renders a bounded $name kit within loudness policy",
    { timeout: 120_000 },
    async (kit) => {
      // The generated kit seed, truncated to a 4-second bounded study.
      const plan = {
        version: 1,
        engine: "sc-litmus",
        tuning: kit.tuning,
        referenceHz: kit.referenceHz,
        normalize: true,
        tempoBpm: 120,
        durationSecs: 4,
        seed: generateSeedEvents([], kit.tuning).events.filter(
          (event) => event.startBeat < 8,
        ),
      };
      const rendered = await renderLocal(plan, { tempRoot: await root() });
      try {
        expect(rendered.artifacts).toHaveLength(1);
        const files = rendered.artifacts[0]!;
        const master = await measure(files.master);
        const delivery = await measure(files.delivery);
        expect(Math.abs(master.integratedLufs + 18)).toBeLessThanOrEqual(0.5);
        expect(master.truePeakDbtp).toBeLessThanOrEqual(-1);
        expect(Math.abs(delivery.durationSecs - 4)).toBeLessThan(0.1);
        evidence.push({
          kind: "kit",
          kit: kit.name,
          seedEvents: plan.seed.length,
          masterLufs: master.integratedLufs,
          masterTruePeakDbtp: master.truePeakDbtp,
          deliveryLufs: delivery.integratedLufs,
          deliveryTruePeakDbtp: delivery.truePeakDbtp,
          masterBytes: (await stat(files.master)).size,
          deliveryBytes: (await stat(files.delivery)).size,
        });
      } finally {
        await rendered.dispose();
      }
    },
  );

  it("lands sustained notes within 0.5 cents of the tuning table", {
    timeout: 180_000,
  }, async () => {
    const dir = await root();
    for (const kit of kits) {
      const hz = prepareDegreeToHz(kit.tuning, kit.referenceHz);
      for (const degree of [1, 4]) {
        const plan = {
          version: 1,
          engine: "sc-litmus",
          tuning: kit.tuning,
          referenceHz: kit.referenceHz,
          normalize: true,
          tempoBpm: 120,
          durationSecs: 2,
          seed: [{ degree, octave: 0, startBeat: 0, beats: 4, velocity: 100 }],
        };
        const rendered = await renderLocal(plan, { tempRoot: dir });
        try {
          const expected = hz(degree, 0);
          const actual = await measuredFundamentalHz(
            rendered.artifacts[0]!.master,
            expected,
            dir,
          );
          const errorCents = 1200 * Math.log2(actual / expected);
          evidence.push({
            kind: "pitch",
            kit: kit.name,
            degree,
            expectedHz: expected,
            measuredHz: actual,
            errorCents,
          });
          expect(Math.abs(errorCents)).toBeLessThan(0.5);
          // The SynthDef is loaded before the first note: the 20 ms linear
          // attack is already sounding in the first 10 ms of the study.
          const head = join(dir, `head-${decodes++}.f32`);
          await runFfmpeg([
            "-i",
            rendered.artifacts[0]!.master,
            "-ac",
            "1",
            "-t",
            "0.01",
            "-f",
            "f32le",
            "-c:a",
            "pcm_f32le",
            head,
          ]);
          const { readFile } = await import("node:fs/promises");
          const headBytes = await readFile(head);
          const headSamples = new Float32Array(
            headBytes.buffer,
            headBytes.byteOffset,
            headBytes.byteLength / 4,
          );
          const headPeak = Math.max(...headSamples.map(Math.abs));
          expect(headPeak).toBeGreaterThan(0.01);
          evidence.push({ kind: "onset", kit: kit.name, degree, headPeak });
          // The estimator must see an offset: searching from 3 cents sharp
          // still lands on the rendered pitch, not on its starting point.
          const offset = await measuredFundamentalHz(
            rendered.artifacts[0]!.master,
            expected * 2 ** (3 / 1200),
            dir,
          );
          expect(Math.abs(1200 * Math.log2(offset / expected))).toBeLessThan(
            0.5,
          );
        } finally {
          await rendered.dispose();
        }
      }
    }
  });

  it("renders the dense 3072-voice fixture inside its node table", {
    timeout: 120_000,
  }, async () => {
    const plan = {
      version: 1,
      engine: "sc-litmus",
      tuning: { kind: "edo", divisions: 19 },
      referenceHz: 440,
      normalize: false,
      tempoBpm: 120,
      durationSecs: 0.5,
      seed: Array.from({ length: 512 }, () => ({
        degree: 0,
        octave: 0,
        startBeat: 0,
        beats: 0.125,
        velocity: 1,
      })),
    };
    const rendered = await renderLocal(plan, { tempRoot: await root() });
    try {
      const master = await measure(rendered.artifacts[0]!.master);
      evidence.push({
        kind: "dense",
        notes: 4096,
        concurrentVoices: 3072,
        nodeSlots: 4096,
        masterLufs: master.integratedLufs,
        masterTruePeakDbtp: master.truePeakDbtp,
      });
    } finally {
      await rendered.dispose();
    }
  });

  it("runs the litmusRender job handler end to end for a study family", {
    timeout: 180_000,
  }, async () => {
    const workDir = await root();
    const uploads: {
      artifact: NewArtifact;
      bytes: number;
      mimeType: string;
    }[] = [];
    const pending = new Map<string, NewArtifact>();
    const tools: ToolClient = {
      generateAudioUploadUrl: async ({ artifact }) => {
        const artifactId = `artifact-${pending.size}`;
        pending.set(artifactId, artifact);
        return { artifactId, uploadUrl: `memory://${artifactId}` };
      },
      uploadBytes: async (uploadUrl, path, mimeType) => {
        const artifactId = uploadUrl.replace("memory://", "");
        uploads.push({
          artifact: pending.get(artifactId)!,
          bytes: (await stat(path)).size,
          mimeType,
        });
        return { storageId: `storage-${artifactId}` };
      },
      attachAudioStorage: async () => null,
    };
    const tuning: TuningSpec = { kind: "edo", divisions: 19 };
    const job: ClaimedMediaJob = {
      jobId: "job-1",
      kind: "litmusRender",
      leaseToken: "lease",
      leaseExpiresAt: Date.now() + 60_000,
      attempts: 0,
      input: {
        kind: "litmusRender",
        recipeId: "recipe-1" as never,
        recipeUpdatedAt: 1,
        rendererVersion: "0.3.0",
        renderPlan: {
          version: 1,
          engine: "sc-litmus",
          tuning,
          referenceHz: 432,
          normalize: true,
          variable: { kind: "referenceHz", variants: [440] },
          tempoBpm: 120,
          durationSecs: 2,
          seed: generateSeedEvents([], tuning).events.slice(0, 4),
        },
      },
    };
    const result = await litmusRenderHandler({
      job,
      workDir,
      tools,
      rendererVersion: "0.3.0",
      signal: new AbortController().signal,
    });
    expect(result.members.map((member) => member.member)).toEqual([0, 1]);
    expect(uploads.map((upload) => upload.artifact.role)).toEqual([
      "masterNormalized",
      "delivery",
      "masterNormalized",
      "delivery",
    ]);
    for (const member of result.members) {
      for (const artifact of [member.master, member.delivery]) {
        expect(Math.abs(artifact.loudnessLufs + 18)).toBeLessThanOrEqual(0.5);
        expect(artifact.truePeakDbtp).toBeLessThanOrEqual(-1);
      }
    }
    evidence.push({
      kind: "handler",
      members: result.members,
      uploads: uploads.map((upload) => ({
        role: upload.artifact.role,
        encoding: upload.artifact.encoding,
        mimeType: upload.mimeType,
        bytes: upload.bytes,
      })),
    });
  });
});
