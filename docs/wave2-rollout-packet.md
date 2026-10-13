# Wave 2 rollout packet

Prepared 2026-10-13 against `main` at `6c83e4d` (PR #138 merged the Wave 2
implementation as `db8cb39`). Nothing in this packet has run against
production. Every stage that contacts the live deployment, sends a platform
message, or spends on inference needs coordinator review of the exact target
and effects before it runs. Merging this document authorizes none of them.

Read with [backend integration](wave2-backend-integration.md),
[signer integration](wave2-signer-integration.md),
[web review integration](../web/docs/wave2-review-integration.md),
[MCP integration](../agent/src/mcp/README.md), and the
[Wave 2 plan](superpowers/plans/2026-09-30-listen-first-wave-2-docket-and-decisions.md).

## Current status, 2026-10-13

| Item | State | Evidence |
| --- | --- | --- |
| Wave 2 implementation | Merged to `main` | PR #138, merge `6c83e4d` |
| Production backend | Unknown whether Wave 2 is deployed | Read-only inspection was blocked, see below |
| House voice | `inworld-max` (Inworld Max, Dennis) | Live `houseVoiceId` read on 2026-10-05, [live handoff](listen-first-live-handoff-2026-09-30.md) |
| Signer bots, MCP workload, platform callbacks | Not created or unverified | Plan prerequisites table; no newer evidence |
| Revision backfill | Not run | No production command executed |
| Human acceptance | Pending | Requires Keith's signatures and listening |

The production deployment state is unverified. On 2026-10-13 the documented
read-only metadata tool (`scripts/convex-deployment-inspect.ts`) could not run
from the coordinator host because its 1Password service account cannot read
the "Country Manor Lab" vault that holds `CONVEX_SELF_HOSTED_ADMIN_KEY`. No
credential was changed. `GET https://convex.resonantprojects.art/version`
returned 200, which shows only that the backend answers.

## Disabled defaults

Deploying the Wave 2 code without setting any new environment variable leaves
every outbound or paid behavior off:

| Setting | Default | Effect while off |
| --- | --- | --- |
| `DECISION_SIGNERS_ENABLED` | unset or `false` | No signer card delivery, admission, callback ACK or card edit. `POST /discord/interactions` and `POST /telegram/webhook/<path>` return 404 before reading the body. |
| `DOCKET_PREPARATION_ENABLED` | unset or `false` | The `rebuild-docket` cron (Thursday 16:30 UTC) returns without blurb inference or narration. |
| `DECISION_SIGNERS` | `{}` | No platform user can sign. Web confirmation still works for authenticated humans. |
| `MCP_SHARED_SECRET` (agent) | empty | The MCP process is not deployed by this repository. |

Only an exact lowercase `true` enables either flag; the runtime compares with
`=== "true"`. Text docket reads, agent proposals, and Clerk web confirmation
work while both flags are off.

## Stage 0. Preflight (local, no production contact)

1. Confirm `main` contains `6c83e4d` and the candidate passes `vp run verify`.
2. Rehearse the acceptance sequence locally:

   ```sh
   vp test harness/wave2Rollout.harness.test.ts scripts/lib/wave2-rollout.test.ts scripts/wave2-rollout-cli.test.ts
   ```

   This runs proposal, signer binding, confirmation, replay, a second event,
   expiry, web fallback with a wrong digest, docket delivery receipts and the
   revision backfill driver against `convex-test`. It is a fixture rehearsal,
   not live acceptance.
3. Print the backfill plan. The dry run reads no credential and makes no
   network call:

   ```sh
   vpx tsx scripts/wave2-revision-backfill.ts --origin https://convex.resonantprojects.art
   ```

## Stage 1. Backend deployment with everything disabled

- **Target.** The single self-hosted Convex deployment,
  `https://convex.resonantprojects.art` (backend `http://172.16.10.24:3210`).
- **Command.** `vp run convex:deploy:dry-run`, then `vp run convex:deploy`,
  following [supported deployment and rollback](frequency-supported-deployment-rollback.md).
  Even the dry run uploads bundles and can start schema work.
