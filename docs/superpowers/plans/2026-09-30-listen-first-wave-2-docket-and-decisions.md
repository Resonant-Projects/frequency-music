# Listen-first Wave 2: docket and signed decisions

Date: 2026-09-30. Status: implementation plan ready; external integration setup and human acceptance remain. Wave 2 is not deployed.

Deliver the pending review and listening docket through the existing `freq` agent. The agent proposes actions; Keith confirms them through platform-verified signer bots or the authenticated web page. Prepare and ship text delivery first. Add spoken cards after Keith selects the Wave 1 house voice.

The canonical behavior and security checks are in [Freq docket and voice decisions](../specs/2026-09-28-freq-docket-and-voice-decisions-design.md). The [program design](../specs/2026-09-28-listen-first-program-design.md) owns wave ordering and the human decision boundary. This plan adds implementation order, concrete files, and operator gates without replacing those contracts.

## Verified starting point

The following code facts were checked against this checkout on September 30. A bounded read-only external check also inspected the infrastructure checkout and selected OpenClaw presence/status fields; its findings and access limits are recorded below.

| Available code | Consequence for Wave 2 |
| --- | --- |
| `convex/agentDrafts.ts` has authenticated approve, reject, and supersede mutations. | Extract the application logic and preserve every promotion invariant and run reconciliation effect. |
| `convex/feeds.ts` stores disabled Source Scout proposals in `metadata.proposal`; `convex/shared/feedProposals.ts` validates that provenance. | An `enableFeed` intent targets the existing `feeds` row, not a new feed-proposal table. |
| `convex/shared/listeningPredicates.ts` identifies human listening sessions. | Reuse it for docket debt; a machine session never closes human listening debt. |
| Audio artifacts, narration jobs, media completion, voice catalog, and house-voice settings exist. | Reuse the Wave 1 media pipeline. `docketCardId` already exists in audio references. |
| `convex/narrationPrompt.ts` accepts a docket source kind. | Docket blurb generation and narration orchestration still need implementation. |
| `convex/audioArtifacts.ts` has authenticated playback and a blind-safe internal playback query. | MCP playback must use an authorized internal projection and preserve the blind check. |
| The tool manifest, args, registry, wrappers, and HTTP transport exist. | Extend the declarative tool contract rather than writing a parallel backend transport. |

There are no docket or decision-intent tables/modules, signer webhook handlers, or MCP server in the audited checkout. Drafts and feeds have no revision counter. Listening sessions have no structured conditions and only `expandability` is range-checked today. The draft page does not implement `?draft=` or `?intent=` navigation.

## Wave 1 dependencies

- Text docket queries, proposal contracts, signer integration, and MCP implementation may proceed now.
- Spoken blurbs and OpenClaw house-voice configuration wait for Keith to rate the real shootout and explicitly choose the house voice. Agents must not create his ratings or choose a winner.
- The signed-in Wave 1 Listen page now provides the private feed address. Human acceptance still requires website and Pocket Casts playback. The shootout can appear in the feed before the house voice is chosen; the first weekly narration follows his choice. See the [live handoff](../../listen-first-live-handoff-2026-09-30.md) for production evidence.
- Wave 2 must preserve the working feed and media worker. It does not add Wave 3 renderer jobs or Wave 4 tournament execution.
- Treat historical production and channel descriptions in the specs as leads for verification, not evidence that a configuration is currently installed.

## External prerequisites and verification gaps

Do not put channel identifiers, account identifiers, bot tokens, webhook secrets, or feed tokens in this file. Record identifiers in operator configuration and store credentials through 1Password references.

