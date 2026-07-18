# Decision Log

## How to Use This Log

This log exists to keep the strategic layer of Frequency Music coherent as the project evolves. Use it whenever a roadmap-level or doctrine-level decision is made, changed, deferred, or reversed.

Add entries when:

- a roadmap phase changes meaningfully
- a naming or schema decision affects long-term structure
- a tradeoff is resolved between rigor, embodiment, musicality, or publishing
- a previous assumption is overturned by implementation or real use

Do not use this file for ordinary implementation notes or commit-style changelogs.

## Decision Entry Template

```md
## YYYY-MM-DD — Area

## **Decision**

## **Rationale**

## **Alternatives considered**

## **Downstream implications**

## **Revisit trigger**
```

## Initial Foundational Decisions

## 2026-05-16 — LangChain Integration Defaults

**Decision**

- Use LangSmith Cloud for initial tracing and evaluation.
- Self-host the LangGraph Agent Server alongside the existing n8n posture rather than making Convex depend on LangSmith-hosted deployment.
- Treat tracing as best-effort: trace failures should warn and drop, never fail user-facing extraction, hypothesis, recipe, or weekly brief actions.

**Rationale**

- LangSmith Cloud is the fastest path to useful traces and eval datasets.
- The project already separates application infrastructure from research code, and Cool Guy owns deployment. Keeping the agent server self-hosted matches that operating boundary.
- Observability is valuable only if it does not reduce pipeline reliability.

**Alternatives considered**

- Self-host LangSmith immediately.
- Use LangSmith-hosted agent deployment.
- Fail Convex actions when tracing is unavailable.

**Downstream implications**

- The prep work should add env vars for LangSmith and agent tooling, but actual secret values remain deployment configuration.
- Agent server deployment artifacts should be prepared in-repo, then handed to Keith/Cool Guy for hosting.
- LangSmith wrappers must be defensive and no-op cleanly when tracing is disabled or misconfigured.

**Revisit trigger**

- Revisit if data residency requirements change, tracing costs become material, or the self-hosted agent server proves operationally noisy.

## 2026-03-24 — Phase 1B Meaning Foundation

**Decision**

- Keep `theses` lightweight and optional in Phase 1B rather than introducing campaign logic or a dedicated thesis UI.
- Store `truthConfidence` and `interestLevel` on individual extraction claims, not on whole extractions.
- Store `revisionParentId` and `revisionVariable` on compositions now, while full lineage views wait for Phase 2.

**Rationale**

- The project needs a durable meaning layer before adding heavier lineage and editorial graph features.
- Confidence and creative fertility vary claim by claim, so extraction-level metadata would be too blunt.
- Revision metadata is useful immediately for studio discipline even without a full ancestry surface.

**Alternatives considered**

- Defer theses entirely until Phase 2.
- Put "interesting vs true" at the extraction level.
- Wait for a full lineage graph before recording revision intent.

**Downstream implications**

- Hypotheses can be grouped under broader questions without overbuilding taxonomy.
- Review surfaces can distinguish epistemic confidence from compositional usefulness.
- Phase 2 can build lineage and failure/archive views from stored revision metadata instead of backfilling intent later.

**Revisit trigger**

- Revisit if thesis management becomes a daily workflow bottleneck or if claim-level metadata proves too noisy for review.

## 2026-03-24 — Documentation Architecture

**Decision**

- `docs/` is the living strategy and doctrine layer for the project.
- `planning/` remains historical/bootstrap planning context.

**Rationale**

- `docs/` already contains the durable operating truths for the current system: loop spec, cadence rules, schema, metrics, and templates.
- `planning/` reads as MVP-era scaffolding and should not become the main strategic source of truth.

**Alternatives considered**

- Extend `planning/` with the new roadmap material.
- Collapse the new material into a single oversized README.

**Downstream implications**

- New strategic docs should be added in `docs/`.
- README should point to the strategic docs instead of absorbing them.

**Revisit trigger**

- Revisit only if the repo gets a dedicated docs site or another canonical documentation surface.

## 2026-03-24 — Roadmap Bias

**Decision**

- Prioritize research rigor and interpretation before public narrative expansion.

**Rationale**

- Better experiments produce better observations, which produce better public writing.
- Shipping narrative first would risk overclaiming relative to what the system has actually learned.

**Alternatives considered**

- Prioritize public editorial outputs first.
- Prioritize UX polish and representation first.

