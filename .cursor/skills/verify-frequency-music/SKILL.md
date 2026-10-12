---
name: verify-frequency-music
description: "Verify local essay UI before frontend handoff."
platforms: [macos]
---

# Verify Frequency Music

Drive the real SolidJS/TanStack frontend through Chromium. Read [the feature map](features/README.md) first. The safe baseline proves the committed essay archive and local navigation without contacting the live backend. It does not prove Clerk login, Convex-backed workflows, media, or deployed production behavior.

## Launch

Run from the repository root. Read `AGENTS.md` and `.cursor/rules/` first. The lifecycle helper is verified on macOS and requires Python 3, Node, `ps`, `lsof`, and POSIX process groups; Windows is not supported. Paths are discovered relative to the canonical script, so another checkout or worktree needs no path edits. This checkout uses `vp`/`vpx`, not npm. Dependencies belong to separate root and web packages:

```bash
vp install
(cd web && vp install)
(cd web && vp exec playwright install chromium)
```

Only install if dependencies or the matching browser executable are missing. `web/package.json` is the command source. The existing authenticated E2E config runs a shared live backend and writes data, so do not use `vp run test:e2e` as the default verification launch.

Choose a fresh run ID. Start this foreground supervisor through a background-capable terminal tool, retaining its returned session ID:

```bash
./.cursor/skills/verify-frequency-music/scripts/control.py launch proof-essays
```

The helper runs, from `web/`, `vp run dev -- --host 127.0.0.1 --port <allocated-port> --strictPort --mode verification`. The numeric port is selected at runtime and recorded with the exact command in `evidence/proof-essays/instance.json`. It sets `VITE_AUTH_BYPASS=1`, `VITE_E2E_MODE=0`, and `VITE_CONVEX_URL=http://127.0.0.1:9`. These use the existing switches in `web/src/main.tsx` and `web/src/router.tsx`, not a new product hook. Port 9 is deliberately not a backend fixture and returns no fake data.

The dev script runs Panda codegen/cssgen before Vite. `launch.log` must contain the loopback Local URL. That line alone is not readiness; require Doctor to render the essay archive in a fresh context. No backend migration or database seed runs in this mode. `docs/essays/*.md`, `web/vite.config.ts` and `web/src/lib/essays.ts` supply real committed content. The browser context starts empty; no stored session is imported. Scratch directories live under `~/.hermes/cache/scratch`; the helper sets child `TMPDIR` to the run's directory so Vite and Chromium scratch stay there too.

Separate ports, process groups, fresh browser contexts, and scratch directories allow concurrent read-only local runs. Panda generates shared ignored `web/styled-system/` files, so do not launch concurrently with package installs, codegen, or source edits. This is not backend isolation. Never double-drive a shared live Convex instance or reuse an existing listener. A source change during the run requires cleanup and relaunch with a fresh ID.

## Doctor

```bash
./.cursor/skills/verify-frequency-music/scripts/control.py doctor proof-essays
```

This read-only app check requires the recorded process start identity, the listener belonging to its process group, the recorded Git HEAD and source SHA-256 (tracked and nonignored new web/corpus/shared-contract/verification inputs and root build configuration; evidence and Python caches excluded), an actual Vite response, and the rendered `Essays` heading, title `Essays — Frequency Music`, and 25 essay links. It stores `doctor-process.json`, `doctor-result.json`, an ARIA snapshot, screenshot and trace. The process receipt is marked `running` at the start, `fail` on any failed preflight/browser check, and `pass` only after the browser check completes. A retry cannot leave an earlier pass as its current receipt. Exit 0 means the offline essay UI is worth driving, not that Convex or Clerk is healthy. It never adopts an unrelated server.

## Drive

```bash
./.cursor/skills/verify-frequency-music/scripts/control.py drive proof-essays essays
./.cursor/skills/verify-frequency-music/scripts/control.py drive proof-essays navigation
./.cursor/skills/verify-frequency-music/scripts/control.py drive proof-essays search
```

Each safe drive runs Doctor first; the blocked `ingest` command skips Doctor so it never opens a browser. The shipped helper uses the repository's installed `@playwright/test` and a new Chromium context, but does not invoke the live-auth global setup. Exact selectors and user entry points are in `features/`. `essays` covers archive, pagination, detail, reload, related cards, desktop/mobile navigation, all search entry controls, essay search results, and a missing slug. `navigation` and `search` are separate optional journeys. A feature command returns nonzero on an assertion failure; do not count a failing entry point as verified through another path.

