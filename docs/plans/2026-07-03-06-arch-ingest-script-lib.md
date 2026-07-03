# Ingest Script Lib (Arch Candidate 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the 30-island script directory into one deep ingestion module (`scripts/lib/`) behind a small interface, convert the six recurring scripts to thin manifests, and archive the already-run one-shot batch scripts untouched.

**Architecture:** Three lib modules — `convexClient.ts` (env resolution + client, once), `fetchText.ts` (Jina fetch + text-cap rules, once), `ingest.ts` (`createSourceIngestor` hiding dedupe-skip, create, refetch-by-status, rate limiting). Each accepts its dependencies (fetch impl, Convex client) so tests cross the same interface the scripts do. The interface is the test surface; the scripts become manifests.

**Tech Stack:** Bun + bun:test, ConvexHttpClient (`convex/browser`), generated `convex/_generated/api`.

## Global Constraints

- **PREREQUISITE: plan `2026-07-03-02-arch-single-source-shapes.md` must be executed first** — Task 3 imports `SourceStatus` from `convex/shared/statuses.ts`, which that plan creates. If that file does not exist, STOP and execute plan 02 first.
- Runtime is Bun: `bun test`, `bun run`, `bunx`. Bun auto-loads `.env.local` — tests that exercise env precedence must explicitly set/delete/restore `process.env` keys.
- Scripts talk to the **live self-hosted deployment**. Conversions must be behaviour-preserving: same Convex functions called with the same args (adding `devBypassSecret` where a script omitted it is allowed — it matches the documented auth model in CLAUDE.md).
- Never delete a script. One-shots are moved with `git mv` to `scripts/archive/`, byte-identical.
- No hardcoded deployment URLs anywhere in new code. Env resolution lives only in `scripts/lib/convexClient.ts`.
- Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: `scripts/lib/convexClient.ts` — env resolution, once

**Files:**
- Create: `scripts/lib/convexClient.ts`
- Test: `scripts/lib/convexClient.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `getConvexUrl(): string`, `getConvexClient(): ConvexHttpClient`, `getDevBypassSecret(): string`. Tasks 3–9 rely on these exact names.

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/lib/convexClient.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getConvexUrl, getDevBypassSecret } from "./convexClient";

const SAVED = {
  CONVEX_SELF_HOSTED_URL: process.env.CONVEX_SELF_HOSTED_URL,
  CONVEX_URL: process.env.CONVEX_URL,
  AUTH_BYPASS_SECRET: process.env.AUTH_BYPASS_SECRET,
};

function restore() {
  for (const [key, value] of Object.entries(SAVED)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("getConvexUrl", () => {
  beforeEach(() => {
    delete process.env.CONVEX_SELF_HOSTED_URL;
    delete process.env.CONVEX_URL;
  });
  afterEach(restore);

  test("throws when neither env var is set", () => {
    expect(() => getConvexUrl()).toThrow(
      "Set CONVEX_SELF_HOSTED_URL or CONVEX_URL in .env.local",
    );
  });

  test("uses CONVEX_URL when it is the only one set", () => {
    process.env.CONVEX_URL = "http://only-url.example";
    expect(getConvexUrl()).toBe("http://only-url.example");
  });

  test("prefers CONVEX_SELF_HOSTED_URL when both are set", () => {
    process.env.CONVEX_SELF_HOSTED_URL = "http://self-hosted.example";
    process.env.CONVEX_URL = "http://other.example";
    expect(getConvexUrl()).toBe("http://self-hosted.example");
  });
});

describe("getDevBypassSecret", () => {
  afterEach(restore);

  test("env value wins", () => {
    process.env.AUTH_BYPASS_SECRET = "custom-secret";
    expect(getDevBypassSecret()).toBe("custom-secret");
  });

  test("falls back to the current hardcoded value", () => {
    delete process.env.AUTH_BYPASS_SECRET;
    expect(getDevBypassSecret()).toBe("freq-opus-extract-2026");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/lib/convexClient.test.ts`
Expected: FAIL — `Cannot find module './convexClient'`

- [ ] **Step 3: Write the implementation**

```typescript
// scripts/lib/convexClient.ts
import { ConvexHttpClient } from "convex/browser";

export function getConvexUrl(): string {
  const url = process.env.CONVEX_SELF_HOSTED_URL ?? process.env.CONVEX_URL;
  if (!url) {
    throw new Error("Set CONVEX_SELF_HOSTED_URL or CONVEX_URL in .env.local");
  }
  return url;
}

export function getConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(getConvexUrl());
}

export function getDevBypassSecret(): string {
  return process.env.AUTH_BYPASS_SECRET ?? "freq-opus-extract-2026";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test scripts/lib/convexClient.test.ts`
Expected: `5 pass, 0 fail`

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/convexClient.ts scripts/lib/convexClient.test.ts
git commit -m "feat(scripts): shared Convex client with single env resolution

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `scripts/lib/fetchText.ts` — one Jina fetch, one text-cap rule

**Files:**
- Create: `scripts/lib/fetchText.ts`
- Test: `scripts/lib/fetchText.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `type FetchResult = { ok: true; text: string } | { ok: false; error: string }`, `fetchViaJina(url, opts?): Promise<FetchResult>`, `capText(text, cap?): string | undefined`, constants `MIN_TEXT_LENGTH = 100`, `TEXT_CAP = 200000`. Tasks 3, 6, 8, 9 rely on these exact names.

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/lib/fetchText.test.ts
import { describe, expect, test } from "bun:test";
import { MIN_TEXT_LENGTH, TEXT_CAP, capText, fetchViaJina } from "./fetchText";

function fakeFetch(status: number, body: string): typeof fetch {
  return (async () => new Response(body, { status })) as unknown as typeof fetch;
}

describe("fetchViaJina", () => {
  test("returns trimmed text on success", async () => {
    const result = await fetchViaJina("https://example.com/a", {
      fetchImpl: fakeFetch(200, "  hello world  \n"),
    });
    expect(result).toEqual({ ok: true, text: "hello world" });
  });

  test("returns ok:false with status on non-ok response", async () => {
    const result = await fetchViaJina("https://example.com/a", {
      fetchImpl: fakeFetch(451, ""),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("451");
  });

  test("returns ok:false when fetch throws", async () => {
    const throwing = (async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    const result = await fetchViaJina("https://example.com/a", { fetchImpl: throwing });
    expect(result).toEqual({ ok: false, error: "boom" });
  });

  test("targets the Jina reader URL", async () => {
    let seenUrl = "";
    const spy = (async (input: RequestInfo | URL) => {
      seenUrl = String(input);
      return new Response("text", { status: 200 });
    }) as unknown as typeof fetch;
    await fetchViaJina("https://example.com/article?x=1", { fetchImpl: spy });
    expect(seenUrl).toBe("https://r.jina.ai/https://example.com/article?x=1");
  });
});

describe("capText", () => {
  test("returns undefined below MIN_TEXT_LENGTH", () => {
    expect(capText("x".repeat(MIN_TEXT_LENGTH - 1))).toBeUndefined();
  });

  test("returns text at exactly MIN_TEXT_LENGTH", () => {
    const text = "x".repeat(MIN_TEXT_LENGTH);
    expect(capText(text)).toBe(text);
  });

  test("caps at TEXT_CAP", () => {
    const result = capText("x".repeat(TEXT_CAP + 5000));
    expect(result?.length).toBe(TEXT_CAP);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/lib/fetchText.test.ts`
