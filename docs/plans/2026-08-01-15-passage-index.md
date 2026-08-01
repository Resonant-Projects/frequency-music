# Passage Index Foundation + Agent Search Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Found-state rule:** adapt to found state; schemas, interfaces, gates binding.
> **Session decisions (grilling 2026-08-01, Keith):** see `docs/adr/0001-split-embedding-spaces-for-passages.md` and the **Passage** entry in `CONTEXT.md`. This plan is wave one of the passage-retrieval program (foundation + agent tool). Follow-on waves — hypothesis context, extraction full-text fix, recipe context — are **not** in scope here.

**Goal:** Make source prose retrievable. Chunk-index every text-bearing source's full text (`rawText`/`transcript`) into a `@convex-dev/rag` passage index, and expose one bounded agent tool, `searchSourcePassages`, so agents can semantically query the corpus and get back what sources actually *say* — with provenance — instead of only claim assertions.

**Supersedes** plan 04's non-goal "No embedding of sources' raw text" — that exclusion was scoped to the claims/concepts wave, and the 2026-08-01 session explicitly reversed it for passages.

**Tech Stack:** Vite+ (`vpx`), Convex components (`@convex-dev/rag` — same mechanism as workflow/aggregate/action-cache, works self-hosted), AI SDK embedding model `@ai-sdk/openai` → OpenAI `text-embedding-3-large` (3072 dims).

## Global Constraints

- `vpx convex codegen` deploys **and** typechecks against the live deployment — sequence commits accordingly.
- **New dependencies:** `@convex-dev/rag` (latest, 0.7.x at planning time) and `@ai-sdk/openai`. ⚠️ Install the `@ai-sdk/openai` **major whose peerDependencies accept `ai@6`** (the repo runs `ai@^6` with `@ai-sdk/groq@^3` — npm `latest` may target a newer `ai` major; verify at install). Likewise confirm `@convex-dev/rag`'s `convex` peer range accepts `^1.34`.
- **No new env vars:** `OPENAI_API_KEY` already exists in `.env.local` and the Convex deployment (plan 04). The RAG component embeds server-side through the configured AI SDK model.
- **Embedding space (binding, per ADR 0001):** passages use `text-embedding-3-large` @ 3072d. Claims/concepts stay on 3-small/1536d. Never reuse a stored claim/concept vector against the passage index or vice versa — cross-space lookups re-embed *text*.
- **Warn-and-skip doctrine:** passage indexing is scheduled, never inline; an indexing failure must never fail the parent source write (same doctrine as plan 04 embeddings and tracing).
- **Filter design (resolved 2026-08-01):** the component has **no in-place filter-value update** — its only update path is re-`add()` (re-embeds; and short-circuits on unchanged `contentHash`, so filters would *not* refresh). Therefore the index-level filter is `type` only (immutable). `status` is filtered **post-search** against the live source row — never stale by construction. Do not add `status` to `filterNames`.

## Non-goals / rabbit holes

- **No** consumer prompt changes — hypothesis/recipe retrieval context and the extraction 30k-truncation fix are separate follow-on plans.
- **No** custom chunkers — default chunker everywhere; `chunkContext` at query time compensates. Custom chunking only on evidence of failure (session decision Q8).
- **No** migration of claims/concepts embeddings — declared roadmap follow-on (ADR 0001), separate project.
- **No** namespace partitioning — one global `"sources"` namespace (cross-domain search is the mission).
- **No** search UI for humans; the probe script is a developer tool.
- **No** reranking, hybrid search, or importance weighting in v1.

---

### Task 1: Component wiring + RAG client module

**Files:**
- Modify: `package.json` (deps: `@convex-dev/rag`, `@ai-sdk/openai` — see version constraint above), `convex/convex.config.ts` (`app.use(rag)`)
- Create: `convex/passages.ts` — the only module that constructs the RAG client

**Interfaces (binding):**

```typescript
// convex/passages.ts
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";
import { components } from "./_generated/api";

export const PASSAGE_NAMESPACE = "sources";
export const PASSAGE_EMBEDDING_MODEL = "text-embedding-3-large";

export const rag = new RAG(components.rag, {
  textEmbeddingModel: openai.embedding(PASSAGE_EMBEDDING_MODEL),
  embeddingDimension: 3072,
  filterNames: ["type"], // immutable facts only — see Global Constraints
});
```

- [ ] **Step 1:** `vp install`; verify peer-dep compatibility of both packages; wire `convex.config.ts`; codegen; commit.

---

### Task 2: Indexing pipeline (single chokepoint)

**Files:**
- Modify: `convex/passages.ts`
- Modify: text-write sites to schedule indexing (found state governs the exact list; known writers: `convex/sources.ts` `create`/`updateText`/`upsertExternal`/`createScoutedSource`, the HTTP ingest routes in `convex/http.ts`, transcript landing in `convex/fabric.ts`, RSS/article paths in `convex/ingest.ts`)

**Interfaces (binding):**

