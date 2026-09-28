# Freq Docket and Voice Decisions Design (wave 2)

Let the `freq` OpenClaw agent read the backlog aloud and deliver cards to
Discord and Telegram, and let Keith sign decisions from his phone with a
signature the model cannot forge.

Parent: [Listen-first program](./2026-09-28-listen-first-program-design.md).
Requires wave 0. Spoken cards need wave 1's house voice; text cards do not.

## 1. Outcome

- A new Discord channel `#frequency` and the existing freq Telegram bot both
  route to the `freq` agent.
- Every Thursday freq posts up to three cards: blurb, spoken blurb, page
  link, and the decisions available.
- Keith talks to freq about a card. Freq proposes a decision. A Convex-owned
  signer bot posts a decision card with buttons; Keith taps, or replies
  "confirm D-17" to the signer bot. Convex verifies the platform signature and
  the sender id, then applies the decision through the same code path as the
  web.
- "Freq, what's on the docket" and "play the render for card three" work any
  time.

## 2. Channels

OpenClaw config on moltbot:

- `channels.discord.guilds.<guild>.channels.<frequencyChannelId>`:
  `{ enabled: true, requireMention: false }`.
- `bindings`: prepend `{ agentId: "freq", match: { channel: "discord",
  accountId: "default", peer: { kind: "channel", id: "<frequencyChannelId>" } } }`
  so the exact-peer rule beats the `main` catch-all.
- `agents.entries.freq.tts`: the house voice via its `openclawProvider`
  mapping from the catalog. Text-only until wave 1 picks.
- `mcp.servers.frequency`: streamable HTTP, header `x-mcp-secret` from an env
  reference, allowed for `freq` only.

Keith creates `#frequency` (the OpenClaw bot lacks Manage Channels) and pastes
the id; the plan's first step records it in the OpenClaw config, never in
this repo.

## 3. MCP server

`agent/src/mcp/server.ts`, shipped in the agent image, run as Deployment
`frequency-mcp` in namespace `frequency-worker` with a Service, a Traefik
IngressRoute at `mcp.frequency.rproj.art`, and the worker's Convex-only
egress policy. Auth: `x-mcp-secret` equals `MCP_SHARED_SECRET` from an
ExternalSecret. Stateless; talks to Convex through `/agent-tools/*`,
authenticating to Convex by sending `AGENT_TOOL_SECRET` in the JSON body's
`secret` field (the existing `/agent-tools/*` contract), a separate secret
from the inbound `MCP_SHARED_SECRET`.

Tools exposed to freq (all read-only or proposal-only; none applies a
decision or records a session):

| Tool | Effect |
| --- | --- |
| `docket.list` | Current cards with ids, titles, blurbs, page URLs, audio URLs, allowed actions. |
| `docket.card` | One card in full (review context for drafts, protocol for recipes, audio for compositions). |
| `decision.propose` | Create a `decisionIntents` row (§4) and trigger the signer card. Returns the intent code. |
| `listening.propose` | Create a listening intent from a voice note transcript: parsed subjective ratings, conditions, verdict. Same signing path. |
| `render.request` | Enqueue a `litmusRender` or `studyFamily` media job (wave 3 fulfils). |
| `tournament.request` | Enqueue a `hypothesis-tournament` run with a seed hint (wave 4 fulfils). |
| `delivery.record` | Record that a card was posted to a channel (§6 receipts). |

## 4. Signed decisions

### 4.1 Why the model cannot sign

An agent-callable "confirm" would let the caller replay or fabricate a
sender id and transcript, which erodes the doctrine that agents never decide.
So the confirmation never passes through freq or the MCP server. It arrives
at Convex from the platform itself, with a signature or secret the model does
not hold, carrying a user id the platform attributes.

### 4.2 Signer bots

Two small Convex-owned bots, distinct from OpenClaw's:

The card shows the proposed action, the target title, the note, and the
payload digest's short form. Its only buttons are **Confirm <action>** and
**Cancel**; the action was chosen by voice and cannot be changed on the card.
A different action means a new proposal. Button ids are
`<intentId>:confirm:<digest8>` and `<intentId>:cancel`, so a confirm event
carries the digest of the exact payload that was displayed. Intents have no
update mutation; action and payload are immutable from creation.

- **Discord "Frequency Signer"** application. A Convex action posts the card
  to `#frequency` with the bot token and stores the returned message id on
  the intent. Discord sends interactions to `POST /discord/interactions` on
  the Convex site; the handler verifies the Ed25519 signature over the raw
  body with the application's public key, rejects
  `X-Signature-Timestamp` older than 5 minutes, and passes the event to
  §4.4 as `{ platform: "discord", chatId: channel_id, messageId:
  message.id, signerId: member.user.id, verb, digest8, eventId: interaction
  id }`. Replies with an ephemeral acknowledgement.
