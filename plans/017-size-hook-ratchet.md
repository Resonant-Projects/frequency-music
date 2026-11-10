# Plan 017: Make the file-size hook a ratchet so over-limit files can be fixed

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report; do not
> improvise. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat cf4a8174..HEAD -- scripts/check-file-tokens.mjs scripts/check-file-tokens.test.ts AGENTS.md README.md`
> If any of these changed, compare the "Current state" excerpts with the live
> code before proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P1 (unblocks plans 019, 020, 023, 024)
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `cf4a8174`, 2026-11-09

## Why this matters

The pre-commit hook rejects every staged file over 20,000 bytes. It has no
exception for files that were already over the limit when the hook landed on
2026-10-20, and 107 tracked files are. Those files, including
`convex/sources.ts` (53,025 bytes) and `convex/schema.ts` (46,799 bytes),
cannot be committed at all without a large split or `--no-verify`, so bug
fixes in them are stuck. The maintainer decided on 2026-11-09 to change the
policy to a ratchet: a committed baseline records each over-limit file's size,
and the hook blocks new over-limit files and any growth past a baseline entry.
Files can still be fixed; they can only stay the same size or shrink.

## Current state

- `scripts/check-file-tokens.mjs` (11,500 bytes) — the checker. Dependency-free
  Node; uses only `git`.
- `scripts/check-file-tokens.test.ts` — its tests (vitest through `vp test`).
- `.vite-hooks/pre-commit` — runs `node scripts/check-file-tokens.mjs`. Do not
  change it.
- `AGENTS.md:24` and `README.md:117` — describe the hook to people and agents.

The limit and the decision of what counts as oversized
(`scripts/check-file-tokens.mjs:19-21` and `:300-318`):

```js
const MAX_TOKENS = 5000;
const BYTES_PER_TOKEN = 4;
const MAX_BYTES = MAX_TOKENS * BYTES_PER_TOKEN;
```

```js
function findOversized({ tree, candidates }) {
  const overLimit = candidates.filter(
    ({ path, bytes }) => bytes > MAX_BYTES && !isIgnored(path),
  );
  const binary = binaryPaths(
    overLimit.map(({ path }) => path),
    tree,
  );
  return overLimit
    .filter(({ path }) => !binary.has(path))
    .map(({ path, bytes }) => ({
      path,
      bytes,
      tokens: Math.ceil(bytes / BYTES_PER_TOKEN),
    }))
    .toSorted((a, b) => b.bytes - a.bytes);
}
```

The entry point (`scripts/check-file-tokens.mjs:349-367`):

```js
export function main(argv = process.argv.slice(2)) {
  const scanAll = argv.includes("--all");
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
```

`git(args)` (line 124) runs git from the repository root and sets the
module-level `repoRoot`. `stagedCandidates()` measures staged blobs;
`trackedCandidates()` measures every blob at `HEAD`.

The repo-specific ignore list ends like this (`:95-114`):

```js
  // Essay exports and manifest produced by `vp run essays:publish`.
  "exports/**",
```

`docs/essays/metadata.json` (222,492 bytes) is also produced by
`vp run essays:publish` (`package.json`: `"essays:metadata": "vpx tsx
scripts/generate-essay-metadata.ts"`), but it is not ignored. The
`publish-essays` GitHub workflow commits it with a plain `git commit` after
`bun install` has installed the hook, so that bot commit would be rejected.

The existing staged-check tests build a throwaway git repo
(`scripts/check-file-tokens.test.ts:58-88`). Match this pattern:

```ts
function init() {
  repo = mkdtempSync(join(tmpdir(), "file-tokens-"));
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
}

function stage(path: string, content: string) {
  writeFileSync(join(repo, path), content);
  git("add", "--", path);
}

function check(cwd = repo) {
  return spawnSync(process.execPath, [checker], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, APP_ENV: "test" },
  });
}
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `vp install` (repo root) | exit 0 |
| Hook tests | `vp test scripts/check-file-tokens` | all pass |
| Lint | `vp run lint:check` | exit 0 |
| Format | `vp run format:check` | exit 0 |
| Typecheck | `vp run typecheck:scripts` | exit 0 |
| List | `node scripts/check-file-tokens.mjs --all` | see steps |

Never run `vpx convex ...` or `bunx convex ...`; they contact the live
production backend. This plan does not need them.

## Scope

**In scope** (the only files you may modify or create):
- `scripts/check-file-tokens.mjs`
- `scripts/check-file-tokens-baseline.test.ts` (create)
- `scripts/file-token-baseline.json` (create, generated in step 4)
- `AGENTS.md` (line 24 only)
- `README.md` (line 117 only)

**Out of scope** (do NOT touch):
- `.vite-hooks/pre-commit` — the hook command stays the same.
- `.github/workflows/*` — the CI step for this check is in plan 022.
- `scripts/check-file-tokens.test.ts` — existing tests must keep passing
  unchanged; new tests go in the new file so neither file nears the limit.
- Any of the over-limit files themselves. This plan splits nothing.
- `MAX_TOKENS` — the limit does not change.

## Git workflow

- Branch: `chore/size-hook-ratchet`
- Conventional commits, as in `git log`: e.g. `fix(hooks): judge binaries by
  staged content, run git from the root`. Suggested:
  `feat(hooks): ratchet over-limit files against a committed baseline`.
- Do not use `git commit --no-verify`. Do not push or open a PR unless the
  operator asked for it.

## Steps

### Step 1: Ignore the generated essay metadata

In `IGNORE_PATTERNS`, directly under the `"exports/**",` line, add:

```js
  // Essay metadata, regenerated by `vp run essays:metadata`.
  "docs/essays/metadata.json",
```

**Verify**: `node -e 'import("./scripts/check-file-tokens.mjs").then(m => console.log(m.isIgnored("docs/essays/metadata.json")))'` → prints `true`.

### Step 2: Load the baseline

In `scripts/check-file-tokens.mjs`, add `readFileSync` and `writeFileSync`
from `node:fs` and `join` from `node:path` to the imports. Add:

```js
const BASELINE_PATH = "scripts/file-token-baseline.json";

/** Over-limit files recorded at their accepted size: { [path]: bytes }. */
export function readBaseline(root) {
  try {
    const parsed = JSON.parse(readFileSync(join(root, BASELINE_PATH), "utf8"));
    return parsed.files ?? {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}
```

A missing file means an empty baseline. A malformed file must throw, so a
broken baseline never silently disables the check. `root` is the repository
root; obtain it with `git(["rev-parse", "--show-toplevel"]).trim()`.

**Verify**: `vp run typecheck:scripts` → exit 0.

### Step 3: Apply the ratchet in `findOversized`

Give `findOversized` a second parameter `baseline` (default `{}`). A candidate
is a violation when `bytes > MAX_BYTES`, it is not ignored, it is not binary,
and it is NOT covered. "Covered" means `baseline[path]` is a number and
`bytes <= baseline[path]`. Add `baselineBytes: baseline[path]` (may be
`undefined`) to each returned row.

Update `formatRow` so a row with `baselineBytes` defined ends with
`, baseline 21,330 bytes: this file grew` (use the row's own numbers). Rows
without it print exactly as today; an existing test asserts
`big.ts  (~6,250 tokens, 25,000 bytes)`.

In `printFailure`, add these lines after the existing "Emergency bypass" block:

```
A file listed in scripts/file-token-baseline.json may be committed at or
below its recorded size. To add lines to it, move something out first.
```

Update `main`:
- Read the baseline once and pass it to `findOversized`.
- `--all` now prints two things: the violations (same row format), then
  `N over-limit file(s) within baseline.` It returns 0 when there are no
  violations, 1 otherwise. Count the within-baseline files by calling
  `findOversized` once with `{}` and once with the baseline.

**Verify**: `vp test scripts/check-file-tokens` → all existing tests pass.

### Step 4: Add `--write-baseline` and `--prune-baseline`

Both operate on `HEAD` (use `trackedCandidates()`), never on the index.

- `--write-baseline`: if `scripts/file-token-baseline.json` already exists,
  print `Baseline exists; use --prune-baseline to lower it.` to stderr and
  return 1. Otherwise write
  `{ "version": 1, "files": { "<path>": <bytes>, ... } }` for every row from
  `findOversized(trackedCandidates(), {})`, keys sorted with
  `localeCompare`, 2-space indent, trailing newline. Print the entry count.
- `--prune-baseline`: for each existing entry, look up the file's current
  size at `HEAD`. Drop the entry when the file is gone, ignored, or now at or
  under `MAX_BYTES`. Otherwise set it to `Math.min(existing, current)`. Never
  add an entry and never raise one. Print how many entries were dropped and
  lowered.

Then generate the baseline for this repository:

`node scripts/check-file-tokens.mjs --write-baseline`

**Verify**:
- `node scripts/check-file-tokens.mjs --all` → exit 0 and a final line
  `N over-limit file(s) within baseline.` with N around 105.
- `wc -c scripts/file-token-baseline.json` → under 20,000.
- `node -e 'const b=require("./scripts/file-token-baseline.json").files; console.log(b["convex/sources.ts"], b["docs/essays/metadata.json"])'`
  → `53025 undefined` (the first number is `convex/sources.ts` at `HEAD`; if
  HEAD has moved, it must equal `git cat-file -s HEAD:convex/sources.ts`).

### Step 5: Update the two docs lines

`AGENTS.md:24` — replace the sentence "Split oversized files by responsibility
instead of bypassing;" and the final sentence so the bullet reads:

> ... blocks any staged file over 5,000 estimated tokens (bytes / 4, so 20,000
> bytes), except a file listed in `scripts/file-token-baseline.json`, which may
> be committed at or below its recorded size. To add to a baselined file, move
> something out of it first; never raise a baseline entry. Generated or binary
> paths belong in `IGNORE_PATTERNS` in `scripts/check-file-tokens.mjs`.
> `vp run check:file-tokens -- --all` fails on any file outside the baseline;
> `-- --prune-baseline` lowers entries after a file shrinks.

Keep the opening clause about `.vite-hooks/pre-commit` and `prepare` as it is.

`README.md:117` — append one sentence: "Files already over the limit are
listed in `scripts/file-token-baseline.json` and may not grow."

**Verify**: `vp run format:check` → exit 0.

## Test plan

Create `scripts/check-file-tokens-baseline.test.ts`, modelled on the "staged
check" block of `scripts/check-file-tokens.test.ts` (copy its `init`, `stage`,
`check` helpers; import from `vite-plus/test`). Write the baseline into the
throwaway repo with `mkdirSync(join(repo, "scripts"))` and `writeFileSync`.
Cases:

1. A staged 25,000-byte file with a baseline entry of 25,000 → exit 0.
2. The same file at 25,001 bytes → exit 1, stderr contains `this file grew`.
3. The same file at 24,000 bytes → exit 0.
4. A staged 25,000-byte file with no baseline entry → exit 1 (new files are
   still blocked).
5. No baseline file at all → behaves as today (exit 1 for the big file).
6. A malformed baseline file (`not json`) → non-zero exit; the check does not
   pass.
7. `--all` in a repo whose only over-limit committed file is baselined →
   exit 0, stdout contains `1 over-limit file(s) within baseline.`
8. `--prune-baseline` after committing the file at 24,000 bytes lowers the
   entry to 24,000; after committing it at 100 bytes the entry is removed.
9. `--write-baseline` refuses when a baseline exists (exit 1).
10. `isIgnored("docs/essays/metadata.json")` is `true`.

For cases 7–9 commit inside the throwaway repo with
`git("commit", "-q", "-m", "x", "--no-verify")`; that repo has no hooks, and
this is the only place `--no-verify` is allowed.

**Verify**: `vp test scripts/check-file-tokens` → all pass, including 10 new.

## Done criteria

- [ ] `vp test scripts/check-file-tokens` exits 0 with the 10 new tests.
- [ ] `node scripts/check-file-tokens.mjs --all` exits 0.
- [ ] `scripts/file-token-baseline.json` exists, is under 20,000 bytes, and
      has no entry for `docs/essays/metadata.json`.
- [ ] `vp run lint:check`, `vp run format:check`, `vp run typecheck:scripts`
      exit 0.
- [ ] `git status --short` lists only the five in-scope files.
- [ ] The commit was made without `--no-verify`.
- [ ] `plans/README.md` row for 017 updated.

## STOP conditions

- `scripts/check-file-tokens.mjs` does not match the excerpts above.
- `vp run typecheck:scripts` or `vp run lint:check` fails before you change
  anything (record the output; that failure predates this plan).
- After step 4, `--all` still reports violations. Do not edit the baseline by
  hand to hide them; report which files.
- You find yourself wanting to raise `MAX_TOKENS` or add an authored source
  file to `IGNORE_PATTERNS`.

## Maintenance notes

- The baseline is a ceiling, not a target. A baselined file that shrinks keeps
  its old ceiling until someone runs `--prune-baseline`; plans 019 and 020
  rely on that headroom in `convex/sources.ts`, so do not prune between them.
- Renaming a baselined file drops its coverage (the new path has no entry).
  That is intended: a rename is a good moment to split.
- A reviewer should reject any PR that raises a number in
  `scripts/file-token-baseline.json` or adds a key to it.
- Deferred: running `--all` in CI (plan 022) and splitting the highest-churn
  files (`convex/schema.ts`, `convex/sources.ts`) by responsibility.
