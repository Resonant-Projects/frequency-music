import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import {
  assertCliVersion,
  buildDeployArgs,
  buildDeployEnv,
  CONVEX_DEPLOY_URL,
  DOTENV_LINE_SOURCE,
  envFileKeys,
  parseDeployArgs,
} from "./convex-deploy";

describe("parseDeployArgs", () => {
  test("accepts no arguments or --dry-run alone", () => {
    expect(parseDeployArgs([])).toEqual({ dryRun: false });
    expect(parseDeployArgs(["--dry-run"])).toEqual({ dryRun: true });
  });

  test.each([["--yes"], ["--cmd", "vite build"], ["--dry-run", "--verbose"]])(
    "rejects %s",
    (...argv) => {
      expect(() => parseDeployArgs(argv)).toThrow(/Only --dry-run/);
    },
  );
});

describe("buildDeployArgs", () => {
  test("uses the installed entrypoint with typecheck and codegen disabled", () => {
    expect(buildDeployArgs({ dryRun: false })).toEqual([
      "node_modules/convex/bin/main.js",
      "deploy",
      "--typecheck",
      "disable",
      "--codegen",
      "disable",
    ]);
    expect(buildDeployArgs({ dryRun: true }).at(-1)).toBe("--dry-run");
  });
});

describe("buildDeployEnv", () => {
  const resolved = {
    PATH: "/usr/bin",
    HOME: "/home/op",
    CONVEX_SELF_HOSTED_URL: CONVEX_DEPLOY_URL,
    CONVEX_SELF_HOSTED_ADMIN_KEY: "admin-key",
    CONVEX_DEPLOY_KEY: "cloud-key",
    CONVEX_DEPLOYMENT: "prod:other",
    NODE_OPTIONS: "--require evil.js",
    OPENROUTER_API_KEY: "unrelated",
  };

  test("carries only passthrough and self-hosted variables", () => {
    expect(buildDeployEnv(resolved)).toEqual({
      PATH: "/usr/bin",
      HOME: "/home/op",
      CONVEX_SELF_HOSTED_URL: CONVEX_DEPLOY_URL,
      CONVEX_SELF_HOSTED_ADMIN_KEY: "admin-key",
    });
  });

  test("blanks every env-file key the CLI would otherwise dotenv-load", () => {
    const env = buildDeployEnv(resolved, [
      "CONVEX_DEPLOY_KEY",
      "OPENROUTER_API_KEY",
      "CONVEX_SELF_HOSTED_URL",
      "PATH",
    ]);
    expect(env.CONVEX_DEPLOY_KEY).toBe("");
    expect(env.OPENROUTER_API_KEY).toBe("");
    expect(env.CONVEX_SELF_HOSTED_URL).toBe(CONVEX_DEPLOY_URL);
    expect(env.PATH).toBe("/usr/bin");
  });

  test("refuses any target other than the pinned URL", () => {
    expect(() =>
      buildDeployEnv({
        ...resolved,
        CONVEX_SELF_HOSTED_URL: "https://elsewhere.example",
      }),
    ).toThrow(/must be https:\/\/convex\.resonantprojects\.art/);
    expect(() =>
      buildDeployEnv({ ...resolved, CONVEX_SELF_HOSTED_URL: undefined }),
    ).toThrow(/resolved nothing/);
  });

  test("refuses a missing admin key without echoing values", () => {
    expect(() =>
      buildDeployEnv({ ...resolved, CONVEX_SELF_HOSTED_ADMIN_KEY: "" }),
    ).toThrow(/ADMIN_KEY did not resolve/);
  });

  test("never puts the admin key or URL override in an error", () => {
    let message = "";
    try {
      buildDeployEnv({
        ...resolved,
        CONVEX_SELF_HOSTED_URL: "https://secret-host.example",
      });
    } catch (error) {
      message = String(error);
    }
    expect(message).toMatch(/resolved a different URL/);
    expect(message).not.toContain("secret-host");
    expect(message).not.toContain("admin-key");
  });
});

describe("envFileKeys", () => {
  test("covers every assignment form the bundled dotenv parses", () => {
    const contents = [
      "# CONVEX_DEPLOY_KEY=commented",
      "OPENROUTER_API_KEY=x",
      "export CONVEX_DEPLOYMENT=prod:abc",
      "  CONVEX_DEPLOY_KEY = y",
      "CONVEX_DEPLOYMENT_TOKEN: colon-form",
      "dotted.name-key=1",
      'MULTI="line one',
      'NOT_A_KEY_LINE"',
    ].join("\r");
    expect(envFileKeys(contents).toSorted()).toEqual([
      "CONVEX_DEPLOYMENT",
      "CONVEX_DEPLOYMENT_TOKEN",
      "CONVEX_DEPLOY_KEY",
      "MULTI",
      "OPENROUTER_API_KEY",
      "dotted.name-key",
    ]);
  });

  test("finds keys with whitespace or a newline before the equals sign", () => {
    expect(envFileKeys("CONVEX_DEPLOY_KEY\n=cloud-key\n")).toContain(
      "CONVEX_DEPLOY_KEY",
    );
    expect(envFileKeys("CONVEX_DEPLOY_KEY\r\n  = cloud-key")).toContain(
      "CONVEX_DEPLOY_KEY",
    );
  });

  test("matches the grammar bundled in the installed Convex CLI", () => {
    const bundle = readFileSync(
      new URL("../../node_modules/convex/dist/cli.bundle.cjs", import.meta.url),
      "utf8",
    );
    const lines = bundle
      .split("\n")
      .filter((line) => /^\s*var LINE = \//.test(line));
    expect(lines).toEqual([`    var LINE = /${DOTENV_LINE_SOURCE}/mg;`]);
  });

  test("splits on CRLF, LF, and Unicode line separators", () => {
    expect(envFileKeys("A=1\r\nB=2\nC=3\u2028D=4\u2029E=5")).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
  });
});

describe("assertCliVersion", () => {
  test("requires the audited version", () => {
    expect(() => assertCliVersion("1.46.0", "1.46.0")).not.toThrow();
    expect(() => assertCliVersion("1.47.0", "1.46.0")).toThrow(
      /audited deploy CLI is 1\.46\.0/,
    );
  });
});