- **Effects.** Adds tables `decisionIntents`, `webhookEvents`, `docketCards`
  and `docketDeliveries`, the `audioArtifacts.by_refs_recipeId` index, and
  optional `revision` and decision provenance fields on `feeds` and
  `agentReviewDrafts`. Registers the `rebuild-docket` cron and the two signer
  HTTP routes. Against its parent commit, `db8cb39` only adds schema lines.
  The deployed source revision is unknown, so read the dry-run schema diff
  for any removal before the real deploy. Existing rows stay readable because
  `revision` is optional and reads treat it as 0.
- **Before.** Confirm the media queue has no claimed work and record the
  deployed renderer version, as in the September 30 deployment.
- **Do not** set `DECISION_SIGNERS_ENABLED` or `DOCKET_PREPARATION_ENABLED` in
  this stage.

Post-deployment checks:

1. Signed in as Keith, `/listen` loads, the private feed address appears, and
   the feed returns HTTP 200 with the existing episodes.
2. `/agent-drafts` still lists pending drafts. Approve or reject nothing for
   the purpose of testing.
3. `POST https://convex.resonantprojects.art/discord/interactions` with an
   empty body returns 404. A missing route also returns 404, so this shows
   only that no signer handler answers.
4. Media worker probe jobs still complete.

Rollback: redeploy the previous source. The added tables and optional fields
are additive, so the earlier code ignores them. Do not delete the new tables
during rollback; a later redeploy reuses them.

## Stage 2. Revision backfill

Run after Stage 1 and before enabling any signer. The tool uses the existing
`decisionIntentsMigrations:backfillRevisions` internal mutation. Each call is
one transaction over at most `batchSize` rows (1 to 100) and sets `revision: 0`
only where it is absent. It never changes an existing revision.

```sh
# Inherited admin key only. The tool loads no .env and never prints the key.
CONVEX_SELF_HOSTED_ADMIN_KEY=... vpx tsx scripts/wave2-revision-backfill.ts \
  --execute --origin https://convex.resonantprojects.art \
  --state out/wave2-backfill-state.json --batch-size 50
```

- Order: `feeds` to completion, a verification pass over `feeds` from the
  start, then the same for `agentReviewDrafts`.
- The state file is written (mode 0600) after every page. Rerun the same
  command to resume from the last committed cursor after a failure or
  `--max-pages` stop.
- Exit codes: 0 complete and verified; 3 stopped at `--max-pages`; 4 a
  verification pass updated rows, so rerun with `--reverify`; 1 a page failed;
  2 invalid arguments, origin, state file, or missing admin key.
- The tool accepts only `https://convex.resonantprojects.art`.
- Expected effect on feed proposals: polling increments a feed's revision, so
  an outstanding `enableFeed` proposal becomes stale after the next poll. That
  is the documented every-write rule, not a backfill failure.

Acceptance: exit code 0 with `verified: true` for both tables. Keep the schema
field optional; making it required is a separate future change.

Rollback: none needed. Revision 0 matches what readers already assume for an
absent value.

## Stage 3. MCP workload (external infrastructure)

This repository already contains the MCP process (`vp run mcp` in `agent/`,
port 2025, `POST /mcp` with `x-mcp-secret`). The workload, Service, TLS ingress
and ExternalSecret belong in `homelab-infra`, which this lane does not edit.

Prerequisites: a new `MCP_SHARED_SECRET` distinct from `AGENT_TOOL_SECRET`,
stored in 1Password; a working Kubernetes context; DNS and TLS for
`mcp.frequency.rproj.art`.

Acceptance: an unauthenticated `POST /mcp` is rejected; an authenticated
`tools/list` returns exactly `docket.list`, `docket.card`, `decision.propose`,
`listening.propose` and `delivery.record`; `GET /health` returns 200; the
research worker stays healthy. Rollback: scale the MCP deployment to zero.

## Stage 4. Signer configuration

