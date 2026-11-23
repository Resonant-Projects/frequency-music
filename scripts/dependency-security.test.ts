import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";
import { AUDITED_CONVEX_VERSION } from "./lib/convex-provenance";

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

/** GHSA-qw8j-4xj7-6f28 and GHSA-9mw5-7p28-rvv4 are both fixed in convex 1.48.0. */
const CONVEX_SECURITY_FLOOR = "1.48.0";

/** Every resolved version of a package, prereleases included, so the floor
 * check sees each copy the lockfile holds. */
function resolvedFullVersions(lockfile: string, name: string): string[] {
  const pattern = new RegExp(`\\["${name}@([^"]+)"`, "g");
  return [...lockfile.matchAll(pattern)].map((match) => match[1] as string);
}

/** True when a stable or prerelease SemVer version meets a stable floor. A
 * prerelease sorts below its own release, and any other shape fails. */
function meetsFloor(version: string, floor: string): boolean {
  const match = version.match(/^(\d+\.\d+\.\d+)(-[0-9A-Za-z.-]+)?$/);
  if (!match) return false;
  const release = match[1] as string;
  if (match[2] === undefined) return atLeast(release, floor);
  return release !== floor && atLeast(release, floor);
}

/** The lowest version a `^x.y.z`, `~x.y.z`, or exact `x.y.z` spec allows;
 * undefined for any other shape, so an unrecognised spec fails the floor. */
function specLowerBound(spec: string | undefined): string | undefined {
  return spec?.match(/^[\^~]?(\d+\.\d+\.\d+)$/)?.[1];
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
    { directory: root },
    { directory: join(root, "agent") },
    { directory: join(root, "web") },
    { directory: join(root, "media") },
  ];

  test.each(workspaces)(
    `$directory resolves Convex at or above its patched security floor (${CONVEX_SECURITY_FLOOR}) and patched WebSocket versions`,
    ({ directory }) => {
      const manifest = readJson(join(directory, "package.json"));
      const lockfile = readFileSync(join(directory, "bun.lock"), "utf8");
      const convexVersions = resolvedFullVersions(lockfile, "convex");
      const wsVersions = resolvedVersions(lockfile, "ws");

      const lowerBound = specLowerBound(manifest.dependencies?.convex);
      expect(
        lowerBound,
        `convex spec ${manifest.dependencies?.convex}`,
      ).toBeDefined();
      expect(atLeast(lowerBound ?? "0.0.0", CONVEX_SECURITY_FLOOR)).toBe(true);
      expect(convexVersions.length).toBeGreaterThan(0);
      for (const version of convexVersions) {
        expect(
          meetsFloor(version, CONVEX_SECURITY_FLOOR),
          `convex@${version}`,
        ).toBe(true);
      }
      expect(wsVersions.length).toBeGreaterThan(0);
      expect(wsVersions.filter(isAffectedWs)).toEqual([]);
    },
  );

  test("the root workspace resolves exactly the audited Convex CLI used for deploys", () => {
    // convex-deploy loads the top-level package; nested copies only need the floor.
    const lockfile = readFileSync(join(root, "bun.lock"), "utf8");
    const topLevel = lockfile.match(/^\s*"convex": \["convex@([^"]+)"/m)?.[1];
    expect(topLevel).toBe(AUDITED_CONVEX_VERSION);
  });

  test("the Convex floor rejects every unpatched version", () => {
    for (const spec of [
      "^1.47.0",
      "~1.47.9",
      "1.46.0",
      "0.99.0",
      ">=1.48.0",
      "latest",
      undefined,
    ]) {
      const lowerBound = specLowerBound(spec);
      expect(
        lowerBound !== undefined && atLeast(lowerBound, CONVEX_SECURITY_FLOOR),
        String(spec),
      ).toBe(false);
    }
    for (const spec of ["^1.48.0", "1.48.0", "~1.51.0", "1.51.0", "2.0.0"]) {
      const lowerBound = specLowerBound(spec);
      expect(
        lowerBound !== undefined && atLeast(lowerBound, CONVEX_SECURITY_FLOOR),
        spec,
      ).toBe(true);
    }
    const lockfile =
      '"convex": ["convex@1.51.0", "", {}],\n"x/convex": ["convex@1.48.0-rc.1", "", {}]';
    expect(resolvedFullVersions(lockfile, "convex")).toEqual([
      "1.51.0",
      "1.48.0-rc.1",
    ]);
    for (const version of ["1.47.2", "1.48.0-rc.1", "1.47.9-beta", "next"]) {
      expect(meetsFloor(version, CONVEX_SECURITY_FLOOR), version).toBe(false);
    }
    for (const version of ["1.48.0", "1.48.1-rc.1", "1.51.0"]) {
      expect(meetsFloor(version, CONVEX_SECURITY_FLOOR), version).toBe(true);
    }
  });

  test.each(workspaces)(
    "$directory resolves Hono only at or above its patched security floor (4.13.7)",
    ({ directory }) => {
      const lockfile = readFileSync(join(directory, "bun.lock"), "utf8");
      // A workspace that resolves no Hono at all has nothing to patch.
      for (const version of resolvedVersions(lockfile, "hono")) {
        expect(atLeast(version, "4.13.7"), `hono@${version}`).toBe(true);
      }
    },
  );

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
