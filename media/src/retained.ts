import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stableStringify } from "../../convex/shared/stableHash";

export const sha256Hex = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export const retainedKey = (input: unknown) =>
  sha256Hex(stableStringify(input));

/** Rename publishes complete files only. Lease attempts never share scratch files. */
export async function writeCheckpoint(
  dir: string,
  key: string,
  value: unknown,
) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const temporary = join(dir, `${key}.${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, join(dir, `${key}.json`));
}
export async function readCheckpoint<T>(
  dir: string,
  key: string,
): Promise<T | undefined> {
  try {
    const value: unknown = JSON.parse(
      await readFile(join(dir, `${key}.json`), "utf8"),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Corrupt retained checkpoint; refusing regeneration");
    return value as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function restoreChunk(
  dir: string,
  key: string,
  output: string,
): Promise<boolean> {
  const record = await readCheckpoint<{ file: string; sha256: string }>(
    dir,
    key,
  );
  if (!record) {
    const intent = await readCheckpoint<{ status: string }>(
      dir,
      `${key}-intent`,
    );
    if (intent && intent.status !== "failed")
      throw new Error(
        "Acknowledged or unfinished chunk checkpoint missing; refusing paid synthesis",
      );
    return false;
  }
  // Cache metadata is local, but never allow it to escape its owned directory.
  if (!/^[a-f0-9-]+\.wav$/.test(record.file))
    throw new Error("Invalid retained audio filename");
  const bytes = await readFile(join(dir, record.file));
  if (sha256Hex(bytes) !== record.sha256) {
    throw new Error(
      "Retained audio checksum mismatch; refusing paid synthesis",
    );
  }
  await writeFile(output, bytes);
  return true;
}
export async function retainChunk(dir: string, key: string, input: string) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const bytes = await readFile(input);
  if (bytes.length === 0) throw new Error("TTS returned empty audio");
  const file = `${randomUUID()}.wav`;
  await writeFile(join(dir, file), bytes, { mode: 0o600 });
  await writeCheckpoint(dir, key, { file, sha256: sha256Hex(bytes) });
  await writeCheckpoint(dir, `${key}-intent`, { status: "completed" });
}

export async function beginSynthesis(dir: string, key: string) {
  await writeCheckpoint(dir, `${key}-intent`, { status: "started" });
}
export async function failSynthesis(dir: string, key: string) {
  await writeCheckpoint(dir, `${key}-intent`, { status: "failed" });
}
