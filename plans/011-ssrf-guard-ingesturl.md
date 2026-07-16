# Plan 011: `ingestUrl` validates and blocks internal-network URLs before fetching

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 86f0751..HEAD -- convex/ingest.ts`
> If `convex/ingest.ts` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `86f0751`, 2026-07-15

## Why this matters

`convex/ingest.ts` exposes a public action `ingestUrl` that fetches an
arbitrary caller-supplied URL directly from the self-hosted Convex backend and
stores the response body. There is no protocol allowlist and no block on
private/loopback/link-local addresses. An authenticated caller can make the
backend issue GET requests to hosts reachable only from its Proxmox network
segment (internal admin ports, cloud metadata endpoints, `localhost` services),
with the response body persisted to `sources.rawText` and returned to the
caller — a server-side request forgery (SSRF) and internal-data exfiltration
channel. A sibling path in the same file (`fetchUrlText`) already routes
through a validation helper (`buildJinaReaderUrl`); `ingestUrl` simply doesn't
use it. This plan closes the gap with a shared guard.

## Current state

- `convex/ingest.ts` — RSS/URL/PDF intake actions. Contains both the vulnerable
  path and the existing validation helper.

The vulnerable fetch (`convex/ingest.ts:435-476`):

```ts
export const ingestUrl = action({
  args: {
    url: v.string(),
    tags: v.optional(v.array(v.string())),
    devBypassSecret: v.optional(v.string()),
  },
  // ...
  handler: async (ctx, args): Promise<{ id: Id<"sources">; created: boolean }> => {
    await requireAuth(ctx, args);
    const urlObj = new URL(args.url);
    const dedupeKey = generateDedupeKey("url", { canonicalUrl: args.url });
    // ...existing dedupe check...
    // Fetch the page
    const response = await fetchWithTimeout(args.url, {   // <-- raw args.url, no guard
      headers: {
        "User-Agent": "ResonantProjects/1.0 (research aggregator)",
      },
    });
```

The existing protocol/credential guard (`convex/ingest.ts:46-62`) — note it does
**not** block private IPs, only scheme and embedded credentials:

```ts
export function buildJinaReaderUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("invalid_url: URL is not valid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid_url: only HTTP and HTTPS URLs are supported");
  }
  if (url.username || url.password) {
    throw new Error("invalid_url: URLs with embedded credentials are rejected");
  }
  return `${JINA_READER_URL}/${url.toString()}`;
}
```

`fetchWithTimeout` is defined at `convex/ingest.ts:15-27` (uses `AbortController`,
30s default). `ingestUrl` fetches the origin **directly** (not via Jina), so you
cannot simply reuse `buildJinaReaderUrl` here — you must add a guard that
validates the raw origin URL and rejects private targets, then fetch the raw
(validated) URL.

**Convex runtime note**: `ingestUrl` is a Convex `action` (non-transactional,
has network access). DNS resolution APIs from Node's `dns` module are **not**
available in the default Convex runtime. The guard must therefore reject based
on hostname/IP-literal parsing of the URL, not on resolving the hostname. This
is a real limitation — document it (see Step 1 comment) so a reviewer knows the
guard blocks IP-literal and obvious-internal-hostname targets, not
DNS-rebinding. That is an accepted, meaningful reduction of the SSRF surface;
full DNS-time re-validation is out of scope (see Maintenance notes).

## Commands you will need

| Purpose         | Command                        | Expected on success        |
|-----------------|--------------------------------|----------------------------|
| Convex tests    | `vp test convex`               | all pass                   |
| Harness tests   | `vp test harness`              | all pass                   |
| Typecheck       | `vp run typecheck:web`         | exit 0 (also typechecks convex via `_generated`) |
| Lint            | `vp run lint:check`            | exit 0                     |

Do NOT run `bunx convex ...` or `vpx convex run ...` — they contact the LIVE
self-hosted backend.

## Scope

**In scope** (the only files you should modify):
- `convex/ingest.ts` — add the guard + apply it in `ingestUrl`
- `convex/ingest.test.ts` (create if absent, else extend) — unit tests for the guard

**Out of scope** (do NOT touch):
- `buildJinaReaderUrl` / `fetchUrlText` — already guarded for their (Jina-proxied)
  use; don't change their behavior.
- `convex/sources.ts` `createFromUrlInput` — a different intake path; if you
  believe it shares the vuln, note it in your report, do not fix it here.
- The `sources` schema and `dedupeKey` computation — unchanged.

## Git workflow

- Branch: `advisor/011-ssrf-guard-ingesturl`
- Commit style matches repo (conventional commits, e.g. `fix(ingest): block private-network URLs in ingestUrl (SSRF)`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add an exported `assertPublicHttpUrl` guard to `convex/ingest.ts`

Add a pure, exported function near `buildJinaReaderUrl` (so it is unit-testable
without the Convex runtime). It must:

1. Parse with `new URL(rawUrl)`; throw `invalid_url: URL is not valid` on failure.
2. Reject any scheme other than `http:`/`https:`.
3. Reject embedded credentials (`url.username || url.password`).
4. Reject a hostname that is an IP literal in a private/loopback/link-local/
   reserved range, or an obviously-internal hostname. Concretely, reject when
   the hostname (lower-cased, brackets stripped for IPv6):
   - equals `localhost` or ends with `.localhost`, `.local`, `.internal`
   - is `0.0.0.0` or `::` or `::1`
   - is an IPv4 literal in `10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`
     (link-local, covers cloud metadata `169.254.169.254`), `172.16.0.0/12`,
     `192.168.0.0/16`, or `100.64.0.0/10` (CGNAT)
   - is an IPv6 literal that is loopback (`::1`), link-local (`fe80::/10`), or
     unique-local (`fc00::/7`, i.e. starts with `fc`/`fd`)
   Throw `blocked_url: refusing to fetch a private or loopback address` for these.
5. Return the validated URL string.

Add a short comment stating the DNS-rebinding limitation (guard is parse-time,
not resolve-time — see the plan's Convex runtime note).

Implement the IPv4 range checks by splitting the dotted-quad into octets
(guarding that all four parse as 0–255 integers); implement IPv6 detection by
checking for `:` in the bracket-stripped hostname and matching the documented
prefixes. Keep it dependency-free (no npm imports) — this runs in the Convex
runtime.

**Verify**: `vp run typecheck:web` → exit 0.

### Step 2: Apply the guard in `ingestUrl`

In the `ingestUrl` handler, immediately after `await requireAuth(ctx, args);`
and before the `new URL(args.url)` / fetch, add:

```ts
const safeUrl = assertPublicHttpUrl(args.url);
```

Then use `safeUrl` (not `args.url`) in the `fetchWithTimeout(...)` call at what
is currently line 466. Leave the dedupe-key computation using `args.url` as-is
(it is not a fetch; `safeUrl` and `args.url` are the same string on the success
path anyway).

**Verify**: `vp run typecheck:web` → exit 0; `grep -n "fetchWithTimeout(args.url" convex/ingest.ts` → no matches.

### Step 3: Write unit tests for the guard

Add tests (see Test plan) asserting the guard accepts public URLs and rejects
each blocked class. These are pure-function tests — no Convex context needed.

**Verify**: `vp test convex` → all pass, including the new guard tests.

## Test plan

- File: `convex/ingest.test.ts` (create if it does not exist; if it exists,
  add a `describe("assertPublicHttpUrl")` block). Model the test file structure
  on an existing pure-function convex test — e.g. `convex/sourceUtils.test.ts`
  (co-located `*.test.ts`, imports the function directly, uses the repo's test
  runner via `vp test convex`). Read that file first to match imports and style.
- Cases to cover:
  - **Accept**: `https://example.com/article`, `http://example.com:8080/x`,
    a public IP literal like `https://93.184.216.34/`.
  - **Reject scheme**: `file:///etc/passwd`, `ftp://example.com`.
  - **Reject credentials**: `https://user:pass@example.com`.
  - **Reject loopback/private**: `http://localhost/`, `http://127.0.0.1/`,
    `http://169.254.169.254/latest/meta-data/`, `http://10.1.2.3/`,
    `http://192.168.1.1/`, `http://[::1]/`, `http://foo.internal/`.
  - **Reject malformed**: `"not a url"`.
- Verification: `vp test convex` → all pass, including the N new cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `vp run typecheck:web` exits 0
- [ ] `vp test convex` exits 0; new `assertPublicHttpUrl` tests exist and pass
- [ ] `vp test harness` exits 0
- [ ] `vp run lint:check` exits 0
- [ ] `grep -n "fetchWithTimeout(args.url" convex/ingest.ts` returns no matches
- [ ] `grep -n "assertPublicHttpUrl" convex/ingest.ts` shows the definition and its use in `ingestUrl`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 011 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `convex/ingest.ts` doesn't match the "Current state" excerpts (drift since this
  plan was written).
