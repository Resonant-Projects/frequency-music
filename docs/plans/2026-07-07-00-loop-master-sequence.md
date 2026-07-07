# 00 — Master Sequence: Knowledge Loop Wave (Correspondence Layer)

> **For agentic workers:** This is the index and sequencing contract for plans 2026-07-07-01 through 11. Do not implement from this file; implement from the numbered plans, in gate order. Each numbered plan requires the superpowers:subagent-driven-development or superpowers:executing-plans sub-skill.

**Goal:** Close the gap between capture and synthesis. The 2026-07-07 grilling session (recorded in `docs/decision-log.md`) diagnosed the system's failure as synthesis + agent productization: 1,580 extractions and a 4,000+-concept graph collapse to 19 hypotheses, 0 compositions, 0 reviewed agent drafts. This wave makes the **Correspondence** (see `CONTEXT.md`) the center of gravity: claims become addressable rows, concepts get domains and mission relevance, correspondences get a table and a direct agent write surface, embeddings propose candidates, LangGraph graphs mine/hunt/draft under a WIP cap, and the composition end gets starter kits plus a self-render spike.

**Decisions already made (do not reopen — recorded in `docs/decision-log.md` 2026-07-07):** Correspondence = cross-domain concept pair, claim-cited, `conjectured → evidenced | contradicted → retired` · claims become first-class rows · two doors, one gate (graph enrichment agent-writable; draft review gates the experimental pipeline only) · embeddings propose / symbolic scores / LLM judges · runtime seam (fixed-input transforms = Convex generators; search/traversal/judgment = LangGraph graphs) · split cadence with WIP cap N=3 · arXiv feeds stay, concepts auto-flag off-mission · scouted sources direct-ingest, scouted feeds need human enablement · starter kits this wave, self-render as bounded spike.

**Vocabulary:** domain terms per `CONTEXT.md` (Correspondence, Claim, Domain, On-Mission/Off-Mission, Source Scout, Micro-Study, Starter Kit, Agent Draft, …). Architecture terms per the codebase-design glossary.

**Prerequisite wave:** the 2026-07-03 architecture deepening wave (plans 01–07) executes **before** this wave. Hard dependencies called out per-plan below; the load-bearing ones are 07-03-02 (shared shapes), 07-03-03 (LLM module — our classifier and generators call it), 07-03-04 (convex-test harness — protects our schema changes), and 07-03-05 (agent-tool registry — our new tools register into it).

**Found-state rule:** these plans were authored 2026-07-07 against the pre-arch-wave codebase. Where a plan quotes current code, the executor will find drift (the arch wave moves shapes into `convex/shared/`, unifies the LLM path, and registers tools). Adapt edits to the found state; **schemas, interfaces, and "Done means" gates are what's binding.**

---

## Plans

| # | Plan | Delivers | Depends on |
|---|------|----------|------------|
| 01 | `2026-07-07-01-loop-claims-table.md` | `claims` table + backfill from 1,580 extractions; extraction write path emits claim rows | arch 02, 04 |
| 02 | `2026-07-07-02-loop-domains-and-relevance.md` | Domain registry seeded; LLM classification backfill (domains + on/off-mission); domains at concept creation; dead feeds removed | arch 03 |
| 03 | `2026-07-07-03-loop-correspondences.md` | `correspondences` table, pair-keyed dedupe, lifecycle mutations, agent write surface | 01, 02, arch 05 |
| 04 | `2026-07-07-04-loop-embeddings.md` | Vector indexes on claims + concepts; backfill; incremental embedding on write | 01, 02 |
| 05 | `2026-07-07-05-loop-miner-graphs.md` | Candidate generator (Convex) + miner and evidence-hunter LangGraph graphs | 03, 04 |
| 06 | `2026-07-07-06-loop-drafting-graph.md` | Correspondence-driven hypothesis-drafting graph with WIP cap; `correspondenceId` provenance on hypotheses | 03, 05 |
| 07 | `2026-07-07-07-loop-review-ux.md` | Draft review redesign: decidable in <2 minutes with correspondence context | 06 |
| 08 | `2026-07-07-08-loop-weekly-brief.md` | Brief sections: correspondence movement, pending drafts, experiment debt, feed proposals | 03, 06 |
| 09 | `2026-07-07-09-loop-source-scout.md` | Need-directed scout graph; direct-ingest sources; feed proposals for human enablement | 02, 03, 05 |
| 10 | `2026-07-07-10-loop-starter-kits.md` | Recipe → `.scl`/`.kbm` + seed MIDI + parameter card generation | none (any time) |
| 11 | `2026-07-07-11-loop-selfrender-spike.md` | Bounded spike: machine-rendered micro-studies + validation protocol | 10 |

