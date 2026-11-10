# Plan 019: Record the real creator on writes and stop URL resubmits erasing text

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report; do not
> improvise. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat cf4a8174..HEAD -- convex/sources.ts convex/pdfCapture.ts convex/hypotheses.ts convex/recipes.ts convex/campaigns.ts convex/compositions.ts convex/correspondences.ts convex/editorialArtifacts.ts convex/theses.ts`
> Plan 018 is expected to have changed `convex/auth.ts` only. If any file in
> the list above changed, compare the excerpts below with the live code first;
> a mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: plans/017-size-hook-ratchet.md (four files here are over the
  size limit), plans/018-role-gated-writes.md (touches the same handlers)
- **Category**: bug
- **Planned at**: commit `cf4a8174`, 2026-11-09

## Why this matters

Two defects sit in the manual intake and create paths.

1. Ten create mutations store `identity.subject as Id<"users">` in `createdBy`.
   For a signed-in person the subject is a Clerk id such as `user_2ab...`, not
   a Convex `users` document id, and the schema validator
   `v.union(v.id("users"), v.literal("system"))` rejects it. A signed-in user
   therefore cannot create a hypothesis, recipe, composition, campaign, thesis,
   correspondence, editorial draft or URL source from the web. Only the service
   identity (subject `"system"`) works. Every test uses that identity, so no
   test catches it.
2. `upsertExternalSource` patches an existing Source with `...args`. The two
   web intake mutations pass `title`, `rawText`, `transcript` and `tags` as
   explicit keys, so an omitted value arrives as `undefined`, and Convex
   `patch` removes a field set to `undefined`. Submitting a URL that is already
   in the library, without pasting text, deletes its stored text and title.

## Current state

The correct identity mapping already exists, private to one module
(`convex/pdfCapture.ts:115-126`):

```ts
/** The submitter's users row, or "system" for the bypass identity or an unmapped subject. */
async function creatorOf(
  ctx: MutationCtx,
  identity: AppIdentity,
): Promise<Id<"users"> | "system"> {
  if (identity.isBypass || identity.subject === "system") return "system";
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
  return user?._id ?? "system";
}
```

The ten cast sites (all inside mutation handlers or helpers that receive a
`MutationCtx`):

| File | Line | Shape |
|---|---|---|
| `convex/sources.ts` | 365, 1256, 1295 | `createdBy: identity.subject as Id<"users">,` |
| `convex/recipes.ts` | 301 | same single-line shape |
| `convex/hypotheses.ts` | 260-263 | four-line ternary (below) |
| `convex/compositions.ts` | 254-257 | four-line ternary |
| `convex/campaigns.ts` | 559-562 | four-line ternary |
| `convex/correspondences.ts` | 408-411 | four-line ternary |
| `convex/editorialArtifacts.ts` | 896-899 | four-line ternary |
| `convex/theses.ts` | ~156-159 | four-line ternary |

The ternary shape (`convex/hypotheses.ts:260-263`):

```ts
      createdBy:
        identity.subject === "system"
          ? "system"
          : (identity.subject as Id<"users">),
```

The destructive patch (`convex/sources.ts:839-850`), inside
`async function upsertExternalSource(ctx: MutationCtx, args: ExternalUpsertArgs)`:

```ts
  await ctx.db.patch("sources", existing._id, {
    ...args,
    rawTextSha256: rawTextSha256 ?? existing.rawTextSha256,
    status: contentChanged
      ? "text_ready"
      : existing.status === "archived"
        ? "archived"
        : existing.status,
    blockedReason: contentChanged ? undefined : existing.blockedReason,
    updatedAt: advanceSourceVersion(existing.updatedAt, now),
  });
```

One caller that passes explicit keys (`convex/sources.ts:1249-1257`):

```ts
    return await upsertExternalSource(ctx, {
      dedupeKey: generateDedupeKey("url", { canonicalUrl: args.url }),
      type: "url",
      title: args.title,
      canonicalUrl: args.url,
      rawText: args.rawText,
      tags: args.tags,
      createdBy: identity.subject as Id<"users">,
    });