- **Telegram "Frequency Signer"** bot. Convex posts the card with an inline
  keyboard and stores the message id. Telegram delivers updates over HTTPS to
  `POST /telegram/webhook/<pathSecret>` on `listen.rproj.art`, guarded by the
  webhook `secret_token` header as well. A callback query yields the event
  `{ platform: "telegram", chatId: message.chat.id, messageId:
  message.message_id, signerId: from.id, verb, digest8, eventId: update_id }`.
  A typed message "confirm D-17" or "cancel D-17" is accepted for hands-free
  use with the keyboard's dictation; it is bound through the code, not its
  own message id: the handler resolves `D-17` to the intent and passes
  `messageId: intent.signerCard.messageId`, `chatId: message.chat.id`, and
  for confirm the stored digest, so a typed confirm from another chat or for
  an intent whose card was never posted fails the card check in §4.4.
- **Web fallback**: `/agent-drafts?intent=<id>` shows the intent with one
  Confirm button behind Clerk.

`DECISION_SIGNERS` maps platform-scoped ids (`discord:<id>`,
`telegram:<id>`) to Keith's `users` id, so a signed session or decision is
attributed to his user, never to `system`. Anyone else gets a logged
rejection and a "signers only" reply. The Telegram `secret_token`
authenticates Telegram as the webhook sender; the human attribution comes
from `from.id`, which only Telegram supplies, which is why the bot token and
path secret are isolated from OpenClaw.

### 4.3 `decisionIntents`

```
decisionIntents
  code: string                          // "D-17", generated by Convex
  target: { kind: "agentReviewDraft" | "composition" | "feedProposal", id }
        // decisions target a draft or feed; listening intents target the
        // composition the session will be created for
  targetRevision?: number               // drafts and feeds only, read at proposal (§4.4)
  action: "approve" | "reject" | "supersede" | "defer" | "createListeningSession" | "enableFeed"
        // immutable after creation
  payload: <action-specific zod in convex/shared/decisionIntents.ts>
  payloadDigest: string                 // sha256 of action + payload, shown on the card
  proposal: { channel, conversationId, messageRef, transcript }      // from freq
  signerCard?: { platform, chatId, messageId }                       // set when Convex posts it
  signature?: { source: "discord" | "telegram" | "web", signerId, eventId, messageRef, receivedAt }
  status: "proposed" | "applied" | "cancelled" | "expired" | "rejected"
  result?: { appliedRecordId?, error? }
  createdAt, expiresAt (30 min), decidedAt?
indexes: by_code, by_status_createdAt, by_target
```

`webhookEvents` stores `(platform, eventId, intentId, result)` so replayed
platform events return the stored result.

### 4.4 Apply

One internal function `agentDrafts.applyDraftDecision({ draftId, action,
note, amendedPayload, actor })` is extracted from today's `approve`,
`reject`, and `supersede` handlers. The Clerk mutations call it with
`actor: { kind: "clerk", userId }`; the signer handlers call it with
`actor: { kind: "signer", source, signerId, intentId }`. All promotion
invariants (pending status, payload present, `whyThisMatters`, recipe
`hypothesisId`, rejection note required) stay inside it.

Revision identity: `agentReviewDrafts` and `feeds` gain `revision: number`
(backfilled to 0), incremented by every mutation that writes the row.
Timestamps are not used for identity.

`decisionIntents.apply(event)` runs in one mutation, in this order:

1. If `webhookEvents` has `(event.platform, event.eventId)`, return the
   stored result.
2. Require status `proposed` and not expired.
3. Card binding: require `event.platform === signerCard.platform`,
   `event.chatId === signerCard.chatId`, and
   `event.messageId === signerCard.messageId`. An intent without a
   `signerCard` cannot be applied from any platform (web fallback only).
4. Signer binding: `event.signerId` must map through `DECISION_SIGNERS`.
5. If `event.verb === "cancel"`: set `cancelled`, record the event, return.
   Cancel needs no digest and no action match.
6. If `event.verb === "confirm"`: require `event.digest8` to equal the
   stored `payloadDigest` prefix, so the payload that was displayed is the
   payload applied.
7. For drafts and feeds require the target's current `revision` to equal
   `targetRevision` (a web decision in between rejects the intent with the
   current status; Convex mutations are serializable, so nothing slips
   between the check and the apply).
8. For draft decisions call `applyDraftDecision` (which keeps `supersede`'s
   `byDraftId` validation and the run reconciliation side effects);
   `enableFeed` intents route to a feed-specific mutation on the target
   `feedProposal` after the revision check. Store the signature and result,
   record the event, set `applied`.

For `createListeningSession` the target is the composition, there is no
version check, and uniqueness comes from the intent itself: one session per
applied intent, `createdBy` set to the mapped user id.

Rejects need a note; if the proposal transcript has none, freq asks before
proposing. `defer` (two weeks, docket only) requires signer confirmation like
every other decision: it changes no research data, but a two-week delay of
human review is itself a decision.

`agentReviewDrafts` gains optional `decisionSource: "web" | "discord" |
"telegram"`, `decisionTranscript`, `decisionIntentId`; `decidedBy` stays
`"human"`. The `/agent-drafts` page shows "decided via Discord" with the
transcript in a disclosure.

## 5. Docket

A dedicated query `docket.currentState` (not the loop report, whose census
collapses debt by recipe and applies a 14-day age filter):

