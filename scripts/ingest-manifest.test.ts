import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vite-plus/test";

const repoRoot = join(import.meta.dirname, "..");

/**
 * The inherited environment can carry a developer's real secrets (varlock
 * populates process.env from 1Password on any dev machine), and process.env
 * outranks .env.test during resolution — so spreading it would hand the child
 * live credentials. Strip every name .env.test declares, leaving the committed
 * placeholders as the only source, exactly as on a CI runner.
 */
function envWithoutSchemaSecrets(): typeof process.env {
  const declared = readFileSync(join(repoRoot, ".env.test"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .filter((name) => name.length > 0);

  const env = { ...process.env };
  for (const name of declared) Reflect.deleteProperty(env, name);
  return env;
}

describe("ingest-manifest CLI", () => {
  test("dry-runs by default without contacting Convex", () => {
    const result = spawnSync(
      "bun",
      ["run", "scripts/ingest-manifest.ts", "data/example-manifest.json"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...envWithoutSchemaSecrets(),
          // The CLI loads `varlock/auto-load` for real; APP_ENV=test resolves
          // every secret from the committed .env.test placeholders so the
          // subprocess never reaches for 1Password.
          APP_ENV: "test",
          // Unroutable on purpose: a dry run that tried to reach Convex would
          // fail here rather than quietly succeed against a real deployment.
          CONVEX_SELF_HOSTED_URL: "http://127.0.0.1:1",
          CONVEX_URL: "http://127.0.0.1:1",
        },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("DRY RUN:");
    expect(result.stdout).toContain("sources=2");
    expect(result.stdout).not.toContain("Ingesting");
  });
});
