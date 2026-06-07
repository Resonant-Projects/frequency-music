# Proxmox Monitoring Stack Plan

Date: 2026-06-06

## Summary

This plan implements a layered Proxmox monitoring stack. The useful takeaway is not to install one magic dashboard, but to combine the Proxmox native UI, Pulse, host-level hardware monitoring, and Ceph Dashboard only when Ceph is actually in use.

Recommended order:

1. Get into the Proxmox management network.
2. Inventory the cluster.
3. Install Pulse as a dedicated LXC.
4. Add Proxmox with scoped credentials.
5. Add Docker agents to the important workload hosts.
6. Add ProxMenux Monitor on one node as a hardware-health pilot.

## Layered Stack

- Proxmox native UI: first-line cluster, node, VM, LXC, task, and backup view.
- Pulse: primary unified dashboard for Proxmox, VMs, LXCs, Docker, storage, backups, Ceph, and alerts.
- ProxMenux Monitor: host-level hardware visibility for SMART, temperatures, PCI inventory, and hardware health.
- Ceph Dashboard: enable only if Ceph is actually in use.

## Important Finding

The existing safe Proxmox smoke check was attempted with:

```bash
cd agent
PROXMOX_ALLOW_SELF_SIGNED=true bun run smoke:proxmox
```

It failed with:

```text
ConnectionRefused
https://prox.rproj.art:8006/api2/json/nodes
```

Before implementation, resolve whether `prox.rproj.art:8006` should be reachable from this Mac or only from LAN, VPN, or direct node shell.

## Implementation Status

Current status as of 2026-06-06:

- `prox.rproj.art` resolves to `172.16.0.7`.
- This Mac routes `172.16.0.7` through `utun9`, consistent with private VPN or management-network access.
- TCP access to `prox.rproj.art:8006` and `prox2.rproj.art:8006` succeeds.
- The repository root `.env.local` does not currently provide `PROXMOX_TOKEN_ID` or `PROXMOX_TOKEN_SECRET`, so `agent/scripts/spike-proxmox.ts` cannot authenticate yet.
- Direct SSH initially succeeded to both `prox.rproj.art` and `prox2.rproj.art`, but subsequent SSH attempts timed out while Proxmox API port `8006` remained reachable.
- No Pulse or ProxMenux installer should be run until either SSH is stable again or a scoped Proxmox API token is available locally.

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

## Phase 1: Prerequisite Discovery

- Confirm how this Mac should reach `prox.rproj.art`.
- Confirm DNS resolution and route for `prox.rproj.art`.
- Run the existing secret-safe smoke check from `agent/`.
- Inventory Proxmox nodes, storage, backup targets, Ceph usage, and Docker hosts.
- Decide the dashboard access policy: LAN-only, VPN-only, or reverse-proxy access.

## Phase 2: Baseline Proxmox Monitoring

- Confirm the native Proxmox UI is healthy.
- Confirm cluster, node, VM, LXC, task, and backup views are usable.
- Record any existing backup, storage, or task visibility gaps before installing new dashboards.

## Phase 3: Deploy Pulse

- Create a dedicated LXC inside the Proxmox management network.
- Create a scoped, read-only Proxmox API identity for Pulse.
- Bootstrap Pulse securely without committing credentials.
- Add the Proxmox cluster, backups, storage, and Docker agents.
- Tune alerts for the actual homelab signal level instead of enabling noisy defaults.

Pulse is the first new monitoring component because it provides the broadest useful coverage.

## Phase 4: Deploy ProxMenux Monitor

- Install ProxMenux Monitor on one Proxmox node first.
- Validate whether SMART, temperature, PCI inventory, and hardware health data add enough operational value.
- Keep port `8008` internal and authenticated.
- Roll out to additional nodes only if the first node proves useful.

## Phase 5: Enable Ceph Dashboard If Applicable

- Run `ceph -s` before planning Ceph Dashboard work.
- Skip this phase if Ceph is not installed or not used.
- If Ceph exists, keep Ceph Dashboard internal or VPN-only.

## Phase 6: Operational Hardening

- Restrict dashboard exposure with firewall and network policy rules.
- Back up dashboard configuration.
- Run an alert tuning period before relying on notifications.
- Document private operational details outside public docs.

## Acceptance Criteria

- The Proxmox API smoke check succeeds from the intended management access path.
- The Proxmox native UI remains the first-line source for tasks, backups, and cluster health.
- Pulse shows cluster, nodes, VMs, LXCs, storage, backups, and selected Docker hosts.
- Pulse uses scoped credentials and does not have unnecessary mutation privileges.
- ProxMenux Monitor has been piloted on one node and either accepted for rollout or intentionally left as a one-node tool.
- Ceph Dashboard is enabled only if `ceph -s` confirms Ceph is present.
- Dashboard access is internal, VPN-only, or explicitly approved for reverse proxy exposure.
- No credentials, tokens, or secrets are committed to the repository.
