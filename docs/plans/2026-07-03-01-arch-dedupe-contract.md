# One Dedupe Contract for Source Intake — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `convex/sourceUtils.ts` the single dedupe module for every source-intake path, migrate existing rows to canonical keys, and archive the duplicates the old divergent keys created.

**Architecture:** `convex/ingest.ts` currently re-implements 3 of the 6 dedupe-key cases with different formats (`rss:hostname:guid` at ingest.ts:120-123 vs canonical `rss:feedUrl:guid`; query-string-dropping URL keys at ingest.ts:303; a second `extractYouTubeVideoId` at ingest.ts:357-368). The same article ingested via the 6-hourly cron vs the `/ingest/*` HTTP routes gets different keys → duplicate rows. We (1) widen the canonical module to the union of both implementations' capabilities, (2) delete the inline copies, (3) add a batched, pagination-cursor mutation that recomputes canonical keys for existing rows and archives collision losers, (4) drive it from a dry-run-first script.

**Tech Stack:** Bun, Convex (self-hosted), bun:test.

## Global Constraints

- Bun runtime everywhere: `bun <file>`, `bun test`, `bunx` — never `node`/`npx`.
- `bunx convex codegen` is the Convex typegate **and it pushes to the live self-hosted deployment**. Run it only when the working tree compiles as a coherent whole; never leave broken intermediate states deployed.
- `convex/sources.ts` uses the two-arg `ctx.db` convention: `ctx.db.get("sources", id)`, `ctx.db.patch("sources", id, {...})`. Match it exactly.
- Convex mutations cannot `ctx.runMutation` — inline `ctx.db` writes via shared pure helpers.
- Any schema change requires mirroring in `convex/validators.ts` (none expected in this plan — the new mutation uses inline `returns:` validators, not table mirrors).
- Data is archived, never deleted: collision losers get `status: "archived"`, `blockedReason: "duplicate"`.
- Task order matters: the ingest.ts switch (Task 3) must be deployed **before** the migration is applied (Task 6), so the cron stops minting old-format keys and the migration converges everything, including any dupes created in the deploy window.

---

### Task 1: Widen the canonical `extractYouTubeVideoId` and pin inherited behaviour with tests

The inline copy in ingest.ts handles `youtube.com/v/` URLs; the canonical copy handles `youtube.com/shorts/`. Consolidation must be the union, not a silent capability loss.

**Files:**
- Modify: `convex/sourceUtils.ts`
- Test: `convex/sourceUtils.test.ts`

**Interfaces:**
- Produces: `extractYouTubeVideoId(url: string): string | null` (existing export, one new pattern) and `computeCanonicalDedupeKey(source): string | null` (new export, used by Task 4's mutation and Task 5's script):

```typescript
export function computeCanonicalDedupeKey(source: {
  type: string;
  notionPageId?: string;
  feedUrl?: string;
  rssGuid?: string;
  canonicalUrl?: string;
  youtubeVideoId?: string;
}): string | null;
```

Returns `null` when the row lacks the identifiers its type needs (caller skips it) or when the type has no recomputable identity (`pdf`, and `notion`/`podcast` rows missing their identifier).

- [ ] **Step 1: Write the failing tests**

Append to `convex/sourceUtils.test.ts` inside the existing `describe("source utilities", ...)` block:

```typescript
  test("extracts video ids from /v/ URLs (inherited from ingest.ts copy)", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/v/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  test("rss dedupe key falls back to canonicalUrl when guid is missing", () => {
    expect(
      generateDedupeKey("rss", {
        feedUrl: "https://feed.test/rss.xml",
        canonicalUrl: "https://feed.test/entry-1",
      }),
    ).toBe("rss:https://feed.test/rss.xml:https://feed.test/entry-1");
  });

  test("computeCanonicalDedupeKey recomputes per type and skips unrecomputable rows", () => {
    expect(
      computeCanonicalDedupeKey({
        type: "rss",
        feedUrl: "https://feed.test/rss.xml",
        rssGuid: "entry-42",
      }),
    ).toBe("rss:https://feed.test/rss.xml:entry-42");

    expect(
      computeCanonicalDedupeKey({
        type: "url",
        canonicalUrl: "https://Example.com/a/?q=1",
      }),
    ).toBe("url:example.com/a?q=1");

    expect(
      computeCanonicalDedupeKey({
        type: "youtube",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }),
    ).toBe("yt:dQw4w9WgXcQ");

    expect(computeCanonicalDedupeKey({ type: "rss" })).toBeNull(); // no feedUrl
    expect(computeCanonicalDedupeKey({ type: "pdf" })).toBeNull(); // never recomputed
    expect(computeCanonicalDedupeKey({ type: "notion" })).toBeNull(); // no notionPageId
  });
```

