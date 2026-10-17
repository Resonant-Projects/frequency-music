#!/usr/bin/env -S vpx tsx

// Regenerates the golden files from production through read-only Convex
// queries. With no arguments it rewrites all three; `--dataset <name>`
// (repeatable) queries and rewrites only the named files and leaves the others'
// bytes untouched.
// oxlint-disable-next-line import/no-unassigned-import -- Loads .env.local before Convex URL resolution.
import "varlock/auto-load";
import { writeFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import {
  createEvalQuery,
  enrichHypothesis,
  getSource,
  requireRow,
  withPlaceholderTheses,
  type EvalQuery,
  type Row,
} from "../lib/eval-dataset-helpers";

const EXTRACTION_IDS = [
  "j97f7yq3rv85mv7jkhvy1r0fbx8arevy",
  "j978rj9jtfn8y8wkhrfrxpgrhd8as7dy",
  "j970n5akmsx33bh4mbg65yfmex8ape41",
  "j97ed8sbvnndbsxqxm0p6k4vkn8ap7jh",
  "j971f5dxbtd4xkjge9gcj6y3p18aqmfv",
  "j971crpns779mes78xt6s6794s8aq2d3",
  "j97c0c18c59gs2hkhr70xgnyys8aq40b",
  "j97ew31wh4x6nr72xa9y9n7y3s8amm58",
  "j9762aqawbwmrwvhgfwrns5m398aj4d3",
  "j978yxjgnckm2px83ae5dqwgq18ajxwm",
  "j97ckpqqxzkj19gbw70dkwhk218ahj6w",
  "j97d7hq5d3kndbx5sq26qppqwn8afr0d",
  "j97bw3c6d199ghsv0fnshtgpex8afycn",
  "j975t7frqwkx8wa1p26nshczhh8aefmy",
  "j977hrtynjz4cbrjsjw20zer3d8af58j",
  "j974gc8ezcqwyszfq75vbems3x8acnrp",
  "j9710z6b29rheh8h9zfkkj6acd8acydm",
  "j97cs7s2wqevgarwtn5vtjc2rh8ab3rq",
] as const;

/**
 * H1–H3 from `data/eval/curation-2026-07-18.md`; H5–H7 added and H4
 * (`jh7d82hc6s…`) dropped per `data/eval/curation-2026-10-17.md`. H4's golden
 * `rationaleMd` repeats Claim 4's wrong arithmetic, so it is no longer a
 * standalone reference output.
 */
const HYPOTHESIS_IDS = [
  "jh77f6vrfdyewjs2pdzfhdphms8ae2zs",
  "jh72zwgdmb5nytqka5nvbsbhv58afm5e",
  "jh7enth03nza8fe597vpf427qx8aejtb",
  "jh79bj87pjx2at0mqqy2jkppdx8axjc1",
  "jh7602kgehf8mjkh1685gb55f98aw3eq",
  "jh7c1rd967g1bz7ny40bft8evx8axfyy",
] as const;

const WEEKLY_BRIEF_IDS = [
  "k57dmdzgv0jbb4815a2wh81p118aax83",
  "k57atxwnwddzgahmwvn6x9794x8aa6w6",
] as const;

/**
 * Curation-sheet overrides (`data/eval/curation-2026-07-18.md`).
 *
 * H2 (`jh72zwgdmb…`) cites extraction `j97ckxzz5n…`, which the sheet SKIPs as a
 * duplicate re-extraction of the same paper; row #17 (`j97d7hq5d3…`) is the copy
 * that was KEPT into `extractions-golden.jsonl`. The sheet's own note calls for
 * the repoint, so it is applied here rather than hand-edited into the JSONL, and
 * survives re-materialization.
 *
 * H4 (`jh7d82hc6s…`, `data/eval/curation-2026-10-17.md`) has no
 * `extractionIds`, so it would resolve to its source's newest extraction, a
 * 2026-10-13 re-extraction. Both ratified weekly briefs still embed H4, so the
 * pin keeps their embedded claims, parameters and topics on the 2026-05-11
 * extraction the golden rows were built from.
 */
const HYPOTHESIS_EXTRACTION_REPOINTS: Record<string, readonly string[]> = {
  jh72zwgdmb5nytqka5nvbsbhv58afm5e: ["j97d7hq5d3kndbx5sq26qppqwn8afr0d"],
  jh7d82hc6s34cdww0k25sb4gd18aafhv: ["j97f14ww3grvkgbgx82zppkj5x86hmsg"],
};

type Materialize = (query: EvalQuery, id: string) => Promise<Row>;

async function materializeExtraction(query: EvalQuery, id: string) {
  const extraction = await requireRow(query, "extraction", id);
  const source = await getSource(query, extraction.sourceId);
  return {
    sourceTitle: source?.title ?? "(untitled source)",
    sourceType: source?.type ?? "url",
    rawText: source?.rawText ?? source?.transcript ?? "",
    ...extraction,
  };
}

async function materializeHypothesis(query: EvalQuery, id: string) {
  const hypothesis = await requireRow(query, "hypothesis", id);
  const repointed = HYPOTHESIS_EXTRACTION_REPOINTS[id];
  if (repointed) hypothesis.extractionIds = [...repointed];
  return await enrichHypothesis(query, hypothesis, "throw");
}

async function materializeBrief(query: EvalQuery, id: string) {
  const brief = await requireRow(query, "weeklyBrief", id);
  const [hypotheses, recipes, storedTheses, failures] = await Promise.all([
    Promise.all(
      (brief.recommendedHypothesisIds ?? []).map((hypothesisId: string) =>
        materializeHypothesis(query, hypothesisId),
      ),
    ),
    Promise.all(
      (brief.recommendedRecipeIds ?? []).map((recipeId: string) =>
        requireRow(query, "recipe", recipeId),
      ),
    ),
    query.thesesByIds(brief.activeThesisIds ?? []),
    query.failuresByKeys(brief.referencedFailureKeys ?? []),
  ]);

  return {
    hypotheses,
    recipes,
    theses: withPlaceholderTheses(brief, storedTheses),
    failures,
    ...brief,
  };
}

/** Golden files in write order. The keys are the `--dataset` names. */
export const DATASETS = {
  extractions: {
    path: "data/eval/extractions-golden.jsonl",
    ids: EXTRACTION_IDS,
    materialize: materializeExtraction,
  },
  hypotheses: {
    path: "data/eval/hypotheses-golden.jsonl",
    ids: HYPOTHESIS_IDS,
    materialize: materializeHypothesis,
  },
  "weekly-briefs": {
    path: "data/eval/weekly-briefs-golden.jsonl",
    ids: WEEKLY_BRIEF_IDS,
    materialize: materializeBrief,
  },
} satisfies Record<
  string,
  { path: string; ids: readonly string[]; materialize: Materialize }
>;

export type DatasetName = keyof typeof DATASETS;
const DATASET_NAMES = Object.keys(DATASETS) as DatasetName[];

const USAGE = `Usage: materialize-curation-2026-07-18.ts [--dataset <name>]...
  <name>: ${DATASET_NAMES.join(", ")}. Repeatable. Default: all three.`;

function isDatasetName(name: string): name is DatasetName {
  return Object.hasOwn(DATASETS, name);
}

/**
 * The datasets to materialize, in write order. Throws on anything it does not
 * recognize, so a typo never falls back to rewriting every file.
 */
export function parseDatasetArgs(argv: readonly string[]): DatasetName[] {
  if (argv.length === 0) return DATASET_NAMES;
  const selected = new Set<DatasetName>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--dataset") {
      throw new Error(`unknown argument ${JSON.stringify(argv[i])}`);
    }
    const name = argv[++i];
    if (name === undefined || name === "" || name.startsWith("-")) {
      throw new Error("--dataset needs a dataset name");
    }
    if (!isDatasetName(name)) {
      throw new Error(`unknown dataset ${JSON.stringify(name)}`);
    }
    selected.add(name);
  }
  return DATASET_NAMES.filter((name) => selected.has(name));
}

function productionQuery(): EvalQuery {
  const convexUrl =
    process.env.CONVEX_URL ??
    process.env.CONVEX_SELF_HOSTED_URL ??
    "https://convex.resonantprojects.art";
  return createEvalQuery(new ConvexHttpClient(convexUrl));
}

/**
 * Arguments are checked before any client exists, and every selected dataset is
 * read before the first write, so a bad argument or a failed read rewrites
 * nothing.
 */
export async function main(argv: readonly string[] = process.argv.slice(2)) {
  let names: DatasetName[];
  try {
    names = parseDatasetArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${message}\n${USAGE}`);
    return 1;
  }

  const query = productionQuery();
  const outputs: { path: string; rows: Row[] }[] = [];
  for (const name of names) {
    const { path, ids, materialize } = DATASETS[name];
    const rows = await Promise.all(ids.map((id) => materialize(query, id)));
    outputs.push({ path, rows });
  }
  for (const { path, rows } of outputs) {
    await writeFile(
      path,
      rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    );
    console.log(`wrote ${rows.length} rows to ${path}`);
  }
  return 0;
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
