// The web app's Vercel build installs only web/ dependencies, so every module
// the browser bundle reaches through convex/ must resolve its packages there.
// A local build passes regardless because the root node_modules is present.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";

const root = resolve(import.meta.dirname, "../..");
const web = join(root, "web");
const manifest = JSON.parse(readFileSync(join(web, "package.json"), "utf8"));
const webPackages = new Set(
  Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }),
);

// Runtime imports and re-exports only; `import type` is erased by the build.
const IMPORT =
  /^\s*(?:import|export)\s+(?!type\s)(?:[^;]*?\sfrom\s+)?["']([^"']+)["']/gm;

function runtimeSpecifiers(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(IMPORT)].map((m) => m[1]!);
}

function resolveRelative(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier);
  return (
    [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
    ) ?? null
  );
}

function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Packages reached from web/src through convex/ that web/ does not install. */
function missingWebPackages(): string[] {
  const missing = new Set<string>();
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const specifier of runtimeSpecifiers(file)) {
      if (specifier.startsWith(".")) {
        const target = resolveRelative(file, specifier);
        if (target && !relative(root, target).startsWith("web/")) visit(target);
      } else if (
        !relative(root, file).startsWith("web/") &&
        !specifier.startsWith("node:") &&
        !webPackages.has(packageName(specifier))
      )
        missing.add(`${relative(root, file)} -> ${specifier}`);
    }
  };
  for (const file of sourceFiles(join(web, "src"))) {
    for (const specifier of runtimeSpecifiers(file)) {
      if (!specifier.startsWith(".")) continue;
      const target = resolveRelative(file, specifier);
      if (target && !relative(root, target).startsWith("web/")) visit(target);
    }
  }
  return [...missing].toSorted();
}

describe("web bundle import boundary", () => {
  test("convex modules the browser imports at runtime use only web packages", () => {
    expect(missingWebPackages()).toEqual([]);
  });
});
