# Plan 004: Characterization tests for the untrusted-input parsers (RSS XML, LLM JSON output)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a30f10c..HEAD -- convex/ingest.ts convex/extract.ts`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition (see especially STOP condition 1 —
> the LLM-module refactor plan touches `extract.ts`).

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (test-only, plus two export-keyword edits and one pure-function extraction)
- **Depends on**: none (lands best before/with plan 003's CI so the new tests are enforced)
- **Category**: tests
- **Planned at**: commit `a30f10c`, 2026-07-07

## Why this matters

The three places where external, potentially adversarial data enters the
system are exactly the ones with zero tests: the regex-based RSS/Atom parser
in `convex/ingest.ts` (fed by 18 configured feeds, polled by cron every 6
hours), and the JSON-extraction-from-LLM-response logic in `convex/extract.ts`
(fed by whatever a model returns). A malformed feed or a chatty model response
fails silently in production. These are pure-ish functions testable today with
`bun test` — no Convex harness needed (the ctx-seam harness is a separate,
already-planned effort: `docs/plans/2026-07-03-04`). This plan makes them
importable and characterizes their behavior, including the regex-group accesses
that `noUncheckedIndexedAccess` can't protect at runtime.

## Current state

- `convex/ingest.ts:48` — `function parseRSSXML(xml: string): ParsedFeed`
  (module-private). Regex-based; notable behaviors to characterize:
  - Feed title: `xml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)`,
    falls back to `"Unknown Feed"`.
  - Items: alternating regex for `<item>` (RSS) and `<entry>` (Atom);
    `const itemXml = match[1] || match[2];`
  - Per-item fields: title, link (element text OR `href` attribute), pubDate
    (`pubDate`/`published`/`updated`), description (`description`/`summary`),
    guid (`guid`/`id`), content (`content:encoded`/`content`), each with
    optional CDATA unwrapping.
  - Items lacking title or link are skipped (`if (title && link)`).
- `convex/ingest.ts:104` — `function stripHtml(html: string): string`
  (module-private): strips tags, decodes `&nbsp; &amp; &lt; &gt;` (and possibly
  more — read the full function before writing tests).
- `convex/extract.ts:234-239` — inline in the extract action:
  ```ts
  const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON from response");
  }
  const extraction: ExtractionResult = JSON.parse(jsonMatch[0]);
  ```
  Greedy match from first `{` to last `}` — model prose around the JSON is
  tolerated, but trailing prose containing `}` is included (characterize this).
- `convex/extract.ts:142` region — `parseConfidenceBand` (read it; test its
  mapping and its unknown-input fallback).
- Test conventions: bun:test, `describe`/`test`/`expect` — exemplar:
  `convex/sourceUtils.test.ts` (imports named exports directly from the
  sibling module). Test command: `bun test convex/*.test.ts` (59 pass at
  `a30f10c`, ~80ms).
- Vocabulary (`CONTEXT.md`): a "Source" is the research input; "Extraction" is
  the AI-distilled structured reading (claims/parameters/topics). Use these
  terms in test names.
- **Standing constraint**: do not run `bunx convex codegen` / `dev` / `deploy`
  (live backend). Adding `.test.ts` files and `export` keywords requires none
  of them.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `bun test convex/*.test.ts` | 59 + new, 0 fail |
| Only the new files | `bun test convex/ingest.test.ts convex/extract.test.ts` | all pass |
| Typecheck | `bunx tsc --noEmit -p tsconfig.json` | exit 0 |
| Lint (check-only) | `bunx oxlint convex/ --tsconfig tsconfig.json` | exit 0 |

## Scope

**In scope** (the only files you should modify/create):
- `convex/ingest.ts` — ONLY adding `export` to `parseRSSXML` and `stripHtml`
  (and their types if needed, e.g. `ParsedFeed`, `RSSItem`).
- `convex/extract.ts` — ONLY extracting the parse logic into an exported pure
  function (Step 2); no behavior change.
- `convex/ingest.test.ts` (create)
- `convex/extract.test.ts` (create)

**Out of scope** (do NOT touch):
- Fixing any parser bug you discover — characterize actual behavior with a
  `// BUG:`-annotated test and report it. Behavior changes belong to a
  follow-up with its own review.
- `convex/http.ts` route handlers — they need the ctx-seam harness
  (`docs/plans/2026-07-03-04`); testing them here would duplicate that plan.
- Dedupe-key logic (`convex/sourceUtils.ts`) — already tested, and owned by
  `docs/plans/2026-07-03-01`.
- Prompt content, model selection, retry logic in `extract.ts`.

## Git workflow

- Branch: `advisor/004-parser-characterization-tests`
- Conventional commits, e.g. `test(ingest): characterize RSS/Atom parser edge cases`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Export the ingest parsers

In `convex/ingest.ts`, add `export` to `parseRSSXML`, `stripHtml`, and any type
they need (`ParsedFeed`, `RSSItem`). No other edits.

**Verify**: `bunx tsc --noEmit -p tsconfig.json` → exit 0.

### Step 2: Extract the LLM-response parser into a pure function

In `convex/extract.ts`, add near the top (module scope):

```ts
export function parseExtractionJson(assistantMessage: string): ExtractionResult {
  const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON from response");
  }
  return JSON.parse(jsonMatch[0]) as ExtractionResult;
}
```

Replace the inline block at `:234-239` with
`const extraction = parseExtractionJson(assistantMessage);`. Byte-for-byte the
same regex and error message — this is a lift, not a change. Also add `export`
to `parseConfidenceBand` if it lacks it.

**Verify**: `bunx tsc --noEmit -p tsconfig.json` → exit 0.
**Verify**: `bun test convex/*.test.ts` → 59 pass (no regressions before new tests land).

### Step 3: Write `convex/ingest.test.ts`

Model on `convex/sourceUtils.test.ts`. Build small inline XML fixtures (template
literals). Required cases — assert what the code ACTUALLY does (run and observe,
then pin):

1. Minimal valid RSS: 1 `<item>` with title/link/pubDate/description/guid →
   parsed fields, feed title correct.
2. Atom variant: `<entry>`, `<link href="...">`, `<published>`, `<summary>`,
   `<id>` → parsed equivalently.
3. CDATA wrapping on title/description → unwrapped.
4. Item missing `<link>` → item skipped, no throw.
5. Empty string input → `{ title: "Unknown Feed", items: [] }`, no throw.
6. Malformed/truncated XML (e.g. unclosed `<item>`) → no throw; pin whatever it
   returns.
7. `content:encoded` preferred/available as `content`.
8. Multiple items → all returned, order preserved.
9. `stripHtml`: tags removed, entities decoded, `<script>alert(1)</script>hi` →
   pinned output (documents that script CONTENT survives tag-stripping if it
   does — likely, given the regex — annotate `// BUG:`/`// NOTE:` accordingly).

### Step 4: Write `convex/extract.test.ts`

Required cases:

1. Pure JSON response → parsed object round-trips.
2. JSON wrapped in prose ("Here is the extraction: {...} Hope that helps") —
   note: trailing prose after the final `}` is fine, but if the prose itself
   contains `}` the greedy match includes it → pin actual behavior (likely a
   `JSON.parse` throw; annotate `// NOTE: greedy-match limitation`).
3. Markdown-fenced JSON (```` ```json {...} ``` ````) → pin actual behavior.
4. No JSON at all → throws `"Could not parse JSON from response"`.
5. `{}` empty object → parses (schema validation is downstream's job — pin that
   this function does NOT validate shape).
6. `parseConfidenceBand`: each valid band value; unknown string → pinned
   fallback; undefined/empty → pinned fallback.

**Verify (Steps 3–4)**: `bun test convex/ingest.test.ts convex/extract.test.ts` → all pass.

### Step 5: Full check

**Verify**: `bun test convex/*.test.ts` → 59 + new (expect ~15 new), 0 fail.
**Verify**: `bunx oxlint convex/ --tsconfig tsconfig.json` → exit 0.
**Verify**: `git status --short` → only the four in-scope files.

## Test plan

This plan IS the test plan — see Steps 3–4 for the enumerated cases. Pattern
file: `convex/sourceUtils.test.ts`. Every surprising behavior gets pinned with
a comment rather than fixed; list all `// BUG:` annotations in your final
report so they can become findings.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `convex/ingest.test.ts` and `convex/extract.test.ts` exist with ≥9 and ≥6 tests respectively
- [ ] `bun test convex/*.test.ts` → 0 fail
- [ ] `bunx tsc --noEmit -p tsconfig.json` → exit 0
- [ ] `git diff convex/extract.ts` shows the parse block replaced by a call to `parseExtractionJson` and no other logic change
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

1. `convex/extract.ts` no longer contains the `jsonMatch` block near line 234 —
   `docs/plans/2026-07-03-03` (LLM module) has likely landed and moved response
   parsing into `convex/llm.ts`/`llmNode.ts`. The tests are still wanted, but
   they must target the new module; report and await re-scoping.
2. Exporting `parseRSSXML`/`stripHtml` breaks typecheck (name collision or
   circular import) — do not restructure `ingest.ts` to work around it.
3. A characterization test cannot be made deterministic (parser output varies
   run-to-run) — that itself is a finding; report it.
4. You find yourself wanting to "fix" the parser to make a test nicer — that
   is explicitly out of scope; pin actual behavior.

## Maintenance notes

- These are characterization tests: they pin CURRENT behavior, bugs included.
  When someone later fixes a pinned `// BUG:` case, they must flip that
  assertion in the same PR — reviewers should treat a flipped pin as the proof
  the fix works.
- When the LLM-module refactor (`docs/plans/2026-07-03-03`) lands, move
  `parseExtractionJson` (and its tests' import path) into the new module rather
  than leaving a stray export on `extract.ts`.
- The RSS parser being regex-based is a known simplification. If a real feed
  breaks it in a way these tests don't cover, add the failing feed's XML as a
  fixture case before fixing — that's the regression loop this plan sets up.
- HTTP-route tests remain the gap (deliberately) until the ctx-seam harness
  plan (`docs/plans/2026-07-03-04`) lands.
