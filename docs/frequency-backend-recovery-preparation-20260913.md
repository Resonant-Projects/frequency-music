# Frequency backend recovery preparation, 2026-09-13

Revision 4, after coordinator review of revision 3. Read-only inventory by the Mac recovery owner on 2026-09-13 (01:20 to 02:10 UTC) over the existing `prox5` SSH route and `pct exec 113`. No backup, export, deployment, queue mutation, CT107 change, restore, or disposable guest creation was performed. This record identifies the current recoverable rollback candidate, states its recovery point, and prepares an isolated restore rehearsal with fail-closed tooling. It does not replace the acceptance record and does not establish deployed source provenance. DevBox's [deployment readiness](frequency-deployment-readiness.md#recovery-inventory-reported-september-13) and [supported deployment and rollback](frequency-supported-deployment-rollback.md#recoverable-rollback-acceptance-owned-by-mac) records consume this preparation; they are not duplicated here.

## Deployed runtime identity

| Item | Observed |
| --- | --- |
| Container | `app-convex-backend-1` on CT113 (`convex-hatchet`, prox5), started 2026-09-07T14:40:08Z |
| Image ID and RepoDigest | `ghcr.io/get-convex/convex-backend@sha256:1f2044e3eac463ac78973b136c0baf72d4ada602611d853d6f99f280e29e0a98`, created 2026-08-10T19:31:36Z |
| OCI labels (3 total) | `version=24.04` (Ubuntu base, not a Convex version); `revision=c0cb7ae17f54e14846c243c5332a8a5e6d0e19d4`; `repository=https://github.com/get-convex/convex-backend`; no `source` label |
| Revision check | Upstream commit exists, committed 2026-08-10T19:08:04Z, ancestor of upstream `main`. A label is a claim, not verified linkage |
| `GET /version` | literal `unknown` |
| Database | PostgreSQL 18.6 (pgvector image), `self_hosted_convex` 447,329,983 bytes; `convex_features` 8,115,903; `hatchet_lite` 60,872,383 |
| Convex data volume `/srv/app-data/convex` | `storage/search` 3.4 GiB (newest file 2026-09-12); `storage/modules` 484 MiB, 2,008 files, newest mtime 2026-07-24T02:36:40Z; `storage/files` empty; `storage/exports` empty; `tmp` 2.8 GiB; `credentials/` holds the instance name and secret |
| Object store | none; S3 variables unset; file storage is the bind mount |

The module store mtime is an inventory timestamp only. It does not prove when function code was last pushed, and it does not prove that the archive's module set equals the current one. Only the exact hash comparison in the rehearsal below can establish equality between two observations, and even equality is artifact identity, not provenance.

## Retained recovery artifacts

### Whole-container archives (`nas-docker`, CIFS, `keep-all=1`)

Weekly job `backup-1e05cba2-7782`, Sunday 01:00 host-local (05:00Z), snapshot mode, zstd, includes `rootfs` and `mp0` (`/srv/app-data`).

| Archive | Bytes | Notes |
| --- | --- | --- |
| `vzdump-lxc-113-2026_09_07-10_31_51.tar.zst` | 17,516,650,393 | SHA-256 `3f4e5817e5d4a8688d1b75803687731e9d38e323c84110a74ccfc7ea1bee5f25`; `zstd -t` passed; decompressed 27,176,161,280 bytes equals the vzdump "Total bytes written"; embedded `pct.conf` lists rootfs and `mp0` with `backup=1`; snapshot taken 2026-09-07T14:31:51Z, pre-storage-move |
| `vzdump-lxc-113-2026_09_06-01_03_26.tar.zst` | 17,034,509,934 | SHA-256 `c23cedb2ca9291e3d7ab4941b0eb6e5b3934f9017866b3e1a2a8a5ab8052bd73` |
| six older archives, 2026-08-05 to 2026-08-30 | 6.3 to 15.7 GB | listed by `pvesm list nas-docker` |

