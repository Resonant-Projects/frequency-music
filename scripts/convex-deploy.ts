/**
 * Deploy convex/ to the live self-hosted backend.
 *
 *   vp run convex:deploy           # typecheck, confirm, deploy
 *   vp run convex:deploy:dry-run   # typecheck, confirm, deploy --dry-run
 *
 * Production-contacting: even --dry-run uploads bundles and can start schema
 * and index preparation (docs/frequency-supported-deployment-rollback.md).
 * The package scripts run the root typecheck first, because the CLI's own
 * typecheck is disabled (this repo has no convex/tsconfig.json). Credentials
 * resolve through Varlock and 1Password and reach only the CLI child process.
 */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  assertCliVersion,
  assertCleanDeploySource,
  buildDeployArgs,
  buildDeployEnv,
  CONVEX_DEPLOY_URL,
  envFileKeys,
  parseDeployArgs,
} from "./lib/convex-deploy";
import { AUDITED_CONVEX_VERSION } from "./lib/convex-provenance";

const root = fileURLToPath(new URL("..", import.meta.url));

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

async function confirm(question: string): Promise<boolean> {
  if (!stdin.isTTY) {
    throw new Error("Refusing to deploy without an interactive terminal.");
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim() === "deploy";
  } finally {
    rl.close();
  }
}

async function main(): Promise<number> {
  const options = parseDeployArgs(process.argv.slice(2));

  const cliPackage = z
    .object({ version: z.string() })
    .parse(
      JSON.parse(
        readFileSync(join(root, "node_modules/convex/package.json"), "utf8"),
      ),
    );
  assertCliVersion(cliPackage.version, AUDITED_CONVEX_VERSION);

  // The CLI dotenv-loads these itself; blank their keys in the child env.
  const fileKeys = [".env.local", ".env"].flatMap((file) => {
    const path = join(root, file);
    return existsSync(path) ? envFileKeys(readFileSync(path, "utf8")) : [];
  });
  const env = buildDeployEnv(process.env, fileKeys);
  const head = git("rev-parse", "HEAD");
  assertCleanDeploySource(git("status", "--porcelain"));

  console.log(`Target:  ${CONVEX_DEPLOY_URL}`);
  console.log(`Source:  ${head}`);
  console.log(
    options.dryRun
      ? "Mode:    --dry-run (uploads and prepares schema/indexes; no activation)"
      : "Mode:    deploy (activates functions, schema, crons, and auth config)",
  );
  if (!(await confirm('Type "deploy" to continue: '))) {
    console.log("Cancelled.");
    return 1;
  }

  assertCleanDeploySource(git("status", "--porcelain"));
  if (git("rev-parse", "HEAD") !== head) {
    throw new Error(
      "Source commit changed during confirmation. Restart the deployment.",
    );
  }

  const result = spawnSync(process.execPath, buildDeployArgs(options), {
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