- Applying `assertPublicHttpUrl` breaks an existing passing test in an
  unexpected way (e.g. an existing test relies on ingesting a `localhost` URL —
  that would be a real behavior change needing the operator's decision).
- You find the Convex runtime rejects the guard code (e.g. a syntax/runtime API
  you used isn't available) after one reasonable fix attempt.
- You discover `sources.createFromUrlInput` or another action has the same raw
  fetch — note it and STOP rather than expanding scope.

## Maintenance notes

- The guard is **parse-time**, not resolve-time: it blocks IP-literal and
  obvious-internal-hostname targets but not DNS rebinding (a public hostname
  that resolves to a private IP). Closing that fully requires resolving the
  hostname and re-checking at fetch time, which the default Convex runtime's
  lack of `dns` makes awkward — deferred deliberately. If `ingestUrl` is ever
  moved to a `"use node"` action, revisit with a resolve-time check.
- If a new URL-fetching action is added, it must call `assertPublicHttpUrl`
  (or go through `buildJinaReaderUrl`). A reviewer should grep for
  `fetchWithTimeout(` / bare `fetch(` in `convex/` on any ingest-touching PR.
- Reviewer scrutiny: confirm the private-range list is complete (the CGNAT and
  link-local ranges are the easy-to-miss ones) and that IPv6 bracket-stripping
  is handled.
