#!/usr/bin/env -S vpx tsx

import { writeFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";

type Row = Record<string, any>;

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

const convexUrl =
  process.env.CONVEX_URL ??
  process.env.CONVEX_SELF_HOSTED_URL ??
  "https://convex.resonantprojects.art";
const client = new ConvexHttpClient(convexUrl);

async function query(name: string, args: Record<string, unknown>) {
  return await client.query(name as any, args);
}

async function requireRow(name: string, id: string) {
  const row = (await query(name, { id })) as Row | null;
  if (!row) throw new Error(`${name} did not return ${id}`);
  return row;
}

async function getSource(sourceId: string | undefined) {
  if (!sourceId) return null;
  return (await query("sources:get", { id: sourceId })) as Row | null;
}

async function getHypothesisExtractions(hypothesis: Row) {
  const linked = await Promise.all(
    (hypothesis.extractionIds ?? []).map((id: string) =>
      requireRow("extractions:get", id),
    ),
  );
  if (linked.length > 0) return linked;

  const bySource = await Promise.all(
    (hypothesis.sourceIds ?? []).map(
      async (sourceId: string) =>
        (await query("extractions:getBySourceId", { sourceId })) as Row[],
    ),
  );
  return bySource.flatMap((rows) => rows.slice(0, 1));
}

async function materializeExtraction(id: string) {
  const extraction = await requireRow("extractions:get", id);
  const source = await getSource(extraction.sourceId);
  return {
    sourceTitle: source?.title ?? "(untitled source)",
    sourceType: source?.type ?? "url",
    rawText: source?.rawText ?? source?.transcript ?? "",
    ...extraction,
  };
}

async function materializeHypothesis(id: string) {
  const hypothesis = await requireRow("hypotheses:get", id);
  const [source, extractions] = await Promise.all([
    getSource(hypothesis.sourceIds?.[0]),
    getHypothesisExtractions(hypothesis),
  ]);
  return {
    sourceTitle: source?.title ?? "(untitled source)",
    claims: extractions.flatMap((row) => row.claims ?? []),
    compositionParameters: extractions.flatMap(
      (row) => row.compositionParameters ?? [],
    ),
    topics: [...new Set(extractions.flatMap((row) => row.topics ?? []))],
    ...hypothesis,
  };
}

async function materializeBrief(id: string) {
  const brief = await requireRow("weeklyBriefs:get", id);
  const [hypotheses, recipes, storedTheses, failures] = await Promise.all([
    Promise.all(
      (brief.recommendedHypothesisIds ?? []).map((hypothesisId: string) =>
        requireRow("hypotheses:get", hypothesisId),
      ),
    ),
    Promise.all(
      (brief.recommendedRecipeIds ?? []).map((recipeId: string) =>
        requireRow("recipes:get", recipeId),
      ),
    ),
    query("theses:getByIds", { ids: brief.activeThesisIds ?? [] }) as Promise<
      Row[]
    >,
    query("failures:getByKeys", {
      keys: brief.referencedFailureKeys ?? [],
    }) as Promise<Row[]>,
  ]);

  const placeholderTitles = [
    ...String(brief.bodyMd ?? "").matchAll(/`(e2e-\d+)`/g),
  ].map((match) => match[1]);
  const theses =
    storedTheses.length > 0
      ? storedTheses
      : (brief.activeThesisIds ?? []).map(
          (thesisId: string, index: number) => ({
            _id: thesisId,
            title:
              placeholderTitles[index] ?? `Unavailable thesis ${index + 1}`,
            statement:
              "Historical placeholder referenced by the ratified weekly brief; the original thesis row is no longer present.",
          }),
        );

  return { hypotheses, recipes, theses, failures, ...brief };
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
