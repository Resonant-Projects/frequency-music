# Concept Domains + Mission Relevance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Found-state rule (wave 2026-07-07):** authored pre-arch-wave. Adapt quoted "current" code to found state; schemas, interfaces, and gates are binding. **Hard prerequisite: arch plan 2026-07-03-03 (shared LLM module) — the classifier calls it.**

**Goal:** Make "cross-domain" real. Today 3,975 of 4,000 sampled concepts sit in domain `"general"` and the top concepts by mention are arXiv ML-engineering vocabulary. This plan seeds the `conceptDomains` registry with the research program's domains, adds a `missionRelevance` flag to concepts, runs an LLM classification backfill over all concepts, classifies at concept-creation going forward, and removes the six dead feeds.

**Why (session decisions Q7, Q11):** correspondence identity requires domains that exist; the miner must run only over the on-mission core or it drowns in junk pairs ("mamba architecture ↔ ayurvedic medicine"). The arXiv feeds stay — their concepts auto-flag off-mission.

**Tech Stack:** Bun, Convex (self-hosted), shared LLM module (`convex/llm.ts` / `llmNode.ts`), bun:test.

## Global Constraints

- Bun runtime; `bunx convex codegen` deploys live — coherent commits only.
- Classification is agent/AI-written data on a human-curated registry: the classifier may only assign domains that exist in `conceptDomains`; unknown proposals go to `provisional` registry rows, never free-text.
- Sonnet-class model for the backfill (per repo model doctrine: Sonnet for automated bulk work). Never Llama.

## Non-goals / rabbit holes

- **No** ontology redesign: the 14 seeded domains are the v1 taxonomy; refining it is registry curation, not code.
- **No** re-extraction or topic changes on sources/extractions — this plan touches concepts only.
- **No** classification review UI — the `unreviewed` bucket + spot-check protocol is the whole human loop this wave.
- **No** new feeds (plan 09 scouts them); this plan only disables dead ones.

---

### Task 1: Schema — `missionRelevance` on concepts

**Files:**
- Modify: `convex/schema.ts` (+ validator mirror)

**Interfaces (binding):**

```typescript
// added to concepts table
missionRelevance: v.optional(
  v.union(v.literal("on"), v.literal("off"), v.literal("unreviewed")),
),
relevanceRationale: v.optional(v.string()),   // one sentence from the classifier
classifiedAt: v.optional(v.number()),
classifierModel: v.optional(v.string()),
// new index
.index("by_missionRelevance", ["missionRelevance"])
```

`domain` (primary) and `domains` (multi) already exist on the table — the backfill populates them; no shape change needed there. Optional-with-`"unreviewed"`-default keeps the migration additive.

- [ ] **Step 1:** Schema + mirror + `bunx convex codegen`; commit.

---

### Task 2: Seed the `conceptDomains` registry

**Files:**
- Create: `scripts/seed-concept-domains.ts` (idempotent upsert by `name`)

The domain list (from the research program, CLAUDE.md "Research Domains", plus two capture buckets):

`microtuning` · `geometric-music-theory` · `psychoacoustics` · `wave-physics` · `mathematical-music-theory` · `sacred-geometry` · `consciousness-sound` · `biofield` · `sound-healing` · `cymatics` · `earth-energy` · `music-production` · `ml-audio-engineering` (off-mission capture) · `general-science` (off-mission capture)

Each row: `status: "known"`, `description` (one line), `introducedBy: "system"`. The two capture buckets exist so off-mission concepts still get an honest domain instead of `general`.

- [ ] **Step 1:** Write + run the seeder; verify with `bunx convex run vocabulary:...` list per found-state API.
- [ ] **Step 2:** Commit.

---

### Task 3: Classifier action

**Files:**
- Create: `convex/conceptClassifier.ts` (internal action + public batched mutation for writes)

**Interfaces (binding):**

```typescript
// internal action classifyConceptBatch
args: { conceptIds: Id<"concepts">[], model?: string }
// For each concept: input = displayName, aliases, description, top co-mentioned concept names (cheap
// context from edges), and the registry's domain list with descriptions.
// Output per concept (structured, zod-validated via the shared LLM module's structured-output path):
{ domains: string[],           // 1..3 registry names, first = primary
  missionRelevance: "on" | "off",
  rationale: string }          // one sentence
```

**Design notes:**
- Batch 10–20 concepts per LLM call (they're short); the action loops calls and writes via an internal mutation.
- Registry enforcement in code, not prompt trust: any returned domain not in the registry → concept marked `missionRelevance: "unreviewed"` with rationale `"classifier proposed unknown domain: X"` for human sweep. Do not auto-create registry rows.
- Idempotent: skips concepts with `classifiedAt` set unless `--force`.

- [ ] **Step 1:** Failing harness test for the write mutation (registry enforcement, unreviewed fallback).
- [ ] **Step 2:** Implement action + mutation via shared LLM module.
- [ ] **Step 3:** Tests pass; codegen; commit.

---

### Task 4: Backfill driver + human spot-check

**Files:**
- Create: `scripts/classify-concepts.ts` (dry-run default; `--apply`; `--force`; progress + cost report)

- [ ] **Step 1:** Dry run on 30 concepts, print proposed classifications, eyeball them.
- [ ] **Step 2:** `--apply` full backfill (≈4,000+ concepts ⇒ ~200–400 LLM calls at batch 10–20).
- [ ] **Step 3: Human spot-check (Keith).** Sample 50 concepts stratified: top-25 by mention + 25 random. Record accuracy in the PR. **Gate: <5% of on-mission concepts still in `general`; misclassification pattern (if any) documented.** This is the session's named human-owned task — do not self-certify.
- [ ] **Step 4:** Commit.

---

### Task 5: Classify at concept creation

**Files:**
- Modify: `convex/graph.ts` (`upsertConcept` path and/or `linkExtractionConcepts` — follow found state for where concepts are created)

New concepts default `missionRelevance: "unreviewed"` at insert; the creating action schedules `classifyConceptBatch` (via `ctx.scheduler.runAfter(0, ...)`) so classification is asynchronous and never blocks extraction. A small cron (or the existing scheduler pattern per found state) sweeps `unreviewed` concepts older than an hour into a classification batch — belt and braces for scheduler failures.

- [ ] **Step 1:** Harness test — creating a concept leaves it `unreviewed` and schedules classification.
- [ ] **Step 2:** Implement; codegen; commit.

---

### Task 6: Remove the six dead feeds

**Files:** none (operational; transcript in PR)

The CLAUDE.md TODO, finally: remove/disable the feeds that permanently 404/410/500 — 3Blue1Brown, Adam Neely, David Bennett Piano, CymaScope, Robert Edward Grant (YouTube), Sound on Sound. Archive-don't-delete doctrine: set `enabled: false` with a `metadata.disabledReason`, don't remove rows.

- [ ] **Step 1:** Verify each is actually dead (one poll attempt each — evidence, not memory).
- [ ] **Step 2:** Disable with reasons; update CLAUDE.md's feed list note; commit.

---

## Done means

- Registry seeded with the 14 domains; seeder idempotent.
- Backfill applied; spot-check gate met and recorded (<5% on-mission `general`; accuracy noted).
- `by_missionRelevance` queryable: on-mission core is a few hundred concepts, not 4,000.
- New concepts classify automatically; none stuck `unreviewed` >1h in a live test.
- Dead feeds disabled with reasons; cron logs no longer show their failures.
