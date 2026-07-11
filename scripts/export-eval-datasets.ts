#!/usr/bin/env -S vpx tsx

import "varlock/auto-load";
import { ConvexHttpClient } from "convex/browser";
import { mkdir, writeFile } from "node:fs/promises";

const convexUrl = process.env.CONVEX_URL ?? process.env.CONVEX_SELF_HOSTED_URL;
const agentSecret = process.env.AGENT_TOOL_SECRET;

if (!convexUrl) {
  throw new Error("CONVEX_URL or CONVEX_SELF_HOSTED_URL is required");
}

if (!agentSecret) {
  throw new Error("AGENT_TOOL_SECRET is required");
}

const client = new ConvexHttpClient(convexUrl);

function toJsonl(rows: unknown[]) {
  return rows.map((row) => JSON.stringify(row)).join("\n");
}

async function writeJsonl(path: string, rows: unknown[]) {
  await writeFile(path, rows.length > 0 ? toJsonl(rows) + "\n" : "");
  console.log("wrote " + rows.length + " rows to " + path);
}

await mkdir("data/eval", { recursive: true });

const extractions = (await client.action(
  "agentTools:listRecentExtractions" as any,
  {
    agentSecret,
    limit: 100,
  },
)) as any[];

const extractionCandidates = extractions.filter((extraction) => {
  const claims = Array.isArray(extraction.claims) ? extraction.claims : [];
  const parameters = Array.isArray(extraction.compositionParameters)
    ? extraction.compositionParameters
    : [];
  const allSpeculative =
    claims.length > 0 &&
    claims.every((claim: any) => claim.evidenceLevel === "speculative");
  return claims.length >= 3 && parameters.length >= 1 && !allSpeculative;
});

await writeJsonl(
  "data/eval/extractions-candidates.jsonl",
  extractionCandidates,
);

const hypotheses = (await client.action(
  "agentTools:listRecentHypotheses" as any,
  {
    agentSecret,
    limit: 100,
  },
)) as any[];

const failures = (await client.action("agentTools:listFailureArchive" as any, {
  agentSecret,
  limit: 200,
})) as any[];

const failedHypothesisIds = new Set(
  failures
    .map((failure) => failure.hypothesisId)
    .filter((id): id is string => typeof id === "string" && id.length > 0),
);

const hypothesisCandidates = hypotheses.filter((hypothesis) => {
  const why = hypothesis.whyThisMatters;
  return (
    typeof why === "string" &&
    why.trim().length >= 40 &&
    Array.isArray(hypothesis.sourceIds) &&
    hypothesis.sourceIds.length > 0 &&
    !failedHypothesisIds.has(hypothesis._id)
  );
});

await writeJsonl("data/eval/hypotheses-candidates.jsonl", hypothesisCandidates);

const weeklyBriefs = (await client.query("weeklyBriefs:list" as any, {
  limit: 25,
})) as any[];

const weeklyBriefCandidates = weeklyBriefs.filter((brief) => {
  const body = typeof brief.bodyMd === "string" ? brief.bodyMd : "";
  const activeTheses = Array.isArray(brief.activeThesisIds)
    ? brief.activeThesisIds
    : [];
  const actions = Array.isArray(brief.recommendedActions)
    ? brief.recommendedActions
    : [];
  const mentionsWeakPath =
    /\b(contradiction|contradicted|low-yield|weak path|failure)\b/i.test(body);
  return activeTheses.length > 0 && actions.length >= 3 && mentionsWeakPath;
});

await writeJsonl(
  "data/eval/weekly-briefs-candidates.jsonl",
  weeklyBriefCandidates,
);