**Downstream implications**

- Phase 1 work centers on stakes, evidence framing, listening vocabulary, and revision discipline.
- Public publishing features come later in the roadmap.

**Revisit trigger**

- Revisit if the project develops an external audience whose needs materially change sequencing.

## 2026-03-24 — Public Publishing Doctrine

**Decision**

- Public storytelling should follow internal evidence quality and preserve uncertainty explicitly.

**Rationale**

- The project mixes evidence-backed material, speculative inspiration, and artistic intuition.
- Public outputs need to distinguish these clearly to remain trustworthy.

**Alternatives considered**

- Publish exploratory material with lighter framing.
- Treat all compelling internal synthesis as publishable by default.

**Downstream implications**

- Public recap formats should signal confidence and uncertainty.
- Private raw materials remain distinct from public summaries.

**Revisit trigger**

- Revisit if a formal editorial review process is added.

## 2026-03-24 — Graph Product Role

**Decision**

- Graph work must support decisions, not decoration.

**Rationale**

- The product already has a distinctive graph/navigation layer.
- Additional graph complexity is only worthwhile if it helps identify themes, blind spots, or high-yield areas.

**Alternatives considered**

- Expand graph visualization primarily for spectacle or exploration.

**Downstream implications**

- Future graph work should be evaluated on usefulness for choosing next experiments.
- Editorial signals matter more than visual novelty.

**Revisit trigger**

- Revisit if graph-driven navigation becomes the primary user workflow for a broader audience.

## 2026-03-24 — Contradictions and Failures

**Decision**

- Contradictions and failed experiments are first-class signals and should be preserved visibly.

**Rationale**

- The project becomes more cumulative and more honest when negative results remain available for comparison and reflection.

**Alternatives considered**

- Archive failed work quietly.
- Treat contradiction as noise rather than knowledge.

**Downstream implications**

- The roadmap includes a failure archive.
- Weekly and editorial synthesis should account for reversals, not only wins.

**Revisit trigger**

- Revisit if the archive becomes noisy enough that a sharper taxonomy of failure is required.

## Rejected Alternatives

- Treat `planning/` as the main evolving roadmap surface.
- Make graph expansion a first-wave priority without requiring decision support value.
- Lead with public narrative before internal rigor improvements.

## 2026-03-25 — Phase 2 Derived Failure Rules

**Decision**

- Implement the Phase 2 failure archive as a derived view rather than a dedicated table.
- Use these initial derived reasons:
  - `contradicted_hypothesis`
  - `retired_hypothesis`
  - `archived_recipe`
  - `low_expandability_composition`
  - `repeat_no_expand_composition`

**Rationale**

- Existing hypothesis, recipe, composition, and listening data already carries enough signal to make contradictions and low-yield paths visible.
- A derived archive keeps the first Phase 2 slice additive and avoids premature taxonomy lock-in.

**Alternatives considered**

- Introduce a dedicated `failures` table immediately.
- Limit the archive to explicit contradiction and retirement only.
- Wait to surface low-yield patterns until campaigns exist.

**Downstream implications**

- Weekly briefs can reference recent reversals by stable synthetic keys.
- Composition detail can show derived archive status without new write-time bookkeeping.

**Revisit trigger**

- If the archive becomes noisy, the next step is sharper failure taxonomy, not silent removal.
- Revisit if low-yield composition rules produce too many false positives or if editorial review needs explicit human-confirmed failure categories.

## Deferred Questions

- Whether thesis and campaign records should eventually have direct public-facing representations
- What scoring method should be used for graph yield and experiment prioritization
- How much structure the embodied listening vocabulary should enforce

## 2026-03-26 - Phase 3 brief persistence and campaign activation

**Decision**

- Store 10/30/90-minute studio prompts on each weekly brief at generation time.
- Persist deterministic recommended actions on the brief alongside the narrative markdown.
- Treat campaigns as the current implementation of themes/chapters.
- Enforce a single active campaign at a time.

**Rationale**

- Prompt variants need to remain stable enough to review, compare, and reuse after a weekly turn is generated.
- Recommended actions should not silently drift after the brief is written.
- A single active campaign keeps weekly steering legible and avoids turning campaigns into a backlog taxonomy.
- Using campaigns as the current theme abstraction avoids adding a second organizing table before the first one is proven.

**Alternatives considered**

