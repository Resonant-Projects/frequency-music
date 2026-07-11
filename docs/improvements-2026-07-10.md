# System Verification & Improvements — 2026-07-10

Session goal: verify the latest plans landed and deployed, exercise the loops
and hypothesis flow end-to-end, and assess whether the knowledge graph and
retrieval actually help the workflow. This file is the accumulated findings and
improvement backlog from that pass.

## Plan-completion verdict

- **2026-07-03 arch wave (plans 01–07): all seven DONE** and merged, test
  suites green (146 convex unit + 14 harness + 82 agent tests). One documented
  deviation: the convex-test harness lives at top-level `harness/` instead of
  `convex/harness/` (moved to unblock codegen, commit `d2dfeb8`).
- **2026-07-01 agent wave (plans 01–05): DONE** at artifact level.
- **2026-07-07 knowledge-loop wave (plans 01–11): NOT STARTED.** No claims
  table, no correspondences, no domain backfill, no embeddings, no miner/
  drafting/scout graphs — on main or any branch. The plan docs are the only
  artifact. This is the single largest gap between intent and system state.

## Deployment verdict

- **Code parity: in sync.** All 32 deployed function modules and all 22 tables
  match local main exactly.
- **Loop health: two of five crons silently dead.**
  - `poll-feeds` ✅ (all 13 feeds polled today)
  - `recompute-stats` ✅ (updates every 30 min)
  - `sweep-stale-agent-runs` ✅ (presumed; no stuck `running` rows)
  - `batch-extract` ❌ — newest extraction was **2026-05-15** until this
    session's test run. Root cause: the deployed OpenRouter key is revoked
    (`AI_APICallError: User not found.`).
  - `generate-weekly-turn` ❌ — newest weekly brief **2026-03-06**. Same root
    cause (default model routes through OpenRouter).
- **Production agent worker: appears offline.** No agent-tools HTTP traffic in
  logs; newest agent run 2026-06-04 (stuck `needs_review`).

## Fixed this session (committed, NOT yet deployed)

1. **Retired Groq model id** — `MODELS.fast`/`kimi` pointed at
   `groq/moonshotai/kimi-k2-instruct`, which Groq no longer serves. Replaced
   with `groq/openai/gpt-oss-120b` (production tier, non-Llama), verified by a
   real end-to-end extraction on the live backend. CLAUDE.md table synced.
2. **Hypothesis generation was un-schedulable** — extraction had
   `startBatchExtractionInternal` for crons; hypotheses had no internal
   starter at all, so nothing could ever generate hypotheses automatically
   (one structural cause of the 1,580-extractions/19-hypotheses synthesis
   gap). Added `workflows.startBatchHypothesisInternal` mirroring the
   extraction pattern, plus `returns` validators on both internal starters.
3. **`editorialSignals.hypothesisCount` always 0** — it reported the stored
   `concept.hypothesisCount` field, which no link action ever increments. Now
   computed live from `hypothesis.concepts`, consistent with the rest of the
   row. (The agent's editorial signal previously understated every concept's
   hypothesis linkage as zero.)
4. **Editorial-cluster edge query** — replaced a post-index `.filter(q.or(...))`
   with an indexed collect + JS find (convex-lint compliance).
5. **`agent/` workspace deps not installed** — `@openai/codex-sdk` was missing
   from node_modules; 7 test files failed to load. `bun install` → 82 pass.
6. **`.env.local` Convex URLs migrated** to `https://convex.resonantprojects.art`
   per commit `fd5218e` (the gitignored file was never updated).
   `CONVEX_SITE_URL` deliberately left on the plaintext host — no TLS domain
   exists for the site surface yet.

## Blocked on Keith (cannot proceed autonomously)

1. **Rotate/replace the OpenRouter API key.** Revoked key = extraction,
   hypothesis, recipe, and weekly-brief generation on default models all dead
   since ~mid-May. Update 1Password (`op://Country Manor Lab/openrouter-api-key`),
   the Convex deployment env (`OPENROUTER_API_KEY`), and local `.env.local`.
2. **Refresh rotated secrets into `.env.local`** — `AUTH_BYPASS_SECRET` and
   `AGENT_TOOL_SECRET` there are stale post-rotation (plan 001): local CLI
   mutations get UNAUTHORIZED (today's 3 PM failure burst was exactly this)
   and the agent-tools surface returns 403 to the local worker.
3. **Deploy this session's fixes**: `bun x convex deploy -y` (production deploy
   was permission-gated for the agent). Until deployed, the cron still
   references the retired Groq model when invoked with `fast`.
4. **Restart the Proxmox worker** with the fresh `AGENT_TOOL_SECRET`
   (see `docs/proxmox-agent-deployment.md`).
5. **Groq local key** in `.env.local` is also 401 — refresh if local Groq
   calls are wanted (the deployed Groq key works).

## Does the knowledge graph / retrieval actually help the workflow?

Verdict: **the graph is well-populated (4,000+ concepts, 4,000+ edges) and its
write path works, but almost nothing reads it where it matters.**

What works:
- `linkExtractionConcepts` runs automatically per extraction (verified live
  today: 5 concepts + edges minted from a fresh extraction).
- `searchSourcesByConcept("just intonation")` returns excellent, on-mission
  sources. `searchConcepts` works.
- `editorialSignals` yield-ranking is genuinely mission-aligned — because it
  weights recipe/hypothesis linkage, its high-yield list surfaces "frequency,
  just intonation, equal temperament" rather than raw-mention noise.

What doesn't:
- **Hypothesis generation never reads the graph.** `generateFromExtraction`
  prompts from a single extraction's claims only. The graph is write-only for
  the core synthesis flow — no cross-source connection can ever emerge.
