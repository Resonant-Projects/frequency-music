#!/usr/bin/env -S vpx tsx

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

const HYPOTHESIS_IDS = [
  "jh77f6vrfdyewjs2pdzfhdphms8ae2zs",
  "jh72zwgdmb5nytqka5nvbsbhv58afm5e",
  "jh7enth03nza8fe597vpf427qx8aejtb",
  "jh7d82hc6s34cdww0k25sb4gd18aafhv",
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
 */
const HYPOTHESIS_EXTRACTION_REPOINTS: Record<string, readonly string[]> = {
  jh72zwgdmb5nytqka5nvbsbhv58afm5e: ["j97d7hq5d3kndbx5sq26qppqwn8afr0d"],
};

const convexUrl =
  process.env.CONVEX_URL ??
  process.env.CONVEX_SELF_HOSTED_URL ??
  "https://convex.resonantprojects.art";
const client = new ConvexHttpClient(convexUrl);
const query = createEvalQuery(client);

async function materializeExtraction(id: string) {
  const extraction = await requireRow(query, "extractions:get", id);
  const source = await getSource(query, extraction.sourceId);
  return {
    sourceTitle: source?.title ?? "(untitled source)",
    sourceType: source?.type ?? "url",
    rawText: source?.rawText ?? source?.transcript ?? "",
    ...extraction,
  };
}

async function materializeHypothesis(id: string) {
  const hypothesis = await requireRow(query, "hypotheses:get", id);
  const repointed = HYPOTHESIS_EXTRACTION_REPOINTS[id];
  if (repointed) hypothesis.extractionIds = [...repointed];
  return await enrichHypothesis(query, hypothesis, "throw");
}

async function materializeBrief(id: string) {
  const brief = await requireRow(query, "weeklyBriefs:get", id);
  const [hypotheses, recipes, storedTheses, failures] = await Promise.all([
    Promise.all(
      (brief.recommendedHypothesisIds ?? []).map((hypothesisId: string) =>
        materializeHypothesis(hypothesisId),
      ),
    ),
    Promise.all(
      (brief.recommendedRecipeIds ?? []).map((recipeId: string) =>
        requireRow(query, "recipes:get", recipeId),
      ),
    ),
    query("theses:getByIds", { ids: brief.activeThesisIds ?? [] }) as Promise<
      Row[]
    >,
    query("failures:getByKeys", {
      keys: brief.referencedFailureKeys ?? [],
    }) as Promise<Row[]>,
  ]);

  return {
    hypotheses,
    recipes,
    theses: withPlaceholderTheses(brief, storedTheses),
    failures,
    ...brief,
  };
}

async function writeJsonl(path: string, rows: Row[]) {
  await writeFile(
    path,
    rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
  );
  console.log(`wrote ${rows.length} rows to ${path}`);
}

await writeJsonl(
  "data/eval/extractions-golden.jsonl",
  await Promise.all(EXTRACTION_IDS.map(materializeExtraction)),
);
await writeJsonl(
  "data/eval/hypotheses-golden.jsonl",
  await Promise.all(HYPOTHESIS_IDS.map(materializeHypothesis)),
);
await writeJsonl(
  "data/eval/weekly-briefs-golden.jsonl",
  await Promise.all(WEEKLY_BRIEF_IDS.map(materializeBrief)),
);