`drive ... ingest` deliberately fails before opening a browser. Full ingestion needs an isolated, explicitly approved Convex deployment, identity, worker behavior, and cleanup plan. None is provisioned by this skill. Follow `features/ingest.md` only after those prerequisites exist. Do not repoint this helper to production, run `convex dev/deploy/codegen`, publish, schedule jobs, or obtain paid model/media output to make the proof pass.

## Evidence

Artifacts remain in `.cursor/skills/verify-frequency-music/evidence/<run-id>/`. This directory ignores run artifacts in Git; evidence persists locally, but is not published or backed up by Git. Copy it elsewhere if a handoff needs durable remote retention.

Capture both the action and resulting state. The helper writes `<feature>-actions.jsonl`, numbered before/after PNGs and ARIA snapshots, `<feature>-trace.zip`, console messages and `<feature>-result.json`. `instance.json` records the command, nonsecret flags, HEAD, source hash, port, process identity and scratch path. Use Playwright's viewer with `cd web && vp exec playwright show-trace ../.cursor/skills/verify-frequency-music/evidence/<run-id>/essays-trace.zip`.

Proof must traverse real user controls, not internal setters or test-only endpoints. This helper supplies no mocked responses. It blocks browser traffic outside the owned frontend and the deliberately unavailable loopback backend. It asserts no external requests, no HTTP write methods, and no unhandled page errors. Console connection warnings for loopback port 9 are expected when search asks for live research; they do not establish a completed research-search empty state. The archive and essay bodies are real local reads. Capture backend persistence via a separate read-only view for any future mutation proof; a success toast alone is insufficient.

## Cleanup

Always run cleanup after success or failure:

```bash
./.cursor/skills/verify-frequency-music/scripts/control.py cleanup proof-essays
```

The helper verifies the recorded process identity, stops only that process group, waits for its listener to disappear, and removes only the recorded scratch directory. It never kills by name or deletes the proof directory. `cleanup.json` must report `scratch_removed: true`, the released port, stopped process group, and surviving evidence filenames. Confirm the requested feature's result, screenshots, action log and trace still exist and are nonempty. The foreground supervisor defers interruption until it owns allocated resources, and retains its unreaped child PID until descendants have stopped; an exited leader cannot surrender ownership early. Its `finally` covers allocation, executable/identity/receipt failures and interruption, stops spawned children, reaps the leader and removes scratch even without `instance.json`. `launch-cleanup.json` records that teardown while `launch.log` survives. After a failed launch, inspect both files; if an instance receipt exists, explicit cleanup is still safe and verifies the port. Use a new ID for the retry. Do not delete dependency/browser caches that predated the run. Panda output is normal ignored repository build output, not disposable app data.

## Helpers

The shipped scripts are executable. `scripts/control.py` is the lifecycle and feature command entry point; `scripts/drive.mjs` is its Playwright implementation. To invoke the latter directly for diagnosis, first run Doctor, then use `node .cursor/skills/verify-frequency-music/scripts/drive.mjs essays .cursor/skills/verify-frequency-music/evidence/proof-essays/instance.json`. Direct invocation does not check process ownership by itself.

Run the offline helper safety/contract checks with `python3 .cursor/skills/verify-frequency-music/scripts/test_control.py -v`. They test discovery, feature-map shape, unsafe run IDs, PID reuse, shutdown races, foreign listeners, stale Doctor receipts, shared/helper/new-source fingerprint changes, evidence/cache exclusions and preservation of evidence. Abnormal-launch regressions spawn real inert Python child/descendant processes (not the app or a backend), inject missing executable/identity failures and a pre-receipt signal, and verify leader-exit teardown. They do not substitute for the browser proof.

The repo-owned `.agents/skills/verify-frequency-music` symlink points to this directory for Hermes discovery. Repository trust is a separate parent/user decision, not something these helpers change.

Use `/maintain-verification-skill` when routes, handles, data prerequisites or entry points change. [The execution record](references/proof.md) distinguishes proved local paths from blocked integrations.
