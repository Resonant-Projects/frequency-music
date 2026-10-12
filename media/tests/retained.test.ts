import { mkdtemp, writeFile, unlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "vite-plus/test";
import {
  retainChunk,
  retainedKey,
  restoreChunk,
  beginSynthesis,
  failSynthesis,
} from "../src/retained";

test("lost or null acknowledged chunk metadata refuses regeneration", async () => {
  const dir = await mkdtemp(join(tmpdir(), "retained-audio-"));
  try {
    const source = join(dir, "input.wav");
    await writeFile(source, "completed audio");
    const key = retainedKey("chunk");
    await retainChunk(dir, key, source);
    expect(await restoreChunk(dir, key, join(dir, "restored.wav"))).toBe(true);
    await unlink(join(dir, `${key}.json`));
    await expect(
      restoreChunk(dir, key, join(dir, "restored.wav")),
    ).rejects.toThrow("checkpoint missing");
    await writeFile(join(dir, `${key}.json`), "null");
    await expect(
      restoreChunk(dir, key, join(dir, "restored.wav")),
    ).rejects.toThrow("Corrupt retained checkpoint");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("unfinished synthesis requires review while a confirmed failed call can retry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "retained-intent-"));
  try {
    const key = retainedKey("chunk");
    expect(await restoreChunk(dir, key, join(dir, "output.wav"))).toBe(false);
    await beginSynthesis(dir, key);
    await expect(
      restoreChunk(dir, key, join(dir, "output.wav")),
    ).rejects.toThrow("unfinished chunk");
    await failSynthesis(dir, key);
    expect(await restoreChunk(dir, key, join(dir, "output.wav"))).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