| Prerequisite | Evidence now | Next check or setup | Blocks |
| --- | --- | --- | --- |
| Existing `freq` OpenClaw agent and Telegram account on moltbot | Confirmed live: `freq` exists, has a Telegram binding/account, and its account has a bot credential or reference. Gateway is active. | Verify actual message delivery during the authorized integration acceptance window; configuration presence is not delivery evidence. | Channel integration. |
| Discord guild access and `#frequency` | Discord is configured live, but `freq` has no Discord binding. Two channel entries exist; neither is named `frequency` in config. Their opaque IDs do not establish whether a channel exists on Discord. | Discover an existing channel and permissions. If absent, Keith creates it because the documented OpenClaw bot lacks Manage Channels. Configure the exact channel binding outside this repo. | Discord delivery. |
| Separate Discord Frequency Signer application | Required by design; creation and credentials unverified. | Create or locate the application, bot token and public key; grant card-posting permissions and configure the interactions endpoint. | Discord confirmation. |
| Separate Telegram Frequency Signer bot | Required by design; creation and credentials unverified. | Create or locate it, confirm Keith has opened its chat, and configure the webhook path and secret-token header. | Telegram confirmation. |
| `DECISION_SIGNERS` | No mapping in current code. | Verify Keith's platform-scoped user IDs and existing Frequency user, then configure the mapping on Convex. | Attribution and signed application. |
| `MCP_SHARED_SECRET` | No current implementation/schema entry, no matching reference in the inspected infrastructure trees, and no setting-name presence in the live OpenClaw config. Vault existence remains unknown. | Locate or store an inbound secret separately from `AGENT_TOOL_SECRET`; deliver through an ExternalSecret and an OpenClaw env reference. | MCP authentication. |
| MCP image, Deployment, Service and TLS ingress | No `frequency-mcp` or hostname reference in the inspected infrastructure trees. Live OpenClaw has no top-level MCP config or Frequency MCP reference. Kubernetes deployment status could not be checked with this machine's default context. | Add or discover `frequency-mcp` in `frequency-worker`, serving `mcp.frequency.rproj.art`; verify DNS, TLS and Convex-only egress with a working cluster context. | MCP access from moltbot. |
| Telegram webhook reverse-proxy route | Wave 1 notes describe forwarding only podcast/storage paths and returning 404 elsewhere. | Add the webhook path on `listen.rproj.art` and verify it reaches the Convex site, without changing storage Range delivery. | Telegram updates. |
| Convex outbound access to platform APIs | Unknown. | Verify Discord and Telegram card-posting requests work from the backend. Signer credentials belong there, not in MCP/OpenClaw. | Posting and updating signer cards. |
| House voice and actual OpenClaw provider compatibility | Catalog mappings exist; live `freq` has no agent-level TTS setting. Installed OpenClaw reports `2026.9.6`. Human selection and provider support still need checks. | Select through `/listen`, then validate this installed OpenClaw version's TTS API/provider. | Spoken cards and spoken agent replies. |
| Deployment and CLI credential access | Operator-dependent. | Resolve through the existing Varlock/1Password flow. Check availability without printing values. | Production deploy/backfill. |

Root `.env.schema`, deployment secret definitions, and the agent environment contract must gain the settings needed by the implemented slice. Suggested names are `MCP_SHARED_SECRET`, `DISCORD_SIGNER_BOT_TOKEN`, `DISCORD_SIGNER_PUBLIC_KEY`, `TELEGRAM_SIGNER_BOT_TOKEN`, `TELEGRAM_WEBHOOK_PATH_SECRET`, `TELEGRAM_WEBHOOK_SECRET_TOKEN`, and `DECISION_SIGNERS`. Final names should follow the infrastructure repository's existing conventions. Keep public routing/account configuration separate from credentials.

### Read-only external evidence, September 30 at 01:10 UTC

- The infrastructure checkout at `/home/kelliott/code/homelab-infra`, commit `7183c00`, was searched for Frequency MCP and proposed signer setting references under `kubernetes/`, `services/` where present, and `hosts/openclaw/`. None were found. This is checkout evidence, not proof of their absence from production or 1Password.
- The documented trusted route `root@prox9.rproj.art`, `pct exec 200`, allowed selected presence checks of `/home/moltbot/.openclaw/openclaw.json` and installed package metadata. The active gateway, `freq`, Telegram binding/account, and Discord channel configuration were confirmed without printing identifiers, tokens, config contents, or environment values. No messages or mutations were performed.
- Signer setting names were not present in the live OpenClaw config. That is consistent with the required isolation of signer credentials; it does not establish that signer bots or backend secrets have not been created elsewhere.
- A bounded read-only Kubernetes resource query failed because the local default context targeted `http://localhost:8080` and the connection was refused. Cluster deployment/service/ingress presence remains unverified until an operator supplies the documented working context. No kubeconfig or credentials were read or copied.

### Wave 1 feed-route repair, September 30 at 01:49 UTC

The ready shootout exposed a live routing defect: `listen.rproj.art/api/storage/` went to the Convex site on port 3211 and returned 404, while the same artifact on the API origin returned the expected audio. The existing NPM host had no custom storage location. Its server-level allowlist already permitted podcast and storage paths.