```typescript
// internal action passages.indexSource
args: { sourceId: Id<"sources"> }
// - text = source.rawText ?? source.transcript; no text → no-op
// - rag.add({
//     namespace: PASSAGE_NAMESPACE,
//     key: sourceId,                        // re-ingest replaces, never duplicates
//     contentHash: rawTextSha256 ?? sha256(text),  // unchanged text → component no-ops
//     title: source.title,
//     filterValues: [{ name: "type", value: source.type }],
//     metadata: { sourceId },
//     text,
//   })
// - replacedEntry non-null → rag.delete the old entry (no replaced-entry accumulation)

// helper schedulePassageIndex(ctx, sourceId)
// ctx.scheduler.runAfter(0, internal.passages.indexSource, { sourceId })
// called from every write site that sets/changes rawText or transcript
```

Deletion hygiene: `sources.deleteById` (and any hard-delete path found in state) must also remove the RAG entry for that key. Archival is a status change — handled by post-search status filtering, not entry deletion.

- [ ] **Step 1:** Harness test — writing text to a source schedules `indexSource` (assert on scheduler, not network); indexing failure does not fail the parent write.
- [ ] **Step 2:** Implement `indexSource` + chokepoint helper; wire all found write sites; codegen; commit.

---

### Task 3: Hygiene sweep cron

**Files:**
- Modify: `convex/passages.ts`, `convex/crons.ts`

Weekly sweep (same belt-and-braces pattern as the plan 02/04 sweeps — fold into the existing hygiene cron if one is shared): paginate text-bearing sources and call `indexSource` for each. Idempotent by design — the `contentHash` short-circuit makes unchanged sources free (no re-embed), so the sweep is cheap and self-healing for any write site we missed.

- [ ] **Step 1:** Implement + cron entry; codegen; commit.

---

### Task 4: Backfill

**Files:**
- Create: `scripts/backfill-passages.ts` (dry-run default; `--apply`)

Scope: **all** text-bearing sources regardless of status (session decision Q4 — no index-time quality gating; consumers filter). Dry run reports source count, total chars, estimated tokens and 3-large cost. `--apply` drives `indexSource` in batches; convergence re-run reports zero pending. Expected cost order: low single-digit dollars for the whole corpus.

- [ ] **Step 1:** Dry run — paste counts + cost estimate in PR.
- [ ] **Step 2:** `--apply`; convergence re-run clean.
- Operator-gated: requires deploy; `OPENAI_API_KEY` must be set in the Convex deployment env.
- [ ] **Step 3:** Commit (report in PR).

---

### Task 5: Agent tool — `searchSourcePassages`

**Files:**
- Modify: `convex/passages.ts` (search action), `convex/agentTools.ts`, `convex/agentToolRegistry.ts`, `convex/shared/agentToolManifest.ts`
- Modify: `docs/agent-tool-surface.md`
- Tests: mirror the existing `searchClaimsSemantic` coverage in `agentTools.test.ts` / `agentToolRegistry.test.ts`

**Interfaces (binding — bounds are session decision Q9):**

```typescript
// agent tool searchSourcePassages (read-only; no draft gating)
args: {
  query: string,
  limit?: number,          // clamp 1..8, default 5
  types?: SourceType[],    // optional filterValues on "type"
}
returns: {
  passages: Array<{
    sourceId, title, canonicalUrl, status,   // hydrated live from the source row
    text: string,                            // hit chunk + chunkContext {before:1, after:1}
    score: number,
    order: number,                           // chunk position within source
  }>
}
// - post-search hydration: fetch source rows by key; DROP archived sources;
//   attach live status (never the at-index-time status)
// - hard response bound: total passage text ≤ 12_000 chars — truncate
//   lowest-scored hits first, never mid-passage silently (mark truncation)
```

Policy update in `docs/agent-tool-surface.md`: the raw-text rule is reworded from "responses omit raw text" to its real intent — **no unbounded document text**. `searchSourcePassages` is the deliberate bounded exception; the `convexTools.ts` strip of `rawText`/`transcript` keys stays in force for every other tool (passage text travels under `text` per hit and is bounded above).

- [ ] **Step 1:** Tests first (registry dispatch, manifest entry, bounds clamping, archived-source exclusion).
- [ ] **Step 2:** Implement; codegen; commit.
- [ ] **Step 3:** Docs: agent-tool-surface.md tool entry + policy rewording; commit.

---

### Task 6: Probe + acceptance

**Files:**
- Create: `scripts/probe-passages.ts` (developer tool, pattern of `probe-embeddings.ts`)

Free-text query → top-8 passages with source titles, scores, and chunk positions. This is the wave gate's verification tool and the follow-on waves' debugging tool.

- [ ] **Step 1:** Run a hand-picked cross-domain query (e.g. a cymatics phrase expected to surface both article prose and a transcript passage); sanity-check by eye; paste results in PR.
- Operator-gated: requires deploy + backfill applied.
- [ ] **Step 2:** Commit.

---

## Done means

- `@convex-dev/rag` mounted; passage index live on the self-hosted deployment; all text-bearing sources indexed (backfill convergence re-run clean, counts in PR).
- Every text write path schedules indexing; weekly sweep exists; source hard-delete removes entries; indexing failure demonstrably never fails a source write (harness test).
- `searchSourcePassages` registered in tool registry + manifest + docs, with bounds enforced (limit ≤8, ±1 chunk context, ≤12k chars, archived excluded) and live-status hydration.
- Probe returns sane cross-domain passages for a hand-picked query (pasted in PR).
- `docs/agent-tool-surface.md` policy reworded to "no unbounded document text."
- ADR 0001 and CONTEXT.md **Passage** entry already landed (commit `00dc06a`) — no doc drift.
