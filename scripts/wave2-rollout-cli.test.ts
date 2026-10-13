import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { initialBackfillState } from "./lib/wave2-rollout";

const repoRoot = join(import.meta.dirname, "..");
const TARGET = "https://convex.resonantprojects.art";

// Neither CLI loads `.env` or Varlock, so the child receives only these names.
function run(script: string, args: string[], extra: Record<string, string>) {
  return spawnSync("vpx", ["tsx", script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      APP_ENV: "test",
      ...extra,
    } as unknown as typeof process.env,
  });
}

describe("wave2 signer readiness CLI", () => {
  test("disabled defaults pass and print no values", () => {
    const result = run("scripts/wave2-signer-readiness.ts", [], {});
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      signersEnabled: false,
      docketPreparationEnabled: false,
      unready: [],
    });
  });

  test("a required incomplete platform fails without echoing secrets", () => {
    const result = run(
      "scripts/wave2-signer-readiness.ts",
      ["--require=telegram"],
      {
        DECISION_SIGNERS_ENABLED: "true",
        DECISION_SIGNERS: JSON.stringify({ "telegram:42": "user-secret-id" }),
        DECISION_TELEGRAM_BOT_TOKEN: "123:token-secret-value",
        DECISION_TELEGRAM_CHAT_ID: "-100",
        DECISION_TELEGRAM_PATH_SECRET: "bad/path-secret-value",
      },
    );
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.unready).toEqual(["telegram"]);
    expect(report.platforms.telegram).toMatchObject({
      ready: false,
      mappedSigners: 1,
      missing: ["DECISION_TELEGRAM_HEADER_SECRET"],
      invalid: ["DECISION_TELEGRAM_PATH_SECRET"],
    });
    for (const value of [
      "token-secret-value",
      "path-secret-value",
      "user-secret-id",
    ])
      expect(result.stdout + result.stderr).not.toContain(value);
  });

  test("rejects unknown arguments", () => {
    expect(
      run("scripts/wave2-signer-readiness.ts", ["--require=slack"], {}).status,
    ).toBe(2);
  });
});

describe("wave2 revision backfill CLI", () => {
  test("dry-run prints the plan without network or credentials", () => {
    const result = run(
      "scripts/wave2-revision-backfill.ts",
      ["--origin", TARGET],
      {},
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      mode: "dry-run",
      target: TARGET,
      function: "decisionIntentsMigrations:backfillRevisions",
      nextStep: {
        args: { table: "feeds", cursor: null, batchSize: 50 },
        phase: "backfill",
      },
      outcome: { complete: false, verified: false },
    });
  });

  test("dry-run resumes from a state file", () => {
    const dir = mkdtempSync(join(tmpdir(), "wave2-backfill-"));
    const state = initialBackfillState(TARGET, 25);
    state.tables.feeds.backfill = {
      cursor: "cursor-after-page-3",
      done: false,
      pages: 3,
      updated: 60,
      pending: false,
    };
    const path = join(dir, "state.json");
    writeFileSync(path, JSON.stringify(state));
    const result = run(
      "scripts/wave2-revision-backfill.ts",
      ["--origin", TARGET, "--state", path],
      {},
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).nextStep.args).toEqual({
      table: "feeds",
      cursor: "cursor-after-page-3",
      batchSize: 25,
    });
  });

  function resumableState(batchSize: number) {
    const dir = mkdtempSync(join(tmpdir(), "wave2-backfill-"));
    const path = join(dir, "state.json");
    writeFileSync(
      path,
      JSON.stringify(initialBackfillState(TARGET, batchSize)),
    );
    return path;
  }

  // These run with --execute but no admin key, so a validation regression
  // stops at admin_key_not_inherited instead of contacting the deployment.
  test.each(["0", "101", "abc", "2.5", "1e1", "-5", ""])(
    "rejects --batch-size %j before credentials or state",
    (operand) => {
      const dir = mkdtempSync(join(tmpdir(), "wave2-backfill-"));
      const path = join(dir, "s.json");
      const result = run(
        "scripts/wave2-revision-backfill.ts",
        [
          "--execute",
          "--origin",
          TARGET,
          "--state",
          path,
          `--batch-size=${operand}`,
        ],
        {},
      );
      expect(result.status).toBe(2);
      expect(JSON.parse(result.stderr)).toEqual({
        status: "failed",
        code: "invalid_batch_size",
      });
      expect(existsSync(path)).toBe(false);
    },
  );

  test.each(["0", "abc", ""])("rejects --max-pages %j", (operand) => {
    const result = run(
      "scripts/wave2-revision-backfill.ts",
      ["--origin", TARGET, `--max-pages=${operand}`],
      {},
    );
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stderr).code).toBe("invalid_max_pages");
  });

  test("a supplied --batch-size sets a new state's page size", () => {
    const result = run(
      "scripts/wave2-revision-backfill.ts",
      ["--origin", TARGET, "--batch-size", "100"],
      {},
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).nextStep.args.batchSize).toBe(100);
  });

  test("a matching --batch-size resumes the stored state", () => {
    const result = run(
      "scripts/wave2-revision-backfill.ts",
      ["--origin", TARGET, "--state", resumableState(25), "--batch-size", "25"],
      {},
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).nextStep.args.batchSize).toBe(25);
  });

  test("an omitted --batch-size keeps the stored size", () => {
    const result = run(
      "scripts/wave2-revision-backfill.ts",
      ["--origin", TARGET, "--state", resumableState(25)],
      {},
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).nextStep.args.batchSize).toBe(25);
  });

  test("a --batch-size that differs from the resumed state fails before credentials", () => {
    const path = resumableState(25);
    const before = readFileSync(path, "utf8");
    const result = run(
      "scripts/wave2-revision-backfill.ts",
      ["--execute", "--origin", TARGET, "--state", path, "--batch-size", "50"],
      {},
    );
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual({
      status: "failed",
      code: "batch_size_mismatch",
    });
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  test("refuses other origins and execution without inherited admin key", () => {
    expect(
      run(
        "scripts/wave2-revision-backfill.ts",
        ["--origin", "http://172.16.10.24:3210"],
        {},
      ).status,
    ).toBe(2);
    const dir = mkdtempSync(join(tmpdir(), "wave2-backfill-"));
    const result = run(
      "scripts/wave2-revision-backfill.ts",
      ["--execute", "--origin", TARGET, "--state", join(dir, "s.json")],
      {},
    );
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual({
      status: "failed",
      code: "admin_key_not_inherited",
    });
  });
});