Claude Opus 5.5 prepared the minimal location candidate; a GPT-6.1 Sol worker independently checked it and applied only the host's custom-location field through the authenticated NPM API. `/api/storage/` now forwards to the same backend host on port 3210 with an empty `forward_path`, preserving the original URI. The root/podcast upstream, allowlist, certificate, TLS, access-list and caching settings were verified unchanged. NPM reported the configuration online. No managed `listen.rproj.art` declaration was found in the searched infrastructure source; the correction persists in the existing NPM host configuration.

Suffix ranges such as `bytes=-100` then exposed an existing Convex storage issue: an empty body and an underflowed Content-Range, reproduced on the Listen route and direct API origin. Claude Opus 5.5 prepared a second bounded correction to the storage location's own advanced configuration. The reviewed snippet preserves the incoming Range header except for a single suffix-only range, for which it removes Range upstream. Convex then returns the full file with HTTP 200, a valid response when a server ignores Range. The condition only sets a location-specific variable; the header directive stays outside the condition. No global nginx or backend configuration changed. Remove this workaround after the upstream suffix-range behavior is fixed and verified.

NPM reported both corrections online. Public checks returned a complete 2,654,208-byte MP3 with HTTP 200, the correct 100-byte prefix and midfile ranges with HTTP 206, and a correct open-ended resume range matching the full file's remaining bytes. A suffix-only request returned HTTP 200 with the same full body and no Content-Range. Every body matched the original file or its expected byte slice. `/` and `/health` still returned 404, and an invalid feed token still returned 404. Actual Pocket Casts playback remains a human acceptance check. These corrections persist only on the existing unmanaged NPM host; no media runtime or unrelated proxy settings changed.

## Implementation rules

- `convex/shared/` owns cross-runtime Zod contracts. Derive Convex validators from those contracts and add return validators for new functions.
- Confirmations enter only through verified platform handlers or Clerk. No agent-tool or MCP operation applies an intent, signs a decision, or creates a listening session.
- A proposed transcript is evidence of what the agent proposed, not proof of a human signature. Human identity comes from the verified platform sender or authenticated web identity.
- Intents are immutable after creation except lifecycle, card binding, signature, and result. Apply the exact ordered checks in the canonical design in one serializable mutation.
- Signing secrets stay out of OpenClaw, the MCP deployment, model context, and logs. MCP uses `x-mcp-secret` inbound and the existing JSON-body `secret` contract outbound to Convex.
- New audio continues to store blobs through `audioArtifacts`. Docket cards reference artifact IDs, not `_storage` IDs, so they do not add an untracked storage owner.
- Register new backend modules in `harness/modules.ts` where harness tests load them. Agent tests currently run from `agent/tests/`; put MCP tests there so the existing configuration discovers them.
- Production changes are explicit deploy steps against the confirmed single live deployment. The user has authorized preparation, implementation and deployment for this work; do not add another generic permission loop. Actual ratings, signer actions, and house-voice selection remain Keith's actions.
- Hypothesis and recipe publication remains human-confirmed through the implemented signing path. Do not create real decisions to manufacture acceptance evidence.

## Task 1: shared contracts and revision identity

Files: create `convex/shared/decisionIntents.ts`, `convex/shared/docket.ts`, and their tests. Update `convex/schema.ts`, `convex/validators.ts`, `convex/agentDrafts.ts`, `convex/feeds.ts`, `convex/admin.ts`, and `CONTEXT.md`. Create an idempotent bounded revision-backfill mutation in `convex/decisionIntentsMigrations.ts`.

- [ ] Define action-specific payloads, target discriminators, provenance, signer events, immutable intent fields, receipts, listening conditions, and stable SHA-256 payload-digest inputs.
- [ ] Add the four tables in the design: `decisionIntents`, `webhookEvents`, `docketCards`, and `docketDeliveries`, with indexes for code, target, status/expiry, and receipt deduplication.
- [ ] Add optional revision fields first; old rows read as revision zero. Add revision increments to every draft/feed write, including admin and feed polling writes. Inventory all insert/patch/replace paths before declaring this complete.
- [ ] Backfill zero in bounded batches without overwriting a revision changed during migration. Only require the field after all writers and existing rows are migrated.
- [ ] Add draft decision-source/transcript/intent fields and structured listening conditions.
- [ ] Test stable digests, discriminated action validation, missing legacy revisions, migration repeatability, and all existing mutation revision increments.

