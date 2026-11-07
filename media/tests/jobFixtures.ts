import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, vi } from "vite-plus/test";
import type { NewArtifact, ToolClient } from "../src/jobs/types";

const dirs: string[] = [];
export function workDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

// Records every artifact minted, the path uploaded for it, and the signal
// each upload received.
export function fakeTools() {
  const minted: NewArtifact[] = [];
  const uploaded: { path: string; mimeType: string; signal?: AbortSignal }[] =
    [];
  const tools: ToolClient = {
    generateAudioUploadUrl: vi.fn(async ({ artifact }) => {
      minted.push(artifact);
      return {
        artifactId: `a${minted.length}`,
        uploadUrl: "http://upload.test/x",
      };
    }),
    attachAudioStorage: vi.fn(async () => null),
    uploadBytes: vi.fn(
      async (
        _url: string,
        path: string,
        mimeType: string,
        signal?: AbortSignal,
      ) => {
        uploaded.push({ path, mimeType, signal });
        return { storageId: `s${uploaded.length}` };
      },
    ),
  };
  return { tools, minted, uploaded };
}

export const narrateJob = {
  jobId: "j",
  kind: "narrate" as const,
  leaseToken: "L",
  leaseExpiresAt: Date.now() + 60_000,
  attempts: 0,
  input: {
    kind: "narrate" as const,
    script: {
      paragraphs: ["Short one.", "This is a longer second paragraph here."],
      chapters: [
        { title: "A", startParagraph: 0 },
        { title: "B", startParagraph: 1 },
      ],
    },
    voiceId: "inworld-max",
    promptVersion: "narration.v1",
    target: "spoken" as const,
    title: "T",
    access: "feed" as const,
    refs: { weeklyBriefId: "wb1" as never },
    assembleOnDone: false,
    rendererVersion: "0.2.0",
  },
};