- Generate studio prompts on demand from current state.
- Allow multiple active campaigns.
- Introduce separate `themes` and `campaigns` tables immediately.

**Downstream implications**

- Weekly brief detail can render persisted studio prompts without recomputing them.
- Campaign activation is now a scheduling/priority choice, not just metadata.
- Thesis detail is responsible for campaign attachment until a broader campaign route becomes necessary.

**Revisit trigger**

- Revisit if weekly briefs need explicit regeneration flows, if parallel campaign work becomes common, or if "theme" semantics diverge from campaign semantics in practice.

## 2026-04-01 — Phase 4 public narrative export contract

**Decision**

- Implement public narrative as curated `editorialArtifacts` inside Frequency Music, then export only approved public artifacts as markdown snapshots via `public_editorial_v1`.
- Keep the app auth-gated and treat Astro as the anonymous public surface.
- Reject repo-metadata loaders as the primary Astro ingestion path for editorial writing.

**Rationale**

- Public narrative needs explicit curation, uncertainty language, and evidence review instead of live joins over mutable internal records.
- Snapshot export prevents accidental leakage if linked private rows later change visibility or content.
- The evaluated repo-metadata loader pattern fits repository listings, not markdown article ingestion from an editorial export.

**Alternatives considered**

- Render public editorial pages directly from Convex at request time.
- Make weekly briefs, theses, or campaigns public by virtue of existing.
- Use a GitHub repository metadata loader as the site’s article source.

**Downstream implications**

- Publishing now requires explicit states: draft -> in review -> approved -> published.
- Public evidence is carried as sanitized cards on the artifact, not reconstructed from private rows at render time.
- Astro content collections should read exported markdown snapshots through a dedicated loader, ideally GitHub-backed with local fallback for smoke tests.

**Revisit trigger**

- Revisit if the public site needs live data instead of snapshots, or if editorial publishing grows into a richer CMS workflow than markdown export can support.

## 2026-04-18 — Next-Wave Sequencing

**Decision**

- Prioritize automation and machine-readable music control surfaces before DAW connectors, explorer expansion, or more advanced analytics.
- Treat native plugin work as a later validation step, not the first connector implementation.
- Keep next-wave roadmap material in `docs/` as an extension of the existing strategic layer.

**Rationale**

- Better ingest automation increases throughput immediately.
- DAW integration will be fragile if recipes and parameters remain prose-heavy or loosely typed.
- Representation work becomes more meaningful after the underlying loop is more automatic and more executable.

**Alternatives considered**

- Start with the 3D explorer expansion because it is highly visible.
- Build a native plugin first and shape the data contract around it later.
- Capture this roadmap only in ad hoc issue notes or chat history.

**Downstream implications**

- Early next-wave work should focus on ingest automation, parameter normalization, experiment structure, and export contracts.
- External connector work should start with a bridge or Max for Live path rather than a native plugin.
- New strategic planning docs for this wave belong in `docs/next-wave-roadmap.md` and `docs/next-wave-workstreams.md`.

**Revisit trigger**

- Revisit if a compelling connector prototype proves that plugin-first work would now accelerate the project more than export and bridge hardening.

## 2026-07-01 — Agent Draft Promotion + Worker Queue (Gate G2 backbone)

**Decision**

- Research data enters the system only through a single `agentReviewDrafts` table extended with a structured `payload` union (hypothesis/recipe) and human decision fields — not through per-type draft tables.
- Approval promotes a draft into a real hypothesis/recipe by inlining `ctx.db.insert` via pure, unit-tested builders in `agentDraftPromotion.ts` (Convex mutations cannot `runMutation`), stamping `origin: "agent"` provenance (`agentRunId`, `agentDraftId`, trace URL) and running the same `whyThisMatters` + concept-linking rigor as human creation.
- `approve`/`reject`/`supersede` are Clerk-authenticated human mutations, never exposed on `/agent-tools/*`; agents cannot approve their own work. Rejections require a note.
- The production worker claims runs through an atomic `queued → running` `claimNextPending` (stamping `workerId`), with a `sweepStaleRuns` cron so a crashed worker can't wedge the queue.

**Rationale**

- One extended table keeps promoted rows indistinguishable in rigor from human-authored ones and avoids schema sprawl.
- Pure builders make every promotion invariant testable without a live-DB harness (the repo has none) and keep the audit-only write policy intact.
- Atomic claim now prevents a two-worker future from double-running the same run.

