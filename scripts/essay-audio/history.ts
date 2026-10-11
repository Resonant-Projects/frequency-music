import { readFile, readdir } from "node:fs/promises";
import { join, normalize } from "node:path";

// A prepared batch reserves its essays even before synthesis starts. Keep
// manifests with their audio so unpublished trials also prevent repeats.
export async function reservedSources(
  root: string,
  currentBatch?: string,
): Promise<Map<string, string>> {
  const reserved = new Map<string, string>();
  let directories;
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
    const manifest = JSON.parse(raw) as { entries: { source: string }[] };
    for (const entry of manifest.entries) {
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
