import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

test("root TypeScript discovers maintained code without private scratchpad helpers", () => {
  const fixture = mkdtempSync(join(tmpdir(), "frequency-typecheck-"));
  const root = fileURLToPath(new URL("../", import.meta.url));
  const maintained = [
    "vite.config.ts",
    "env.d.ts",
    "convex/http.ts",
    "convex/shared/contract.ts",
    "harness/pipeline.test.ts",
    "scripts/cli.ts",
    "scripts/check.mjs",
  ];
  const outsideRoot = [
    "scratchpad/private.ts",
    "web/src/app.ts",
    "agent/src/worker.ts",
    "media/src/main.ts",
    "scripts/archive/old.ts",
  ];

  try {
    copyFileSync(join(root, "tsconfig.json"), join(fixture, "tsconfig.json"));
    for (const name of [...maintained, ...outsideRoot]) {
      const path = join(fixture, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "export {};\n");
    }
    const output = execFileSync(
      join(root, "node_modules/.bin/tsc"),
      ["--showConfig", "--project", fixture],
      { encoding: "utf8" },
    );
    const config = JSON.parse(output) as { files: string[] };
    const discovered = config.files.map((path) =>
      relative(fixture, resolve(fixture, path)),
    );
    expect(discovered.toSorted()).toEqual(maintained.toSorted());
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
