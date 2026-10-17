# Wave 2 candidate `6fb562b2`: approval packet items 1 and 2

Recorded 2026-10-17 between 17:00 and 17:45 UTC on the coordinator host
(`devbox`). It replaces the `91cb3047` pin in the
[rollout packet](../../../wave2-rollout-packet.md#pinned-candidate), because
`main` now carries #155 (studio comparison) and Vercel production already
serves its web code. Nothing here wrote to production. The only production
contact was read-only: one `convex function-spec` read and the system metadata
queries listed under item 2, with the admin key delivered by `op run` from a
reference-only env file.

## Pins

| Artifact | Pin | Evidence |
| --- | --- | --- |
| Convex source | `main` at `6fb562b270176c94372962ed921dbca9e21ef208` | `convex-provenance.yml` run [39054812357](https://github.com/Resonant-Projects/frequency-music/actions/runs/39054812357) (workflow dispatch), artifact `convex-root-modules-6fb562b2…` (id 12108828446): 256 root modules, SHA-256 `d8dffbfcfc89ed8695c544fbfb3aa207d59240fd9d8c309f6156e5f720359d69` (`release-manifest-6fb562b2.json`) |
| Agent image | `ghcr.io/resonant-projects/frequency-music-agent@sha256:000c82198a379ddbf0073c634dcba515ac277fed6341cf5ddbfec6c8cf0cbdeb`, tag `sha-13e0c22c8d00200c98c5769998c3f56f46d3f3d6`; Harbor copy `registry.rproj.art/frequency-music/frequency-music-agent@sha256:000c8219…` resolves by digest | `agent-image-attestation-13e0c22c.json` |
| Media image | `ghcr.io/resonant-projects/frequency-music-media@sha256:714a58dd8bf521eb8f5d7b5d39a2db74035b4a888ee2bdbdced43eb96cc9048f`, tag `sha-13e0c22c8d00200c98c5769998c3f56f46d3f3d6` (renderer 0.3.0) | `media-image-attestation-13e0c22c.json` |

`13e0c22c..6fb562b2` changes only `docs/` and
`.github/workflows/claude-code-review.yml`, so no image path changed after
`13e0c22c`. Both image digests are the OCI index digests of their tags.

## Item 1. Release binding

- `gh` 2.102.0: `gh attestation verify <manifest> --repo
  Resonant-Projects/frequency-music --signer-workflow
  Resonant-Projects/frequency-music/.github/workflows/convex-provenance.yml
  --source-digest 6fb562b2… --source-ref refs/heads/main
  --deny-self-hosted-runners` exit 0 (`release-attestation-6fb562b2.json`).
- Both images: the same command with the publish workflow as signer and
  `--source-digest 13e0c22c…`, exit 0.
- Clean detached worktree of `6fb562b2`, no `.env` or `.env.local`,
  `bun install --frozen-lockfile`, Node 24.22.0, Convex CLI 1.46.0:
  `scripts/convex-provenance-build.ts` rebuilt the manifest byte-identical to
  the attested artifact (both SHA-256 `d8dffbfc…`).
- Preserved for review beyond the root-only attestation, in a mode-0700 store
  on the coordinator host (not committed; the hashes are the record):

  | File | SHA-256 |
  | --- | --- |
  | `bundle-debug-6fb562b2.tgz` (`convex deploy --debug-bundle-path` output: `fullConfig.json`, isolate and node bundles) | `4a0ed4d781cad2816147ec4fa16f33176b6b49fbd0780beb376fdebc2cd028e5` |
  | `function-spec-6fb562b2-local.json` | `e0bf84dcdd5acfa82b8529e18c22dd0e4d5f30db95ae192b75b14bf1220b4349` |
  | `function-spec-81150337-local.json` | `ded5ef5305c211b02b5629112e4e224863d4452fcfcc4a9c142e80b25fec3cc4` |
  | `function-spec-live.json` | `686ee9901fe46b2597dab348f6aa11800ee02837eadfa58f950ed924ad4d924e` |
  | `metadata-6fb562b2-local.json` (components with args, cron specs, full schemas) | `d84f2eee73f0b620aeabaa429cd7bd6305f5a12123fc3df69884ab979bccb1e8` |
  | `metadata-81150337-local.json` | `7bbaca7c8dd1ef36ad93f65bd41ff1f8be74be1da170e26656d9e7ddf4643e5c` |
  | `metadata-live.json` | `cee087ad769d90e6460bc516377c7e9ebb3f3a7755053879369fdf9802f6283b` |

## Item 2. Protected current-to-candidate comparison

**Method.** Two disposable local backends ran the production backend image,
copied from CT113 with `docker save` (image ID
`sha256:d715e9ec088784407ca4ba2d3db592702cd328d02c76cdca3852c0018f2a76b4`,
equal to the running `app-convex-backend-1`), with `--network none`. The CLI
reached each one from a container that shared its network namespace, so
neither backend had a route out. Clean checkouts of `81150337` and
`6fb562b2` were pushed to them with `convex deploy --codegen disable`; the
only environment value set was a placeholder `CLERK_JWT_ISSUER_DOMAIN`, which
`auth.config.ts` requires at push. Each backend, and live production, was
then read with `convex function-spec` and the system queries
`_system/frontend/components:list`,
`_system/frontend/modules:listForAllComponents` and
`_system/frontend/getSchemas` (root and every component).

**Method check.** The local `81150337` equals live production: 442 of 442
function specs (arguments, returns, visibility, HTTP routes), 7 components
with their arguments, 17 cron specs with schedules, targets and arguments, and
the root schema. The `actionCache` and `workflow` component schemas differ
only by a `stagedDocumentType: null` member that a fresh backend writes into
each table record. So the comparison below is against what production runs,
not only against Git.

**Result, `81150337` to `6fb562b2`** (`item2-delta.json`):

| Dimension | Result |
| --- | --- |
| Functions | 442 to 610: 168 added, 0 removed, 45 changed. No added argument is required. Four arguments change by widening a union only (`flac`, `studioComparison`, `litmusRender` and the pitch-plan literals). The rest of the changes are optional arguments and return shapes that gain schema fields. |
| HTTP routes | 24 added (22 agent-tool routes, `/discord/interactions`, `/telegram/webhook/*`), 0 removed |
| Authentication | `convex/auth.config.ts` unchanged. This compares the authentication configuration only, not the authorization inside HTTP handlers; see the post-deploy route probe in the [window record](window.md) |
| Root schema | 29 to 40 tables (11 added), 0 tables, fields or indexes removed, no field becomes required, 14 indexes added on existing tables |
| Components | `rag`, `rag/workpool`, `rag/workpool/batchWorker` added; the existing six unchanged in definition and schema |
| Crons | 17 to 22: `normalize-legacy-extraction-history`, `reconcile-extraction-attempts`, `reconcile-operation-recovery` (300 s each), `rebuild-docket` (Thu 16:30Z) and `passage-index-sweep` (Sun 15:30Z) added; 0 removed or changed |
| Node runtime and dependencies | `"use node"` modules 10 to 12; `convex` 1.46.0 and `ai` 7.0.137 unchanged; `@ai-sdk/openai` and `@convex-dev/rag` added |
| Environment references | Added only `DECISION_*` signer variables and `DOCKET_PREPARATION_ENABLED`; each gate is off when unset. None removed. |

`16ed5881` (before the dependency bumps) gives identical function specs,
components, crons and schemas, so the zod and agent-only bumps change no
backend contract.

**Compatibility during the window.** Because no added argument is required and
unions only widen, calls from the old agent image (`81150337`) and the old
media image (renderer 0.2.2) still validate after the backend deploy and until
work-order steps 6 and 7 replace them. The renderer gate (effect 4) is the
intended exception: the 0.2.2 worker claims no new job.
