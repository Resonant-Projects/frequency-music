# Plan 018: Require an admin or collaborator role for every write

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report; do not
> improvise. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat cf4a8174..HEAD -- convex/auth.ts convex/decisionIdentity.ts convex/testHelpers.ts convex/_generated/api.d.ts harness/modules.ts`
> If any of these changed, compare the "Current state" excerpts with the live
> code before proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — a wrong gate locks the operator out of the web app
- **Depends on**: none (plans 019, 020 and 023 depend on this one)
- **Category**: security
- **Planned at**: commit `cf4a8174`, 2026-11-09

## Why this matters

`requireAuth` accepts any Clerk identity. The web app links a sign-up page, and
the `users.role` column is written but never read, so any account that signs up
can call about 100 public mutations and actions: delete hypotheses, start paid
model calls, and sign the "human-approved" publication decisions. The
maintainer decided on 2026-11-09: reads need a signed-in user or a service
secret; writes, deletes and paid inference need the `admin` or `collaborator`
role; followers read only. This plan implements the write half. Plan 020
implements the read half.

## Current state

- `convex/auth.ts` (5,845 bytes) — all auth helpers.
- `convex/decisionIdentity.ts` (1,256 bytes) — `requireHumanIdentity`,
  `requireDecisionUser`.
- `convex/schema.ts:313-324` — the `users` table. Do not edit `schema.ts`.
- There is no `convex/users.ts` module yet.

`convex/auth.ts:120-176`, abridged:

```ts
export async function requireAuth(
  ctx: AuthCtx,
  options?: RequireAuthOptions,
): Promise<AppIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    return {
      subject: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email ?? undefined,
      name: identity.name ?? undefined,
      isBypass: false,
    };
  }

  if (isBypassEnabled()) {
    // ... constant-time check of options.devBypassSecret ...
      return {
        subject: "system",
        tokenIdentifier: "dev-bypass-token",
        // ...
        isBypass: true,
      };
  }
  // ... reportBypassRejection ...
  throw new ConvexError({
    code: "UNAUTHORIZED",
    message: "Authentication required",
  });
}

