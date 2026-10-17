# Wave 2 isolated-restore receipt: work order for the recovery owner

Prepared 2026-10-17 from documents, scripts, Git history and the read-only
observations in the [rollout evidence](evidence/wave2-rollout-20261017/README.md).
No backup, export, restore, rehearsal or disposable guest was created to
write it. It authorizes none of them. The Mac recovery owner
(`4b75ff0f-07c3-4258-a531-258452e7e4a6`, routed through coordinator
`f9d19c38-31f3-44c7-8e26-e5319dee81cb`) owns the method and its approval. The
coordinator approves each step that writes infrastructure or touches
production data.

## Why the rollout needs it

Within minutes of activation, the `81150337` to `91cb3047` deploy retires
superseded Claims and writes `extractions.historical`
([effect 1](wave2-rollout-packet.md#what-the-convex-deploy-changes-81150337-to-main)).
No code rollback undoes that. The
[supported rollback procedure](frequency-supported-deployment-rollback.md#recoverable-rollback-acceptance-owned-by-mac)
makes "a current isolated restore receipt with an approved rollback decision"
a gate. Until one exists, with an approved rollback decision, the deploy is
not ready to execute.

## Facts on record

| Item | State | Source |
| --- | --- | --- |
| Current receipt | None. The last passing whole-container restore was CT914 on 2026-08-05. Its own record says it "does not establish current rollback". The first CT913 rehearsal, on 2026-09-17, refused before first boot on the archive's vendor `graphical.target` default, and no database or backend started. The helper was corrected the same day (`cb9de4dc`, `8e181f2d`): it now overrides only that vendor default to `multi-user.target` inside the disposable guest. No rehearsal with the corrected helper is recorded in either repository or the handoff responses. | [recovery preparation](frequency-backend-recovery-preparation-20260913.md) |
| Live root modules | `81150337`, attested and verified against the live backend on 2026-10-17, 177 of 177 | `evidence/wave2-rollout-20261017/live-provenance-81150337.json` |
| Live components | `workflow`, `workflow/workpool`, `workflow/workpool/batchWorker`, `aggregate`, `aggregate/batchWorker`, `actionCache`; all active | `deployment-inspection.json` |
| Backend image | `homelab-infra` declares `ghcr.io/get-convex/convex-backend:latest@sha256:d715e9ec088784407ca4ba2d3db592702cd328d02c76cdca3852c0018f2a76b4` (`precompiled-2026-09-28-5c7cb5b`) in `services/convex-hatchet/service.json`. The recovery tooling and every documented archive predate it and carry `sha256:1f2044e3…`. `GET /version` returns `unknown`, so the running image is declared, not observed. | `homelab-infra` `origin/main` `550c4dd5` |
| Whole-container archives | Weekly vzdump job `backup-1e05cba2-7782`, Sunday 01:00 host-local (05:00Z), snapshot mode, CT113 `rootfs` and `mp0` (`/srv/app-data`, which holds the Convex file store) to `nas-docker`. The newest archive on record is from 2026-09-13; no archive taken under the `5c7cb5b` image or after the `81150337` deploy is recorded. | `proxmox/backups.tf`; recovery preparation |
| Database dumps | Nightly 02:45Z `pg_dump` of `self_hosted_convex`, `convex_features` and `hatchet_lite`, with 14-day retention. Restore validation runs on the first Sunday of each month only, into the production PostgreSQL runtime. A dump alone does not carry the file store or module store. | `services/convex-hatchet/service.json` |
| Tooling | `scripts/recovery/isolated-restore-guest.sh` (disposable CTIDs 911 to 913 on `ceph-vm`, no network, masked units, stripped credentials), `guest-module-identities.py` (root modules only), `guest-queue-counts.py` | `scripts/recovery/` |

Known tooling gaps: the unit allow-list and masks were written for the
September guest layout and have not run against a current archive. The identity reader proves
root module equality only. Nothing checks component state, applied schemas,
crons, scheduled or workpool work, environment variable names, or file-store
blobs.

## Receipt required

One record, kept by the recovery owner, holding allowlisted values only: no
raw data, credentials, function source, environment values or job payloads.

1. **Protected set.** One CT113 whole-container archive, which captures the
   database, `/srv/app-data/convex` (file, module and search storage) and the
   configuration together at one snapshot. Record its volume ID, SHA-256,
   capture time, `zstd -t` result, and that its embedded `pct.conf` lists
   `rootfs` and `mp0` with `backup=1`. It must be captured after the
   `81150337` deploy, under the `d715e9ec` backend image. A dump layered onto
   another archive is not coherent and does not qualify.
2. **Consistency.** State how the snapshot relates to running writers. A
   snapshot-mode archive of a running PostgreSQL is crash-consistent. Say so,
   and show that PostgreSQL recovers it cleanly on first start.
3. **Isolation.** The restored guest has no network interface. Production
   routing, workers, webhooks, external actions and producer egress are
   disabled before first boot. Restored Convex crons and workpool or scheduled
   functions may run but cannot reach anything. Record the surviving
   enabled-unit list and the isolation assertions from `verify`.
4. **Runtime identity.** The backend starts under exactly `sha256:d715e9ec…`
   from the archive. Record the image digest read inside the guest.
5. **Source and components.** Root module identities equal
   `deployed-module-identities.json` (SHA-256 `9066c3a4…`); compare them with
   `scripts/convex-module-delta.ts` against the attested `81150337` manifest
   (SHA-256 `8961e78e…`), which must give 0 added, 0 removed and 0 changed. The six
   components above are listed and active, and `_system/frontend/getSchemas`
   for the root and each component returns the same schemas as the live
   inspection, with no in-progress schema.
6. **Data coherence.** Allowlisted document counts for `claims` (by `status`,
   `active` and `superseded`), `extractions`, `sources`, `agentRuns`, `mediaJobs` and
   `audioArtifacts`, read in the guest. For a bounded sample of
   `audioArtifacts` rows, the referenced `_storage` blob is readable and its
   size matches the row. Report counts and pass/fail only.
7. **Configuration references.** For each name below, read in the guest,
   record whether it is present. Record names only:
   `FREQUENCY_WORKER_CLAIMS_PAUSED`, `DECISION_SIGNERS_ENABLED`,
   `DOCKET_PREPARATION_ENABLED`, `HYPOTHESIS_TOURNAMENT_ENABLED`,
   `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AGENT_TOOL_SECRET`.
8. **Restore method.** The exact command sequence that would restore
   production from such an archive. Include its expected duration and the
   write-loss window: every write between the capture and the restore is
   lost, including the queue, media jobs, audio uploads and feedback.
9. **Teardown.** The `destroy` confirmation, naming only the run's own volumes.

## Two parts, in order

**A. Method rehearsal (any time before the deploy).** Rehearse items 1 to 7
and 9 with the corrected helper on the newest weekly archive that meets item 1.
If the helper's preflight or offline audit refuses the current guest layout,
stop. Change the helper under its own review, then rerun. The next scheduled one is Sunday 2026-10-18 at 05:00Z, unless an
earlier on-demand archive is approved. Record item 8. This proves the method
works on the current image and layout.

**B. Pre-activation capture (inside the rollout window).** After step 1 of the
[work order](wave2-rollout-packet.md#order), with claims paused, the media
worker holding no claimed job, and before the dry run, take one on-demand
CT113 archive. Record item 1 for it and verify it with `zstd -t` and the
checksum. Its capture time starts the write-loss window that a restore-based
rollback would accept. Part B needs no second restore if part A passed on the
same image and layout within the previous seven days.

## Decision criteria

- **Ready:** part A passed every item, part B is recorded, and the
  coordinator has approved restore as the selected rollback mechanism, with
  its write-loss window.
- **Not ready:** any item fails or is unobserved, the image or layout changed
  after part A, or part B is missing. The deploy stays blocked, as the
  supported procedure requires. Removing or changing that gate would be an
  amendment to `frequency-supported-deployment-rollback.md` and is outside
  this work order.

Neither outcome is approved by this document.
