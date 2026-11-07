import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { synthTone } from "../src/audio/synth";
import {
  assembleEpisodeHandler,
  EPISODE_LEAD_IN_SECS,
} from "../src/jobs/assembleEpisode";
import { fakeTools, workDir } from "./jobFixtures";

describe("assembleEpisode job", () => {
  let server: Server | undefined;
  afterAll(() => {
    server?.close();
  });

  // Serves one WAV the way Convex storage does: a plain GET by URL.
  async function serveWav(path: string): Promise<string> {
    const bytes = await readFile(path);
    server = createServer((request, response) => {
      if (request.url === "/redirect") {
        response.writeHead(302, { location: "/narration" });
        response.end();
        return;
      }
      if (request.url !== "/narration") {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { "content-type": "audio/wav" });
      response.end(bytes);
    });
    await new Promise<void>((resolve) =>
      server!.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  test("downloads the narration master, prepends the lead-in, shifts chapters, uploads private master and feed delivery", async () => {
    const dir = workDir("episode-src-");
    const narration = join(dir, "narration-master.wav");
    await synthTone(narration, { hz: 440, seconds: 2, gainDb: -20 });
    const base = await serveWav(narration);
    const { tools, minted, uploaded } = fakeTools();
    const signal = new AbortController().signal;
    const chapters = [
      { title: "Open", startSecs: 0 },
      { title: "Next", startSecs: 1.25 },
    ];
    const result = await assembleEpisodeHandler({
      job: {
        jobId: "e",
        kind: "assembleEpisode",
        leaseToken: "L",
        leaseExpiresAt: Date.now() + 60_000,
        attempts: 0,
        input: {
          kind: "assembleEpisode",
          narrationArtifactId: "n1" as never,
          narrationStorageUrl: `${base}/narration`,
          title: "Weekly turn",
          chapters,
          refs: { weeklyBriefId: "wb1" as never },
          rendererVersion: "0.2.0",
        },
      },
      workDir: workDir("episode-"),
      tools,
      rendererVersion: "0.2.0",
      signal,
    });
    expect(result.kind).toBe("assembleEpisode");
    expect(minted.map((artifact) => artifact.role)).toEqual([
      "masterNormalized",
      "delivery",
    ]);
    expect(minted.map((artifact) => artifact.kind)).toEqual([
      "episode",
      "episode",
    ]);
    expect(minted[0]?.access).toBe("private");
    expect(minted[1]?.access).toBe("feed");
    // R29: the episode links back to the brief through the job's refs.
    for (const artifact of minted) {
      expect(artifact.refs).toEqual({ weeklyBriefId: "wb1" });
    }
    const shifted = [
      { title: "Open", startSecs: EPISODE_LEAD_IN_SECS },
      { title: "Next", startSecs: 1.25 + EPISODE_LEAD_IN_SECS },
    ];
    expect(minted[1]?.chapters).toEqual(shifted);
    // R22: the result carries the shifted chapters for the effect to store.
    expect(result.chapters).toEqual(shifted);
    for (const artifact of result.artifacts) {
      expect(artifact.durationSecs).toBeCloseTo(2 + EPISODE_LEAD_IN_SECS, 0);
      expect(Math.abs(artifact.loudnessLufs + 16)).toBeLessThanOrEqual(0.5);
      expect(artifact.truePeakDbtp).toBeLessThanOrEqual(-1);
    }
    for (const upload of uploaded) expect(upload.signal).toBe(signal);

    // A job enqueued before refs existed still assembles, with empty refs.
    const legacy = fakeTools();
    await assembleEpisodeHandler({
      job: {
        jobId: "e",
        kind: "assembleEpisode",
        leaseToken: "L",
        leaseExpiresAt: Date.now() + 60_000,
        attempts: 0,
        input: {
          kind: "assembleEpisode",
          narrationArtifactId: "n1" as never,
          narrationStorageUrl: `${base}/narration`,
          title: "Weekly turn",
          chapters,
          rendererVersion: "0.2.0",
        },
      },
      workDir: workDir("episode-legacy-"),
      tools: legacy.tools,
      rendererVersion: "0.2.0",
      signal,
    });
    expect(legacy.minted.map((artifact) => artifact.refs)).toEqual([{}, {}]);

    // Redirects and missing blobs fail before anything is minted, and the
    // error never carries the URL.
    for (const path of ["/redirect", "/missing"]) {
      const again = fakeTools();
      const error: unknown = await assembleEpisodeHandler({
        job: {
          jobId: "e",
          kind: "assembleEpisode",
          leaseToken: "L",
          leaseExpiresAt: Date.now() + 60_000,
          attempts: 0,
          input: {
            kind: "assembleEpisode",
            narrationArtifactId: "n1" as never,
            narrationStorageUrl: `${base}${path}`,
            title: "Weekly turn",
            chapters,
            rendererVersion: "0.2.0",
          },
        },
        workDir: workDir("episode-bad-"),
        tools: again.tools,
        rendererVersion: "0.2.0",
        signal,
      }).then(
        () => undefined,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/download failed/);
      expect((error as Error).message).not.toContain(base);
      expect(again.minted).toHaveLength(0);
    }
  });
});
