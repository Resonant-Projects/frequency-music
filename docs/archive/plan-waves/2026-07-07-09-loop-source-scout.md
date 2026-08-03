# Source Scout — Need-Directed Discovery — Implementation Plan

> **Archived 2026-08-03:** implementation merged in PR #35 (`073cb94`). Remaining first-live-run acceptance is tracked in `docs/plans/README.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps track progress.
> **Found-state rule (wave 2026-07-07):** adapt to found state; interfaces and gates binding. **Prerequisites: plans 02 (domain census), 03 (conjectures), 05 (worker patterns to copy).**

## Executor brief

- Build the **Source Scout** graph (`CONTEXT.md` term): discovery driven by the graph's own gaps — under-represented on-mission domains and evidence-starved conjectures become search queries.
- Individual sources **direct-ingest** with agent provenance (the source status pipeline is their review structure). New recurring **feeds are proposals** — disabled rows a human enables from the brief.
- Web search is a new agent capability: pick ONE provider, wrap it as one tool.

**Why (session Q11–Q12 + Keith's addendum):** "part of what I want assistance with is finding more relevant and diverse sources to be ingesting." Scouting is need-directed, not generic discovery.

**Tech Stack:** LangGraph TS, one search API (decide at execution: Tavily or Exa — pick whichever has a key available; record the choice in `docs/decision-log.md` as an ADR-lite line), existing HTTP ingest routes / `sources.createFromUrlInput` per found state.

## Global Constraints

- New env var for the search provider — document in env contract; search failures warn-and-skip.
- Scouted sources enter through the **canonical intake path** (dedupe contract from arch plan 01) — never a bespoke insert. Provenance: `createdBy: "system"` + `metadata.scoutedBy: { agentRunId, query, rationale }` (follow found-state metadata conventions).
- Scouted feeds: insert with `enabled: false` + `metadata.proposal: { agentRunId, rationale, sampleItems }`. The scout NEVER sets `enabled: true`.
- Rate-limit courtesy: ≤10 search calls per run, ≤5 ingests per run (constants in the graph config).

## Non-goals / rabbit holes

- **No** multi-provider search abstraction — one provider, one tool.
- **No** full-text fetching in the scout (existing fetch scripts/pipeline own that; the scout ingests metadata + URL and lets the standard pipeline take over).
- **No** relevance ML — the judge node's structured verdict is the filter.
- **No** touching the arXiv feed decision (session Q11: they stay, off-mission flagging handles them).

---

### Task 1: Gap census query

**Files:**
- Create: query in `convex/correspondences.ts` or `convex/graph.ts` (found-state fit): `scoutTargets`

**Interfaces (binding):**

```typescript
// scoutTargets → the graph's needs list
returns: {
  thinDomains: Array<{ domain: string, onMissionConceptCount: number,
                       sourceCount: number }>,            // bottom-5 by sourceCount
  starvedConjectures: Array<{ correspondenceId, statement,
                              conceptA: string, conceptB: string,
                              evidenceCount: number }>,   // oldest, ≤5
}
```

- [x] **Step 1:** Harness test with fixtures; implement; expose read-only via tool registry (`get_scout_targets`); commit.
  - Operator-gated: Convex codegen was not run per the 2026-07-20 executor constraint. The query was added to the existing `correspondences` module, so `_generated/api.d.ts` already derives it through the module type and needs no hand edit.

---

### Task 2: Search tool

**Files:**
- Create: `agent/src/tools/searchTool.ts` (provider call lives agent-side — it needs Node fetch + the provider SDK; no Convex round-trip for search)

**Interfaces (binding):** `web_search { query, maxResults? } → Array<{ title, url, snippet, publishedAt? }>`. Provider choice + key documented; tool logs each call as a `tool_call` run event.

- [x] **Step 1:** Implement with a recorded-fixture test (no live network in tests); typegate; commit.

---

### Task 3: Scout graph

**Files:**
- Create: `agent/src/graphs/source-scout/{index,nodes,prompts,state}.ts`; worker registration; cron (weekly, offset from miner).

**Graph shape (binding):**

```
fetch_targets ──► plan_queries (LLM: targets → ≤10 concrete queries, each tagged with
                  its motivating gap) ──► search_loop ──► judge_results
──► split:
     candidate sources (≤5) ──► ingest_tool (canonical intake; dedupe rejects logged, not retried)
     candidate feeds  (RSS/YouTube discovered) ──► propose_feed_tool (enabled:false + proposal metadata)
──► summarize (what was ingested/proposed and WHY — rationale strings are the brief's raw material)
```

**Judge verdict (zod, binding):** `{ kind: "source" | "feed" | "discard", relevanceNote: string, targetGap: string, evidenceLevelGuess?: string }` — the prompt carries the mission framing and the *specific gap* each query came from; generic sound/ML content is a discard with reason.

**New write tools to register (zod-first):** `ingest_scouted_source`, `propose_feed` — thin wrappers on canonical intake + feed insert with the provenance shapes above.

- [x] **Step 1:** Agent tests: judge schema; ingest wrapper hits canonical intake (mock); feed proposal never sets enabled.
- [x] **Step 2:** Implement; typegate; commit.

---

### Task 4: Brief hookup + live gate

> Deferred in the 2026-07-20 executor scope: plan 08 is being built in parallel. No live Convex commands were run; the entire live gate remains operator-gated.

**Files:**
- Modify: plan 08's `proposedFeeds` section query — populate from `feeds` where `enabled === false && metadata.proposal` exists.

- [ ] **Step 1:** Implement + harness test; codegen; commit.
- [ ] **Step 2: Live gate.** One scout run: ≥1 source ingested with scout provenance (visible in the run's audit trail and the source's metadata), ≥1 feed proposed (still disabled), both with gap-tagged rationale. Proposed feed appears in the next generated brief. Paste run summary in PR.

---

## Done means

- Gap census drives queries (every search logged with its motivating gap).
- Scouted sources flow through canonical intake; dedupe protects against re-ingestion; provenance complete.
- Feed proposals are enable-only-by-human; brief surfaces them.
- Search provider choice recorded; caps enforced; tests green.
