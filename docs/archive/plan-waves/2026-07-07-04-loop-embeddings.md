# Embeddings + Vector Indexes — Implementation Plan

> **Archived 2026-08-03:** implementation merged in PR #28 (`4622c2b`). Remaining live backfill/probe acceptance is tracked in `docs/plans/README.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Found-state rule (wave 2026-07-07):** adapt to found state; schemas, interfaces, gates binding. **Prerequisites: plan 01 (claims rows exist), plan 02 (relevance flags exist — they're filter fields).**

**Goal:** Embed on-mission claims and concepts into Convex-native vector indexes so plan 05's candidate generator can ask the load-bearing query: *semantically near, domain-far*. One embedding module, batched backfill, incremental embedding on write.

**Session decision (Q8):** embeddings propose, symbolic features score, LLM judges. Keith explicitly accepted the embedding dependency and Convex-native vector indexes.

**Tech Stack:** Bun, Convex vector search (`ctx.vectorSearch`, actions-only), OpenAI `text-embedding-3-small` (1536 dims).

## Global Constraints

- Bun; `bunx convex codegen` deploys live.
- **New external dependency + env var:** `OPENAI_API_KEY` (OpenRouter does not serve embeddings). Add to `.env.local` contract and Convex deployment env. Embedding calls follow the tracing-is-best-effort doctrine: failures warn and skip, never fail the parent write.
- Model id is recorded per-row (`embeddingModel`) — a future model change is a re-embed migration, not a silent mix.
- Only on-mission content is embedded (cost + index hygiene). Off-mission claims/concepts simply have no embedding.

## Non-goals / rabbit holes

- **No** hybrid search, reranking, or embedding-model evaluation — `text-embedding-3-small` v1, measure via plan 05's candidate quality, iterate only on evidence.
- **No** semantic search UI for humans — the probe script is a developer tool.
- **No** embedding of sources' raw text or summaries — claims and concepts only.
- **No** candidate generation (plan 05 owns the "near but far" query; this plan just makes it possible).

---

### Task 1: Schema — vector indexes

**Files:**
- Modify: `convex/schema.ts`

**Interfaces (binding):**

```typescript
// claims table (fields already declared by plan 01): add
.vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 1536,
  filterFields: ["status", "sourceId"],
})

// concepts table: add fields + index
embedding: v.optional(v.array(v.float64())),
embeddingModel: v.optional(v.string()),
.vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 1536,
  filterFields: ["missionRelevance", "domain"],
})
```

Claim on-mission-ness is derived from its source's concepts at candidate time (claims don't carry `missionRelevance`; filtering claims happens in the generator, plan 05). If found-state Convex version limits filterFields, keep `missionRelevance` on concepts and drop the rest — the generator over-fetches and filters in code.

- [x] **Step 1:** Schema + codegen; commit.

---

### Task 2: Embedding module

**Files:**
- Create: `convex/embeddings.ts` ("use node" action module, or per the arch-wave `llmNode.ts` split convention)

**Interfaces (binding):**

```typescript
// internal action embedTexts
args: { texts: string[] }            // ≤100 per call (OpenAI batch limit headroom)
returns: { embeddings: number[][], model: string }

// internal action embedClaims  { claimIds } — fetch texts, embed, patch rows
// internal action embedConcepts { conceptIds } — text = displayName + description + aliases
```

One module owns the API call, batching, retry-with-backoff, and the warn-and-skip failure mode. Nothing else imports the OpenAI client.

- [x] **Step 1:** Implement with a unit-testable pure text-assembly helper (concept text composition is the only logic worth testing without the network).
- [x] **Step 2:** Codegen; commit.

---

### Task 3: Backfill

**Files:**
- Create: `scripts/embed-backfill.ts` (dry-run default: counts + cost estimate; `--apply`)

Scope: active claims whose source links ≥1 on-mission concept (query via edges/graph per found state — if that linkage is awkward, v1 fallback: embed **all** active claims; ~5–10k × trivial per-token cost, still under a dollar) + all on-mission concepts. Idempotent: skips rows with `embedding` set and matching `embeddingModel`.

- [ ] **Step 1:** Dry run — report counts and estimated cost.
- [ ] **Step 2:** `--apply`; convergence re-run reports zero pending.
- Operator-gated: deploy required for both dry-run and `--apply`; `OPENAI_API_KEY` required only for `--apply`.
- [x] **Step 3:** Commit (report in PR).

---

### Task 4: Incremental embedding on write

**Files:**
- Modify: `convex/extractInternal.ts` (after claim-row insert, schedule `embedClaims`)
- Modify: concept-creation path (plan 02's classifier completion schedules `embedConcepts` for newly on-mission concepts)

Scheduled (`ctx.scheduler.runAfter(0, ...)`), never inline — extraction must not block or fail on the embedding service. A weekly cron sweeps rows missing embeddings (same belt-and-braces pattern as plan 02's classification sweep; can be one shared "hygiene" cron).

- [x] **Step 1:** Harness test — storing an extraction schedules embedding (assert on scheduler, not the network).
- [x] **Step 2:** Implement; codegen; commit.

---

### Task 5: Probe query (acceptance harness for plan 05)

**Files:**
- Create: `scripts/probe-embeddings.ts`

Given a claim id (or free text), run `ctx.vectorSearch` (via a small internal action) and print the top-10 nearest claims with source titles and their concepts' domains. This is the wave gate's verification tool and plan 05's debugging tool.

- [ ] **Step 1:** Implement; run against a hand-picked cymatics claim; sanity-check neighbors by eye (expect: acoustics/wave-physics claims near; ASR noise absent because unembedded).
- Operator-gated: requires deploy; `OPENAI_API_KEY` needed for free-text probes or when no current stored claim embedding can be reused (claim-id probes reuse stored embeddings).
- [x] **Step 2:** Commit.

---

## Done means

- Vector indexes live on claims + concepts; coverage ≥95% of in-scope rows; convergence re-run clean.
- Probe returns sane neighbors for a hand-picked claim (result pasted in PR).
- Extraction and concept-classification write paths schedule embeddings; hygiene sweep exists.
- `OPENAI_API_KEY` documented in env contract; embedding failure demonstrably does not fail extraction (harness test).
