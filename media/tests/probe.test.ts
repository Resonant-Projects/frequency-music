import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import type { Measurement } from "../src/audio/loudness";
import { probeHandler } from "../src/jobs/probe";
import type { ToolClient } from "../src/jobs/types";

type Measure = (path: string) => Promise<Measurement>;
const { measureOverride } = vi.hoisted(() => ({
  measureOverride: {
    fn: undefined as
      | undefined
      | ((path: string, actual: Measure) => Promise<Measurement>),
  },
}));

// Passthrough by default; a test can override `measure` for one file without
// touching normalize()'s internal measurement.
vi.mock("../src/audio/loudness", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/audio/loudness")>();
  return {
    ...actual,
    measure: (path: string) =>
      measureOverride.fn
        ? measureOverride.fn(path, actual.measure)
        : actual.measure(path),
  };
});

afterEach(() => {
  measureOverride.fn = undefined;
});

function fakeTools(uploads: string[]): ToolClient {
  return {
    generateAudioUploadUrl: vi.fn(async ({ artifact }) => {
      uploads.push(artifact.role);
      return {
        artifactId: `a-${uploads.length}`,
        uploadUrl: "http://upload.test/x",
      };
    }),
    attachAudioStorage: vi.fn(async () => null),
    uploadBytes: vi.fn(async () => ({ storageId: "st1" })),
  };
}

const job = {
  jobId: "j1",
  kind: "probe",
  input: { kind: "probe", toneHz: 440, seconds: 2, rendererVersion: "0.1.0" },
  leaseToken: "lease",
  leaseExpiresAt: Date.now() + 60_000,
  attempts: 0,
} as const;

describe("probe job", () => {
  test("synthesizes, normalizes to spoken target, encodes, uploads master and delivery, returns measurements", async () => {
    const uploads: string[] = [];
    const tools = fakeTools(uploads);
    const result = await probeHandler({
      job,
      workDir: mkdtempSync(join(tmpdir(), "probe-")),
      tools,
      rendererVersion: "0.1.0",
      signal: new AbortController().signal,
    });
    expect(result.kind).toBe("probe");
    expect(uploads).toEqual(["masterNormalized", "delivery"]);
    expect(result.artifacts).toHaveLength(2);
    for (const artifact of result.artifacts) {
      expect(Math.abs(artifact.loudnessLufs + 16)).toBeLessThanOrEqual(0.5);
      expect(artifact.truePeakDbtp).toBeLessThanOrEqual(-1);
    }
    expect(tools.attachAudioStorage).toHaveBeenCalledTimes(2);
  });

  test("a delivery that breaks the true-peak ceiling is rejected before any upload is minted for it", async () => {
    measureOverride.fn = async (path, actual) =>
      path.endsWith(".mp3")
        ? { integratedLufs: -16, truePeakDbtp: -0.5, durationSecs: 2 }
        : actual(path);
    const uploads: string[] = [];
    const tools = fakeTools(uploads);
    await expect(
      probeHandler({
        job,
        workDir: mkdtempSync(join(tmpdir(), "probe-hot-")),
        tools,
        rendererVersion: "0.1.0",
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/dBTP/);
    // The master passed policy and was uploaded; the delivery never reached Convex.
    expect(uploads).toEqual(["masterNormalized"]);
    expect(tools.generateAudioUploadUrl).toHaveBeenCalledTimes(1);
    expect(tools.uploadBytes).toHaveBeenCalledTimes(1);
    expect(tools.attachAudioStorage).toHaveBeenCalledTimes(1);
  });
});
