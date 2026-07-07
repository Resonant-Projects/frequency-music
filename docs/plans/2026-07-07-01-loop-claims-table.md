# Claims Become First-Class Rows — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Found-state rule (wave 2026-07-07):** authored pre-arch-wave. Adapt quoted "current" code to found state; schemas, interfaces, and gates are binding.

**Goal:** Promote claims from anonymous array elements inside `extractions` rows to an addressable `claims` table with stable ids and provenance, backfill from all existing extractions, and make the extraction write path emit claim rows going forward. The embedded `extractions.claims` array is kept as a denormalized copy (readers unchanged); the table is the citable identity.

**Why (session decision Q6):** correspondences cite claims as evidence; `(extractionId, claimIndex)` tuples silently corrupt on re-extraction; embeddings (plan 04) need claims in a table; per-claim analytics ("which claims support the most correspondences") need addressability.

**Tech Stack:** Bun, Convex (self-hosted), bun:test, convex-test harness (arch plan 04).

## Global Constraints

- Bun runtime everywhere; `bunx convex codegen` is the typegate **and deploys live** — commit only coherent states.
- Any schema change mirrors into `convex/validators.ts` (or the arch-wave `convex/shared/` location if that's the found state).
- Data is archived/superseded, never deleted. Re-extraction does not delete old claim rows; it marks them superseded.
- Backfill follows the batched, dry-run-first, pagination-cursor pattern proven by `scripts/migrate-dedupe-keys.ts` (arch plan 01).

## Non-goals / rabbit holes

- **No** reader migration: everything currently reading `extractions.claims` keeps doing so this wave. The table is for *new* consumers (plans 03–05).
- **No** cross-source claim dedupe ("two sources assert the same thing") — future curation work, not this plan.
- **No** claim editing UI or human claim curation.
- **No** embedding computation (plan 04 owns it; this plan only declares the fields).

---

### Task 1: Schema — the `claims` table

**Files:**
- Modify: `convex/schema.ts` (+ validator mirror in the found-state location)

**Interfaces (binding):**

```typescript
claims: defineTable({
  extractionId: v.id("extractions"),
  sourceId: v.id("sources"),          // denormalized for one-hop source lookups
  ordinal: v.number(),                 // position within the producing extraction
  text: v.string(),
  evidenceLevel: evidenceLevelValidator,        // reuse the existing shared validator
  truthConfidence: v.optional(confidenceBandValidator),
  interestLevel: v.optional(confidenceBandValidator),
  citations: v.array(
    v.object({
      label: v.optional(v.string()),
      url: v.optional(v.string()),
      quote: v.optional(v.string()),
    }),
  ),
  // Lifecycle: a re-extraction supersedes the previous extraction's claims.
  status: v.union(v.literal("active"), v.literal("superseded")),
  supersededBy: v.optional(v.id("claims")),
  // Plan 04 fills this; declared here so the backfill doesn't need a second migration.
  embedding: v.optional(v.array(v.float64())),
  embeddingModel: v.optional(v.string()),
  createdBy: v.union(v.id("users"), v.literal("system")),
  createdAt: v.number(),
})
  .index("by_extractionId_ordinal", ["extractionId", "ordinal"])
  .index("by_sourceId", ["sourceId"])
  .index("by_status", ["status"])
```

Note: `evidenceLevelValidator`/`confidenceBandValidator` are currently file-local `const`s in `schema.ts` — export them (or import from `convex/shared/` if the arch wave moved them).

- [ ] **Step 1:** Add the table + export the two validators. Mirror into validators file per found-state convention.
- [ ] **Step 2:** `bunx convex codegen` — green, deployed.
- [ ] **Step 3:** Commit: `feat(schema): claims table — addressable knowledge atoms`

---

### Task 2: Write path — extraction emits claim rows

**Files:**
- Modify: `convex/extractInternal.ts` (`storeExtraction`, the `ctx.db.insert("extractions", ...)` site)
- Test: harness test alongside (found-state harness location from arch plan 04)

**Interfaces:**
- `storeExtraction` inserts the extraction row (unchanged), then inserts one `claims` row per element of the claims array with matching `ordinal`, `status: "active"`, and the extraction's `createdBy`/`createdAt`.
- On re-extraction of the same source (existing `inputHash`/versioning semantics — follow found state): mark the prior extraction's active claims `status: "superseded"` before inserting the new set. Do not set `supersededBy` per-claim (no reliable old↔new pairing); the field is for future curation tools.

- [ ] **Step 1: Failing harness test** — store an extraction with 3 claims → 3 active claim rows, ordinals 0..2, correct provenance; store a second extraction for the same source → first 3 become superseded.
- [ ] **Step 2:** Implement in `storeExtraction`.
- [ ] **Step 3:** Tests pass; `bunx convex codegen`; commit.

---

### Task 3: Backfill migration — mutation + driver script

**Files:**
- Modify: `convex/extractions.ts` (append `backfillClaims` mutation)
- Create: `scripts/backfill-claims.ts`

**Interfaces:**

```typescript
// api.extractions.backfillClaims
args: { cursor: string | null, batchSize?: number, apply: boolean, devBypassSecret?: string }
returns: { processed: number; claimsInserted: number; skippedExisting: number;
           isDone: boolean; continueCursor: string }
```

**Design notes:**
- Idempotent: skip an extraction if any `claims` row with its `extractionId` already exists (`by_extractionId_ordinal` first-hit check). Re-runnable after partial failure.
- Batches small (default 10 — extractions carry long summaries and claim arrays; respect transaction read limits).
- Claims from extractions that have a *newer* extraction for the same source are inserted as `status: "superseded"`, others as `"active"` (mirror Task 2's semantics so backfilled and live data agree).
- Driver script: dry-run default, `--apply` to execute, totals + convergence re-run reporting, same shape as `scripts/migrate-dedupe-keys.ts`.

- [ ] **Step 1:** Implement mutation + script.
- [ ] **Step 2:** Dry run — planned insert count should ≈ Σ claim-array lengths (compare against a one-off count query). Investigate any large gap before applying.
- [ ] **Step 3:** `--apply`, then re-run dry: zero planned inserts (convergence).
- [ ] **Step 4:** Commit.

---

### Task 4: Read surface for downstream plans

**Files:**
- Modify: `convex/extractions.ts` (or a new `convex/claims.ts` if size warrants — prefer a new module; this table gets its own consumers)

**Interfaces (consumed by plans 03, 04, 05):**

```typescript
// claims.listByExtraction  { extractionId } → claim rows (ordinal order)
// claims.listBySource      { sourceId, includeSuperseded? } → claim rows
// claims.getMany           { ids: Id<"claims">[] } → claim rows (order-preserving, nulls dropped)
```

All queries: public, `requireAuth` with `devBypassSecret` per repo convention; `returns:` validators mirror the table shape.

- [ ] **Step 1:** Implement + harness tests (empty, ordered, superseded-filtering cases).
- [ ] **Step 2:** `bunx convex codegen`; commit.

---

## Done means

- `claims` table live; count ≈ Σ embedded claim-array lengths (spot-check with a one-off query).
- A fresh `extract:extractSource` run produces claim rows with correct ordinals and provenance.
- Backfill converges (second dry run plans zero inserts).
- Harness tests cover: write path, supersession, backfill idempotency, read surface.
- Embedded `extractions.claims` arrays untouched — no reader of the old shape broke.
