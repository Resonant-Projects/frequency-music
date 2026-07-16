# Proxmox Monitoring Stack Implementation Plan

> **For Hermes:** Use this as an operations plan. Do not run internet-piped install scripts or expose dashboards until the user explicitly approves the execution phase.

**Goal:** Add a layered monitoring stack to the existing Proxmox cluster at `prox.rproj.art`, based on the Virtualization Howto article’s Proxmox + ProxMenux + Pulse + optional Ceph Dashboard model.

**Architecture:** Keep Proxmox’s native UI as the first cluster-health view, add Pulse as the unified dashboard for Proxmox/VM/LXC/Docker/backups/storage visibility, add ProxMenux Monitor only where host-level hardware detail is valuable, and enable Ceph Dashboard only if the cluster actually uses Ceph. Use read-only/scoped service accounts and keep monitoring access internal/VPN-first.

**Tech Stack:** Proxmox VE, Pulse, ProxMenux Monitor, optional Ceph Dashboard, optional reverse proxy/VPN, existing Proxmox API token handling.

---

## Current State Observed

- Existing project notes identify the cluster endpoint as `prox.rproj.art` with API URL `https://prox.rproj.art:8006/api2/json`.
- Existing secret-handling notes require `PROXMOX_TOKEN_ID` and `PROXMOX_TOKEN_SECRET` to stay in env/runtime secrets only.
- Local Proxmox smoke check was initially attempted with self-signed allowance and failed from this machine with `ConnectionRefused` to `https://prox.rproj.art:8006/api2/json/nodes`.
- This plan therefore assumes implementation may need to happen from inside the same LAN/VPN or directly on a Proxmox node. The reachability question was subsequently resolved (see Implementation Status).

## Article Takeaways

The article recommends a layered home-lab monitoring approach:

1. **Proxmox built-in monitoring** for native cluster/node/VM/LXC/task/backup visibility.
2. **ProxMenux Monitor** for host-level hardware health, temperatures, SMART data, PCI inventory, VM/LXC info, and a web dashboard on port `8008`.
3. **Pulse** for a unified dashboard covering Proxmox hosts, VMs, LXCs, Docker, storage, Ceph, backups, alerts, and agents. Default web port is `7655`.
4. **Native Ceph Dashboard** if the cluster uses Ceph, because Ceph health and recovery state deserves its own authoritative view.

## Target Deployment Shape

- **Primary dashboard:** Pulse, deployed as a small LXC on one Proxmox node.
- **Host hardware dashboard:** ProxMenux Monitor on each Proxmox node, or on the nodes where disk/temperature visibility matters most.
- **Storage-specific dashboard:** Ceph Dashboard only if Ceph is present.
- **Existing native view:** Proxmox UI remains authoritative for cluster/task/admin operations.
- **Network exposure:** Internal LAN/VPN only at first. Do not expose Pulse or ProxMenux publicly until auth, TLS, reverse proxy, and firewall rules are reviewed.

---

## Implementation Status

Current status as of 2026-06-06:

- `prox.rproj.art` resolves to `172.16.0.7`.
- This Mac routes `172.16.0.7` through `utun9`, consistent with private VPN or management-network access.
- TCP access to `prox.rproj.art:8006` and `prox2.rproj.art:8006` succeeds.
- A fresh scoped Proxmox API identity was created for local smoke checks: `frequency-monitor@pve!codex-local`.
- The token has `PVEAuditor` at `/` and is stored only in local `.env.local`; do not commit the token secret.
- `cd agent && PROXMOX_ALLOW_SELF_SIGNED=true bun run smoke:proxmox` now succeeds and returns sanitized Proxmox version/node metadata.
- SSH timeouts were reproduced as a Mac/VPN-to-port-22 transport issue, not an sshd/auth issue: ICMP and Proxmox API port `8006` stayed healthy while direct SSH to `prox2:22`, then both nodes, was temporarily blackholed.
- `prox2` sshd was active, had no SSH drop rule, and accepted access from `prox`; `ssh -J prox prox2` worked while direct Mac-to-`prox2:22` failed.
- The practical local fix was to add SSH multiplexing for `prox` and `prox2` in `~/.ssh/config` (`ControlMaster auto`, `ControlPersist 10m`) and avoid rapid parallel SSH bursts.
- After a cooldown and persistent control connection, `prox2` remained stable enough for installation. Direct SSH to both nodes later recovered.
- Browser access is useful for viewing Pulse, ProxMenux Monitor, or the Proxmox web shell, but it was not needed for the fix; the root issue was SSH transport churn/filtering, not the Proxmox web UI.

