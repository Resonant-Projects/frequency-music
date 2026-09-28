# Freq Docket and Voice Decisions Design (wave 2)

Let the `freq` OpenClaw agent read the backlog aloud, deliver cards with
blurbs and pages to Discord and Telegram, and relay Keith's voice decisions
into Convex with identity and transcript attached.

Parent: [Listen-first program](./2026-09-28-listen-first-program-design.md).
Requires wave 0. Uses wave 1 for spoken blurbs; works text-only before wave 1
lands.

## 1. Outcome

- A new Discord channel `#frequency` and the existing freq Telegram bot both
  route to the `freq` agent.
- Every Thursday, freq posts the docket: up to three cards, each with a
  written blurb, a 45-second spoken blurb, a link to its page, and the
  decisions available.
- Keith replies by voice or text. Freq echoes the decision it heard; Keith
  confirms; Convex records the decision with channel identity and transcript.
- "Freq, what's on the docket" works any time.
- Keith can listen to a rendered study through freq and give a listening
  session by voice.

## 2. Channels

OpenClaw config on moltbot (`~/.openclaw/openclaw.json`):

- `channels.discord.guilds.<guild>.channels.<frequencyChannelId>`:
  `{ enabled: true, requireMention: false }`.
- `bindings`: prepend
  `{ agentId: "freq", match: { channel: "discord", accountId: "default", peer: { kind: "channel", id: "<frequencyChannelId>" } } }`
  so the exact-peer rule wins over the existing `main` catch-all.
- `agents.entries.freq.tts`: provider and voice from the wave 1 winner, so
  `/tts` replies and spoken blurbs use the house voice. Until wave 1 picks,
  freq stays text-only.
- `mcp.servers.frequency`: streamable HTTP, URL of the MCP server (§3), header
  `x-mcp-secret` from an env reference. Only the `freq` agent gets this server.
- Inbound voice notes already transcribe. Outbound audio uses the channel's
  native audio message on Telegram and a file attachment on Discord.

Channel creation: the OpenClaw bot lacks Manage Channels, so the plan's first
step asks Keith to create `#frequency` and paste the channel id, or grants the
permission for one call. Either way the id lands in the config, never in this
repo.

## 3. MCP server

`agent/src/mcp/server.ts`, shipped in the existing agent image and run as a
second Deployment `frequency-mcp` in namespace `frequency-worker`, with a
Service and a Traefik IngressRoute at `mcp.frequency.rproj.art`. Its egress
policy mirrors the worker's: Convex only. Auth: `x-mcp-secret` header equal to
`MCP_SHARED_SECRET`, delivered by ExternalSecret like the worker's secrets.

The server calls Convex through `/agent-tools/*` with `AGENT_TOOL_SECRET`
plus a small set of new tools. It holds no state.

Tools exposed to freq:

| Tool | Reads or writes | Purpose |
| --- | --- | --- |
| `docket.list` | read | Current cards: pending drafts, recipes with no composition, compositions never listened to, ready renders and episodes never rated, disabled feed proposals. Returns ids, titles, blurbs, page URLs, audio URLs, allowed decisions. |
| `docket.card` | read | One card in full: the draft review context (`agentDrafts.getReviewContext` shape), or the recipe protocol, or the composition and its audio. |
| `decision.propose` | write, audit only | Record a decision intent: target id, decision, note, channel, sender id, verbatim transcript, message reference. Returns the intent id and the exact confirmation phrase. |
| `decision.confirm` | write, gated | Apply a confirmed intent (§4). |
| `listening.propose` | write, audit only | Record a listening-session intent from a voice note: composition id, parsed ratings, transcript. |
| `listening.confirm` | write, gated | Apply a confirmed listening intent. |
| `render.request` | write, lifecycle | Enqueue a `litmusRender` or `studyFamily` media job for a recipe (wave 3 fulfils it). |
| `tournament.request` | write, lifecycle | Enqueue a `hypothesis-tournament` agent run with a seed hint (wave 4 fulfils it). |

Nothing here approves, rejects, supersedes, or publishes. The Clerk-only
mutations in `agentDrafts.ts` stay off both surfaces.

## 4. Voice decisions with a human signature

New table `decisionIntents`:

```
decisionIntents
  target: { kind: "agentReviewDraft" | "listeningSession" | "feedProposal", id }
  action: "approve" | "reject" | "supersede" | "defer" | "createListeningSession" | "enableFeed"
  payload: Record<string, unknown>       // note, ratings, feedbackMd, supersededBy
  channel: "discord" | "telegram"
  senderId: string                        // platform user id as seen by OpenClaw
  transcript: string                      // verbatim message or voice-note transcript
  messageRef: string                      // platform message id
  confirmationPhrase: string              // e.g. "confirm reject D-17"
  status: "proposed" | "confirmed" | "applied" | "expired" | "cancelled"
  appliedRecordId?: string
  createdAt, confirmedAt?, appliedAt?, expiresAt
```

Protocol:

1. Keith says "reject the second one, the stake is too weak." Freq calls
   `decision.propose` with the transcript. Convex checks `senderId` against
   `DECISION_SIGNERS` (Keith's Telegram user id and Discord user id, set in
   the Convex env) and rejects anyone else with a logged event. The intent
   expires in 30 minutes.
2. Freq replies with the echo: draft title, action, note, and the phrase to
   say. The phrase includes a short code (`D-17`) that freq cannot invent,
   because Convex generated it.