Archive content check (single-file extraction by hash on prox5, temp copy removed): the archived `docker-compose.yml` and `.env.tpl` differ from the current files; `/usr/local/sbin/convex-hatchet-release` is absent from the archive; the archived compose still contains the `rabbitmq` service; Hatchet images are already `v0.106.3`; the `convex-backend`, `convex-dashboard` and `postgres` image pins are byte-identical to the current pins. The current files were re-rendered at 2026-09-07T15:22 to 15:23Z (homelab-infra commit `120dc3c` plus the PostgreSQL-messaging cutover). The newest archive is therefore the pre-cutover container with the identical Convex runtime image.

### Native PostgreSQL dumps (`/srv/app-data/backups/postgresql`, 14-day retention, nightly 02:45Z)

17 complete snapshots from `20260828T031127Z` to `20260912T025545Z`. Latest snapshot verified now with `sha256sum -c`:

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `self_hosted_convex.dump` | 135,939,478 | `65b58b9e966c4f799057c31cf40670bd5127864c3efdf0fad9df591c839a33d1` |
| `hatchet_lite.dump` | 2,833,667 | `d4ee80a9be7d26294c631f45b4656fb1c044cb7aa7e7af5fb1646d991000ee7d` |
| `convex_features.dump` | 2,030 | `1572d183adbdb18c133d0c0f72f9c05665b1ecfd2eaeb1f375ea5e011febc361` |
| `globals.sql` | 906 | `d7bf7dcca3ea1671443ba3970cb7206bda6d3186032c82325e5093352202189c` |

Manifest records server 18.6 and extensions (`vector` 0.8.6, `pg_trgm` 1.6 in `convex_features` only).

### Tested restore outcomes

| Date (UTC) | Test | Scope | Outcome |
| --- | --- | --- | --- |
| 2026-08-05 | CT914 network-isolated whole-LXC restore of `vzdump-lxc-113-2026_08_05-14_46_19` | full container | passed; CT destroyed, archive retained |
| 2026-09-06T03:51:55Z and 2026-09-07T14:30:47Z | `lab-postgresql-restore-validation.service` | dumps `20260906T025739Z` and `20260907T142905Z` restored into disposable databases on the production PostgreSQL runtime with `--no-owner --no-privileges` | passed |
| 2026-09-08 to 2026-09-12 | none | the validation timer fires only on the first Sunday of each month (next 2026-10-04); the five newest dump snapshots, including `20260912T025545Z`, have checksums but no restore proof | gap |

The backup service success at 2026-09-12T02:57:29Z is status only. Prior 2026-08-05 restore receipts do not establish current rollback.

## Rollback candidate and recovery point

Two different questions must stay separate:

- **Deployment rollback** asks whether a prior deployed function set can be put back. The candidate archive contains the module store and the database's module metadata from 2026-09-07T14:31:51Z. Whether that set equals today's is unknown until the rehearsal's hash comparison; the archive may or may not be a rollback for the function set at all.
- **Data recovery point** asks how much application data would be lost. Restoring the archive discards every document, index and scheduled-function change after 2026-09-07T14:31:51Z (about five days at the time of writing). The `20260912T025545Z` dump narrows the database loss to under a day, but it is database-only and is not coherent with the archive's search-index files and local Convex state, so it is a data-recovery input, not a rollback candidate.

**Current candidate:** `nas-docker:backup/vzdump-lxc-113-2026_09_07-10_31_51.tar.zst`, the only coherent full-state artifact (database, module store, search index, instance credentials and pinned images from one snapshot). It restores the pre-cutover Hatchet layout, which the rehearsal never starts.

**Scheduled archive:** the weekly job is expected to produce a new CT113 archive at about 2026-09-13T05:00Z. A scheduled backup is not a tested rollback. It becomes a candidate only after all of the following are recorded: vzdump task status `OK` in the task log; `INFO: including mount point mp0` present; archive size and `zstd -t` pass; SHA-256 recorded; decompressed byte count equal to the log's "Total bytes written". Then the same rehearsal applies with the new file name, and only a passed rehearsal makes it a tested rollback.

