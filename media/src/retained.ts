import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { stableStringify } from "../../convex/shared/stableHash";

export const sha256Hex = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export const retainedKey = (input: unknown) =>
  sha256Hex(stableStringify(input));

async function checkpointRoot(dir: string, durableRoot: string) {
  const root = resolve(durableRoot);
  const path = relative(root, resolve(dir));
  if (path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path))
    throw new Error("Retained directory is outside its durable work-root");
  // The host provisions this boundary; checkpoint writes own only its children.
  if (!(await stat(root)).isDirectory())
    throw new Error("Retained work-root must be an existing directory");
  return root;
}

async function syncDirectoryTree(dir: string, root: string) {
  let current = resolve(dir);
  for (;;) {
    const handle = await open(current, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (current === root) return;
    current = dirname(current);
  }
}

async function writeDurableFile(path: string, bytes: string | Uint8Array) {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Persist atomic files and directory entries through a provisioned durable root. */
export async function writeCheckpoint(
  dir: string,
  key: string,
  value: unknown,
  durableRoot = dir,
) {
  const root = await checkpointRoot(dir, durableRoot);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const temporary = join(dir, `${key}.${randomUUID()}.tmp`);
  await writeDurableFile(temporary, JSON.stringify(value));
  await rename(temporary, join(dir, `${key}.json`));
  await syncDirectoryTree(dir, root);
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
export async function retainChunk(
  dir: string,
  key: string,
  input: string,
  durableRoot = dir,
) {
  await checkpointRoot(dir, durableRoot);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const bytes = await readFile(input);
  if (bytes.length === 0) throw new Error("TTS returned empty audio");
  const file = `${randomUUID()}.wav`;
  await writeDurableFile(join(dir, file), bytes);
  await writeCheckpoint(
    dir,
    key,
    { file, sha256: sha256Hex(bytes) },
    durableRoot,
  );
  await writeCheckpoint(
    dir,
    `${key}-intent`,
    { status: "completed" },
    durableRoot,
  );
}

export async function beginSynthesis(
  dir: string,
  key: string,
  durableRoot = dir,
) {
  await writeCheckpoint(
    dir,
    `${key}-intent`,
    { status: "started" },
    durableRoot,
  );
}
export async function failSynthesis(
  dir: string,
  key: string,
  durableRoot = dir,
) {
  await writeCheckpoint(
    dir,
    `${key}-intent`,
    { status: "failed" },
    durableRoot,
  );
}
