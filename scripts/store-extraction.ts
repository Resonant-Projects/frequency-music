/**
 * Store an extraction result from a JSON file via bunx convex run.
 * Usage: bun run scripts/store-extraction.ts <path-to-json>
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

interface StoreExtractionInput {
  sourceId: string;
  summary: string;
  claims: unknown[];
  compositionParameters: unknown[];
  topics: string[];
  openQuestions: string[];
  confidence?: number;
}

function runConvex(functionName: string, payload: string): string {
  const result = spawnSync("bunx", ["convex", "run", functionName, payload], {
    cwd: process.cwd(),
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `convex run ${functionName} failed with status ${result.status}\n${result.stderr ?? ""}`,
    );
  }

  return (result.stdout ?? "").trim();
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: store-extraction.ts <json-path>");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(path, "utf-8")) as StoreExtractionInput;

  // Compute input hash
  const encoder = new TextEncoder();
  const hashData = encoder.encode(`${data.sourceId}opus_reextract_v1`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", hashData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const inputHash = hashArray
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");

  const payload = JSON.stringify({
    sourceId: data.sourceId,
    model: "anthropic/claude-opus-4-6",
    promptVersion: "opus_reextract_v1",
    inputHash,
    summary: data.summary,
    claims: data.claims,
    compositionParameters: data.compositionParameters,
    topics: data.topics,
    openQuestions: data.openQuestions,
    confidence: data.confidence ?? 0.9,
  });

  // Store extraction
  const result = runConvex("extract:storeExtraction", payload);
  console.log(`Stored: ${result.trim()}`);

  // Update source status
  runConvex(
    "sources:updateStatus",
    JSON.stringify({ id: data.sourceId, status: "extracted" }),
  );
  console.log(`Updated source status to extracted`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
