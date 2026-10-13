# Audio feedback and docket decisions

General human ratings for ready episodes and litmus renders, and signed
deferral for every docket card kind. Voice shootout ratings are unchanged and
keep their blind contract in `voiceRatings`. No Convex codegen, deploy, or
production command was run for this work; the generated API declarations were
edited by hand.

## Shared contracts

`convex/shared/audioFeedback.ts` owns the rating contract.

- `AUDIO_RATING_KINDS` is `["episode", "litmusRender"]`. No artifact kind was added.
- `audioRatingScoresZ` is a strict object. Every score is optional and must be a
  finite number from 0 through 5. An absent score means "not given"; 0 is a real
  score and is stored as 0.
- Scores depend on the artifact kind (`SCORE_KEYS_BY_KIND`). An episode takes
  `overall`, `clarity`, `naturalness` and `pacing`. A litmus render takes
  `overall` and the six subjective listening ratings (`bodilyPleasantness`,
  `goosebumps`, `perceivedConsonance`, `musicality`, `easeOfComposability`,
  `expandability`). A score outside the kind is rejected.
- `audioRatingPayloadZ` is `{ scores, conditions?, notes? }`. Conditions reuse
  `listeningConditionsZ` (now in `shared/listeningConditions.ts` and still
  re-exported by `shared/decisionIntents.ts`). Notes are trimmed, 1 to 4,000
  characters. A payload needs at least one score or a note.
- Machine analysis is never a rating. Strict parsing rejects
  `consonanceComputed`, roughness and any other unknown key, and a rating never
  writes to `audioArtifacts.analysis`.

`audioRatings` (new table) stores `artifactId`, `artifactKind`,
`artifactContentHash` (the version heard), `artifactValidation` (copied so
analysis can separate unvalidated renders), `scores`, `conditions`, `notes`,
`createdBy` (a `users` ID), `source` (`web`, `discord` or `telegram`),
`decisionIntentId` for signed ratings, `requestKey` and `createdAt`. Indexes are
`by_artifactId_createdAt` and `by_requestKey`. Files stay owned by
`audioArtifacts`; this table stores no `_storage` IDs, so `mediaSweeper` needs
no change.

### Rateable artifact

An artifact can be rated only while it is `ready`, has storage, is an episode
or litmus render, and is blind-safe. Blind-safe means no unrevealed group lists
it as a member and its own `blindGroupId`, when set, points at a revealed
group. A dangling group fails closed. A refused artifact returns the same
"not available" error whether it is hidden, pending or the wrong kind.

## Web APIs

All require an authenticated human Clerk identity. The service bypass and
`subject: "system"` are refused. The first mutation provisions the signed-in
user through `requireDecisionUser`, as the decision APIs already do.

- `audioFeedback.queue({})` returns up to 25 rateable artifacts with no human
  rating for their current content and no active docket deferral, newest first.
  It scans the newest 200 artifacts of each kind. Each item is
  `{ artifactId, kind, title, durationSecs?, engineName?, validation?,
  contentHash, docketContentHash, createdAt }`. It never returns storage IDs,
  refs, voice, blind labels or analysis.
- `audioFeedback.submit({ artifactId, contentHash, payload, clientRequestId })`
  returns `{ ratingId, replayed }`. `clientRequestId` is 8 to 200 characters of
  `[A-Za-z0-9._:-]`. The idempotency key is `${userId}:${clientRequestId}`: a
  repeat returns the first rating with `replayed: true`, and reusing the key
  for another artifact is rejected. A `contentHash` that no longer matches the
  artifact is rejected as stale. The web keeps one request ID across transport
  retries and replaces it after any server answer.
- `audioFeedback.forArtifact({ artifactId })` returns up to 50 ratings for a
  rateable artifact, newest first, with `current` marking ratings of the
  present content. It returns an empty list for anything not rateable.
- `decisionIntents.deferWeb({ targetId, contentHash, eventId, note? })` returns
  `DecisionResult`. It reconciles the docket, requires the card to be eligible,
  undeferred and at the given `contentHash`, then creates a canonical `defer`
  intent (`proposal.channel: "web"`) and applies it in the same transaction as
  the signed-in user. It is never sent to a platform signer. `eventId` is
  namespaced by user and replays return the first result without a second
  intent. A stale card throws without consuming the event ID. The Listen queue
  passes `docketContentHash`, the matching `unratedAudio` card version.

## Decision contract changes

`convex/shared/decisionIntents.ts`:

- Targets add `{ kind: "recipe", id }` and `{ kind: "audioArtifact", id }`.
  IDs are typed for their own tables; no cast to a composition ID.
- `defer` accepts all five target kinds.
- New action `rateAudio` takes an `audioArtifact` target and
  `audioRatingPayloadZ`. It is appended last in `decisionCommandZ`, so service
  contracts that select earlier options by index are unchanged.
- Intents gain optional `targetContentHash`. Recipes and audio artifacts have
  no revision counter, so a proposal records the recipe digest (title, body,
  protocol, status) or the artifact `contentHash`. Confirmation of a changed
  recipe or audio target, or of audio that became unrateable, rejects the
  intent terminally with `Target changed: content` or
  `Target changed: unavailable`.
- Applying `rateAudio` creates one `audioRatings` row with
  `requestKey: intent:<intentId>`, the signer's mapped user and source. Domain
  errors (for example a score outside the kind) reject the intent and roll back.

The agent `decision.propose` tool (`decisionProposeArgsZ`) accepts `rateAudio`.
Authority fields and unknown score keys are refused before the domain schema
runs. Signer cards label it "Rate audio" and list each kind-relevant score that
was not given.

## Docket

- `recipeNoComposition` cards offer `["defer"]`; `unratedAudio` cards offer
  `["rateAudio", "defer"]`. The MCP card projection allows `rateAudio`.
- `unratedAudio` also clears when an `audioRatings` row exists for the
  artifact's current content hash. A content change brings the card back.
- Reconciliation updates a stored card's `decisions` when the vocabulary
  changes without a content change, so existing cards gain the new actions.

## Web UI

- `/listen` has a "Rate audio" section above the podcast feed. Each item plays
  through the Clerk-gated playback query and shows kind-specific optional
  scores, optional listening conditions (both or neither), notes, "Save rating"
  and "Defer two weeks".
- `/docket` (new, in the main navigation) lists the web docket with a link to
  each card's page and "Defer two weeks" where the card allows it.
- Intent review pages list `rateAudio` scores with "not given" for absent ones.

## Verification

- `vp test convex/audioFeedback.test.ts`: 20 tests covering blind safety in
  both membership directions, auth, zero versus absent, kind bounds, stale
  content, idempotency, docket clearing per content version, signed `rateAudio`,
  terminal staleness, recipe deferral and `deferWeb` replay.
- `web/tests/feedback` is an isolated fixture (synthetic data, port 5192, no
  backend) over the real `/listen` and `/docket` routes:
  `vp exec playwright test --config tests/feedback/playwright.config.ts`.
  It covers loading, empty, error, success, transport retry, stale and
  double-click states. It is not production acceptance.