Decision to preserve: the spec requires every row write to increment revision. Feed polling can therefore invalidate a feed-enablement proposal. Implement that rule and test it. Changing to a content-only revision would require an explicit design amendment.

Acceptance: old rows remain readable during rollout, migrations can be repeated, and an intent cannot silently apply after any target mutation.

## Task 2: one application path and immutable proposals

Files: update `convex/agentDrafts.ts`, `convex/feeds.ts`, `convex/listening.ts`, and their tests. Create `convex/decisionIntents.ts` and `convex/decisionIntents.test.ts`; update harness modules and add a decision-equivalence harness test.

- [ ] Extract `applyDraftDecision` from approve/reject/supersede. Web mutations still authenticate and call it. Preserve amended-payload provenance, `whyThisMatters`, recipe hypothesis existence, pending checks, rejection notes, superseding-draft checks, graph scheduling, and run reconciliation.
- [ ] Create immutable decision and listening proposals with Convex-generated codes, 30-minute expiry, target revision, digest, and channel/conversation/message/transcript provenance.
- [ ] Authenticate the proposal service without accepting `actor`, `createdBy`, signature, or signer identity from the model.
- [ ] Implement internal platform apply and authenticated web apply. Follow replay, state/expiry, card binding, signer mapping, cancel/digest, revision, application, and audit ordering from the design.
- [ ] Implement feed-specific application on the existing disabled proposal row. Check proposal provenance and revision before enabling it.
- [ ] Implement signer-confirmed two-week docket deferral without changing research data.
- [ ] Add `listening.createInternal` for the signed path, with all six supplied subjective ratings range-checked, required conditions, missing ratings preserved, transcript feedback, and the mapped user's `createdBy`. Do not populate `consonanceComputed` from voice feedback.
- [ ] Make a repeated event return its stored result and a repeated applied intent produce no second record. Record rejections in the planned result/audit form.
- [ ] Test unknown signer, expiry, card/chat/message/digest mismatch, stale revisions, duplicate events, duplicate intent application, cancellation, transcript storage, and web/platform application equivalence.

Acceptance: proposing alone changes no domain decision or listening session; confirmed decisions retain the same invariants and side effects as the existing web mutations.

## Task 3: signer bots and platform verification

Files: create `convex/discordInteractions.ts`, `convex/telegramWebhook.ts`, `convex/decisionSignerDelivery.ts`, and colocated tests. Update `convex/http.ts` and environment schemas. Add signer secrets and routes in the infrastructure repository as a separate change.

- [ ] Post one action-specific signer card with target title, note, digest prefix, Confirm, and Cancel. Store the actual platform/chat/message binding only after the post succeeds; retry failures without fabricating a binding.
- [ ] Verify Discord Ed25519 signature against the raw request body and reject timestamps older than five minutes. Handle platform endpoint validation and acknowledge interactions within Discord's deadline.
- [ ] Guard Telegram by both the unguessable webhook path and its secret-token header. Parse callbacks and the exact typed confirm/cancel code forms in the design.
- [ ] Resolve typed Telegram confirmations through the stored card binding; a code typed in another chat must fail. Never pass a caller-supplied sender as trusted identity.
- [ ] Update signer cards with applied, cancelled, expired, or rejected status. The signer bot reports application; `freq` only reports proposals.
- [ ] Test forged signatures, old timestamps, missing/wrong Telegram secret, wrong sender/chat, callback digest tampering, code parsing, replay, unposted intents, and posting failure.

Acceptance: platform verification establishes the sender before the application function runs. The bots can post cards without exposing their tokens to MCP or OpenClaw. Signature failures return 401 and do not log the raw request or secret.

## Task 4: docket eligibility, reconciliation and narration

Files: create `convex/docket.ts`, `convex/docketBlurbs.ts`, `convex/docket.test.ts`, and blurb tests. Update `convex/agentDrafts.ts`, `convex/mediaJobEffects.ts`, `convex/crons.ts`, `convex/llm.ts` as needed, and shared docket contracts.

