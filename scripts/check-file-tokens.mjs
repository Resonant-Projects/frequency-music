#!/usr/bin/env node
// Pre-commit guard: block files over MAX_TOKENS estimated tokens.
//
// Tokens are estimated as bytes / 4, so the limit is MAX_TOKENS * 4 bytes. The
// check reads the *staged* blob (`git cat-file -s :path`), not the working-tree
// file, so partially staged files are measured as they will be committed.
//
// Usage:
//   node scripts/check-file-tokens.mjs        # staged files (pre-commit)
//   node scripts/check-file-tokens.mjs --all  # every tracked file at HEAD
//
// No dependencies: only `node` and `git` on PATH.

import { execFileSync } from "node:child_process";

const MAX_TOKENS = 5000;
const BYTES_PER_TOKEN = 4;
const MAX_BYTES = MAX_TOKENS * BYTES_PER_TOKEN;

// ---------------------------------------------------------------------------
// Ignore list. Add a line here when a path is genuinely generated, vendored,
// or binary. Patterns use gitignore-style globs:
//   - a pattern without "/" matches the file's basename anywhere in the tree
//   - a pattern with "/" matches the full repo-relative path
//   - "**" matches any number of directories, "*" never crosses "/"
// Anything git itself treats as binary is skipped automatically.
// ---------------------------------------------------------------------------
const IGNORE_PATTERNS = [
  // Lockfiles (package managers own these).
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Cargo.lock",
  "poetry.lock",
  "uv.lock",
  "Gemfile.lock",
  "go.sum",
  "composer.lock",
  "flake.lock",

  // Generated / codegen output.
  "convex/_generated/**",
  "**/generated/**",
  "*.gen.*",
  "routeTree.gen.ts",
  "worker-configuration.d.ts",
  "dist/**",
  "build/**",
  "**/dist/**",
  "**/build/**",

  // Minified bundles and test snapshots.
  "*.min.*",
  "**/__snapshots__/**",

  // Binaries and assets (belt-and-braces; git's own binary detection also applies).
  "*.png",
  "*.jpg",
  "*.jpeg",
  "*.gif",
  "*.webp",
  "*.avif",
  "*.ico",
  "*.svg",
  "*.woff",
  "*.woff2",
  "*.ttf",
  "*.otf",
  "*.eot",
  "*.zip",
  "*.gz",
  "*.tgz",
  "*.tar",
  "*.7z",
  "*.rar",
  "*.db",
  "*.sqlite",
  "*.sqlite3",
  "*.pdf",
  "*.mp3",
  "*.wav",
  "*.flac",
  "*.ogg",
  "*.m4a",
  "*.mp4",
  "*.mov",
  "*.webm",
  "*.mkv",
  "*.midi",
  "*.mid",

  // --- Repo-specific additions (frequency-music) ---
  // SQLite snapshot and the archived research bundle at the repo root.
  "frequency.db",
  "files.zip",
  // Exported datasets written by scripts, never edited by hand.
  "data/generated/**",
  "data/eval/**",
  "data/pdfs/**",
  // Essay exports and manifest produced by `vp run essays:publish`.
  "exports/**",
  // Operator evidence captures (deployment inspections, receipts, manifests).
  "docs/evidence/**",
  // Browser "save page" bundles kept alongside a saved HTML review.
  "docs/*_files/**",
  // Frozen reference scripts: read-only by policy (see AGENTS.md).
  "scripts/archive/**",
  // Panda CSS output (gitignored, listed for safety).
  "web/styled-system/**",
];

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function globToRegExp(pattern) {
  let source = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        // "**/" matches zero or more directories; a trailing "**" matches the rest.
        if (pattern[i + 2] === "/") {
          source += "(?:.*/)?";
          i += 2;
        } else {
          source += ".*";
          i += 1;
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else if (/[.+^${}()|[\]\\]/.test(char)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }
  return new RegExp(`^${source}$`);
}

const IGNORE_MATCHERS = IGNORE_PATTERNS.map((pattern) => ({
  regExp: globToRegExp(pattern),
  basenameOnly: !pattern.includes("/"),
}));

function isIgnored(path) {
  const basename = path.slice(path.lastIndexOf("/") + 1);
  return IGNORE_MATCHERS.some(({ regExp, basenameOnly }) =>
    regExp.test(basenameOnly ? basename : path),
  );
}

function splitNul(output) {
  return output.split("\0").filter((entry) => entry.length > 0);
}

/** Paths git reports as binary (numstat prints "-\t-" for them). */
function binaryPaths(diffArgs) {
  const binary = new Set();
  const output = git(["diff", "--numstat", "--no-renames", "-z", ...diffArgs]);
  for (const entry of splitNul(output)) {
    // "added\tdeleted\tpath": split on the first two tabs only, because -z
    // leaves literal tabs inside a filename unescaped.
    const [added, deleted, ...rest] = entry.split("\t");
    const path = rest.join("\t");
    if (added === "-" && deleted === "-" && path) binary.add(path);
  }
  return binary;
}

const GITLINK_MODE = "160000";

/** Index entries that are submodule pointers (their object is a commit, not a blob). */
function stagedGitlinks() {
  const gitlinks = new Set();
  for (const entry of splitNul(git(["ls-files", "--stage", "-z"]))) {
    const tab = entry.indexOf("\t");
    const mode = entry.slice(0, entry.indexOf(" "));
    if (mode === GITLINK_MODE) gitlinks.add(entry.slice(tab + 1));
  }
  return gitlinks;
}

function blobSize(spec) {
  return Number.parseInt(git(["cat-file", "-s", spec]).trim(), 10);
}

function stagedCandidates() {
  const paths = splitNul(
    git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]),
  );
  const binary = binaryPaths(["--cached", "--diff-filter=ACMR"]);
  const gitlinks = stagedGitlinks();
  return paths
    .filter((path) => !binary.has(path) && !gitlinks.has(path))
    .map((path) => ({ path, bytes: () => blobSize(`:${path}`) }));
}

