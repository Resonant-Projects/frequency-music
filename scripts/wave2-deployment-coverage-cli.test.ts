import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";

const repoRoot = join(import.meta.dirname, "..");

// The CLI reads no environment, so the child receives only these names.
function run(args: string[]) {
  return spawnSync(
    "vpx",
    ["tsx", "scripts/wave2-deployment-coverage.ts", ...args],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        APP_ENV: "test",
      } as unknown as typeof process.env,
    },
  );
}

describe("wave 2 deployment coverage CLI", () => {
  test("an inspection without Wave 2 modules exits 3 and lists web skew", () => {
    const path = join(mkdtempSync(join(tmpdir(), "coverage-")), "i.json");
    writeFileSync(
      path,
      JSON.stringify({
        format: "frequency-deployment-inspection-v1",
        finishedAt: "2026-10-17T00:00:00.000Z",
        modules: [
          {
            componentId: null,
            modules: [
              {
                path: "podcast.js",
                functions: [
                  {
                    name: "subscription",
                    udfType: "Query",
                    visibility: { kind: "public" },
                  },
                ],
                crons: [],
              },
            ],
          },
        ],
      }),
    );
    const result = run([path]);
    expect(result.status).toBe(3);
    const report = JSON.parse(result.stdout);
    expect(report.complete).toBe(false);
    expect(report.webCalls.missing).toContain("docket:listWeb");
    expect(report.webCalls.missing).not.toContain("podcast:subscription");
  });

  test("invalid input exits 2 without echoing the file", () => {
    const path = join(mkdtempSync(join(tmpdir(), "coverage-")), "i.json");
    writeFileSync(path, '{"secret":"do-not-print"}');
    const result = run([path]);
    expect(result.status).toBe(2);
    expect(result.stdout + result.stderr).not.toContain("do-not-print");
    expect(run([]).status).toBe(2);
  });
});
