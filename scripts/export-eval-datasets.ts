#!/usr/bin/env -S vpx tsx

import "varlock/auto-load";
import { ConvexHttpClient } from "convex/browser";
import { mkdir, writeFile } from "node:fs/promises";
import {
  createEvalQuery,
  enrichHypothesis,
  getRow,
  getSource,
  withPlaceholderTheses,
  type Row,
} from "./lib/eval-dataset-helpers";

const convexUrl = process.env.CONVEX_URL ?? process.env.CONVEX_SELF_HOSTED_URL;
const agentSecret = process.env.AGENT_TOOL_SECRET;

if (!convexUrl) {
  throw new Error("CONVEX_URL or CONVEX_SELF_HOSTED_URL is required");
}

if (!agentSecret) {
  throw new Error("AGENT_TOOL_SECRET is required");
}

const client = new ConvexHttpClient(convexUrl);
const query = createEvalQuery(client);

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

const enrichedExtractionCandidates = await Promise.all(
  extractionCandidates.map(async (extraction) => {
    const source = await getSource(query, extraction.sourceId);
    return {
      sourceTitle: source?.title ?? "(untitled source)",
      sourceType: source?.type ?? "url",
      rawText: source?.rawText ?? source?.transcript ?? "",
      ...extraction,
    };
  }),
);

await writeJsonl(
  "data/eval/extractions-candidates.jsonl",
  enrichedExtractionCandidates,
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

const enrichedHypothesisCandidates = await Promise.all(
  hypothesisCandidates.map((hypothesis) =>
    enrichHypothesis(query, hypothesis, "skip"),
  ),
);

await writeJsonl(
  "data/eval/hypotheses-candidates.jsonl",
  enrichedHypothesisCandidates,
);

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

const enrichedWeeklyBriefCandidates = await Promise.all(
  weeklyBriefCandidates.map(async (brief) => {
    const [linkedHypotheses, linkedRecipes, storedTheses, linkedFailures] =
      await Promise.all([
        Promise.all(
          (brief.recommendedHypothesisIds ?? []).map((id: string) =>
            getRow(query, "hypotheses:get", id),
          ),
        ),
        Promise.all(
          (brief.recommendedRecipeIds ?? []).map((id: string) =>
            getRow(query, "recipes:get", id),
          ),
        ),
        query("theses:getByIds", {
          ids: brief.activeThesisIds ?? [],
        }) as Promise<Row[]>,
        query("failures:getByKeys", {
          keys: brief.referencedFailureKeys ?? [],
        }) as Promise<Row[]>,
      ]);
    return {
      // Enriched the same way as `hypotheses-candidates.jsonl`, so the same
      // hypothesis id materializes identically whether standalone or embedded.
      hypotheses: await Promise.all(
        linkedHypotheses
          .filter((row): row is Row => row !== null)
          .map((hypothesis) => enrichHypothesis(query, hypothesis, "skip")),
      ),
      recipes: linkedRecipes.filter((row): row is Row => row !== null),
      theses: withPlaceholderTheses(brief, storedTheses),
      failures: linkedFailures,
      ...brief,
    };
  }),
);

await writeJsonl(
  "data/eval/weekly-briefs-candidates.jsonl",
  enrichedWeeklyBriefCandidates,
);
