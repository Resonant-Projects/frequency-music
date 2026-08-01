import { describe, expect, test } from "vite-plus/test";
import { spawnSync } from "node:child_process";

describe("ingest-manifest CLI", () => {
  test("dry-runs by default without contacting Convex", () => {
    const result = spawnSync(
      "bun",
      ["run", "scripts/ingest-manifest.ts", "data/example-manifest.json"],
      {
        cwd: import.meta.dirname + "/..",
        encoding: "utf8",
        env: {
          ...process.env,
          // The CLI loads `varlock/auto-load` for real; APP_ENV=test resolves
          // every secret from the committed .env.test placeholders so the
          // subprocess never reaches for 1Password.
          APP_ENV: "test",
          AUTH_BYPASS_SECRET: "test-only-placeholder",
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
