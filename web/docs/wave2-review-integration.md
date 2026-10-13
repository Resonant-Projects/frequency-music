# Wave 2 web review integration

Integrated in `wave2/20261012-integration` against the assembled backend contracts. This slice includes the web bindings and `convex/audioArtifacts.ts`. No production requests, provisioning, Convex codegen, migrations, deployment, or paid jobs were run.

## Current bindings

`/agent-drafts?intent=<id>` mounts `IntentReviewBinding` for that route identity. It subscribes to `api.decisionIntents.get({ intentId })` and derives the document type from its generated `FunctionReturnType`. The reusable `IntentReview` displays the immutable action, target kind and ID, revision, full payload, proposal transcript, digest, displayed eight-character confirmation digest, expiry, status and result. Listening payloads remain intact; a separate summary shows all six subjective ratings, with absent values as "not given" and zero preserved.

Confirm calls `api.decisionIntents.applyWeb({ intentId, digest8, eventId })`; cancel calls `api.decisionIntents.cancelWeb({ intentId, eventId })`. Each action captures its displayed intent and digest. Confirm and cancel receive separate event IDs, retained across uncertain transport retries for the same mounted intent. Repeated taps are blocked while pending. A resolved domain rejection throws into the error notice and its returned terminal status blocks further confirmation. Successful responses display their result while the subscription remains authoritative for later status updates.

Loading, missing, query failure, expired and terminal states do not offer actionable confirmation. Navigation mounts a new binding, so an old mutation completion cannot change the next intent's state. Intent links never render ordinary draft approval/edit controls. The prior Back-to-queue focus handling and tests remain intact.

`/agent-drafts?draft=<id>` continues to fetch terminal drafts explicitly through `agentDrafts.getReviewContext`, independently of pending queue membership. `DecisionState` now reads the actual projection's `decisionSource`, `decisionTranscript` and `decisionIntentId` fields. It shows source attribution, a transcript disclosure and a link to the original intent.

## Human identity prerequisite

The existing Clerk gate remains in place. `decisionIdentity.requireHumanIdentity` permits authenticated human reads without an existing `users.clerkUserId` mapping. The first human mutation uses `requireDecisionUser` to provision a collaborator atomically if needed. Existing mappings and roles remain unchanged. Service bypass cannot read or confirm through the decision contract. The web neither provisions users nor supplies a bypass secret. Synthetic unauthorized-output tests verify UI behavior, not live authentication.

## Recipe and composition listening

Both detail routes mount `TargetAudio`, which queries `api.audioArtifacts.listReadyForTarget({ target })`. The target is a discriminated recipe or composition ID. The server requires authentication and returns only `{ artifactId, title }` for ready artifacts with storage attached. The recipe result includes direct recipe references and artifacts belonging to its compositions, deduplicated by ID and sorted newest first.

Blind membership is checked before IDs or titles leave the server. Unrevealed and dangling blind-group references are excluded. The existing playback query uses the same fail-closed check. The membership back-reference is maintained atomically by `blindGroups.create`; this lookup relies on that contract.

Reads use reference indexes and cap the union at 100 candidate artifacts and recipe membership at 25 compositions. Every index scan takes at most its limit plus one before status filtering. Overflow produces `LIMIT_EXCEEDED`, not a silently incomplete list. This cap counts pending and failed candidates too. The parent added `audioArtifacts.by_refs_recipeId` on `["refs.recipeId"]`; the existing `by_refs_compositionId` and `compositions.by_recipeId_updatedAt` indexes cover the other reads.

Listen appears only when the authorized list is nonempty. Each item resolves its URL through `api.audioArtifacts.playback` and reuses `AudioPlayer` with preload disabled. Loading and errors use existing notices. Empty lists omit the section, failed subscriptions remove stale players, and unavailable playback does not show an artifact title or player. No storage URLs or links are derived in the client.

## Isolated verification

All commands used `TMPDIR=/home/keith/code/.frequency-wave2-20261012/test-tmp` and the existing linked dependencies. No installs or lockfile edits were made.

- `vpx tsc --noEmit` in `web/`: passed.
- `vp test --environment node src/lib/draft-review-search.test.ts`: two tests passed.
- `vp exec playwright test --config playwright.ui.config.ts`: 13 tests passed, including five actual-route binding tests with synthetic API outputs.
- Formatting and `git diff --check -- web`: passed.
- Impeccable detector on the four changed UI components/routes: no findings.

The route fixtures cover exact digest/intent mutation arguments, stable transport retry IDs, domain rejection on a resolved promise, pending-request navigation, cancel binding, subscription terminal updates, loading/missing/unauthorized/expired/applied states and draft provenance. Existing tests retain deep-link selection, terminal queue removal, Back-button keyboard focus, repeated taps, expiry, late responses and phone-width coverage.

`playwright.ui.config.ts` uses an isolated local Vite fixture on port 4186. It imports the real route and components, replaces only the Convex integration at build time, constructs no Convex client, and aborts non-local browser requests. The normal application build does not load the fixture adapter. This is not production acceptance evidence.

The parent owns final `vp run verify` and production build validation. This child did not run generation or a build that invokes generation.

## Listen integration verification

After the parent added the recipe-reference index:

- `vp test convex/audioArtifacts.test.ts convex/blindGroups.test.ts`: 18 tests passed.
- `vpx tsc --noEmit` in `web/`: passed.
- `vpx tsc --noEmit --project tests/listen/tsconfig.json` in `web/`: passed.
- `vp exec playwright test --config tests/listen/playwright.config.ts` in `web/`: three tests passed.
- Targeted backend lint, formatting, and diff whitespace checks passed.
- Impeccable detector on `target-audio.tsx` and both detail routes returned no findings.

The new local fixture on port 4187 imports the real `TargetAudio` and `AudioPlayer` components. Its Convex adapter records query arguments and supplies synthetic ready, empty, loading, error, and revoked playback results. Non-local browser requests are blocked. It covers target changes and removal of stale players; it does not establish live playback or visual acceptance of the complete detail routes. The previous draft/intent fixture results above belong to the earlier integration slice.

The missing `by_refs_recipeId` index initially blocked the recipe query test and web typecheck. The parent supplied it and both checks now pass. No other schema, signer, docket, tool-registry, generated-module, or draft/intent-review changes were made by this slice. Full `vp run verify` remains with the parent while other workers write.
