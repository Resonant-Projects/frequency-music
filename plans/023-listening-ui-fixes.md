# Plan 023: Fix four defects on the listening and feedback screens

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report; do not
> improvise. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat cf4a8174..HEAD -- web/src/routes/composition-detail.tsx web/src/routes/feedback.tsx web/src/integrations/convex/query.ts web/src/components/audio-feedback.tsx`
> If any of these changed, compare the excerpts below with the live code
> first; a mismatch is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/017-size-hook-ratchet.md (one file is over the size
  limit); plans/018-role-gated-writes.md for step 4 only (`api.users.viewer`)
- **Category**: bug
- **Planned at**: commit `cf4a8174`, 2026-11-09

## Why this matters

Listening feedback is the evidence this product exists to collect, and four
small defects distort or block it:

1. Audio that is playing restarts from 0:00 when an unrelated item in the
   same list changes, because the query wrapper resubscribes whenever its
   arguments are a new object, even an equal one.
2. Clearing a rating field on the Feedback form stores a real `0`, because
   `Number("")` is `0`. A zero then counts in failure classification.
3. The listening history shows a badge reading "expandability true" instead
   of the score.
4. The "Session visibility" control is disabled for everyone, including the
   session's creator, because it compares a Clerk user id with a Convex
   `users` document id. Sessions are created private and cannot be changed.

## Current state

The web app is **SolidJS**, not React: signals, `createMemo`, `createEffect`.
A `<Show when={x}>` with a function child passes an accessor of the `when`
value, not of some other value.

**Defect 1.** `web/src/integrations/convex/query.ts` (4,464 bytes). Both
`createQuery` (lines 31-36) and `createQueryWithStatus` (lines 74-81) memoize
their arguments with default (reference) equality:

```ts
  const resolvedArgs = createMemo(() => {
    const raw =
      typeof args === "function"
        ? (args as () => FunctionArgs<Query> | "skip")()
        : args;
    if (raw === "skip") return "skip" as const;
    return raw ?? ({} as FunctionArgs<Query>);
  });
```

The effect that follows (lines 86-98) clears the data, unsubscribes and
resubscribes every time `resolvedArgs()` changes. Callers such as
`web/src/components/audio-feedback.tsx:198-200` build their arguments object
from a prop that is replaced on every list update.

`web/src/components/audio-feedback.tsx:9` already imports a deterministic
serializer:

```ts
import { stableStringify } from "../../../convex/shared/stableHash";
```

**Defect 2.** `web/src/routes/feedback.tsx` (17,083 bytes), lines 176-181:

```ts
        ratings: {
          bodilyPleasantness: Number(pleasantness()),
          goosebumps: Number(goosebumps()),
          musicality: Number(musicality()),
          expandability: parseOptionalRating(expandability()),
        },
