The specs are not ready for implementation planning. The main blockers are the agent-callable decision path, incomplete media lifecycle contracts, invalid audio-delivery assumptions, and rendering rules that do not yet preserve experimental validity.

I read all five specs and the requested repository files. References below use **Umbrella**, **Voice**, **Docket**, **Render**, and **Tournament** for the corresponding spec files.

## Blocking issues

1. **Voice confirmation exposes the forbidden human decision operation.** [Docket §§3, 4][docket] makes `decision.confirm` agent-callable and lets it promote, reject, or supersede drafts. Keeping the existing mutation names off MCP does not preserve the guardrail when another tool performs their effects. `senderId`, transcript, and a server-generated code returned to the agent are not a human signature; the caller can replay or fabricate them. This contradicts [Umbrella §3.6][umbrella], [the agent-tool contract][tool-contract], and [agentDrafts.ts][decisions]. Keep agent tools proposal-only. Confirmation must reach a separate human-authenticated endpoint through Clerk or a verified channel integration whose identity and message evidence the model cannot supply.

2. **The proposed audio proxy cannot serve the promised episode sizes, and storage URLs are not short-lived.** [Umbrella §3.5][umbrella] accepts whole-response delivery for 20–40-minute episodes. Convex documents a [20 MiB HTTP response limit][convex-limits]; 40 minutes at 128 kbps is approximately 38.4 MB, before metadata. Streaming terminology does not remove that limit. [Render §4][render] also promises expiring Convex storage URLs, but [Convex’s storage documentation][convex-files] explicitly directs expiring-URL use cases elsewhere. Select the large-file delivery and authorization mechanism before planning. Define byte-range/HEAD behavior, token rotation, and which artifacts are shareable; the generic artifact route must not make private voice notes available to every feed-token holder.

3. **The media contract lacks safe retry and completion semantics.** [Umbrella §§3.1, 3.3][umbrella] deduplicates only against `ready` artifacts. Concurrent enqueues, crashes after upload, and stale workers completing after reassignment can still duplicate or overwrite results. There is no lease token, heartbeat/renewal, retry transition, or atomic relationship between artifact registration and job completion. More fundamentally, [Render §§2.2, 2.4][render] requires the media worker to create compositions and listening rows, while the listed media tools only claim jobs and register files and explicitly exclude research-data writes. Specify atomic enqueue deduplication, fenced claims, dependency readiness, and job-specific completion mutations that validate and persist the permitted domain effects. Reuse the principles in [runner.ts][runner] and [agentContract.ts][agent-contract], not merely the sweeper’s name.

4. **The render plan cannot express or enforce its single-variable promise.** [Render §§2.1, 2.2, 6][render] assumes an executable `whatVaries` parameter, but [draftPayloads.ts][payloads] defines it as an array of free-text strings. `variants: string[]` does not identify the parameter, baseline value, replacement values, or supported transformation. The [tuning library][tuning] emits Scala files but has no Scala/KBM reader or MIDI-to-Hz mapping and no general reference-frequency override. The [seed generator][seed] rounds intervals to semitones and derives its note palette from the tuning; regenerating it for another temperament can change the musical sequence too. Define a typed, bounded render contract, freeze non-varied events, and reject unsupported protocols. Include explicit duration handling: the current seed generator does not consume `protocol.durationSecs`.

5. **The spec replaces the binding render-validation gate with a different test.** [Render §2.1][render] calls “first three renders, under 0.5 cents” the validation rule from plan 11. [Plan 11][spike] actually requires a bounded spike, human-versus-machine listening, a render-quality contamination assessment, and a go/no-go recommendation before productionization. Pitch accuracy is necessary but cannot establish that ratings concern the hypothesis rather than unpleasant synthesis. Preserve both gates and keep unvalidated render ratings out of trusted evidence and tournament fitness.

6. **Machine analysis would falsely close human listening debt.** [Render §2.4][render] says a participant role excludes machine rows from human averages. No such general exclusion exists. [weeklyBriefs.ts][loop-report] treats the existence of *any* listening session as debt closure; [dashboard.ts][dashboard] takes the newest session for verdict signals. An analysis row can therefore remove an unheard render from the docket or hide a human expansion verdict. Define one shared human-session predicate and apply it to debt, recommendations, verdict selection, failure analysis, and fitness. Keeping computed analysis on the artifact would avoid much of this coupling.

