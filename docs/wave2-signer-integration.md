# Wave 2 signer runtime integration

The signer runtime is implemented in `convex/decisionSignerRuntime.ts`. It is
inactive unless `DECISION_SIGNERS_ENABLED=true` and the selected platform has all
required settings. No deployment, credentials, platform registration, real
messages, or human decisions were created during implementation.

## Parent integration requirements

- Add `decisionSignerRuntime` to `convex/_generated/api.d.ts` using the existing
  declaration pattern. The runtime uses typed `makeFunctionReference` references
  for its own functions, so it typechecks before this registration.
- Add `"./decisionSignerRuntime.ts": () => import("../convex/decisionSignerRuntime")`
  to `harness/modules.ts`. The colocated runtime test adds that entry locally.
- No schema addition is required. This implementation uses the existing
  `settings` table and its `by_key` index as durable transactional storage. The
  exact records and retention rules are below. There are no process-local locks.
- No signer function belongs in the agent-tool registry or MCP manifest. Only
  verified HTTP handlers call admission. Internal function visibility is part of
  the security boundary.
- Keep the parent's identity changes. The only proposal-module changes from this
  worker are the `scheduleSignerDelivery` import and its awaited call after intent
  insertion. Queries still use `requireHumanIdentity`; web mutations still use
  the parent's `requireDecisionUser` implementation. Platform mappings still
  require preexisting users and never provision a platform user.
- The parent owns final full verification and generated API/harness registration.

## Activation and routes

`convex/http.ts` registers `POST /discord/interactions` and
`POST /telegram/webhook/<path secret>`. Both return 404 before reading a body or
calling Convex/provider functions if configuration is disabled or incomplete.

The root environment contract adds the following settings. All bot credentials
belong only in the Convex backend, separate from OpenClaw and MCP credentials.
The empty optional schema entries do not provision or resolve any secret.

| Setting | Purpose |
| --- | --- |
| `DECISION_SIGNERS_ENABLED` | Explicit activation; defaults to `false` |
| `DECISION_SIGNERS` | JSON mapping of `discord:<user id>` and `telegram:<user id>` to existing Convex `users` IDs |
| `DECISION_DISCORD_BOT_TOKEN` | Independent Discord signer bot credential |
| `DECISION_DISCORD_CHANNEL_ID` | Single allowed delivery destination |
| `DECISION_DISCORD_APPLICATION_ID` | Verified interaction application |
| `DECISION_DISCORD_PUBLIC_KEY` | 32-byte Ed25519 public key, hex encoded |
| `DECISION_TELEGRAM_BOT_TOKEN` | Independent Telegram signer bot credential |
| `DECISION_TELEGRAM_CHAT_ID` | Single allowed delivery destination |
| `DECISION_TELEGRAM_PATH_SECRET` | Secret webhook path segment |
| `DECISION_TELEGRAM_HEADER_SECRET` | Telegram webhook `secret_token` |

A platform also needs a nonempty signer mapping entry to activate. Canonical apply
validates the mapped user's actual existence. Invalid IDs cannot sign.

A proposal schedules delivery only when its channel is exactly `discord` or
`telegram` and its `conversationId` matches that platform's configured destination.
Other proposals remain available through text and authenticated web review. No
caller can redirect a card to an arbitrary chat. Disabling activation prevents
new delivery, admission, processing, edits, and callback acknowledgments.

## Durable admission and processing

Discord verifies the raw-body Ed25519 signature, timestamp and application ID.
Telegram verifies both webhook secrets before parsing the sender. Existing
Telegram permanent rejects still return 200. A malformed Convex intent ID also
returns a permanent rejection, without creating an invalid audit reference.

Admission uses `settings.key = decisionSigner.event:<platform>:<eventId>`. The
JSON value is `{ admission, event, processed }`. The event contains only parsed
platform identity, binding and callback fields, never raw bodies, bot tokens or
interaction tokens. `admission` is `queued` or `signers_only`.