## Coverage matrix

What each retained artifact contains, and what the rehearsal below can and cannot prove about it.

| State | Whole archive 2026-09-07T14:31:51Z | Native dump `20260912T025545Z` | Rehearsal evidence |
| --- | --- | --- | --- |
| `self_hosted_convex` database (documents, indexes, module metadata, scheduled work) | yes, crash-consistent snapshot | yes, logical dump | sizes and counts of the restored copy; not equality with production |
| `convex_features`, `hatchet_lite` databases | yes | yes | sizes only |
| Convex module store `/srv/app-data/convex/storage/modules` | yes | no | root module identities compared to the 2026-09-12 observation |
| Search index files `storage/search` | yes, five days old | no | present after restore; not exercised |
| File storage `storage/files` | empty | no | not applicable |
| Instance credentials | yes | no | used only to generate the local admin key |
| Compose and env template | pre-cutover versions | no | not started; differ from current |
| Hatchet config and RabbitMQ data | pre-cutover | no | never started |
| Container images | yes, in the rootfs Docker store | no | Convex and PostgreSQL pins byte-identical to current |
| Component definitions, function validators, auth config, cron schedules, applied schemas | inside the database and module store | inside the dump | **not proven**: the rehearsal reads root module identities only |

## Credentials inside the archive

The archive is not secret-free. Restoring it copies these into the disposable guest: the Convex instance secret (`/srv/app-data/convex/credentials/instance_secret`, mode 0644), resolved container environments including database passwords in `/var/lib/docker/containers/*/config.v2.json`, Hatchet `server.yaml` and `database.yaml`, and the 1Password service-account token in `/etc/op/service-account.env`. The admin key generated inside the guest for the identity read derives from the same instance name and secret as production, so it is a live production credential for as long as that secret exists. Handling: the guest never keeps a network interface; the service-account token and any registry auth are deleted from the offline rootfs before the first boot; the admin key file is removed by a guest-side exit and signal trap around the single read, and `read-identities` fails if the file survives; nothing is copied off the guest except the sanitized module identity list; the guest is destroyed with `--purge` after evidence is recorded and the exact run-owned volumes are confirmed absent; the restore runs on `ceph-vm`, the same storage tier as production, so no lower-trust storage receives the copy.

## Isolated restore rehearsal (prepared, not executed)

Tooling in this repository:

| File | Runs on | Purpose |
| --- | --- | --- |
| `scripts/recovery/isolated-restore-guest.sh` | Proxmox node, root | one subcommand per step; every subcommand exits non-zero on any failed check. `restore` repeats preflight, restores a stopped guest, strips the archive's production `net0`, asserts the guest's own `ceph-vm` volumes, and writes a per-run record naming the exact rootfs and data volumes. `prepare`, `wait-boot`, `verify`, `start-db`, `start-backend`, `read-identities` and `destroy` all refuse unless the live config matches that record |
| `scripts/recovery/guest-module-identities.py` | inside the guest | bounded read of `/api/get_config_hashes` from a loopback-only origin (any other host is refused before a request is built): key from a 0600 file, hard 30 s wall-clock deadline over connect, headers and body enforced by a watchdog that terminates the process, 4 MiB cap, no redirects, proxy variables ignored; raw body parsed in memory and discarded; writes only sorted `{path, environment, hash}` to a new 0600 file and refuses to overwrite |
| `scripts/recovery/tests/test-isolated-restore-guest.sh` | Mac, offline | 54 shim-based cases, each requiring the exact exit code and, where stated, the exact failure message: wrong node, occupied CTID, bad archive, low space or memory, net0 that cannot be removed, rootfs on another storage, `mp0` of another guest or at another mount point, `unused` volume entries, privileged guest, pre-existing volumes for the CTID, live volumes drifting from the record, missing record, units outside the allow-list under `.wants` and `.requires` in `/etc` and `/usr/lib`, executable `rc.local`, symlinked systemd directories and Docker data roots that escape the rootfs, missing container config, systemd never settling, stray interface, running container, unmasked unit, readiness timeouts, evidence overwrite, record mismatch, leftover volume, and the happy paths |
| `scripts/recovery/tests/smoke-guest-module-identities.sh` with `fake-backend.py` | Mac, offline | success without configuration leakage, overflow, HTTP error, malformed identity, redirect refusal, loose key permissions, rerun refusal, and three deadline reproductions (one incomplete chunk held open, no headers ever, and a drip that never trips the per-socket timeout) each asserted to finish within 5 s under a 2 s deadline with a sanitized failure and no output file |
| `scripts/convex-identity-delta.ts` with `moduleIdentityDelta` in `scripts/lib/convex-provenance.ts` | Mac, offline | compares two sanitized identity envelopes directly; the existing `convex-module-delta.ts` expects a release manifest and is not used here |

