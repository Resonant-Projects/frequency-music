# Plan 001: Rotate the leaked auth-bypass secret, remove all committed copies, and move secret-bearing traffic to HTTPS

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a30f10c..HEAD -- CLAUDE.md scripts/ docs/plans/ .env.example`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Secret-handling rule for this plan**: the leaked value must NEVER be written
> into this plan, your commit messages, your report, or any new file. Refer to it
> only as "the old bypass secret". You will read it from the repo locally when you
> need to grep for it.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `a30f10c`, 2026-07-07

## Why this matters

The value of `AUTH_BYPASS_SECRET` — the credential that bypasses Clerk auth on
every state-changing Convex mutation (`requireAuth` in `convex/auth.ts` accepts
it as `devBypassSecret`) — is committed in plaintext in `CLAUDE.md`, in three
plan documents under `docs/plans/`, and hardcoded in seven `scripts/*.ts`
files. The repo lives on GitHub under the Resonant-Projects org. A committed
secret is burned even if removed from HEAD, because it remains in git history.
Separately, the documented Convex base URL is plain `http://`, so this secret
(and `AGENT_TOOL_SECRET`, which gates the agent-tool write surface) crosses the
wire in cleartext. This plan rotates the credential, removes every committed
copy, makes scripts read it from the environment, and switches the base URL to
HTTPS where possible.

## Current state

- `convex/auth.ts:23-24` — `getConfiguredBypassSecret()` reads
  `process.env.AUTH_BYPASS_SECRET`; `requireAuth` compares it (constant-time)
  against the `devBypassSecret` arg.
- **Committed copies of the secret value** (verified at `a30f10c`):
  - `CLAUDE.md:154` (inside an example command) and `CLAUDE.md:157` (an
    `AUTH_BYPASS_SECRET=` line).
  - `docs/plans/2026-07-03-01-arch-dedupe-contract.md` (4 occurrences),
    `docs/plans/2026-07-03-02-arch-single-source-shapes.md` (1),
    `docs/plans/2026-07-03-06-arch-ingest-script-lib.md` (3).
  - Hardcoded as `const BYPASS = "<value>"` in:
    `scripts/fetch-blocked-batch2.ts:10`, `scripts/fetch-blocked-kernel.ts:12`,
    `scripts/find-dupes.ts:11`, `scripts/ingest-esoteric-2.ts:9`,
    `scripts/ingest-esoteric.ts:10`, `scripts/smart-fetch.ts:17`,
    `scripts/update-text-from-files.ts:10`.
  - Note: `AGENTS.md:154` already uses a `<AUTH_BYPASS_SECRET>` placeholder —
    that is the pattern to copy.
- **Plaintext HTTP base URL** (verified):
  - `CLAUDE.md:162` — `CONVEX_SELF_HOSTED_URL='http://convex-backend.paas.rproj.art'`
  - `scripts/build-bibliography.ts:13` and `scripts/find-dupes.ts:10` —
    `const CONVEX_URL = process.env.CONVEX_URL || "http://convex-backend.paas.rproj.art";`
  - `scripts/smart-fetch.ts:21` — same literal as a fallback.
- `.env.example` already lists `AUTH_BYPASS_ENABLED=`, `AUTH_BYPASS_SECRET=`,
  `AGENT_TOOL_SECRET=`, `CONVEX_URL=` with empty values — the right shape.
- Bun auto-loads `.env.local` (untracked), so scripts can use
  `process.env.AUTH_BYPASS_SECRET` with no dotenv import.
- Repo convention: conventional commits (`fix(scope): ...` — see `git log --oneline -10`).
- **Standing constraint** (from `docs/plans/2026-07-03-00-arch-master-sequence.md`):
  `bunx convex codegen` / `bunx convex dev` / `bunx convex deploy` talk to the
  LIVE self-hosted backend. This plan does not require any of them; do not run them.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Find remaining copies of the old secret | `git grep -l "$OLD" -- .` (see Step 1 for `$OLD`) | no output after Step 3 |
| Tests | `bun test convex/*.test.ts` | 59+ pass, 0 fail |
| Lint (check-only) | `bunx oxlint . --tsconfig tsconfig.json` | exit 0 |
| Rotate env var on live deployment | `bunx convex env set AUTH_BYPASS_SECRET <new-value>` | confirmation line |
| Generate a new secret | `openssl rand -hex 24` | 48-char hex string |

## Scope

**In scope** (the only files you should modify):
- `CLAUDE.md` (lines 150–165 region only)
- `docs/plans/2026-07-03-01-arch-dedupe-contract.md`
- `docs/plans/2026-07-03-02-arch-single-source-shapes.md`
- `docs/plans/2026-07-03-06-arch-ingest-script-lib.md`
- `scripts/fetch-blocked-batch2.ts`, `scripts/fetch-blocked-kernel.ts`,
  `scripts/find-dupes.ts`, `scripts/ingest-esoteric-2.ts`,
  `scripts/ingest-esoteric.ts`, `scripts/smart-fetch.ts`,
  `scripts/update-text-from-files.ts`
- `scripts/build-bibliography.ts` (URL fallback only)

**Out of scope** (do NOT touch):
- `convex/auth.ts` and any `convex/` file — the check logic is correct; only the
  leaked value and its transport are the problem.
- `.env.local` — untracked operator file; report needed changes, don't assume
  you may edit it (see Step 5).
- Git history rewriting (filter-repo/BFG) — rotation makes history harmless;
  rewriting a shared repo is an operator decision. Do not attempt it.
- `AGENTS.md` — already uses a placeholder.

## Git workflow

- Branch: `advisor/001-rotate-and-decommit-secrets`
- Conventional commits, e.g. `fix(security): read bypass secret from env in scripts`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Capture the old value locally (never into a file)

In your shell only: `OLD=$(grep -o "AUTH_BYPASS_SECRET=.*" CLAUDE.md | head -1 | cut -d= -f2)`.
Sanity-check: `git grep -c "$OLD" -- CLAUDE.md` → `2` (approximately; ≥1).

**Verify**: `git grep -l "$OLD" -- .` → lists CLAUDE.md, 3 docs/plans files, 7 scripts.

### Step 2: Make the seven scripts read the secret from the environment

In each of the seven `scripts/*.ts` files listed in Current state, replace the
hardcoded assignment with:

```ts
const BYPASS = process.env.AUTH_BYPASS_SECRET;
if (!BYPASS) throw new Error("AUTH_BYPASS_SECRET not set (add it to .env.local)");
```

Keep the variable name `BYPASS` so downstream usage is untouched.

**Verify**: `git grep -l "$OLD" -- scripts/` → no output.
**Verify**: `bunx oxlint scripts/ --tsconfig tsconfig.json` → exit 0.

### Step 3: Replace the literal in docs with the placeholder convention

In `CLAUDE.md` and the three `docs/plans/2026-07-03-*.md` files, replace every
occurrence of the old value with `<AUTH_BYPASS_SECRET>` (the convention already
used at `AGENTS.md:154`).

**Verify**: `git grep -l "$OLD" -- .` → no output at all.

### Step 4: Switch the base URL to HTTPS

First check TLS is actually served:
`curl -sS -o /dev/null -w '%{http_code}' https://convex-backend.paas.rproj.art/` →
any HTTP status (e.g. `200`/`404`) means TLS works; a TLS/connect error means it
doesn't (→ STOP condition 3, do the rest of this step anyway EXCEPT the scheme
change, and report).

If TLS works: change `http://convex-backend.paas.rproj.art` to
`https://convex-backend.paas.rproj.art` in `CLAUDE.md:162`,
`scripts/build-bibliography.ts:13`, `scripts/find-dupes.ts:10`,
`scripts/smart-fetch.ts:21`.

**Verify**: `git grep -n "http://convex-backend" -- .` → no output (or unchanged if STOP-3 path).

### Step 5: Rotate the live credential (operator-gated)

Generate: `openssl rand -hex 24`. Then, if you have access to the deployment
(the `bunx convex env set` command works, i.e. `CONVEX_SELF_HOSTED_URL` +
admin key are configured in your environment):

1. `bunx convex env set AUTH_BYPASS_SECRET <new-value>`
2. Tell the operator (in your final report) the rotation happened and that
   `.env.local` must be updated with the new value, and that `AGENT_TOOL_SECRET`
   should also be rotated the same way (it crossed the same cleartext wire) —
   coordinating with the agent worker deployment which consumes it.

If the env-set command fails for lack of credentials, skip it and put the exact
commands in your report for the operator. This does NOT block the rest of the plan.

**Verify**: `bunx convex env get AUTH_BYPASS_SECRET` → prints the NEW value (or step skipped and reported).

### Step 6: Full check

**Verify**: `bun test convex/*.test.ts` → 59+ pass, 0 fail.
**Verify**: `git status --short` → only in-scope files modified.

## Test plan

No new tests — this plan changes literals and transport, not logic. The
regression gate is the existing suite (`bun test convex/*.test.ts`) plus the
greps in Steps 2–4.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `git grep -l "$OLD" -- .` → no output (with `$OLD` from Step 1)
- [ ] `git grep -n "http://convex-backend" -- .` → no output, OR STOP-3 reported
- [ ] All seven scripts contain `process.env.AUTH_BYPASS_SECRET`
- [ ] `bun test convex/*.test.ts` → 0 fail
- [ ] `git status` shows no files outside the in-scope list modified
- [ ] Rotation performed (Step 5) or the exact rotation commands are in the report
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

1. `CLAUDE.md` no longer contains an `AUTH_BYPASS_SECRET=` line at ~157 (drift —
   someone may have already cleaned it; re-scope before editing).
2. Any script's `BYPASS` constant is used in a way other than being passed as
   `devBypassSecret` (would change behavior beyond a literal swap).
3. `https://convex-backend.paas.rproj.art` does not serve TLS (infra change
   needed — that belongs to the operator/Cool Guy, not this plan).
4. You find the old secret value in files NOT listed in Current state — report
   the extra locations before touching them.

## Maintenance notes

- The dedupe/ingest plans (`docs/plans/2026-07-03-01`, `-06`) contain example
  commands that now read `<AUTH_BYPASS_SECRET>`; their executors must substitute
  the real value from `.env.local` at run time.
- Reviewer should scrutinize: that no NEW file introduces the old or new secret
  value, and that the seven scripts still run (`bun run scripts/find-dupes.ts`
  requires `.env.local` — operator smoke test).
- Deferred: rotating `AGENT_TOOL_SECRET` and the ingest-route secret is flagged
  for the operator in Step 5 rather than executed, because the agent worker
  deployment (Docker/Proxmox, see `docs/proxmox-agent-deployment.md`) consumes
  them and restarting it is outside this repo.
- Deferred: git-history rewrite — pointless while forks/clones may exist;
  rotation is the real fix.
