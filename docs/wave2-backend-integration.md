# Wave 2 backend integration

Merged to `main` in PR #138 (`db8cb39`, merge `6c83e4d`) from branch
`wave2/20261012-integration`, based on `5966c770`. As of 2026-10-13 no
deployment or migration has run from this lane; production deployment state is
unverified. The additive schema keeps legacy revisions optional. The staged
deployment, backfill, signer configuration and acceptance steps are in the
[rollout packet](wave2-rollout-packet.md).

## Shared contracts

`convex/shared/decisionIntents.ts` exports:

- `decisionCommandZ`, `decisionCommandValidator`, `DecisionCommand`.
- `decisionTargetZ`, `decisionProposalZ`, `decisionProposalValidator`.
- `decisionEventZ`, `decisionEventValidator`, `DecisionEvent`.
- `decisionResultZ`, `decisionResultValidator`, `DecisionResult`.
- `decisionIntentFieldsZ`, `decisionIntentValidator`, `decisionIntentReturnValidator`.
- `signerCardZ`, `signerCardValidator`, `decisionPlatformZ`, `decisionSourceZ`, `decisionStatusZ`.
- `listeningConditionsZ`, `listeningConditionsValidator`, `subjectiveRatingsZ`,
  `listeningIntentPayloadZ`, `listeningIntentPayloadValidator`.
- `webhookEventFieldsZ`, `webhookEventValidator`.
- `decisionDigestInput`, `decisionPayloadDigest`, `stableContentDigest`,
  `currentRevision`, `nextRevision`, `DECISION_TTL_MS`, `DOCKET_DEFERRAL_MS`.

The command is `{ action, target, payload }`. Targets are discriminated by
`kind`: `agentReviewDraft` has an `agentReviewDrafts` ID, `feedProposal` has a
`feeds` ID, and `composition` has a `compositions` ID. PR #141 (open, not
merged or deployed) adds `recipe` (a `recipes` ID) and `audioArtifact` (an
`audioArtifacts` ID). Those two carry no revision counter, so their proposals
record `targetContentHash` and a changed target rejects confirmation as stale.