7. **Blindness is not enforced across the available views.** [Umbrella §3.2][umbrella] hides one label map, while [Render §4][render] exposes source records and engines in the queue and [Umbrella §3.1][umbrella] stores identifying metadata on artifacts. Ordinary detail queries, filenames, tags, and reused A/X URLs can reveal the condition. Neither spec defines the required-rating set, atomic submission/reveal, nor how three- or four-member families fit an A/B/X interface. Define a server-side blind projection with opaque playback handles and an immutable group membership set. Record X identification separately; do not count its duplicated audio as an independent composition rating.

8. **Tournament seeds do not fit the claimed unchanged payload and evidence contract.** [Tournament §§2, 3][tournament] claims the existing payload contains a falsification condition and recipe sketch; [draftPayloads.ts][payloads] contains neither. The unchanged [self-check prompt][drafter-prompts] requires supplied evidence claim IDs and correspondence context. Listening, sweep, doctrine, and hint seeds do not define how they obtain that evidence or populate source/extraction provenance. Define a shared seed union, evidence gathering, payload mapping, and a compatible self-check before implementing the new graph. Do not resolve the mismatch by weakening evidence checks.

## Should fix before planning

1. **Specify confirmation races and replay behavior even after fixing authentication.** [Docket §4][docket] accepts “confirm,” then requires both “confirm” and the code. The schema stores only one transcript/message reference, despite promising evidence of two messages. Bind an intent to the target version and exact payload, channel-scoped signer, conversation, and distinct confirmation message. Apply the decision and consume the intent in one mutation. A duplicate confirmation should return its previous result. The current [decision mutations][decisions] already enforce pending status and promotion invariants; those checks and run reconciliation must survive any refactor.

2. **Complete the media relationships and minimum record shapes.** [Umbrella §3.1][umbrella] says one artifact per file, but provides no master/MP3 relationship or unambiguous encoding component in the hash. [Voice §4][voice] writes `refs.blindGroupId`, although the umbrella puts that field at the top level. Chapter timing has no persisted contract. [Render §2.2][render] omits required composition fields such as `version` and `visibility`; §§1 and 2.4 assume standalone litmus renders also have compositions, without specifying their creation. Define these relationships, voice-note attachment before submission, and stable episode identity before freezing wave 0.

3. **Docket sources do not match the existing census.** [Docket §5][docket] describes pending-draft and composition cards, but [the loop report][loop-report] returns a hypothesis-draft count and debt collapsed by recipe, without composition IDs. It includes only `in_use` recipes and rendered compositions older than 14 days. Thus the umbrella’s 17 draft recipes would not enter `recipeNoComposition` through that census. Define a dedicated current-state query with explicit eligibility, target IDs, deduplication, and preserved deferrals. [Render §5][render] should also explain why `rendered_no_listening` differs from the existing `composed_no_listening`, which already selects rendered compositions.

4. **The scheduling does not guarantee the outcomes.** [Docket §5][docket] rebuilds at Thursday 15:00, before the [16:00 drafter cron][crons], so the scheduled snapshot can omit that day’s draft. [Voice §§1, 5][voice] promises delivery within an hour but starts narration at 17:00, after the 16:00 brief job. Fixed offsets neither guarantee source completion nor enforce `narrate` → `assembleEpisode` readiness. Trigger downstream jobs from persisted source/completion events and retain crons for reconciliation. Define behavior when [brief generation rejects a week with no recent hypotheses or recipes][brief-empty], and persist per-channel delivery receipts so HEARTBEAT retries do not repost cards.

5. **The roughness score and calibration are undefined.** [Render §2.4][render] refers to a 0–5 mapping curve in [metrics-and-dissonance.md][metrics]; that document supplies no curve and describes computed consonance on a 0–1 scale. Specify the algorithm/version, spectral peak extraction, amplitude normalization, silence handling, temporal aggregation, and calibrated mapping. A fifth-versus-second fixture alone does not validate arbitrary rendered music. Store raw roughness separately from any interpreted score.

6. **Loudness tolerances undermine comparison hygiene.** [Umbrella §3.4][umbrella], [Voice §§4, 7][voice], and [Render §2.1][render] need one explicit policy for channel layout, comparison matching, true peaks, and encoded-file verification. Allowing takes outside ±1 LU to proceed leaves level as a preference cue; allowing peaks up to −0.1 dBTP contradicts the stated −1 dBTP ceiling. Measure decoded MP3 true peaks as well as masters. Preserve a pre-normalization master and define what happens when loudness or dynamics is itself the experimental variable.

