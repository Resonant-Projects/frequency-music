# Frequency MCP integration

Run `vp run mcp` from `agent/`, or override the agent image command with
`["node_modules/.bin/tsx", "src/mcp/main.ts"]`. The image already copies the
agent sources, production dependencies and shared Convex contracts. The
research worker's default command stays unchanged. The MCP process listens
on port 2025 by default (`MCP_PORT`). It loads configuration through Varlock.

`GET /health` reports local liveness only and makes no backend call. MCP uses
`POST /mcp` with `x-mcp-secret`. Configure distinct `MCP_SHARED_SECRET` and
`AGENT_TOOL_SECRET` values. Only the latter goes into the existing Convex
JSON-body `secret` field. Browser origins are rejected. GET event streams,
sessions and resumability are intentionally absent.

## Backend bindings

`main.ts` installs the five canonical operations through `manifestOperation`
and the existing `callConvex` transport. Shared input and result schemas live
in `convex/shared/docketTools.ts`.

- `docket.list` calls `listDocket`, which reconciles text cards and returns at
  most ten, or three with `weekly: true`.
- `docket.card` calls `getDocketCard` and returns one eligible card or null.
- `decision.propose` calls `proposeDecision` for draft, feed and deferral
  proposals. It rejects listening-session commands.
- `listening.propose` calls `proposeListening` and accepts only
  `createListeningSession` proposals. Omitted ratings remain absent.
- `delivery.record` calls `recordDocketDelivery`. Reserve with `posting`,
  send only when admitted, then complete with `posted`, the returned
  `deliveryId`, and the actual `messageRef`.

Cards always include text. Their relative `pageUrl` values use the existing
web route contract and must be resolved against the Frequency website by the
client. Optional `audioUrl` comes only from `docket.playbackForCard` through
`audioArtifacts.playbackInternal`. The backend requires current source content,
matching narration script and house voice, a completed job containing the
ready private delivery artifact, and no hidden or dangling blind membership.
Stale, unavailable or hidden playback is omitted. Artifact/storage IDs are
never returned as separate fields, and URLs are never inferred. Proposal results
contain only `intentId`, `code`, `status: "proposed"`, `expiresAt`, and the
relative web review link. They do not claim that a signer card was posted.
The backend owns signer delivery scheduling and verified confirmation.

Proposal tools have kind `service_proposal` and require no Agent Run ID.
Docket reconciliation and delivery receipts are `audit_write`; fetching a
card is `read`. These five tools are excluded from the research LangChain
catalog. No apply, confirm, cancel or listening-session creation operation
is exposed. Render and tournament requests still return explicit unavailable
responses for Waves 3 and 4, without enqueueing work.

Use strict nested shared input and result schemas with bounded strings and
collections. The adapter makes top-level inputs strict and rejects authority
keys recursively on the raw HTTP request before parsing can strip them.
`actor`, `signature`, `signerId`, `createdBy`, `secret`, `agentRunId` and
computed consonance cannot arrive through this interface. Human identity is
established only by the independent backend signer or Clerk path.

Docket projections bound each card, including its optional audio URL, to 18 KiB after both JSON serialization
layers. Oversized titles, blurbs and spoken blurbs become prefixes followed by
`[Excerpt; open the page for full text.]`. IDs, links, actions and content hashes
retain their original values. Playback URLs have a 2,048-character limit and
are omitted if they would crowd out the card identity within its byte budget.
The complete docket result has a 191 KiB byte
budget, leaving room for the request ID and JSON-RPC framing.

The adapter caps incoming JSON at 64 KiB, the complete serialized JSON-RPC
response at 256 KiB, and backend calls at ten seconds. It passes cancellation to the existing
`callConvex` transport and also enforces the deadline for injected adapters.
The existing transport materializes response JSON before the output cap is
checked; backend projections must themselves remain bounded. No automatic
proposal retry occurs. A timeout can follow a successful backend write, so
errors explicitly avoid claiming a proposal failed to persist.

Backend binding tests exercise the secret-guarded action and verify proposal-only
persistence. Agent tests exercise the real manifest mapping and transport,
strict schemas, authentication, output validation, and timeouts. Deployment
and actual signer delivery still require separate operator acceptance.
