# Wave 2 restore receipt, part A: method rehearsal, 2026-10-17

Part A of the [receipt work order](../../wave2-restore-receipt-work-order.md),
run from devbox on Saturday 2026-10-17 between 16:11 and 16:31 UTC after
Keith approved the Wave 2 production rollout ("A"), which includes this
receipt. **Result: not passed.** The on-demand archive meets item 1. The
rehearsal restored it and then stopped at the helper's offline audit in
`prepare`, before first boot. The guest was destroyed. Items 2 to 7 are
unobserved. No current receipt exists, and the deploy stays blocked as the
[supported procedure](../../frequency-supported-deployment-rollback.md#recoverable-rollback-acceptance-owned-by-mac)
requires.

Writes made: one on-demand `vzdump` of CT113 (the only CT113 write), and the
disposable CT913 with its two `ceph-vm` volumes on prox4, created and purged.
Nothing else changed: no CT113 or CT107 stop, restart or configuration
change, no Convex CLI command, and no production restore. The helper
(`scripts/recovery/isolated-restore-guest.sh` at `16ed5881`) is unchanged.

## Item 1. Protected set: pass

| Field | Value |
| --- | --- |
| Volume ID | `nas-docker:backup/vzdump-lxc-113-2026_10_17-12_15_58.tar.zst` |
| Task | `UPID:prox5:0011890C:0B26E897:6AD39F3E:vzdump:113:root@pam:`, exit status `OK`, 3 min 48 s |
| Settings | `--mode snapshot --compress zstd --storage nas-docker`, the same as weekly job `backup-1e05cba2-7782`. Notes: `convex-hatchet 2026-10-17 Wave 2 restore receipt part A archive (on-demand, snapshot, zstd)` |
| Capture time | Guest suspended and frozen at 16:15:58Z. Both RBD snapshots (`rootfs`, `mp0`) were taken inside that one freeze. Guest online again at 16:16:00Z (2 s). |
| Size | 30,565,690,946 bytes compressed. The vzdump log reports "Total bytes written: 47469772800" and includes `rootfs ('/')` and `mp0 ('/srv/app-data')`. |
| SHA-256 | `b07db9d4ca78ec7e6697c17029e9277cb603019cc46fb6b04d9dd9de1919b6ba` |
| `zstd -t` | rc 0; 47,469,772,800 bytes decompressed, equal to the log's total |
| Embedded `pct.conf` | `rootfs: ceph-vm:vm-113-disk-0,size=32G` and `mp0: ceph-vm:vm-113-disk-1,mp=/srv/app-data,backup=1,size=64G`, with no other volume keys. `rootfs` carries no `backup` flag because vzdump always includes it, and the log confirms that it did. |
| After `81150337` | Yes: the provenance run was 2026-10-12T02:18Z, and the worker at that revision started 2026-10-13T01:38Z. |
| Backend image | CT113 `app-convex-backend-1` read-only, just before the capture: image `sha256:d715e9ec088784407ca4ba2d3db592702cd328d02c76cdca3852c0018f2a76b4`, RepoDigest `ghcr.io/get-convex/convex-backend@sha256:d715e9ec…`. The image inside the archive was not read; that is item 4, which the rehearsal did not reach. |

The integrity checks ran on prox4 in one pass over the `nas-docker` mount,
from 16:21:44Z to 16:26:17Z. Values are in `archive-item1.json`.

How the archive was started: `pvesh create /nodes/prox5/vzdump …` ran in the
foreground of an SSH session that the client cut after 60 s. `pvesh` mirrors
the task log to its stdout, and the PVE task code kills the worker when that
write hits a broken pipe. That would have aborted the backup on its next log
line. Before that line arrived, a `cat` reader was attached to the orphaned
pipe (`/proc/<pvesh pid>/fd/1`) on prox5. The task then finished `OK`. After
it, CT113 had no `lock`, no snapshot sections, no RBD snapshots on either
volume, and both containers were healthy. For part B, start the archive
detached, for example under `systemd-run`, rather than in a foreground
`pvesh` session.

## Rehearsal run

The [prescribed block](../../frequency-backend-recovery-preparation-20260913.md#isolated-restore-rehearsal-prepared-not-executed)
ran from the repository root on devbox (GNU coreutils), with these
adaptations and none to the helper:

- The SSH destination is `root@prox4.rproj.art`. The helper's node argument
  stays `prox4`, because the short name has no known host key on devbox.
- The archive is the one above, and evidence lands in this directory.
- After `read-identities` the block was to run one more host-side step for
  items 2 and 4 to 7 (see [Not reached](#items-2-to-7-unobserved)), then the
  identity delta against `deployed-module-identities.json` and
  `convex-module-delta.ts` against the attested `81150337` manifest
  (SHA-256 `8961e78e…`, checked by the block before it began).
- Each step prints a UTC timestamp.

The offline suites passed first on devbox: helper 108/108, smoke test, and
rehearsal block 27/27.

| UTC | Step | Outcome |
| --- | --- | --- |
| 16:26:32 | `preflight 913 … prox4` | `preflight ok … bytes=30565690946 ceph-vm_avail_kib=3674902784 mem_avail_kib=34626176` |
| 16:26:34 to 16:29:05 | `restore` in `isolated-restore-913-20261017T162632Z.service` | Preflight repeated, then `pct restore`: "Total bytes read: 47469772800 (45GiB, 342MiB/s)". `restored ctid=913 (stopped, no network)`. Unit runtime 2 min 30.644 s, memory peak 11.6 G. Run record: rootfs `ceph-vm:vm-913-disk-0`, mp0 `ceph-vm:vm-913-disk-1`, created 16:29:05Z. |
| 16:29:05 | `prepare 913` | **Refused** (below). The guest was never started. |
| 16:29:05 to 16:29:17 | `EXIT` trap: `systemctl stop "isolated-restore-913-…*" && destroy 913` | `destroyed ctid=913 volumes=[ceph-vm:vm-913-disk-0 ceph-vm:vm-913-disk-1] confirmed absent; record archived` |

The full output is in `rehearsal-run.log`, with RBD removal progress lines
collapsed.

### The refusal, verbatim

`prepare` printed 106 lines of the form
`unexpected enabled unit: <path>`, then:

```text
isolated-restore: offline rootfs has enabled units outside the allow-list
```

All 106 lines name vendor enablement links that the systemd packages ship
under `/usr/lib/systemd/system`. Each of 53 distinct links appears twice,
once under `/lib/systemd/system` and once under `/usr/lib/systemd/system`.
The two lists are identical, which is consistent with a merged-`/usr`
rootfs. None is under `/etc/systemd/system`, so no locally enabled unit was
refused. By directory, with full paths in the log:

| Directory | Links |
| --- | --- |
| `sysinit.target.wants` | 33 (for example `systemd-journald.service`, `systemd-udevd.service`, `systemd-tmpfiles-setup.service`, `systemd-tpm2-setup.service`, `dev-hugepages.mount`) |
| `sockets.target.wants` | 9 (`dbus.socket`, `systemd-journald.socket`, `systemd-creds.socket`, `systemd-pcrlock.socket`, …) |
| `multi-user.target.wants` | 5 (`dbus.service`, `getty.target`, `systemd-logind.service`, `systemd-user-sessions.service`, `systemd-ask-password-wall.path`) |
| `initrd.target.wants` | 3 |
| `getty.target.wants`, `local-fs.target.wants`, `timers.target.wants` | 1 each (`getty-static.service`, `tmp.mount`, `systemd-tmpfiles-clean.timer`) |

The 2026-09-17 rehearsal refused earlier in `prepare`, on the vendor
`graphical.target` default, so this vendor-link enumeration had not run
against a real CT113 archive before today. Getting past it needs a reviewed
helper change, which the work order requires to happen under its own review,
and then a rerun. This record proposes no change.

Separately, prox4 holds two destroyed CT913 records from September,
`913.record.destroyed-20260917T235127Z` and `…20260918T001300Z`. The
preparation record describes one September 17 run. Nothing more about the
second run is recorded here.

## Items 2 to 7: unobserved

The guest never booted, so PostgreSQL never started (2), `verify` and the
surviving enabled-unit list never ran (3), the in-guest image read did not
happen (4), and nothing ran on the module identities, component metadata,
component queries, counts, blob sample or environment names (5 to 7).

Two observations short of item 3: `restore` removed the archive's `net0` and
wrote the run record, and the guest stayed stopped until it was purged.

The step prepared for items 2 and 4 to 7 never ran. It was a host-side
wrapper plus a guest-side reader. The wrapper repeats the live isolation
gate, reads the image ID and RepoDigest, and extracts PostgreSQL recovery
lines since the container started. The reader, under the same admin-key trap
as `read-identities`, does four things:

- Ports `convex-deployment-inspect.ts`'s reads and output shape. Its
  `metadataHash` port produced the TS function's digest on a test fixture.
- Runs one read-only query per component: `workflow:list`,
  `lib:statusBatch` with no ids, `lib:status` on both `batchWorker`
  components, `btree:paginateNamespaces` and `lib:get`.
- Reads the presence of the seven names.
- Counts the six tables and checks a bounded `_storage` blob sample.

It passed a fake-backend smoke test on devbox without leaking a value.
Neither file is in this change. They need review alongside the helper
change before the rerun.

## Item 8. Restore method (written, not executed)

This is the recovery owner's proposed sequence. It is untested past
`pct restore`, because the rehearsal stopped before first boot. It needs
coordinator approval as the selected rollback mechanism. It follows the
in-place replacement precedent in `homelab-infra`
`docs/preflight/2026-08-18-rebalance-preflight.md`: a protected stop-mode
archive, then verify, then destroy-and-restore. Run it
as root on prox5. `$A` is the selected archive, which for the rollout is the
part B capture, not this one.

```bash
A=nas-docker:backup/vzdump-lxc-113-<part-B capture>.tar.zst
F=/mnt/pve/nas-docker/dump/${A#nas-docker:backup/}
# 0. Approval recorded; producers stopped: agent worker scaled to 0 through Argo CD,
#    media worker (`docker compose stop media` in /srv/frequency-media on ai-5090-02),
#    CT107 stopped. Expect only web read traffic from here on.
# 1. Re-verify the selected archive against its recorded receipt.
sha256sum "$F"            # must equal the part B SHA-256
zstd -t "$F"
# 2. Stop production cleanly and keep its post-capture state for reconciliation.
pct shutdown 113 --timeout 180 && [ "$(pct status 113)" = "status: stopped" ]
pct config 113 > /root/ct113-pre-restore-$(date -u +%Y%m%dT%H%M%SZ).conf
vzdump 113 --mode stop --compress zstd --storage nas-docker --protected 1 \
  --notes-template "convex-hatchet pre-restore state, kept for write-loss reconciliation"
# 3. Replace CT113 and both of its volumes with the archive (same VMID, MAC, IP and tags).
pct restore 113 "$A" --storage ceph-vm --force 1
pct config 113 | grep -E '^(rootfs|mp0|net0|onboot|unprivileged):'
# 4. Boot. app-compose.service brings the stack up with guest-local 1Password injection.
pct start 113
pct exec 113 -- systemctl is-system-running --wait
pct exec 113 -- docker ps --format '{{.Names}} {{.Status}}'
pct exec 113 -- docker inspect --format '{{.Image}}' app-convex-backend-1   # d715e9ec…
# 5. From devbox, read-only: the identities must match the archive's release.
#    scripts/convex-module-identities.ts, then convex-module-delta.ts against the manifest
#    (0 added, 0 removed, 0 changed); scripts/convex-deployment-inspect.ts;
#    scripts/frequency-queue-evidence.ts (claimsPaused must read true, as at capture).
# 6. OpenTofu plan for CT113 shows no change. Resume producers only after the
#    reconciliation decision.
```

Expected duration is about 15 to 20 minutes of backend downtime:

| Step | Basis | Time |
| --- | --- | --- |
| Shutdown | not measured | about 1 min |
| Archive re-verification | measured for one combined pass | about 4.5 min |
| Protected pre-restore archive | today's snapshot archive of the same set took 3 min 48 s | about 4 min |
| `pct restore` | **measured today**: 151 s (2 min 30.6 s) for this 30.6 GB, 45 GiB archive from `nas-docker` to `ceph-vm` on prox4, at 342 MiB/s | about 2.5 min |
| First boot, Compose start, backend ready, read-only checks | **not measured**, because the rehearsal stopped before first boot | about 5 min |

Skipping the pre-restore archive saves about 4 minutes, but it discards the
lost writes for good.

Write-loss window: everything written after the archive's capture time is
lost. That runs from the freeze, which for part B is its recorded capture
time, until CT113 stops in step 2:

- all three databases (`self_hosted_convex`, `convex_features`,
  `hatchet_lite`): the agent-run queue and its events, Claims and
  extractions, `mediaJobs`, `audioArtifacts`, feedback, decisions,
  scheduled and workpool state, and Hatchet state;
- `/srv/app-data/convex/storage`: audio uploads and other file blobs, and
  search indexes;
- the nightly PostgreSQL dumps under `/srv/app-data/backups`, which live on
  `mp0`.

External effects are not reversed: model calls, messages, GitHub and Vercel
activity. State outside CT113 survives and may re-deliver against the
restored backend: the agent worker's durable outbox on its PVC, and the
media worker's `/work` volume. The protected pre-restore archive holds the
lost writes for reconciliation.

## Item 9. Teardown: pass

`destroy` printed
`destroyed ctid=913 volumes=[ceph-vm:vm-913-disk-0 ceph-vm:vm-913-disk-1] confirmed absent; record archived`.
An independent check on prox4 at 16:29:57Z found:

- no CTID 911 to 913 anywhere in the cluster;
- no `/etc/pve/lxc/913.conf`;
- no `vm-911` to `vm-913` volumes in `pvesm list ceph-vm` or `rbd ls`;
- no RBD mappings and no `/var/lib/lxc/913` mounts;
- the record archived as `913.record.destroyed-20261017T162917Z`.

CT113 stayed `running` with both containers healthy and no lock or
snapshot. CT107 stayed `stopped`, as it was before the run. The extra files
staged on prox4 were removed. The helper and identity extractor at
`/root/` there are the repository versions at `16ed5881`.

## Summary

| Item | Result |
| --- | --- |
| 1. Protected set | Pass |
| 2. Consistency | Unobserved. The archive is crash-consistent: snapshot mode, both volumes snapshotted in one 2 s freeze. PostgreSQL first-start recovery was not reached. |
| 3. Isolation | Unobserved; `prepare` refused before first boot |
| 4. Runtime identity | Unobserved in the guest; production observed `d715e9ec…` read-only |
| 5. Source and components | Unobserved |
| 6. Data coherence | Unobserved |
| 7. Configuration references | Unobserved |
| 8. Restore method | Written above; `pct restore` measured at 151 s |
| 9. Teardown | Pass |

Next: a reviewed helper change for vendor enablement links, then a rerun
against this archive or a newer one. A rerun within seven days of part B, on
the same image and layout, lets part B skip a second restore.

## File digests (SHA-256)

| File | Digest |
| --- | --- |
| `archive-item1.json` | `1a5e9d33a4eda262f190dae41bc37a77cbb6a2328c6e808804edecaabc5f5067` |
| `rehearsal-run.log` | `34acf06898762fe7bfe9478d39937b88573753de7ebbaa234859df32692fb25a` |
