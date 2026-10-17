# Plans — What Remains, In Order

> Last full code audit: 2026-07-15 (see [plan-status-report-2026-07-15.md](../plan-status-report-2026-07-15.md)).
> Last planning session: 2026-07-18 (decision surfaces — see the decision-log entry of that date).
> Last plan-status/archive audit: 2026-08-03 — implementation-complete loop plans 04–10, 12, and 14 archived.
> Completed waves live in [docs/archive/](../archive/README.md). Decision history: [decision-log.md](../decision-log.md).
> **Visual plan** (dependency graph + gate order, 2026-07-19): `plan-1511dbd302914c0a` on plans.rproj.art.
> Listen-first status rows (§1c) reconciled 2026-10-13 against `main` at `6c83e4d` and the dated handoffs they cite.
> Plans 008, 11 and 15 and §1c re-checked 2026-10-17 against `main` at `91cb3047`. Production facts come from that day's read-only [rollout evidence](../evidence/wave2-rollout-20261017/README.md).

## Where things stand

Every plan wave before the knowledge loop is **done**: the MVP (`planning/`,
archived), the 2026-07-01 agent-system wave, the 2026-07-03 architecture wave,
the 2026-07-07 improve-skill Wave 1 (except 008), and the 2026-07-15
improve-skill Wave 2 (011–015, all DONE 2026-07-18). The meaning roadmap
Phases 1–4 are implemented. Knowledge-loop plans **01–10, 12, and 14 are
implemented and archived** in [plan-waves/](../archive/plan-waves/); remaining
live/operator acceptance is listed below rather than keeping implementation
specs in the active folder.

The active plan files are now: **008** (next, operator-gated eval baseline
sweep), **13** (recipe loop closure, blocked on 008), **11** (studio spike; awaiting Keith's comparison
and go/no-go), **15** (passage index; merged, live acceptance pending), **16** (deferred WebMCP
readiness), and the autonomous Proxmox operations plan.

The sequencing rule, per the 2026-07-07 decision-log entry: **synthesis is the
bottleneck, not capture** (1,580+ extractions and a 5,400-concept graph had
produced only 19 hypotheses). Finish the loop wave before starting next-wave
phases.

## 1. Knowledge-loop wave — implementation ledger and remaining work

From [2026-07-07-00-loop-master-sequence.md](./2026-07-07-00-loop-master-sequence.md).
Plans 01–10, 12, and 14 are archived; do not re-implement them. An archived
implementation may still have an operator/live acceptance item in §2.

