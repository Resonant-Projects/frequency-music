# Frequency worker investigation, 2026-10-24

Read-only investigation at approximately 15:29–15:33 UTC. No workload restart,
image promotion, cluster mutation, Convex deployment, paid inference or data
mutation was performed. Cluster reads used the existing Radar agent route;
historical logs used the existing Grafana Loki datasource. Credentials stayed
in process memory.

## Finding

The worker is healthy. The latest failed process-monitor job coincided with
confirmed CoreDNS upstream timeouts. A separate image CI failure is a dependency
audit failure before Docker build, with no publication or production effect.

## Live worker and image

- Deployment `frequency-worker/frequency-worker` has one desired, updated,
  ready and available replica, with the `Recreate` strategy.
- Pod `frequency-worker-6dcb68fbb8-4dtcw` runs on `talos-w3`. Both `worker`
  and `pot-provider` are ready, with zero restarts, running since
  `2026-10-20T02:43:11Z`. The init container completed with exit code zero.
- All three containers use
  `registry.rproj.art/frequency-music/frequency-music-agent@sha256:41885e83a2c1da9e5208280a36a15677e1e4b68836b5fb8b6a38806ec926dd7b`.
  Runtime `imageID` agrees with the requested digest. The source annotation is
  `e1a2fb0affe9a7d64d6552295424945859b4a3e8`.
- Argo application `frequency-worker` is Synced and Healthy, at infra revision
  `10dc37c3632f3212f7003dc8cd4c46b19ebaee3a`.
- Current GitHub `homelab-infra/main` deployment and process-monitor definitions
  agree on the image and the two expected worker containers. The local infra
  checkout was stale; it was not used as current desired-state evidence.
- Today's worker log records Correspondence Miner finishing at 05:02:10 UTC
  and Evidence Hunter finishing at 06:01:02 UTC. These log messages establish
  worker progress, not the quality or completeness of each graph's outputs.

## Latest monitor failure

The failing monitor pod was `frequency-process-check-29880907-7k295` on
`talos-w4`. Its container ran the script and emitted
`process_readiness_check_failed` at `2026-10-24T15:07:07Z`. The retained
Kubernetes event reports `BackoffLimitExceeded` at 15:07:09. This is a Job
failure after script execution, not an image-pull failure.

Loki reconstructs the surrounding sequence:

- 15:05:02: process check reported `status: "up"`.
- 15:06:02: process check reported `status: "up"`.
- 15:06:33: CoreDNS on `talos-cp1` timed out resolving A and AAAA records for
  `convex.rproj.art`, forwarding UDP to `169.254.116.108:53`.
- 15:06:34 and 15:06:54: worker logged `poll iteration failed: fetch failed`.
  CoreDNS on `talos-cp3` also recorded matching Convex resolution timeouts.
- 15:07:06: CoreDNS on `talos-cp1` timed out resolving A and AAAA records for
  `uptime.rproj.art`, against the same upstream address.
- 15:07:07: process check emitted its generic failure message. CoreDNS continued
  to log Uptime hostname resolution timeouts over the next few seconds.
- 15:08:01: the next process check reported `status: "up"`.

The monitor's Kubernetes API read errors are caught internally and produce a
`down` heartbeat. The generic outer failure message instead covers token
validation, heartbeat delivery and other outer failures. The exact Uptime DNS
timeouts, successful adjacent jobs and matching worker DNS failures identify
DNS failure during heartbeat delivery as the supported explanation for this job.
The underlying reason the DNS upstream stopped answering remains unproven.

Live CoreDNS forwards external lookups to `/etc/resolv.conf`. The tracked Talos
ResolverConfig names `172.16.10.1` as its sole nameserver. The observed failing
hop is CoreDNS to `169.254.116.108`; node resolver logs and live resolver state
are needed to distinguish a host resolver fault from its LAN upstream or path.

## Frequency and limits

A seven-day Loki count returned 10,080 process-check log records, eight generic
checker failures and three explicit `status: "down"` reports. The eight generic
failures were at approximately:

- October 18: 05:05:09, 05:10:09 and 09:15:09 UTC.
- October 22: 06:14:10 UTC.
- October 23: 01:49:10, 01:50:09 and 02:57:10 UTC.
- October 24: 15:07:07 UTC.

Only the October 24 failure was correlated with matching Uptime DNS timeout
lines in the bounded windows checked. Do not assign its cause to the preceding
seven failures. The current monitor discards exception details, so those logs
alone cannot distinguish DNS, TCP/TLS, HTTP or heartbeat-response failures.
The failed Job/pod is already absent under the configured ten-minute TTL.
Historical logs survive in Loki.