Also add `computeCanonicalDedupeKey` to the import at the top of the test file:

```typescript
import {
  computeCanonicalDedupeKey,
  extractYouTubeVideoId,
  generateDedupeKey,
  normalizeUrl,
} from "./sourceUtils";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test convex/sourceUtils.test.ts`
Expected: FAIL — `/v/` test gets `null`; `computeCanonicalDedupeKey` is not exported.

- [ ] **Step 3: Implement in `convex/sourceUtils.ts`**

Add the `/v/` pattern to the existing `patterns` array in `extractYouTubeVideoId` (currently sourceUtils.ts:39-51):

```typescript
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}
```

Append the new helper at the end of the file:

```typescript
/**
 * Recompute the canonical dedupeKey for an existing source row.
 * Returns null when the row can't be recomputed safely:
 * - pdf keys were minted from file hashes we don't store on the row
 * - notion/podcast rows missing their identifier
 * - rss/url/youtube rows missing the fields their key needs
 */
export function computeCanonicalDedupeKey(source: {
  type: string;
  notionPageId?: string;
  feedUrl?: string;
  rssGuid?: string;
  canonicalUrl?: string;
  youtubeVideoId?: string;
}): string | null {
  switch (source.type) {
    case "notion":
      return source.notionPageId ? generateDedupeKey("notion", source) : null;
    case "rss":
    case "podcast":
      return source.feedUrl && (source.rssGuid || source.canonicalUrl)
        ? generateDedupeKey(source.type, source)
        : null;
    case "url":
      return source.canonicalUrl ? generateDedupeKey("url", source) : null;
    case "youtube": {
      const videoId =
        source.youtubeVideoId ??
        (source.canonicalUrl ? extractYouTubeVideoId(source.canonicalUrl) : null);
      return videoId ? `yt:${videoId}` : null;
    }
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test convex/sourceUtils.test.ts`
Expected: PASS (all tests, including the three pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add convex/sourceUtils.ts convex/sourceUtils.test.ts
git commit -m "feat(sourceUtils): widen youtube id extraction, add computeCanonicalDedupeKey

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Point `convex/ingest.ts` at the canonical dedupe module

**Files:**
- Modify: `convex/ingest.ts`

**Interfaces:**
- Consumes: `generateDedupeKey`, `extractYouTubeVideoId` from `./sourceUtils` (Task 1 shapes).
- Produces: no new exports; `pollFeed`, `ingestUrl`, `ingestYouTube` now mint canonical keys.

- [ ] **Step 1: Add the import**

At the top of `convex/ingest.ts` (after the existing imports at lines 1-4):

```typescript
import { extractYouTubeVideoId, generateDedupeKey } from "./sourceUtils";
```

- [ ] **Step 2: Delete `generateRSSDedupeKey` and switch `pollFeed`**

Delete the whole function at ingest.ts:117-123:

```typescript
/**
 * Generate dedupeKey for RSS items
 */
function generateRSSDedupeKey(feedUrl: string, item: RSSItem): string {
  const identifier = item.guid || item.link;
  return `rss:${new URL(feedUrl).hostname}:${identifier}`;
}
```

In `pollFeed`'s item loop, replace:

```typescript
          const dedupeKey = generateRSSDedupeKey(feed.url, item);
```

with:

```typescript
          const dedupeKey = generateDedupeKey("rss", {
            feedUrl: feed.url,
            rssGuid: item.guid,
            canonicalUrl: item.link,
          });
```

(Canonical rss case is `rss:${feedUrl}:${rssGuid || canonicalUrl}` — same guid-falls-back-to-link semantics the old copy had, but keyed on the full feed URL like every other intake path.)

- [ ] **Step 3: Switch `ingestUrl`'s inline key**

Replace (ingest.ts:301-303):

```typescript
    // Generate dedupeKey
    const urlObj = new URL(args.url);
    const dedupeKey = `url:${urlObj.hostname}${urlObj.pathname.replace(/\/$/, "")}`;
```

with:

```typescript
    // Generate dedupeKey (canonical: keeps query string, matches sources.createFromUrlInput)
    const urlObj = new URL(args.url);
    const dedupeKey = generateDedupeKey("url", { canonicalUrl: args.url });
```

(`urlObj` is still used further down for `title = ... : urlObj.hostname` — keep it.)

- [ ] **Step 4: Delete the local `extractYouTubeVideoId`**

Delete the entire local function at ingest.ts:354-368 (the JSDoc comment `/** Extract YouTube video ID from URL */` plus the function). `ingestYouTube` now resolves it from the Task 1 import; no call-site change needed.

- [ ] **Step 5: Typegate + deploy**

Run: `bunx convex codegen`
Expected: completes with no TypeScript errors (this deploys the canonical-key ingest paths — from now on the cron mints canonical keys).

- [ ] **Step 6: Commit**

```bash
git add convex/ingest.ts
git commit -m "fix(ingest): use canonical sourceUtils dedupe keys in all intake paths

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `recomputeDedupeKeys` migration mutation

**Files:**
- Modify: `convex/sources.ts` (append after the `archive` mutation, sources.ts:586+)

**Interfaces:**
- Consumes: `computeCanonicalDedupeKey` from `./sourceUtils` (Task 1).
- Produces (Task 5's script calls this):

```typescript
// api.sources.recomputeDedupeKeys
args: { cursor: string | null, batchSize?: number, apply: boolean, devBypassSecret?: string }
returns: {
  processed: number; changed: number; collisionsArchived: number; skipped: number;
  isDone: boolean; continueCursor: string;
  planned: Array<{ id: string; from: string; to: string; collidesWith: string | null }>;
}
```

**Design notes (why this shape):**
- Public `mutation` + `requireAuth` with `devBypassSecret`, NOT `internalMutation`: the driver script uses `ConvexHttpClient`, which cannot call internal functions. This is the established script pattern (`scripts/find-dupes.ts` calls `api.sources.archive` the same way).
- `.paginate()` cursor, not an index-range cursor: `createdAt` values can collide within a batch-ingest millisecond; opaque pagination cursors can't skip rows.
- Batches stay small (default 25) because sources carry up to 200k chars of `rawText` and Convex reads whole documents — a full-table `.collect()` would risk the transaction read limit.
- Collision rule: the **older** row (smaller `createdAt`) keeps the canonical key; the newer row is archived with `blockedReason: "duplicate"`. Older rows are the ones extractions/hypotheses already reference.

- [ ] **Step 1: Append the mutation to `convex/sources.ts`**

```typescript
/**
 * Migration: recompute canonical dedupeKeys (see docs/plans/2026-07-03-01-arch-dedupe-contract.md).
 * Batched via pagination cursor. apply:false reports without writing.
 * Collision rule: older row keeps the key; newer row is archived as duplicate.
 */
export const recomputeDedupeKeys = mutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
    apply: v.boolean(),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    processed: v.number(),
    changed: v.number(),
    collisionsArchived: v.number(),
    skipped: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
    planned: v.array(
      v.object({
        id: v.string(),
        from: v.string(),
        to: v.string(),
        collidesWith: v.union(v.string(), v.null()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const batchSize = Math.min(Math.max(args.batchSize ?? 25, 1), 100);
    const page = await ctx.db
      .query("sources")
      .paginate({ numItems: batchSize, cursor: args.cursor });

    let changed = 0;
    let collisionsArchived = 0;
    let skipped = 0;
    const planned: Array<{ id: string; from: string; to: string; collidesWith: string | null }> =
      [];
    const now = Date.now();

    for (const source of page.page) {
      const canonical = computeCanonicalDedupeKey(source);
      if (canonical === null || canonical === source.dedupeKey) {
        if (canonical === null) skipped++;
        continue;
      }

      const holder = await ctx.db
        .query("sources")
        .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", canonical))
        .first();
      const collidesWith = holder && holder._id !== source._id ? holder._id : null;
      planned.push({ id: source._id, from: source.dedupeKey, to: canonical, collidesWith });

      if (!args.apply) continue;

      if (collidesWith === null) {
        await ctx.db.patch("sources", source._id, { dedupeKey: canonical, updatedAt: now });
        changed++;
      } else if (holder && holder.createdAt <= source.createdAt) {
        // Holder is older: archive this row as the duplicate.
        await ctx.db.patch("sources", source._id, {
          status: "archived",
          blockedReason: "duplicate",
          blockedDetails: `dedupe-migration: duplicate of ${holder._id}`,
          updatedAt: now,
        });
        collisionsArchived++;
      } else if (holder) {
        // This row is older: it should own the canonical key. Archive the newer holder first.
        await ctx.db.patch("sources", holder._id, {
          status: "archived",
          blockedReason: "duplicate",
          blockedDetails: `dedupe-migration: duplicate of ${source._id}`,
          dedupeKey: `archived:${holder.dedupeKey}:${holder._id}`,
          updatedAt: now,
        });
        await ctx.db.patch("sources", source._id, { dedupeKey: canonical, updatedAt: now });
        changed++;
        collisionsArchived++;
      }
    }

    return {
      processed: page.page.length,
      changed,
      collisionsArchived,
      skipped,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      planned: planned.slice(0, 50),
    };
  },
});
```

- [ ] **Step 2: Typegate + deploy**

Run: `bunx convex codegen`
Expected: no TypeScript errors. (If `paginate` types complain about the two-arg db wrapper, the fallback is `.withIndex("by_createdAt")`-ordered `.take(batchSize + 1)` cursoring on `createdAt` — but try `.paginate()` first; it is the tie-safe option.)

- [ ] **Step 3: Commit**

```bash
git add convex/sources.ts
git commit -m "feat(sources): add recomputeDedupeKeys migration mutation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Driver script with dry-run default

**Files:**
- Create: `scripts/migrate-dedupe-keys.ts`

**Interfaces:**
- Consumes: `api.sources.recomputeDedupeKeys` (Task 3 signature).

- [ ] **Step 1: Write the script**

```typescript
/**
 * Migrate source dedupeKeys to the canonical sourceUtils format.
 *
 * Dry-run by default: prints planned changes and collisions, writes nothing.
 * Usage:
 *   bun run scripts/migrate-dedupe-keys.ts           # dry run
 *   bun run scripts/migrate-dedupe-keys.ts --apply   # execute
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_SELF_HOSTED_URL ?? process.env.CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error("Set CONVEX_SELF_HOSTED_URL or CONVEX_URL in .env.local");
}
const BYPASS = process.env.AUTH_BYPASS_SECRET ?? "freq-opus-extract-2026";

async function main() {
  const apply = process.argv.includes("--apply");
  const client = new ConvexHttpClient(CONVEX_URL as string);

  let cursor: string | null = null;
  let isDone = false;
  const totals = { processed: 0, changed: 0, collisionsArchived: 0, skipped: 0 };
  const planned: Array<{ id: string; from: string; to: string; collidesWith: string | null }> =
    [];

  while (!isDone) {
    const result = await client.mutation(api.sources.recomputeDedupeKeys, {
      cursor,
      batchSize: 25,
      apply,
      devBypassSecret: BYPASS,
    });
    totals.processed += result.processed;
    totals.changed += result.changed;
    totals.collisionsArchived += result.collisionsArchived;
    totals.skipped += result.skipped;
    planned.push(...result.planned);
    cursor = result.continueCursor;
    isDone = result.isDone;
    process.stdout.write(`\rprocessed ${totals.processed}...`);
  }
  console.log("\n");

  for (const p of planned) {
    const marker = p.collidesWith ? `COLLISION → archive vs ${p.collidesWith}` : "rekey";
    console.log(`${p.id}\n  from: ${p.from}\n  to:   ${p.to}\n  ${marker}\n`);
  }

  console.log(`${apply ? "APPLIED" : "DRY RUN (use --apply to execute)"}`);
  console.log(
    `processed=${totals.processed} rekeyed=${totals.changed} archived=${totals.collisionsArchived} skipped=${totals.skipped} plannedShown=${planned.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Dry run**

Run: `bun run scripts/migrate-dedupe-keys.ts`
Expected output shape (counts will vary):

```
processed 412...

jd7abc...
  from: rss:quantamagazine.org:https://www.quantamagazine.org/some-article/
  to:   rss:https://www.quantamagazine.org/feed/:https://www.quantamagazine.org/some-article/
  rekey

...

DRY RUN (use --apply to execute)
processed=412 rekeyed=0 archived=0 skipped=9 plannedShown=63
```

Sanity-check the plan lines: `rss:` rekeys should go hostname→full-feed-URL; `url:` rekeys should gain query strings; collisions should list a plausible older twin. **Stop and investigate if any `to:` key looks wrong — nothing has been written yet.**

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-dedupe-keys.ts
git commit -m "feat(scripts): dedupe-key migration driver with dry-run default

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Apply the migration and verify convergence

**Files:** none (operational task; keep the transcript in the PR description).

- [ ] **Step 1: Apply**

Run: `bun run scripts/migrate-dedupe-keys.ts --apply`
Expected: `APPLIED` with `rekeyed` ≈ the dry run's planned rekeys and `archived` ≈ its collision count.

- [ ] **Step 2: Verify convergence (idempotency)**

Run: `bun run scripts/migrate-dedupe-keys.ts`
Expected: `rekeyed=0 archived=0` and an empty planned list — every row now carries its canonical key.

- [ ] **Step 3: Verify the cron path agrees**

Run: `bunx convex run ingest:pollAllFeeds '{"devBypassSecret": "freq-opus-extract-2026"}'`
Then rerun: `bun run scripts/migrate-dedupe-keys.ts`
Expected: still `rekeyed=0 archived=0` — freshly polled items dedupe against migrated rows instead of duplicating them.

---

### Task 6: Retire the fourth `normalizeUrl` in `scripts/find-dupes.ts`

find-dupes.ts:13-25 carries its own URL normalizer (strips protocol/www/query) — a fourth notion of URL identity. Repoint it at the canonical one so the dupe report groups by the same identity the dedupe contract uses. Conscious behaviour change: canonical `normalizeUrl` keeps query strings, so a handful of previously-grouped URL pairs may now only surface in the title-similarity section — that is correct, they have different canonical identities.

**Files:**
- Modify: `scripts/find-dupes.ts`

- [ ] **Step 1: Swap the import, delete the local copy**

Replace find-dupes.ts:7-25:

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL || "http://convex-backend.paas.rproj.art";
const BYPASS = "freq-opus-extract-2026";

function normalizeUrl(url: string): string {
  let u = url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .replace(/#.*$/, "")
    .toLowerCase();
  // Keep query params for YouTube (video ID is in ?v=)
  if (!u.includes("youtube.com") && !u.includes("youtu.be")) {
    u = u.replace(/\?.*$/, "");
  }
  return u;
}
```

with:

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { normalizeUrl } from "../convex/sourceUtils";

const CONVEX_URL = process.env.CONVEX_URL || "http://convex-backend.paas.rproj.art";
const BYPASS = "freq-opus-extract-2026";
```

(Env-var precedence cleanup for this script belongs to the ingest-script-lib plan, 2026-07-03-06 — do not fold it in here.)

- [ ] **Step 2: Run the report**

Run: `bun run scripts/find-dupes.ts`
Expected: runs clean. URL-duplicate groups should be rare-to-empty now (the migration archived key-level dupes); review the title-similarity section for any survivors and archive them manually with `--archive` if they are genuine dupes.

- [ ] **Step 3: Commit**

```bash
git add scripts/find-dupes.ts
git commit -m "refactor(scripts): find-dupes uses canonical normalizeUrl

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Done means

- `grep -rn "rss:\${new URL\|url:\${urlObj" convex/` returns nothing; `convex/ingest.ts` defines no key-format or video-id logic of its own.
- `bun test convex/sourceUtils.test.ts` passes with the widened cases.
- Dry-run migration reports zero planned changes (twice: after apply, and after a manual `pollAllFeeds`).
- `scripts/find-dupes.ts` imports `normalizeUrl` from `convex/sourceUtils`.