For a mapped existing signer, one mutation inserts the admission record and
schedules `processAdmission({ admissionId })`. The verified HTTP handler awaits
that transaction before ACK. The existing Discord handler bounds admission to
two seconds and returns 503 if it cannot observe committed admission in that
budget. It never acknowledges successful queuing before admission returns. The
scheduled mutation repeats canonical authorization and applies through
`decisionIntents.apply`, then marks the admission processed and schedules a card
refresh in the same transaction. Scheduler retries and platform redelivery do
not create a second application. Canonical `webhookEvents` remain the decision
result/audit authority.

Unknown signers are rejected and audited through canonical apply during
admission. They receive Discord's private "Signers only" response. An unknown
signer never disables controls on a still-proposed card. Telegram callback ACK
uses an independent durable job after admission. The
webhook returns 200 even if ACK scheduling or delivery fails after the decision
was admitted. `settings.key = decisionSigner.ack:<callbackQueryId>` stores
`{ attempts, done }`; redelivery cannot restart a completed or exhausted ACK.
The scheduled `callbackAck` action calls `answerCallbackQuery`. HTTP 4xx other
than 429, including query-too-old 400, is permanent. HTTP 429, 5xx, network
failures and timeouts receive at most three total attempts. These jobs never
invoke canonical apply or restart decision processing.

Turning activation off between admission and processing leaves the admission
unprocessed. After an intentional reactivation, an operator may reschedule that
existing `processAdmission` job. Expiry and authorization are checked again; the
operator must not fabricate another platform event.

## Delivery claims and uncertain outcomes

`settings.key = decisionSigner.delivery:<intentId>` has JSON value
`{ state, binding? }`. Claim insertion is serializable and indexed by key. Any
existing claim blocks another post permanently, including an unfinished claim.

The states are `posting`, `binding_pending`, `posted`, `post_unconfirmed`,
`binding_unconfirmed`, and the delivery helper's `invalid_card` result. Card
validation normally happens before claim insertion, so oversized content stays
available on the web without consuming a send claim.

After a successful provider response, the runtime saves its actual binding as
`binding_pending` and schedules the initial watcher in the same transaction.
It then calls `bindDelivered`, which commits canonical `bindSignerCard` and the
posted receipt together. A canonical bind
failure retains the binding as `binding_unconfirmed`. An uncertain send or
response yields `post_unconfirmed`. A crash can leave `posting` or
`binding_pending`. None of these states automatically reposts.

If the intent expires or a web decision resolves it while the send is in flight,
canonical binding stays rejected. The watcher uses the retained verified delivery
binding solely to edit that delivered message with the canonical terminal result
and remove its controls. This fallback never populates `signerCard`, grants signer
authority, or creates a signature. It also covers a crash after the verified
binding was retained but before canonical binding was attempted. The existing
edit budget applies across all automatic entrypoints: at most four attempts per
delivered binding, with no repost.

Recovery after exhausted cleanup requires inspecting the actual provider message
and stored intent.
When an exact response binding survives and the intent remains active, the
operator can retry `bindDelivered` without sending again. For terminal or expired
intents with budget remaining, `refresh` can clean up the retained message without
binding it. Exhausted budgets stay exhausted even after further events or manual
refresh calls; an operator must inspect the message before authorizing a separate
repair. No automatic entrypoint resets the budget.
If no binding survives, reconcile
the provider first. Do not delete the claim or assume a timeout means no message
was sent. There is deliberately no automatic claim expiry or cleanup. If these
records are later migrated to dedicated tables, preserve their unique keys and
all unfinished claims before enabling delivery.

## Provider transport and card state

Outbound origins are fixed to Discord API v10 and Telegram Bot API. Requests
reject redirects, use an AbortSignal, time out after ten seconds, and stream at
most 65,536 response bytes before decoding. Errors never include tokens, URLs,
raw responses or upstream exception messages. No provider request is logged.

Only verified response chat/message IDs become bindings. Card display includes
the target, action, note, digest and complete payload values, including explicitly
absent listening ratings. The existing renderer rejects overlong content instead
of truncating a decision. Such intents remain reviewable on the web.

