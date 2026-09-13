# Frequency deployment readiness

This preparation does not deploy the backend, change its configuration, stop CT107 or activate workers. Mac owns protected recovery inventory and isolated restore preparation. DevBox owns source analysis, tooling and this acceptance record. Requests route through coordinator `f9d19c38-31f3-44c7-8e26-e5319dee81cb` to Mac owner `4b75ff0f-07c3-4258-a531-258452e7e4a6`.

## Candidate and resolved diagnosis

The candidate is source `0d07b44b90be54bceeb88019554ccc1bf76feb53`, published in [run 34707417051](https://github.com/Resonant-Projects/frequency-music/actions/runs/34707417051), artifact ID `10302416648`, name `convex-root-modules-0d07b44b90be54bceeb88019554ccc1bf76feb53`. Manifest SHA-256 is `591034fa159d8a4b099abf9796c7238bddd36b09e53a5212c6931b747c3c1130`. Strict attestation verification passed for exact source, workflow, main ref and GitHub-hosted runner. The manifest contains 129 root identities; it does not attest deployed component instances or active schema state.

The retained current-to-candidate root comparison has 106 unchanged, seven added dependency chunks, seven removed chunks and 16 changed named modules. Root schema/definition bundle matches do not establish active schema/component equivalence. The September 13 Mac observation confirms `agentRuns:opsStatusCountsPage` is absent from deployed analyzed metadata. [The attributed observation](frequency-backend-observation-20260912.md#follow-up-observation-missing-count-function-confirmed) resolves that diagnosis. No diagnostic retry is requested.

## Reproducible offline candidate inventory

From the reviewed source checkout with pinned dependencies installed, run:

```sh
vpx tsx scripts/convex-provenance-build.ts /tmp/frequency-root.json /tmp/frequency-candidate-inventory.json
```

The optional second output inventories the complete root and component bundle sets, schema/definition identities, dependency graph and external Node dependencies. It uses the same guarded offline build, never executes the generated modules and contains no source or source maps. Root output must remain byte-identical to the attested manifest above while deployable candidate source is unchanged. The component inventory is local review evidence, not a newly signed full-deployment artifact. Definition paths refer to packages, not deployed component instance paths. The mapping and full candidate semantics are reviewed in [candidate semantic review](frequency-candidate-semantic-review.md).

Do not feed an internal push request to a deployment endpoint. The supported command and its approval prerequisites are in [deployment and rollback](frequency-supported-deployment-rollback.md).

## Bounded inspection contract for Mac

After review of this preparation and confirmation of private-query compatibility on the actual backend, the Mac owner can run once with the existing child-only admin environment:

```sh
vpx tsx scripts/convex-deployment-inspect.ts https://convex.resonantprojects.art
```

This command uses only existing privileged query interfaces: `_system/frontend/components:list`, `_system/frontend/modules:listForAllComponents`, and `_system/frontend/getSchemas` for root and each discovered child component. It does not call root hashes, queue counts, get_config, exports, mutations or the missing count query. The all-components listing includes root metadata as part of the full comparison; this is not another diagnostic attempt. No new grant or credential lookup is required. The source exception in AGENTS.md permits inherited admin environment only.

Limits are 20 seconds for the complete operation, 4 MiB streamed response per query, 16 MiB aggregate, and at most 100 component records. Queries are sequential with no redirects or retries. Any failed request, malformed/incomplete inventory, duplicate identity or exceeded limit yields a fixed failure JSON and no partial success. These client limits do not bound the server-side metadata scan: the existing system queries can scan all metadata. If its scale makes that unacceptable, retain the gate and use protected recovery records instead of increasing limits automatically.

Successful output includes observations' start/end times, component identities/paths/state, analyzed function names/types/visibility, cron targets/schedules, and schema fingerprints. Private source-package values, function validators, component argument values and cron argument values are omitted. Schema fingerprints are canonical JSON SHA-256 equality aids; they do not prove structural compatibility or conceal guessable schema literals. Full schema contents remain protected. Cron schedule integer fields decode only the selected Convex int64 values into bounded safe numbers; numeric five-field cron expressions are supported. Unknown schedule types, unsupported syntax or malformed integers fail closed. The projection follows upstream `npm-packages/system-udfs/convex/schema.ts` at `8ccdd1097dbcb1da1be662d7909cc2c9117b5092`; it never decodes or returns cron argument bytes. Output explicitly identifies its omissions and separate-query snapshot consistency. Do not claim an atomic deployment snapshot, full semantic comparison, or rollback readiness from this report.

Return the complete sanitized output or the fixed failure JSON, plus the exact reviewed script commit and observation time. Retain bytes with restrictive local permissions and a SHA-256 receipt; no raw backend body or job data should be shared. Read-only metadata from different moments can miss a concurrent deployment (including a change and reversal); before final approval the owner must establish a configuration freeze or a coherent protected capture, not just compare timestamps.

## Recovery inventory reported September 13

The user supplied the following sanitized inventory from Mac owner `4b75ff0f-07c3-4258-a531-258452e7e4a6`, reviewed by the coordinator. DevBox did not inspect protected backup contents or run a restore.

- Whole CT113 archive `vzdump-lxc-113-2026_09_07-10_31_51.tar.zst`: 17,516,650,393 bytes, SHA-256 `3f4e5817e5d4a8688d1b75803687731e9d38e323c84110a74ccfc7ea1bee5f25`. Zstd integrity passed; coverage includes rootfs and the data mount. Reported PG/Convex image pins match, but the archive includes old Hatchet/RabbitMQ configuration and five-day-old database/search state. This is not current tested rollback.
- Newest native snapshot `20260912T025545Z`: checksums verified, no restore proof. It covers the database only; layering it onto the old whole archive does not by itself establish a coherent recovery set.
- Last whole-CT restore test: August 5. Dump validation passed September 7; the recent five dumps remain unvalidated. A next full archive was expected around September 13 05:00Z, but no receipt has been verified. Do not substitute an expected schedule for an observed artifact.
- File storage was observed empty and S3 unset. Recovery still needs coordinated database and local-state coverage. Backend `/version` remains unknown; image labels remain provenance claims, not verified source linkage.

Module-store mtime (including July 24) is **not** a last-deployment timestamp or proof of matching source/runtime. Do not use it to choose a rollback source revision. The Mac owner is revising a proposed isolated CT913/prox4 procedure to suppress autostart offline before first boot, contain copied credentials, sanitize bounded output on the guest, compare identity envelopes correctly, bound waits and scope cleanup. The proposal has not run; no restore or new backup is approved by this record. Its concrete method and approval remain with Mac/coordinator.

The next recovery return needed here is the revised procedure and coverage matrix, then the separately approved isolated test receipt if/when performed. Do not duplicate the inventory or request another restore from DevBox. The current tested rollback gate remains open.

## Precise remaining protected inputs

These are requirements for the existing Mac workstream, not authorization to repeat live reads. Prefer its retained recovery artifacts. Where those do not contain a field, report the gap before proposing additional collection.

| Required current-state comparison | Minimum protected evidence and sanitized return |
| --- | --- |
| Root function semantics, shared dependencies and authentication | Actual retained executable root bundles/source maps/config matched to recorded root identities; locally compare changed named modules and old/new dependency contents against the exact candidate. Return named behavior changes, access/validator changes and reviewed auth differences; no source literals or provider credentials. Root `/api/get_config` is an existing possible read interface, but its private output requires a separate bounded capture plan, not this collector. |
| Component executable code and definition graph | Retained source packages or exact prior release covering every installed instance; compare bundle identities, dependencies, exports and mounted paths. Analyzed metadata/source-package IDs alone cannot reconstruct code or establish its source. Return complete coverage and exact matched artifact identities or explicit missing components. |
| Applied schemas and indexes | Protected active and in-progress schemas for root and every child; compare table validators, validation setting, ordinary/search/vector indexes, field order, filters/dimensions and staged changes to the candidate. Return structural differences and compatibility decisions with literal values redacted, not raw validators. Matching source schema bytes does not replace applied-state comparison. |
| Function contracts and routes | Complete analyzed root/component function and HTTP route inventory plus argument/return validators from retained analysis/source packages. Return added/removed/changed names, query/mutation/action classification, visibility, and sanitized validator compatibility. This collector's list API omits validators. |
| Cron and scheduled execution | Protected static cron specs for root and all components; compare schedule, target and argument values locally. Return schedule/target changes and argument-equality booleans, never arguments or recent runs. Separately identify verified controls for already scheduled work/direct actions; claim pause is insufficient. Do not call listCronJobs, which includes run records. |
| Component arguments and environment | Compare protected component argument values and required backend environment references locally; return names/coverage and equality/change decisions only. Do not publish values or low-entropy secret hashes. |
| Backend/runtime and recovery | Mac owner supplies its existing exact image/version linkage, coherent protected backup/source-package/database/object-store coverage, and isolated restore procedure/receipt. This thread will consume that receipt, not duplicate recovery inventory or create a backup. |

The current metadata probe did not retain these full records. DevBox cannot complete the semantic before/after comparison from hashes or invent a deployed Git revision. The [candidate review](frequency-candidate-semantic-review.md) establishes the candidate side and the known missing function, and explicitly leaves the protected comparison open.

## Acceptance gates

Preparation-only merge may proceed after source checks and independent review. Backend activation requires the complete protected semantic delta, exact compatible backend version, selected attested candidate, reviewed producer/direct-execution freeze or safe bootstrap, and a current isolated restore receipt with an approved rollback protocol. Current production lacks the count query, so neither the count collector nor candidate claim-pause behavior may be assumed as bootstrap controls. A full supported deployment can activate unrelated function/auth/cron changes; do not describe it as only installing one count endpoint.
