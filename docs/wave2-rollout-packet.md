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

## Combined rollout work order, 2026-10-17

Prepared from read-only observations taken at 02:55 to 03:08 UTC; the reads,
results and file digests are in the
[evidence record](evidence/wave2-rollout-20261017/README.md). Nothing here
has run against production. Each numbered step that contacts production,
changes an environment value or replaces a running image needs the
coordinator's approval of that step.

### Observed state

| Item | State |
| --- | --- |
| Convex backend | Root modules match the attested `81150337` release artifact (#135, 2026-10-11; provenance run 38195261921), 177 of 177. `scripts/convex-provenance-verify.ts` verified the attestation and the live match together at 03:25 UTC. Precedes #118, so #118, #138, #140, #141, #142 and #153 are all absent, including `docket:listWeb`. No `rag` component. No schema change in progress. |
| Agent-run queue | 0 queued, 0 running, 3 needs_review; claims not paused |
| Agent worker | Kubernetes `frequency-worker`, Argo CD, source revision `81150337`. Lacks the `failure-investigation` and `hypothesis-tournament` graphs. `AGENT_OUTBOX_DIR` unset; PVC mounted at `/data`. |
| Media worker | ai-5090-02, image `sha-4f016f83` (2026-10-01), renderer 0.2.2, idle for 7 days |
| MCP workload | Not deployed |
| Web | Vercel production at `91cb3047`; calls ten functions the backend lacks |
| HTTP actions origin | `https://convex-http.resonantprojects.art` serves the HTTP router (`/health` 200, Cloudflare). `https://convex.resonantprojects.art` is the API origin and returns 404 for every HTTP route. |
| Admin key | Readable through `op run` with a reference-only env file; the host's service account now lists `Country Manor Lab` |
| `OPENAI_API_KEY` | Present and non-empty on the deployment (one names-only read, 03:26 UTC). After activation, `/agent-tools/searchSourcePassages` can embed a query with it (effect 3). Passage indexing stays off until its own activation. |
| Restore receipt | None current. The last passing whole-container restore was 2026-08-05; see the [receipt work order](wave2-restore-receipt-work-order.md). |

### Pinned candidate

| Artifact | Pin |
| --- | --- |
| Convex source | `main` at `91cb3047`. `convex/`, `package.json` and `bun.lock` are identical at `6f332386`, `57f7c90b` and `91cb3047`. Attested manifest `convex-root-modules-91cb304701f5a96b06251bda3f34ff6e0407c37a` from provenance run [38998580987](https://github.com/Resonant-Projects/frequency-music/actions/runs/38998580987): 249 root modules, SHA-256 `1f9dd07b8f8e0e3eb3d0ed346c7aed977f971322022071758e22573aa090ab7b`, attestation verified with the strict flags (`release-attestation-91cb3047.json`). |
| Agent image | `registry.rproj.art/frequency-music/frequency-music-agent@sha256:6853836008280dbca712558e412a946b73a79993ad5250b54e67c079f4d37c5d` (source `6f332386`; same digest on GHCR; attestation verified, run 38995835502) |
| Media image | `ghcr.io/resonant-projects/frequency-music-media@sha256:2b58a8ace6bb080f1b5515f3ba89e687df357ab3d2f92b583114c35d522c971d` (source `6f332386`, renderer 0.3.0; attestation verified, run 38995835619). It replaces the earlier `sha-0cc0592…` pin: `media/` is unchanged since then, but the image also carries `convex/shared/`, which #153 changed. |
| Web | No change; production already runs the candidate's web source |

The pin excludes the human studio comparison
([contract](studio-comparison-contract.md)), which was reviewed locally on
2026-10-17 and is not merged. Including it in this window means a new pinned
commit, its own `convex-provenance.yml` artifact and attestation, a fresh dry
run and coverage from that checkout. It changes `convex/` (a new module and a
widened `blindGroups.purpose` union) and `web/`; a `main` merge publishes the
web change to Vercel production before the backend carries it.

### What the Convex deploy changes (`81150337` to `main`)

- **Schema.** 11 new tables, 16 new optional fields, 3 widened unions and 15
  new indexes on `claims`, `edges`, `extractions`, `agentRunEvents`,
  `agentReviewDrafts`, `audioArtifacts` and `mediaJobs`. Index backfills on
  `claims`, `edges` and `extractions` run during the push. An offline
  comparison of both commits' `schema.export()` found no removal and no field
  that became required; the dry-run diff is the authority.
- **Components.** Mounts `rag` (#153) and its nested workpool. A later
  deploy of source without `app.use(rag)` would change that mount. Read the
  dry-run output before any rollback.
- **Crons.** Adds `normalize-legacy-extraction-history`,
  `reconcile-extraction-attempts` and `reconcile-operation-recovery` (every five
  minutes, ungated); `rebuild-docket` (gated by `DOCKET_PREPARATION_ENABLED`);
  and `passage-index-sweep` (Sunday 15:30 UTC, gated by the `passageIndexing`
  settings row).
- **HTTP.** Adds the two signer routes, which return 404 while
  `DECISION_SIGNERS_ENABLED` is off, and 22 agent-tool routes.

Effects that start at activation without any flag:

1. **Legacy extraction normalization (#118).** It processes every existing
   Extraction one transaction at a time and reschedules itself while it makes
   progress. Superseded readings become `historical`, their active Claims are
   retired (up to three per transaction), and concept reconciliation withdraws
   obsolete automatic concept edges and decrements mention counts. It makes no
   model call. No flag stops it, and a code rollback does not undo it. Approve
   it explicitly as part of the deploy.
2. **Operational Failure recovery (#118).** It is idle until a failure row
   exists. New code records failures from extraction, capture and media work.
   Recovery then acts without any flag or agent claim: an extraction failure
   gets two automatic retries (extraction resumption, which can repeat the
   model call when no output was retained), a retained result replays
   completion, and a supported media failure requeues its job for one more
   leased execution. Exhausted retries queue `failure-investigation` runs (one
   Anthropic call each, at most 4,096 output tokens), and capture failures
   queue `source-scout` recoveries. The running agent worker fails
   `failure-investigation` as an unknown graph, which leaves the failure in
   `needsReview`. `FREQUENCY_WORKER_CLAIMS_PAUSED` stops only agent claims,
   so an empty agent queue does not show that extraction or media recovery is
   quiet.
3. **Passage hooks (#153).** Every source text write schedules
   `passages:indexSource`. While the `passageIndexing` row is absent, the call
   returns `disabled` without an embedding request. Cleared or deleted text
   runs a removal against the empty index. `/agent-tools/searchSourcePassages`
   embeds its query with OpenAI even while indexing is off; no graph calls it.
4. **Renderer version (#140).** Every media job enqueued after activation
   requires renderer 0.3.0. The 0.2.2 worker claims none of them, and the
   sweep parks queued mismatches after ten minutes.
5. **Docket reconciliation (#141 and #140).** Each recipe card's hash changes
   once, and render masters stop listing (see
   [Listen-first next tracks](#listen-first-next-tracks)).

Gates that stay closed: `DECISION_SIGNERS_ENABLED`,
`DOCKET_PREPARATION_ENABLED` and `HYPOTHESIS_TOURNAMENT_ENABLED` unset or
`false`; `renderValidation` unset; no `passages:setIndexingEnabled` call; no
`MCP_SHARED_SECRET` or MCP workload; Weekly Turn narration and the
`reconcile-episodes` cron stay off (neither commit registers that cron).

### Order

0. **Before the window (no production contact).**
   - Done: `convex-provenance.yml` ran on `main` at `91cb3047` (run
     38998580987), and its manifest's attestation verified with `gh` 2.102.0
     (see Pinned candidate). Run `scripts/convex-provenance-verify.ts` with that
     `gh` first in `PATH`, as in the evidence record; `gh` 2.46.0 lacks
     `attestation`.
   - Done: the `homelab-infra` change is prepared and not pushed (local commit
     `42ff776d`, branch `prep/frequency-wave2-rollout-20261017`, patch in the
     evidence record). It pins the agent digest, sets
     `AGENT_OUTBOX_DIR=/data/outbox` on the existing `/data` PVC as
     [pipeline recovery](pipeline-recovery.md#audit-delivery) requires for
     Kubernetes, adds an init container that creates that directory (the
     worker refuses a missing outbox root), and adds `litmusRender` to
     `MEDIA_JOB_KINDS`. The media image tag is not repo-backed; step 7 sets it.
   - Approve the five effects above, including the legacy normalization.
   - Choose the rollback mechanism (below). The
     [supported procedure](frequency-supported-deployment-rollback.md) lists a
     current isolated-restore receipt as a gate; none is on record. The
     [receipt work order](wave2-restore-receipt-work-order.md) defines what the
     recovery owner must produce and when.
   - `scripts/convex-deploy.ts` checks only that standard input is a terminal
     and that the typed answer is exactly `deploy`. Anyone authorized can run
     steps 3 and 4, including an agent driving a pseudo-terminal, once the
     coordinator has approved that step. The prompt is a confirmation, not a
     human-presence check. Keep it; do not bypass it.
1. **Pause agent claims.** Set `FREQUENCY_WORKER_CLAIMS_PAUSED=true` on the
   Convex deployment. The deployed `81150337` backend reads it. Suspend
   manual and direct graph execution, which bypasses the pause. Rerun
   `scripts/frequency-queue-evidence.ts` until it shows `claimsPaused: true`,
   0 running and a complete scan. Confirm the media worker has no claimed job.
   Then the recovery owner takes the receipt's part B archive
   ([work order](wave2-restore-receipt-work-order.md#two-parts-in-order)) and
   records it before step 3.
2. **Read the deployed state again.** Rerun the inspection and
   `scripts/convex-module-identities.ts`. Any difference from the evidence
   record means someone has deployed since; stop and reconcile.
3. **Dry run.** Blocked until every [open decision](#open-decision) item
   holds. `vp run convex:deploy:dry-run` from a clean checkout of the
   pinned commit (no `.env` or `.env.local`). This uploads bundles and starts
   schema and index preparation. Stop on any removal, required-field change,
   unexpected component change or an authentication prompt.
4. **Deploy.** Run `vp run convex:deploy` from the same checkout.
5. **Verify the backend.** Run the inspection and coverage again. Expect exit 0,
   all six groups deployed, `rag` active, no in-progress schema, and the root
   modules equal to the attested artifact. Run coverage from the pinned
   checkout: a checkout that contains the unmerged studio comparison
   candidate adds a seventh group, `studio-comparison`, which stays missing
   (exit 3) after this deploy.
6. **Agent worker.** Push the prepared `homelab-infra` branch, review it as a
   PR against `main`, and merge it. The merge is the production authorization:
   Argo CD syncs `kubernetes/infra/frequency-worker` automatically, and the
   `Recreate` strategy stops the old pod before the new one runs its
   `outbox-dir` init container. The same commit's `hosts/frequency-media`
   change is inert until step 7 copies it. Zero running rows do not prove the old process is idle: the stale
   sweep can fail a row while its process continues, and a claim admitted
   before the pause can still be returning. Before the new pod starts
   claiming, confirm the old pod terminated after its SIGTERM drain (its log
   shows the poll settled), rerun the queue scan, and reconcile any row the
   sweep failed during the window
   ([handoff protocol](frequency-worker-handoff.md)).
7. **Media worker.** On ai-5090-02, in `/srv/frequency-media`, keep a dated
   backup of `.env` and `compose.yaml`, like the existing `.env.backup-*`
   files there. Then
   change both before deploying: copy `compose.yaml` from the merged
   `homelab-infra` `main`, and set `.env`'s single line to
   `MEDIA_IMAGE_TAG=sha-6f332386d01089270b740ea009ee5088d8534a91@sha256:2b58a8ace6bb080f1b5515f3ba89e687df357ab3d2f92b583114c35d522c971d`.
   The old image exits at start under the new job list. Run
   `op-access run homelab-runtime -- ./deploy.sh`. Keep the
   `frequency-media_media-work` volume. Run the smoke command in the new
   container before requesting any render.
8. **Resume claims.** Set `FREQUENCY_WORKER_CLAIMS_PAUSED` to `false` or
   remove it. Rerun the queue evidence.
9. **Revision backfill.** [Stage 2](#stage-2-revision-backfill).
10. **Passage activation.** This is separate work, per
    [plan 15](plans/2026-08-01-15-passage-index.md#operator-runbook-each-step-contacts-production).
    `scripts/convex-deploy.ts` passes `--codegen disable`, so the deploy does
    not regenerate `convex/_generated`; the hand-written `components.rag` and
    `passages` types stay as committed. The runtime resolves both through
    `anyApi` and `componentsGeneric()`.

### Rollback

- Leave every gate closed. That disables all new outbound or paid behavior
  except the five effects above.
- Workers: merge a `git revert` of the `homelab-infra` change for the agent.
  For media, restore the backed-up `compose.yaml` and `.env` together
  (`MEDIA_IMAGE_TAG=sha-4f016f83e4d3653e4ecad726d9648790d51cad54@sha256:a3144accbbba957bcec1587fa924b8ad5ff99e89655f4ed6b72600ba7be8286f`),
  because the 0.2.2 image has no `litmusRender` handler. Use the same
  protocol as steps 1 and 6. Set
  `FREQUENCY_WORKER_CLAIMS_PAUSED=true`, suspend direct execution, wait until
  the media worker holds no claimed job, confirm each old process terminated
  after its drain, rerun the queue scan and reconcile any swept row before the
  replacement starts. The old agent image predates the `.spool` outbox and
  cannot replay it ([pipeline recovery](pipeline-recovery.md#audit-delivery)),
  so also confirm `/data/outbox` holds no active record, or keep the new
  worker running until it drains. The old agent worker fails any queued
  `failure-investigation` or tournament run as an unknown graph, and the old
  media worker claims no 0.3.0 job. Keep claims paused while such runs are
  queued, and use this only as a short holding state while the new backend
  stays deployed.
- Convex code: within minutes of activation the normalization writes
  `extractions.historical`, which the `81150337` schema does not declare. After
  that, redeploying `81150337` as-is fails schema validation. Fix forward, or
  deploy older functions with the current `convex/schema.ts`,
  `convex/validators.ts`, `convex/shared/` and `convex/convex.config.ts`, as in
  [Stage 1](#stage-1-backend-deployment-with-everything-disabled).
- Undoing the normalization's retired Claims, or any other data change,
  requires the separately approved backend restore with its write-loss window.

### Open decision

Repository-side preparation is complete. Step 3 and every later backend
mutation stay blocked until each item of the supported procedure's
[approval packet](frequency-supported-deployment-rollback.md#approval-packet-before-any-backend-mutation)
holds. This work order adds no exception to it.

| Approval packet item | Status |
| --- | --- |
| 1. Release binding | Candidate named: `91cb304701f5a96b06251bda3f34ff6e0407c37a`, run 38998580987, artifact 12087908946, manifest SHA-256 `1f9dd07b…`, attestation verified. A clean detached checkout at that commit (Node 24.22.0, Convex CLI 1.46.0, frozen lockfile) rebuilt the manifest offline byte-identical to the attested artifact. Open: preserve the candidate's full schemas, component definitions and bundles for review, beyond the root-only attestation. |
| 2. Protected current-to-candidate comparison | Partial: root module delta, offline `schema.export()` comparison, the six coverage groups and the new crons are recorded above. Open: the complete comparison of validators, visibility, HTTP routes, authentication, component definitions, arguments and state, Node runtime and dependencies, and every root and component cron schedule. |
| 3. Rollback receipt and backend identity | Open: the [restore receipt](wave2-restore-receipt-work-order.md), parts A and B, each needing its own approval because each writes infrastructure. The backend image is declared (`d715e9ec…`, `precompiled-2026-09-28-5c7cb5b`) but not observed; `/version` returns `unknown`. Read the running container's image digest under the recovery owner's read-only access. |
| 4. Maintenance protocol | Open: step 1 pauses agent claims and direct execution only. The deployed `81150337` crons, workpool recovery and scheduled work keep running, and after activation so do effects 1, 2 and 4. The backend coordinator must supply verified controls, or an approved protocol for producers, scheduled execution and active work, before step 3. |
| 5. Named approval | Open: operator, target, candidate, maintenance interval, rollback criteria and the approved rollback mechanism (restore). Approve schema preparation (step 3) and activation (step 4) separately, or approve one ordinary deploy that explicitly covers both phases. Include approval of the five activation effects, among them the irreversible #118 normalization. |

Every live step after that (claims pause, dry run, deploy, `homelab-infra`
merge, media replacement, resume, backfill) still needs its own approval.

### Acceptance checklist

- [ ] Coverage exit 0 against a post-deploy inspection; `rag` active.
- [ ] Root modules equal the attested release artifact for the pinned commit.
- [ ] `GET https://convex-http.resonantprojects.art/health` returns 200. A
      `POST` with an empty body to `/discord/interactions` and to
      `/telegram/webhook/x` on the same origin returns 404.
- [ ] Signed in as Keith: `/listen` and the feed return the existing episodes;
      the docket page, intent review, audio feedback and Agent Run failure
      panel load without a missing-function error.
- [ ] Agent and media pods run the pinned digests. The media smoke passes in
      the container, and a probe job completes.
- [ ] After claims resume, one scheduled agent run completes on the new
      worker, and the queue scan is complete.
- [ ] The revision backfill exits 0 with `verified: true` for both tables.
- [ ] No Extraction with an unset `historical` remains, checked in the Convex
      dashboard data view.
- [ ] Gates read closed. Read the values of the non-secret gate variables
      (`DECISION_SIGNERS_ENABLED`, `DOCKET_PREPARATION_ENABLED`,
      `HYPOTHESIS_TOURNAMENT_ENABLED`, `FREQUENCY_WORKER_CLAIMS_PAUSED`) one by
      one; each must be unset or exactly `false`. Never list values in bulk, which would print
      credentials. In the `settings` table, `renderValidation` must be absent
      or not `go`, and `passageIndexing` absent or not `enabled`.

Human acceptance stays as in [Stage 6](#stage-6-human-acceptance).

## Current status, 2026-10-17

Superseded by the work order above for the backend revision and admin-key
access. Kept as the record of the anonymous `docket:listWeb` query.

Read-only facts gathered on 2026-10-17. The table rows date from 00:13 to
00:20 UTC; the anonymous docket query came later the same day. Only that query
observes the Convex backend, and it observes one function.

| Item | State | Evidence |
| --- | --- | --- |
| Production web (Vercel) | `main` at `ec04c7c`, READY | Vercel deployment `dpl_5QC2q55HnZ6geiPeRft17Yjx3ZrZ`; production builds every `main` merge |
| Production backend | `docket:listWeb` absent; deployed revision otherwise unknown | One anonymous `docket:listWeb` query (Stage R step 2) returned HTTP 200 with `status: "error"` and `Could not find public function for 'docket:listWeb'.` (request `001916731ddd8d07`). `GET /version` returned 200. Admin key still unreadable, see below. The last recorded Convex deployment is `2d2c78e` (2026-10-05), before #138. |
| Media image with renderer 0.3.0 | Published, host rollout unknown | `publish-media-image` succeeded for `main` at `0cc0592`: `ghcr.io/resonant-projects/frequency-music-media:sha-0cc05921d05c53dd6a3076824b19aab68215a77a` |
| Agent image with the tournament graph | Published and copied to Lab Harbor, host rollout unknown | `publish-agent-image` succeeded for `main` at `0cc0592` |
| MCP workload | Not reachable from the rollout host | `mcp.frequency.rproj.art` resolves to 192.168.30.200; `GET /health` made no connection |
| Runtime changes after `0cc0592` | None | `ec04c7c` differs from `0cc0592` in `convex/` only by `convex/listenNextIntegration.test.ts`, and not at all in `media/` or `agent/` |

**Web ahead of backend.** The production web calls functions that #138 and
#141 added: `docket.listWeb`, `decisionIntents.get`, `applyWeb`, `deferWeb`,
`cancelWeb`, `audioFeedback.queue`, `item`, `submit`, and
`audioArtifacts.listReadyForTarget`. The production backend does not expose
`docket:listWeb` as a public function, so the docket page the production web
at `ec04c7c` serves fails now. The query proves that this one endpoint is
absent, which confirms the docket deployment gap. It does not identify the
deployed revision or show which other #138 to #142 functions are present or
absent; the Stage R step 1 inspection answers that. The local source requires
a signed-in human before `listWeb` reads anything, and the error returned no
data. The query mutated nothing; it does not need repeating.

The 1Password service account on the rollout host can list only the
`Vedic.Today` vault, so `CONVEX_SELF_HOSTED_ADMIN_KEY` ("Country Manor Lab")
remains unavailable to agents, as on 2026-10-13. No credential was changed or
requested.

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
   not live acceptance. On 2026-10-17 these three files and
   `convex/listenNextIntegration.test.ts` passed 50 of 50 tests at `ec04c7c`.
3. Print the backfill plan. The dry run reads no credential and makes no
   network call:

   ```sh
   vpx tsx scripts/wave2-revision-backfill.ts --origin https://convex.resonantprojects.art
   ```

## Stage R. Read-only deployment inspection (before Stage 1)

Each read contacts production and needs the coordinator's approval of the
target. Neither mutates anything.

1. Inspect the deployment with the inherited admin key, delivered by the
   operator's existing credential broker (never argv, shell history or a
   file holding the value), then read the saved result offline. On the
   coordinator host, `op run` with a mode-0600 env file that holds only the
   `op://` reference from `.env.schema` is such a broker:

   ```sh
   mkdir -p out
   op run --env-file=<reference-only env file> -- \
     vpx tsx scripts/convex-deployment-inspect.ts https://convex.resonantprojects.art \
     > out/inspection-$(date -u +%Y%m%dT%H%MZ).json
   vpx tsx scripts/wave2-deployment-coverage.ts out/inspection-<stamp>.json
   ```

   The coverage report lists, per merged PR (#118, #138, #141, #140, #142,
   #153), plus the unmerged `studio-comparison` candidate when the checkout
   contains it, the functions, HTTP routes (including agent-tool routes), crons and
   active component mounts the deployment lacks, and every `api.*` function
   the current web source calls that is missing or not public. Exit 0 means
   everything is deployed, 3 means something is missing, 2 means the file is
   not an inspection. The inspection prints module paths, function names,
   cron schedules and schema hashes, not secrets. The 2026-10-17 result is in
   the [evidence record](evidence/wave2-rollout-20261017/README.md).
2. Without the admin key, one anonymous query answers the web-skew question
   alone. `docket.listWeb` checks for a signed-in human before reading any
   table, so the call reads nothing:

   ```sh
   curl -s -X POST https://convex.resonantprojects.art/api/query \
     -H 'content-type: application/json' \
     -d '{"path":"docket:listWeb","args":{},"format":"json"}'
   ```

   An error naming a missing public function means `docket:listWeb` is not
   deployed as a public function. An authentication error means it is. On
   2026-10-17 this query returned the missing-function error (see the status
   section above).

If #138 is missing while the web runs `ec04c7c`, the coordinator chooses
between Stage 1 promptly and rolling the Vercel production alias back to a
build that matches the backend. Either is a production change needing its own
approval.

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
3. `POST https://convex-http.resonantprojects.art/discord/interactions` with
   an empty body returns 404, while `GET /health` on the same origin returns
   200. HTTP actions are served on that site origin; the API origin
   `https://convex.resonantprojects.art` returns 404 for every HTTP route,
   so a check there proves nothing. A missing route also returns 404, so this
   shows only that no signer handler answers.
4. Media worker probe jobs still complete.

Rollback: keep the Wave 2 schema. Convex validates existing documents against
the schema on every deploy, and the previous schema does not declare
`revision`, the decision provenance fields, or the new tables. Once any
document holds one of these (after the Stage 2 backfill, any feed poll or
draft decision on the new code, or any intent or docket write), redeploying
the previous source as-is fails schema validation. The first response is to
leave both flags off, which disables every new outbound behavior without a
deploy. If application code must be reverted, deploy the previous functions
together with the current `convex/schema.ts`, `convex/validators.ts` and
`convex/shared/` contracts, and confirm the dry-run reports no schema
removal. Never delete the new tables or fields to make an old schema fit.

## Stage 2. Revision backfill

Run after Stage 1 and before enabling any signer. The tool uses the existing
`decisionIntentsMigrations:backfillRevisions` internal mutation. Each call is
one transaction over at most `batchSize` rows (1 to 100) and sets `revision: 0`
only where it is absent. It never changes an existing revision.

```sh
# Inherited admin key only. The tool loads no .env and never prints the key.
# The env file holds only the op:// reference, never the value.
op run --env-file=<reference-only env file> -- \
  vpx tsx scripts/wave2-revision-backfill.ts \
  --execute --origin https://convex.resonantprojects.art \
  --state out/wave2-backfill-state.json --batch-size 50
```

- Order: `feeds` to completion, a verification pass over `feeds` from the
  start, then the same for `agentReviewDrafts`.
- The state file is written (mode 0600) before and after every page. Rerun the
  same command to resume from the last committed cursor after a failure or
  `--max-pages` stop. If a verification page's result was lost, its committed
  update count is unknown, so the verification pass for that table restarts
  from the beginning.
- A resumed run keeps the batch size stored in the state file. Omit
  `--batch-size` or repeat the stored value; a different value exits 2 with
  `batch_size_mismatch` before any call.
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
absent value. The populated field is one reason Stage 1's rollback keeps the
Wave 2 schema.

## Stage 3. MCP workload (external infrastructure)

This repository already contains the MCP process (`vp run mcp` in `agent/`,
port 2025, `POST /mcp` with `x-mcp-secret`). The workload, Service, TLS ingress
and ExternalSecret belong in `homelab-infra`, which this lane does not edit.

Prerequisites: a new `MCP_SHARED_SECRET` distinct from `AGENT_TOOL_SECRET`,
stored in 1Password; a working Kubernetes context; DNS and TLS for
`mcp.frequency.rproj.art`.

Acceptance: an unauthenticated `POST /mcp` is rejected; an authenticated
`tools/list` returns exactly seven tools: the five Wave 2 tools
`docket.list`, `docket.card`, `decision.propose`, `listening.propose` and
`delivery.record`, plus `render.request` and `tournament.request`.
`render.request` is an explicit Wave 3 unavailable stub that enqueues nothing.
On `main`, `tournament.request` now calls
the gated `requestTournamentRun` agent tool. While
`HYPOTHESIS_TOURNAMENT_ENABLED` is not `true`, that call is refused and no run
is queued. Do not call `tournament.request` as part of this acceptance.
`GET /health` returns 200, and the research worker stays healthy. Rollback:
scale the MCP deployment to zero.

## Stage 4. Signer configuration

Validate the values before installing them. The readiness tool reads only its
inherited environment, makes no network call, and prints setting names,
booleans and counts:

```sh
op run --env-file=<operator env file> -- \
  vpx tsx scripts/wave2-signer-readiness.ts --require=telegram --require=discord
```

It applies the same configuration rules as `convex/decisionSignerRuntime.ts`;
a parity test compares the two. Exit 1 means a required platform is
incomplete. The parity covers configuration only: the tool counts each
nonempty `DECISION_SIGNERS` value but cannot check that it names a `users`
row. At admission the runtime looks each mapped ID up in `users` and answers
an unresolved one with `signers_only`, so a platform the tool reports ready can
still reject every signature.

| Setting | Format the runtime requires |
| --- | --- |
| `DECISION_SIGNERS` | JSON object; `discord:<id>` or `telegram:<id>` keys map to existing `users` IDs |
| `DECISION_DISCORD_BOT_TOKEN` | nonempty |
| `DECISION_DISCORD_CHANNEL_ID`, `DECISION_DISCORD_APPLICATION_ID` | Discord snowflake, no leading zero |
| `DECISION_DISCORD_PUBLIC_KEY` | 64 hex characters |
| `DECISION_TELEGRAM_BOT_TOKEN` | `<digits>:<token>` |
| `DECISION_TELEGRAM_CHAT_ID` | nonzero integer, canonical form |
| `DECISION_TELEGRAM_PATH_SECRET`, `DECISION_TELEGRAM_HEADER_SECRET` | 1 to 256 of `A-Z a-z 0-9 _ -` |

Before enabling, look up every `DECISION_SIGNERS` value in the production
`users` table with a read-only query (the Convex dashboard data view, or
`convex data users` under the inherited admin key) and confirm each ID returns
an existing row. The lookup contacts production, so it needs the same
coordinator review of target as the other live reads. Do not enable signers
while any mapped ID is missing.

Install the values on the Convex deployment environment only, never in
OpenClaw or the MCP workload. Set `DECISION_SIGNERS_ENABLED=true` last.

External prerequisites, each still open:

- A separate Discord "Frequency Signer" application with bot token and public
  key, its interactions endpoint set to `<site origin>/discord/interactions`,
  and permission to post in the chosen channel.
- A separate Telegram signer bot that Keith has opened, with its webhook set
  to `<site origin>/telegram/webhook/<path secret>` and the header secret as
  `secret_token`.
- A site origin that Discord and Telegram can reach over public HTTPS. On
  2026-10-17 the HTTP router answered at
  `https://convex-http.resonantprojects.art` through Cloudflare (the media
  worker's `CONVEX_SITE_URL`). `agent/.env.schema` names
  `https://convex.resonantprojects.art`, which is the API origin and returns
  404 for HTTP routes; the running agent worker uses an internal
  `http://convex.rproj.art:3211`. Reachability from the platforms, and whether
  Cloudflare challenges their POSTs, is unverified. The plan's alternative, `listen.rproj.art`,
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

## Listen-first next tracks

Four follow-up PRs build on this packet. All four merged to `main` on
2026-10-13:

| PR | Implementation | Merge commit |
| --- | --- | --- |
| #139 | Rollout tooling | `52b7664` |
| #140 | Litmus render jobs | `1a368d1` |
| #141 | General audio feedback and recipe/audio deferral | `6e33381` |
| #142 | Hypothesis tournament persistence and worker | `0cc0592` |

The actual landing order was #139, #140, #141, #142. #140 landed before
#141, so both must be included in the Convex deployment before requesting
renders. These records do not establish production deployment. The four
branches were assembled together locally and tested as one candidate. That
is test evidence, not production
acceptance. Every step below contacts production or a live host and needs
coordinator approval of the exact target first.

All new gates stay closed after deployment: `DECISION_SIGNERS_ENABLED`,
`DOCKET_PREPARATION_ENABLED` and `HYPOTHESIS_TOURNAMENT_ENABLED` are unset or
`false`, and `renderValidation` stays unset (`unvalidated`). Weekly Turn
narration and the `reconcile-episodes` cron stay off.

Deployment order, from the current contracts:

1. **Convex functions and schema** carrying #141, #140 and #142. The schema
   changes are additive (`audioRatings`, `decisionIntents.targetContentHash`,
   `recipes.renderPlan`, the tournament tables and
   `agentReviewDrafts.dedupeKey`). After the deploy, docket reconciliation
   changes each recipe card's hash once, and `unratedAudio` cards for render
   masters stop listing. If Convex is deployed before all three land, #141
   must be deployed before #140: without #141's delivery-only rule, the docket
   lists each render's master as well as its delivery. The deployed backend
   is `81150337`, so one deploy of `main` also carries #118, #138 and #153;
   the [work order](#what-the-convex-deploy-changes-81150337-to-main) lists
   the combined effects.
2. **Media image 0.3.0 on ai-5090-02, promptly after Convex.** Use the digest
   pinned in the [work order](#pinned-candidate), which supersedes
   `sha-0cc05921d05c53dd6a3076824b19aab68215a77a`. #140 raises
   `RENDERER_VERSION_FOR_JOBS` to `0.3.0`. Every media job enqueued after the
   Convex deploy carries that version, including narration and shootout jobs,
   not only renders. A 0.2.2 worker claims none of them, and the sweep parks
   queued mismatches after ten minutes. Add `litmusRender` to `MEDIA_JOB_KINDS`
   on the host. Then run the image smoke test
   (`node_modules/.bin/tsx src/engines/sc/smoke.ts` in the container) before
   requesting any render.
3. **Agent worker image containing the `hypothesis-tournament` graph**, before
   the tournament gate opens. An older worker would claim a queued tournament
   run and fail it as an unknown graph. The same holds for #118's
   `failure-investigation` graph, which needs no gate, so roll the worker
   promptly after Convex (pinned digest in the [work order](#pinned-candidate)). The MCP workload (Stage 3) needs the
   same agent build for `tournament.request` to reach the backend.
4. **Gates, each one a separate approval:**
   - signer and docket gates per Stages 4 and 5;
   - the hypothesis embedding backfill and then `HYPOTHESIS_TOURNAMENT_ENABLED=true`
     (paid embeddings and Anthropic inference), per
     [the tournament integration](hypothesis-tournament-integration.md);
   - `renderValidation=go`, only after the human studio comparison and go/no-go
     in the render ladder plan. A human rating of a render does not validate it.
     The [plan 11 studio validation packet](plan11-studio-validation-packet.md)
     prepares the three kits and describes the studio comparison path. That
     path ([contract](studio-comparison-contract.md)) is not in the
     `91cb3047` pin; including it needs its own attested release before
     deploy.

Integration evidence (fixtures only): `convex/listenNextIntegration.test.ts`
contains eight tests added after all four PRs landed. It
drives a real render completion into the feedback queue, the docket and
signed ratings. It checks that a master and its delivery project once, as the
delivery; that a study family stays hidden until reveal; that a signed rating
binds to the delivery's current content; and that tournament drafts share the
canonical pending-draft cap and publish only through a signed human decision.