| # | Plan | Status |
|---|------|--------|
| 01 | [Claims become first-class rows](../archive/plan-waves/2026-07-07-01-loop-claims-table.md) | ✅ Landed `b2e0cbe` (4,648 claims backfilled) — archived |
| 02 | [Concept domains + mission relevance](../archive/plan-waves/2026-07-07-02-loop-domains-and-relevance.md) | ✅ Landed `03dce57` (5,444/5,444 classified) — archived |
| 03 | [Correspondences table + agent write surface](../archive/plan-waves/2026-07-07-03-loop-correspondences.md) | ✅ Landed `2adca48` (live-gated) — archived |
| 04 | [Embeddings + vector indexes](../archive/plan-waves/2026-07-07-04-loop-embeddings.md) | ✅ Implemented in PR #28 (`4622c2b`) — archived; backfill/probe acceptance remains |
| 12 | [Domain triage surface](../archive/plan-waves/2026-07-18-12-domain-triage-surface.md) | ✅ Implemented in PR #29 (`e8f5516`) — archived; packet decision remains |
| 05 | [Candidate generator + miner & evidence-hunter graphs](../archive/plan-waves/2026-07-07-05-loop-miner-graphs.md) | ✅ Implemented in PR #31 (`3600ec5`) — archived; worker/live-run acceptance remains |
| 06 | [Drafting graph + WIP cap (N=3)](../archive/plan-waves/2026-07-07-06-loop-drafting-graph.md) | ✅ Implemented in PR #32 (`f3556d5`) — archived; first live draft gate remains |
| 07 | [Review UX + edit-before-approve](../archive/plan-waves/2026-07-07-07-loop-review-ux.md) | ✅ Implemented in PR #33 (`1d69ae4`) — archived; visual/timed acceptance remains |
| 13 | [Recipe loop closure](./2026-07-18-13-recipe-loop-closure.md) | ⏸️ **BLOCKED on plan 008.** Golden datasets are ratified, but the required baseline sweep is not recorded yet |
| 08 | [Weekly brief integration](../archive/plan-waves/2026-07-07-08-loop-weekly-brief.md) | ✅ Implemented in PR #34 (`60cca5e`) — archived; real-brief acceptance remains |
| 09 | [Source scout](../archive/plan-waves/2026-07-07-09-loop-source-scout.md) | ✅ Implemented in PR #35 (`073cb94`) — archived; first live run remains |
| 14 | [Decision-surface sweep](../archive/plan-waves/2026-07-18-14-decision-surface-sweep.md) (card-level) | ✅ Implemented in PR #36 (`236e6f0`) — archived; visual acceptance remains |
| 10 | [Composition starter kits](../archive/plan-waves/2026-07-07-10-loop-starter-kits.md) | ✅ Implemented in PR #30 (`3b72b5c`) — archived; real-recipe/studio acceptance remains |
| 11 | [Self-render spike (bounded)](./2026-07-07-11-loop-selfrender-spike.md) | Steps 1 and 2 done (litmus engine, pitch within 0.01 cent). Step 3 needs Keith's studio renders; the human studio comparison path ([contract](../studio-comparison-contract.md)) is reviewed locally, not merged or deployed, and needs its own attested release. Step 4, the contamination assessment and go/no-go, is Keith's. See the [studio validation packet](../plan11-studio-validation-packet.md). Renders stay `unvalidated` |

After 11: **generator steering** (model/prompt/scope knobs in the UI) is the next roadmapped item —
deferred by the 2026-07-18 decision, not dropped.

## 1b. Passage-retrieval program (planned 2026-08-01)

Grilling session 2026-08-01 (Keith): make source prose retrievable via the
`@convex-dev/rag` component. Language: **Passage** in `GLOSSARY.md`; decision
record: [ADR 0001](../adr/0001-split-embedding-spaces-for-passages.md)
(3-large passages / 3-small claims, split space, migration is a follow-on).

| # | Plan | Status |
|---|------|--------|
| 15 | [Passage index foundation + `searchSourcePassages` agent tool](./2026-08-01-15-passage-index.md) | Implementation merged in #153 (`6f33238`); live acceptance pending. Not deployed: the 2026-10-17 backend has no `rag` component. Nothing enabled, backfilled or probed. The bounded backfill canary and [acceptance sequence](../evidence/passage-index-20261017/acceptance.md) are ready; the budget cap and enabling are Keith's |
| — | Hypothesis cross-source context (ship directly, no flag) | Follow-on, unplanned |
| — | Extraction full-text fix (send all ≤100k chars; not a RAG change) | Follow-on, trivial |
| — | Recipe context (inherits hypothesis pattern) | Follow-on, last |
| — | Migrate claims/concepts to 3-large | Roadmap follow-on (ADR 0001) |

## 1c. Listen-first program (2026-09-28)

Umbrella spec: [listen-first program design](../superpowers/specs/2026-09-28-listen-first-program-design.md).
Wave specs: [voice and podcast feed](../superpowers/specs/2026-09-28-voice-and-podcast-feed-design.md),
[Freq docket and voice decisions](../superpowers/specs/2026-09-28-freq-docket-and-voice-decisions-design.md),
[render ladder and listen page](../superpowers/specs/2026-09-28-render-ladder-and-listen-page-design.md),
[hypothesis tournament](../superpowers/specs/2026-09-28-hypothesis-tournament-design.md).
Language: **Audio Artifact**, **Media Job**, **Blind Group**, **House Voice** under `GLOSSARY.md` § Audio substrate.