7. **Listening capture omits required context and conflates subjective and computed ratings.** [Docket §7][docket] records the channel as context, but [cadence rules][cadence] require headphones/monitors and time-of-day context. [Render §4][render] reuses a “seven-rating” form even though one field is machine-computed; [metrics][metrics] defines six subjective scales. Ask only for applicable human ratings, preserve missing values, validate every supplied value, and capture listening conditions. [listening.ts][listening] currently range-checks only expandability, so simply reusing its internals is insufficient.

8. **Tournament budgets and scores are not what the spec claims.** [Tournament §§2, 7][tournament] treats `TOKEN_BUDGETS` as a run budget, but [llm.ts][llm] defines per-call output caps, and [judge.ts][judge] does not consume them. Specify aggregate call/token/cost/time limits, retry accounting, and reserved capacity for self-check and persistence. Fresh Elo pools are not comparable across runs without anchors. Judge failures should remain missing judgments rather than fabricated draws; otherwise an insufficiently evaluated candidate can become the fallback winner.

9. **The semantic gate needs a migration and a scientific distinction.** [Tournament §§2, 4][tournament] searches hypotheses, drafts, candidates, and failures, but [schema.ts][schema] currently has vector indexes only for claims and concepts; failures are derived records. Define embedding ownership, model/dimensions, backfill, update/delete behavior, and readiness. Compare siblings and evolved candidates too. A fixed 0.86 threshold should retrieve possible duplicates, not automatically reject inversions: opposite predictions and useful refinements can be semantically close. Losing an LLM tournament is also not experimental falsification.

10. **Tournament persistence and rollout need explicit contracts.** [Tournament §§2, 4, 5, 8][tournament] registers only `runner.ts`, but execution also requires [shared graph names and terminal ownership][agent-contract] and [graphInput.ts][graph-input]. Non-correspondence draft writes lack the existing correspondence-specific retry deduplication in [agentDrafts.ts][draft-create]. End-of-run archive writes can be lost after the draft succeeds, and `mutatedFrom` needs a stable batch-ID mapping. Specify run/candidate idempotency and recovery. Also reconcile the “first three reviewed drafts” switch with the later ten-run evaluation and the [existing baseline-first planning gate][plans].

11. **Generated Strudel patterns need an execution boundary.** [Render §3][render] places LLM-generated executable patterns in the authenticated web application. An evaluation-error message does not constrain what successfully evaluated code can access. Specify a restricted pattern representation or isolated execution context, resource limits, and explicit playback initiation. Derive pitches deterministically where possible.

12. **The waves can share development time, but cannot all ship independently after wave 0.** The [umbrella dependency table][umbrella] understates the critical path:
   - Wave 1 needs its own minimal rating/reveal panel and voice-selection flow; it cannot wait for wave 3’s full page.
   - Wave 2’s text docket can proceed independently. Spoken delivery needs the chosen voice and a supported OpenClaw adapter. Human decisions need blocker 1 resolved first.
   - Wave 3 needs executable kit contracts and plan 11’s listening validation before trusted production rendering. Study-family episodes additionally need wave 1.
   - Wave 4 can be developed independently, but live comparison needs queue capacity and human reviews. Listening fitness additionally needs promoted hypotheses, recipes, rendered compositions, and human sessions. The [plan ledger][plans] still places recipe-loop closure behind baseline evaluation.

   Freeze these shared contracts before parallel implementation, and identify which existing plan gates this program explicitly supersedes.

## Suggestions

1. **Shrink wave 0 to what the first deliverable needs.** [Umbrella §§3.1–3.4][umbrella] front-loads every media kind, multiple engines, analysis, and transcription. Start with a reliable file/job lifecycle, suitable audio hosting, and the shootout panel. Add typed job variants as their waves land.

2. **Reduce the render ladder until the listening gate passes.** [Render §§2, 3][render] can achieve audible recipes and controlled comparison with one SuperCollider renderer and a basic player. Defer Surge, Strudel generation, ACE-Step expansion, and waveform-region tooling until validated litmus renders are useful. This follows [plan 11’s first-working-engine rule][spike].

3. **Keep tournament breadth; simplify selection.** [Tournament §§2, 6][tournament] can still consider eight candidates with a scored shortlist and a small finalist comparison. Defer Swiss pairing, cross-run Elo, evolution, and adaptive family weights until reviewed outcomes justify them. Otherwise most of the new machinery measures agreement between model judgments.

4. **Avoid a second passage-index design.** [Tournament §3][tournament] introduces `essayPassages` through the “existing embedding pipeline,” while [the plan ledger][plans] and [ADR 0001][embedding-adr] already define a passage program with a separate embedding space. Reuse that ownership and model decision, or explicitly document why essay retrieval differs.