`refresh` reads the canonical intent. Terminal states replace controls with the
saved status. A rejected event on an active intent does not change its card.
One watcher starts when the verified delivery binding is retained, checks at most
once per minute,
and ends at expiry or terminal status. This also picks up web decisions without
changing canonical apply. Expired proposed intents display expiry based on their
stored deadline; refresh does not invent a platform event or signature. Cleanup reservations use `settings.key =
decisionSigner.cleanup:<intentId>:<platform>:<chatId>:<messageId>` with JSON
`{ attempts, done, updated }`. Every terminal refresh atomically reserves from the
same four-attempt budget before contacting the provider. Successful completion
is retained; delayed failures cannot clear it. Watchers, admission jobs, retries,
and further platform events share that record. Already reserved concurrent edits
count toward the same limit. Legacy scheduler `attempt` arguments are accepted
but no longer control the budget. Safe repeated edits never repost
a card. A configuration change or sustained provider failure may require an
operator refresh after recovery.

## Validation

All HTTP calls in tests are mocked. Runtime coverage includes disabled and
missing configuration, proposal scheduling, binding-only admission, callback
ACK/replay, unknown-signer auditing, malformed authentication and intent IDs,
real Ed25519 test signatures, durable admission before ACK, one-time posting,
uncertain network and binding outcomes, response limits and cancellation.

The existing Telegram permanent-reject tests and signer security tests are
preserved. The parent should include the runtime test in its final full check.
Production response latency and platform setup remain unverified; mocked timing
is not evidence of a live Discord ACK latency guarantee.

Final worker checks on this assembled checkout:

- Six signer test files passed, 46 tests total, including 16 runtime tests.
- Biome checks passed for the new runtime/tests and HTTP file. Biome does not
  process Markdown in this repository. Scoped `git diff --check` passed.
- Targeted lint exited zero, with existing-style `_id` and type-assertion warnings.
- Root `vpx tsc --noEmit` was attempted after the final edit. It reported only
  `convex/audioArtifacts.ts:256–257`: `by_refs_recipeId` and `refs.recipeId` are
  absent from the schema index types. This is a concurrent cross-owner change,
  not a signer error; an earlier root typecheck passed before that edit appeared.
- `vp run verify` was not run because the parent explicitly owns full verification.

The parent's requested `DOCKET_PREPARATION_ENABLED=false` was added to both root
environment files, with a public boolean schema annotation. This worker did not
change docket code.


## Signer review fixes

The ACK and late-send regressions are covered by mocked scheduled-job tests.
Three deliveries of a callback whose ACK returns query-too-old 400 all return
HTTP 200, issue only one ACK request, and retain one canonical event receipt.
HTTP 429 and 503 stop at three ACK attempts across the same redeliveries.

Late expiry and a real mocked Clerk web cancellation during `sendMessage` both
leave `signerCard` absent and automatically edit the retained provider message.
The web signature remains attributed to the web user; expiry creates no signature.
A provider that keeps failing cleanup receives exactly four edit attempts and no
second post. No schema or extra harness module registration is required beyond
the parent's existing runtime registration.

Review-fix validation supersedes the earlier worker typecheck blocker above:

- `vp test convex/decisionSignerRuntime.test.ts convex/decisionSignerDelivery.test.ts convex/decisionSignerTransport.test.ts convex/decisionSignerParsing.test.ts convex/discordInteractions.test.ts convex/telegramWebhook.test.ts --no-file-parallelism`: six files, 53 tests passed.
- `vpx tsc --noEmit`: passed on the assembled integration checkout.
- `vpx biome format` for the four changed TypeScript files: passed, no fixes needed.
- Scoped `git diff --check`: passed.

All checks used the required home-directory TMPDIR. No live calls, installs or
full verification were run for this review fix.


## Shared cleanup budget review fix

The cleanup cap is now durable per delivered binding rather than per refresh
invocation chain. A regression combines the delivery watcher, an actual verified
Telegram handler and its admission job, eight concurrent refresh actions, and
three further distinct verified events. Persistent HTTP 503 produces exactly
four edits total; successful cleanup and exhaustion both suppress later events.
The tests also assert one post, no signer binding and unchanged web attribution.

Validation for this fix: the six signer test files pass with 55 tests, root
`vpx tsc --noEmit` passes, Biome checks both changed TypeScript files, and scoped
`git diff --check` passes. All commands use the required home-directory TMPDIR.
No live calls or full verification were run. The new internal cleanup functions
are in the already registered runtime module; no schema or module registration
change is needed.
