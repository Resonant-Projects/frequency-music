import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";

// `promote` pulls in `varlock/auto-load`; the child process and LangSmith
// client are mocked so main() runs its gate with no subprocess or network.
vi.mock("varlock/auto-load", () => ({}));

const { spawnSync, readProject } = vi.hoisted(() => ({
  spawnSync: vi.fn(),
  readProject: vi.fn(),
}));
vi.mock("node:child_process", () => ({ spawnSync }));
vi.mock("langsmith", () => ({
  Client: class {
    readProject = readProject;
  },
}));

import { main } from "./promote";
import { formatCompletionMarker } from "./run-guard";

function child(version: string, ok = true) {
  return {
    status: ok ? 0 : 1,
    signal: null,
    stdout: ok
      ? formatCompletionMarker({
          experiment: `hypothesis-${version}-x`,
          examples: 4,
          evaluatorKeys: ["why_this_matters"],
        })
      : "",
    stderr: "",
  };
}

const stats = (avg: number, n = 4) => ({
  feedback_stats: { why_this_matters: { avg, n } },
});

const argv = ["--target", "hypothesis", "--candidate", "v2"];

describe("promote main gate", () => {
  beforeEach(() => {
    vi.stubEnv("LANGSMITH_API_KEY", "ls-test");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    // readMeansForExperiment waits between reads; run those waits at once.
    vi.stubGlobal("setTimeout", (fn: () => void) => {
      fn();
      return 0;
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    spawnSync.mockReset();
    readProject.mockReset();
  });

  test("passes only when both complete experiments clear the rubric", async () => {
    spawnSync.mockImplementation((_cmd: string, args: string[]) =>
      child(args[3]!),
    );
    readProject.mockImplementation(async ({ projectName }) =>
      stats(projectName.includes("v2") ? 0.9 : 0.8),
    );
    await expect(main(argv)).resolves.toBe(0);
    expect(spawnSync.mock.calls[0]?.slice(0, 2)).toEqual([
      "vpx",
      ["tsx", expect.stringMatching(/eval-hypothesis\.ts$/), "--version", "v1"],
    ]);
  });

  test("a failed child experiment never reaches PASS", async () => {
    spawnSync.mockImplementation((_cmd: string, args: string[]) =>
      child(args[3]!, args[3] !== "v2"),
    );
    readProject.mockImplementation(async () => stats(0.9));
    await expect(main(argv)).rejects.toThrow("status 1");
  });

  test("partial candidate feedback never reaches PASS", async () => {
    spawnSync.mockImplementation((_cmd: string, args: string[]) =>
      child(args[3]!),
    );
    readProject.mockImplementation(async ({ projectName }) =>
      projectName.includes("v2") ? stats(1, 2) : stats(0.5),
    );
    await expect(main(argv)).rejects.toThrow("refusing partial scores");
  });
});