3. Keith says the phrase, or "confirm". Freq calls `decision.confirm` with
   the intent id and the second transcript. Convex checks the sender again,
   checks that the transcript contains "confirm" and the code, and then calls
   the same internal promotion path that `agentDrafts.approve` uses, with
   `decidedBy: "human"`, `decisionNote`, and new optional fields
   `decisionChannel`, `decisionTranscript`, `decisionIntentId` on
   `agentReviewDrafts`.
4. The web `/agent-drafts` page shows "decided by voice via Discord" on such
   rows with the transcript in a disclosure.

A reject still requires a note; if the transcript has none, freq asks for one
before proposing. `defer` moves a card to the bottom of the docket for two
weeks and is the only action that applies without confirmation.

Why this keeps the doctrine: the agent relays but never decides. Identity is
checked server-side against platform ids that OpenClaw supplies from the
channel, not from the model. The two-message protocol defeats a hallucinated
decision, and the transcript is stored for eval.

## 5. Docket cards

New table `docketCards`, rebuilt by a Convex action `docket.rebuild`
(Thursday 15:00 UTC, before the drafter and narration crons, and on demand
from `docket.list` when older than an hour):

```
docketCards
  kind: "pendingDraft" | "recipeNoComposition" | "compositionNoListening"
      | "unratedAudio" | "feedProposal"
  targetId: string
  title: string
  blurbMd: string                 // 60–90 words, written by DEFAULT_MODEL
  spokenBlurb: string             // 45 seconds when read, no markdown
  blurbArtifactId?: Id<"audioArtifacts">
  pageUrl: string                 // web route for the target
  audioUrl?: string               // podcast audio route when a render exists
  decisions: string[]             // allowed actions for this kind
  contentHash: string             // regenerate blurb only when the target changed
  rank: number
  deferredUntil?: number
  createdAt, updatedAt
```

Card sources map to the loop report's existing census:
`reviewQueue.pendingDrafts`, `experimentDebt` with `in_use_no_composition`
and `composed_no_listening`, `proposedFeeds`. Ranking: pending drafts first
(they block the cap), then oldest debt. The Thursday post takes the top three;
`docket.list` returns up to ten.

Blurb prompt: one paragraph that states the stake in the first sentence, what
the record proposes in the second, what a decision unlocks in the third. The
spoken version drops ids and links and ends with the available actions in a
sentence.

Spoken blurbs are rendered by a `narrate` media job in the house voice once
wave 1 has picked it; before that the card carries text only.

## 6. Delivery

- Thursday post: freq's HEARTBEAT gains a Thursday task: call `docket.list`,
  post the top three cards to `#frequency` and to the Telegram chat, each card
  as a message with the blurb, the page link, the spoken blurb as audio, and
  the decision words. Discord gets a thread per card so replies stay attached.
- Friday: freq posts the podcast episode link and the three studio prompts.
- On demand: "what's on the docket", "read me card two", "play the render for
  card three".
- Silence rule: freq posts nothing when the docket is empty and nothing has
  changed since the last post.

Freq's workspace `AGENTS.md` gets a section describing the docket tools, the
confirmation protocol, and the rule that it never states a decision was
applied until `decision.confirm` returns `applied`.

## 7. Voice listening sessions

"Play the render for card three" sends the WAV or MP3. Keith answers with a
voice note. Freq extracts the seven ratings, felt qualities, standout moments,
and the expand verdict with a structured prompt into a `listening.propose`
intent, echoes them as a sentence ("bodily four, goosebumps two, consonance
four, musicality three, composability three, expandability two, expand:
maybe"), and Keith confirms. `listening.confirm` calls
`listening.create` internals with `participants: [{ role: "self", userId }]`,
`feedbackMd` set to the transcript, and `contextMd` naming the channel.

## 8. Pages

Existing detail routes serve as the pages: `/agent-drafts` (with a `?draft=`
deep link added), `/recipes/$recipeId`, `/compositions/$compositionId`. Each
gains a "Listen" section when an audio artifact exists (wave 3 supplies the
player component; wave 2 uses a plain audio element). The web app is
Clerk-authenticated, so links open only for Keith; that is intended.

## 9. Error handling

- Unknown sender on any propose or confirm: rejected, logged as an
  `agentRunEvents`-style audit row on the intent, and freq is told to reply
  "I can only take decisions from Keith."
- Expired intent on confirm: freq asks Keith to restate the decision.
- Draft already decided on the web between propose and confirm: confirm fails
  with the current status and freq reports it.
- MCP server unreachable: freq says so and offers the page link.

## 10. Testing

- `convex/decisionIntents.test.ts`: signer check, expiry, phrase generation,
  double-apply rejection, approve path produces the same row shape as the
  Clerk mutation.
- `convex/docket.test.ts`: card sources match loop-report fixtures, ranking,
  hash-based blurb reuse.
- `agent/src/mcp/server.test.ts`: tool schemas, secret header enforcement,
  propose→confirm round trip against a mocked Convex.
- Manual acceptance: a full reject by voice from Telegram and from Discord,
  visible on `/agent-drafts` with the transcript.

## 11. Out of scope

- Multiple signers. Only Keith's ids are accepted.
- Discord slash commands; natural language only.
- Rendering (wave 3) and tournament (wave 4); this wave only enqueues them.