## Questions for the author

1. **Which exact provider models, voices, licenses, and OpenClaw version were verified?** [Voice §2][voice] names products but leaves executable catalog entries unresolved; [Docket §2][docket] assumes every possible winner maps directly to OpenClaw TTS. [Umbrella §3.4][umbrella] describes only a Breeze local server, while the shootout also needs Qwen. The local container must run *before* a local winner can be selected.

2. **What is the first release’s acceptance boundary?** [Umbrella §1][umbrella] combines four substantial outcomes. Is the first accepted result a chosen voice and working feed, a cleared docket, or validated machine listening? That choice determines which infrastructure belongs on the critical path.

3. **Is A/B/X intended as a discrimination experiment or a preference workflow?** [Render §§2.2, 4][render] combines one X guess, subjective ratings, immediate reveal, and up to four conditions. If discrimination evidence matters, define trial count, randomization, stopping, and interpretation. If preference is the goal, blinded A/B ratings are sufficient.

4. **How should the program treat missing or unreviewed outcomes?** [Tournament §6][tournament] starts adaptive fitness after five rated compositions overall, potentially with none in several families, and leaves the numeric meaning of “expand verdict rate” unspecified. Define per-family minimum evidence, repeated-session aggregation, treatment of “maybe,” and unknown outcomes before changing sampling weights.

## What is good

- [Umbrella §2][umbrella] identifies the unopened human review queue as the immediate bottleneck. The [Docket §§1, 5][docket] emphasis on a few actionable cards addresses it directly.
- [Voice §§2, 4][voice] makes listening quality a human choice and separates ratings from explicit house-voice selection.
- [Render §§2.1, 2.3][render] uses a fixed litmus timbre and excludes generative expansion from microtonal experimental evidence.
- [Tournament §§1, 9][tournament] retains one submitted draft and human promotion. The existing [draft-create mutation][draft-create] independently enforces the hypothesis cap of three, protecting it against concurrent runs.
- [Umbrella §3.6][umbrella] correctly places shared contracts in `convex/shared/`, requires catalog registration, and makes production deployment explicit. I found no instruction to alter frozen archive scripts or introduce a Llama model.

No files were modified and no live Convex commands were run. `vp run verify` could not start because the checkout lacks a project-local Vite Plus installation and the `biome` executable; this pre-existing environment blocker prevented validation.

Automatic approval review rejected the Hindsight keyword search because it would send repository-specific metadata to that service. Permitted knowledge-page reads and local source inspection supplied the review context.

[umbrella]: docs/superpowers/specs/2026-09-28-listen-first-program-design.md
[voice]: docs/superpowers/specs/2026-09-28-voice-and-podcast-feed-design.md
[docket]: docs/superpowers/specs/2026-09-28-freq-docket-and-voice-decisions-design.md
[render]: docs/superpowers/specs/2026-09-28-render-ladder-and-listen-page-design.md
[tournament]: docs/superpowers/specs/2026-09-28-hypothesis-tournament-design.md
[tool-contract]: docs/agent-tool-surface.md
[decisions]: convex/agentDrafts.ts:772
[draft-create]: convex/agentDrafts.ts:252
[runner]: agent/src/worker/runner.ts
[agent-contract]: convex/shared/agentContract.ts
[payloads]: convex/shared/draftPayloads.ts
[tuning]: scripts/lib/tuning.ts:378
[seed]: scripts/lib/seedMidi.ts:127
[spike]: docs/plans/2026-07-07-11-loop-selfrender-spike.md
[loop-report]: convex/weeklyBriefs.ts:479
[dashboard]: convex/dashboard.ts:667
[drafter-prompts]: agent/src/graphs/hypothesis-drafter/prompts.ts
[crons]: convex/crons.ts
[brief-empty]: convex/weeklyBriefs.ts:789
[metrics]: docs/metrics-and-dissonance.md
[cadence]: docs/cadence-and-operating-rules.md
[listening]: convex/listening.ts
[llm]: convex/llm.ts:46
[judge]: agent/src/graphs/shared/judge.ts
[schema]: convex/schema.ts
[graph-input]: agent/src/worker/graphInput.ts
[plans]: docs/plans/README.md
[embedding-adr]: docs/adr/0001-split-embedding-spaces-for-passages.md
[convex-limits]: https://docs.convex.dev/production/state/limits
[convex-files]: https://docs.convex.dev/file-storage/serve-files