The three explicit `down` reports are a separate signal and were not established
as image failures. No current worker warning or startup blocker was observed.
Radar change-history coverage begins October 23, and its Helm-history lookup
is denied to the read-only agent, so that result is not a complete change audit.

## Separate image CI failure

[Run 40050558054](https://github.com/Resonant-Projects/frequency-music/actions/runs/40050558054)
belongs to dependency [PR #207](https://github.com/Resonant-Projects/frequency-music/pull/207),
head `ab1aca988417364156d75d03dd712e5dc129b6ef`.

`Audit production dependencies` fails at 01:36:36 UTC:

- `body-parser@2.3.0`, through MCP SDK → Express: one high-severity advisory,
  `GHSA-27r3-jxmh-p828`, fixed by 2.4.0 or later according to the audit.
- `fast-uri@3.1.8`, through MCP SDK → Ajv: two moderate and two low advisories,
  `GHSA-w74x-v6f9-j3xg`, `GHSA-xhq7-xmqj-769h`,
  `GHSA-wjr9-j795-jxcr` and `GHSA-333x-w4r6-6crp`, fixed by 3.1.9 or later
  according to the audit.

Buildx setup, Docker build, runtime smoke test and image scan were skipped.
Publication jobs were also skipped for this pull-request event. This run did
not replace the cluster image. Root, web, agent and media checks passed on the
same PR. The previous image workflow runs listed for October 22–23 succeeded.

## Project status

GitHub main is `af22fe79c1dd5b17cebf8f9b5abf717291f46f40`. Recent audit fixes,
the full Agent Runs graph filter, Docket navigation checks, feedback fixture
repair, disposable local Convex persistence journeys and process-cleanup fixes
are merged. The dated feature-gap evidence still describes several of these
branches as unmerged; GitHub merge records supersede those historical labels.

The production worker remains at the October 18 release. This investigation
did not freshly attest the live Convex root-module artifact. The October 22
rollout follow-up records the backend matching `e1a2fb0a` at that time.

The main remaining program gates in `docs/plans/README.md` are:

- Recipe loop closure, plan 13: requires a decision on whether the completed
  extraction/hypothesis baseline suffices while weekly-brief baseline remains
  blocked by missing thesis rows.
- Passage retrieval: the October 22 audit found all 7,820 text-bearing Sources
  indexed, but mixed-source/relevance acceptance failed. Indexing remained
  enabled during investigation; no fresh gate read was made here. The missing
  historical log intervals require a waiver or leave that criterion open.
  Generator/UI retrieval consumers remain follow-on work.
- Listening and automation: human studio comparison and render go/no-go,
  signer/MCP deployment and signing acceptance, and signed-in web acceptance
  remain distinct from deployed implementation. No gate was changed here.
- Decisions about starter-kit web delivery, specialist activation and later
  rendering/ABX scope remain in issues #189 and #191–#199.

Open PRs at inspection were #207 (LangChain Core), #205 (local development
sign-in) and #184 (convex-test). No PR was modified.

## Recommended next work

Investigate Talos host DNS and the `172.16.10.1` resolver path around the incident
timestamps. Rebuilding or rolling back the worker image does not address the
observed DNS failure. A bounded monitor improvement would retain the failing
stage and safe error code while withholding the token-bearing heartbeat URL.
That would let the earlier generic failures be classified on recurrence.

Separately update the vulnerable transitive dependencies and verify the audit
and image workflow before promoting a new worker release. Then close the
passage acceptance and recipe-loop sequencing decisions and complete the human
studio/decision-signing acceptance work.

## Repository verification

`APP_ENV=test vp run verify` was attempted in this checkout. It stopped before
checks could execute because project dependencies are absent:

```text
No project-local vite-plus installation was found.
Failed to find executable biome under cwd .../t3-d5b8793c/
```

This checkout setup blocker predates this investigation. No application code,
tests or dependency manifests were changed. The evidence document passes
`git diff --check`; live observations and CI results above are the relevant
diagnostic verification.

## Follow-up: hostname, dependency repair and acceptance details

The initial investigation above is historical. The following source edits and
checks were subsequently authorized on October 24.

### Hostname verification

The canonical backend API is `https://convex.resonantprojects.art`. The live
worker's `CONVEX_SITE_URL` still uses the legacy internal HTTP-actions address
`http://convex.rproj.art:3211`. A direct local DNS lookup resolved that name to
`172.16.10.24`, and `GET /health` returned 200 with `{"ok":true}`.
`https://convex-http.resonantprojects.art/health` also returned the same 200
response. The backend API hostname's `/health` returned 404. These are distinct
API and HTTP-action routes; replacing the worker URL requires preserving its
`/agent-tools/*` route, not simply substituting the API hostname.
No infrastructure URL was changed.

### Dependency repair

The agent lockfile now selects `body-parser@2.4.0` and `fast-uri@3.1.9`
within existing transitive ranges. It also selects `qs@6.16.1` for the new
body-parser dependency requirement. No new direct dependency or override was
needed in the agent manifest.

The initial rebuilt image passed runtime smoke checks, but its full Trivy scan
found two further HIGH findings in the separately installed PO-token sidecar:
`body-parser@2.3.0` and `undici@7.30.0`. The existing checked-in
`agent/bgutil-security.patch` now also pins that dependency tree to
`body-parser@2.4.0` and `undici@7.30.1`, with its required `qs@6.16.1`.
The existing follow-redirects, proxy-addr and source-map-js fixes are preserved.
The original sidecar source tarball still matches the Dockerfile checksum.

The production `bun audit --prod --ignore=GHSA-vfj7-8cjw-p6xm` check now
reports no vulnerabilities across 179 packages. After installing this
checkout's dependencies and generating the ignored Panda output, full
`APP_ENV=test vp run verify` passed: four typechecks and 2,425 tests
(1,620 root, 234 harness, 430 agent, 141 media). Six real SuperCollider tests
remain skipped on this host. Existing lint and Panda warnings remain.

The final Docker build succeeded as local tag `frequency-agent:audit-fix-local`,
manifest-list digest
`sha256:b46f7693a9588b9921adcfb802b474e995051fcb42f7bd8528d1f251093f4790`.
Runtime smoke checks confirmed the four repaired package versions in their
respective installs. Under a read-only root filesystem with only a temporary
`/tmp` and no external network, the sidecar started and `/ping` returned 200.
The final Trivy HIGH/CRITICAL scan exited zero and reported no findings at
those severities. Trivy also warned that its database had no details for
`CVE-2026-107891`; that database warning remains a limitation of the scan.
No image was published or deployed.

### Thesis creation and the exact sequencing choice

The UI creates theses through Research → Theses → New Thesis, with required
title and statement and optional description. `theses.create` requires
authentication and defaults a new row to active and private. It is manually
authored; no automatic thesis generator was found. A hypothesis's Meaning
Metadata form links it to a thesis. The weekly-brief generator loads active
theses and stores the thesis IDs it used on the resulting brief.

The October 17 production screening found no thesis rows. The weekly-brief
golden dataset has two approved rows, below the runner's five-row minimum;
the curation target is six. Eligible new candidates must reference an active
thesis, have at least three recommended actions, and discuss a contradiction,
weak path or low-yield area. Creating one thesis can serve multiple briefs;
five separate theses are not required. Creating a thesis does not retroactively
attach it to old briefs or automatically produce enough golden examples.

Plan 13's original gate requires plan 008 before recipe-loop changes. The
specific policy choice is whether to accept the completed extraction/hypothesis
stage 1 as sufficient to begin recipe-loop work while keeping the weekly-brief
baseline a separate open task, or retain the full gate until qualifying brief
examples are curated and stage 2 is separately approved and run. Neither choice
is necessary to create a thesis. Neither authorizes paid work, automatic recipe
approval or publication. There is still no recipe-specific eval runner/baseline,
so completed stage 1 is not direct proof of recipe-generation quality.

### Why passage acceptance failed

The query was `432 Hz precise temperament tuning`, with a limit of eight.
The unfiltered result contained three passages: two overlapping windows from
the same Precise Temperament Tuning article and one tuning PDF. No transcript
appeared. The YouTube-only result was a 968-character transcript about tuning
in general, with no mention of 432 Hz or precise temperament. The URL-only
result did retrieve relevant 432/432.081 Hz article passages.

Source filters and the 12,000-character response bound worked. Semantic ranking
does not require literal phrase matches or reserve space for source diversity.
There is also a concrete result-selection limitation in `boundPassages`: once
a passage does not fit, it breaks instead of considering later shorter hits.
The YouTube receipt returned 968 characters and omitted four candidates; under
the current implementation that means the second candidate window exceeded the
remaining 11,032-character allowance. Lower-ranked short hits were not tried.
The unfiltered result spent 10,551 characters and omitted five candidates;
their identities and whether they included a transcript were not retained in
the compact receipts, so that cannot be claimed as its complete root cause.

A local, provider-free replay confirmed the selection behavior: hits of 968,
11,033 and 1,000 characters return only the first hit and omit both later hits.
This explains underfilled responses; it does not establish that an alternative
packing policy would recover the expected phrase-specific transcripts. No
retrieval implementation, indexing flag or paid probe was changed here.
