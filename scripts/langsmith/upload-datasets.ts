#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { Client } from "langsmith";

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
    description: "Hand-curated good extractions, used to score extract_* prompts.",
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
    outputKeys: ["title", "question", "hypothesis", "whyThisMatters", "rationaleMd"],
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
    rows = text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (e) {
    console.warn(`  ${ds.name}: ${ds.path} not found, skipping`);
    continue;
  }

  let dataset;
  try {
    dataset = await client.readDataset({ datasetName: ds.name });
    console.log(`Found existing dataset: ${ds.name}`);
  } catch {
    dataset = await client.createDataset(ds.name, { description: ds.description });
    console.log(`Created dataset: ${ds.name}`);
  }

  const existing: unknown[] = [];
  for await (const ex of client.listExamples({ datasetId: dataset.id })) {
    existing.push(ex);
  }
  if (existing.length >= rows.length) {
    console.log(`  ${ds.name}: already has ${existing.length} examples, skipping upload`);
    continue;
  }

  for (const row of rows) {
    const inputs = Object.fromEntries(
      ds.inputKeys.map((k) => [k, (row as Record<string, unknown>)[k]]),
    );
    const outputs = Object.fromEntries(
      ds.outputKeys.map((k) => [k, (row as Record<string, unknown>)[k]]),
    );
    await client.createExample(inputs, outputs, { datasetId: dataset.id });
  }
  console.log(`  ${ds.name}: uploaded ${rows.length} examples`);
}