function isActionCtx(ctx: AuthCtx): ctx is ActionCtx {
  return !("db" in ctx) && "runMutation" in ctx;
}
```

`AuthCtx` is `QueryCtx | MutationCtx | ActionCtx`. Queries and mutations have
`ctx.db`; actions do not and must use `ctx.runQuery`.

The users table (`convex/schema.ts:313-324`):

```ts
  users: defineTable({
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    role: v.union(
      v.literal("admin"),
      v.literal("collaborator"),
      v.literal("follower"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerkUserId", ["clerkUserId"]),
```

`convex/decisionIdentity.ts:6-13`:

```ts
export async function requireHumanIdentity(
  ctx: QueryCtx | MutationCtx | ActionCtx,
) {
  const identity = await requireAuth(ctx);
  if (identity.isBypass || identity.subject === "system")
    throw new ConvexError("Human authentication required");
  return identity;
}
```

Facts the design depends on:

- The standing service identity is the bypass secret (`isBypass: true`). It is
  intentional (decision log 2026-07-16) and must keep full write access.
- Tests simulate the service identity with
  `t.withIdentity({ subject: "system" })` (about 35 uses). A real Clerk subject
  always starts with `user_`, and existing code already treats the subject
  `"system"` as non-human, so this plan treats it as a writer too.
- Tests also use subjects such as `"reader"`, `"operator"`, `"human"` and
  `"user_1"`. Any of those that perform writes will need a `users` row.
- **New Convex modules are registered by hand.** Codegen contacts production,
  so when you add `convex/users.ts` you must also add two lines to
  `convex/_generated/api.d.ts` and one to `harness/modules.ts` (step 2).

Vocabulary: use "role", "writer" (admin or collaborator), "reader" (any
signed-in user or the service identity), "follower". Do not introduce other
terms.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `vp install` (repo root) | exit 0 |
| One test file | `vp test convex/authRoles.test.ts` | all pass |
| Convex + scripts tests | `vp run test` | all pass |
| Harness tests | `vp run test:harness` | all pass |
| Typecheck | `vp run typecheck` | exit 0 |
| Lint / format | `vp run lint:check` / `vp run format:check` | exit 0 |

Never run `vpx convex dev|codegen|deploy|run` or `bunx convex ...`. They
contact the live production backend.

## Scope

**In scope**:
- `convex/auth.ts`
- `convex/users.ts` (create)
- `convex/authRoles.test.ts` (create)
- `convex/testHelpers.ts` (add one helper)
- `convex/_generated/api.d.ts` and `harness/modules.ts` (register the module)
- Read-only handlers that call `requireAuth` today: switch the call to
  `requireReader` (step 4). Only that one identifier and its import change.
- Existing `convex/*.test.ts` and `harness/*.harness.test.ts` files, only to
  seed a `users` row for a non-system identity that performs writes.
- `docs/service-identity-inventory.md` — add one short paragraph (step 6).

**Out of scope**:
- `convex/schema.ts` — no schema change is needed.
- `convex/decisionIdentity.ts` — it inherits the gate through `requireAuth`.
  Its auto-provisioning branch becomes unreachable for new subjects; leave it.
- Adding auth to queries that have none today — that is plan 020.
- `web/` — no client change in this plan.
- `requireAgentToolSecret*` and `/agent-tools/*` — a separate identity.

## Git workflow

- Branch: `fix/role-gated-writes`
- Conventional commits, e.g. `feat(auth): require a writer role for mutations
  and actions`.
- If the pre-commit hook rejects a file for size, do not use `--no-verify`;
  see STOP conditions.
- Do not push or open a PR unless the operator asked for it.

## Steps

### Step 1: Split `requireAuth` into reader and writer gates

In `convex/auth.ts`:

1. Rename the existing `requireAuth` body to a new exported function
   `requireReader(ctx, options)`. Its behaviour does not change: any Clerk
   identity or a valid bypass secret passes.
2. Add an exported type `type UserRole = "admin" | "collaborator" | "follower"`.
3. Write a new exported `requireAuth(ctx, options)`:

```ts
/** Writer gate: the service identity, or a user whose role may write. */
export async function requireAuth(
  ctx: AuthCtx,
  options?: RequireAuthOptions,
): Promise<AppIdentity> {
  const identity = await requireReader(ctx, options);
  if (identity.isBypass || identity.subject === "system") return identity;
  const role = await roleOf(ctx, identity.subject);
  if (role === "admin" || role === "collaborator") return identity;
  throw new ConvexError({
    code: "FORBIDDEN",
    message: "This action needs a collaborator or admin role",
  });
}
```

4. Add `roleOf(ctx, subject): Promise<UserRole | null>`. When
   `isActionCtx(ctx)` is true, return
   `await ctx.runQuery(internal.users.roleBySubject, { clerkUserId: subject })`.
   Otherwise read `ctx.db.query("users").withIndex("by_clerkUserId", (q) =>
   q.eq("clerkUserId", subject)).unique()` and return `user?.role ?? null`.
   A subject with no row has no role and cannot write.

Every existing caller of `requireAuth` keeps compiling and now gets the
writer gate.

**Verify**: `vp run typecheck:scripts` fails only on the missing
`internal.users` (fixed in step 2). Any other error is a mistake in this step.

### Step 2: Add `convex/users.ts` and register it

Create `convex/users.ts` with three functions:

- `roleBySubject` — `internalQuery`, args `{ clerkUserId: v.string() }`,
  returns the role or `null` (same index read as above).
- `viewer` — public `query`, args `{ devBypassSecret: v.optional(v.string()) }`.
  It never throws. Read `ctx.auth.getUserIdentity()`; return `null` when there
  is none. Otherwise return `{ userId, role }` where `userId` is the `users`
  row id or `null`, and `role` is the row's role or `"follower"`. Give it an
  explicit `returns` validator. The web uses this to show or hide controls
  (plan 023).
- `setRole` — `internalMutation`, args `{ clerkUserId: v.string(), role }`.
  Patch the row's `role` and `updatedAt` if the row exists; otherwise insert
  `{ clerkUserId, role, createdAt, updatedAt }`. This is the operator's way to
  grant a role. It is internal on purpose: nobody can grant themselves a role
  from a client.

Register the module:

- `convex/_generated/api.d.ts`: add
  `import type * as users from "../users.js";` beside the other imports, and
  add `users: typeof users;` inside the `fullApi` `ApiFromModules<{ ... }>`
  object. Look at how `settings` appears in both places and copy it.
- `harness/modules.ts`: add
  `"./users.ts": () => import("../convex/users"),`.

**Verify**: `vp run typecheck:scripts` → exit 0.

### Step 3: Add the test helper

In `convex/testHelpers.ts`, export:

```ts
/** A users row for a test identity; returns its id. */
export async function seedUser(
  t: { run: <T>(fn: (ctx: any) => Promise<T>) => Promise<T> },
  clerkUserId: string,
  role: "admin" | "collaborator" | "follower" = "collaborator",
) {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("users", { clerkUserId, role, createdAt: now, updatedAt: now }),
  );
}
```

Tighten the `t` type to match how other helpers in that file type the
convex-test instance, if they do.

**Verify**: `vp run typecheck:scripts` → exit 0.

### Step 4: Keep login-only reads on the reader gate

List every call: `grep -n "requireAuth(" convex/*.ts | grep -v "\.test\."`.
For each one, open the file and find the enclosing function. If it is declared
with `query(` or `internalQuery(` — a read — change the call to
`requireReader(` and fix the import. If it is a `mutation(` or `action(`,
leave it. Known read sites to check first: `convex/audioArtifacts.ts:201` and
`:243`, `convex/podcast.ts:96`, `convex/settings.ts:64` and `:90`.

Do not touch calls to `requireHumanIdentity` or `requireDecisionUser`.

**Verify**: `vp run typecheck:scripts` → exit 0. Record in your report the
list of sites you switched.

### Step 5: Repair the tests the gate breaks

Run `vp run test` and `vp run test:harness`. Tests that write as a
non-`"system"` identity now fail with `FORBIDDEN`. For each failure, call
`await seedUser(t, "<that subject>")` before the first write. Do not change
the assertion, the identity, or the production code to make a test pass.

**Verify**: `vp run test` and `vp run test:harness` → all pass.

### Step 6: Document the operator step

Append to `docs/service-identity-inventory.md`:

> **User roles.** A signed-in user may read. Writing needs the `admin` or
> `collaborator` role on that user's `users` row; an account with no row is a
> follower. Grant a role with the internal mutation `users:setRole`
> (`clerkUserId`, `role`). Before deploying the release that contains this
> gate, confirm the operator's own `users` row exists with a writer role, or
> the web app becomes read-only for them.

**Verify**: `vp run format:check` → exit 0.

## Test plan

Create `convex/authRoles.test.ts`, modelled on `convex/settings.test.ts`
(imports: `convexTest`, `modules` from `../harness/modules`, `schema`, `api`,
`internal`). For the bypass case copy the environment stubbing in
`convex/decisionIntents.test.ts:233-234` (`vi.stubEnv("AUTH_BYPASS_ENABLED",
"true")`, `vi.stubEnv("AUTH_BYPASS_SECRET", ...)`) and unstub in `afterEach`.

Use `api.hypotheses.deleteById` as the representative mutation; seed a
hypothesis row with `t.run`. Cases:

1. No identity, no secret → rejects with `UNAUTHORIZED`.
2. Identity `user_stranger` with no `users` row → rejects with `FORBIDDEN`.
3. Identity with a `follower` row → rejects with `FORBIDDEN`.
4. Identity with a `collaborator` row → succeeds.
5. Identity with an `admin` row → succeeds.
6. Valid bypass secret, no identity → succeeds.
7. An action: `api.sources.createFromUrlAndQueue` as a follower → rejects with
   `FORBIDDEN` (this exercises the `ctx.runQuery` branch of `roleOf`).
8. `api.users.viewer`: returns `null` anonymously; `{ userId: null, role:
   "follower" }` for an unmapped identity; the row's id and role when mapped.
9. `internal.users.setRole` inserts a row, then updates the role on a second
   call, leaving one row.
10. A read that uses `requireReader` (pick one you switched in step 4)
    succeeds for an identity with no `users` row.

**Verify**: `vp test convex/authRoles.test.ts` → 10 pass.

## Done criteria

- [ ] `vp test convex/authRoles.test.ts` passes with 10 tests.
- [ ] `vp run test`, `vp run test:harness`, `vp run typecheck`,
      `vp run lint:check`, `vp run format:check` all exit 0.
- [ ] `grep -n "export async function requireReader" convex/auth.ts` matches.
- [ ] `grep -rn "role" convex/auth.ts` shows the role check.
- [ ] No change under `web/`, to `convex/schema.ts`, or to
      `convex/decisionIdentity.ts` (`git status --short`).
- [ ] `plans/README.md` row for 018 updated, with the note "deploy needs the
      operator's users row confirmed first".

## STOP conditions

- The excerpts above do not match the live code.
- More than 25 test files need a `seedUser` call, or a failing test cannot be
  fixed by seeding a row. Report the list; the gate's design may need review.
- A caller of `requireAuth` runs with neither an identity nor a bypass secret
  and is not a test (for example a scheduled function calling a public
  mutation). Report it; do not weaken the gate for it.
- The pre-commit hook rejects a file you edited because it is over 20,000
  bytes. Report which file; do not bypass.
- You are asked, or tempted, to run any `convex` CLI command.

## Maintenance notes

- Deployment is operator-gated. After deploy, any signed-in account without a
  `users` row is read-only. Existing rows were auto-provisioned as
  `collaborator` by decision writes; the operator should review the `users`
  table and demote any account that should not write.
- `requireDecisionUser` still contains an insert with role `collaborator`.
  New subjects can no longer reach it, because `requireAuth` rejects them
  first. A later cleanup can replace it with a plain lookup.
- New read handlers use `requireReader`; new write handlers use `requireAuth`.
  Plan 020 adds a test that enforces the read side.
- A reviewer should check that no handler was moved from the writer gate to
  the reader gate unless it is a `query`.
