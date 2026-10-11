/**
 * Guarded `convex deploy` for the one live self-hosted backend. Follows the CLI
 * contract in docs/frequency-supported-deployment-rollback.md: the installed,
 * audited CLI entrypoint, `--typecheck disable --codegen disable`, a pinned
 * target, and a child environment that carries only the self-hosted
 * credentials (no deploy key, project selection, or app secrets).
 *
 * The CLI dotenv-loads `.env.local` and `.env` from its working directory, and
 * dotenv never overrides a variable that is already set. Every name those files
 * could define is therefore pre-set to "" (which the CLI treats as unset), so a
 * deploy key there cannot outrank the self-hosted pair and app secrets there
 * cannot re-enter the child.
 */

export const CONVEX_DEPLOY_URL = "https://convex.resonantprojects.art";

export const CONVEX_CLI_ENTRYPOINT = "node_modules/convex/bin/main.js";

/** Non-secret process variables the CLI child may inherit. */
const PASSTHROUGH_VARS = ["PATH", "HOME", "TMPDIR", "TERM", "LANG"] as const;

export interface DeployOptions {
  dryRun: boolean;
}

export function parseDeployArgs(argv: readonly string[]): DeployOptions {
  if (argv.length === 0) return { dryRun: false };
  if (argv.length === 1 && argv[0] === "--dry-run") return { dryRun: true };
  throw new Error(
    `Unsupported arguments: ${argv.join(" ")}. Only --dry-run is accepted.`,
  );
}

export function buildDeployArgs(options: DeployOptions): string[] {
  return [
    CONVEX_CLI_ENTRYPOINT,
    "deploy",
    "--typecheck",
    "disable",
    "--codegen",
    "disable",
    ...(options.dryRun ? ["--dry-run"] : []),
  ];
}

export function buildDeployEnv(
  source: Readonly<Record<string, string | undefined>>,
  blankKeys: Iterable<string> = [],
): Record<string, string> {
  const url = source.CONVEX_SELF_HOSTED_URL;
  if (url !== CONVEX_DEPLOY_URL) {
    throw new Error(
      `CONVEX_SELF_HOSTED_URL must be ${CONVEX_DEPLOY_URL}; resolved ${url ? "a different URL" : "nothing"}.`,
    );
  }
  const adminKey = source.CONVEX_SELF_HOSTED_ADMIN_KEY;
  if (!adminKey) {
    throw new Error(
      "CONVEX_SELF_HOSTED_ADMIN_KEY did not resolve. Unlock 1Password and check `vp run env:check`.",
    );
  }
  const env: Record<string, string> = {};
  for (const name of PASSTHROUGH_VARS) {
    const value = source[name];
    if (value) env[name] = value;
  }
  env.CONVEX_SELF_HOSTED_URL = url;
  env.CONVEX_SELF_HOSTED_ADMIN_KEY = adminKey;
  for (const name of blankKeys) {
    if (!Object.hasOwn(env, name)) env[name] = "";
  }
  return env;
}

/**
 * dotenv 16.6.1's assignment grammar, verbatim from the copy bundled into the
 * pinned Convex CLI (`node_modules/convex/dist/cli.bundle.cjs`). A test fails
 * if the installed bundle's grammar drifts from this copy.
 */
export const DOTENV_LINE_SOURCE =
  "(?:^|^)\\s*(?:export\\s+)?([\\w.-]+)(?:\\s*=\\s*?|:\\s+?)(\\s*'(?:\\\\'|[^'])*'|\\s*\"(?:\\\\\"|[^\"])*\"|\\s*`(?:\\\\`|[^`])*`|[^#\\r\\n]+)?\\s*(?:#.*)?(?:$|$)";

/**
 * Every name the CLI's dotenv could load from `contents`: the keys its exact
 * grammar parses (after the same CR normalization), unioned with any
 * line-start `key=` or `key:` as a margin. Over-matching only blanks extra
 * names.
 */
export function envFileKeys(contents: string): string[] {
  const keys = new Set<string>();
  const normalized = contents.replaceAll(/\r\n?/g, "\n");
  for (const match of normalized.matchAll(
    new RegExp(DOTENV_LINE_SOURCE, "mg"),
  )) {
    if (match[1]) keys.add(match[1]);
  }
  for (const line of contents.split(/\r\n?|\n|\u2028|\u2029/)) {
    const match = /^\s*(?:export\s+)?([\w.-]+)\s*[=:]/.exec(line);
    if (match?.[1]) keys.add(match[1]);
  }
  return [...keys];
}

export function assertCliVersion(installed: string, audited: string): void {
  if (installed !== audited) {
    throw new Error(
      `Installed convex CLI is ${installed}; the audited deploy CLI is ${audited}. Run \`vp install\` from the lockfile.`,
    );
  }
}

/** A displayed commit must identify every deployable source byte. */
export function assertCleanDeploySource(status: string): void {
  if (status.trim()) {
    throw new Error(
      "Refusing to deploy an uncommitted checkout. Commit or restore source changes first.",
    );
  }
}
