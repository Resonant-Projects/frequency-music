# Plan 001: Remove the committed auth-bypass secret from all 10 locations and prepare rotation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e07be2e..HEAD -- CLAUDE.md scripts/ web/tests/e2e/cleanup.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Secret-handling rule (binding)**: the credential value you will encounter
> in these files must NEVER be written into this plan, a commit message, a PR
> description, your final report, or any new file. Refer to it only as "the
> bypass secret".

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `e07be2e`, 2026-06-12

## Why this matters

The Convex deployment's `AUTH_BYPASS_SECRET` — the production *write* credential for every `requireAuth`-guarded mutation (status changes, hard deletes, visibility promotion) — is committed as a literal string in 10 files and throughout git history. `AGENTS.md` was already sanitized to placeholders (proof the team knows it shouldn't be committed), but `CLAUDE.md` and 8 code files were not. Because git history retains the value, removal alone is insufficient: the secret must also be rotated on the deployment. This plan does the code/docs half and produces a precise rotation checklist for the operator.

## Current state

The bypass secret appears as a literal in exactly these locations (verified at `e07be2e` via `git grep`):

| File | Line | Shape |
|------|------|-------|
| `CLAUDE.md` | 154 | inside a `bunx convex run` example (`"devBypassSecret": "<value>"`) |
| `CLAUDE.md` | 157 | `AUTH_BYPASS_SECRET=<value>` in prose |
| `scripts/fetch-blocked-batch2.ts` | 10 | `const` holding the literal |
| `scripts/fetch-blocked-kernel.ts` | 12 | `const` holding the literal |
| `scripts/find-dupes.ts` | 11 | `const` holding the literal |
| `scripts/ingest-esoteric-2.ts` | 9 | `const` holding the literal |
| `scripts/ingest-esoteric.ts` | 10 | `const` holding the literal |
| `scripts/smart-fetch.ts` | 17 | `const BYPASS = "<value>"` |
| `scripts/update-text-from-files.ts` | 10 | `const` holding the literal |
| `web/tests/e2e/cleanup.ts` | 9 | `process.env.AUTH_BYPASS_SECRET ?? "<value>"` (env read with literal fallback) |

The sanitized versions already exist in `AGENTS.md:154` and `AGENTS.md:157`:

```
bunx convex run extract:extractSource '{"sourceId": "...", "model": "anthropic/claude-sonnet-4.6", "devBypassSecret": "<AUTH_BYPASS_SECRET>"}'
...
Convex env vars: `AUTH_BYPASS_ENABLED=true`, `AUTH_BYPASS_SECRET=<set locally; do not commit the value>`
```

The repo's own correct pattern for secrets in scripts is `scripts/export-editorial.ts:22-31` — read env, fail loudly if missing:

```ts
const CONVEX_URL = process.env.CONVEX_URL || process.env.CONVEX_SELF_HOSTED_URL;
if (!CONVEX_URL) {
  console.error("CONVEX_URL or CONVEX_SELF_HOSTED_URL env var is required");
  process.exit(1);
}
const DEV_BYPASS_SECRET = process.env.DEV_BYPASS_SECRET;
if (!DEV_BYPASS_SECRET) {
  console.error("DEV_BYPASS_SECRET env var is required");
  process.exit(1);
}
```

Conventions: Bun runtime everywhere (`bun`, `bunx`, never `npm`/`node`); Bun auto-loads `.env.local`, so env reads need no dotenv import. `.env.local` is gitignored and already carries other keys.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Locate occurrences | `git grep -n "$SECRET_LITERAL"` (see Step 1) | the 10 locations above |
| Tests | `bun run test` | 39 pass, 0 fail |
| Final sweep | `git grep -c "$SECRET_LITERAL"` | exit 1, no matches |

## Scope

**In scope** (the only files you should modify):
- `CLAUDE.md` (lines 154, 157 only)
- `scripts/fetch-blocked-batch2.ts`
- `scripts/fetch-blocked-kernel.ts`
- `scripts/find-dupes.ts`
- `scripts/ingest-esoteric-2.ts`
- `scripts/ingest-esoteric.ts`
- `scripts/smart-fetch.ts`
- `scripts/update-text-from-files.ts`
- `web/tests/e2e/cleanup.ts`

**Out of scope** (do NOT touch, even though they look related):
- `convex/auth.ts` — the server-side check logic is fine; this plan is hygiene only.
- `scripts/export-editorial.ts` — already does it right; it is the exemplar, not a target.
- `.github/workflows/public-editorial-export.yml` — already reads `secrets.AUTH_BYPASS_SECRET`.
- Git history rewriting (filter-repo/BFG) — explicitly deferred; rotation makes history harmless.
- Actually rotating the deployment secret — operator action, see Step 5.

## Git workflow

