/**
 * Backfill concept links for every stored Extraction on the live self-hosted
 * backend (graph.buildGraphFromExtractions). Idempotent: rerunning it adds no
 * edges and counts no extra mentions.
 *
 *   vp run graph:backfill
 *
 * The action is internal, so it runs through `convex run` with the
 * self-hosted admin key. Credentials resolve through Varlock and 1Password
 * and reach only the CLI child process, exactly as for scripts/convex-deploy.ts.
 * Names in `.env.local` and `.env` are blanked in the child so a stray
 * CONVEX_DEPLOYMENT or deploy key there cannot redirect the run.
 */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  assertCliVersion,
  buildDeployEnv,
  CONVEX_DEPLOY_URL,
  envFileKeys,
  GRAPH_BACKFILL_ARGS,
} from "./lib/convex-deploy";
import { AUDITED_CONVEX_VERSION } from "./lib/convex-provenance";

const root = fileURLToPath(new URL("..", import.meta.url));

async function confirm(question: string): Promise<boolean> {
  if (!stdin.isTTY) {
    throw new Error(
      "Refusing to run the backfill without an interactive terminal.",
    );
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim() === "backfill";
  } finally {
    rl.close();
  }
}

async function main(): Promise<number> {
  const cliPackage = z
    .object({ version: z.string() })
    .parse(
      JSON.parse(
        readFileSync(join(root, "node_modules/convex/package.json"), "utf8"),
      ),
    );
  assertCliVersion(cliPackage.version, AUDITED_CONVEX_VERSION);

  const blankKeys = [".env.local", ".env"]
    .map((file) => join(root, file))
    .filter((file) => existsSync(file))
    .flatMap((file) => envFileKeys(readFileSync(file, "utf8")));
  const env = buildDeployEnv(process.env, blankKeys);

  console.log(`Target:  ${CONVEX_DEPLOY_URL}`);
  console.log("Action:  graph:buildGraphFromExtractions (all Extractions)");
  if (!(await confirm('Type "backfill" to continue: '))) {
    console.log("Cancelled.");
    return 1;
  }
  const result = spawnSync(process.execPath, [...GRAPH_BACKFILL_ARGS], {
    cwd: root,
    env: env as unknown as NodeJS.ProcessEnv,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.signal ? 1 : (result.status ?? 1);
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