| # | Plan | Status |
|---|------|--------|
| W0 | [Wave 0 — substrate](../superpowers/plans/2026-09-28-listen-first-wave-0-substrate.md) (artifacts, media jobs, blind groups, media service, podcast feed) | ✅ Merged (#75) and deployed 2026-09-29; media worker live on ai-5090-02, probe and feed verified |
| W1 | [Wave 1 — voice and feed](../superpowers/plans/2026-09-28-listen-first-wave-1-voice-and-feed.md) | Implementation deployed September 30, with Cartesia expansion in #87. The managed podcast route repair is deployed; private RSS and full/range audio downloads are verified. Keith selected the house voice: live `houseVoiceId` read `inworld-max` (Inworld Max, Dennis) on October 5. His October 5 listening preferences were recorded without numeric ratings. Weekly narration ran for September 14, 21 and 28, and four audio editions were published on October 5. Playback on his devices and subjective fatigue remain his checks. See [live handoff](../listen-first-live-handoff-2026-09-30.md). |
| W2 | [Docket and signed decisions](../superpowers/plans/2026-09-30-listen-first-wave-2-docket-and-decisions.md) | Implementation merged to `main` in #138 (`6c83e4d`): docket preparation/playback, signed decisions, MCP, signer delivery and web Listen sections, with signer and preparation gates disabled by default. Rollout tooling merged in #139 (`52b7664`). General audio ratings (render deliveries and episodes) and recipe/audio deferral merged in #141 (`6e33381`); its headed visual acceptance is still blocked on this host. Not deployed: a read-only inspection on 2026-10-17 found the backend at `81150337` (#135), before #118, and the agent and media workers on matching older images. The backend deploy, worker images, revision backfill, MCP workload, signer bots and human signing acceptance are outstanding. Follow the [rollout packet's work order](../wave2-rollout-packet.md#combined-rollout-work-order-2026-10-17); see [backend integration](../wave2-backend-integration.md). |
| W3–W4 | Render ladder and listen page; hypothesis tournament | Shared pitch contracts, an offline SuperCollider renderer, and the injected tournament core merged in #138. PR #140 (`1a368d1`) adds typed litmus render jobs (media renderer 0.3.0), with a real SuperCollider smoke render in the media container. Renders stay `unvalidated` until Keith's studio comparison and go/no-go; the studio comparison path is a separate local candidate, not merged or deployed (plan 11 row above). PR #142 (`0cc0592`) adds durable tournament persistence, direct-Anthropic model adapters and the worker graph behind `HYPOTHESIS_TOURNAMENT_ENABLED=false`. Both PRs are merged and not deployed; on 2026-10-17 the backend ran `81150337` and the media worker renderer 0.2.2. No live run or paid call was made during implementation, and listening fitness stays deferred. |

## 1d. Source backlog and operator extraction (completed 2026-10-11)

The October 11 operator campaign stored and verified 2,197 Sources and 1,209
active Claims using `openai/gpt-6.1-sol`, with zero skips or failures. Thirteen
unusable captures were parked as `review_needed`. A fresh export and live
backlog query found zero extractable Sources at 22:58:36 UTC; this is a dated
completion snapshot, not a claim about later intake. Only this campaign's
continuation was disabled.

See the [completion record and model-selection procedure](./2026-10-11-source-backlog-operator-extraction-completion.md).
The [October 3 handoff](./2026-10-03-source-backlog-operator-extraction-handoff.md)
retains the earlier capture history and unresolved capture issues.

## 1e. Deferred until an external trigger

| # | Plan | Status |
|---|------|--------|
| 16 | [WebMCP readiness](./2026-10-13-16-webmcp-readiness.md) (browser-agent tools for the web app) | ⏸️ Deferred 2026-10-13: Chrome origin trial only. Start when WebMCP ships in stable Chrome or Edge, an agent Keith uses consumes it, or Keith accepts origin-trial maintenance |

## 2. Operator/live acceptance items

Small; several are gate-specific, and item 1 must finish before plan 13 starts.

1. **Eval baseline — NEXT, operator-gated, BLOCKED.**
   [`plans/008`](../../plans/008-eval-baseline-sweep.md) stopped at its
   2026-10-17 [preflight](../evidence/eval-baseline-20261017/preflight.md)
   with no scores recorded. The runner defects it found were
   [repaired](../evidence/eval-baseline-20261017/runner-repair.md) the same
   day. Credentials now resolve through Varlock on `devbox` (STOP 1 clear
   there). STOP 4 remains: hypothesis ratification is pending (the
   [curation proposal](../../data/eval/curation-2026-10-17.md) recommends
   H5–H7 and dropping H4, giving 6 rows), and weekly briefs stay at 2 rows
   because production has no thesis rows. Still needed from Keith: that
   ratification, upload approval by hash, and a budget. $11 is proposed for a
   single-attempt stage 1; the retry ceiling is $21.53; no budget is
   approved ([readiness](../evidence/eval-baseline-20261017/readiness.md)).
   Record that baseline before starting plan 13 so its generator changes
   remain measurable.
2. **Domain triage** — now carded as
   [plan 12](../archive/plan-waves/2026-07-18-12-domain-triage-surface.md): the packet is decided
   *through* the new surface, not hand-applied.
3. **Proxmox worker — DA-executed** (SSH / 1Password / OpenTofu): restart with
   the fresh `AGENT_TOOL_SECRET`, refresh `agent/.env` on the host, hunt the
   UNAUTHORIZED ~6h caller:
   [proxmox-worker-runbook-2026-07-12.md](../proxmox-worker-runbook-2026-07-12.md).
   **Gate: worker healthy before plan 05 counts as done.**
4. **Review the 1 pending agent draft** in the review queue (Keith — also the
   felt baseline for plan 07's timed gate).
5. **Structural fixes** (improvements ledger #19, #20, #9): dedicated e2e Convex
   deployment (e2e currently points at production), bypass-secret consumer
   inventory + auth-failure alerting, TLS for the `:3211` site surface.
   Unscheduled backlog — none gate the current sequence.

## 3. Next wave (Phases A–F) — after the loop wave

From [next-wave-roadmap.md](../next-wave-roadmap.md) /
[next-wave-workstreams.md](../next-wave-workstreams.md). The 2026-07-15 code
audit found several items further along than the roadmap assumes:

- **Phase A — Autonomous ingest** (design: [autonomous-ingest-design.md](../autonomous-ingest-design.md),
  build slices S1–S5). URL fetch and YouTube transcripts are already wired into
  Convex; **the real gap is PDF extraction** (still script-only) and the
  blocked-state/retry surfaces.
- **Phase B — Canonical control surface**: parameter actionability flags (not
  started), first-class experiment model (protocol exists as a recipe field,
  not a table), structured revision diffs (lineage fields exist; diffs are
  free-text).
- **Phase C — Export/connector**: productionize the `recipe_export_v1` +
  `.scl` emitter spike ([recipe-export-v1-design.md](../recipe-export-v1-design.md),
  code archived at `scripts/archive/spike-recipe-export.ts`; production tuning
  lib now at `scripts/lib/tuning.ts` per plan 10) into Convex; add `.kbm`/MIDI seeds.
- **Phase D — DAW connector**: OSC/WebSocket bridge, then Max for Live (nothing
  started; plugin work stays deferred until the bridge proves the model).
- **Phase E — Representation**: 3D explorer expansion (currently
  sources/extractions/hypotheses/recipes only), 2D companion view, replace the
  `inferSector` keyword heuristic with the now-existing domain classifications.
- **Phase F — Analysis & hardening**: artifact registry, computed audio
  analysis, recommendation memory (currently gated off in the agent). Note:
  yield visualization, AI contract tests, auth hardening, and the
  `public_editorial_v1` narrative surface are **already implemented** — skip.

## Ledgers & references

- Improvement backlog + session ledgers: [improvements-2026-07-10.md](../improvements-2026-07-10.md)
- Improve-skill wave ledger (008 blocked, still open): [`plans/README.md`](../../plans/README.md)
- Living operating docs (not plans): vision-and-meaning, loop-spec-v1.1,
  cadence-and-operating-rules, schema, agent-tool-surface, eval-baselines,
  langsmith-runbook, parameter-extraction, metrics-and-dissonance.
