# Offline comparison of the September 14 bounded metadata capture

Capture: `semantic-capture.json`, 98,999 bytes, SHA-256 `9141180aa53989b147c7c42496fc395cc9806488299034550c23cf64870a87f6`. Mac reports one successful capture at script revision `7b9001887ee475130702f04820ce2102b1fd83ef`, 2026-09-14T16:13:28.148Z–16:13:28.590Z, exit 0 and empty stderr. Local bytes were independently hashed and parsed offline.

Candidate tracked source is merge `075ac1df8827092dabc78e0dd7c49ec4daaf51dc`. Installed pinned component source was read as text. No source/bundle evaluation, credential access or backend calls occurred.

| Namespace | Captured analyzed modules | Captured callable metadata | Candidate callable declarations | Exact name/type/visibility matches |
| --- | ---: | ---: | ---: | ---: |
| root | 74 | 359 | 362 | 359 |
| workflow | 9 | 18 | 18 | 18 |
| workflow/workpool | 14 | 19 | 19 | 19 |
| aggregate | 6 | 25 | 25 | 25 |
| actionCache | 5 | 5 | 5 | 5 |

The root includes 291 direct callable declarations and 71 declarations via explicitly inspected factories/routes: 31 `makeAgentToolAction` public actions, 35 HTTP route registrations, and five `workflowManager.define` internal mutations. This is lexical source comparison, not candidate backend analysis. None of the captured names is unmatched after including these known factories. No matched callable changes type or visibility.

Three candidate callables are absent from the capture:

- `vocabulary.js:rekeyLegacyParameterKinds`: public Mutation.
- `agentRuns.js:createRunning`: internal Mutation.
- `agentRuns.js:opsStatusCountsPage`: internal Query.

The first is an additional existing source/runtime difference; the second is the bounded atomic direct-run fix. The third confirms the already resolved missing-function diagnosis from this existing capture; it does not request another diagnostic. Visibility describes the Convex API surface, not authentication behavior.

All 14 root cron names, schedules and target function paths match the candidate literals after converting time units and weekday names to the captured representation. Component cron metadata also matches: workpool `recover` targets `crons.js:recover` every 1,800 seconds; actionCache `expire` targets `crons.js:purge` every 86,400 seconds. Workflow and aggregate capture no crons, matching their candidate source. No cron arguments were compared. These schedules are effectful and claim pause does not suppress their execution.

The five component paths match the root configuration and workflow's nested workpool registration: root, `aggregate`, `actionCache`, `workflow`, `workflow/workpool`. All captured states are active; argument counts are zero but values are intentionally omitted. Every component omits HTTP prefix, which remains unknown rather than normalized to null. Matching paths do not prove matching component definitions or code.

Every namespace has an active schema fingerprint and no in-progress schema fingerprint at its individual query. These are canonical hashes of parsed applied-schema metadata, not schema JavaScript bundle hashes. No comparable candidate canonical schema artifact was available to this static analysis, so no schema equality or structural compatibility is claimed. Exact hashes and namespace mapping are in [the comparison record](evidence/frequency-20260914-metadata/comparison.json).

The capture is explicitly `separate-query-snapshots-not-atomic` and `deploymentAuthorized: false`. It excludes validators, cron specifications/arguments, component arguments and structural schema deltas. It supplies metadata coverage, not complete semantic equivalence or recoverability.

## Smallest remaining protected handoff

No further live query is needed for name/type/visibility, cron schedule/target, or component path comparison. Ask the Mac owner to use existing protected retained artifacts only and report a coverage matrix for:

1. Current executable root and component packages, their exact identities, and acquisition/consistency receipts. Compare changed named modules and dependency chunks against the new attested candidate, preserving added/removed/changed conclusions without sharing source values. A root-only identity receipt cannot cover component code.
2. Applied schema and index structures for each of the five paths, including argument/return validators, and the ability to reproduce each captured canonical schema fingerprint. Report index/table/validator changes and data-compatibility blockers without documents or payloads.
3. Auth configuration/provider semantics and required environment references; component definitions/dependency wiring and arguments; all 16 cron argument configurations. Compare privately and return semantic equal/changed/unavailable results and sanitized effect/compatibility summaries, not argument values or credentials.
4. Retained backend version/artifact compatibility evidence and its association to the observed image; image labels alone remain claims. Report missing provenance rather than inferring it from local Git or module mtimes.

For each row, return retained artifact coverage, observation time, digest if applicable, comparison status and precise gap. If protected current packages or schema/argument metadata were not retained, the gate remains open and a separately bounded acquisition proposal is needed; do not silently repeat capture or collect raw values.

Recovery owner separately retains the current coherent recovery/restore gate. Direct graph initialization still proceeds after audit admission failure, so denying audit writes alone does not freeze direct execution. Before production handoff there must be reviewed controls for producer ingress, direct graph entrypoints, scheduler/workflows and claim admission, with admitted work reconciliation and proven old-process cessation. No deployment or CT107 operation is authorized by this comparison.

## Review method and limits

The reviewed input is [the sanitized capture](evidence/frequency-20260914-metadata/semantic-capture.json).
Candidate inputs are the exact release checkout, its pinned component packages,
`convex/crons.ts`, `convex/convex.config.ts`, `convex/http.ts`, the direct callable
exports, and the implementations of `makeAgentToolAction`, HTTP tool registration,
and `workflowManager.define`. Local lexical analysis aids never evaluated source.
Completeness was checked against captured namespace sets and those explicit
factory categories; this is not a general parser or proof against arbitrary
future source syntax. Independent source review must resolve any new syntax
before reusing these conclusions for a different release.
