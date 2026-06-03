import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { graph } from "../src/graphs/research-pipeline/index.js";

export type ResearchPipelineSmokeEnv = {
  RUN_RESEARCH_PIPELINE_SMOKE?: string | undefined;
  CONVEX_SITE_URL?: string | undefined;
  CONVEX_URL?: string | undefined;
  CONVEX_SELF_HOSTED_URL?: string | undefined;
  AGENT_TOOL_SECRET?: string | undefined;
};

const SECRET_SAFE_ENV_KEYS = new Set([
  "CONVEX_SITE_URL",
  "CONVEX_URL",
  "CONVEX_SELF_HOSTED_URL",
  "AGENT_TOOL_SECRET",
]);

function envFromProcess(): ResearchPipelineSmokeEnv {
  return {
    RUN_RESEARCH_PIPELINE_SMOKE: process.env.RUN_RESEARCH_PIPELINE_SMOKE,
    CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
    CONVEX_URL: process.env.CONVEX_URL,
    CONVEX_SELF_HOSTED_URL: process.env.CONVEX_SELF_HOSTED_URL,
    AGENT_TOOL_SECRET: process.env.AGENT_TOOL_SECRET,
  };
}

function unquoteEnvValue(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

export function shouldRunResearchPipelineSmoke(env: ResearchPipelineSmokeEnv = envFromProcess()): boolean {
  const value = env.RUN_RESEARCH_PIPELINE_SMOKE?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function getConvexSiteUrlFromEnv(env: ResearchPipelineSmokeEnv = envFromProcess()): string | undefined {
  return env.CONVEX_SITE_URL ?? env.CONVEX_URL ?? env.CONVEX_SELF_HOSTED_URL;
}

export function loadRootEnvLocalForResearchSmoke() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(scriptDir, "..", "..", ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!SECRET_SAFE_ENV_KEYS.has(key)) continue;
    if (process.env[key]) continue;
    process.env[key] = unquoteEnvValue(valueParts.join("="));
  }
}

function requireSmokeEnvironment() {
  const convexSiteUrl = getConvexSiteUrlFromEnv();
  if (!convexSiteUrl) {
    throw new Error("CONVEX_SITE_URL, CONVEX_URL, or CONVEX_SELF_HOSTED_URL is required");
  }
  if (!process.env.CONVEX_SITE_URL) {
    process.env.CONVEX_SITE_URL = convexSiteUrl;
  }
  if (!process.env.AGENT_TOOL_SECRET) {
    throw new Error("AGENT_TOOL_SECRET is required");
  }
}

function eventMessages(result: { auditEvents?: Array<{ message?: string }> }) {
  return (result.auditEvents ?? []).map((event) => event.message).filter(Boolean);
}

export async function runResearchPipelineSmoke() {
  loadRootEnvLocalForResearchSmoke();
  requireSmokeEnvironment();

  const smokeRunId = `research-pipeline-smoke-${new Date().toISOString()}`;
  const result = await graph.invoke({
    runId: smokeRunId,
    dryRun: true,
    smokeMode: true,
    limit: 3,
  });

  if (!result.agentRunId) {
    throw new Error("Research pipeline smoke did not create a Convex agentRunId");
  }
  if (result.errors.length > 0) {
    throw new Error(`Research pipeline smoke reported errors: ${result.errors.join("; ")}`);
  }
  if (!result.draft || result.draft.kind !== "dry_run_summary") {
    throw new Error("Research pipeline smoke did not produce a dry_run_summary draft");
  }

  const messages = eventMessages(result);
  console.log(
    JSON.stringify(
      {
        ok: true,
        graph: "research-pipeline",
        smokeMode: true,
        agentRunId: result.agentRunId,
        draftKind: result.draft.kind,
        candidateCount: result.candidates.length,
        auditEventCount: result.auditEvents.length,
        auditMessages: messages,
      },
      null,
      2,
    ),
  );
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  try {
    await runResearchPipelineSmoke();
  } catch (error) {
    console.error(
      `Research pipeline smoke failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