What `prepare` does on the mounted, stopped rootfs before first boot: asserts the run record and that `rootfs` and `mp0` are `ceph-vm:vm-<ctid>-disk-N` with `mp0` at `/srv/app-data`, the guest is unprivileged, `onboot 0`, no `net*`, `mp1+`, `unused*`, `dev*`, `hookscript` or raw `lxc.` keys (the same assertions run inside `restore` before the record is written, and `preflight` refuses if any `vm-<ctid>-` volume already exists on `ceph-vm`); masks `app-compose.service`, all `lab-*` timers and services, `cron.service`, apt timers, unattended upgrades and postfix by replacing them with `/dev/null` symlinks and deleting their `.wants` links; removes `/etc/rc.local`, enumerates every remaining `.wants` and `.requires` link under `/etc/systemd/system`, `/usr/lib/systemd/system` and `/lib/systemd/system` and fails unless each is on an explicit allow-list (Docker, containerd, ssh, getty, networking for `lo`, the named systemd units observed on CT113 and the harmless local maintenance timers), printing the surviving list as evidence; rewrites every Docker `hostconfig.json` restart policy to `no` (reading `data-root` from `daemon.json` if present) and fails if no container config was found; removes the 1Password service-account env and registry auth files; writes a marker file. Docker stays enabled so the operator can start exactly two containers. `wait-boot` exits non-zero unless systemd reaches `running` or `degraded` within its bounded attempts and prints failed units; every guest probe in `wait-boot` and the isolation gate runs under a host-side `timeout`, so a hung guest cannot stall the helper. `verify` runs before any container starts and fails on any network entry in the host config, any guest interface that is neither `lo`, a bridge, nor bridge-enslaved (dockerd creates `docker0` and compose bridges at daemon start with no network reach), any masked unit not reported `masked`, any running container, or missing `curl`, `timeout` or `python3`.

Remaining internal activity once the Convex backend runs: the restored backend executes its own stored cron jobs and scheduled functions against the disposable database. Actions that call external services fail without a network and record errors in that database only. No worker or producer connects, because there is no interface. Database counts are taken before the backend starts, and the module identity read is unaffected by scheduled activity.

Assumptions still to be confirmed at execution time, all of which fail closed: `generate_admin_key.sh` prints exactly the key on its last line (its source shows `echo "$ADMIN_KEY"`); the compose file publishes `3210:3210` on all addresses, so `docker start` binds on the guest's loopback; the `postgres` superuser role exists (it answered the production inventory queries).

Target: CT 913 on prox4 (about 42 GiB free RAM, 24 cores, mounts `ceph-vm` and `nas-docker`; hosts neither CT113 nor the worker CT107). Fallback host prox6. Budget: 8 GiB RAM, 4 cores, 96 GiB thin allocation on `ceph-vm`, about 45 minutes wall time. `restore` repeats the preflight immediately before the mutation: cluster-wide absence of the CTID, no local config or run record, archive listing, at least 150 GiB available on `ceph-vm` and at least 12 GiB `MemAvailable` on the node.