| Card kind | Eligibility |
| --- | --- |
| `pendingDraft` | `agentReviewDrafts.status = pending_review` |
| `recipeNoComposition` | recipe status `draft` or `in_use` with no composition |
| `compositionNoListening` | composition status `rendered` with no session passing `isHumanListeningSession` |
| `unratedAudio` | `audioArtifacts` kind `episode` or `litmusRender`, ready, with no human rating, excluding unrevealed blind members |
| `feedProposal` | `feeds.enabled = false` with proposal provenance |

One card per `targetId`; deferrals keep `deferredUntil`. Ranking: pending
drafts first, then oldest debt. Thursday post takes three; `docket.list`
returns up to ten.

```
docketCards
  kind, targetId, title, blurbMd, spokenBlurb, blurbArtifactId?, pageUrl,
  audioUrl?, decisions: string[], contentHash, rank, deferredUntil?,
  createdAt, updatedAt
docketDeliveries
  cardId, channel, phase: "posting" | "posted", postingAt,
  messageRef?, postedAt?
```

A delivery row is written as `posting` before the channel post is attempted
and becomes `posted` with `messageRef` and `postedAt` once the post succeeds,
so a crash between the two leaves a visible half-delivery instead of a
duplicate post.

Blurbs (60 to 90 words: stake, proposal, what a decision unlocks) are written
by `DEFAULT_MODEL` and regenerated only when `contentHash` changes. The
spoken version drops ids and links. Spoken blurbs render as `narrate` jobs
once the house voice exists.

Rebuild triggers: `createFromAgentRun` and `completeMediaJob` mark the docket
stale; `docket.list` rebuilds when stale or older than an hour; cron
`rebuild-docket` at Thursday 16:30 UTC (after the 16:00 drafter) reconciles.

## 6. Delivery

- Thursday 17:30 UTC: freq's HEARTBEAT calls `docket.list`, posts the top
  three cards to `#frequency` (a thread per card) and to the Telegram chat.
  A card whose spoken blurb is not ready yet posts as text with the audio
  following when `completeMediaJob` marks it ready; the post never waits on
  narration. Delivery is recorded in two steps through `delivery.record`:
  `phase: "posting"` before the send and `phase: "posted"` with the message
  ref after. A card with a `posting` record in the last 24 hours is not
  re-sent even if `posted` never arrived, so a crash costs at most one missed
  post, never a duplicate. Cards with a `posted` receipt in the last 7 days
  are not reposted; changed cards post with "updated".
- Friday: freq posts the episode link and the three studio prompts, or the
  "no brief this week" note when generation was skipped.
- On demand: docket questions, card reads, render playback.
- Silence: nothing is posted when nothing changed.

Freq's workspace `AGENTS.md` gains a section on the tools, the rule that it
never states a decision was applied (the signer bot reports that), and that
signing happens only on the signer card.

## 7. Voice listening sessions

Keith listens to a render through freq and answers with a voice note. Freq
extracts the six subjective ratings (`bodilyPleasantness`, `goosebumps`,
`perceivedConsonance`, `musicality`, `easeOfComposability`, `expandability`),
felt qualities, standout moments, the expand verdict, and the required
conditions (`listeningMethod`: headphones, monitors, car, phone speaker;
`timeOfDay`). Freq asks once for missing conditions; ratings Keith did not
give stay absent, and freq never fills a value that was not said. Then it
calls `listening.propose` with the composition as target. The signer card
echoes the values, including "not given" for absent ratings; the signature
applies `listening.createInternal`, which range-checks every supplied rating
(today only `expandability` is checked), preserves absent ones as undefined,
stores `feedbackMd` as the transcript, `conditions`, and `createdBy` as the
mapped user id. `consonanceComputed` is never set here.

## 8. Pages

Existing routes serve as pages, with `?draft=` deep links on `/agent-drafts`
and a Listen section on recipe and composition pages once audio exists. The
web is Clerk-gated; links open only for Keith.

## 9. Error handling

- Unknown signer: rejected, logged, replied "signers only".
- Expired or already-applied intent: signer card updates to show the state.
- Target changed since proposal: intent rejected with the current status;
  freq offers to re-propose.
- Signer webhook signature failure: 401, nothing logged beyond a counter.
- MCP unreachable: freq says so and gives the page link.

## 10. Testing

- `convex/decisionIntents.test.ts`: signer check, expiry, version binding,
  idempotent apply, transcript stored, approve through the intent equals
  approve through Clerk row for row.
- `convex/discordInteractions.test.ts`, `convex/telegramWebhook.test.ts`:
  signature and secret verification, sender check, button and text parsing.
- `convex/docket.test.ts`: eligibility per kind, dedupe, deferral, receipts.
- `convex/listening.test.ts`: all six ratings range-checked; conditions
  required through the intent path.
- `agent/src/mcp/server.test.ts`: schemas, secret enforcement, propose path.
- Manual: a reject signed from Discord and one from Telegram, both visible on
  `/agent-drafts` with transcripts.

## 11. Out of scope

- Multiple signers.
- Slash commands.
- Rendering and tournament execution (waves 3 and 4).
