import type { Dirent } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, normalize } from "node:path";

// A prepared batch reserves its essays even before synthesis starts. Keep
// manifests with their audio so unpublished trials also prevent repeats.
export async function reservedSources(
  root: string,
  currentBatch?: string,
): Promise<Map<string, string>> {
  const reserved = new Map<string, string>();
  let directories: Dirent[];
  try {
    directories = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return reserved;
    throw error;
  }
  for (const directory of directories) {
    if (!directory.isDirectory() || directory.name === currentBatch) continue;
    const path = join(root, directory.name, "manifest.json");
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    let manifest: unknown;
    try {
      manifest = JSON.parse(raw);
    } catch {
      throw new Error(`${path}: manifest is not valid JSON`);
    }
    if (
      typeof manifest !== "object" ||
      manifest === null ||
      Array.isArray(manifest) ||
      !("entries" in manifest) ||
      !Array.isArray(manifest.entries)
    ) {
      throw new Error(`${path}: manifest must have an entries array`);
    }
    for (const entry of manifest.entries) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        Array.isArray(entry) ||
        !("source" in entry) ||
        typeof entry.source !== "string" ||
        entry.source.trim() === ""
      ) {
        throw new Error(
          `${path}: manifest entry must have a nonempty source string`,
        );
      }
      reserved.set(normalize(entry.source), directory.name);
    }
  }
  return reserved;
}

export function assertNewSources(
  sources: string[],
  published: Set<string>,
  reserved: Map<string, string>,
): void {
  const seen = new Set<string>();
  for (const source of sources.map((source) => normalize(source))) {
    if (seen.has(source)) throw new Error(`${source}: repeated within batch`);
    seen.add(source);
    if (published.has(source)) throw new Error(`${source}: already published`);
    const batch = reserved.get(source);
    if (batch) throw new Error(`${source}: already reserved by batch ${batch}`);
  }
}
