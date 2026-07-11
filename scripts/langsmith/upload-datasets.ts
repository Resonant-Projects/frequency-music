#!/usr/bin/env -S vpx tsx
import { readFile } from "node:fs/promises";
import { Client } from "langsmith";
import {
  type ExampleLike,
  buildMissingExamples,
  parseJsonlRows,
} from "./upload-datasets-lib";

const client = new Client();

interface Dataset {
  name: string;
  description: string;
  path: string;
  inputKeys: string[];
  outputKeys: string[];
}

const DATASETS: Dataset[] = [
  {
    name: "resonant-extractions-golden",
    description:
      "Hand-curated good extractions, used to score extract_* prompts.",
    path: "data/eval/extractions-golden.jsonl",
    inputKeys: ["sourceTitle", "sourceType", "rawText"],
    outputKeys: [
      "summary",
      "claims",
      "compositionParameters",
      "topics",
      "openQuestions",
    ],
  },
  {
    name: "resonant-hypotheses-golden",
    description:
      "Hypotheses with strong whyThisMatters, used to score hypothesis_* prompts.",
    path: "data/eval/hypotheses-golden.jsonl",
    inputKeys: ["sourceTitle", "claims", "compositionParameters", "topics"],
    outputKeys: [
      "title",
      "question",
      "hypothesis",
      "whyThisMatters",
      "rationaleMd",
    ],
  },
  {
    name: "resonant-weekly-briefs-golden",
    description: "Strong weekly briefs that surface theses and contradictions.",
    path: "data/eval/weekly-briefs-golden.jsonl",
    inputKeys: ["weekOf", "hypotheses", "recipes", "theses", "failures"],
    outputKeys: ["bodyMd", "studioPrompts", "todo"],
  },
];

for (const ds of DATASETS) {
  let rows: Record<string, unknown>[] = [];
  try {
    const text = await readFile(ds.path, "utf8");
    rows = parseJsonlRows(text, ds.path);
  } catch (error) {
    const message = (error as Error).message;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn(`  ${ds.name}: ${ds.path} not found, skipping`);
      continue;
    }
    console.warn(`  ${ds.name}: ${message}, skipping`);
    continue;
  }

  let dataset: Awaited<ReturnType<typeof client.readDataset>>;
  try {
    dataset = await client.readDataset({ datasetName: ds.name });
    console.log(`Found existing dataset: ${ds.name}`);
  } catch {
    dataset = await client.createDataset(ds.name, {
      description: ds.description,
    });
    console.log(`Created dataset: ${ds.name}`);
  }

  const existing: ExampleLike[] = [];
  for await (const ex of client.listExamples({ datasetId: dataset.id })) {
    existing.push(ex);
  }

  const missing = buildMissingExamples(
    rows,
    existing,
    ds.inputKeys,
    ds.outputKeys,
  );
  if (missing.length === 0) {
    console.log(`  ${ds.name}: already has all ${rows.length} local examples`);
    continue;
  }

  for (const example of missing) {
    await client.createExample({
      ...example,
      dataset_id: dataset.id,
    });
  }
  console.log(`  ${ds.name}: uploaded ${missing.length} examples`);
}