**Alternatives considered**

- Per-type draft tables (`hypothesisDrafts`, `recipeDrafts`) — rejected as duplicative.
- Agent-callable approval — rejected outright; violates the human-in-the-loop invariant.
- Reusing `hypotheses.create`/`recipes.create` via `runMutation` — impossible from a mutation; shared pure builders used instead.

**Downstream implications**

- The research-pipeline specialist must emit the structured payload with a hallucinated-ID gate (plan 03 task 2); the review UI consumes `listPendingPublic` (task 4).
- Provenance fields enable plan 05 outcome/edit-capture joins back to the generating run.

**Revisit trigger**

- Revisit if draft volume exceeds weekly human review capacity → introduce batch tooling or eval-score-gated auto-approve tiers.

## 2026-07-03 — Architecture Deepening Wave (plans 2026-07-03-01..07)

**Decision**

- Adopt the `convex-test` harness for exercising Convex handler glue (mutations/actions) through the same interface production callers use — spiked under `bun:test` with an explicit module map, falling back to vitest scoped to `convex/harness/**` only if bun proves incompatible. Existing pure-helper `bun:test` suites stay.
- Shapes that cross the convex↔agent repo seam (agent draft payloads, run-event kinds, tool args, queue timing constants) become **zod-first** in `convex/shared/`, with Convex validators derived via `convex-helpers/server/zod4` (`zodToConvex`). Internal-only shapes (source/hypothesis/recipe status unions, recipe protocol, claims, studio prompts) remain **schema-canonical**: defined once in `convex/schema.ts` and imported everywhere else.
- Source intake unifies on `sourceUtils.generateDedupeKey` as the single dedupe contract; existing rows get a canonical-key backfill migration, and colliding duplicates are archived, never deleted.
- Already-run one-shot ingest scripts move to `scripts/archive/` untouched; a deep `scripts/lib/ingest.ts` ingestor serves recurring scripts and future manifest-driven batches.

**Rationale**

- Only a validator-enforcing harness catches the bug class that shipped twice (ctx.db-in-action breaking the Friday brief cron; `kind`-field rejection breaking recipe generation) — a hand-rolled writable fake never runs validators.
- The agent workspace needs zod at runtime (LangChain tools); deriving Convex validators from zod gives one source of truth instead of comment-enforced mirrors ("MUST mirror") that already drifted (`memory_recall`).
- Two intake paths computing different dedupe keys is a live data-integrity defect, not a style issue.
- Converting scripts that will never run again is rework with no payoff; the lib pays back on recurring and future work.

**Alternatives considered**

- Contract tests pinning hand-written zod to Convex validators (schema stays canonical for everything) — rejected in favor of true single-sourcing for cross-seam shapes.
- Extending the read-only `makeDb` fake into a writable one — rejected: re-implements Convex semantics by hand and cannot enforce validators.
- Converting or deleting the one-shot ingest scripts — rejected: archive preserves re-run provenance at zero refactor cost.

**Downstream implications**

- `convex/shared/` is a new purity-constrained seam: no `convex/server` or `_generated` imports; both workspaces and web may import from it.
- The Gate G2 pure promotion builders (2026-07-01) are unchanged; the harness adds the orchestration coverage those builders cannot reach.
- Tracing remains best-effort (2026-05-16); the shared LLM module becomes the single place that invariant is enforced.
- Plans live in `docs/plans/2026-07-03-0*-arch-*.md` with `00` as the master sequence.

**Revisit trigger**

- Revisit zod-first if `convex-helpers` zod4 derivation produces validator shapes that diverge from hand-written equivalents, or if zod major-version churn outpaces convex-helpers support. Revisit the bun harness path if `convex-test` module-map maintenance becomes noisy — that is the signal to move harness tests to vitest.

## 2026-07-07 — Correspondence Layer + Synthesis Rearchitecture (grilling session)

**Decision**

