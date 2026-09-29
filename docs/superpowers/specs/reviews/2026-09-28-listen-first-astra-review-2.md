## Verdict

**Ready for planning: no.** The revision resolves 8 of the 20 findings and partially resolves 12.

The signer-bot approach is **acceptable in principle** under AGENTS.md’s human-approval rule. Discord’s verified interaction and Telegram’s secret-authenticated webhook can establish platform-attributed human approval; a personal cryptographic signature is not required. Telegram’s `secret_token` authenticates the webhook sender, however, not the human independently. This requires isolated credentials, authenticated HTTPS ingress, and server-side identity and intent binding. The design still leaves those bindings incomplete, and [docs/agent-tool-surface.md][tools] still explicitly describes decisions as Clerk-authenticated.

## Resolution table

B and S numbers correspond to the original report.

| Item | Status | Reason and spec section |
|---|---|---|
| B1 — Agent-callable decisions | Partially | [Docket §§3–4][D] removes agent confirmation and introduces platform authentication, but intent binding and the Clerk-only contract update remain incomplete. |
| B2 — Audio delivery | Resolved | [Umbrella §3.5][U] uses permanent storage capability URLs, isolates feed discovery, and specifies Range/HEAD verification with a static-host fallback. |
| B3 — Media lifecycle | Partially | [Umbrella §3.3][U] adds deduplication, leases and atomic domain effects, but expiry-time completion checks, crash-attempt accounting and uploaded-orphan recovery remain unspecified. |
| B4 — Executable render contract | Partially | [Render §3.2][R] freezes events and handles duration, but MIDI-to-degree recovery is lossy, the frequency anchor is missing, and variable types are not discriminated. |
| B5 — Render-validation gate | Resolved | [Render §2][R] restores the human comparison, contamination assessment, written go/no-go and exclusion of unvalidated evidence. |
| B6 — Machine listening debt | Resolved | [Umbrella §§3.1, 3.6][U] keeps analysis off sessions and requires the shared human predicate across downstream consumers. |
| B7 — Blindness | Partially | [Umbrella §3.2][U] and [Render §§3.3–4][R] add projection, immutable membership and atomic reveal, but do not prevent X/source URL equality or identifying embedded file metadata. |
| B8 — Tournament payload/evidence | Partially | [Tournament §2][T] names the correct payload fields, but its search tool does not return `extractionId`, and the evidence-bearing seed/context contract remains undefined. |
| S1 — Confirmation races/replay | Partially | [Docket §4.4][D] adds atomic consumption and target-version checks, but omits immutable payload/action binding, trusted card/conversation binding and platform-event replay rules. |
| S2 — Media relationships | Partially | [Umbrella §3.1][U], [Voice §§3, 6][V] and [Render §4][R] improve record shapes, but pre-/post-normalization master linkage and voice-note ownership before session submission remain unspecified. |
| S3 — Docket census | Resolved | [Docket §5][D] defines a dedicated current-state query with target IDs, draft-recipe eligibility, deduplication and preserved deferrals. |
| S4 — Scheduling/delivery | Partially | [Voice §5][V] makes brief narration/assembly event-driven, but [Docket §§5–6][D] still assumes fixed narration timing and leaves a crash gap between posting and recording delivery. |
| S5 — Roughness/calibration | Resolved | [Render §3.4][R] specifies a versioned raw-analysis pipeline and defers interpreted scores until human calibration exists. |
| S6 — Loudness | Resolved | [Umbrella §3.4][U] unifies tolerances, layout, decoded-delivery true peaks, preserved masters and normalization exceptions. |
| S7 — Listening capture | Partially | [Docket §7][D] supplies conditions and six-rating validation, but “asking for anything missing” does not preserve omitted or inapplicable subjective ratings. |
| S8 — Tournament budgets/scoring | Partially | [Tournament §2][T] bounds calls/time and removes fabricated draws, but lacks aggregate token/cost limits, retry accounting and a budgeted generation revision. |
| S9 — Semantic gate | Partially | [Tournament §§2, 4][T] distinguishes duplicates from inversions and adds backfill, but omits current-batch sibling comparisons and embedding freshness/readiness rules. |
| S10 — Persistence/rollout | Partially | [Tournament §§2, 4–5][T] adds registration, dedupe and baseline-gated rollout, but its archive writes precede final self-check/persistence and never specify the final `draftId`/outcome update or recovery. |
| S11 — Generated-code boundary | Resolved | [Render §9][R] defers Strudel generation and explicitly retains the isolation requirement. |
| S12 — Wave dependencies | Resolved | [Umbrella §§2, 3.7][U] and [Tournament §5][T] identify the acceptance boundary, voice/episode dependencies, human gates and retained baseline requirements. |

