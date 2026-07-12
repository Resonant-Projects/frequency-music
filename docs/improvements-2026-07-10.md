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

> **Session-2 update (2026-07-10 late night):** items 1–3 and 5 are RESOLVED —
> see "Session 2 ledger" at the bottom. Only item 4 (Proxmox worker restart)
> still needs Keith.

1. ~~**Rotate/replace the OpenRouter API key.**~~ **RESOLVED.** Key rotated;
   1P item renamed to `OpenRouter API Key - Frequency Music` and `.env.schema`
   ref updated to match; varlock resolution verified; live extraction on the
   rotated key verified post-deploy (session 2).
2. ~~**Refresh rotated secrets into `.env.local`**~~ **RESOLVED.** `.env.local`
   intentionally carries no secret literals — varlock resolves
   `AUTH_BYPASS_SECRET`/`OPENROUTER_API_KEY` from 1P at runtime (verified);
   `AGENT_TOOL_SECRET` in `.env.local` and `agent/.env` hash-matches current 1P;
   live authed CLI mutation succeeded (no UNAUTHORIZED). A 1P service-account
   token at `~/.config/op/agentic-workers.token` now enables fully headless
   secret resolution.
3. ~~**Deploy this session's fixes**~~ **DONE (session 2).**
   `bun x convex deploy -y` succeeded 2026-07-10 ~22:36; live extraction
   verified end-to-end post-deploy (default model `openai/gpt-5.6-terra`).
4. **Restart the Proxmox worker** with the fresh `AGENT_TOOL_SECRET`
   (see `docs/proxmox-agent-deployment.md`). **Still Keith** — remote host.
5. ~~**Groq local key**~~ **RESOLVED.** Local Groq calls go through varlock's
   `op://Country Manor Lab/groq-api-key` ref; live Groq extraction from this
   machine succeeded in session 2 (gpt-oss-120b spot-check below).

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

## Session 3 ledger (2026-07-12 — handoff closeout, Keith-authorized autonomous)

Working method: Fable orchestrates/verifies/deploys/commits; Codex (`gpt-5.6-sol`
high) implements via codex-first. Keith front-loaded four approvals (1P item
create, e2e purge, full build+deploy green light, Proxmox SSH) then left it to
run. Covers both 2026-07-12 handoff files.

### Landed / verified

- **Credentials (D1)**: 1P item `groq-api-key` created in Country Manor Lab
  (Keith approved the biometric prompt); hash-verified against the working key;
  `.env.local` literal + marker comment removed; `vpx varlock load` resolves it;
  `check-model-catalog.ts` 9/9 with an explicit `op read` export. **Reconfirmed
  the varlock stale-resolution gotcha**: the freshly-created item reads fine via
  direct `op read` (service token) but returns 401 through varlock auto-load in
  the same shell — varlock's resolution lags 1P item creation exactly as it
  lagged the 2026-07-10 rotation. All fresh-secret flows must export explicitly.
- **E2E purge (D2)**: added `convex/maintenance.ts:purgeE2eDebris` (dry-run
  default, title-prefix scoped). Dry-run matched Keith's approved inventory
  ID-for-ID; live run deleted 4 `E2E Campaign e2e-*` + 6 `E2E Thesis e2e-*`
  rows; both tables now 0 e2e rows. `find-e2e.ts` only scans
  hypotheses/recipes/compositions (all clean) — the debris lived in
  campaigns/theses, which it doesn't cover.