- The system's diagnosed failure is synthesis + agent productization, not capture: 1,580 extractions and a 4,000+-concept graph collapse to 19 hypotheses, 0 compositions, 0 agent drafts. Capture-side work is deprioritized in favor of making captured knowledge flow downstream.
- **Correspondence** becomes a first-class entity: an asserted link between two concepts from *different domains*, identified by its concept pair (dedupe key), evidenced by claim citations, with lifecycle `conjectured → evidenced | contradicted → retired`. A conjecture resolves by found evidence or by experiment (a derived hypothesis). Same-domain links remain plain edges.
- **Claims are promoted to first-class rows** (stable ids, `extractionId`/`sourceId` provenance), backfilled from the embedded arrays in 1,580 extractions. Correspondence evidence, embeddings, and cross-referencing all require claim addressability.
- **Two doors, one gate:** agents write graph enrichment (correspondences, edges, concepts) directly, provenance-stamped, with no review queue. The human gate sits at the point of irreversibility: entry into the experimental pipeline (hypothesis/recipe drafts) via the existing agent-draft review door.
- **Concept domains and mission relevance get backfilled** (LLM pass against the conceptDomains registry, multi-domain allowed, plus an on-mission/off-mission flag). Correspondence mining runs only over the on-mission, domain-classified core. The arXiv cs.SD/eess.AS feeds keep flowing; their concepts auto-flag off-mission. Dead feeds are removed.
- **Candidate discovery = embeddings propose, symbolic features score, LLM judges.** Convex native vector indexes over claims and concept descriptions; candidates are pairs semantically near but structurally distant (different domains, no existing edge/co-mention); the LangGraph agent evaluates the shortlist and writes correspondences with rationale.
- **Runtime seam:** single-step transforms with fixed inputs stay Convex generators (extraction, weekly brief); anything requiring search, traversal, or judgment over alternatives is a LangGraph graph producing drafts (correspondence mining, evidence hunting, hypothesis derivation from correspondences, source scouting). `hypotheses:generateFromExtraction` survives as a manual utility only.
- **Split cadence with WIP limit:** graph enrichment runs continuously; hypothesis drafting is pulsed and capped (drafting refuses to run at ≥3 pending drafts). The weekly brief is the single delivery vehicle for review asks: pending drafts, correspondence movement, contradicted conjectures (auto-retired), scouted feed proposals, and recipes in_use awaiting listening sessions.
- **Source Scout** is a new agent workload: need-directed discovery driven by graph gaps (under-represented domains, evidence-starved conjectures). Individual sources direct-ingest with provenance; new recurring feeds require human enablement.
- **Composition end is in scope:** every recipe auto-generates its machine-derivable starter kit (`.scl`/`.kbm` from tuning parameters, seed MIDI, parameter card) this wave; self-rendering micro-studies are a bounded follow-on spike (headless synthesis; Ableton Extensions SDK noted as an assist path). Machine-rendered studies must be validated against at least one human rendering of the same recipe before their listening data is trusted.
- Review UX in the web app is a first-class workstream: a draft review must be decidable in under two minutes, showing the correspondence (pair, evidence, domains), the derived hypothesis, and related prior hypotheses/failures.
- Prior plan waves: the 2026-07-03 architecture deepening wave presumptively stands (nothing formally sacred); the unexecuted agent-v2 plans (production worker scheduling, self-improvement loop) are to be re-derived against this decision set.

**Rationale**

- The repo's goal is hypotheses that connect frequency across disciplines, but the synthesis unit was a single extraction — a one-document-in generator cannot produce cross-discipline output except by accident. The concept graph (2,000+ edges) was never consulted during synthesis.
- Connections that live only in prompt context evaporate; products in this system are durable, reviewable rows. Making the connection itself the entity gives mining, evidence hunting, and experimentation one shared target.
- Human attention is the system's scarcest resource; the dead draft queue (0 reviewed ever) proves that gating cheap reversible artifacts kills throughput. Attention is spent at irreversibility instead.
- 99.4% of concepts were in domain "general" and the top concepts by mention were arXiv ML-engineering vocabulary — "cross-domain" was undefinable and an unfiltered miner would drown in junk pairs, recreating the distrust that parked agent v2.
- Embedding similarity across domain boundaries finds exactly the correspondence shape ("two literatures describing the same thing"); symbolic co-mention penalization keeps already-known links from dominating; LLM-as-judge over a shortlist is the job LLMs are good at.
- Micro-studies are by design one-variable, minimally artistic artifacts — the most mechanizable object in the ontology and the only thing between conjectures and embodied evidence.

**Alternatives considered**

