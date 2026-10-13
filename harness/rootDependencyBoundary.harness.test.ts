// Root CI installs only the root package, so every agent module the harness
// loads must resolve its runtime packages from root dependencies. A local
// checkout with agent/node_modules masks a violation; this static walk does not.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { parseSync } from "vite-plus";
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

/** Runtime module requests, from a real parse: type-only imports and
 * re-exports erase; a dynamic import must be a literal, else it is reported
 * as its source text so the guard fails closed. */
function specifiersIn(source: string, filename = "source.ts") {
  const { errors, module } = parseSync(filename, source, { lang: "ts" });
  if (errors.length > 0) throw new Error(`cannot parse ${filename}`);
  const imports = module.staticImports
    .filter(
      (entry) =>
        entry.entries.length === 0 || entry.entries.some((e) => !e.isType),
    )
    .map((entry) => entry.moduleRequest.value);
  const exports = module.staticExports.flatMap((entry) =>
    entry.entries.flatMap((e) =>
      e.moduleRequest && !e.isType ? [e.moduleRequest.value] : [],
    ),
  );
  const dynamic = module.dynamicImports.map(({ moduleRequest }) => {
    const text = source.slice(moduleRequest.start, moduleRequest.end);
    return /^(["'`])([^"'`$\\]*)\1$/.exec(text)?.[2] ?? `import(${text})`;
  });
  return [...imports, ...exports, ...dynamic];
}

function runtimeSpecifiers(file: string) {
  return specifiersIn(readFileSync(file, "utf8"), file);
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
  const violations: string[] = [];
  const queue: string[] = [];
  for (const file of harnessFiles) {
    for (const specifier of runtimeSpecifiers(file)) {
      if (specifier.startsWith(".")) {
        const next = agentModule(file, specifier);
        if (next) queue.push(next);
      } else if (specifier.startsWith("import(")) {
        // A computed import could load any agent module unseen.
        violations.push(`${relative(root, file)} -> ${specifier}`);
      }
    }
  }
  const seen = new Set<string>();
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
  test("the scanner sees every runtime import form and skips type imports", () => {
    expect(
      specifiersIn(`import {
  a,
  type B,
} from "multi";
import "side-effect";
export { c } from "./re-export.js";
export * from "star";
import type { D } from "type-only";
import { type F } from "inline-type-only";
export type { E } from "type-reexport";
const lazy = await import("dynamic");
const attributed = await import("with-options", { with: {} });
const commented = import(/* lazy */ "commented");
const trailing = import("trailing" /* lazy */);
const template = import(\`template\`);
const computed = import(name);
// import("in-comment")
const text = "import('in-string')";
`).toSorted(),
    ).toEqual([
      "./re-export.js",
      "commented",
      "dynamic",
      "import(name)",
      "multi",
      "side-effect",
      "star",
      "template",
      "trailing",
      "with-options",
    ]);
  });

  test("agent modules loaded by the harness need only root packages", () => {
    const { visited, violations } = agentPackageImports();
    expect(visited).toContain(
      "agent/src/graphs/hypothesis-tournament/finalize.ts",
    );
    expect(violations).toEqual([]);
  });
});
