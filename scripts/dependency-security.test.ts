import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as {
    dependencies?: Record<string, string>;
    overrides?: Record<string, string>;
  };
}

function resolvedWsVersions(lockfile: string): string[] {
  return [...lockfile.matchAll(/\["ws@(\d+\.\d+\.\d+)"/g)].map(
    (match) => match[1] as string,
  );
}

function atLeast(version: string, floor: string): boolean {
  const a = version.split(".").map(Number);
  const b = floor.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}

function isAffectedWs(version: string): boolean {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
  if (major === 7) return minor < 5 || (minor === 5 && patch < 11);
  if (major === 8) return minor < 21;
  return false;
}

describe("Convex dependency security floor", () => {
  const workspaces = [
    { directory: root, convex: "^1.46.0" },
    { directory: join(root, "agent"), convex: "1.46.0" },
    { directory: join(root, "web"), convex: "^1.46.0" },
    { directory: join(root, "media"), convex: "1.46.0" },
  ];

  test.each(
    workspaces,
  )("$directory uses Convex 1.46 and resolves patched WebSocket versions", ({
    directory,
    convex,
  }) => {
    const manifest = readJson(join(directory, "package.json"));
    const lockfile = readFileSync(join(directory, "bun.lock"), "utf8");
    const wsVersions = resolvedWsVersions(lockfile);

    expect(manifest.dependencies?.convex).toBe(convex);
    expect(lockfile).toContain('"convex@1.46.0"');
    expect(wsVersions.length).toBeGreaterThan(0);
    expect(wsVersions.filter(isAffectedWs)).toEqual([]);
  });

  test("the runtime workspaces pin Hono at or above its patched security floor", () => {
    const agentManifest = readJson(join(root, "agent", "package.json"));
    const webManifest = readJson(join(root, "web", "package.json"));
    const pins = [
      agentManifest.dependencies?.hono,
      agentManifest.overrides?.hono,
      webManifest.overrides?.hono,
    ];

    for (const pin of pins) {
      expect(pin).toMatch(/^\d+\.\d+\.\d+$/);
      expect(atLeast(pin as string, "4.12.34")).toBe(true);
    }
  });
});