- Richer RAG retrieval into the existing hypothesis generator, no new entity — rejected: connections wouldn't accumulate, dedupe, or feed the failure archive.
- Claim citations as `(extractionId, claimIndex)` tuples — rejected: re-extraction silently corrupts every citation.
- Gating mined correspondences through the draft queue — rejected on the evidence of that queue's history.
- Moving all synthesis to LangGraph (or all to Convex) — rejected: per-source extraction gains nothing from graph orchestration; multi-step tool-using mining fights Convex action limits.
- Continuous autonomous drafting — rejected: inventory rot erodes trust faster than throughput builds it.
- Symbolic-only or LLM-browsing-only candidate discovery — rejected: co-mention finds the already-connected; context-window browsing rediscovers the obvious.

**Downstream implications**

- Schema work: `claims` table + backfill; `correspondences` table (pair-keyed, claim-cited, lifecycle status, agent provenance); domain/relevance fields populated on concepts; vector indexes on claims and concepts.
- The extraction generator's write path changes (claims as rows, domains at creation) — coordinate with the 2026-07-03-03 LLM-module plan.
- The agent workspace's research-pipeline graph is superseded by: miner graph, evidence-hunter graph, hypothesis-drafting graph (WIP-capped), scout graph. The worker/leasing and draft-promotion machinery from Gate G2 is reused as-is.
- Weekly brief gains correspondence-movement, scouted-feed, and experiment-debt sections.
- Recipes gain a starter-kit artifact contract; `scales/` generation becomes code.
- The remaining agent-v2 plans (04 worker/scheduling, 05 self-improvement) must be re-derived; their assumption that draft *operationalization* was the bottleneck is overturned (see Reversals).

**Revisit trigger**

- If embedding-proposed candidates are mostly junk after the first mining wave, revisit discovery (tighten to evidenced concepts only, or re-weight symbolic features).
- If the WIP-capped drafting loop starves (cap always full because review never happens even at N=3), the bottleneck is review UX or brief delivery — fix those before raising or lowering N.
- If machine-rendered micro-studies fail validation against human renderings, self-rendering retreats to starter kits and the studio remains the render path.
- If off-mission flagging misclassifies enough on-mission concepts to matter, revisit single-pass LLM classification (add human spot-check or registry-seeded few-shot).

## 2026-07-16 — Auth Bypass Is the Agent Service Identity (SEC-01 resolution)

## **Decision**

`AUTH_BYPASS_ENABLED=true` stays permanently on. There is no dev/production split — the single self-hosted Convex instance IS production. Clerk authentication exists to track which humans log in; the auth bypass secret is the standing service identity for everything non-human: LangGraph agents, CI (the public editorial export), crons-adjacent scripts, and CLI mutations. The Wave-2 audit finding SEC-01, which read the enabled bypass as a dev misconfiguration leaked into production, is resolved as intended behavior.

## **Rationale**

Agents running against the database are a core part of the system, not an exception; they need unattended read/write access that Clerk's human login flow cannot provide. One shared bypass secret is the accepted mechanism for the current single-operator, small-collaborator deployment.

## **Alternatives considered**

Disabling the bypass and issuing a scoped CI/service identity (Clerk machine token or deploy-key-authenticated internal actions) — rejected for now as machinery the deployment size doesn't warrant; noted as the long-term direction in improvements ledger #20.

## **Downstream implications**