- Branch: `advisor/001-rotate-auth-bypass-secret`
- Conventional-commit style matching the repo log (e.g. `fix: read bypass secret from env instead of committed literal`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Capture the literal for verification without retyping it

```bash
SECRET_LITERAL=$(sed -n '157p' CLAUDE.md | sed 's/.*AUTH_BYPASS_SECRET=//; s/`.*//')
git grep -n "$SECRET_LITERAL" | wc -l
```

**Verify**: the count is exactly **10**. If it is not 10, or the extracted string is empty/looks like a placeholder, STOP — the file drifted.

### Step 2: Replace the hardcoded constant in the 7 scripts

In each of `scripts/fetch-blocked-batch2.ts`, `fetch-blocked-kernel.ts`, `find-dupes.ts`, `ingest-esoteric-2.ts`, `ingest-esoteric.ts`, `smart-fetch.ts`, `update-text-from-files.ts`: replace the line holding the literal with the export-editorial pattern, preserving the existing variable name used in the rest of the file (e.g. `BYPASS`):

```ts
const BYPASS = process.env.AUTH_BYPASS_SECRET ?? process.env.DEV_BYPASS_SECRET;
if (!BYPASS) {
  console.error("AUTH_BYPASS_SECRET (or DEV_BYPASS_SECRET) env var is required");
  process.exit(1);
}
```

Accept both names because CI uses `DEV_BYPASS_SECRET` (see `scripts/export-editorial.ts:27`) while `.env.local` uses `AUTH_BYPASS_SECRET`. If the variable is used as a `string` (not `string | undefined`) downstream, the `process.exit(1)` guard makes a non-null assertion afterwards safe; prefer narrowing via the guard.

**Verify**: `git grep -n "$SECRET_LITERAL" -- scripts/` → no matches.

### Step 3: Remove the fallback in the e2e cleanup helper

`web/tests/e2e/cleanup.ts:9` currently reads:

```ts
const BYPASS = process.env.AUTH_BYPASS_SECRET ?? "<the literal>";
```

Change to fail loudly instead of falling back:

```ts
const BYPASS = process.env.AUTH_BYPASS_SECRET;
if (!BYPASS) {
  throw new Error("AUTH_BYPASS_SECRET env var is required for e2e cleanup");
}
```

**Verify**: `git grep -n "$SECRET_LITERAL" -- web/` → no matches.

### Step 4: Sanitize CLAUDE.md lines 154 and 157

Make them match `AGENTS.md:154` and `AGENTS.md:157` exactly (placeholders shown in "Current state"). Do not change anything else in CLAUDE.md.

**Verify**: `git grep -c "$SECRET_LITERAL"` → exits non-zero with no matches anywhere.

### Step 5: Write the operator rotation checklist

Append a short section to your final report (not to any committed file) telling the operator to:

1. Generate a high-entropy replacement (e.g. `openssl rand -hex 32`).
2. Set it as `AUTH_BYPASS_SECRET` on the self-hosted Convex deployment (deployment env, not repo).
3. Update `AUTH_BYPASS_SECRET` in local `.env.local` files and the GitHub Actions secret `AUTH_BYPASS_SECRET` (used by `.github/workflows/public-editorial-export.yml:28`).
4. Until rotation happens, treat the old value as burned (it remains in git history).

**Verify**: checklist present in your report.

## Test plan

No new tests — this is mechanical credential hygiene. Existing suite is the regression gate:

- `bun run test` → 39 pass, 0 fail (none of the touched scripts are imported by tests, so this guards against accidental collateral edits).
- Spot-run one script without env to confirm fail-loud behavior:
  `env -u AUTH_BYPASS_SECRET -u DEV_BYPASS_SECRET bun scripts/find-dupes.ts` → exits 1 with the "env var is required" message (it must NOT proceed to network calls).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `git grep -c "$SECRET_LITERAL"` (literal captured in Step 1) → no matches, non-zero exit
- [ ] `bun run test` exits 0 (39 pass)
- [ ] `env -u AUTH_BYPASS_SECRET -u DEV_BYPASS_SECRET bun scripts/find-dupes.ts` exits 1 with the required-env message
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] Operator rotation checklist included in the final report
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 finds a count other than 10, or extracts an empty/placeholder string.
- You find the literal in any file NOT listed in "Current state" (scope grew — report the new locations).
- Two *different* secret-looking literals show up (multiple credentials — report both locations, values omitted).
- Any in-scope file's content at the cited line doesn't match the shape described.

## Maintenance notes

- After the operator rotates, the e2e suite and ops scripts require `AUTH_BYPASS_SECRET` in `.env.local`; the README env section should eventually document this (see finding DX-02 in `plans/README.md` — deliberately out of scope here).
- Reviewer should scrutinize: that no replacement accidentally changed which Convex function a script calls, and that no diff hunk contains the old value.
- Deferred: history rewrite (not worth it post-rotation); fixing `scripts/generate-experiment.ts`'s missing secret entirely (separate finding CORRECTNESS-09).