- [ ] Implement the dedicated `docket.currentState` query using the five eligibility rules in the design. Do not reuse the loop-report census or its 14-day cutoff.
- [ ] Deduplicate by target, rank pending drafts before oldest debt, respect confirmed deferrals, and return at most ten cards for on-demand requests and three for weekly delivery.
- [ ] Generate 60–90-word blurbs with `DEFAULT_MODEL`; regenerate only after semantic content changes. Spoken copy omits IDs and links. Trace model calls through the existing LLM layer and add a task output limit if needed.
- [ ] Mark the docket stale after new drafts and completed media work. Rebuild when stale/older than one hour and reconcile Thursday at 16:30 UTC. Do not generate repeatedly while a rebuild is already in progress.
- [ ] If a house voice is absent, return usable text. After selection, enqueue private narration with `refs.docketCardId` and `assembleOnDone: false`; use existing narration artifacts rather than broadening media artifact permissions solely to rename them `blurb`.
- [ ] On completion, attach the ready artifact and expose playback through the blind-safe internal helper. Never expose an unrevealed blind member or its identity.
- [ ] Implement posting/posted receipts with atomic admission, channel and content-version identity, a 24-hour suppression for unfinished posting, seven-day suppression for posted unchanged cards, and updated-card behavior.
- [ ] Test each eligibility kind, human/machine listening distinction, no age truncation, dedupe/rank, changed hashes, deferral, simultaneous delivery attempts, receipt crash behavior, narration dedupe, and text availability without voice/audio.

Acceptance: cards accurately represent remaining human work; narration failure or delay cannot block text delivery.

## Task 5: MCP and controlled backend tools

Files: create `agent/src/mcp/server.ts` and `agent/tests/mcp/server.test.ts`. Update `agent/package.json`, its lockfile/environment contract, `agent/Dockerfile` if required, `convex/shared/agentToolArgs.ts`, `convex/shared/agentToolManifest.ts`, `convex/agentToolRegistry.ts`, `convex/agentTools.ts` static exports, and tool documentation through `scripts/generate-agent-tool-docs.ts`.

- [ ] Implement a stateless streamable-HTTP MCP server with schemas and a bounded health check. Add a pinned compatible SDK dependency to the agent package using its own install context.
- [ ] Expose `docket.list`, `docket.card`, `decision.propose`, `listening.propose`, and `delivery.record` using the existing Convex HTTP transport.
- [ ] Extend the backend manifest/registry with read and proposal/delivery operations. Decide and test the manifest classification for proposal writes; do not treat human confirmations as agent operations or forge research-run provenance for OpenClaw conversations.
- [ ] Enforce constant-time inbound secret checking and preserve the separate outbound `AGENT_TOOL_SECRET`. Reject malformed payloads without leaking secrets or returning unbounded target data.
- [ ] Keep `render.request` and `tournament.request` visible only with explicit capability responses until Waves 3/4 exist: `{ status: "unavailable", requiredWave: 3 | 4, reason, pageUrl? }`. Return a validated result and enqueue nothing. Do not pretend a future job is queued.
- [ ] Ensure no confirm/apply/listening-create endpoint is available through MCP. Test all tools with an adversarial caller-supplied actor/signature and verify those fields cannot become authority.
- [ ] Test authentication, schema failures, bounded reads, proposal-only effects, playback blindness, future-wave no-write behavior, and downstream failure handling.

Acceptance: authenticated `freq` can read and propose through MCP; every human confirmation still requires the independent signer path.

## Task 6: web fallback and traceable deep links

Files: update `web/src/routes/agent-drafts.tsx`, draft display components, and route search handling in the existing router definition. Add focused route/search tests where the current test setup supports them.

- [ ] Implement `?draft=<id>` selection and `?intent=<id>` review with Clerk authentication. Fetch linked terminal drafts explicitly; current pending-queue selection must not hide a just-decided target.
- [ ] Show the immutable intended action, target, note, exact payload summary, expiry and current status. Add one Confirm button and a cancel path consistent with the canonical design.
- [ ] Display decision source and disclose the transcript and intent reference on terminal draft rows.
- [ ] Add a Listen section to recipe/composition pages where authorized ready audio exists. Preserve current route/design tokens.
- [ ] Verify a link from each channel opens the correct target on a phone, expired or changed proposals explain their state, and repeated taps do not duplicate a decision.

Acceptance: Keith can review and confirm the same intent through the web when a platform signer is unavailable; decisions stay attributable.

## Task 7: incremental deployment and OpenClaw configuration

This task touches production and the separate infrastructure/OpenClaw configuration. Identify the exact target and expected effects in the execution log before each deployment. Link every associated PR with the thread's PR-linking tool.