- Future audits must not re-flag the enabled bypass; auditors check secret **hygiene**, not the flag.
- The security burden concentrates on the secret itself: constant-time comparison (plan 014), rotation discipline with a consumer inventory + auth-failure alerting (ledger #20), and TLS for the plaintext site surface (#9).
- `plans/README.md` Wave-2 preamble updated to match.

## **Revisit trigger**

Broader external exposure (public automation surfaces, more collaborators, connector layer going live) or any evidence the secret leaked — at that point graduate agents to a real service identity per ledger #20.

## 2026-07-18 — Decision Surfaces: Coverage and Shaping, Not Initiation

## **Decision**

The web UI's job is **decision coverage, input/output shaping, and observability — not pipeline initiation**. Generation and mining stay scheduled/CLI-triggered; the UI is where the human decides and shapes. Concretely, four things enter the plan set:

1. **Plan 07 (review UX) is amended in place** to include edit-before-approve: `agentDrafts.approve` gains an optional `amendedPayload` (validated by the same shared zod schema the agent write path uses); the original agent payload is preserved on the draft row; promoted provenance records `approvedWithEdits` + `editedFields`. This explicitly overrides plan 07's original "no new decision semantics" constraint. Visual plan: plans.rproj.art `plan-6c6d455f77974bd3`.
2. **Domain triage becomes a standing surface** (new plan 2026-07-18-12): `promote`/`reject` mutations (merge with a scripted-assist fallback if remapping semantics balloon) plus a minimal triage UI. The 49-domain packet (`docs/review/domain-triage-2026-07-12.md`) is decided *through* the new surface. Runs parallel to plan 04, lands before plan 05 so the miner sees a curated registry.
3. **Recipe loop closure** (new plan 2026-07-18-13): approving a hypothesis auto-drafts its recipe through the agent-draft door (same WIP cap, same review queue), and the recipe review surface supports parameter editing + status transitions (fixing recipes being read-only in the UI). Lands after 07.
4. **Decision-surface sweep** (new plan 2026-07-18-14): correspondence adjudication view, weekly-brief edit/publish, draft supersede, extraction correction. After 08/09.

Generator steering (model/prompt/scope knobs in the UI) is **deferred but roadmapped** — next after the sweep, before any Phase-B cockpit work. The self-render bounded-spike framing (plan 11) was re-examined and **stands**.

Operator-item delegations recorded: the Proxmox worker restart + UNAUTHORIZED-caller hunt is now DA-executed (SSH/1Password/OpenTofu), gated before plan 05 counts as done; golden eval datasets become DA-prepared/Keith-ratified (pre-annotated candidates, single accept/reject pass), scheduled before recipe-loop-closure starts.

## **Rationale**

- A full audit of UI decision surfaces (2026-07-18) found approvals exist but are thin: draft approval was take-it-or-leave-it, recipes were read-only in the UI, correspondence adjudication was CLI-only by design, and domain triage had **no executable path anywhere** — the only decision point in the system that could not be executed even from the CLI.
- Take-it-or-leave-it review forces reject-and-regenerate loops on drafts that are 90% right — the same friction that produced the dead queue plan 07 exists to fix. Editing is part of the decision moment.
- Decisions parked in markdown don't happen (the triage packet sat six days untouched); decisions with buttons do. Triage is recurring, not one-off — the classifier keeps minting provisional domains.
- Auto-generating recipes on hypothesis approval extends "two doors, one gate" instead of bypassing it: automation of generation, human gate on entry.

## **Alternatives considered**

- A full operator cockpit (initiation + steering from the web) — rejected: the gap evidence points at decision coverage, and the loop-wave sequencing rule (synthesis first) stands.
- One-off script to apply the 49 triage decisions — rejected: clears today's queue, queue refills, surface still missing.
- Separate plan for edit-before-approve instead of amending 07 — rejected: it would rebuild the same review card twice.
- Committing to full machine rendering now — rejected: the validation-gated spike protects listening-data integrity, the loop's ground truth.

## **Downstream implications**

- `agentReviewDrafts` gains an optional `amendedPayload` field; promoted-row provenance gains `approvedWithEdits`/`editedFields`.
- The vocabulary registry gains triage mutations; the miner (plan 05) consumes a curated registry.
- `recipes.updateStatus` and recipe editing get UI surfaces; hypothesis approval schedules recipe drafting.
- CONTEXT.md updated: Draft Promotion (amendments), new Domain Triage term.
- Execution order: Wave-2 fixes (011–015) → 04 ∥ 12-triage → 05 → 06 → 07 (amended) → 13-recipe-loop → 08 → 09 → 14-sweep → 10 → 11 → generator steering.

## **Revisit trigger**

- If edit-before-approve sees near-zero use after a month of real drafts, the reject-note loop was sufficient — drop the amendment surface from the recipe path rather than extending it.
- If triage volume stays trivial (<5 provisional domains/month), the standing surface can freeze after the initial 49 are decided.
- If scheduled generation cadence feels wrong once volume arrives, that is the signal to build generator steering.

## Reversals / What Changed Our Mind

## 2026-07-07 — Agent drafts are no longer the only door

The 2026-07-01 doctrine held that the agent-draft review queue is the only door through which agent research enters the system. Overturned for graph enrichment: correspondences, edges, and concepts are agent-writable directly with provenance, because the review queue processed zero items in its lifetime while attention-cheap, reversible artifacts waited behind an attention-expensive gate. The draft door remains the only entrance to the experimental pipeline (hypotheses, recipes). Recorded with the 2026-07-07 correspondence-layer decision above.