Installed monitoring components:

- Pulse installed as LXC `102` on `prox2`, hostname `pulse`, DHCP address `172.16.0.21`, port `7655`, storage `local-lvm`, `onboot=1`.
- Pulse version installed: `v5.1.34`.
- Pulse health endpoint: `http://172.16.0.21:7655/api/health`.
- Pulse auto-registered the Proxmox cluster through `prox2` and reports 2 nodes, 6 containers, backups, storage, and physical disks.
- ProxMenux normal version installed on `prox2`.
- ProxMenux Monitor version installed: `v1.2.2`.
- ProxMenux Monitor service: `proxmenux-monitor.service`, enabled and active on `prox2`, listening on `http://172.16.0.8:8008`.

Verified cluster inventory from the successful SSH window:

- Cluster name: `elliott-manor`.
- Proxmox version: `pve-manager/9.2.2/b9984c6d90a4bd80` on both `prox` and `prox2`.
- Nodes: `prox` at `172.16.0.7`, `prox2` at `172.16.0.8`.
- Cluster quorum: healthy with 2 expected votes and 2 total votes.
- Active shared storage: `nas-docker`, `nvme-tb`, and `tb-nfs`.
- Backup job: weekly Sunday 01:00 snapshot backup to `nas-docker` for VMIDs `100,101,200`.
- Ceph: not installed or not configured; skip Ceph Dashboard.
- Existing guests: `paas` (`100`, running on `prox2`), `n8n-template` (`101`, running on `prox`), `monitor` (`103`, stopped on `prox`), `moltbot` (`200`, running on `prox`), and `github-runner` (`300`, running on `prox`).
- Next available VMID observed from `prox2`: `102`.

---

## Phase 0: Prerequisite Discovery

### Task 0.1: Confirm cluster reachability path

**Objective:** Determine whether monitoring setup can be performed from this machine, via VPN, or only from a Proxmox node.

**Steps:**

1. From this machine or a LAN/VPN-connected host, test:

   ```bash
   curl -kI https://prox.rproj.art:8006/
   ```

2. If unreachable, run equivalent checks from inside the network or SSH to a Proxmox node.
3. Record whether `prox.rproj.art:8006` is intentionally internal-only.

**Expected result:** Clear access path for Proxmox API and node shell.

### Task 0.2: Inventory the cluster

**Objective:** Identify nodes, storage, Ceph usage, PBS usage, and Docker hosts before installing anything.

**Commands from a Proxmox node:**

```bash
pvecm status
pvesh get /nodes
pvesh get /storage
pvesh get /cluster/resources --type vm
pvesh get /cluster/resources --type storage
systemctl is-active ceph.target || true
ceph -s 2>/dev/null || true
```

**Capture:**

- node names and count
- Ceph present: yes/no
- PBS present: yes/no
- Docker hosts: which VMs/LXCs run Docker
- candidate node for Pulse LXC
- existing reverse proxy/VPN path, if any

### Task 0.3: Decide monitoring access policy

**Objective:** Prevent accidental public exposure.

**Decision points:**

- LAN-only vs VPN-only vs reverse-proxied.
- Whether dashboards need SSO/OIDC or local auth is sufficient.
- Whether Telegram/email/Slack alerting should be enabled.
- Whether monitoring credentials should be read-only and scoped.

---

## Phase 1: Baseline Native Proxmox Monitoring

### Task 1.1: Verify built-in Proxmox alerts and backups visibility

**Objective:** Make sure native Proxmox monitoring remains the first-line view.

**Steps:**

1. Review Proxmox UI for:
   - cluster quorum
   - node CPU/memory/load
   - storage capacity
   - backup job status
   - recent failed tasks
2. Make sure root/admin emails or notification targets are configured if desired.
3. Document any current blind spots.

**Acceptance criteria:** You can answer: “is the cluster healthy, are backups passing, and are nodes/storage near limits?” from Proxmox UI alone.

---

## Phase 2: Deploy Pulse as the Unified Dashboard

### Task 2.1: Create a read-only/scoped Proxmox API identity for Pulse

**Objective:** Avoid giving Pulse full administrative credentials.

**Recommended approach:** Create a Proxmox user/token with minimum permissions needed for inventory and monitoring.

