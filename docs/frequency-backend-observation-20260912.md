# Frequency backend observation, 2026-09-12

Deployment and worker activation remain blocked. This record analyzes sanitized Mac evidence observed at `2026-09-12T16:55:07.230Z`, collected using merged source `63a323eadb93020cfd77ebe8d4bc9f28c620bd3e`. DevBox performed no backend reads. This is a new observation, not a reconstruction of the discarded 16:29 identities.

## Retained evidence

The transferred files below retain the original bytes. DevBox verified their supplied SHA-256 values and reproduced the delta byte-for-byte with `scripts/convex-module-delta.ts` against the previously attested 07aa release manifest.

| File under `docs/evidence/frequency-20260912T165507Z/` | SHA-256 |
| --- | --- |
| `frequency-deployed-module-identities.json` | `2a81c73538038f83f8a92a8bb0fc8856b7ce4a1a2f87cff5904affb552f92c8f` |
| `frequency-root-module-delta.json` | `6a110871c892541e0134afd43505492daae9de5ebc357df9853ed6a253c73027` |
| `frequency-queue-diagnostic-63a323e.json` | `337da597c1887a67a5603640b2a8a08602146cd3d030cf476efc209f661deb44` |

The delta is scoped to root module identities: deployed 129, release 127, unchanged 104, added 7, removed 9, changed 16. The strict matcher still fails. No deployed source revision is established.

The queue probe exited 1 with `complete:false`, `code:convex_error`, `stage:query`, `pageNumber:1`, `httpStatus:200`, `envelope:error`. This proves a semantic Convex error on the first page query. It establishes neither function absence nor a complete count, and does not identify the error cause. No retry or latest-100 fallback is acceptance evidence.

## Offline interpretation

All seven candidate additions and seven of the nine deployed-only entries are dependency chunks. Candidate source maps associate the new chunks with agentDrafts, llm, hypotheses, agentDraftPromotion, agentRuns, vocabulary, and Node AI/provider dependencies. Fifteen changed named modules import these new chunks; all six changed Node entrypoints import the new Node chunk. Import filename changes affect bundle identity, so this is not proof of fifteen independent semantic changes. Old chunk source is unavailable.

The other two deployed-only entries exactly match the candidate's separately bundled objects in the offline full push request:

| Candidate object | Deployed path | SHA-256(source followed by sourceMap) |
| --- | --- | --- |
| `appDefinition.schema` | `schema.js` | `452ea4dfc2735e5f893d5ff5504f4b1c212123f19235e52c39b0953c84bef452` |
| `appDefinition.definition` | `convex.config.js` | `496012d978aa2e1a54d6710cbf78b6b72d56220380ba7dff8382be44ad615f94` |

The attested manifest contains `appDefinition.changedModules` only. These two exact matches explain the apparent deletion in that comparison; they do not prove the active schema, applied component configuration, or complete deployment matches the candidate. Upstream component push code at `8ccdd1097dbcb1da1be662d7909cc2c9117b5092` packages runtime functions followed by schema and definition (`crates/model/src/components/types.rs`, `all_modules`); module metadata retrieval excludes only system paths (`crates/model/src/modules/mod.rs`, `get_application_metadata`). The builder therefore omitted two stored root modules. The correction hashes the actual separate bundle objects and preserves strict comparison; it does not hard-code observed hashes. Runtime-version compatibility remains a gate. These locally computed separate-object identities are not additions to the old signed release manifest. A newly published and independently verified attestation is required for the corrected manifest; the 07aa attestation does not transfer to new bytes.

The 16 changed named modules are agentDraftPromotion, agentDrafts, agentRuns, auth.config, conceptClassifier, conceptClassifierInternal, extract, hypotheses, hypothesesInternal, llm, llmNode, recipes, recipesInternal, vocabulary, weeklyBriefs, and weeklyBriefsInternal (all `.js`). `auth.config.js` has no imports; its mismatch cannot be attributed to dependency filenames. The candidate requires `CLERK_JWT_ISSUER_DOMAIN` and uses Clerk application ID `convex`; deployed authentication semantics remain unknown.

The corrected offline builder emits 129 identities. Comparing those unsigned local bytes with the retained observation yields 106 unchanged, seven added dependency chunks, seven removed dependency chunks, and 16 changed named modules. It still fails equality. This corrected local comparison does not change the original evidence files or establish deployed provenance.

## Runtime and rollback evidence supplied by Mac

CT113 on prox5 runs `app-convex-backend-1`. Mac reported image ID and RepoDigest `ghcr.io/get-convex/convex-backend@sha256:1f2044e3eac463ac78973b136c0baf72d4ada602611d853d6f99f280e29e0a98`, created `2026-08-10T19:31:36.741394925Z`. Backend version/source commit is unestablished. A DevBox anonymous registry manifest request for that digest returned 404; this does not invalidate Mac's local observation, but it supplies no public source linkage.

The existing `lab-postgresql-backup.service` receipt reports success, exit 0, inactive at `2026-09-12 02:57:29 UTC`. It is not a restore test. August native-backup and CT914 restore receipts in the infrastructure repository predate this image's creation. No matching current deployment artifact or current restore receipt has been established. Root hashes cannot reconstruct executable source or a component-aware rollback.

## Smallest next Mac request

First use local, existing container/image metadata only to check for the exact image's OCI version/revision/source labels or an already-retained build receipt. Return allowlisted version/revision/source values and the inspected image identity; do not return environment, full inspection output or labels wholesale. A label alone is a provenance claim, not verified source linkage. If no version linkage exists, report that gap; do not substitute a current tag or perform a backend upgrade.

Once the deployed backend's read-only contract is confirmed, make one bounded privileged root metadata query with the existing child-only credential:

```text
POST https://convex.resonantprojects.art/api/query
Authorization: Convex <existing child-environment admin key>
Content-Type: application/json

{"path":"_system/frontend/modules:list","format":"convex_encoded_json","args":[{"componentId":null}]}
```

This is an invocation specification, not permission to print a credential or raw response. The upstream contract is linked in [deployment preparation](frequency-backend-deployment-preparation.md). Use a 30-second total deadline, a 4-MiB streamed response cap, no redirects and no retries. Failure, malformed response, duplicate root module/function entries, or exceeded limits yields incomplete evidence; do not infer function absence from any of them.

Privately validate the success envelope and complete `[modulePath, metadata][]` value, select only `agentRuns.js`, then its function named `opsStatusCountsPage`. Return only observation time, HTTP status, fixed envelope classification, module-present/function-present booleans, and the selected function's allowlisted `udfType`/`visibility.kind`. Expected values are `Query` and `internal`; these are expectations, not observations. Do not share other function metadata, source-package values, cron specs/arguments, backend error text or job data. An error envelope should return only a fixed `metadata_query_error` classification. If the function is present, metadata alone still does not prove its implementation, argument contract or query-time behavior; report the result before another probe.

Do not repeat module hashes or queue counts for this request. Do not call get_config, export, deploy, backup, restore, or any mutation. There is no request to stop CT107 or activate a consumer.

## Remaining acceptance gates

The full function/schema/component/cron semantic delta still requires protected deployed metadata and source/artifact comparison, including authentication and applied schemas. The two schema/definition byte matches do not replace that comparison. A coherent capture must detect concurrent deployment changes; separate observations are not an atomic snapshot. Current rollback requires a matched retained full artifact or a separately approved protected backup and isolated restore test. Complete scalar counts and verified claim-pause behavior remain absent. All preparation and matching stay fail-closed pending these gates.
