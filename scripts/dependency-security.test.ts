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

function resolvedVersions(lockfile: string, name: string): string[] {
  const pattern = new RegExp(`\\["${name}@(\\d+\\.\\d+\\.\\d+)"`, "g");
  return [...lockfile.matchAll(pattern)].map((match) => match[1] as string);
}

function atLeast(version: string, floor: string): boolean {
  const a = version.split(".").map(Number);
  const b = floor.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}

/** Patched lines: 7.5.11+ on 7.x, 8.21.0+ on 8.x, and any later major. */
function isAffectedWs(version: string): boolean {
  const [major = 0] = version.split(".").map(Number);
  if (major < 7) return true;
  if (major === 7) return !atLeast(version, "7.5.11");
  if (major === 8) return !atLeast(version, "8.21.0");
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
    const wsVersions = resolvedVersions(lockfile, "ws");

    expect(manifest.dependencies?.convex).toBe(convex);
    expect(lockfile).toContain('"convex@1.46.0"');
    expect(wsVersions.length).toBeGreaterThan(0);
    expect(wsVersions.filter(isAffectedWs)).toEqual([]);
  });

  test.each(
    workspaces,
  )("$directory resolves Hono only at or above its patched security floor (4.13.7)", ({
    directory,
  }) => {
    const lockfile = readFileSync(join(directory, "bun.lock"), "utf8");
    // A workspace that resolves no Hono at all has nothing to patch.
    for (const version of resolvedVersions(lockfile, "hono")) {
      expect(atLeast(version, "4.13.7"), `hono@${version}`).toBe(true);
    }
  });

  test("the WebSocket floor rejects every unpatched line", () => {
    for (const version of ["6.2.3", "7.5.10", "8.18.3", "8.20.1"]) {
      expect(isAffectedWs(version), version).toBe(true);
    }
    for (const version of ["7.5.11", "7.5.13", "8.21.0", "8.22.0", "9.0.0"]) {
      expect(isAffectedWs(version), version).toBe(false);
    }
  });

  test("the Hono floor check detects an unpatched resolution", () => {
    const lockfile =
      '"hono": ["hono@4.12.1", "", {}],\n"x": ["hono@4.13.5", "", {}]';
    expect(resolvedVersions(lockfile, "hono")).toEqual(["4.12.1", "4.13.5"]);
    expect(atLeast("4.12.1", "4.13.7")).toBe(false);
    // CVE-2026-93981 (hono/jsx Suspense escaping) is fixed in 4.13.7.
    expect(atLeast("4.13.5", "4.13.7")).toBe(false);
  });
});