```

`convex/sources.ts` already has a hashing helper at lines 785-794:

```ts
async function sha256Hex(text: string): Promise<string> {
```

and an inline copy of the same logic in `create` (`convex/sources.ts:345-357`):

```ts
    // Compute hash if we have text
    let rawTextSha256: string | undefined;
    if (createArgs.rawText || createArgs.transcript) {
      const text = createArgs.rawText || createArgs.transcript || "";
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      rawTextSha256 = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
```

**Size ratchet (after plan 017).** `convex/sources.ts`, `convex/campaigns.ts`,
`convex/correspondences.ts` and `convex/editorialArtifacts.ts` are listed in
`scripts/file-token-baseline.json`. The pre-commit hook rejects a commit in
which any of them is larger than its recorded size. Every edit below is
designed to shrink or hold these files. Check with
`node scripts/check-file-tokens.mjs` after staging.

**New modules are registered by hand** (codegen contacts production). A module
that only exports plain helper functions, like the one this plan creates,
needs no registration.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `vp install` (repo root) | exit 0 |
| One test file | `vp test convex/creatorIdentity.test.ts` | all pass |
| Convex + scripts tests | `vp run test` | all pass |
| Harness tests | `vp run test:harness` | all pass |
| Typecheck | `vp run typecheck` | exit 0 |
| Lint / format | `vp run lint:check` / `vp run format:check` | exit 0 |
| Size check | `git add -A && node scripts/check-file-tokens.mjs` | exit 0 |

Never run `vpx convex dev|codegen|deploy|run` or `bunx convex ...`.

## Scope

**In scope**:
- `convex/creatorIdentity.ts` (create — plain helper, no Convex functions)
- `convex/creatorIdentity.test.ts` (create)
- `convex/pdfCapture.ts` (import the helper instead of defining it)
- The eight files in the table above, at the listed lines only
- `convex/sources.ts` additionally: the patch in `upsertExternalSource` and
  the inline hash in `create`

**Out of scope**:
- `convex/schema.ts`, `convex/validators.ts` — the `createdBy` contract stays.
- `convex/decisionIdentity.ts` — a different helper with different semantics
  (it throws for the service identity).
- Backfilling `createdBy` on existing rows.
- `web/` — no client change.
- Any other refactor of `convex/sources.ts`.

## Git workflow

- Branch: `fix/creator-identity-and-resubmit`
- Conventional commits, e.g. `fix(sources): keep stored text when a known URL
  is resubmitted`, `fix(convex): map the Clerk subject to a users id on create`.
- Never `git commit --no-verify`. Do not push or open a PR unless asked.

## Steps

### Step 1: Share the creator helper

Create `convex/creatorIdentity.ts`. Move `creatorOf` there verbatim from
`convex/pdfCapture.ts:115-126`, add `export`, and add the imports it needs
(`Id` from `./_generated/dataModel`, `MutationCtx` from `./_generated/server`,
`AppIdentity` from `./auth`). In `convex/pdfCapture.ts`, delete the local
function and import it from `./creatorIdentity`. Remove any import in
`pdfCapture.ts` that the move leaves unused.

**Verify**: `vp run typecheck:scripts` → exit 0;
`vp test convex/pdfCapture` → all pass.

### Step 2: Use the helper at all ten sites

At each site in the table, replace the cast (one line or the four-line
ternary) with:

```ts
      createdBy: await creatorOf(ctx, identity),
```

Match the surrounding indentation. Add
`import { creatorOf } from "./creatorIdentity";` to each file. If the edit
leaves `Id` unused in a file's imports, remove `Id` from that import.

Before editing each site, confirm that a `MutationCtx` named `ctx` and the
`identity` returned by `requireAuth` are both in scope there. In
`convex/correspondences.ts` and `convex/editorialArtifacts.ts` the site is
inside a helper function; use whatever name that helper gives its context
parameter.

**Verify**:
- `grep -rn 'identity.subject as Id' convex | grep -v '\.test\.'` → no output.
- `vp run typecheck:scripts` → exit 0.

### Step 3: Reuse `sha256Hex` in `create`

In `convex/sources.ts`, replace the twelve-line block at 345-357 (shown
above) with:

```ts
    const createText = createArgs.rawText || createArgs.transcript;
    const rawTextSha256 = createText ? await sha256Hex(createText) : undefined;
```

`sha256Hex` is a function declaration later in the same file, so it is in
scope. This removes a duplicate and gives `sources.ts` room under its size
ceiling for step 4.

**Verify**: `vp run typecheck:scripts` → exit 0.

### Step 4: Patch only the fields the caller supplied

In `upsertExternalSource`, replace `...args,` in the `ctx.db.patch` call
with a spread of the defined fields, and never let a resubmit change who
created the Source or what type it is:

```ts
  const { createdBy: _createdBy, type: _type, ...supplied } = args;
  const defined = Object.fromEntries(
    Object.entries(supplied).filter(([, value]) => value !== undefined),
  ) as Partial<typeof supplied>;
```

Put those two statements just above the `ctx.db.patch` call and use
`...defined,` in place of `...args,`. Leave the `ctx.db.insert` branch for a
new Source exactly as it is; it must still receive `type` and `createdBy`.

**Verify**:
- `vp run typecheck:scripts` → exit 0.
- `git add -A && node scripts/check-file-tokens.mjs` → exit 0.
- `git cat-file -s :convex/sources.ts` → at most 53025.

## Test plan

Create `convex/creatorIdentity.test.ts`, modelled on `convex/settings.test.ts`
(imports `convexTest`, `modules` from `../harness/modules`, `schema`, `api`).
Plan 018 adds `seedUser(t, clerkUserId, role)` to `convex/testHelpers.ts`;
use it. Cases:

1. A signed-in collaborator (`t.withIdentity({ subject: "user_writer" })`
   with a seeded `users` row) calls `api.hypotheses.create` with minimal valid
   args → resolves, and the stored row's `createdBy` equals the seeded
   `users` id. Before this plan this case throws a schema validation error;
   confirm that by running the test once against the unfixed code if
   practical.
2. The same for `api.recipes.create` and `api.sources.createFromUrlInput`.
3. The service identity (`t.withIdentity({ subject: "system" })`) creating a
   hypothesis stores `createdBy: "system"`.
4. Resubmit keeps text: create a Source with
   `api.sources.createFromUrlInput({ url, title: "T", rawText: <120 chars> })`,
   then call it again with only `{ url }`. Assert the row still has the same
   `rawText`, `title` and `rawTextSha256`, and the second call returns
   `{ created: false, contentChanged: false }`.
5. Resubmit with new text still updates: a third call with different
   `rawText` returns `contentChanged: true` and stores the new text.
6. Resubmit by a different writer does not change `createdBy` or `type`.

For required args of each mutation, read its `args` validator; use the
smallest valid payload.

**Verify**: `vp test convex/creatorIdentity.test.ts` → all pass.

## Done criteria

- [ ] `grep -rn 'identity.subject as Id' convex | grep -v '\.test\.'` returns
      nothing.
- [ ] `grep -n '\.\.\.args,' convex/sources.ts` shows no match inside the
      `ctx.db.patch` call of `upsertExternalSource`.
- [ ] `vp test convex/creatorIdentity.test.ts` passes.
- [ ] `vp run test`, `vp run test:harness`, `vp run typecheck`,
      `vp run lint:check`, `vp run format:check` exit 0.
- [ ] `node scripts/check-file-tokens.mjs --all` exits 0.
- [ ] `git status --short` lists only in-scope files.
- [ ] `plans/README.md` row for 019 updated.

## STOP conditions

- An excerpt above does not match the live code.
- A cast site is inside an `action` (no `ctx.db`). Report it; do not invent a
  lookup.
- The size check fails for a baselined file after step 4. Do not bypass and
  do not edit the baseline. Report the byte counts.
- A harness test that resubmits a Source starts failing in a way that seeding
  a user does not explain. `harness/extractionCompletion.harness.test.ts` and
  `harness/recoveryAdmission.harness.test.ts` exercise this function.
- Plan 018 has not landed (`grep -n "requireReader" convex/auth.ts` is empty).
  The fix still works without it, but the tests need `seedUser`; report and
  ask whether to proceed with a local copy of that helper.

## Maintenance notes

- `creatorOf` returns `"system"` for a signed-in subject with no `users` row.
  After plan 018 every writer has a row, so that branch is reached only by the
  service identity.
- Existing rows keep whatever `createdBy` they have. No backfill is planned.
- `upsertExternalSource` now ignores `type` and `createdBy` on an existing
  Source. If a future feature needs to convert a Source's type, give it its
  own mutation; do not route it through intake.
- A reviewer should confirm the insert branch still writes `createdBy` and
  `type`, and that `blockedReason` clearing still works (it is set explicitly
  after the spread, so the filter does not affect it).
