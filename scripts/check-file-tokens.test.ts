import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  globToRegExp,
  isIgnored,
  parseBinaryNumstat,
} from "./check-file-tokens.mjs";

const checker = resolve("scripts/check-file-tokens.mjs");
const OVER_LIMIT = "a".repeat(25_000);

describe("ignore patterns", () => {
  test("lockfiles match by basename at any depth", () => {
    expect(isIgnored("bun.lock")).toBe(true);
    expect(isIgnored("web/bun.lock")).toBe(true);
    expect(isIgnored("agent/node/pnpm-lock.yaml")).toBe(true);
  });

  test("generated, export, and evidence paths are ignored", () => {
    expect(isIgnored("convex/_generated/api.d.ts")).toBe(true);
    expect(isIgnored("data/generated/x.json")).toBe(true);
    expect(isIgnored("web/src/routeTree.gen.ts")).toBe(true);
    expect(isIgnored("exports/blog/manifest.json")).toBe(true);
    expect(isIgnored("docs/evidence/run/receipt.json")).toBe(true);
    expect(isIgnored("a/generated/part\n2.ts")).toBe(true);
  });

  test("authored source is checked", () => {
    expect(isIgnored("convex/schema.ts")).toBe(false);
    expect(isIgnored("docs/decision-log.md")).toBe(false);
    expect(isIgnored("web/src/routes/listen.tsx")).toBe(false);
  });

  test("a single star does not cross directories", () => {
    expect(globToRegExp("docs/*_files/**").test("docs/a_files/x")).toBe(true);
    expect(globToRegExp("docs/*_files/**").test("docs/a/b_files/x")).toBe(
      false,
    );
  });
});

test("numstat parsing keeps tabs inside binary filenames", () => {
  const output = "-\t-\tfixtures/blob\tdata.bin\x0012\t0\tsrc/a.ts\x00";
  expect([...parseBinaryNumstat(output)]).toEqual(["fixtures/blob\tdata.bin"]);
});

describe("staged check", () => {
  let repo = "";

  afterEach(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
    repo = "";
  });

  function git(...args: string[]) {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  }

  function init() {
    repo = mkdtempSync(join(tmpdir(), "file-tokens-"));
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
  }

  function stage(path: string, content: string) {
    writeFileSync(join(repo, path), content);
    git("add", "--", path);
  }

  function check() {
    return spawnSync(process.execPath, [checker], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, APP_ENV: "test" },
    });
  }

  test("blocks an oversized staged file with split instructions", () => {
    init();
    stage("big.ts", OVER_LIMIT);
    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("big.ts  (~6,250 tokens, 25,000 bytes)");
    expect(result.stderr).toContain("Split by responsibility");
    expect(result.stderr).toContain("git commit --no-verify");
    expect(result.stderr).toContain("IGNORE_PATTERNS");
  });

  test("passes ignored lockfiles", () => {
    init();
    stage("bun.lock", OVER_LIMIT);
    expect(check().status).toBe(0);
  });

  test("measures the staged blob, not the working tree", () => {
    init();
    stage("small.ts", "small\n");
    writeFileSync(join(repo, "small.ts"), OVER_LIMIT);
    expect(check().status).toBe(0);
  });

  test("ignores unstaged .gitattributes when classifying binaries", () => {
    init();
    stage("large.txt", OVER_LIMIT);
    writeFileSync(join(repo, ".gitattributes"), "*.txt binary\n");
    expect(check().status).toBe(1);
  });

  test("checks a symlink replaced by a regular file", () => {
    init();
    symlinkSync("target", join(repo, "link"));
    git("add", "link");
    git("commit", "-qm", "init");
    unlinkSync(join(repo, "link"));
    stage("link", OVER_LIMIT);
    expect(check().status).toBe(1);
  });

  test("does not read a leading digit and colon as an index stage", () => {
    init();
    stage("notes.ts", "x\n");
    stage("0:notes.ts", OVER_LIMIT);
    expect(check().stderr).toContain("0:notes.ts");
  });

  test("skips staged submodule pointers", () => {
    init();
    stage("a.ts", "a\n");
    git("commit", "-qm", "init");
    const head = git("rev-parse", "HEAD").trim();
    git("update-index", "--add", "--cacheinfo", `160000,${head},sub`);
    expect(check().status).toBe(0);
  });
});
