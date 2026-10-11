/**
 * Deploy convex/ to the live self-hosted backend.
 *
 *   vp run convex:deploy           # typecheck, confirm, deploy
 *   vp run convex:deploy:dry-run   # typecheck, confirm, deploy --dry-run
 *
 * Production-contacting: even --dry-run uploads bundles and can start schema
 * and index preparation (docs/frequency-supported-deployment-rollback.md).
 * It refuses a checkout with uncommitted changes. The package scripts run the
 * root typecheck first, because the CLI's own typecheck is disabled (this repo
 * has no convex/tsconfig.json). Credentials resolve through Varlock and
 * 1Password and reach only the CLI child process.
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
  buildDeployArgs,
  buildDeployEnv,
  CONVEX_DEPLOY_URL,
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

/**
 * The deployable source and the CLI child environment. Refuses a dirty
 * checkout repository-wide: the bundle also depends on the lockfile and on
 * anything convex/ imports, so a clean convex/ alone does not make HEAD the
 * source. The CLI dotenv-loads `.env.local` and `.env` itself, so deploys
 * require a release checkout without either file.
 */
function snapshotCheckout(): { head: string; env: Record<string, string> } {
  if (git("status", "--porcelain", "--untracked-files=all")) {
    throw new Error(
      "Refusing to deploy from a checkout with uncommitted changes. Commit or stash them first.",
    );
  }
  if ([".env.local", ".env"].some((file) => existsSync(join(root, file)))) {
    throw new Error(
      "Refusing to deploy with .env or .env.local present. Use a clean release checkout with brokered credentials.",
    );
  }
  return {
    head: git("rev-parse", "HEAD"),
    env: buildDeployEnv(process.env, []),
  };
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

  const { head } = snapshotCheckout();
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

  // Re-read everything the prompt may have outlived, right before the spawn.
  const { env, head: finalHead } = snapshotCheckout();
  if (finalHead !== head) {
    throw new Error(`HEAD moved from ${head} to ${finalHead}; not deploying.`);
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
