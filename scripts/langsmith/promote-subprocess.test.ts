import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test, vi } from "vite-plus/test";

vi.mock("varlock/auto-load", () => ({}));

import { runExperiment } from "./promote";

// A stand-in runner executed through the real `vpx tsx` child process: it
// prints a completion marker, then exits with the code named by its version.
const dir = mkdtempSync(join(tmpdir(), "promote-runner-"));
const runner = join(dir, "fake-runner.ts");
writeFileSync(
  runner,
  [
    'const version = process.argv[process.argv.indexOf("--version") + 1];',
    'if (version !== "no-marker") {',
    '  console.log(`EVAL_RUN_COMPLETE ${JSON.stringify({ experiment: `fake-${version}`, examples: 2, evaluatorKeys: ["k"] })}`);',
    "}",
    'process.exitCode = version === "fail" ? 3 : 0;',
    "",
  ].join("\n"),
);

describe("runExperiment child process", () => {
  vi.stubEnv("APP_ENV", "test");
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  test("runs the runner with vpx tsx and reads its marker", () => {
    expect(runExperiment(runner, "v2")).toEqual({
      experiment: "fake-v2",
      examples: 2,
      evaluatorKeys: ["k"],
    });
  }, 60_000);

  test("propagates a nonzero runner exit", () => {
    expect(() => runExperiment(runner, "fail")).toThrow("status 3");
  }, 60_000);

  test("refuses a zero exit without a completion marker", () => {
    expect(() => runExperiment(runner, "no-marker")).toThrow(
      "completion marker",
    );
  }, 60_000);
});