```sh
set -e   # any failed step stops the sequence
H=prox4; C=913; A='nas-docker:backup/vzdump-lxc-113-2026_09_07-10_31_51.tar.zst'
R="bash /root/isolated-restore-guest.sh"
# On any failure after restore, purge the guest so no copy of production credentials or volumes outlives the run.
trap 'echo "rehearsal step failed; purging CT $C"; ssh "$H" "$R destroy $C" || echo "destroy refused or failed; CT $C may still exist, inspect before retrying"' ERR
scp scripts/recovery/isolated-restore-guest.sh scripts/recovery/guest-module-identities.py "$H":/root/
ssh "$H" "$R preflight $C $A $H"                       # read-only
# ---- first mutation begins here ----
ssh "$H" "$R restore $C $A $H"                         # stopped guest, net0 stripped, run record written
ssh "$H" "$R prepare $C"                               # offline suppression on the mounted rootfs
ssh "$H" "pct start $C && $R wait-boot $C"             # non-zero if systemd never settles
ssh "$H" "$R verify $C"                                # must pass before any docker start
ssh "$H" "$R start-db $C"                              # sizes and counts before the backend runs
ssh "$H" "$R start-backend $C"                         # prints /version
ssh "$H" "$R read-identities $C /root/guest-module-identities.py"   # key generated, used and removed inside the guest
scp "$H":/root/isolated-restore-runs/$C-*-module-identities.json docs/evidence/   # per-run file named by the record timestamp
vpx tsx scripts/convex-identity-delta.ts \
  docs/evidence/frequency-20260912T165507Z/frequency-deployed-module-identities.json \
  docs/evidence/$C-<stamp>-module-identities.json
# ---- evidence recorded, then cleanup constrained to the recorded guest and its volumes ----
ssh "$H" "$R destroy $C && rm -f /root/isolated-restore-guest.sh /root/guest-module-identities.py"
```

Every command above returns non-zero on failure and the block runs under `set -e` with an `ERR` trap that runs `destroy`, so a failed step stops the sequence and purges the guest. `restore` itself purges a guest it just created if isolation cannot be established, so no stopped copy with production network settings or credentials is left behind by a partial run. `destroy` refuses a guest without a matching run record, in which case the operator inspects before retrying. `start-db`, `start-backend` and `read-identities` each re-run the live isolation gate (host config with no `net`, `mp1+`, `unused`, device or `hookscript` keys; prepare marker; guest interfaces; masked units; only the containers expected at that step running), so skipping `verify` or attaching anything afterwards fails closed. `destroy` re-asserts the full config immediately before purge. If `wait-boot` fails, its failed-unit output is already printed and the trap runs `destroy`; do not start containers. If `prepare` is interrupted between mount and unmount, run `pct unmount $C` and rerun `prepare`.

Interpretation of the identity delta: `identical: true` establishes **root module artifact equality only** between the archive and the 2026-09-12 observation. It does not establish equality of component definitions, function validators, applied schemas, authentication configuration, cron schedules or scheduled work, and it says nothing about data currency: restoring the archive still discards every change after 2026-09-07T14:31:51Z. Any difference means the archive differs in at least the listed module paths. Neither outcome attests provenance, and neither closes the full semantic delta or recovery-point gates, which remain open as listed below.

Optional phase B (separate data copy, still isolated): pull `self_hosted_convex.dump` from CT113's `20260912T025545Z` snapshot with `pct pull` on prox5, move it to prox4 and `pct push` it into CT 913, verify its SHA-256 above, then `createdb --template=template0 lab_restore_sh_convex` and `pg_restore --exit-on-error --dbname=lab_restore_sh_convex` as the `convex` role, without `--no-owner`. This proves the newest dump restores on the identical runtime. It moves a production database copy into the isolated guest and is listed separately for that reason.

