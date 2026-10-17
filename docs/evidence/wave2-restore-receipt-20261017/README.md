# Wave 2 restore receipt, part A: method rehearsal, 2026-10-17

Part A of the [receipt work order](../../wave2-restore-receipt-work-order.md),
run from devbox on Saturday 2026-10-17 between 16:11 and 18:12 UTC. Keith
approved the Wave 2 production rollout ("A"), which includes this receipt,
and the coordinator authorized the helper change and the reruns.

**Result: part A passed on the third run** (18:07:44 to 18:11:46Z), using the
reviewed helper and readers at `632ec2ca` against the same archive. Items 1
to 7 and 9 pass, and item 8 is written with measured durations. Two earlier
runs refused before any check could pass. Each refusal was fixed under review
and is kept below as history.

This passes part A only. Part B, the pre-activation capture, and the
coordinator's approval of restore as the rollback mechanism are still
required (see [Decision criteria](../../wave2-restore-receipt-work-order.md#decision-criteria)).

Writes made:

- one on-demand `vzdump` of CT113, the only CT113 write;
- three disposable CT913 guests on prox4, with their `ceph-vm` volumes, each
  created and purged.

Nothing else changed:

- no CT113 or CT107 stop, restart or configuration change;
- no Convex CLI command;
- no production restore.

## Item 1. Protected set: pass

| Field | Value |
| --- | --- |
| Volume ID | `nas-docker:backup/vzdump-lxc-113-2026_10_17-12_15_58.tar.zst` |
| Task | `UPID:prox5:0011890C:0B26E897:6AD39F3E:vzdump:113:root@pam:`, exit status `OK`, 3 min 48 s |
| Settings | `--mode snapshot --compress zstd --storage nas-docker`, the same as weekly job `backup-1e05cba2-7782`. Notes: `convex-hatchet 2026-10-17 Wave 2 restore receipt part A archive (on-demand, snapshot, zstd)` |
| Capture time | Guest suspended and frozen at 16:15:58Z. Both RBD snapshots (`rootfs`, `mp0`) were taken inside that one freeze. Guest online again at 16:16:00Z (2 s). |
| Size | 30,565,690,946 bytes compressed. The vzdump log reports "Total bytes written: 47469772800" and includes `rootfs ('/')` and `mp0 ('/srv/app-data')`. |
| SHA-256 | `b07db9d4ca78ec7e6697c17029e9277cb603019cc46fb6b04d9dd9de1919b6ba` |
| `zstd -t` | rc 0; 47,469,772,800 bytes decompressed, equal to the log's total. All three restores read exactly that many bytes. |
| Embedded `pct.conf` | `rootfs: ceph-vm:vm-113-disk-0,size=32G` and `mp0: ceph-vm:vm-113-disk-1,mp=/srv/app-data,backup=1,size=64G`, with no other volume keys. `rootfs` carries no `backup` flag because vzdump always includes it, and the log confirms that it did. |
| After `81150337` | Yes: the provenance run was 2026-10-12T02:18Z, and the worker at that revision started 2026-10-13T01:38Z. |
| Backend image | `d715e9ec…` in production just before the capture (read-only `docker inspect` on CT113) and inside the restored guest (item 4) |

The integrity checks ran on prox4 in one pass over the `nas-docker` mount,
from 16:21:44Z to 16:26:17Z. Values are in `archive-item1.json`.

How the archive was started: `pvesh create /nodes/prox5/vzdump …` ran in the
foreground of an SSH session that the client cut after 60 s. `pvesh` mirrors
the task log to its stdout, and the PVE task code kills the worker when that
write hits a broken pipe. Before the next log line, a `cat` reader was
attached to the orphaned pipe (`/proc/<pvesh pid>/fd/1`) on prox5. The task
then finished `OK`, leaving no lock, snapshot section or RBD snapshot on
CT113. For part B, start the archive detached, for example under
`systemd-run`, as the reruns did for every host step.

## Runs

| Run | Helper | Outcome |
| --- | --- | --- |
| 1, 16:26:32 to 16:29:17Z | `16ed5881` (unchanged) | Restore 151 s. `prepare` refused 106 links: 53 vendor `.wants` links, each under `/lib` and `/usr/lib/systemd/system`, none under `/etc`. Never booted. `rehearsal-run.log` |
| 2, 18:00:31 to 18:02:42Z | `a8573cb2` (reviewed) | Restore 105 s, `prepare` passed, first boot `running` in 7 s. `verify` then refused with `unexpected interfaces in guest: bonding_masters`. That entry is the bonding driver's control file, a regular file in `/sys/class/net`; every interface there is a symlink. No container ever started. `rehearsal-run-2.log` |
| 3, 18:07:44 to 18:11:46Z | `632ec2ca` (reviewed) | **Passed every step**, below. `rehearsal-run-3.log` |

Each run ended with `destroy` and was purged with its own two volumes
confirmed absent: runs 1 and 2 through the `EXIT` trap, run 3 through the
final step. `rehearsal-block-20261017.sh` is the exact block of runs 2 and 3.
It is the [prescribed block](../../frequency-backend-recovery-preparation-20260913.md#isolated-restore-rehearsal-prepared-not-executed)
with these adaptations:

- The SSH destination is `root@prox4.rproj.art`, with node argument `prox4`.
- Every host step runs in its own `systemd-run --wait --pipe` unit under a
  runtime limit. Both cleanup paths stop `isolated-restore-913-<run>-*`
  before `destroy`.
- `host-receipt-reads.sh` runs after `read-identities`.
- The deltas run against the 2026-10-17 references.
- Each step prints a UTC timestamp.

### Helper change and review

The two refusals led to the change in this PR, which the coordinator
authorized. It does three things:

- **Vendor links.** The offline audit accepts a vendor link only as one of
  the exact 56 `<target>.wants/<unit>` pairs that Debian 13 ships in this
  archive, and only when it points at the same-named regular unit file.
  `/etc` and `/usr/local` keep the old check. A vendor link to Docker,
  containerd, SSH, networking or any other unit refuses.
- **Closure.** The boot dependency closure approves 11 exact core names that
  those vendor units declare.
- **Interfaces.** The interface gate skips only a regular file named exactly
  `bonding_masters`.

The masks are unchanged. Before any rerun, the changed `prepare` passed
against the systemd trees extracted from this archive, with `pct` shimmed: a
closure of 111 units. The tree was then deleted.

Independent review used `codex-first` autoreview: Codex `gpt-6.1-sol`, high
reasoning, a fresh isolated session per round, and P3 scope. It reviewed the
helper and readers commit with the unchanged contracts supplied as source
context. Five rounds:

| Round | Candidate | Result |
| --- | --- | --- |
| 1 | `480807b1` | 3 × P2. Fixed: PostgreSQL log lines were forwarded whole; fractional numbers were rejected by the `metadataHash` port. **Rejected:** "compare blobs with the `audioArtifacts` row size". At `81150337` the row has no byte size or byte digest. `contentHash` is `fnv1a64Hex(stableStringify(params))`, a parameter hash, so `_storage.size` and `sha256` are the only records. |
| 2 | `cdf71bd7` | 1 × P3, fixed: key order by UTF-16 code unit |
| 3 | `e5f27cd3` | 3 × P2, fixed: the storage route needs the UUID, so URLs now come from the deployed `audioArtifacts:playbackInternal`; failed checks did not change the exit status; the RepoDigests read was unchecked |
| 4 | `a8573cb2` | scoped-clean |
| 5 | `632ec2ca` (adds the `bonding_masters` fix after run 2) | scoped-clean |

Validation:

- `vp run test:recovery` passes:
  - helper 128/128;
  - smoke test;
  - rehearsal block 27/27;
  - `host-receipt-reads` 33/33;
  - `guest-receipt-reads` 18 unittest cases.
- Five mutants of the vendor-link gate were each killed by their intended
  case.

## Item 2. Consistency: pass

The archive is crash-consistent: snapshot mode, with both volumes
snapshotted inside one 2 s guest freeze while PostgreSQL ran. On its first
start in the guest (container started 18:10:27.934Z), PostgreSQL logged
these events, read by `guest-receipt-reads.py --postgres-recovery` inside
the guest as fixed tokens:

| Time (UTC) | Event | Value |
| --- | --- | --- |
| 18:10:28.452 | `interrupted` | last known up 2026-10-17 16:11:37 UTC |
| 18:10:28.483 | `automatic_recovery_in_progress` | |
| 18:10:28.499 | `redo_starts_at` | `9/31C563D8` |
| 18:10:28.508 | `wal_end_invalid_record_length_at` | `9/31E02530` (normal end of WAL) |
| 18:10:28.508 | `redo_done_at` | `9/31E02508` |
| 18:10:28.545 | `end_of_recovery_checkpoint_started` | |
| 18:10:28.679 | `ready_to_accept_connections` | |

Crash recovery replayed about 2.6 MB of WAL and was accepting connections
0.75 s after the container started. Severity counts since start: 0 PANIC,
0 ERROR, 0 WARNING and 2 FATAL, out of 18 lines. The parser emits no message
text, so the two FATAL lines are unclassified. They fall inside the startup
window and are consistent with connection attempts before "ready", but that
is not verified. After recovery, `start-db` read all databases and the
document counts:

- `self_hosted_convex`: 1,176,642,063 bytes
- `hatchet_lite`: 61,104,655 bytes
- `convex_features`: 7,954,959 bytes
- documents 145,818; indexes 733,887; leases 1; persistence_globals 10

## Item 3. Isolation: pass

Host side:

- `restore` removed the archive's `net0` before the run record was written.
- `prepare` (run 3) masked compose, cron, apt, postfix and every `lab-*`
  unit, removed the 1Password service-account env, and set 9 container
  restart policies to `no`.
- `prepare` printed the surviving enabled-unit list (in
  `rehearsal-run-3.log`): the `/etc` links on the allow-list and the 56
  vendor core links.
- `start` re-asserted the stopped configuration. systemd reached `running`
  in 7 s.

`verify` (before any container ran) reported:

```text
verify ok ctid=913 systemd=running running_containers=0
failed units (evidence):
```

There were no failed units. Every masked unit reported `masked`, and `curl`,
`timeout` and `python3` were present.

Inside the guest, `host-receipt-reads.sh` repeated the isolation gate after
both containers ran:

- no `net*`, `mp1+`, `unused`, `dev`, `hookscript` or raw `lxc` key;
- the record matched, and the prepare marker was present;
- exactly `app-postgres-1` and `app-convex-backend-1` running;
- interfaces: `lo` (loopback), `docker0` and one Compose bridge, two `veth`
  bridge ports, and the `bonding_masters` control file;
- default routes: 0.

Running services: `console-getty`, `container-getty@1`, `container-getty@2`,
`containerd`, `dbus`, `docker`, `ssh`, `systemd-journald`, `systemd-logind`
and `systemd-networkd`. SSH and networkd run but have no interface to reach.
Restored Convex crons and workpool or scheduled functions could run during
the roughly 55 s the backend was up (18:10:42 to 18:11:37Z), but nothing
outside the guest was reachable.

## Item 4. Runtime identity: pass

Read inside the guest:

- `app-convex-backend-1` image ID
  `sha256:d715e9ec088784407ca4ba2d3db592702cd328d02c76cdca3852c0018f2a76b4`;
- RepoDigests
  `["ghcr.io/get-convex/convex-backend@sha256:d715e9ec088784407ca4ba2d3db592702cd328d02c76cdca3852c0018f2a76b4"]`;
- `app-postgres-1` image ID `sha256:78bf48b8…`.

Both equal the production containers' images. `GET /version` returned
`unknown`, as production does.

## Item 5. Source and components: pass

- **Root modules.** `read-identities` returned 177 identities.
  - `convex-identity-delta.ts` against `deployed-module-identities.json`
    (`9066c3a4…`): `identical: true`, 177 unchanged.
  - `convex-module-delta.ts` against the attested `81150337` manifest
    (`8961e78e…`): **0 added, 0 removed, 0 changed**, 177 unchanged.
  - Outputs: `identity-delta-vs-deployed.json` and
    `module-delta-vs-81150337.json`.
- **Components, schemas, inventory.** `guest-receipt-reads.py` read
  `_system/frontend/components:list`,
  `modules:listForAllComponents` and `getSchemas`, and reproduced
  `convex-deployment-inspect.ts`'s output shape. `compare-inspection.py`
  compared it with the live `deployment-inspection.json`
  (`inspection-comparison.json`):
  - components, modules and schemas are each **equal**;
  - the 6 components plus root are all `active`;
  - module counts: root 103, workflow 10, workpool 14, aggregate 8,
    actionCache 5, and 9 for each `batchWorker`;
  - 538 functions and 17 crons, equal to live;
  - 0 in-progress schemas.
- **Component execution.** One read-only query per component succeeded:

  | Component | Function | Result |
  | --- | --- | --- |
  | `workflow` | `workflow:list` | success, object |
  | `workflow/workpool` | `lib:statusBatch` (`ids: []`) | success, list |
  | `workflow/workpool/batchWorker` | `lib:status` | success, null |
  | `aggregate` | `btree:paginateNamespaces` | success, object |
  | `aggregate/batchWorker` | `lib:status` | success, null |
  | `actionCache` | `lib:get` | success, object |

## Item 6. Data coherence: pass

Counts read in the guest:

| Table | Documents | By status |
| --- | --- | --- |
| `claims` | 15,864 | 9,741 active, 6,123 superseded |
| `extractions` | 8,003 | |
| `sources` | 7,841 | |
| `agentRuns` | 250 | 0 queued, 0 running, 3 needs_review, 246 completed, 1 failed, 0 cancelled |
| `mediaJobs` | 66 | |
| `audioArtifacts` | 140 | 140 ready, 0 pending, 0 failed |
| `_storage` | 140 | |

For the blob sample, 8 of the 140 ready `audioArtifacts` rows were spread
evenly across the table. Each resolved its URL through the deployed
read-only `audioArtifacts:playbackInternal`. Only the `/api/storage/<uuid>`
path was kept, and it was fetched from loopback without the key. **8 of 8
passed**: each blob was readable, and its byte length and SHA-256 matched
the referenced `_storage` row. The row records no byte size of its own; see
the round 1 disposition above.

## Item 7. Configuration references: pass (recorded)

Presence only, read with `queryEnvironmentVariables:get`. No values were
read out.

| Name | Present |
| --- | --- |
| `FREQUENCY_WORKER_CLAIMS_PAUSED` | yes |
| `DECISION_SIGNERS_ENABLED` | no |
| `DOCKET_PREPARATION_ENABLED` | no |
| `HYPOTHESIS_TOURNAMENT_ENABLED` | no |
| `ANTHROPIC_API_KEY` | yes |
| `OPENAI_API_KEY` | yes |
| `AGENT_TOOL_SECRET` | yes |

The receipt reader's own checks all passed: `allChecksPassed: true`.

The admin key existed only in the guest, in a 0600 file under the exit trap,
and the helper confirmed it absent after each read. The logs contain only
`generate_admin_key.sh`'s `Admin key:` stderr label. A scan of the logs and
evidence files found no key-shaped value.

## Item 8. Restore method (written, not executed)

This is the recovery owner's proposed sequence. It follows the in-place
replacement precedent in `homelab-infra`
`docs/preflight/2026-08-18-rebalance-preflight.md`: a protected stop-mode
archive, then verify, then destroy-and-restore. It needs coordinator approval
as the selected rollback mechanism. Run it as root on prox5, with long steps
detached. `$A` is the part B capture, not this archive.

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
systemd-run --wait --pipe --unit=ct113-pre-restore-archive vzdump 113 --mode stop --compress zstd \
  --storage nas-docker --protected 1 \
  --notes-template "convex-hatchet pre-restore state, kept for write-loss reconciliation"
# 3. Replace CT113 and both of its volumes with the archive (same VMID, MAC, IP and tags).
systemd-run --wait --pipe --unit=ct113-restore pct restore 113 "$A" --storage ceph-vm --force 1
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

Measured durations, from the three runs on prox4, archive on `nas-docker`:

| Step | Measured |
| --- | --- |
| `pct restore`, 45 GiB from the 30.6 GB archive to `ceph-vm` | **151 s, 105 s and 130 s** (342, 509 and 373 MiB/s) |
| First boot, `pct start` to systemd `running` | **7 s** in runs 2 and 3 |
| PostgreSQL crash recovery, container start to ready | **0.75 s** |
| Backend, container start to `/version` answering | about **3 s** (started 18:10:42.4Z, ready by 18:10:45Z) |
| Boot to backend ready, `pct start` to ready | **44 s**. About 30 s of that is the rehearsal's own isolation gates (`verify` and the gates in `start-db` and `start-backend`), which production does not run. |
| Restore start to backend ready | **179 s** (run 3) |

Expected production downtime is about 15 minutes:

| Step | Basis | Time |
| --- | --- | --- |
| Shutdown | not measured | about 1 min |
| Archive re-verification | one combined pass | about 4.5 min |
| Protected pre-restore archive | today's snapshot archive took 3 min 48 s | about 4 min |
| `pct restore` | measured | about 2.5 min |
| Boot and Compose start | measured boot and backend parts | about 1 min |
| Read-only checks | not measured | about 3 min |

Skipping the pre-restore archive saves about 4 minutes, but it discards the
lost writes for good.

Write-loss window: everything written after the archive's capture time is
lost. That runs from the freeze, which for part B is its recorded capture
time, until CT113 stops in step 2:

- all three databases: the agent-run queue and its events, Claims,
  extractions, `mediaJobs`, `audioArtifacts`, feedback, decisions, scheduled
  and workpool state, and Hatchet state;
- `/srv/app-data/convex/storage`: audio uploads and other file blobs, and
  search indexes;
- the nightly dumps under `/srv/app-data/backups`, which live on `mp0`.

External effects are not reversed: model calls, messages, GitHub and Vercel
activity. State outside CT113 survives and may re-deliver against the
restored backend: the agent worker's durable outbox on its PVC, and the
media worker's `/work` volume. The protected pre-restore archive holds the
lost writes for reconciliation.

## Item 9. Teardown: pass

Run 3 printed
`destroyed ctid=913 volumes=[ceph-vm:vm-913-disk-0 ceph-vm:vm-913-disk-1] confirmed absent; record archived`.
An independent check on prox4 at 18:12:34Z found:

- no CTID 911 to 913 in the cluster;
- no `913.conf`;
- 0 `vm-911` to `vm-913` RBD images, 0 mappings and 0 `/var/lib/lxc/913`
  mounts;
- 0 leftover run units;
- the staged scripts removed;
- records archived for all three runs: `913.record.destroyed-20261017T162917Z`,
  `…T180242Z` and `…T181146Z`.

The sanitized identity and receipt files stay in
`/root/isolated-restore-runs/` on prox4 by the helper's convention. Runs 1
and 2 were checked the same way. CT113 stayed `running` with both containers
healthy and no lock or snapshot. CT107 stayed `stopped`, as it was before.

## Summary

| Item | Result |
| --- | --- |
| 1. Protected set | Pass |
| 2. Consistency | Pass: crash-consistent; clean crash recovery in 0.75 s. Two FATAL lines are unclassified. |
| 3. Isolation | Pass |
| 4. Runtime identity | Pass: `d715e9ec…` in the guest |
| 5. Source and components | Pass: 177/177, 0/0/0; components, modules and schemas equal live; six component queries succeeded |
| 6. Data coherence | Pass: counts recorded; blob sample 8/8 |
| 7. Configuration references | Pass: presence recorded |
| 8. Restore method | Written; durations measured |
| 9. Teardown | Pass: all three runs |

Part B needs no second restore if it is captured on the same image
(`d715e9ec…`) and guest layout by 2026-10-24.

## File digests (SHA-256)

The two pulled guest files were committed with a final newline added by the
formatter. Their raw pulled bytes, which the deltas used, hash as
`e53eae34…8b6` (identities) and `5997a4af…509` (receipt reads).

| File | Digest |
| --- | --- |
| `archive-item1.json` | `1a5e9d33a4eda262f190dae41bc37a77cbb6a2328c6e808804edecaabc5f5067` |
| `913-20261017T180956Z-module-identities.json` | `9fca1f1fad94ac8ef3bce4e096d5b2ab8a8771e66746d172a0fdcbd6083e3cb3` |
| `913-20261017T180956Z-receipt-reads.json` | `ea64cda3aff992bbf149150b57e0f3f033d580d4c073bbf770a9bdf95365d216` |
| `identity-delta-vs-deployed.json` | `624fa058e31420983e97bce6e3be4ec164d0b2fc9ef4138ce2875a6d752fceda` |
| `module-delta-vs-81150337.json` | `3ca940915b7ff9d4a79090b0f255ff62a7117ec98ed39d124d9528ba97716d2d` |
| `inspection-comparison.json` | `92f1fda0fdcd7cb6b2ba44a11c926c47ad2e7ea4ca8180aa5636b3695ce542a9` |
| `rehearsal-run.log` | `34acf06898762fe7bfe9478d39937b88573753de7ebbaa234859df32692fb25a` |
| `rehearsal-run-2.log` | `a2006c1a7c8778e146de7e629edb5cb19662dd7242e68eadecf43f5a1b5b46b7` |
| `rehearsal-run-3.log` | `ec2762520885e6c7f8770c09e047b7895f24d00c38e8c947df92cafa6bd3d8ac` |