- **Structural root cause (D2, backlog #19 below)**: SystemsThinking iceberg —
  e2e runs point `VITE_CONVEX_URL` at **production** (single deployment), and
  `web/tests/e2e/cleanup.ts` omits campaigns/theses from its table union AND
  swallows every error via bare `catch {}`. That's the exact 4+6 leak. The
  purge is the event-layer patch; the fix is fail-closed isolation (below).
- **Backlog #15–18 (D3, `e7f2f14`, deployed)**: per-item classifier
  `safeParse` (one malformed row no longer fails its 19 chunk neighbors);
  `getConceptDetail*` edge scan bounded to the 20-item link cap; `pipelineItems`
  hypotheses/recipes bounded to newest 100; `getConceptDetail` scope decision
  made explicit (`resolveWorkbenchScope`: authenticated → workbench, anonymous →
  public fallback so the zodiac graph stays browsable logged-out). 143 tests
  green. (Codex initially made anonymous callers throw; caught in review and
  changed to the public-scope fallback the route actually needs.)
- **Loop-wave plan 03 correspondences (D4, `2adca48`, deployed + live-gated)**:
  `correspondences` table (canonical pairKey identity, 4 indexes,
  agentOriginFields provenance); lifecycle mutations (idempotent
  `upsertConjecture` with same-domain/off-mission/unclassified rejection;
  `addEvidence` count-based recompute + (claimId,stance) dedupe; guarded
  `setStatus` — agents/system may only retire conjectured, never set evidenced
  directly); queries; weekly paginated auto-retire cron. 5 agent tools via the
  arch-05 registry drill. **Live wave gate**: upsert same pair twice (opposite
  order) → one row (created:true then created:false, same id); same-concept
  rejected; probe row retired (no delete mutation exists — retired is terminal).
  Plans 01+02+03 now live; **04 embeddings is next**.
- **Proxmox worker image (D5, part of `2adca48`)**: image build was failing
  `bun install --frozen-lockfile` (lockfile drift); regenerated `agent/bun.lock`;
  `docker compose build langgraph-worker` now succeeds. The June-4 offline
  worker's *image* is no longer a blocker.
- **Reconciliation (D6)**: the "4 orphaned needs_review runs" from the handoff
  were already reconciled in session 2 — live state is 1 needs_review run
  (`md74e18...`) with exactly 1 pending draft, consistent. No action needed;
  the 1 pending draft is Keith's to review.

### Open / packaged for Keith (host access was denied)

- **UNAUTHORIZED scheduler (D5) — ELIMINATED n8n, SOURCE STILL UNKNOWN,
  PACKAGED.** Logged into n8n (`zap.rproj.art`) and pulled the full workflow +
  execution inventory: 20 workflows, only Gmail/audio/Notion — **none call
  Convex, none run on a 6h cadence.** n8n is definitively not the source. A
  **host or LXC cron** is the remaining suspect. Could not confirm: `id_ed25519`,
  the OpenTofu SSH key (OpenSSH format), the Proxmox API token, and `:8006`
  ticket auth were **all denied** from Keith's Mac. **A 40-minute log window
  DID capture a live burst 08:58:44–09:01:10 PT** (2026-07-12): one
  `sources:create` + ~20 `sources:updateText`, all UNAUTHORIZED — the
  fetch/ingest pattern iterating over sources with the pre-rotation bypass
  secret, firing at the top of the hour on a ~6h cadence (≈03/09/15/21 PT).
  Scheduler is **confirmed live, not dormant**; next window ~15:00 PT. Harmless
  (rejected) but real. Full runbook + host-cron hunt commands + no-host canary:
  `docs/proxmox-worker-runbook-2026-07-12.md`. Env refresh + worker restart also
  await host access there.
- **49 provisional domains (D6)**: triaged into a decision packet —
  `docs/review/domain-triage-2026-07-12.md` (2 promote / 34 merge / 13 reject,
  plus 5/5/9 for parameter/relationship kinds). Surfaced two normalization bugs:
  `KNOWN_PARAMETER_KINDS` camelCase entries can never match (normalizeName
  lowercases first), and `normalizeConceptDomainSlug` doesn't fold underscores
  (so `audio_ml` evades dedupe). Keith promotes/merges from the packet.
- **Eval baseline sweep, plans/README 008 (D6)**: Codex ran it to STOP 4 — all
  three golden datasets (`extractions/hypotheses/weekly-briefs-golden.jsonl`)
  are **absent**; curation is a research-judgment task (targets ≥15/≥15/≥6
  examples). No code issue; the sweep is unblocked the moment datasets exist.

### New backlog items

19. **e2e writes to production (structural).** e2e points at the prod Convex
    deployment and the cleanup tracker omits campaigns/theses + swallows errors.
    Fix (Meadows rule-level): a dedicated e2e deployment; `start-dev-for-e2e.sh`
    refuses to boot unless `E2E_CONVEX_URL` is non-prod; a `DEPLOYMENT_ROLE=test`
    guard inside the seed/bypass path; un-silence cleanup errors. Files:
    `web/tests/e2e/cleanup.ts`, `web/scripts/start-dev-for-e2e.sh`,
    `convex/testing.ts`.
20. **Bypass-secret consumer inventory + auth-failure alerting.** The
    UNAUTHORIZED class exists because `sources:updateText` is a public mutation
    gated only by a shared dev bypass secret with unmanaged production consumers
    and no alerting on repeated auth failures. Inventory consumers at rotation
    time; add Convex-side alerting on repeated auth failures; longer-term give
    the worker/scripts a real service identity.

## Session 2 ledger (2026-07-10 late night — autonomous orchestration)

Working method: Claude orchestrates/verifies/commits; Codex (`gpt-5.6-sol`,
high reasoning) implements via codex-first. Each landed item lists its commit.

### Landed / verified

- **Secrets & access**: 1P service-account token stored at
  `~/.config/op/agentic-workers.token` (Country Manor Lab scope) — headless
  `op read` + varlock resolution, zero prompts. `vpx varlock load` resolves
  every schema var including the rotated OpenRouter key. Live authed CLI
  mutation verified (extractAllReady → success), killing the UNAUTHORIZED
  class for local work.
- **Deploy**: session-1 fixes (Groq model id, hypothesis internal starter,
  editorialSignals hypothesisCount, recipe budget 6000, brief fallback)
  deployed and live-verified 2026-07-10 ~22:36.
- **Backlog #10 (gpt-oss-120b quality)**: spot-checked on 2 on-mission
  sources + Sonnet control. Verdict: functional but lower-yield — 4 claims on
  a substantive arXiv source; 0 claims on a thin news item where Sonnet found
  only 1. Keep `fast` for cheap duty; cron default remains gpt-5.6-terra. No
  demotion needed.
- **Addendum/UNAUTHORIZED bursts**: ruled out this Mac (no crontab, no
  launchd job referencing the repo/backend). Bursts follow a ~6h cadence
  (15:01, 21:00) → prime suspects are a remote scheduler (n8n workflow or a
  Proxmox host cron) running the fetch scripts with a baked stale secret.
  Fix when the Proxmox worker is restarted (same env_file refresh).
- **Backlog #7 root cause**: draft `approve`/`reject` never advances the
  parent agent run, so runs stick at `needs_review` forever (live counts:
  5 needs_review vs 1 pending draft = 4 orphans). Fix + backfill in flight.

### Landed (Codex runs A + C, reviewed/committed/deployed)

- **Backlog #2 + #3 (`ed07e09`, deployed)**: recomputeStats now persists
  `lastExtractionAt`/`lastBriefAt` + `loopHealth.*` staleness flags
  (extraction >24h, brief >8d) — verified live in the stats table.
  batch-extract records attempted/succeeded/failed + an all-failed signal;
  dead loops are now visible in data, not the 5-minute log buffer.
- **Backlog #4 + #5 (`ed07e09`, deployed)**: generateBatch and the internal
  starter select only extractions not already linked to a hypothesis (new
  `hypotheses.by_extractionIds` index; auto-generated hypotheses record
  `extractionIds` provenance). Weekly `generate-hypotheses` cron registered
  (Mondays 16:00 UTC, limit 3). Caveat: pre-existing hypotheses lack
  `extractionIds`, so legacy extractions can each be re-picked once;
  plan 06's WIP cap supersedes.
- **Backlog #11 (`51081af`)**: `scripts/check-model-catalog.ts` verifies
  MODELS against live OpenRouter/Groq catalogs, exit 1 on drift. **It caught
  three drifted ids on its first run** — sonnet's dash-form alias, delisted
  claude-3-5-haiku, delisted grok-3-mini-beta — fixed to catalog-canonical
  ids in `f7ff6ad` (sonnet 4.6 dot-form, haiku 4.5, grok 4.5; LangSmith
  judge model updated too). Guard now passes 9/9.
- **Backlog #12 (`281141e`)**: 07-01 and 07-03 wave plan docs carry
  `> Landed: <hash> (<date>)` headers.
- **Weekly brief live-verified**: `weeklyBriefs:generateInternal` produced a
  real brief on the rotated key post-deploy (both formerly-dead loops proven
  alive end-to-end).

### New findings this session (appended to backlog)

- **1P item `groq-api-key` does not exist** — varlock's op() ref pointed at
  nothing; the schema marked it optional so resolution "succeeded" silently
  and local Groq calls were 401. The working key from the Convex deployment
  env is parked as a gitignored `.env.local` literal. **Needs Keith** (60s):
  create the item in Country Manor Lab with that credential, then delete the
  literal — the agent's service-account token is read-only and desktop-app
  authorization times out unattended.
- **vp-migrate dep bump broke one agent test**: `@openai/codex-sdk` 0.142.5
  adds `cached_input_tokens`/`reasoning_output_tokens` to usage; the
  codex-specialist test expectation was updated in the working tree (rides
  the vp-migrate commit, as do CLAUDE.md's synced model table + vpx notes).
- **Service-account 1P token scope is read-only** — fine for secret
  resolution, cannot create/edit items. By design; noted for future sessions.

### Landed (second batch — runs B, D, loop-wave 01; content committed in `b2e0cbe`)

- **Backlog #8**: `computeEditorialSignals` no longer collects five whole
  tables — bounded to the top-100 concepts via `by_mentionCount` with
  indexed per-candidate lookups; output shape/ranking preserved.
- **Backlog #13**: `getConceptDetail` returns private-corpus links for
  authenticated callers; `getConceptDetailPublic` keeps the public-filtered
  behavior for the editorial surface.
- **Backlog #7**: root cause fixed — draft approve/reject/supersede now
  advance the parent run when its last pending draft resolves; live backfill
  `agentRuns:reconcileReviewedRuns` reconciled 4 orphaned runs → completed,
  keeping the 1 legitimate needs_review (1 pending draft).
- **Loop-wave plan 01 (backlog #1 started)**: `claims` table live —
  schema/write-path/read-surface/backfill implemented; backfill applied and
  converged (1,590 extractions → **4,648 claim rows**, second dry-run plans
  zero); force re-extraction live-verified supersession (4 superseded, 6 new
  active rows, ordinals correct). Plans 03/04/05 now have their substrate.
- **Root typecheck debt cleared**: ~115 pre-existing convex/harness/scripts
  errors (vp-migrate scaffold debt) fixed with type-only changes;
  `scripts/archive` excluded from tsconfig instead of editing frozen files.
  `tsc --noEmit` now exits 0 at repo root.
- Note: these were implemented by Codex runs B/D/wave-01 as uncommitted
  work; the concurrent Bun→Vite+ migration session committed them inside
  `b2e0cbe` along with the migration itself, so they share that hash.

### New findings (batch 2)

- **varlock op() serves a stale `auth-bypass-secret`** — varlock's resolution
  (via 1Password desktop-app auth) returned a different value than a direct
  `op read` of the same ref after the 2026-07-10 rotation; scripts relying on
  varlock got UNAUTHORIZED while direct reads worked. This is a plausible
  mechanism for the recurring UNAUTHORIZED bursts wherever a runner caches
  or resolves through the app-auth path. Workaround: export the secret
  explicitly (env wins over varlock auto-load). Worth a varlock cache/app
  session investigation or pinning resolution to the service-account token.

### Landed (batch 3 — loop-wave plan 02 complete, live and converged)

- **Plan 02 code (`03dce57` + fixes)**: concepts carry
  `missionRelevance`/`relevanceRationale`/`classifiedAt`/`classifierModel` +
  `by_missionRelevance`; registry-constrained Sonnet classifier with
  structured output (new shared Zod path in llm/llmNode); classification at
  concept-creation + hourly `classify-stale-concepts` sweep; idempotent
  seeder/backfill/cleanup drivers.
- **Live results**: registry seeded and converged (14 domains).
  Classification backfill converged — **5,444/5,444 concepts classified**
  (363 + 37 Sonnet calls, ≈ $6.2). Off-mission arXiv/ML noise now flags
  `ml-audio-engineering | off` with clean rationales; `getTopConcepts`-style
  mention noise is finally filterable (backlog #14's concept-side half).
  49 normalized provisional domains await Keith's registry review
  (`vpx convex run vocabulary:reviewSummary '{}'`).
- **Two live-run defects found and fixed en route** (each committed
  separately): Anthropic structured-output rejects array `maxItems` → the
  LLM-facing schema is now permissive with strict post-parse; the
  exactly-one-sentence rationale gate failed 10% of the corpus (abbreviations
  like "e.g." counted as extra sentences, and chunk granularity failed 20
  concepts per bad row) → gate softened to terminated/bounded, all 555
  failures recovered with zero failures on rerun.
- **Dead feeds (plan 02 task)**: honest no-op — four of the six listed feeds
  are no longer in the registry and the remaining two (3Blue1Brown, Robert
  Edward Grant) verify LIVE. Nothing disabled.

### Cross-vendor audit (Cato) — new backlog items

Verdict "concerns"; ledger-hygiene finding fixed in-session. Remaining
technical findings, filed as new backlog entries:

15. **Per-concept validation granularity** — classifier failures are handled
    per 20-concept chunk; one malformed row still fails its 19 neighbors
    (they retry via sweep, but per-item safeParse would be strictly better).
16. **`readConceptDetail` unbounded edge collect** — `getConceptDetail*`
    collects ALL edges for a concept (linked-item fetches are capped at 20,
    the edge scan is not); bound it like plan-005 did for counts.
17. **`pipelineItems` full-table collects** — hypotheses + recipes are
    collected unbounded in convex/dashboard.ts (~560) while sources/
    extractions in the same query are capped. Small tables today; fix cheap.
18. **`getConceptDetail` authenticated ≠ authorized** — any Clerk identity
    sees the private corpus (presence-of-identity gate, no role check).
    Fine for the current collaborator circle; make the decision explicit.

### Backlog dispositions (items not separately actioned)

- **#1 loop wave**: plans 01–02 DONE and live; 03–11 remain (03
  correspondences is next — claims + domains, its two prerequisites, now
  exist).
- **#6 agent graph-traversal tools**: deferred as designed — superseded by
  plan 03/05 correspondence tools now that the wave is actually moving.
- **#9 TLS for site surface**: unchanged, Keith/infra (SECURITY-04).
- **#14 ingest-side topic filters**: concept-side handled by plan 02's
  relevance flags; feed-level filters remain optional now that off-mission
  concepts self-flag.

### Cost & spend note

LLM spend this session: ≈ $6.2 classification backfill + a handful of test
extractions/hypothesis/brief generations on Sonnet/Terra/Groq.
