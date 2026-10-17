import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";

const repoRoot = join(import.meta.dirname, "..");

// The CLI reads no environment, so the child receives only these names.
function run(args: string[]) {
  return spawnSync(
    "vpx",
    ["tsx", "scripts/studio-validation-kit.ts", ...args],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        APP_ENV: "test",
      },
    },
  );
}

describe("studio validation kit CLI", () => {
  test("writes the packet and a manifest into a new directory", () => {
    const out = join(mkdtempSync(join(tmpdir(), "studio-kit-")), "packet");
    const result = run(["--out", out]);
    expect(result.status).toBe(0);
    const manifest = JSON.parse(
      readFileSync(join(out, "manifest.json"), "utf8"),
    );
    expect(manifest.kits).toHaveLength(3);
    for (const entry of manifest.files) {
      expect(readFileSync(join(out, entry.path)).byteLength).toBe(entry.bytes);
    }
  });

  test("refuses a non-empty directory and a missing --out", () => {
    const out = mkdtempSync(join(tmpdir(), "studio-kit-"));
    writeFileSync(join(out, "keep.txt"), "x");
    expect(run(["--out", out]).status).toBe(2);
    expect(readFileSync(join(out, "keep.txt"), "utf8")).toBe("x");
    expect(run([]).status).toBe(2);
  });
});
