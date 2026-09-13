# Frequency supported backend deployment and rollback

This procedure prepares a separately reviewed backend change. Running a deploy,
including a deploy with `--dry-run`, is not authorized by merging this document.
Worker activation and the CT107 handoff remain separate decisions. DevBox has
not deployed, restored, or contacted the live backend for this preparation.

## Candidate and current evidence

The original release is source `07aa3d4d524b421bfd577ced008e8f8190e972c9`,
publication run `34704787115`, manifest SHA-256
`6b8bb954ceab03948b9b0cef2051bf4f739d227ff024af5fc5ae6a56fae5a9bb`.
It contains only 127 identities and omits the separately bundled root schema
and definition. It must not be used as an exact complete deployment manifest.
PR60, merged as `0d07b44`, corrects this packaging contract while preserving
strict equality. See [the observation record](frequency-backend-observation-20260912.md)
for the unchanged evidence and exact schema/definition matches.

Approval must name the actual candidate's full source SHA, successful release
run/artifact ID, manifest SHA-256, and verified attestation. A source branch,
`main`, this document's base revision, and a locally generated manifest are not
release identities. If subsequent source preparation changes deployable code,
select and attest that new exact source before approval. The old attestation
cannot authenticate modified or augmented manifests.

The retained runtime comparison identifies changed root modules, including
`agentRuns.js` and `auth.config.js`; it does not establish deployed source or
complete schema/component/authentication behavior. A complete scalar queue
snapshot and verified deployed claim-pause behavior have not been established.
Treat the counts and claim-pause capabilities as unavailable for handoff until
actual deployed metadata/implementation and acceptance prove them. HTTP 200
alone does not prove successful query execution or function absence.

## CLI contract and side effects

The supported deployment command is the installed Convex CLI, pinned to 1.34.1
by the reviewed dependency lock. Invoke its installed JavaScript entrypoint
with Node; do not use a global CLI or download a floating version. This is the
same CLI the offline provenance builder audits.

| Operation | Effects and approval boundary |
| --- | --- |
| Existing `convex-provenance-build.ts` | Audited offline bundling with denied network, inert environment and `--write-push-request`; local output only. Its internal flags are not a general deployment interface. |
| Ordinary `deploy --dry-run` | Contacts the backend; can upload/analyze bundles, submit pending schemas, and start validation/index preparation. Final activation is suppressed, but this is a separately approved mutation. |
| Ordinary `deploy` | Bundles and analyzes code, prepares schema/index changes, waits for readiness, then finishes the push and activates function/component/auth/cron changes. Errors do not guarantee that no preparation occurred. |
| `--codegen disable` | Prevents deployment-time edits to generated source; does not suppress deployment. |
| `--typecheck enable` | Enables pre-deployment root TypeScript checking; does not prove live data compatibility. Component source must pass its relevant reviewed checks separately. |
| `--cmd`, preview options, debug/verbose flags | Not part of this procedure. `--cmd` can execute extra commands, and expanded output can expose private metadata. |

Verified installed source: `node_modules/convex/src/cli/deploy.ts`,
`cli/lib/command.ts`, `cli/lib/components.ts`, `cli/lib/deploy2.ts`, and
`cli/lib/deploymentSelection.ts`. In particular, `--env-file` must itself
contain complete target/authentication selection; an empty file plus inherited
credentials does not work. Without that option the CLI reads `.env.local` and
`.env`, so the approved release checkout must contain neither file.

## Approval packet before any backend mutation

1. Bind a clean detached release checkout and frozen dependencies to the
   reviewed artifact/attestation. Record Node and installed Convex versions;
   rebuild the offline manifest and require byte equality with the signed
   artifact. Preserve the complete candidate schemas/component definitions
   and bundles for review, beyond the root-only attestation scope.
2. Complete the protected current-to-candidate comparison described in
   [deployment preparation](frequency-backend-deployment-preparation.md):
   function code/visibility/validators, HTTP routes, authentication, schemas
   and indexes, component definitions/arguments/state, Node runtime and
   dependencies, and all root/component cron schedules. Do not extrapolate
   semantic equivalence from matching root hashes alone.
3. Obtain the recoverable rollback receipt below. A successful backup receipt
   or root source download is insufficient. Record backend image identity and
   verified version linkage; do not upgrade the backend to make this procedure
   work without a separate reviewed change.
4. Approve an exact maintenance protocol that prevents new producer/direct
   execution effects and handles active work. The candidate has 16 root and
   component cron schedules, including workpool recovery. Worker claim pause
   does not freeze cron producers, actions, component workflows, or scheduled
   work. Existing deployed pause/count interfaces cannot be assumed available
   to bootstrap this deployment. The backend coordinator must supply verified
   controls and complete preconditions before proceeding; otherwise stop at
   this gate. Do not stop CT107 or activate a second consumer to compensate.
5. Name the authorized operator, target, candidate, maintenance interval,
   rollback decision criteria, and approved rollback mechanism. Separately
   authorize any schema preparation and final activation; if the desired
   operation is a single ordinary deploy, its approval must explicitly cover
   both phases and their effects.

