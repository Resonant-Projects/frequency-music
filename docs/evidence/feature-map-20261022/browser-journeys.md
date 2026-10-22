# Guarded real frontend journeys

Source receipt:

```json
{
  "head": "a9b728466f9254938e40761e012451b4d896825b",
  "source_sha256": "2cd90e8e408e662197bfaaff762a9d676c78525dbf37dce230d153d2b7ac51a0",
  "command": [
    "vp",
    "run",
    "dev",
    "--",
    "--host",
    "127.0.0.1",
    "--port",
    "59117",
    "--strictPort",
    "--mode",
    "verification"
  ],
  "environment": {
    "VITE_AUTH_BYPASS": "1",
    "VITE_E2E_MODE": "0",
    "VITE_CONVEX_URL": "http://127.0.0.1:9"
  },
  "url": "http://127.0.0.1:59117",
  "port": 59117,
  "process_started": "Thu Oct 22 20:15:52 2026"
}
```

Foreground launch: `python3 .cursor/skills/verify-frequency-music/scripts/control.py launch feature-map-20261022` from repository root. It was stopped by verified cleanup, exit **0**.

The Vite URL in launch.log was `http://127.0.0.1:59117/`. Doctor established actual rendering rather than accepting server readiness alone. Browser contexts were fresh; the driver refused off-origin HTTP/writes, closed backend port-9 WebSockets before connection and permitted only the owned Vite server. Port 9 is not a mock backend.

| Evidence | Command suffix after `python3 .cursor/skills/verify-frequency-music/scripts/control.py` | Exit | Output assertion |
| --- | --- | --- | --- |
| D | `doctor feature-map-20261022` | 0 | status `pass`; 1 actions; 418 HTTP requests; pageErrors `[]`; externalRequests `[]`; 1 backend WebSockets blocked. |
| B1 | `drive feature-map-20261022 essays` | 0 | status `pass`; 25 actions; 3385 HTTP requests; pageErrors `[]`; externalRequests `[]`; 9 backend WebSockets blocked. |
| B2 | `drive feature-map-20261022 navigation` | 0 | status `pass`; 8 actions; 1262 HTTP requests; pageErrors `[]`; externalRequests `[]`; 3 backend WebSockets blocked. |
| B3 | `drive feature-map-20261022 search` | 0 | status `pass`; 9 actions; 1696 HTTP requests; pageErrors `[]`; externalRequests `[]`; 4 backend WebSockets blocked. |
| B4 | `drive feature-map-20261022 ingest` | 1 (expected refusal) | No browser opened for ingest; explicitly requires isolated backend/write identity. |

Doctor process check output:
```text
{
  "status": "pass",
  "mode": "offline-local-ui",
  "head": "a9b728466f9254938e40761e012451b4d896825b",
  "source_sha256": "2cd90e8e408e662197bfaaff762a9d676c78525dbf37dce230d153d2b7ac51a0",
  "url": "http://127.0.0.1:59117",
  "listener_pids": [
    20923
  ],
  "scope": "local essay UI, not Clerk or Convex health"
}
```

The browser reported **413 essays / 477,745 words**. Initial archive has 25 title links (latest plus 24 archive entries), not 25 total essays. B1 traversed latest/archive/newly revealed/related cards, body/reload/back, Show more/focus, desktop/mobile Essays menu entry, all three search triggers, essay search result and missing slug. B2 asserted grouped links and keyboard access plus Essays navigation. Its Compose link list currently omits Docket (G01); backend destinations were not verified. B3 proved local page results, selection reset and dismissal, not research-search completion.

B4 refusal output:
```text
Error: BLOCKED: Ingest requires an explicitly approved isolated Convex deployment and write identity. This helper will not mutate the shared live backend.
    at file:///home/kelliott/.t3/worktrees/frequency-music/docs-feature-map/.cursor/skills/verify-frequency-music/scripts/drive.mjs:312:11
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
ERROR: ingest failed with exit 1; run cleanup feature-map-20261022
```

## Visual inspection and retained artifacts

The archive and rendered essay-body screenshots were opened and visually inspected. They show the Frequency Music shell, archive and actual body paragraphs. Screenshots/traces are local-only in `.cursor/skills/verify-frequency-music/evidence/feature-map-20261022/`; they are not in this PR. Checksums are committed in `browser-journeys-manifest.json and browser-receipts-manifest.json`. Key files:

- `essays-01-archive.png`, `essays-03-detail.png`, `essays-16-mobile-entry.png`, `essays-25-not-found.png` and matching ARIA snapshots.
- `essays-actions.jsonl`, `navigation-actions.jsonl`, `search-actions.jsonl` and the corresponding trace ZIPs and result JSONs.
- `instance.json`, `launch.log`, Doctor/cleanup receipts.

T3 collaborative preview independently rendered `/essays` and read the archive title/413-essay count. Its later read of the broken feedback fixture showed an empty body titled “Audio feedback fixture”; the command failure F1 provides the meaningful diagnostic. No hosted page was used.

## Cleanup

Command: `python3 .cursor/skills/verify-frequency-music/scripts/control.py cleanup feature-map-20261022`, exit **0**. Selected output:
```json
{
  "status": "pass",
  "port_released": 59117,
  "process_group_stopped": 20309,
  "scratch_removed": true
}
```
`evidence_preserved`: 85 files. Final source fingerprints stayed unchanged; owned group/listener stopped and scratch removed. The feedback fixture process was separately terminated after its interrupted run using verified checkout/command/group ownership; the bounded final Playwright run stopped its own server.