Evidence to record: archive name and SHA-256; `preflight` and `restore` output including the run record; the surviving enabled-unit list from `prepare`; `wait-boot` and `verify` output including failed units; `start-db` sizes and counts; `/version`; the identity delta output and the SHA-256 of the pulled identity file; the `destroy` confirmation naming the volumes confirmed absent. Nothing in this rehearsal touches CT113, CT107, OpenTofu or Terrakube state; CT 913 is unmanaged and never imported.

## Repository rules that apply

- **This repository (`AGENTS.md`):** targeted checks while iterating, then `vp run verify` before handoff; TypeScript runs with `vpx tsx`; `scripts/archive/` is untouched. The new scripts use no credentials from `.env`, Varlock or 1Password: the only credential is generated inside the disposable guest from the archived instance secret and removed after use.
- **DevBox acceptance record (`frequency-deployment-readiness.md`, acceptance gates):** a preparation-only merge may proceed after source checks and independent review. This PR is preparation only: no restore, backup, deployment, queue mutation or CT107 change.
- **homelab-infra (`docs/service-delivery-runbook.md` approval boundary and step 11; `docs/postgresql-lxc-contract.md` recovery section):** `proxmox/**` primitives and backup-job membership need a reviewed Git change plus Terrakube approval; live-writer restores follow the migration runbook. A network-isolated restore to an unused CTID in the 911 to 913 range is that runbook's own documented proving step, changes no live writer, cluster primitive or backup job, and is destroyed after its evidence is recorded. No further repository rule gates the rehearsal; the coordinator holds the go for the specific run.

## Independent review status

Revision 2 received an independent adversarial review (14 defects, all fixed in revision 3). Revision 3 received coordinator review: the deadline was per-socket rather than wall-clock, the equality claim was overstated, volume ownership was not asserted, cleanup keyed on reusable hostname and tag, and readiness relied on operator inspection. Revision 4 addresses each with a reproduction or test: three deadline reproductions in the smoke test (plus four further adversarial drips run by the spec reviewer, all bounded at the deadline), 54 helper cases with exact exit codes and messages, the run record with exact volumes, and the corrected interpretation above. Revision 4's diff then received a standards review and a spec review; their findings (ownership tests that passed for the wrong reason, non-exact exit-code assertions, missing `unused` and orphan-volume checks, `.requires` and vendor enablement directories, a broad systemd glob, a fixed smoke-test port, older-Python timeout classification) are all addressed in the published revision. Checks that pass now: 16 provenance unit tests including the identity delta; repository format, lint and all typechecks; `vp run verify` with 666 tests across the root, web and agent packages; `bash -n` and Python byte-compilation; both offline suites via `vp run test:recovery`. The recovery suites are not part of `verify` because the CI runners do not provision Python. Proxmox option names, the mount path and the `pvesm` column positions were confirmed against `pct help` and live output on prox5 (pve-manager 9.2.11). Claims that rest on the homelab-infra repository are cited by file and are not verifiable from this repository alone. 

## Remaining gates

1. Coordinator go for the specific rehearsal run above, or the same run against the 2026-09-13T05:00Z archive after its verification checklist is recorded.
2. A passed rehearsal with recorded evidence, which yields a tested rollback only for that archive's recovery point and only for root module artifact equality.
3. The full semantic delta (components, validators, schemas, auth, cron) stays open and DevBox-owned; the rehearsal does not close it.
4. The five newest native dumps remain unvalidated; the documented manual drill creates and drops disposable databases on the production PostgreSQL runtime and is a separately approved action.
5. No Convex-native export exists; recovery depends on PostgreSQL dumps plus the data volume or the vzdump archive.
6. Documentation drift owned by homelab-infra: the logical restore recipe in `services/convex-hatchet/README.md` still targets `prox6`; CT113 is on prox5.