- **The research-pipeline drafting agent gets no retrieval tools** — one-shot
  completion, whole scope JSON truncated to 8,000 chars. Editorial signals
  are loaded but ignored during candidate selection (pure claim-count
  scoring). Only the weekly-brief agent can call graph tools.
- **Raw mention ranking is dominated by off-mission arXiv noise** — top-10
  concepts by mentions are speech recognition/ML topics; 99.4% of concepts
  have domain `general`. `getTopConcepts` is currently an anti-signal.
- `getConceptDetail` filters linked items to `visibility === "public"`, so it
  returns empty arrays for the (private) research corpus — misleading for
  workbench use.

The unimplemented 2026-07-07 loop wave is precisely the remedy (claims as
rows → domains/relevance → correspondences → embeddings → miner/drafting
graphs). This session's evidence strongly supports executing it as planned.

## Improvement backlog (observed, not fixed — roughly prioritized)

1. **Execute the knowledge-loop wave (plans 01–11).** Everything below the
   fold here is a symptom of it not existing.
2. **Cron/loop observability.** Self-hosted log retention is a ~5-minute ring
   buffer; two crons were dead for months with zero signal. Add a staleness
   watchdog (e.g. alert when newest extraction > 24h old, newest brief > 8
   days) — the `stats` table already updates every 30 min and could carry
   `lastExtractionAt` / `lastBriefAt` rows surfaced on the dashboard/Pulse.
3. **Failure alerting on generation crons** — batch-extract logs per-source
   errors inside the workflow and reports "complete"; a fully-failed batch is
   indistinguishable from success without reading logs.
4. **`generateBatch` dedupe** — it refilters the newest 50 extractions each
   run with no check for existing hypotheses per extraction; repeat runs mint
   near-duplicates. Interim fix: skip extractions already linked to a
   hypothesis (edge or `sourceIds` check) until plan 06's WIP cap lands.
5. **Schedule the new `startBatchHypothesisInternal`** (weekly, small limit)
   once the OpenRouter key is restored — or gate on plan 06's drafting graph
   if that's imminent.
6. **Expose graph traversal to agents** — `searchConcepts`,
   `getConceptsForDomain`, edge queries are absent from the agent tool
   manifest; the drafting specialist can't follow a thread even if prompted
   to. (Superseded by plan 03/05's correspondence tools if executed soon.)
7. **Reconcile `needs_review` agent runs with the draft queue** — 4 runs are
   `needs_review` with 0 pending drafts (reviewed drafts never advance the
   run status, or draft persistence failed). Stale since June 4.
8. **`computeEditorialSignals` scaling** — collects five whole tables per
   call (concepts is 4,000+ rows). Same pattern plan-005 fixed for dashboard
   counts; needs precomputation or bounding before the graph grows further.
9. **TLS for the site surface** — `AGENT_TOOL_SECRET` currently travels in
   POST bodies over plaintext HTTP to `:3211` (SECURITY-04 follow-up).
10. **Extraction quality check for `gpt-oss-120b`** — today's test extraction
    returned 0 claims/0 parameters on an (admittedly off-mission) source.
    Spot-check a few on-mission extractions with the new fast model before
    trusting it for cron duty; keep Sonnet as `default` for quality.
11. **Provider model-catalog drift guard** — Groq silently retired the Kimi
    model and the pipeline hard-failed. A tiny periodic check of MODELS
    entries against provider catalogs (or a startup validation) would surface
    this in hours instead of months.
12. **Plan-doc hygiene** — none of the completed arch-wave plan docs have
    their checkboxes ticked; completion is only inferable from git. A
    one-line "landed: <commit>" header per plan doc (as `plans/README.md`
    does) would make verification trivial.
13. **`getConceptDetail` workbench variant** — either drop the
    public-visibility filter behind auth or rename to make the
    editorial/public intent explicit.
14. **Off-mission arXiv noise at ingest** — plan 02 covers classification;
    consider also feed-level topic filters so barreleye-fish articles never
    become sources at all.

## Late-session addendum (after OpenRouter key rotation)

Verified working end-to-end tonight: extraction with Sonnet on the rotated
key; hypothesis creation (`generateFromExtraction`); the full worker loop
(enqueue → claim → research-pipeline graph → persisted review draft →
`needs_review`, 1 pending draft now in the queue).

New findings, fixed in commit `3e347ba` (deploy still pending):

- **Recipe generation deterministically truncates** with Sonnet 4.6 at the
  deployed `recipe_v1: 3000` token budget (two live failures, "Unterminated
  string"). Budget raised to 6000.
- **Weekly brief cannot generate from an all-draft corpus** — the fallback
  hypothesis pool was status-`active`-only, so `generateBriefCore` threw "No
  recent hypotheses or recipes found" even with same-day drafts. Fallback now
  widens to newest rows when nothing is active. (The brief failed today for
  two independent reasons: dead key + this guard.)

Still open:

- **`agent/.env` (May 24) held the stale `AGENT_TOOL_SECRET`** and shadows the
  repo-root `.env.local` (Bun auto-loads it; the root loader skips
  already-set vars). Refreshed locally; the Proxmox worker's env_file needs
  the same refresh. Its `OPENROUTER_API_KEY` is still the dead key.
- **The 1Password item `openrouter-api-key` no longer exists** under that
  name in Country Manor Lab — `.env.schema`'s `op()` ref is broken; varlock
  resolution of `OPENROUTER_API_KEY` fails for every script. Rename the item
  or update the ref.
- **Something scheduled still calls `sources:updateText` with a stale bypass
  secret** — recurring UNAUTHORIZED bursts (15:01 and 21:00 tonight). Find
  the job (Proxmox? launchd?) and refresh its secret.