---

## Execution order and dependency graph

```
arch wave 07-03 (01..07) ─────────────────────► prerequisite
01 claims ──────────┬──► 04 embeddings ──► 05 miner graphs ──► 06 drafting ──► 07 review ux
02 domains ─────────┤          ▲                  │                 │
                    └──► 03 correspondences ──────┘                 ├──► 08 weekly brief
                              │                                     │
                              └──────────► 09 source scout ◄────────┘ (needs census + conjectures)
10 starter kits ──► 11 self-render spike     (independent — any time)
```

Recommended serial order: **01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11.**
Safe to parallelize (separate sessions/worktrees): 01 and 02 · 10 (and then 11) at any point · 07 and 08 after 06.

Rationale for 05 before 06: the drafting graph consumes miner output (strong conjectured/evidenced correspondences). Rationale for 07 immediately after 06: the WIP cap makes review the system's bottleneck *by design* — shipping the cap without the review UX recreates the dead queue this wave exists to fix.

---

## Seam handoffs

1. **Claim shape (01 → 03, 04, 05).** Plan 01 defines the `claims` table and `claimId`-bearing citation shape. Plans 03 (evidence citations), 04 (embedding field + vector index), and 05 (context gathering) consume it. If 01's landed field names differ, the later plans follow the landed schema.
2. **`missionRelevance` + `domains` (02 → 04, 05).** Plan 04 uses them as vector-index filter fields; plan 05's candidate generator filters on them. Do not start 04/05 before 02's backfill has actually run against production data.
3. **Agent-tool registry (arch 05 → 03, 05, 06, 09).** All new agent tools register through the registry landed by arch plan 05 (one registry row + one export). If arch 05 was skipped or landed differently, register tools the way the found code does — but never hand-mirror shapes across the seam; zod-first per the 2026-07-03 decision.
4. **Draft payloads (06 → 07).** Plan 06 adds `correspondenceId` to the hypothesis draft payload; plan 07's review screen renders correspondence context from it. 07 must read the landed payload shape.
5. **LLM module (arch 03 → 02).** The domain/relevance classifier calls the shared `convex/llm.ts` module. If it doesn't exist in found state, stop and land arch 03 first.

---

## Gates

Wave-level checkpoints (each plan's tasks also self-gate):

- **After 01:** claim-row count ≈ Σ of embedded claim-array lengths across extractions; a fresh extraction produces claim rows; harness tests green.
- **After 02:** <5% of on-mission concepts remain in domain `general` on a 50-concept human spot-check; top-25 concepts by mention are all flagged (on- or off-mission, correctly on the spot-check); dead feeds gone from `feeds:list`.
- **After 03:** upserting the same concept pair twice yields one row with merged evidence; same-domain pair rejected; agent-tool drill (registry row + export) passes for the new tools.
- **After 04:** `ctx.vectorSearch` over claims returns sane nearest neighbors for a hand-picked probe claim; embedding coverage ≥95% of on-mission claims.
- **After 05:** one worker-scheduled miner run writes ≥1 and ≤20 correspondences, every one provenance-stamped with run id and rationale; a second identical run does not duplicate pairs.
- **After 06:** with 3 pending drafts, the drafting graph refuses to run and logs a `status` event saying so; a promoted hypothesis carries `correspondenceId`.
- **After 07:** review a real draft end-to-end (approve one, reject one) in under 2 minutes each, timed, with correspondence evidence visible on-screen.
- **After 08:** a generated brief contains correspondence-movement, pending-drafts, and experiment-debt sections populated from real data.
- **After 09:** one scout run ingests ≥1 source with agent provenance and proposes (not enables) ≥1 feed; proposed feed appears in the brief.
- **After 10:** `bun run scripts/generate-starter-kit.ts <recipeId>` on a real recipe emits a valid `.scl` (loads in a Scala-compatible tool), a `.kbm`, a seed MIDI file, and a parameter card.
- **After 11:** spike report committed with go/no-go recommendation and the human-vs-machine validation listening result.

Standing constraint for every plan: **`bunx convex codegen` deploys to the live self-hosted backend and is the Convex typegate** — sequence commits so no broken intermediate state is ever pushed.

---

## Out of scope for this wave (noted in the session, not carded)

- Re-derivation of the parked agent-v2 plans (production worker scheduling beyond what 05/06 need; self-improvement loop) — re-derive **after** this wave's first month of operation.
- Listening-session capture UX beyond what plan 08's experiment-debt section nags about.
- Retiring `hypotheses:generateFromExtraction` (it survives as a manual utility).
- Full Ableton Extensions SDK integration (noted as an assist path in plan 11's spike options only).
- Editorial/publishing surfaces for correspondences.
