# Plan 020: Require login for reads, starting with Source text and listening sessions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report; do not
> improvise. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat cf4a8174..HEAD -- convex/sources.ts convex/listening.ts convex/inbox.ts convex/agentToolRegistry.ts convex/workflows.ts`
> Plans 018 and 019 are expected to have changed `convex/sources.ts`. For any
> other change, compare the excerpts below with the live code first.

## Status

- **Priority**: P1
- **Effort**: M (this plan's tier); the full migration is L and continues
  through the allowlist this plan creates
- **Risk**: MED — callers that have no identity must be found and updated
- **Depends on**: plans/017, plans/018 (`requireReader`), plans/019 (frees
  room in `convex/sources.ts`)
- **Category**: security
- **Planned at**: commit `cf4a8174`, 2026-11-09

## Why this matters

About 110 public Convex queries check no identity. Anyone who knows the
deployment URL, which ships in the web bundle of a public repository, can call
`sources:listRecent` and receive full captured article text and transcripts,
or `listening:listRecent` and receive private listening notes, with any
`limit` they choose. README says access is login-required. The maintainer
decided on 2026-11-09 that reads need a signed-in user or the service secret.

Gating all 110 at once is too large to do safely, because some are also called
from server code that has no identity. This plan does three things: adds a
test that freezes the set of ungated queries so it can only shrink, gates the
highest-risk tier (Sources, the inbox, listening sessions), and leaves a
checked-in list of what remains.

## Current state

`convex/sources.ts:228-239` and `:269-276`:

```ts
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(sourceReturnValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("sources")
      .order("desc")
      .take(args.limit ?? 50);
    return rows.map(publicSource);
  },
});
```

```ts
export const get = query({
  args: { id: v.id("sources") },
  returns: v.union(sourceReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const source = await ctx.db.get("sources", args.id);
    return source && publicSource(source);
  },
});
```

`publicSource` (`convex/validators.ts:65-70`) strips only `pdfStorageId`;
`rawText` and `transcript` are returned.

`convex/listening.ts:14-37` — `listByComposition` and `listRecent` have no auth
call and return whole `listeningSessions` rows, which are created with
`visibility: "private"`.

Callers that have no browser identity:

- Server code inside `convex/`. Example, `convex/workflows.ts:55`:
  `const source = await ctx.runQuery(api.sources.get, { id: args.sourceId });`
  A workflow step, cron or scheduled function has no user identity.
- The agent tool registry calls public queries by name, e.g.
  `convex/agentToolRegistry.ts:113-116`:

```ts
  listRecentExtractions: (ctx, args) =>
    ctx.runQuery(queryRef("extractions:listRecent"), {
      limit: (args.limit as number) ?? 20,
    }),