```

On the server every field of `ratings` is optional
(`convex/listening.ts:52-62`), so a blank rating should be left out. A correct
parser already exists in `web/src/components/audio-feedback.tsx:70-74`:

```ts
function parseScore(raw: string): number | null | undefined {
  if (raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 5 ? value : null;
}
```

It returns `undefined` for blank, `null` for invalid, and the number
otherwise. The form's submit handler (`feedback.tsx:153`,
`async function submitSession(event: SubmitEvent)`) has no in-flight guard, so
a double click inserts two sessions.

**Defect 3.** `web/src/routes/composition-detail.tsx:907-916`:

```tsx
                              <Show
                                when={
                                  session().ratings.expandability !== undefined
                                }
                              >
                                {(score) => (
                                  <UIBadge tone="cream">
                                    expandability {score()}
                                  </UIBadge>
                                )}
                              </Show>
```

`score()` is the boolean condition, so the badge prints `true`.

**Defect 4.** `web/src/routes/composition-detail.tsx:412-438`, inside
`function ListeningVisibilityControl(props: { session: Doc<"listeningSessions"> })`:

```tsx
  const auth = useClerkAuthSnapshot();
  // ...
  const authBypass = import.meta.env.VITE_AUTH_BYPASS === "1";
  const canEdit = createMemo(
    () =>
      !authBypass &&
      auth().userId !== null &&
      auth().userId === String(props.session.createdBy),
  );
```

`auth().userId` is the Clerk id; `props.session.createdBy` is a Convex `users`
id. The server already enforces ownership in `listening.updateVisibility`.
After plan 018, the public query `api.users.viewer` returns
`{ userId: Id<"users"> | null, role } | null` for the signed-in caller.

**Size ratchet.** `web/src/routes/composition-detail.tsx` is 34,477 bytes and
listed in `scripts/file-token-baseline.json`; a commit that makes it larger is
rejected. The edits to it in this plan remove more than they add.
`feedback.tsx` and `audio-feedback.tsx` are under 20,000 bytes and must stay
under.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `vp install` (repo root) | exit 0 |
| Web unit tests | `cd web && vp test src/lib` | all pass |
| Web typecheck | `vp run typecheck:web` (repo root) | exit 0 |
| Web build | `vp run build:web` (repo root) | exit 0 |
| Format | `vp run format:check` (repo root) | exit 0 |
| Size check | `git add -A && node scripts/check-file-tokens.mjs` | exit 0 |

Before changing anything, run `cd web && vp test src/lib`. Four test files
exist there (`draft-review-search`, `item-sectors`, `knowledge-atlas`,
`zodiac-orbits`). If the command cannot run them, that is a STOP condition.

Never run `vpx convex ...` or `bunx convex ...`.

## Scope

**In scope**:
- `web/src/lib/query-args.ts`, `web/src/lib/query-args.test.ts` (create)
- `web/src/lib/rating.ts`, `web/src/lib/rating.test.ts` (create)
- `web/src/integrations/convex/query.ts`
- `web/src/routes/feedback.tsx`
- `web/src/components/audio-feedback.tsx` (import the shared parser only)
- `web/src/routes/composition-detail.tsx` (the two excerpts only)

**Out of scope**:
- `web/src/routes/listen.tsx` and `web/src/components/studio-comparison.tsx` —
  they have their own copies of the rating parser and are over the size
  limit. Leave them.
- Double-submit guards on other forms (`weekly-turns`, `theses`, `hypotheses`,
  `recipes`, `compositions`) — recorded as follow-up.
- Anything under `convex/`. The server contracts do not change.
- Visual design, copy, CSS.

## Git workflow

- Branch: `fix/listening-ui`
- Conventional commits, one per defect, e.g. `fix(web): keep query
  subscriptions when args are structurally equal`.
- Never `git commit --no-verify`. Do not push or open a PR unless asked.

## Steps

### Step 1: Compare query arguments by value

Create `web/src/lib/query-args.ts`:

```ts
import { stableStringify } from "../../../convex/shared/stableHash";

/** True when two Convex argument values serialize identically. */
export function sameQueryArgs(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return stableStringify(a) === stableStringify(b);
  } catch {
    return false;
  }
}
```

The `try` matters: `JSON.stringify` throws on a `bigint`, and falling back to
`false` keeps today's behaviour for such arguments.

In `web/src/integrations/convex/query.ts`, pass the comparator to both memos:
`createMemo(<existing function>, undefined, { equals: sameQueryArgs })`.
Do not change anything else in that file.

**Verify**: `vp run typecheck:web` → exit 0.

### Step 2: One rating parser, and blank means "not given"

Create `web/src/lib/rating.ts` exporting `parseScore` with exactly the body
shown above. In `web/src/components/audio-feedback.tsx`, delete the local
`parseScore` and import it from `../lib/rating`.

In `web/src/routes/feedback.tsx`, in `submitSession`:

1. Parse the three required-looking ratings before the `try`:
   `const scores = { bodilyPleasantness: parseScore(pleasantness()), goosebumps: parseScore(goosebumps()), musicality: parseScore(musicality()) };`
2. If any value is `null`, call `setNotice(null)`,
   `setNoticeError("Ratings must be whole numbers from 0 to 5.")` and return
   without submitting.
3. Build `ratings` from the entries whose value is not `undefined`, plus the
   existing `expandability: parseOptionalRating(expandability())`. A blank
   field must not appear in the object at all.

Then add the in-flight guard, following the pattern already used in
`web/src/routes/ingest.tsx:177` (`setIsIngestingUrl(true)` ... `finally`):
a `saving` signal, `if (saving()) return;` at the top of `submitSession`,
`setSaving(true)` before the mutation, `setSaving(false)` in a `finally`, and
`disabled={saving()}` plus `aria-busy={saving()}` on the form's submit button.

**Verify**: `vp run typecheck:web` → exit 0;
`wc -c web/src/routes/feedback.tsx` → under 20000.

### Step 3: Print the expandability score

In `web/src/routes/composition-detail.tsx`, replace the function child of that
`<Show>` with a plain child:

```tsx
                                <UIBadge tone="cream">
                                  expandability {session().ratings.expandability}
                                </UIBadge>