**Notes:** Exact ACL scope depends on Pulse’s current requirements. Start read-only and expand only if Pulse fails to collect required resources.

**Do not:** Reuse existing high-privilege automation tokens unless necessary.

### Task 2.2: Install Pulse in a dedicated LXC

**Objective:** Run Pulse as the central dashboard.

**Recommended install path:** Proxmox LXC installer from Pulse docs.

**Safer execution procedure:**

1. Download the installer to a temporary file on the Proxmox host.
2. Review it before execution.
3. Execute only after review.

Reference command from docs:

```bash
curl -fsSL https://raw.githubusercontent.com/rcourtman/Pulse/release/5.1/install.sh -o /tmp/pulse-install.sh
less /tmp/pulse-install.sh
bash /tmp/pulse-install.sh
```

**Default dashboard:** `http://<pulse-lxc-ip>:7655`

### Task 2.3: Complete Pulse first-time security setup

**Objective:** Secure Pulse before adding monitored systems.

**Steps:**

1. Retrieve bootstrap token:

   ```bash
   pct enter <PULSE_VMID>
   cat /etc/pulse/.bootstrap_token
   # or: pulse bootstrap-token
   ```

2. Open `http://<pulse-lxc-ip>:7655`.
3. Create admin user/password.
4. Save generated API token in a password manager, not repo files.
5. Confirm Pulse auth is required after logout.

### Task 2.4: Add Proxmox cluster to Pulse

**Objective:** Let Pulse collect Proxmox nodes, VMs, LXCs, storage, backups, and Ceph summary if present.

**Steps:**

1. Add `prox.rproj.art` or internal Proxmox host/IP in Pulse.
2. Use the scoped API token.
3. Allow self-signed certs only if needed and only for internal access.
4. Confirm Pulse sees:
   - all nodes
   - VMs/LXCs
   - storage
   - backup status
   - Ceph tab if applicable

### Task 2.5: Add Docker monitoring via Pulse agents

**Objective:** Monitor Docker containers inside VMs/LXCs without mounting Docker socket into the Pulse server.

**Steps:**

1. In Pulse UI, go to Settings → Agents → Installation commands.
2. Generate install command for each Docker host.
3. Review command before running.
4. Install agent on each Docker VM/LXC.
5. Confirm Docker tab shows containers and health.

**Priority Docker hosts:** any VM/LXC running Hermes, frequency-music services, reverse proxy, databases, or home automation workloads.

### Task 2.6: Configure Pulse alert rules

**Objective:** Get useful alerts without noise.

**Initial alert set:**

- Proxmox node down/unreachable.
- VM/LXC down for critical workloads.
- Backup failure.
- Storage > 80% warning, > 90% critical.
- CPU sustained high load, not short spikes.
- Memory/swap pressure.
- Docker critical container stopped/unhealthy.
- Ceph health warning/error if Ceph exists.

**Delivery:** Start with one channel, preferably Telegram or email, and tune before expanding.

---

## Phase 3: Add ProxMenux Monitor for Host-Level Hardware Health

### Task 3.1: Choose ProxMenux scope

**Objective:** Decide whether to install ProxMenux on all nodes or selected nodes.

**Recommendation:** Start with one representative node, verify value and security, then roll out to all nodes if useful.

### Task 3.2: Install ProxMenux after source review

**Objective:** Add hardware/host-level visibility, especially SMART and temperature data.

**Safer execution procedure:**

```bash
wget -qO /tmp/install_proxmenux.sh https://raw.githubusercontent.com/MacRimi/ProxMenux/main/install_proxmenux.sh
less /tmp/install_proxmenux.sh
bash /tmp/install_proxmenux.sh
```

**Post-install commands:**

```bash
systemctl status proxmenux-monitor
journalctl -u proxmenux-monitor -n 50
```

**Dashboard:** `http://<proxmox-node-ip>:8008`

### Task 3.3: Validate ProxMenux hardware data

**Objective:** Confirm it adds information Pulse/Proxmox do not show clearly.

**Check:**

- SMART health
- temperatures
- PCI inventory
- host-level CPU/RAM/network
- VM/LXC listing

### Task 3.4: Secure ProxMenux Monitor access

**Objective:** Keep port `8008` internal and authenticated.

**Steps:**

1. Confirm login and TOTP options.
2. Bind/firewall to internal management network if possible.
3. Do not publicly expose node dashboards.
4. If reverse proxied, enforce TLS and auth.

