// Root CI installs only the root package, so every agent module the harness
// loads must resolve its runtime packages from root dependencies. A local
// checkout with agent/node_modules masks a violation; this static walk does not.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";

const root = resolve(import.meta.dirname, "..");
const agentDir = join(root, "agent");
const rootPackage = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
) as Record<string, Record<string, string> | undefined>;
const rootPackages = new Set([
  ...Object.keys(rootPackage.dependencies ?? {}),
  ...Object.keys(rootPackage.devDependencies ?? {}),
]);
const builtins = new Set(builtinModules);

// Static runtime imports and re-exports; `import type` and `export type` erase.
const specifierPattern =
  /^\s*(?:import|export)\s+(?!type\s)(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/gm;

function runtimeSpecifiers(file: string) {
  return [...readFileSync(file, "utf8").matchAll(specifierPattern)].map(
    (match) => match[1]!,
  );
}

/** The agent source a relative import loads; root modules are out of scope. */
function agentModule(from: string, specifier: string) {
  const base = resolve(dirname(from), specifier);
  if (!base.startsWith(`${agentDir}/`)) return undefined;
  const candidates = [
    base.replace(/\.js$/, ".ts"),
    base,
    `${base}.ts`,
    join(base, "index.ts"),
  ];
  const found = candidates.find(
    (path) => path.endsWith(".ts") && existsSync(path),
  );
  if (!found) throw new Error(`unresolved ${specifier} from ${from}`);
  return found;
}

function packageName(specifier: string) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

function isRootResolvable(specifier: string) {
  if (specifier.startsWith("node:")) return true;
  const name = packageName(specifier);
  return builtins.has(name) || rootPackages.has(name);
}

/** Bare packages reached from the harness through agent sources. */
function agentPackageImports() {
  const harnessFiles = readdirSync(join(root, "harness"), {
    recursive: true,
    encoding: "utf8",
  })
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join(root, "harness", name));
  const queue = harnessFiles.flatMap((file) =>
    runtimeSpecifiers(file).flatMap((specifier) =>
      specifier.startsWith(".") ? (agentModule(file, specifier) ?? []) : [],
    ),
  );
  const seen = new Set<string>();
  const violations: string[] = [];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of runtimeSpecifiers(file)) {
      if (specifier.startsWith(".")) {
        const next = agentModule(file, specifier);
        if (next) queue.push(next);
      } else if (!isRootResolvable(specifier)) {
        violations.push(`${relative(root, file)} -> ${specifier}`);
      }
    }
  }
  return { visited: [...seen].map((file) => relative(root, file)), violations };
}

describe("root harness dependency boundary", () => {
  test("agent modules loaded by the harness need only root packages", () => {
    const { visited, violations } = agentPackageImports();
    expect(visited).toContain(
      "agent/src/graphs/hypothesis-tournament/finalize.ts",
    );
    expect(violations).toEqual([]);
  });
});
