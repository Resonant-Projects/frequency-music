# Verification skill path repair

The path repair goes directly into [PR #185](https://github.com/Resonant-Projects/frequency-music/pull/185), not a separate PR. `.agents/skills/verify-frequency/scripts` is a relative symlink to the single existing guarded helper implementation. All run commands in this skill now use its own `.agents` path. The canonical helper still resolves its checkout and evidence location correctly.

Commands run from the repository root, each exit **0**:

```sh
python3 .agents/skills/verify-frequency/scripts/control.py launch gap-skill-path-20261022
python3 .agents/skills/verify-frequency/scripts/control.py doctor gap-skill-path-20261022
python3 .agents/skills/verify-frequency/scripts/control.py drive gap-skill-path-20261022 navigation
python3 .agents/skills/verify-frequency/scripts/control.py cleanup gap-skill-path-20261022
```

Launch output selected fields:

```json
{
  "url": "http://127.0.0.1:44889",
  "head": "f147fc08caa88fd04ec0e780937159ca06dc3bfc",
  "source_sha256": "2cd90e8e408e662197bfaaff762a9d676c78525dbf37dce230d153d2b7ac51a0",
  "environment": {
    "VITE_AUTH_BYPASS": "1",
    "VITE_E2E_MODE": "0",
    "VITE_CONVEX_URL": "http://127.0.0.1:9"
  }
}
```

Doctor and navigation output (request counts; full request arrays stay local):

```json
{"status": "pass", "feature": "doctor", "mode": "offline-local-ui", "actions": 1, "pageErrors": [], "externalRequests": [], "backendWebSocketsBlocked": ["ws://127.0.0.1:9/api/1.46.0/sync"], "requests": 418}
{"status": "pass", "feature": "navigation", "mode": "offline-local-ui", "actions": 8, "pageErrors": [], "externalRequests": [], "backendWebSocketsBlocked": ["ws://127.0.0.1:9/api/1.46.0/sync", "ws://127.0.0.1:9/api/1.46.0/sync", "ws://127.0.0.1:9/api/1.46.0/sync"], "requests": 1262}
```

Cleanup output selected fields:

```json
{
  "status": "pass",
  "port_released": 44889,
  "process_group_stopped": 422515,
  "scratch_removed": true
}
```

Screenshots, ARIA, action logs and traces remain locally in `.cursor/skills/verify-frequency-music/evidence/gap-skill-path-20261022/`; they were preserved by cleanup. This run checks the path repair on the audit source baseline, so its navigation receipt has eight actions. The separate Docket assertion PR #200 records nine actions and the two passing affected Playwright tests.