## New issues

1. **Completed-job deduplication suppresses legitimate re-renders.** [Umbrella §3.3][U] permanently reuses a done job with the same `sha256(kind, input)`, while [Render §3.3][R] gives `studyFamily` only `{ recipeId }`. Editing that recipe’s render plan therefore returns the previous completed job. Snapshot the plan and source revision at enqueue time; include renderer/configuration versions in job identity. Otherwise a worker can also render a different recipe revision from the one requested.

2. **The new listening-intent contract cannot represent its own creation action.** [Docket §§4.3–4.4, 7][D] requires an existing target ID and `updatedAt`, then uses that intent to create a listening session. The session does not yet exist, and existing `listeningSessions` have no `updatedAt` field. Bind creation to the composition and a unique intent instead. Also map each platform signer to an application user: the schema requires `createdBy` to be a user ID or `"system"`, while the new human-session predicate excludes system-created sessions.

Residual signer risks remain under B1/S1, rather than being separate new findings. Atomic consumption and pending-status checks prevent two confirmations from promoting the same draft. They do **not** specify which displayed payload was approved, whether a button’s action must match the stored intent, or whether an event belongs to the expected platform, signer card and conversation. `updatedAt` is also a timestamp, not a guaranteed unique revision.

## Remaining suggestions

- **Finish the signer envelope.** Use platform-scoped signer IDs; bind the intent to an immutable action, payload digest, target revision and server-recorded card/conversation. Verify Discord’s raw-body signature and timestamp with a freshness policy; authenticate Telegram’s webhook over HTTPS and deduplicate its update/callback IDs. Return the stored result for retries before enforcing the `proposed` precondition. Preserve cancellation races, supersede’s `byDraftId` validation and run reconciliation. Update the agent-tool contract explicitly.

- **Replace MIDI recovery with degree-native generation.** [seedMidi.ts][seed] rounds cents and deduplicates pitch classes: 19-EDO degrees 1 and 2 both become semitone offset 1. Their identities cannot be recovered afterward. Generate degree events before that conversion. [tuning.ts][tuning] supplies intervals and Scala/KBM output, but no degree-to-Hz function; its KBM anchors MIDI 69 at the reference frequency. Define the render contract’s reference degree/octave, root mapping, cross-temperament degree compatibility and numeric bounds. Make temperament and reference-frequency variants separate union members.

- **Complete the tournament’s evidence adapter.** [draftPayloads.ts][payload] requires source/extraction arrays but has no evidence-claim field or `seedFamily`. Keep seed/evidence metadata in a typed wrapper and retain literal claim citations in the rationale. [`searchClaimsSemantic`][search] returns claim/source IDs but no extraction IDs, so add trusted hydration. The hallucinated-ID gate lives inside the research-pipeline graph; explicitly reuse its ID tracking and validation. Preserve all three checks in [the existing prompt][prompts]: 30–90-second testability, one variable and grounded citations. Regenerate with gathered evidence before checking, and recheck duplicates if revision changes the statement.

- **Close the recovery and validation-order gaps.** Count expired media leases toward the retry limit. Persist tournament outcomes after self-check and draft creation with recoverable linkage. Provide the minimal blind human-versus-machine comparison UI before the render go/no-go; [Umbrella §3.7][U] currently places the listen page and study families after that decision.

No files were modified or live Convex commands run. `vp run verify` could not start because project-local Vite Plus and `biome` are missing, the same pre-existing blocker recorded in review 1.

Automatic approval review rejected the Hindsight search and page listing because they could disclose repository metadata externally. Local inspection supplied the review evidence.

[U]: docs/superpowers/specs/2026-09-28-listen-first-program-design.md
[V]: docs/superpowers/specs/2026-09-28-voice-and-podcast-feed-design.md
[D]: docs/superpowers/specs/2026-09-28-freq-docket-and-voice-decisions-design.md
[R]: docs/superpowers/specs/2026-09-28-render-ladder-and-listen-page-design.md
[T]: docs/superpowers/specs/2026-09-28-hypothesis-tournament-design.md
[tools]: docs/agent-tool-surface.md
[seed]: scripts/lib/seedMidi.ts:144
[tuning]: scripts/lib/tuning.ts:378
[payload]: convex/shared/draftPayloads.ts:24
[search]: convex/correspondenceCandidates.ts:681
[prompts]: agent/src/graphs/hypothesis-drafter/prompts.ts