Expected: FAIL — `Cannot find module './fetchText'`

- [ ] **Step 3: Write the implementation**

```typescript
// scripts/lib/fetchText.ts
/**
 * One Jina Reader fetch and one text-cap rule for every script.
 * Replaces 11 divergent hand-rolled copies (different error handling,
 * slice lengths, and encodings).
 */

export const MIN_TEXT_LENGTH = 100;
export const TEXT_CAP = 200_000;

export type FetchResult = { ok: true; text: string } | { ok: false; error: string };

export async function fetchViaJina(
  url: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<FetchResult> {
  const { timeoutMs = 30_000, fetchImpl = fetch } = opts;
  try {
    const resp = await fetchImpl(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) return { ok: false, error: `Jina fetch failed: ${resp.status}` };
    return { ok: true, text: (await resp.text()).trim() };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function capText(text: string, cap: number = TEXT_CAP): string | undefined {
  if (text.length < MIN_TEXT_LENGTH) return undefined;
  return text.slice(0, cap);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test scripts/lib/fetchText.test.ts`
Expected: `7 pass, 0 fail`

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/fetchText.ts scripts/lib/fetchText.test.ts
git commit -m "feat(scripts): shared Jina fetch and text-cap module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `scripts/lib/ingest.ts` — the deep ingestor

**Files:**
- Create: `scripts/lib/ingest.ts`
- Test: `scripts/lib/ingest.test.ts`

**Interfaces:**
- Consumes: `getConvexClient`, `getDevBypassSecret` (Task 1); `FetchResult`, `fetchViaJina`, `capText`, `TEXT_CAP` (Task 2); `SourceStatus` from `convex/shared/statuses` (plan 02).
- Produces (Tasks 4–9 and 11 rely on these exact names):

```typescript
export type SourceType = "notion" | "rss" | "url" | "youtube" | "pdf" | "podcast";
export interface SourceManifestItem {
  type: SourceType;
  title: string;
  dedupeKey: string;
  url?: string;
  canonicalUrl?: string;
  author?: string;
  publishedAt?: number;
  rawText?: string;
  transcript?: string;
  notionPageId?: string;
  youtubeVideoId?: string;
  rssGuid?: string;
  feedUrl?: string;
  tags?: string[];
  topics?: string[];
  metadata?: Record<string, unknown>;
  fetchText?: boolean;
}
export interface IngestSummary { created: number; skipped: number; failed: number }
export interface RefetchSummary { updated: number; skipped: number; failed: number }
export interface RefetchOptions {
  limit?: number;       // default 20
  minLength?: number;   // default 1000
  types?: SourceType[]; // default: no type filter
  reExtract?: boolean;  // default false
}
export function createSourceIngestor(opts?: {
  client?: MinimalClient;
  rateMs?: number;                                   // default 1000
  fetchText?: (url: string) => Promise<FetchResult>; // default fetchViaJina
  log?: (line: string) => void;                      // default console.log
}): {
  alreadyIngested(dedupeKey: string): Promise<boolean>;
  ingest(items: SourceManifestItem[]): Promise<IngestSummary>;
  refetchByStatus(statuses: SourceStatus[], opts?: RefetchOptions): Promise<RefetchSummary>;
}
```

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/lib/ingest.test.ts
import { describe, expect, test } from "bun:test";
import { type MinimalClient, createSourceIngestor } from "./ingest";

type Call = { kind: "query" | "mutation"; name: string; args: Record<string, unknown> };

function fakeClient(handlers: Record<string, (args: any) => unknown>) {
  const calls: Call[] = [];
  const dispatch = (kind: "query" | "mutation") => async (ref: any, args: any) => {
    // Function references stringify to their path via getFunctionName-compatible key;
    // for the fake we key handlers on the arg shape instead (see below).
    const name =
      args && "dedupeKey" in args && kind === "query"
        ? "sources:getByDedupeKey"
        : args && "status" in args && kind === "query"
          ? "sources:listByStatus"
          : args && "rawText" in args && kind === "mutation" && "id" in args
            ? "sources:updateText"
            : args && "transcript" in args && kind === "mutation" && "id" in args
              ? "sources:updateText"
              : args && "status" in args && kind === "mutation"
                ? "sources:updateStatus"
                : "sources:create";
    calls.push({ kind, name, args });
    const handler = handlers[name];
    if (!handler) throw new Error(`no fake handler for ${name}`);
    return handler(args);
  };
  const client = {
    query: dispatch("query"),
    mutation: dispatch("mutation"),
  } as unknown as MinimalClient;
  return { client, calls };
}

describe("ingest", () => {
  test("skips existing, creates new, applies capText, counts correctly", async () => {
    const { client, calls } = fakeClient({
      "sources:getByDedupeKey": (args) =>
        args.dedupeKey === "url:exists" ? { _id: "s1" } : null,
      "sources:create": () => ({ id: "s2", created: true }),
    });
    const ingestor = createSourceIngestor({
      client,
      rateMs: 0,
      fetchText: async () => ({ ok: true, text: "T".repeat(150) }),
      log: () => {},
    });
    const summary = await ingestor.ingest([
      { type: "url", title: "Old", dedupeKey: "url:exists", url: "https://a.example" },
      { type: "url", title: "New", dedupeKey: "url:new", url: "https://b.example" },
      { type: "pdf", title: "Short text", dedupeKey: "pdf:short", rawText: "tiny" },
    ]);
    expect(summary).toEqual({ created: 2, skipped: 1, failed: 0 });
    const creates = calls.filter((c) => c.name === "sources:create");
    expect(creates.length).toBe(2);
    // fetched text passed through capText
    expect((creates[0].args.rawText as string).length).toBe(150);
    // pre-set rawText below MIN_TEXT_LENGTH becomes undefined
    expect(creates[1].args.rawText).toBeUndefined();
    // devBypassSecret always attached
    expect(creates[0].args.devBypassSecret).toBeDefined();
  });

  test("failed fetch still creates the source without rawText", async () => {
    const { client, calls } = fakeClient({
      "sources:getByDedupeKey": () => null,
      "sources:create": () => ({ id: "s9", created: true }),
    });
    const ingestor = createSourceIngestor({
      client,
      rateMs: 0,
      fetchText: async () => ({ ok: false, error: "blocked" }),
      log: () => {},
    });
    const summary = await ingestor.ingest([
      { type: "url", title: "Blocked", dedupeKey: "url:blocked", url: "https://c.example" },
    ]);
    expect(summary).toEqual({ created: 1, skipped: 0, failed: 0 });
    const create = calls.find((c) => c.name === "sources:create");
    expect(create?.args.rawText).toBeUndefined();
  });

  test("a throwing mutation counts as failed and does not abort the batch", async () => {
    let first = true;
    const { client } = fakeClient({
      "sources:getByDedupeKey": () => null,
      "sources:create": () => {
        if (first) {
          first = false;
          throw new Error("validator rejected");
        }
        return { id: "ok", created: true };
      },
    });
    const ingestor = createSourceIngestor({ client, rateMs: 0, log: () => {} });
    const summary = await ingestor.ingest([
      { type: "url", title: "Bad", dedupeKey: "url:bad" },
      { type: "url", title: "Good", dedupeKey: "url:good" },
    ]);
    expect(summary).toEqual({ created: 1, skipped: 0, failed: 1 });
  });
});