```

Keep the `<Show when={...}>` wrapper as it is.

**Verify**: `vp run typecheck:web` → exit 0.

### Step 4: Decide `canEdit` from the caller's Convex user id

Requires plan 018 (`grep -n "export const viewer" convex/users.ts` must
match; otherwise skip this step and record it as not done).

In `ListeningVisibilityControl`:
- Replace `const auth = useClerkAuthSnapshot();` with
  `const viewer = createQueryWithStatus(api.users.viewer, () => ({}));`
- Replace the `canEdit` memo body with
  `() => !authBypass && viewer.data()?.userId === props.session.createdBy`.
  When the viewer is loading, anonymous or unmapped, the left side is
  `undefined` or `null` and the control stays disabled.
- If `useClerkAuthSnapshot` is now unused in the file
  (`grep -n "useClerkAuthSnapshot" web/src/routes/composition-detail.tsx`),
  remove its import.

**Verify**:
- `vp run typecheck:web` → exit 0.
- `git add -A && node scripts/check-file-tokens.mjs` → exit 0.
- `git cat-file -s :web/src/routes/composition-detail.tsx` → at most 34477.

## Test plan

Model both files on `web/src/lib/draft-review-search.test.ts`, which starts:

```ts
// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
```

`web/src/lib/query-args.test.ts`:
1. The same reference → `true`.
2. Two separately built `{ id: "a", limit: 5 }` objects → `true`.
3. The same keys in a different order → `true`.
4. `{ id: "a" }` and `{ id: "b" }` → `false`.
5. `"skip"` and `"skip"` → `true`; `"skip"` and `{}` → `false`.
6. `{ n: 1n }` compared with a separate `{ n: 1n }` → `false`, and no throw.

`web/src/lib/rating.test.ts`:
7. `""` and `"  "` → `undefined`.
8. `"0"`, `"3"`, `"5"` → `0`, `3`, `5`.
9. `"6"`, `"-1"`, `"2.5"`, `"abc"` → `null`.

**Verify**: `cd web && vp test src/lib` → all pass, including the 9 new cases.

There is no component test runner in `web/`, so steps 3 and 4 and the form
behaviour are covered by typecheck and build only. Say so in your report; do
not add a new test framework.

## Done criteria

- [ ] `cd web && vp test src/lib` passes with the two new test files.
- [ ] `vp run typecheck:web` and `vp run build:web` exit 0.
- [ ] `grep -n "Number(pleasantness())\|Number(goosebumps())\|Number(musicality())" web/src/routes/feedback.tsx`
      returns nothing.
- [ ] `grep -n "{(score) =>" web/src/routes/composition-detail.tsx` returns
      nothing.
- [ ] `grep -n "auth().userId" web/src/routes/composition-detail.tsx` returns
      nothing (or step 4 is recorded as skipped because plan 018 is absent).
- [ ] `grep -c "equals: sameQueryArgs" web/src/integrations/convex/query.ts`
      prints `2`.
- [ ] `node scripts/check-file-tokens.mjs --all` exits 0.
- [ ] `git status --short` lists only in-scope files.
- [ ] `plans/README.md` row for 023 updated.

## STOP conditions

- The excerpts do not match the live code.
- `cd web && vp test src/lib` cannot run the four existing tests.
- `web/src/routes/composition-detail.tsx` would grow past 34,477 bytes.
- `createQueryWithStatus` does not return an object with a `data` accessor
  (check `web/src/integrations/convex/query.ts:15-20`).
- A Playwright fixture under `web/tests/` fails to typecheck because it stubs
  the query wrapper or `api.users.viewer` is missing from a fixture. Report
  it; fixture changes are out of scope.

## Maintenance notes

- `sameQueryArgs` serializes arguments on every change. Convex arguments are
  small; do not pass large payloads as query arguments.
- The duplicated rating parsers in `listen.tsx` and `studio-comparison.tsx`
  should move to `web/src/lib/rating.ts` when those files are next split.
- Follow-up not in this plan: in-flight guards for the other five create
  forms listed under "Out of scope", and a Playwright case asserting that a
  playing episode survives a rating on another item.
- A reviewer should play audio in "Rate audio", rate a different item, and
  confirm playback continues.
