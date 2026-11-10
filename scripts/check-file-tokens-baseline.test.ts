import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { isIgnored } from "./check-file-tokens.mjs";

const checker = resolve("scripts/check-file-tokens.mjs");

test("generated essay metadata is ignored", () => {
  expect(isIgnored("docs/essays/metadata.json")).toBe(true);
});

describe("baseline ratchet", () => {
  let repo = "";

  afterEach(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
    repo = "";
  });

  function git(...args: string[]) {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  }

  function init() {
    repo = mkdtempSync(join(tmpdir(), "file-tokens-baseline-"));
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
  }

  function stage(path: string, content: string) {
    writeFileSync(join(repo, path), content);
    git("add", "--", path);
  }

  function commit() {
    // Throwaway repo with no hooks installed.
    git("commit", "-q", "-m", "x", "--no-verify");
  }

  function check(...args: string[]) {
    return spawnSync(process.execPath, [checker, ...args], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, APP_ENV: "test" },
    });
  }

  const baselinePath = "scripts/file-token-baseline.json";

  function writeBaselineText(text: string, staged = true) {
    mkdirSync(join(repo, "scripts"), { recursive: true });
    writeFileSync(join(repo, baselinePath), text);
    if (staged) git("add", "--", baselinePath);
  }

  function writeBaseline(files: Record<string, number>, staged = true) {
    writeBaselineText(
      `${JSON.stringify({ version: 1, files }, null, 2)}\n`,
      staged,
    );
  }

  function readBaselineFiles(): Record<string, number> {
    const text = readFileSync(
      join(repo, "scripts/file-token-baseline.json"),
      "utf8",
    );
    return JSON.parse(text).files;
  }

  test("passes a baselined file at its recorded size", () => {
    init();
    writeBaseline({ "big.ts": 25_000 });
    stage("big.ts", "a".repeat(25_000));
    expect(check().status).toBe(0);
  });

  test("blocks a baselined file that grew", () => {
    init();
    writeBaseline({ "big.ts": 25_000 });
    stage("big.ts", "a".repeat(25_001));
    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "big.ts  (~6,251 tokens, 25,001 bytes), baseline 25,000 bytes: this file grew",
    );
    expect(result.stderr).toContain("scripts/file-token-baseline.json");
  });

  test("passes a baselined file that shrank", () => {
    init();
    writeBaseline({ "big.ts": 25_000 });
    stage("big.ts", "a".repeat(24_000));
    expect(check().status).toBe(0);
  });

  test("blocks a new over-limit file without a baseline entry", () => {
    init();
    writeBaseline({ "other.ts": 30_000 });
    stage("big.ts", "a".repeat(25_000));
    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("this file grew");
  });

  test("an unstaged baseline edit does not raise a ceiling", () => {
    init();
    writeBaseline({ "big.ts": 25_000 });
    stage("big.ts", "a".repeat(25_000));
    commit();
    writeBaseline({ "big.ts": 25_001 }, false);
    stage("big.ts", "a".repeat(25_001));
    expect(check().status).toBe(1);
  });

  test("an unstaged baseline entry does not exempt a new file", () => {
    init();
    writeBaseline({ "big.ts": 25_000 }, false);
    stage("big.ts", "a".repeat(25_000));
    expect(check().status).toBe(1);
  });

  test("--all reads the committed baseline, not the working tree", () => {
    init();
    writeBaseline({ "big.ts": 25_000 });
    stage("big.ts", "a".repeat(25_001));
    commit();
    writeBaseline({ "big.ts": 25_001 }, false);
    expect(check("--all").status).toBe(1);
  });

  test("without a baseline file, blocks as before", () => {
    init();
    stage("big.ts", "a".repeat(25_000));
    expect(check().status).toBe(1);
  });

  test("a malformed baseline fails the check", () => {
    init();
    writeBaselineText("not json");
    stage("big.ts", "a".repeat(25_000));
    expect(check().status).not.toBe(0);
  });

  test("--all passes when every over-limit file is baselined", () => {
    init();
    writeBaseline({ "big.ts": 25_000 });
    stage("big.ts", "a".repeat(25_000));
    commit();
    const result = check("--all");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("1 over-limit file(s) within baseline.");
  });

  test("--prune-baseline lowers a shrunk entry and drops one under the limit", () => {
    init();
    writeBaseline({ "big.ts": 25_000 });
    stage("big.ts", "a".repeat(24_000));
    commit();
    expect(check("--prune-baseline").status).toBe(0);
    expect(readBaselineFiles()).toEqual({ "big.ts": 24_000 });

    stage("big.ts", "a".repeat(100));
    commit();
    expect(check("--prune-baseline").status).toBe(0);
    expect(readBaselineFiles()).toEqual({});
  });

  test("--write-baseline refuses to overwrite an existing baseline", () => {
    init();
    writeBaseline({ "big.ts": 25_000 });
    stage("big.ts", "a".repeat(25_000));
    commit();
    const result = check("--write-baseline");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Baseline exists");
    expect(readBaselineFiles()).toEqual({ "big.ts": 25_000 });
  });
});