describe("refetchByStatus", () => {
  const rows = [
    { _id: "a", type: "url", status: "text_ready", canonicalUrl: "https://a.example", rawText: "short", title: "A" },
    { _id: "b", type: "notion", status: "text_ready", canonicalUrl: "https://b.example", rawText: "short", title: "B" },
    { _id: "c", type: "url", status: "extracted", canonicalUrl: "https://c.example", rawText: "short", title: "C" },
    { _id: "d", type: "url", status: "text_ready", canonicalUrl: undefined, rawText: "", title: "D" },
    { _id: "e", type: "url", status: "text_ready", canonicalUrl: "https://e.example", rawText: "x".repeat(5000), title: "E" },
  ];

  test("filters by type/url/length, updates text, resets extracted rows when reExtract", async () => {
    const { client, calls } = fakeClient({
      "sources:listByStatus": (args) => rows.filter((r) => r.status === args.status),
      "sources:updateText": () => null,
      "sources:updateStatus": () => null,
    });
    const ingestor = createSourceIngestor({
      client,
      rateMs: 0,
      fetchText: async () => ({ ok: true, text: "F".repeat(2000) }),
      log: () => {},
    });
    const summary = await ingestor.refetchByStatus(["text_ready", "extracted"], {
      types: ["url"],
      minLength: 1000,
      reExtract: true,
    });
    // a and c qualify (url type, has url, short text); b is notion, d has no url, e is long
    expect(summary).toEqual({ updated: 2, skipped: 0, failed: 0 });
    const updates = calls.filter((c) => c.name === "sources:updateText");
    expect(updates.map((c) => c.args.id).sort()).toEqual(["a", "c"]);
    // only the previously-extracted row is reset to text_ready
    const resets = calls.filter((c) => c.name === "sources:updateStatus");
    expect(resets.length).toBe(1);
    expect(resets[0].args).toMatchObject({ id: "c", status: "text_ready" });
  });

  test("fetched text not longer than current counts as skipped", async () => {
    const { client, calls } = fakeClient({
      "sources:listByStatus": (args) => rows.filter((r) => r.status === args.status),
      "sources:updateText": () => null,
    });
    const ingestor = createSourceIngestor({
      client,
      rateMs: 0,
      fetchText: async () => ({ ok: true, text: "ab" }),
      log: () => {},
    });
    const summary = await ingestor.refetchByStatus(["text_ready"], { types: ["url"], minLength: 1000 });
    expect(summary.updated).toBe(0);
    expect(summary.skipped).toBeGreaterThan(0);
    expect(calls.filter((c) => c.name === "sources:updateText").length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/lib/ingest.test.ts`
Expected: FAIL — `Cannot find module './ingest'`

- [ ] **Step 3: Write the implementation**

```typescript
// scripts/lib/ingest.ts
/**
 * Deep source-ingestion module. Hides: dedupe-skip, text fetch + cap,
 * sources.create, refetch-by-status flow, rate limiting, auth bypass.
 * Scripts become manifests: data + one call.
 */
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { SourceStatus } from "../../convex/shared/statuses";
import { getConvexClient, getDevBypassSecret } from "./convexClient";
import { type FetchResult, TEXT_CAP, capText, fetchViaJina } from "./fetchText";

export type SourceType = "notion" | "rss" | "url" | "youtube" | "pdf" | "podcast";

export interface SourceManifestItem {
  type: SourceType;
  title: string;
  dedupeKey: string;
  url?: string;
  canonicalUrl?: string;
  author?: string;
  publishedAt?: number;
  rawText?: string;
  transcript?: string;
  notionPageId?: string;
  youtubeVideoId?: string;
  rssGuid?: string;
  feedUrl?: string;
  tags?: string[];
  topics?: string[];
  metadata?: Record<string, unknown>;
  fetchText?: boolean;
}

export interface IngestSummary {
  created: number;
  skipped: number;
  failed: number;
}

export interface RefetchSummary {
  updated: number;
  skipped: number;
  failed: number;
}

export interface RefetchOptions {
  limit?: number;
  minLength?: number;
  types?: SourceType[];
  reExtract?: boolean;
}

export type MinimalClient = Pick<ConvexHttpClient, "query" | "mutation">;

interface SourceRow {
  _id: string;
  type: string;
  status: string;
  canonicalUrl?: string;
  rawText?: string;
  title?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createSourceIngestor(
  opts: {
    client?: MinimalClient;
    rateMs?: number;
    fetchText?: (url: string) => Promise<FetchResult>;
    log?: (line: string) => void;
  } = {},
) {
  const client = opts.client ?? getConvexClient();
  const rateMs = opts.rateMs ?? 1000;
  const fetchText = opts.fetchText ?? fetchViaJina;
  const log = opts.log ?? console.log;
  const devBypassSecret = getDevBypassSecret();

  async function alreadyIngested(dedupeKey: string): Promise<boolean> {
    const existing = await client.query(api.sources.getByDedupeKey, { dedupeKey });
    return existing !== null;
  }

  async function ingest(items: SourceManifestItem[]): Promise<IngestSummary> {
    const summary: IngestSummary = { created: 0, skipped: 0, failed: 0 };
    for (const item of items) {
      try {
        if (await alreadyIngested(item.dedupeKey)) {
          log(`  ⏭ exists: ${item.title}`);
          summary.skipped++;
          continue;
        }

        let text = item.rawText;
        const shouldFetch = item.fetchText !== false && item.url && text === undefined;
        if (shouldFetch && item.url) {
          const result = await fetchText(item.url);
          if (result.ok) text = result.text;
          else log(`  ⚠ fetch failed (${result.error}): ${item.title}`);
        }

        const result = await client.mutation(api.sources.create, {
          type: item.type,
          title: item.title,
          author: item.author,
          publishedAt: item.publishedAt,
          canonicalUrl: item.canonicalUrl ?? item.url,
          notionPageId: item.notionPageId,
          rssGuid: item.rssGuid,
          feedUrl: item.feedUrl,
          youtubeVideoId: item.youtubeVideoId,
          rawText: text !== undefined ? capText(text) : undefined,
          transcript: item.transcript,
          tags: item.tags,
          topics: item.topics,
          metadata: item.metadata,
          dedupeKey: item.dedupeKey,
          devBypassSecret,
        });

        if (result.created) {
          log(`  ✓ created: ${item.title}`);
          summary.created++;
        } else {
          log(`  ⏭ duplicate: ${item.title}`);
          summary.skipped++;
        }
        if (rateMs > 0) await sleep(rateMs);
      } catch (e: unknown) {
        log(`  ✗ failed: ${item.title} — ${e instanceof Error ? e.message : String(e)}`);
        summary.failed++;
      }
    }
    return summary;
  }

  async function refetchByStatus(
    statuses: SourceStatus[],
    refetchOpts: RefetchOptions = {},
  ): Promise<RefetchSummary> {
    const { limit = 20, minLength = 1000, types, reExtract = false } = refetchOpts;
    const summary: RefetchSummary = { updated: 0, skipped: 0, failed: 0 };

    const all: SourceRow[] = [];
    for (const status of statuses) {
      const batch = (await client.query(api.sources.listByStatus, {
        status,
        limit: limit * 2,
      })) as SourceRow[];
      all.push(...batch);
    }

    const candidates = all
      .filter((s) => {
        const textLen = (s.rawText ?? "").length;
        const hasUrl = s.canonicalUrl?.startsWith("http") ?? false;
        const typeOk = types === undefined || types.includes(s.type as SourceType);
        return typeOk && hasUrl && textLen < minLength;
      })
      .slice(0, limit);

    const toReExtract: string[] = [];
    for (const source of candidates) {
      const currentLen = (source.rawText ?? "").length;
      log(`📄 ${source.title?.slice(0, 60)} (${currentLen} chars)`);
      try {
        const result = await fetchText(source.canonicalUrl as string);
        if (!result.ok || result.text.length <= currentLen) {
          log(`  ⏭ no better text${result.ok ? "" : ` (${result.error})`}`);
          summary.skipped++;
        } else {
          await client.mutation(api.sources.updateText, {
            id: source._id as Id<"sources">,
            rawText: result.text.slice(0, TEXT_CAP),
            devBypassSecret,
          });
          log(`  ✓ updated: ${result.text.length} chars`);
          summary.updated++;
          if (reExtract && source.status === "extracted") toReExtract.push(source._id);
        }
        if (rateMs > 0) await sleep(rateMs);
      } catch (e: unknown) {
        log(`  ✗ ${e instanceof Error ? e.message : String(e)}`);
        summary.failed++;
      }
    }

    for (const id of toReExtract) {
      await client.mutation(api.sources.updateStatus, {
        id: id as Id<"sources">,
        status: "text_ready",
        devBypassSecret,
      });
    }
    if (toReExtract.length > 0) log(`Reset ${toReExtract.length} sources to text_ready`);

    return summary;
  }

  return { alreadyIngested, ingest, refetchByStatus };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test scripts/lib/ingest.test.ts`
Expected: `5 pass, 0 fail`

- [ ] **Step 5: Run the whole lib suite**

Run: `bun test scripts/lib/`
Expected: all pass (parse-essay tests + Tasks 1–3 tests), `0 fail`

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/ingest.ts scripts/lib/ingest.test.ts
git commit -m "feat(scripts): deep source ingestor — dedupe, fetch, create, refetch

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Convert `scripts/fetch-full-articles.ts`

**Files:**
- Modify: `scripts/fetch-full-articles.ts` (157 lines → ~25)

**Interfaces:**
- Consumes: `createSourceIngestor().refetchByStatus` (Task 3).
- Produces: nothing new — CLI behaviour preserved (`--limit`, `--min-length`, `--re-extract`).

- [ ] **Step 1: Replace the file contents entirely**

```typescript
#!/usr/bin/env bun
/**
 * Fetch full article text for short rss/url sources via Jina Reader.
 *
 * Usage: bun run scripts/fetch-full-articles.ts [--limit N] [--min-length N] [--re-extract]
 */
import { createSourceIngestor } from "./lib/ingest";

const args = process.argv.slice(2);
function numFlag(flag: string, fallback: number): number {
  const i = args.indexOf(flag);
  const parsed = i !== -1 ? Number.parseInt(args[i + 1] ?? "", 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const summary = await createSourceIngestor().refetchByStatus(["extracted", "text_ready"], {
  limit: numFlag("--limit", 20),
  minLength: numFlag("--min-length", 1000),
  types: ["rss", "url"],
  reExtract: args.includes("--re-extract"),
});
console.log(`Done: ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed`);
```

- [ ] **Step 2: Typecheck the scripts entry**

Run: `bun build --no-bundle scripts/fetch-full-articles.ts > /dev/null && bun test scripts/lib/`
Expected: build succeeds, lib tests still `0 fail`

- [ ] **Step 3: Smoke-run against the live deployment (read-mostly, limit 1)**

Run: `bun run scripts/fetch-full-articles.ts --limit 1 --min-length 1`
Expected: `Done: 0 updated, ...` (min-length 1 matches nothing — proves wiring without writes)

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-full-articles.ts
git commit -m "refactor(scripts): fetch-full-articles becomes a refetch manifest

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Convert `scripts/fetch-notion-full-text.ts`

**Files:**
- Modify: `scripts/fetch-notion-full-text.ts` (123 lines → ~20)

**Interfaces:**
- Consumes: `createSourceIngestor().refetchByStatus` (Task 3).
- Produces: CLI behaviour preserved (`--limit`; notion sources, min 500 chars).

- [ ] **Step 1: Replace the file contents entirely**

```typescript
#!/usr/bin/env bun
/**
 * Fetch full text for Notion sources that have URLs.
 *
 * Usage: bun scripts/fetch-notion-full-text.ts [--limit N]
 */
import { createSourceIngestor } from "./lib/ingest";

const args = process.argv.slice(2);
const i = args.indexOf("--limit");
const parsed = i !== -1 ? Number.parseInt(args[i + 1] ?? "", 10) : Number.NaN;
const limit = Number.isInteger(parsed) && parsed > 0 ? parsed : 20;

console.log(`📚 Fetching full text for Notion sources (limit: ${limit})\n`);
const summary = await createSourceIngestor().refetchByStatus(["ingested"], {
  limit,
  minLength: 500,
  types: ["notion"],
});
console.log(`\n✅ Updated: ${summary.updated}  ⏭ Skipped: ${summary.skipped}  ❌ Errors: ${summary.failed}`);
```

- [ ] **Step 2: Verify**

Run: `bun build --no-bundle scripts/fetch-notion-full-text.ts > /dev/null`
Expected: succeeds

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-notion-full-text.ts
git commit -m "refactor(scripts): fetch-notion-full-text uses the shared ingestor

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Convert `scripts/smart-fetch.ts`

**Files:**
- Modify: `scripts/smart-fetch.ts` (208 lines → ~150; the multi-strategy fetcher is its real value and stays)

**Interfaces:**
- Consumes: `getConvexClient`, `getDevBypassSecret` (Task 1); `fetchViaJina` (Task 2); `createSourceIngestor` with injected `fetchText` (Task 3).
- Produces: CLI behaviour preserved (`<url>`, `--update <sourceId>`, `--batch-update`).

- [ ] **Step 1: Replace the file contents entirely**

```typescript
/**
 * Smart text fetcher — tries multiple strategies to get article text.
 * 1. Jina Reader  2. Direct HTML fetch  3. Kernel.sh cloud browser
 *
 * Usage:
 *   bun run scripts/smart-fetch.ts <url>                     # Just fetch and print
 *   bun run scripts/smart-fetch.ts <url> --update <sourceId> # Fetch and update Convex
 *   bun run scripts/smart-fetch.ts --batch-update            # Update all ingested sources
 */
import type { Id } from "../convex/_generated/dataModel";
import { api } from "../convex/_generated/api";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";
import { type FetchResult, fetchViaJina } from "./lib/fetchText";
import { createSourceIngestor } from "./lib/ingest";

interface SmartResult {
  text: string;
  method: "jina" | "direct" | "kernel" | "none";
  chars: number;
}

async function fetchDirect(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return "";
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("pdf")) return "";
    const html = await resp.text();
    const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
    return body
      .replaceAll(/<script[\s\S]*?<\/script>/gi, "")
      .replaceAll(/<style[\s\S]*?<\/style>/gi, "")
      .replaceAll(/<nav[\s\S]*?<\/nav>/gi, "")
      .replaceAll(/<footer[\s\S]*?<\/footer>/gi, "")
      .replaceAll(/<header[\s\S]*?<\/header>/gi, "")
      .replaceAll(/<[^>]+>/g, " ")
      .replaceAll("&nbsp;", " ")
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&#x27;", "'")
      .replaceAll("&quot;", '"')
      .replaceAll(/\s+/g, " ")
      .trim()
      .slice(0, 100000);
  } catch {
    return "";
  }
}

async function fetchViaKernel(url: string): Promise<string> {
  if (!process.env.KERNEL_API_KEY) return "";
  try {
    const Kernel = (await import("@onkernel/sdk")).default;
    const kernel = new Kernel();
    const browser = await kernel.browsers.create({ timeout_seconds: 60, stealth: true });
    const sessionId = browser.session_id;
    try {
      const result: any = await kernel.browsers.playwright.execute(sessionId, {
        code: `
          const ctx = browser.contexts()[0];
          const pg = ctx.pages()[0] || await ctx.newPage();
          await pg.goto("${url.replaceAll('"', '\\"')}", { waitUntil: "domcontentloaded", timeout: 30000 });
          await pg.waitForTimeout(5000);
          const text = await pg.evaluate(() => {
            const sels = ['article', '[role="main"]', '.article-body', 'main', '.entry-content'];
            for (const s of sels) {
              const el = document.querySelector(s);
              if (el && el.textContent && el.textContent.trim().length > 500) return el.textContent.trim();
            }
            return document.body?.innerText?.trim() || "";
          });
          return { text: text.slice(0, 100000) };
        `,
      });
      return result?.text || "";
    } finally {
      try {
        await kernel.browsers.deleteByID(sessionId);
      } catch {}
    }
  } catch {
    return "";
  }
}

async function smartFetch(url: string): Promise<SmartResult> {
  const jina = await fetchViaJina(url);
  if (jina.ok && jina.text.length > 500) {
    const text = jina.text.slice(0, 100000);
    return { text, method: "jina", chars: text.length };
  }
  let text = await fetchDirect(url);
  if (text.length > 500) return { text, method: "direct", chars: text.length };
  text = await fetchViaKernel(url);
  if (text.length > 500) return { text, method: "kernel", chars: text.length };
  return { text: "", method: "none", chars: 0 };
}

const smartFetchAdapter = async (url: string): Promise<FetchResult> => {
  const result = await smartFetch(url);
  return result.chars > 200
    ? { ok: true, text: result.text }
    : { ok: false, error: `no text (${result.method})` };
};

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--batch-update")) {
    const summary = await createSourceIngestor({ fetchText: smartFetchAdapter }).refetchByStatus(
      ["ingested"],
      { limit: 500, minLength: 1000 },
    );
    console.log(`\nDone: ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed`);
    return;
  }

  const url = args.find((a) => !a.startsWith("--"));
  if (!url) {
    console.log("Usage: smart-fetch.ts <url> [--update <sourceId>] | --batch-update");
    process.exit(1);
  }

  console.error(`Fetching: ${url}`);
  const result = await smartFetch(url);
  console.error(`Method: ${result.method}, Chars: ${result.chars}`);

  const sourceId = args[args.indexOf("--update") + 1];
  if (args.includes("--update") && sourceId && result.chars > 200) {
    await getConvexClient().mutation(api.sources.updateText, {
      id: sourceId as Id<"sources">,
      rawText: result.text,
      devBypassSecret: getDevBypassSecret(),
    });
    console.error("✓ Updated in Convex");
  }

  console.log(result.text.slice(0, 2000));
  if (result.chars > 2000) console.log(`\n... [${result.chars - 2000} more chars]`);
}

main().catch(console.error);
```

Note the behaviour delta (intentional, logged here): batch mode previously updated on >200 fetched chars regardless of existing text; it now goes through `refetchByStatus`, which also requires the fetched text to beat the current text — strictly safer.

- [ ] **Step 2: Verify build + a single-URL dry run (no Convex writes)**

Run: `bun build --no-bundle scripts/smart-fetch.ts > /dev/null && bun run scripts/smart-fetch.ts https://example.com | head -3`
Expected: prints method + a text/empty preview; exit 0

- [ ] **Step 3: Commit**

```bash
git add scripts/smart-fetch.ts
git commit -m "refactor(scripts): smart-fetch keeps strategies, delegates flow to lib

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Convert `scripts/fetch-youtube-transcripts.ts`

**Files:**
- Modify: `scripts/fetch-youtube-transcripts.ts` (134 lines → ~105; Fabric CLI transcript fetch and the transcript/failure-marking flow are YouTube-specific and stay)

**Interfaces:**
- Consumes: `getConvexClient`, `getDevBypassSecret` (Task 1).
- Produces: CLI behaviour preserved (`--limit`).

- [ ] **Step 1: Replace the file contents entirely**

```typescript
#!/usr/bin/env bun
/**
 * Fetch YouTube transcripts using Fabric CLI and push to Convex.
 *
 * Usage: bun run scripts/fetch-youtube-transcripts.ts [--limit N]
 */
import { api } from "../convex/_generated/api";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";

const FABRIC_PATH = `${process.env.HOME}/.local/bin/fabric`;
const client = getConvexClient();
const devBypassSecret = getDevBypassSecret();

// NOTE: near-duplicate of convex/sourceUtils.ts extractYouTubeVideoId — plan
// 2026-07-03-01 consolidates the convex-side copies; script keeps a local one
// because importing convex runtime code into scripts stays limited to _generated.
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchTranscript(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const proc = Bun.spawn([FABRIC_PATH, "--youtube", url, "--transcript"], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}` },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) throw new Error(`Fabric error: ${stderr}`);
  return stdout.trim();
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 10;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) limit = parseInt(args[i + 1], 10);
  }

  console.log(`Fetching up to ${limit} YouTube transcripts...`);
  const sources = await client.query(api.sources.listByStatus, {
    status: "ingested",
    limit: limit * 2,
  });
  const youtubeSources = sources.filter((s: any) => s.type === "youtube").slice(0, limit);
  console.log(`Found ${youtubeSources.length} YouTube videos to process`);

  let success = 0;
  let failed = 0;
  for (const source of youtubeSources) {
    const videoId = source.youtubeVideoId || extractVideoId(source.canonicalUrl || "");
    if (!videoId) {
      console.log(`❌ ${source.title}: No video ID`);
      failed++;
      continue;
    }
    try {
      console.log(`📹 ${source.title}...`);
      const transcript = await fetchTranscript(videoId);
      if (!transcript) throw new Error("Empty transcript");
      await client.mutation(api.sources.updateText, {
        id: source._id,
        transcript,
        devBypassSecret,
      });
      console.log(`   ✅ ${transcript.length} chars`);
      success++;
    } catch (error) {
      console.log(`   ❌ ${error}`);
      await client.mutation(api.sources.updateStatus, {
        id: source._id,
        status: "review_needed",
        blockedReason: "no_text",
        blockedDetails: `Transcript fetch failed: ${error}`,
        devBypassSecret,
      });
      failed++;
    }
  }
  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
}

main().catch(console.error);
```

- [ ] **Step 2: Verify**

Run: `bun build --no-bundle scripts/fetch-youtube-transcripts.ts > /dev/null`
Expected: succeeds

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-youtube-transcripts.ts
git commit -m "refactor(scripts): fetch-youtube-transcripts uses shared client/env

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Convert `scripts/sync-notion-tag.ts`

**Files:**
- Modify: `scripts/sync-notion-tag.ts` (251 lines → ~190; the Notion API client stays, env/client/dedupe/create/rate-limit move to the lib)

**Interfaces:**
- Consumes: `createSourceIngestor().alreadyIngested/.ingest` (Task 3); `fetchViaJina` (Task 2).
- Produces: CLI behaviour preserved (`--tag-id <id>`, `--fetch-full-text`).

- [ ] **Step 1: Replace the file contents entirely**

```typescript
#!/usr/bin/env bun
/**
 * Sync notes from a Notion Tag to the Convex sources database.
 *
 * Usage:
 *   bun scripts/sync-notion-tag.ts                    # Sync Frequency Research tag
 *   bun scripts/sync-notion-tag.ts --tag-id <id>      # Sync specific tag
 *   bun scripts/sync-notion-tag.ts --fetch-full-text  # Also fetch article text via Jina
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { fetchViaJina } from "./lib/fetchText";
import { createSourceIngestor } from "./lib/ingest";

const NOTION_VERSION = "2025-09-03";
const FREQUENCY_RESEARCH_TAG_ID = "2ff1c0d4-15f5-806e-8d86-d62c5f4cf701";

function getNotionKey(): string {
  try {
    return readFileSync(`${homedir()}/.config/notion/api_key`, "utf-8").trim();
  } catch {
    throw new Error("Notion API key not found. Set up ~/.config/notion/api_key");
  }
}

async function notionRequest(endpoint: string, options: RequestInit = {}) {
  const key = getNotionKey();
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }
  return response.json();
}

interface NotionPage {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: {
    Name?: { title: Array<{ text: { content: string } }> };
    URL?: { url: string | null };
    Type?: { select: { name: string } | null };
    Content?: { rich_text: Array<{ text: { content: string } }> };
    "Note Date"?: { date: { start: string } | null };
    Tag?: { relation: Array<{ id: string }> };
  };
}

interface RichTextElement {
  plain_text?: string;
}

async function getTagNotes(tagId: string): Promise<string[]> {
  const page = await notionRequest(`/pages/${tagId}`);
  const notes = page.properties?.Notes?.relation || [];
  return notes.map((n: { id: string }) => n.id);
}

async function getPageDetails(pageId: string): Promise<NotionPage> {
  return await notionRequest(`/pages/${pageId}`);
}

async function getPageContent(pageId: string): Promise<string> {
  const blocks = await notionRequest(`/blocks/${pageId}/children`);
  const textParts: string[] = [];
  for (const block of blocks.results || []) {
    const type = block.type;
    const content = block[type];
    if (content?.rich_text) {
      const text = (content.rich_text as RichTextElement[])
        .map((t) => (typeof t.plain_text === "string" ? t.plain_text : ""))
        .filter((value) => value.trim().length > 0)
        .join("");
      if (text) textParts.push(text);
    }
    if (block.has_children) {
      try {
        const childContent = await getPageContent(block.id);
        if (childContent) textParts.push(childContent);
      } catch {
        // Ignore errors for child blocks
      }
    }
  }
  return textParts.join("\n\n");
}

function extractTitle(page: NotionPage): string {
  return page.properties?.Name?.title?.[0]?.text?.content || "Untitled";
}

function extractUrl(page: NotionPage): string | undefined {
  return page.properties?.URL?.url || undefined;
}

function extractType(page: NotionPage): string | undefined {
  return page.properties?.Type?.select?.name;
}

async function main() {
  const args = process.argv.slice(2);
  const tagIdx = args.indexOf("--tag-id");
  let tagId = FREQUENCY_RESEARCH_TAG_ID;
  if (tagIdx !== -1) {
    const candidate = args[tagIdx + 1];
    if (!candidate || candidate.trim().length === 0 || candidate.startsWith("--")) {
      throw new Error("Missing value for --tag-id. Usage: --tag-id <notion-tag-id>");
    }
    tagId = candidate;
  }
  const fetchFullTextFlag = args.includes("--fetch-full-text");

  console.log(`🔄 Syncing Notion tag: ${tagId}`);
  console.log(`   Fetch full text: ${fetchFullTextFlag ? "yes" : "no"}\n`);

  const ingestor = createSourceIngestor({ rateMs: 350 });

  console.log("📋 Fetching note IDs from tag...");
  const noteIds = await getTagNotes(tagId);
  console.log(`   Found ${noteIds.length} notes\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const noteId of noteIds) {
    try {
      const dedupeKey = `notion:${noteId}`;
      // Early skip before the expensive Notion block walk
      if (await ingestor.alreadyIngested(dedupeKey)) {
        console.log(`   ⏭️ Already exists, skipping`);
        skipped++;
        continue;
      }

      const page = await getPageDetails(noteId);
      const title = extractTitle(page);
      const url = extractUrl(page);
      const type = extractType(page);
      console.log(`📄 Processing: ${title.slice(0, 50)}...`);

      let rawText = await getPageContent(noteId);
      if (fetchFullTextFlag && url) {
        console.log(`   🌐 Fetching full article from ${url.slice(0, 50)}...`);
        const fullText = await fetchViaJina(url);
        if (fullText.ok) {
          rawText = `${rawText}\n\n---\n\n${fullText.text.slice(0, 100000)}`;
        }
      }

      const summary = await ingestor.ingest([
        {
          type: "notion",
          title,
          canonicalUrl: url,
          notionPageId: noteId,
          rawText: rawText || undefined,
          fetchText: false,
          tags: type ? [type] : undefined,
          topics: ["frequency-research"],
          dedupeKey,
          metadata: {
            notionUrl: page.url,
            notionType: type,
            createdTime: page.created_time,
            lastEditedTime: page.last_edited_time,
          },
        },
      ]);
      created += summary.created;
      skipped += summary.skipped;
      errors += summary.failed;
    } catch (e: any) {
      console.error(`   ❌ Error: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("SYNC COMPLETE");
  console.log("=".repeat(50));
  console.log(`✅ Created: ${created}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Behaviour note: Notion page text below `MIN_TEXT_LENGTH` (100 chars) is now stored as no-text (`rawText: undefined`) instead of a tiny fragment — the lib's cap rule is a deliberate unification.

- [ ] **Step 2: Verify**

Run: `bun build --no-bundle scripts/sync-notion-tag.ts > /dev/null`
Expected: succeeds

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-notion-tag.ts
git commit -m "refactor(scripts): sync-notion-tag keeps Notion client, delegates ingest

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Convert `scripts/fetch-readwise-articles.ts`

**Files:**
- Modify: `scripts/fetch-readwise-articles.ts` (270 lines → ~150; Readwise API + search filtering stay)

**Interfaces:**
- Consumes: `createSourceIngestor().alreadyIngested/.ingest` (Task 3); `fetchViaJina` (Task 2).
- Produces: CLI behaviour preserved (`--search`, `--location`, `--limit`, `--fetch-full`).

- [ ] **Step 1: Replace the file contents entirely**

```typescript
#!/usr/bin/env bun
/**
 * Fetch articles from Readwise Reader and ingest into Convex.
 *
 * Usage: bun run scripts/fetch-readwise-articles.ts [options]
 *   --search <terms>    Search for specific topics (comma separated)
 *   --location <loc>    Filter by location (new, later, archive)
 *   --limit <n>         Max articles to process
 *   --fetch-full        Fetch full article text via Jina
 */
import { fetchViaJina } from "./lib/fetchText";
import { createSourceIngestor } from "./lib/ingest";

const READWISE_TOKEN = process.env.READWISE_TOKEN;
if (!READWISE_TOKEN) {
  console.error("READWISE_TOKEN must be set");
  process.exit(1);
}

interface ReadwiseArticle {
  id: string;
  title: string;
  author: string | null;
  source_url: string;
  category: string;
  location: string;
  tags: Record<string, any>;
  site_name: string | null;
  word_count: number | null;
  created_at: string;
  updated_at: string;
  published_date: string | null;
  summary: string | null;
  image_url: string | null;
  content: string | null;
  reading_progress: number;
  notes: string | null;
}

async function fetchReadwiseArticles(params: {
  location?: string;
  category?: string;
  pageSize?: number;
}): Promise<ReadwiseArticle[]> {
  const queryParams = new URLSearchParams();
  if (params.location) queryParams.set("location", params.location);
  if (params.category) queryParams.set("category", params.category || "article");
  queryParams.set("page_size", String(params.pageSize || 100));
  const response = await fetch(`https://readwise.io/api/v3/list/?${queryParams}`, {
    headers: { Authorization: `Token ${READWISE_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Readwise API error: ${response.status}`);
  const data = await response.json();
  return data.results;
}

function filterBySearchTerms(articles: ReadwiseArticle[], searchTerms: string[]): ReadwiseArticle[] {
  if (searchTerms.length === 0) return articles;
  const patterns = searchTerms.map((t) => new RegExp(t, "i"));
  return articles.filter((article) => {
    const searchText = `${article.title} ${article.summary || ""} ${article.site_name || ""}`;
    return patterns.some((p) => p.test(searchText));
  });
}

const DEFAULT_SEARCH_TERMS = [
  "music", "frequency", "harmonic", "acoustic", "cymatics", "tuning",
  "psychoacoustic", "neuroscience", "perception", "physics", "mathematics",
  "wave", "resonance", "vibration", "432", "528", "solfeggio", "temperament",
  "interval", "consonance", "dissonance", "spectrum", "fourier",
];

async function main() {
  const args = process.argv.slice(2);
  let searchTerms: string[] = [];
  let location: string | undefined;
  let limit = 20;
  let fetchFull = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--search" && args[i + 1]) {
      searchTerms = args[i + 1].split(",").map((s) => s.trim());
      i++;
    }
    if (args[i] === "--location" && args[i + 1]) {
      location = args[i + 1];
      i++;
    }
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === "--fetch-full") fetchFull = true;
  }
  if (searchTerms.length === 0) searchTerms = DEFAULT_SEARCH_TERMS;

  console.log(`Fetching Readwise articles...`);
  console.log(`Search terms: ${searchTerms.join(", ")}`);
  console.log(`Location filter: ${location || "any"}`);
  console.log(`Fetch full text: ${fetchFull}\n`);

  const allArticles = await fetchReadwiseArticles({ location, category: "article", pageSize: 200 });
  console.log(`Found ${allArticles.length} total articles in Reader`);
  const relevantArticles = filterBySearchTerms(allArticles, searchTerms).slice(0, limit);
  console.log(`${relevantArticles.length} match research criteria\n`);

  const ingestor = createSourceIngestor();
  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const article of relevantArticles) {
    console.log(`📄 ${article.title?.slice(0, 60)}...`);
    const dedupeKey = `readwise:${article.id}`;
    if (await ingestor.alreadyIngested(dedupeKey)) {
      console.log(`   ⏭️ Already ingested`);
      skipped++;
      continue;
    }

    let rawText = article.content || article.summary || "";
    if (fetchFull && article.source_url && rawText.length < 2000) {
      console.log(`   📥 Fetching full text...`);
      const fullText = await fetchViaJina(article.source_url);
      if (fullText.ok && fullText.text.length > rawText.length) {
        rawText = fullText.text;
        console.log(`   ✓ Got ${fullText.text.length} chars`);
      }
    }

    const summary = await ingestor.ingest([
      {
        type: "url",
        title: article.title,
        author: article.author || undefined,
        canonicalUrl: article.source_url,
        publishedAt: article.published_date ? Date.parse(article.published_date) : undefined,
        rawText: rawText || undefined,
        fetchText: false,
        tags: ["readwise", ...Object.keys(article.tags || {})],
        metadata: {
          readwiseId: article.id,
          readwiseLocation: article.location,
          siteName: article.site_name,
          wordCount: article.word_count,
          readingProgress: article.reading_progress,
        },
        dedupeKey,
      },
    ]);
    success += summary.created;
    skipped += summary.skipped;
    failed += summary.failed;
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Done: ${success} ingested, ${skipped} skipped, ${failed} failed`);
}

main().catch(console.error);
```

- [ ] **Step 2: Verify**

Run: `bun build --no-bundle scripts/fetch-readwise-articles.ts > /dev/null`
Expected: succeeds

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-readwise-articles.ts
git commit -m "refactor(scripts): fetch-readwise-articles delegates ingest to lib

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Archive the one-shot scripts

**Files:**
- Create: `scripts/archive/README.md`
- Move (git mv, byte-identical): 17 scripts listed below

**Interfaces:**
- Consumes: nothing.
- Produces: `scripts/` contains only live scripts + `lib/` + `langsmith/` + `archive/`.

- [ ] **Step 1: Verify every candidate exists (all 17 confirmed present at plan time)**

Run: `ls scripts/ingest-robert-grant.ts scripts/ingest-books-papers.ts scripts/ingest-microtuning.ts scripts/ingest-esoteric.ts scripts/ingest-esoteric-2.ts scripts/ingest-jmm-open-access.ts scripts/ingest-youtube-playlist.ts scripts/fetch-blocked-kernel.ts scripts/fetch-blocked-batch2.ts scripts/fetch-remaining-kernel.ts scripts/fetch-article-kernel.ts scripts/update-text-from-files.ts scripts/re-extract-batch.ts scripts/re-extract-all.ts scripts/opus-extract-source.ts scripts/store-extraction.ts scripts/dump-source.ts`
Expected: all 17 paths print, no error. If any is missing, drop it from the move list — do not fail the task.

- [ ] **Step 2: Move them**

```bash
mkdir -p scripts/archive
git mv scripts/ingest-robert-grant.ts scripts/ingest-books-papers.ts \
  scripts/ingest-microtuning.ts scripts/ingest-esoteric.ts \
  scripts/ingest-esoteric-2.ts scripts/ingest-jmm-open-access.ts \
  scripts/ingest-youtube-playlist.ts scripts/fetch-blocked-kernel.ts \
  scripts/fetch-blocked-batch2.ts scripts/fetch-remaining-kernel.ts \
  scripts/fetch-article-kernel.ts scripts/update-text-from-files.ts \
  scripts/re-extract-batch.ts scripts/re-extract-all.ts \
  scripts/opus-extract-source.ts scripts/store-extraction.ts \
  scripts/dump-source.ts scripts/archive/
```

- [ ] **Step 3: Write `scripts/archive/README.md`**

```markdown
# Archived one-shot scripts

These batch scripts already ran against the live deployment; they are kept
byte-identical for provenance and re-run reference. New source batches use
`scripts/lib/ingest.ts` manifests: `bun run scripts/ingest-manifest.ts data/<batch>.json`.
```

- [ ] **Step 4: Verify nothing live imports an archived script**

Run: `grep -rn "scripts/ingest-robert-grant\|scripts/store-extraction\|scripts/dump-source" --include="*.ts" --include="*.json" --include="*.md" scripts/ convex/ web/ agent/ package.json | grep -v scripts/archive || echo CLEAN`
Expected: `CLEAN` (CLAUDE.md references are fixed in Task 11)

- [ ] **Step 5: Commit**

```bash
git add scripts/archive/README.md
git commit -m "chore(scripts): archive completed one-shot batch scripts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Manifest driver, example manifest, CLAUDE.md

**Files:**
- Create: `scripts/ingest-manifest.ts`
- Create: `data/example-manifest.json`
- Modify: `CLAUDE.md` (the `## Key Scripts` section)

**Interfaces:**
- Consumes: `createSourceIngestor`, `SourceManifestItem` (Task 3).
- Produces: the documented entry point for all future source batches.

- [ ] **Step 1: Write the driver**

```typescript
#!/usr/bin/env bun
/**
 * Ingest a JSON manifest of sources. New source batches are data, not code.
 *
 * Usage: bun run scripts/ingest-manifest.ts data/<batch>.json
 */
import { readFileSync } from "node:fs";
import { type SourceManifestItem, createSourceIngestor } from "./lib/ingest";

const path = process.argv[2];
if (!path) {
  console.error("Usage: bun run scripts/ingest-manifest.ts <manifest.json>");
  process.exit(1);
}

const items = JSON.parse(readFileSync(path, "utf-8")) as SourceManifestItem[];
console.log(`Ingesting ${items.length} sources from ${path}\n`);
const summary = await createSourceIngestor().ingest(items);
console.log(`\nDone: ${summary.created} created, ${summary.skipped} skipped, ${summary.failed} failed`);
```

- [ ] **Step 2: Write `data/example-manifest.json`**

```json
[
  {
    "type": "url",
    "title": "Example article — replace me",
    "url": "https://example.com/article",
    "dedupeKey": "url:example.com/article",
    "topics": ["example"],
    "tags": ["manifest-example"]
  },
  {
    "type": "pdf",
    "title": "Example paper — replace me",
    "url": "https://example.com/paper.pdf",
    "dedupeKey": "book:example-paper",
    "topics": ["example"],
    "fetchText": false
  }
]
```

- [ ] **Step 3: Update CLAUDE.md `## Key Scripts`**

Replace the entire fenced block under `## Key Scripts` (from `# Source ingestion` through `bun run scripts/find-e2e.ts ...`) with:

```bash
# Shared script lib (scripts/lib/) — test it with:
bun test scripts/lib/

# Source ingestion — new batches are JSON manifests, not code
bun run scripts/ingest-manifest.ts data/<batch>.json

# Text fetching (recurring)
bun run scripts/smart-fetch.ts --batch-update        # Jina → direct → Kernel.sh
bun run scripts/fetch-full-articles.ts --limit 10    # Jina refetch for short rss/url
bun run scripts/fetch-notion-full-text.ts            # Notion sources → Jina
bun run scripts/fetch-youtube-transcripts.ts         # Fabric CLI transcripts

# Notion & Readwise
bun run scripts/sync-notion-tag.ts                   # Sync Frequency Research tag
bun run scripts/fetch-readwise-articles.ts --fetch-full

# Analysis & Maintenance
bun run scripts/audit-extractions.ts                 # Audit extraction quality
bun run scripts/find-dupes.ts                        # Find duplicate sources
bun run scripts/list-extraction-ids.ts               # Export to /tmp/ext-summary.json
bun run scripts/list-zero-sources.ts                 # Find zero-claim sources
bun run scripts/find-e2e.ts                          # Find E2E test data

# One-shot batch scripts that already ran live in scripts/archive/
```

- [ ] **Step 4: Verify the driver end-to-end against the live deployment**

Run: `bun run scripts/ingest-manifest.ts data/example-manifest.json`
Expected: `Done: 2 created, 0 skipped, 0 failed` on first run; re-run prints `Done: 0 created, 2 skipped, 0 failed` (dedupe works). Then clean up the two example rows: in the Convex dashboard or via `bunx convex run sources:updateStatus '{"id":"<id>","status":"archived","devBypassSecret":"freq-opus-extract-2026"}'` for each created id printed in the log.

- [ ] **Step 5: Run the full lib suite one last time**

Run: `bun test scripts/lib/`
Expected: `0 fail`

- [ ] **Step 6: Commit**

```bash
git add scripts/ingest-manifest.ts data/example-manifest.json CLAUDE.md
git commit -m "feat(scripts): manifest ingestion driver + docs — batches are data now

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
