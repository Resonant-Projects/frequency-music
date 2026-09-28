import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vite-plus/test";
import { probeHandler } from "../src/jobs/probe";
import type { ToolClient } from "../src/jobs/types";

describe("probe job", () => {
  test("synthesizes, normalizes to spoken target, encodes, uploads master and delivery, returns measurements", async () => {
    const uploads: string[] = [];
    const tools: ToolClient = {
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
    const result = await probeHandler({
      job: {
        jobId: "j1",
        kind: "probe",
        input: {
          kind: "probe",
          toneHz: 440,
          seconds: 2,
          rendererVersion: "0.1.0",
        },
        leaseToken: "lease",
        leaseExpiresAt: Date.now() + 60_000,
        attempts: 0,
      },
      workDir: mkdtempSync(join(tmpdir(), "probe-")),
      tools,
      rendererVersion: "0.1.0",
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
});