Validate the values before installing them. The readiness tool reads only its
inherited environment, makes no network call, and prints setting names,
booleans and counts:

```sh
op run --env-file=<operator env file> -- \
  vpx tsx scripts/wave2-signer-readiness.ts --require=telegram --require=discord
```

It applies the same rules as `convex/decisionSignerRuntime.ts`; a parity test
compares the two. Exit 1 means a required platform is incomplete.

| Setting | Format the runtime requires |
| --- | --- |
| `DECISION_SIGNERS` | JSON object; `discord:<id>` or `telegram:<id>` keys map to existing `users` IDs |
| `DECISION_DISCORD_BOT_TOKEN` | nonempty |
| `DECISION_DISCORD_CHANNEL_ID`, `DECISION_DISCORD_APPLICATION_ID` | Discord snowflake, no leading zero |
| `DECISION_DISCORD_PUBLIC_KEY` | 64 hex characters |
| `DECISION_TELEGRAM_BOT_TOKEN` | `<digits>:<token>` |
| `DECISION_TELEGRAM_CHAT_ID` | nonzero integer, canonical form |
| `DECISION_TELEGRAM_PATH_SECRET`, `DECISION_TELEGRAM_HEADER_SECRET` | 1 to 256 of `A-Z a-z 0-9 _ -` |

Install the values on the Convex deployment environment only, never in
OpenClaw or the MCP workload. Set `DECISION_SIGNERS_ENABLED=true` last.

External prerequisites, each still open:

- A separate Discord "Frequency Signer" application with bot token and public
  key, its interactions endpoint set to `<site origin>/discord/interactions`,
  and permission to post in the chosen channel.
- A separate Telegram signer bot that Keith has opened, with its webhook set
  to `<site origin>/telegram/webhook/<path secret>` and the header secret as
  `secret_token`.
- A site origin that Discord and Telegram can reach over public HTTPS. The
  agent worker reaches HTTP actions at `https://convex.resonantprojects.art`
  (`CONVEX_SITE_URL` in `agent/.env.schema`), but public reachability from
  the platforms is unverified. The plan's alternative, `listen.rproj.art`,
  forwards only podcast and storage paths today and would need a new route.
- Keith's Discord and Telegram user IDs and his existing Convex `users` ID for
  `DECISION_SIGNERS`.
- Confirmation that the Convex backend can reach the Discord and Telegram APIs.

Acceptance: Discord's endpoint validation succeeds and Telegram
`getWebhookInfo` shows no delivery error. Do not send research decisions as
smoke tests. Rollback: set `DECISION_SIGNERS_ENABLED=false`. The routes return
404 at once and unresolved cards stop updating; intents remain reviewable on
the web.

## Stage 5. Docket preparation

Setting `DOCKET_PREPARATION_ENABLED=true` lets the Thursday cron generate
60 to 90 word blurbs with Sonnet 5.5 (paid inference) and queue house-voice
narration media jobs. Enable it only after coordinator approval of that spend.
Rollback: set it back to `false`; text cards keep working.

OpenClaw `freq` configuration (peer binding, MCP secret reference, workspace
instructions, Thursday 17:30 UTC and Friday delivery) is external and listed in
Task 7 of the Wave 2 plan. The installed OpenClaw TTS support for Inworld Max
is unverified; media-generated narration is the fallback for spoken cards.

## Stage 6. Human acceptance

These require Keith and cannot be produced by an agent or a test:

1. One intended rejection signed from Discord and one from Telegram, each with
   a note, visible on the web with transcript and attribution.
2. One listening proposal for a real composition, confirmed; omitted ratings
   stay absent and a replayed callback creates no second session.
3. A web confirmation of the same kind of intent with signers disabled or
   unavailable.
4. A target-changed rejection and an unknown-signer rejection.
5. An on-demand docket request in each configured channel, with a second
   request showing receipt suppression.

Record dates, intent codes and observed results in a dated handoff. Until all
five pass, Wave 2 stays "deployed, acceptance pending".