- [ ] Deploy backward-compatible schema/application code with signing and automated delivery disabled. Verify the website and private feed still work, then backfill revisions and confirm every writer uses them.
- [ ] Build/publish the MCP-capable agent image and deploy the dedicated MCP workload, Service, ingress, and ExternalSecret. Probe unauthenticated rejection, authenticated tool listing and Convex reachability from moltbot. Keep the research worker healthy.
- [ ] Install signer secrets only on Convex, expose the webhook routes, register platform callbacks, and verify harmless platform validation requests. Do not send real research decisions as smoke tests.
- [ ] Configure the existing `freq` agent with the exact Discord peer binding ahead of its catch-all, channel permissions, MCP secret env reference, and tool access limited to `freq`.
- [ ] Update the external `freq` workspace instructions: propose rather than apply, ask for missing rejection notes/listening conditions, preserve absent ratings, and direct signatures to the signer card. Do not claim a proposal was applied.
- [ ] Configure weekly delivery Thursday 17:30 UTC and Friday episode/studio-prompt delivery. Use receipts; no unchanged posts and no auto-resend of unresolved posting receipts. Verify the actual installed heartbeat scheduler supports the intended timing.
- [ ] After Keith chooses the voice, validate OpenClaw provider compatibility and enable spoken blurbs. If a catalog mapping is unsupported, deliver the existing media-generated audio while documenting the agent-reply TTS limitation; do not silently substitute a house voice.

Acceptance: text delivery works independently of speech, platform verification reaches the correct Convex deployment, and existing worker/feed behavior survives each step.

## Task 8: checks and human acceptance

- [ ] Run focused backend tests and harness tests for decisions, webhooks, docket and listening. Run MCP tests in the agent package. Run root/agent/web type checks for the changed seams.
- [ ] Run `vp run verify` before handoff and `vp run build` from `web/` for the web change. Root `vp run build:web` currently fails task resolution before building; the direct package command is verified. Install dependencies with `vp install` in the affected package context. Report exact blockers and whether they predate the change.
- [ ] Use the product-native browser preview for manual website checks when available. Avoid running production-connected e2e suites until their target and mutation behavior are verified; existing e2e infrastructure has documented production-target risk.
- [ ] Verify on-demand docket requests in both configured channels, text-first weekly delivery and receipt suppression. Record actual successful results rather than only configuration presence.
- [ ] Keith signs one intended rejection from Discord and one from Telegram, with required notes. Both appear on the web with transcripts and correct attribution. If real rejectable drafts are unavailable, use isolated test data and report the production acceptance as pending.
- [ ] Keith confirms a listening proposal for a real composition; omitted ratings remain absent, conditions are retained and a replay creates no second session.
- [ ] Verify the web fallback and a target-changed rejection. Verify invalid platform signatures and unknown signers cannot apply anything.
- [ ] Verify spoken cards use the human-selected house voice, text arrives while narration is pending, and unrevealed audio remains concealed.
- [ ] Record the live website routes, privately retrievable feed URL, platform setup status, deployed versions, remaining human steps, and test evidence in the handoff.

Wave 2 is implementation-complete only when Tasks 1–6 and the required automated checks pass. It is production-accepted only when the configured integrations and the actual human signing/listening checks pass. Uncreated signer bots, an unknown channel, or an unselected voice must remain explicit pending items.

## Planning rulings requiring confirmation during execution

1. Preserve the canonical every-write revision rule, including polling. Report the practical feed-intent expiry behavior rather than quietly weakening revision checks.
2. Use 60–90 words per docket card. The earlier Wave 1 plan mentions a 3–5-minute docket script; that is not a reason to expand every individual card beyond the Wave 2 contract. A later aggregate narration can have its own length target.
3. Keep narration artifacts for spoken blurbs with docket references, unless there is a concrete requirement for a separate artifact kind. Current `narrate` lifecycle permissions allow narration artifacts, not arbitrary blurb writes.
4. Specify capability-unavailable responses for Waves 3/4 in the tool schema and `freq` instructions. Add actual enqueue behavior only when executors and contracts ship in those waves.
5. Inspect installed OpenClaw versions/config syntax before editing the external host. A catalog provider name is not proof that that installed version supports the provider.
6. The presence checks above establish the existing `freq` Telegram configuration. Separate signer-bot creation, Discord channel identity, credentials in the backend/vault, and the human signer mapping still need operator evidence; none were staged by this plan task.
