import { getFunctionName } from "convex/server";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";

// Every side effect is mocked: Varlock resolves nothing, the Convex client
// answers from memory and records each query, and no golden file is written.
const { clients, calls, missing, writeFile } = vi.hoisted(() => ({
  clients: [] as string[],
  missing: new Set<string>(),
  calls: [] as { name: string; args: Record<string, any> }[],
  writeFile: vi.fn(async (_path: string, _text: string) => {}),
}));
vi.mock("varlock/auto-load", () => ({}));
vi.mock("node:fs/promises", () => ({ writeFile }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    constructor(url: string) {
      clients.push(url);
    }
    query(ref: unknown, args: Record<string, any>) {
      const name = getFunctionName(ref as never);
      calls.push({ name, args });
      return Promise.resolve(answer(name, args));
    }
  },
}));

import {
  DATASETS,
  main,
  parseDatasetArgs,
} from "./materialize-curation-2026-07-18";

const H2 = "jh72zwgdmb5nytqka5nvbsbhv58afm5e";
const H2_PIN = "j97d7hq5d3kndbx5sq26qppqwn8afr0d";
const H4 = "jh7d82hc6s34cdww0k25sb4gd18aafhv";
const H4_PIN = "j97f14ww3grvkgbgx82zppkj5x86hmsg";
const HYPOTHESIS_IDS = [
  "jh77f6vrfdyewjs2pdzfhdphms8ae2zs",
  H2,
  "jh7enth03nza8fe597vpf427qx8aejtb",
  "jh79bj87pjx2at0mqqy2jkppdx8axjc1",
  "jh7602kgehf8mjkh1685gb55f98aw3eq",
  "jh7c1rd967g1bz7ny40bft8evx8axfyy",
];

/** In-memory production: every row exists and names its own id. */
function answer(name: string, args: Record<string, any>) {
  if (missing.has(name)) return null;
  switch (name) {
    case "sources:get":
      return { _id: args.id, title: `title ${args.id}`, rawText: "text" };
    case "extractions:get":
      return { _id: args.id, sourceId: "s1", claims: [`claim ${args.id}`] };
    case "extractions:getBySourceId":
      return [{ _id: `newest ${args.sourceId}`, claims: ["newest"] }];
    case "hypotheses:get":
      // H2 still cites the skipped duplicate; H4 cites nothing.
      return {
        _id: args.id,
        sourceIds: ["s1"],
        extractionIds:
          args.id === H2
            ? ["j97ckxzz5n"]
            : args.id === H4
              ? []
              : [`x-${args.id}`],
      };
    case "weeklyBriefs:get":
      return {
        _id: args.id,
        recommendedHypothesisIds: [H4],
        activeThesisIds: [],
      };
    case "theses:getByIds":
    case "failures:getByKeys":
      return [];
    default:
      throw new Error(`unexpected query ${name}`);
  }
}

const queried = () => new Set(calls.map((call) => call.name));
const written = () =>
  writeFile.mock.calls.map(([path, text]) => ({
    path,
    rows: text
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line)),
  }));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  clients.length = 0;
  calls.length = 0;
  missing.clear();
  writeFile.mockClear();
});

describe("parseDatasetArgs", () => {
  test("defaults to all three datasets in write order", () => {
    expect(parseDatasetArgs([])).toEqual([
      "extractions",
      "hypotheses",
      "weekly-briefs",
    ]);
  });

  test("selects named datasets in write order, once each", () => {
    expect(parseDatasetArgs(["--dataset", "hypotheses"])).toEqual([
      "hypotheses",
    ]);
    expect(
      parseDatasetArgs([
        "--dataset",
        "weekly-briefs",
        "--dataset",
        "extractions",
        "--dataset",
        "weekly-briefs",
      ]),
    ).toEqual(["extractions", "weekly-briefs"]);
  });

  test.each([
    [["--dataset"], "--dataset needs a dataset name"],
    [["--dataset", ""], "--dataset needs a dataset name"],
    [["--dataset", "--dataset"], "--dataset needs a dataset name"],
    [["--dataset", "hypothesis"], 'unknown dataset "hypothesis"'],
    [["--dataset", "constructor"], 'unknown dataset "constructor"'],
    [["--dataset=hypotheses"], 'unknown argument "--dataset=hypotheses"'],
    [["hypotheses"], 'unknown argument "hypotheses"'],
    [["--dataset", "hypotheses", ""], 'unknown argument ""'],
  ])("rejects %j", (argv, message) => {
    expect(() => parseDatasetArgs(argv)).toThrow(message);
  });
});

describe("main", () => {
  test("an invalid argument builds no client, queries nothing and writes nothing", async () => {
    await expect(
      main(["--dataset", "hypotheses", "--dataset", "brief"]),
    ).resolves.toBe(1);
    expect(clients).toEqual([]);
    expect(calls).toEqual([]);
    expect(writeFile).not.toHaveBeenCalled();
  });

  test("--dataset hypotheses reads and rewrites only the hypothesis file", async () => {
    await expect(main(["--dataset", "hypotheses"])).resolves.toBe(0);

    expect(queried()).toEqual(
      new Set(["hypotheses:get", "sources:get", "extractions:get"]),
    );
    expect(written().map((file) => file.path)).toEqual([
      DATASETS.hypotheses.path,
    ]);
    const rows = written()[0]!.rows;
    expect(rows.map((row) => row._id)).toEqual(HYPOTHESIS_IDS);
    expect(rows.find((row) => row._id === H4)).toBeUndefined();
    // The H2 repoint survives a selected run.
    const h2 = rows.find((row) => row._id === H2);
    expect(h2?.extractionIds).toEqual([H2_PIN]);
    expect(h2?.claims).toEqual([`claim ${H2_PIN}`]);
  });

  test("with no arguments writes all three files, briefs embedding pinned H4", async () => {
    await expect(main([])).resolves.toBe(0);

    expect(clients).toHaveLength(1);
    const files = written();
    expect(files.map((file) => file.path)).toEqual([
      DATASETS.extractions.path,
      DATASETS.hypotheses.path,
      DATASETS["weekly-briefs"].path,
    ]);
    expect(files.map((file) => file.rows.length)).toEqual([18, 6, 2]);
    for (const brief of files[2]!.rows) {
      expect(brief.hypotheses).toHaveLength(1);
      expect(brief.hypotheses[0]).toMatchObject({
        _id: H4,
        extractionIds: [H4_PIN],
        claims: [`claim ${H4_PIN}`],
      });
    }
    expect(queried().has("extractions:getBySourceId")).toBe(false);
  });

  test("a failed read rewrites no file, including those read before it", async () => {
    missing.add("weeklyBriefs:get");

    await expect(main([])).rejects.toThrow("weeklyBrief did not return");
    expect(queried().has("extractions:get")).toBe(true);
    expect(writeFile).not.toHaveBeenCalled();
  });
});