function trackedCandidates() {
  // Walk HEAD's tree (not the index) so --all measures exactly what is
  // committed; --long reports each blob's size, so no per-file cat-file.
  const entries = splitNul(git(["ls-tree", "-r", "-z", "--long", "HEAD"]));
  // Compare HEAD against the empty tree so every tracked file is "added".
  const emptyTree = git(["hash-object", "-t", "tree", "/dev/null"]).trim();
  const binary = binaryPaths([emptyTree, "HEAD"]);
  const candidates = [];
  for (const entry of entries) {
    // "<mode> <type> <sha> <size>\t<path>"
    const tab = entry.indexOf("\t");
    const [, type, , size] = entry.slice(0, tab).split(/\s+/);
    const path = entry.slice(tab + 1);
    if (type !== "blob" || binary.has(path)) continue;
    const bytes = Number.parseInt(size, 10);
    candidates.push({ path, bytes: () => bytes });
  }
  return candidates;
}

function findOversized(candidates) {
  const oversized = [];
  for (const { path, bytes: readBytes } of candidates) {
    if (isIgnored(path)) continue;
    const bytes = readBytes();
    if (bytes > MAX_BYTES) {
      oversized.push({
        path,
        bytes,
        tokens: Math.ceil(bytes / BYTES_PER_TOKEN),
      });
    }
  }
  return oversized.toSorted((a, b) => b.bytes - a.bytes);
}

function formatRow({ path, tokens, bytes }) {
  return `  ${path}  (~${tokens.toLocaleString("en-US")} tokens, ${bytes.toLocaleString("en-US")} bytes)`;
}

function printFailure(oversized) {
  const lines = [
    "",
    `✖ ${oversized.length} staged file(s) exceed the ${MAX_TOKENS.toLocaleString("en-US")}-token limit (~${MAX_BYTES.toLocaleString("en-US")} bytes, estimated as bytes / ${BYTES_PER_TOKEN}):`,
    "",
    ...oversized.map(formatRow),
    "",
    "Large files are hard for people and coding agents to read and edit safely.",
    "Split each file before committing:",
    "  1. Split by responsibility into smaller modules, one concern per file.",
    "  2. Move types, constants, and helpers into their own files.",
    "  3. Extract components and sub-functions into separate files.",
    "  4. Re-export from an index.ts if callers need a single import path.",
    `  5. Keep every new file under ${MAX_TOKENS.toLocaleString("en-US")} tokens (~${MAX_BYTES.toLocaleString("en-US")} bytes).`,
    "",
    "Emergency bypass (use sparingly, and say so in the PR):",
    "  git commit --no-verify",
    "",
    "If a file is genuinely generated, vendored, or binary, add its path to",
    "IGNORE_PATTERNS in scripts/check-file-tokens.mjs instead of bypassing.",
    "",
  ];
  process.stderr.write(`${lines.join("\n")}\n`);
}

function main() {
  const scanAll = process.argv.includes("--all");
  const oversized = findOversized(
    scanAll ? trackedCandidates() : stagedCandidates(),
  );

  if (scanAll) {
    process.stdout.write(
      `${oversized.length} tracked file(s) over ${MAX_TOKENS.toLocaleString("en-US")} tokens (ignored paths excluded):\n`,
    );
    for (const row of oversized) process.stdout.write(`${formatRow(row)}\n`);
    return oversized.length === 0 ? 0 : 1;
  }

  if (oversized.length === 0) return 0;
  printFailure(oversized);
  return 1;
}

process.exitCode = main();
