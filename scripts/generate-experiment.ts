#!/usr/bin/env bun
/**
 * Generate a full experiment (hypothesis + recipe) from an extraction
 *
 * Usage:
 *   bun scripts/generate-experiment.ts <extractionId>
 *   bun scripts/generate-experiment.ts --auto       # Pick best extraction automatically
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL =
  process.env.CONVEX_URL || "https://righteous-marmot-892.convex.cloud";

const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  const args = process.argv.slice(2);

  let extractionId: string | null = null;

  if (args[0] === "--auto") {
    console.log("🔍 Finding best extraction for hypothesis generation...\n");

    // Get recent extractions with claims and parameters
    const extractions = await client.query(api.extractions.listRecent, {
      limit: 20,
    });

    // Score by: number of claims + number of parameters + has peer_reviewed claims
    const scored = extractions
      .map((e) => {
        const peerReviewedClaims = e.claims.filter(
          (c: any) => c.evidenceLevel === "peer_reviewed",
        ).length;
        const score =
          e.claims.length * 2 +
          e.compositionParameters.length * 3 +
          peerReviewedClaims * 5;
        return { extraction: e, score };
      })
      .toSorted((a, b) => b.score - a.score);

    if (scored.length === 0) {
      console.error("❌ No extractions found. Run some extractions first.");
      process.exit(1);
    }

    const best = scored[0];
    extractionId = best.extraction._id;

    console.log(`📊 Selected: "${best.extraction.sourceId}"`);
    console.log(`   Claims: ${best.extraction.claims.length}`);
    console.log(
      `   Parameters: ${best.extraction.compositionParameters.length}`,
    );
    console.log(`   Score: ${best.score}\n`);
  } else if (args[0]) {
    extractionId = args[0];
  } else {
    console.log("Usage:");
    console.log("  bun scripts/generate-experiment.ts <extractionId>");
    console.log("  bun scripts/generate-experiment.ts --auto");
    process.exit(1);
  }

  // Generate hypothesis
  console.log("🧪 Generating hypothesis from extraction...\n");

  try {
    const hypothesisResult = await client.action(
      api.hypotheses.generateFromExtraction,
      {
        extractionId: extractionId as any,
      },
    );

    console.log("✅ Hypothesis created!");
    console.log(`   ID: ${hypothesisResult.hypothesisId}`);
    console.log(`   Title: ${hypothesisResult.generated.title}`);
    console.log(`   Question: ${hypothesisResult.generated.question}\n`);

    // Generate recipe
    console.log("📋 Generating recipe from hypothesis...\n");

    const recipeResult = await client.action(
      api.recipes.generateFromHypothesis,
      {
        hypothesisId: hypothesisResult.hypothesisId,
      },
    );

    console.log("✅ Recipe created!");
    console.log(`   ID: ${recipeResult.recipeId}`);
    console.log(`   Title: ${recipeResult.generated.title}`);
    console.log(`   Parameters: ${recipeResult.generated.parameters.length}`);
    console.log(
      `   DAW Checklist: ${recipeResult.generated.dawChecklist.length} items\n`,
    );

    // Output summary
    console.log("=".repeat(60));
    console.log("EXPERIMENT READY");
    console.log("=".repeat(60));
    console.log(`\nHypothesis: ${hypothesisResult.generated.hypothesis}\n`);
    console.log("DAW Checklist:");
    recipeResult.generated.dawChecklist.forEach((item: string, i: number) => {
      console.log(`  ${i + 1}. ${item}`);
    });
    console.log(`\n${"=".repeat(60)}`);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