---

## Phase 4: Ceph Dashboard if Ceph Exists

### Task 4.1: Confirm Ceph status

**Objective:** Avoid installing Ceph Dashboard if the cluster does not use Ceph.

**Command:**

```bash
ceph -s
```

If unavailable or cluster reports no Ceph, skip Phase 4. (As of the inventory above, Ceph is not present on this cluster.)

### Task 4.2: Enable native Ceph Dashboard

**Objective:** Add authoritative storage-cluster health visibility.

**Typical commands, to verify against current Proxmox/Ceph version before execution:**

```bash
apt update
apt install ceph-mgr-dashboard
ceph mgr module enable dashboard
ceph dashboard create-self-signed-cert
ceph dashboard ac-user-create <user> <password> administrator
ceph mgr services
```

**Acceptance criteria:** Dashboard URL from `ceph mgr services` loads internally and reports cluster health, OSDs, pools, PGs, and recovery state.

### Task 4.3: Secure Ceph Dashboard

**Objective:** Treat Ceph dashboard as storage-admin sensitive.

**Steps:**

- Internal/VPN only.
- Strong password or SSO if supported.
- Document dashboard URL in private ops notes, not public repo docs.

---

## Phase 5: Operational Hardening

### Task 5.1: Network and firewall hardening

**Objective:** Make dashboards reachable only from trusted paths.

**Ports:**

- Proxmox UI/API: `8006`
- Pulse: `7655`
- ProxMenux Monitor: `8008`
- Ceph Dashboard: dashboard-specific URL from `ceph mgr services`

**Rules:**

- Permit LAN/VPN admin subnet.
- Deny public internet.
- Prefer reverse proxy only after auth/TLS are tested.

### Task 5.2: Back up monitoring configuration

**Objective:** Ensure dashboards can be restored.

**Pulse config locations:**

- LXC/Systemd: `/etc/pulse/`
- Docker: `/data/`

Back up sensitive files carefully:

- `.env`
- `.encryption.key`
- encrypted node/alert/webhook files
- `metrics.db` if retaining history matters

### Task 5.3: Alert tuning period

**Objective:** Prevent alert fatigue.

**Run for:** 7 days.

**Tune:**

- CPU thresholds
- memory thresholds
- storage warnings
- backup alerts
- Docker container criticality
- quiet hours, if desired

### Task 5.4: Document final monitoring map

**Objective:** Leave a durable operational reference.

Document privately:

- Pulse URL
- ProxMenux URLs per node
- Ceph Dashboard URL if enabled
- alert channels
- token ownership and rotation policy
- restore procedure
- update procedure

---

## Acceptance Criteria

- The Proxmox API smoke check succeeds from the intended management access path.
- Proxmox UI remains usable for native cluster/task/backup checks.
- Pulse shows all Proxmox nodes, VMs, LXCs, storage, backups, and critical Docker hosts.
- Pulse has authentication enabled and alerting configured, and uses scoped credentials without unnecessary mutation privileges.
- ProxMenux Monitor is installed on at least one node and shows hardware details not easily visible elsewhere, then either accepted for rollout or intentionally left as a one-node tool.
- ProxMenux ports are not exposed publicly.
- Ceph Dashboard is enabled only if `ceph -s` confirms Ceph is present.
- No monitoring tokens or passwords are committed to git or printed in logs.
- Dashboard access is internal, VPN-only, or explicitly approved for reverse proxy exposure, and alert routes are documented privately.

## Open Questions Before Execution

1. Is `prox.rproj.art:8006` supposed to be reachable from this Mac, or only via LAN/VPN? — Resolved: reachable over the private management network/VPN (`utun9`); API on `8006` works, direct SSH to `:22` was the only flaky transport.
2. How many Proxmox nodes are in the cluster now? — Resolved: 2 (`prox`, `prox2`).
3. Is Ceph actually in use? — Resolved: no; skip the Ceph Dashboard phase.
4. Is Proxmox Backup Server in use? — Not confirmed; current backups are weekly snapshots to `nas-docker` (NFS), not a dedicated PBS.
5. Which VMs/LXCs run Docker and should get Pulse agents? — Still to enumerate (candidate workloads: `paas`, `moltbot`, `github-runner`).
6. Preferred alert channel: Telegram, email, Discord/Slack, or something else?
7. Should Pulse/ProxMenux be LAN-only, VPN-only, or reverse-proxied behind auth?