## Exact supported command after separate approval

Run in the clean, immutable approved release checkout with dependencies
installed from its lock. First perform local assertions, which require no key:

```sh
node -e 'const fs=require("node:fs"); if(JSON.parse(fs.readFileSync("node_modules/convex/package.json")).version!=="1.34.1") throw Error("CLI version mismatch"); for(const p of [".env", ".env.local"]) if(fs.existsSync(p)) throw Error("Unexpected environment file");'
```

The Mac operator's existing credential broker must launch the following command
in a dedicated child environment containing `CONVEX_SELF_HOSTED_URL` set to
exactly `https://convex.resonantprojects.art` and the existing authorized
`CONVEX_SELF_HOSTED_ADMIN_KEY`. Do not put the key in argv, shell history, an env
file, or output. Exclude `CONVEX_DEPLOY_KEY`, `CONVEX_DEPLOYMENT`, project/preview
selection variables, `NODE_OPTIONS`, and unrelated application credentials.
Disable shell tracing. Use the existing explicit operator account context;
review any global Convex authentication configuration before launch so that no
unexpected cloud authentication or target selection occurs. No new grant or
1Password resolution is part of this document.

```sh
node node_modules/convex/bin/main.js deploy --typecheck enable --codegen disable
```

This command is the **activation command**, not a read-only acceptance command.
Do not add `--yes`, index-deletion overrides, preview flags, `--cmd`, or hidden
push/debug flags. Retain operator prompts and stop on an unreviewed target,
large-index deletion, authentication provisioning, or unexpected delta. The
tracked candidate uses Clerk; any unrelated provider provisioning prompt is
outside this approval. Keep full CLI output private and return only reviewed
scalar status/identity evidence.

If a separate schema-preparation rehearsal is explicitly approved, the same
command with `--dry-run` can be used under that approval. It is not a substitute
for a rollback test, and it is not a reusable saved plan: a later normal deploy
rebundles/reanalyzes and must remain tied to the unchanged release and backend
configuration. Never reuse captured internal `start_push`/`finish_push`
responses as a homemade apply or rollback protocol.

After an interrupted or failed attempt, stop and inspect pending schema/index
and deployment state under existing read-only authority before deciding what
was applied. Do not retry automatically. On success, verify the signed complete
root manifest, required component/schema readiness, full scalar queue evidence,
and provenance again while deployments/environment changes remain frozen.
Keep worker handoff gated by [the handoff protocol](frequency-worker-handoff.md).

## Recoverable rollback acceptance owned by Mac

The [reported September 13 recovery inventory](frequency-deployment-readiness.md#recovery-inventory-reported-september-13) identifies candidate archives and a database snapshot but no current tested coherent recovery set. Module-store mtime is not deployment provenance; a newer database snapshot layered onto an older archive is not automatically coherent. The Mac owner is revising its isolated procedure; no restore or new backup is authorized here.

The isolated restore owner must produce a receipt for the **current** protected
backend state, not merely a historical restore of a different image. It must
identify the backend image/version, protected database and object-store backup
set and capture times, component/source package coverage, configuration and
secret references, consistency procedure, and the exact isolated restore
method. Raw data, credentials, function source literals, and job payloads stay
in the protected environment. Existing native backup facilities may supply
these materials, but their current completeness must be verified.

Restore into an isolated target with production routing, workers, webhooks,
external actions, and producer egress disabled before startup. Isolation must
also contain restored cron and workpool scheduled work; a database restore can
bring their state back. Establish that the backend starts under the exact
compatible image, root/component source packages resolve, schemas/indexes and
component state are available, and restored data is coherent. Report only
allowlisted identities, timestamps, counts, and success/failure classifications.
No test may call production integrations or consume production queue jobs.

There are two distinct rollback choices, and approval must select one:

- **Redeploy a verified prior release:** use the same supported CLI command
  from the prior release's clean pinned checkout only after proving that its
  complete root/component/schema/auth/cron artifact matches the pre-change
  runtime and remains compatible with any data written since activation.
  A source redeploy does not reverse data, external effects, or cron executions.
- **Restore the protected backend state:** use the backend owner's tested
  native restore procedure for the coordinated database/object-store/config
  set and matching image. This is a separate infrastructure/data mutation,
  with an explicit write-loss window and reconciliation plan. This source
  repository does not invent that provider-specific command or authorize it.

A manifest of hashes cannot reconstruct executable source or data. Root
`/api/get_config` does not provide a complete component-aware restore package.
`convex export` starts a server-side data export; it is not a source deployment
rollback API. Do not invoke export/import, replay internal push requests, or
replace the backend under preparation/read-only authority.

Exact remaining gates are the selected attested full candidate, complete
protected deployment delta, verified backend version/compatibility, complete
queue and pause acceptance or an approved safe bootstrap protocol, and a
current isolated restore receipt with an approved rollback decision. Until
those exist, the supported command is documented but not ready to execute.