```

- Node scripts using a Convex HTTP client. Counts from
  `grep -rhoE '\.query\(api\.[a-zA-Z]+\.[a-zA-Z]+' scripts agent/src media/src`
  (excluding `scripts/archive/`): `sources.getByDedupeKey` 6, `sources.get` 6,
  `sources.listByStatus` 4, plus `sources.operatorExtractionSnapshots` and
  `sources.operatorExtractionPage`. These scripts already pass
  `devBypassSecret` to mutations.

The web app only renders routes for a signed-in user
(`web/src/components/auth-gate.tsx`), and queries that already require login
(`convex/audioArtifacts.ts:201`, `convex/podcast.ts:96`) work there, so
signed-in web callers need no change.

After plan 018, `convex/auth.ts` exports `requireReader(ctx, options)`: any
Clerk identity passes, or a valid `options.devBypassSecret`.

`convex-helpers` (already a root dependency) provides `customQuery` in
`convex-helpers/server/customFunctions`. It is not used in this repo yet.

**Size ratchet.** `convex/sources.ts` is listed in
`scripts/file-token-baseline.json` at 53,025 bytes and may not exceed that.
Plan 019 shrank it. Check with `git cat-file -s :convex/sources.ts` after
staging.

**New Convex modules are registered by hand**: add
`import type * as <name> from "../<name>.js";` and `<name>: typeof <name>;`
to `convex/_generated/api.d.ts` (copy how `settings` appears at lines 83 and
199), and one entry to `harness/modules.ts`. Codegen contacts production and
must not be run.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `vp install` (repo root) | exit 0 |
| One test file | `vp test convex/publicQueryAuth.test.ts` | all pass |
| Convex + scripts tests | `vp run test` | all pass |
| Harness tests | `vp run test:harness` | all pass |
| Typecheck (all packages) | `vp run typecheck` | exit 0 |
| Lint / format | `vp run lint:check` / `vp run format:check` | exit 0 |
| Size check | `git add -A && node scripts/check-file-tokens.mjs` | exit 0 |

Never run `vpx convex dev|codegen|deploy|run` or `bunx convex ...`.

## Suggested executor toolkit

- Before step 2, read
  `node_modules/convex-helpers/server/customFunctions.d.ts` to confirm the
  `customQuery(query, { args, input })` signature for the installed version.

## Scope

**In scope**:
- `convex/readerQuery.ts` (create — plain helper module, no registration)
- `convex/publicQueryAllowlist.ts` (create — plain data module)
- `convex/publicQueryAuth.test.ts`, `convex/readerQueryTier1.test.ts` (create)
- `convex/sourceReads.ts` (create — internal twins; register by hand)
- `convex/sources.ts`, `convex/inbox.ts`, `convex/listening.ts`: public
  `query(` declarations only
- Server callers of those queries in `convex/*.ts`, including
  `convex/agentToolRegistry.ts`
- Script callers under `scripts/` (not `scripts/archive/`), `agent/src`,
  `media/src`: add the secret argument only
- `convex/_generated/api.d.ts`, `harness/modules.ts` (registration)
- Existing tests, only to add an identity to a read that now needs one

**Out of scope**:
- Every other module's queries. They go on the allowlist and stay ungated.
- `convex/validators.ts` and the shape of any return value.
- `web/` — no client change. If one seems necessary, that is a STOP.
- `scripts/archive/` — frozen.

## Git workflow

- Branch: `fix/login-required-reads`
- Conventional commits, e.g. `feat(auth): freeze the ungated query surface`,
  `fix(sources): require a reader for Source and listening queries`.
- Never `git commit --no-verify`. Do not push or open a PR unless asked.

## Steps

### Step 1: Freeze the ungated surface with a test

Create `convex/publicQueryAllowlist.ts` exporting
`UNGATED_PUBLIC_QUERIES: Record<string, string>`, keyed `"<module>:<name>"`,
value a short reason (use `"legacy: not yet gated"`).

Create `convex/publicQueryAuth.test.ts`. It reads every `convex/*.ts` file
that is not a test, not `testHelpers.ts`, and not under `_generated/` (use
`readdirSync` and `readFileSync`). For each file:

- Find public query declarations with
  `/^export const (\w+) = (query|readerQuery)\(/gm`.
- A declaration using `readerQuery(` is gated.
- For a `query(` declaration, take the text from the match to the next
  `\nexport const ` (or end of file). It is gated if that text contains
  `requireReader(`, `requireAuth(`, `requireHumanIdentity(` or
  `requireDecisionUser(`.
- Otherwise its key `"<file without .ts>:<name>"` must be in
  `UNGATED_PUBLIC_QUERIES`.

Three tests: every ungated query is on the allowlist; every allowlist key
still names an existing ungated query (no stale entries); the allowlist does
not contain any `sources:`, `inbox:` or `listening:` key (this one fails
until step 3 and is the tier's acceptance check — mark it `test.fails` now and
change it to `test` in step 3).

Fill the allowlist by running the test and adding the keys it reports.

**Verify**: `vp test convex/publicQueryAuth.test.ts` → pass.

### Step 2: Add `readerQuery`

Create `convex/readerQuery.ts`:

```ts
import { customQuery } from "convex-helpers/server/customFunctions";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireReader } from "./auth";

/** A public query that needs a signed-in user or the service secret. */
export const readerQuery = customQuery(query, {
  args: { devBypassSecret: v.optional(v.string()) },
  input: async (ctx, args) => {
    await requireReader(ctx, args);
    return { ctx: {}, args: {} };
  },
});
```

`readerQuery` adds the optional `devBypassSecret` argument to the query and
removes it before the handler runs, so handler bodies do not change.

**Verify**: `vp run typecheck:scripts` → exit 0.

### Step 3: Gate the tier

In `convex/sources.ts`, `convex/inbox.ts` and `convex/listening.ts`, change
every `export const X = query({` to `export const X = readerQuery({` and
import `readerQuery` from `./readerQuery`. Remove `query` from the
`./_generated/server` import if it becomes unused. If a query already
declares its own `devBypassSecret` argument and calls an auth helper, leave
it as it is.

In each of those queries that takes a `limit`, clamp it: replace
`args.limit ?? N` with `Math.min(args.limit ?? N, 200)`.

Remove the tier's keys from `UNGATED_PUBLIC_QUERIES` and change the third test
from `test.fails` to `test`.

**Verify**: `vp test convex/publicQueryAuth.test.ts` → pass.
`git add -A && git cat-file -s :convex/sources.ts` → at most 53025.

### Step 4: Give server callers internal twins

Find server callers with no identity:

`grep -rnE 'api\.(sources|inbox|listening)\.' convex --include='*.ts' | grep -v '\.test\.\|_generated'`
and
`grep -rnE '"(sources|inbox|listening):' convex | grep -v '\.test\.'`.

For each query name that appears, add an `internalQuery` twin in the new
module `convex/sourceReads.ts` (name it after the original, e.g. `get`,
`getByDedupeKey`, `listByStatus`). A twin takes the same arguments and
performs the same read. Twins may return the full document; they are not
reachable from clients. Register `sourceReads` by hand (see Current state).

Switch each server caller to the twin: `api.sources.get` becomes
`internal.sourceReads.get`; in the registry, `queryRef("sources:get")` becomes
`internal.sourceReads.get`. A caller inside a public `action` that is itself
invoked by a signed-in user (for example `createFromUrlAndQueue`) keeps the
identity and may stay on the public query; switch it only if a test fails.

**Verify**: `vp run typecheck:scripts` → exit 0; `vp run test` and
`vp run test:harness` → failures, if any, are only "Authentication required"
on reads made with no identity (fixed in step 6).

### Step 5: Pass the secret from scripts and workers

`grep -rnE '\.query\(api\.(sources|inbox|listening)\.' scripts agent/src media/src | grep -v archive`.
For each call, add `devBypassSecret` to the argument object, using the same
variable that file already passes to its mutations. If a file has no such
variable, find how a neighbouring script obtains it
(`grep -rn devBypassSecret scripts/lib | head`) and reuse that helper.

**Verify**: `vp run typecheck` → exit 0 (covers scripts, web, agent, media).

### Step 6: Repair tests that read anonymously

For each remaining failure, wrap the read in an identity:
`t.withIdentity({ subject: "reader" }).query(...)`. Reads need no `users` row.
Do not change assertions.

**Verify**: `vp run test` and `vp run test:harness` → all pass.

## Test plan

`convex/readerQueryTier1.test.ts`, modelled on `convex/settings.test.ts`; for
the secret case copy the `vi.stubEnv` lines from
`convex/decisionIntents.test.ts:233-234`:

1. Anonymous `api.sources.get` → rejects with "Authentication required".
2. Anonymous `api.sources.listRecent` and `api.listening.listRecent` → reject.
3. A signed-in identity with no `users` row → all three resolve.
4. A valid `devBypassSecret` and no identity → `api.sources.get` resolves.
5. `api.sources.listRecent({ limit: 100000 })` returns at most 200 rows (seed
   201 small Sources with `t.run`).
6. `internal.sourceReads.get` resolves with no identity.

**Verify**: `vp test convex/readerQueryTier1.test.ts` → 6 pass.

## Done criteria

- [ ] `vp test convex/publicQueryAuth.test.ts` passes with all three tests
      active (no `test.fails`).
- [ ] `grep -cE '^export const \w+ = query\(' convex/sources.ts convex/inbox.ts convex/listening.ts`
      prints 0 for each file, except queries that already called an auth
      helper.
- [ ] `vp run test`, `vp run test:harness`, `vp run typecheck`,
      `vp run lint:check`, `vp run format:check` exit 0.
- [ ] `node scripts/check-file-tokens.mjs --all` exits 0.
- [ ] No file under `web/` changed.
- [ ] `plans/README.md` row for 020 updated, with the count of keys left in
      `UNGATED_PUBLIC_QUERIES`.

## STOP conditions

- `customQuery`'s signature in the installed `convex-helpers` differs from
  step 2. Report it; the fallback is an explicit
  `devBypassSecret` argument plus `await requireReader(ctx, args)` per query,
  which needs a size plan for `convex/sources.ts`.
- `web/tests/local` or another web suite reads these queries with no identity
  and no secret (it runs the app with `VITE_AUTH_BYPASS=1`). Report how that
  suite authenticates; do not weaken the gate or edit `web/`.
- More than 60 call sites need changes across steps 4–6. Report the count.
- `convex/sources.ts` would exceed 53,025 bytes. Do not bypass.
- A script caller has no access to the bypass secret.

## Maintenance notes

- Deployment is operator-gated and must ship together with plan 018.
- `convex/publicQueryAllowlist.ts` is now the ledger of ungated reads. The
  next tiers, in order of sensitivity: `extractions`, `hypotheses`, `recipes`,
  `weeklyBriefs`, `agentDrafts`, `compositions`, then the rest. Each tier
  repeats steps 3–6.
- New public queries must use `readerQuery` or be added to the allowlist with
  a real reason; the test fails otherwise.
- A reviewer should check that no twin in `convex/sourceReads.ts` is exported
  as a public `query`.