| Action | Target | Payload |
| --- | --- | --- |
| `approve` | draft | `{ note?, amendedPayload? }` |
| `reject` | draft | `{ note }`, nonblank |
| `supersede` | draft | `{ byDraftId, note? }` |
| `enableFeed` | feed proposal | `{ note? }` |
| `defer` | any target kind (recipe and audio artifact with PR #141) | `{ note? }` |
| `createListeningSession` | composition | `{ conditions, ratings?, feltQualities?, standoutMoments?, expandVerdict? }` |
| `rateAudio` (PR #141) | audio artifact | `{ scores, conditions?, notes? }` |

Conditions are `{ listeningMethod: "headphones" | "monitors" | "car" |
"phone speaker", timeOfDay: string }`. The six subjective ratings are optional,
finite numbers from zero through five. Unknown fields, including
`consonanceComputed`, actor, and signature, are rejected on the proposal path.
The proposal transcript becomes listening feedback.

`convex/shared/docket.ts` exports `docketKindZ`, `docketCardFieldsZ`,
`docketCardValidator`, `docketCardReturnValidator`, `DocketCardFields`,
`docketCandidateZ`, `docketCandidateValidator`, `DocketCandidate`,
`docketDeliveryFieldsZ`, `docketDeliveryValidator`, and the list and delivery
window constants.

## Proposal and signer APIs

`decisionIntents.propose` is a public mutation with
`{ secret, command, proposal }`. It checks `AGENT_TOOL_SECRET`.
`decisionIntents.proposeInternal` takes `{ command, proposal }` and is intended
for an existing authenticated agent-tool wrapper. The wrapper must authenticate
the transport before calling it. Both return the stored intent document,
including `_id`, `code`, `payloadDigest`, `targetRevision`, status and expiry.
`proposal` is `{ channel, conversationId, messageRef, transcript }`.

Codes are generated serializably as `D-1`, `D-2`, and so on using the
`decisionIntentSequence` settings key. Proposals expire after 30 minutes.
There is no action or payload update endpoint.

Signer code uses these internal functions:

- `getInternal({ intentId })` and `getByCode({ code })` return the intent or null.
- `bindSignerCard({ intentId, signerCard: { platform, chatId, messageId } })`
  returns null. Bind only after successful posting. An identical bind is
  idempotent; a different binding is rejected.
- `apply({ event })` returns `DecisionResult`. The event is `{ intentId,
  platform: "discord" | "telegram", chatId, messageId, signerId, eventId,
  verb: "confirm" | "cancel", digest8? }`.

The HTTP owner must verify the platform request before invoking `apply`.
No apply, cancel, domain mutation, or signed-session endpoint belongs in the
agent manifest. `DECISION_SIGNERS` must be a JSON object mapping
`discord:<platform-user-id>` and `telegram:<platform-user-id>` to existing
Convex `users` IDs. Environment schemas include disabled defaults; no live secrets were configured.

Replay lookup precedes status/expiry, card binding, signer mapping, cancel,
digest, revision, and domain application. Invalid card, signer or digest events
receive rejection receipts without consuming the proposal. Expiry, stale targets
and domain validation failures terminate it. Domain writes run in a nested
mutation, so a failed application rolls back its writes while the rejection
receipt commits in the same outer transaction.

`DecisionResult` is `{ status: "proposed" | "applied" | "cancelled" |
"expired" | "rejected", appliedRecordId?, error? }`. Replayed platform events
return their original result. New events for an applied intent return the saved
result and create no second session or promotion.

## Web APIs and human identity

- `decisionIntents.get({ intentId })`: query returning intent or null.
- `decisionIntents.applyWeb({ intentId, digest8, eventId })`: mutation returning
  `DecisionResult`. Use the displayed digest prefix and a stable ID per click/retry.
- `decisionIntents.cancelWeb({ intentId, eventId })`: same result shape.

These functions require an authenticated human Clerk identity. Reads do not
require prior user provisioning. The first human mutation atomically creates
a `users` row for its authenticated subject when needed, with the collaborator
role; existing mappings and roles are preserved. The database row supplies the
real `users` ID. The service bypass and `subject: "system"` cannot confirm.
Web event IDs are namespaced by that user ID. Existing draft decisions, direct
human listening creation, and listening ownership checks use the same mapping.
Platform signer mappings still require explicitly configured existing users.

Draft projections include `decisionSource`, `decisionTranscript` and
`decisionIntentId` when present. Existing draft decisions call
`applyDraftDecision`, preserving promotion validation, amended provenance, graph
scheduling and run reconciliation. Direct feed toggles also require the human
mapping when enabling a disabled proposal.

`listening.createInternal({ intentId })` is an idempotent internal lookup of the
session already produced by an applied signed listening intent. Application
creates it through `createSignedListeningSession` inside the decision transaction.
It accepts no caller-supplied human identity or ratings and cannot create another
session for an applied intent.

## Revision rollout and write inventory

`decisionIntentsMigrations.backfillRevisions` is internal and takes
`{ table: "feeds" | "agentReviewDrafts", cursor: string | null, batchSize? }`.
It returns `{ cursor, done, updated }`; continue from the returned cursor until
done, separately for each table. Batches clamp to 1–100. Only absent revisions
are initialized to zero. Repeat runs preserve revisions written in the meantime.
Keep the schema optional until both tables finish migration.

| Table | Writers |
| --- | --- |
| Drafts | `createFromAgentRun` initializes zero; shared approve/reject/supersede increment on every decision write |
| Feeds | `create`, `proposeFeed`, `seedInitialFeeds`, `admin.createFeed` initialize zero |
| Feeds | `updateLastPolled`, `setEnabled`, `admin.setFeedEnabled`, signed `applyFeedProposal` increment on every write |
| Both | Backfill initializes only absent values; deletion makes confirmation fail as missing |

Polling intentionally invalidates an outstanding enable-feed proposal. There
is no timestamp or content-only revision exception.

## Text docket and delivery APIs

The service APIs below are internal. The five Wave 2 MCP operations use the
canonical authenticated agent-tool registry:

- `docket.currentState({})`: query of eligible candidates, with `debtSince`,
  independent of deferrals. It has no age cutoff.
- `docket.list({ weekly? })`: mutation that reconciles text cards and returns at
  most ten active cards, or three when weekly. Confirmed deferrals are excluded.
- `docket.card({ cardId })`: query returning an active eligible card or null.
- `docket.recordDelivery({ cardId, channel, contentHash, phase, deliveryId?,
  messageRef? })`: mutation returning `{ admitted, deliveryId, updated }`.

Use the exact returned `contentHash`. With `phase: "posting"`, send a message
only when `admitted` is true. Complete that exact receipt with `phase: "posted"`,
its `deliveryId`, and actual `messageRef`. Pending posting suppresses all versions
for 24 hours; posted unchanged content suppresses for seven days. Changed content
can be admitted with `updated: true`. Retrying posted completion is idempotent.
No fake channel messages or receipts were created outside tests.

Cards have relative `pageUrl`s. The transport can resolve them against the
configured website origin. The MCP projection emits optional `audioUrl` only after
`docket.playbackForCard` validates current content, narration provenance, house
voice, eligibility and blindness. `blurbArtifactId` references `audioArtifacts`,
never storage, and is not exposed in the MCP projection.

## Remaining work and constraints

- Proposal, docket and receipt tools, web confirmation, and signer handlers are
  merged. Platform configuration and deployed acceptance remain; see the
  [rollout packet](wave2-rollout-packet.md).
  See `docs/wave2-signer-integration.md` and `web/docs/wave2-review-integration.md`.
- Generated 60–90-word blurbs, guarded house-voice narration, stale/version
  checks, media-completion hooks and Thursday preparation are implemented.
  `DOCKET_PREPARATION_ENABLED=false` and `DECISION_SIGNERS_ENABLED=false`
  keep inference, narration preparation and signer delivery disabled by default.
- On `main`, `unratedAudio` checks the existing `voiceRatings` artifact
  references and excludes unrevealed blind members in both directions, and the
  rating submission API only supports voice shootouts.
- PR #141 (open draft, not merged or deployed) implements general ratings and
  recipe/audio deferral; its contract is `docs/audio-feedback-contract.md`,
  added by that PR. Ratings go to a new
  `audioRatings` table, keyed to the content hash that was heard. Only a ready,
  stored, blind-safe `role: "delivery"` episode or litmus render is a feedback
  target. Render masters, which share the `litmusRender` kind, never reach the
  queue, the docket or a signed rating. With it, `unratedAudio` cards offer
  `rateAudio` and `defer`, and recipe cards offer `defer`.
- PR #140 (open, not merged or deployed) produces those litmus renders as a
  master and its delivery. They remain `unvalidated`, with no composition,
  until `renderValidation=go`. A human rating does not validate a render.
  Study-family members stay hidden until their blind group is revealed. The
  assembly and its cross-lane test are described in the
  [rollout packet](wave2-rollout-packet.md#listen-first-next-tracks).
- Existing API declarations were updated by hand for the new modules.
  No Convex codegen, run, dev or deploy command was executed.

## Validation and worktree setup

The assembled integration passed `vp run verify` with 1,894 tests, all package
typechecks, formatting and lint, plus the web build and both isolated browser
suites. The final signer shared-budget fix is included in that run and passed independent
review with no actionable P0–P2 findings. The web, Listen lookup, MCP playback,
shared pitch, offline renderer and tournament core also passed their scoped reviews. No production acceptance is claimed.

### Initial backend-only validation

The following records the earlier isolated backend task and its setup limitations.
The assembled integration resolved the generated-CSS and dependency blockers.


- Backend, scripts and harness: 124 files, 1,179 tests passed with
  `vp test convex scripts harness --no-file-parallelism`.
- Latest focused decision/docket/shared-contract/draft-harness run: four files,
  50 tests passed, including seven tests added after the broad run.
- Agent: 32 files, 321 tests passed. Media: 14 files, 98 tests passed.
- Formatting, lint, root TypeScript, agent TypeScript and media TypeScript passed.
- `vp run verify` was attempted. It stops at web TypeScript because the fresh
  worktree has no generated `web/styled-system/css` or
  `web/styled-system/types/tokens`. This setup prerequisite predates these source
  changes. No web source or generated CSS was changed in this backend task.
- Installing web and agent dependencies initially failed with `EDQUOT`. Their
  incomplete local dependency directories were removed and replaced with
  ignored symlinks to the already installed dependencies in the main checkout.
  Root and media dependencies are installed locally. No lockfile changed.
- A parallel Vite invocation intermittently failed with temporary-file `ENOENT`
  during lazy imports. The serialized broad and focused runs above passed.
- `git diff --check` passed. Changes remain uncommitted for parent review.
