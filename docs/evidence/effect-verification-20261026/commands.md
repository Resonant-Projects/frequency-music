# Commands and local artifacts

All commands ran from the repository root unless a directory is specified.
Dependencies and matching Chromium were already installed, so this audit did not
reinstall packages or services. Run ID for both owned lifecycles was
`effect-ca495094-20261026`. All commands below exited 0.

## Build and package checks

From `web/`:

```sh
VITE_AUTH_BYPASS=1 VITE_E2E_MODE=0 VITE_CONVEX_URL=http://127.0.0.1:9 \
  vp run build -- --mode verification
```

After that build completed, from root:

```sh
APP_ENV=test vp run verify
```

## Sequential component fixtures

From `web/`, each strict-port server was started and stopped by its own runner:

```sh
APP_ENV=test vp exec playwright test --config playwright.ui.config.ts --reporter=list
APP_ENV=test vp exec playwright test --config tests/listen/playwright.config.ts --reporter=list
APP_ENV=test vp exec playwright test --config tests/auth/playwright.config.ts --reporter=list
APP_ENV=test vp exec playwright test --config tests/feedback/playwright.config.ts \
  feedback.spec.ts --workers=1 --max-failures=1 --timeout=8000 --reporter=list
```

The optional feedback `screenshots.spec.ts` was not selected and is not counted
as visual evidence. The four fixture ports 4186, 4187, 4188 and 5192 had no
listeners after completion.

## Guarded real frontend

The foreground supervisor used its own retained terminal session. Doctor and
the three journeys ran in separate commands. Cleanup ran in `finally` after
the journey sequence.

```sh
python3 .agents/skills/verify-frequency/scripts/control.py launch effect-ca495094-20261026
python3 .agents/skills/verify-frequency/scripts/control.py doctor effect-ca495094-20261026
python3 .agents/skills/verify-frequency/scripts/control.py drive effect-ca495094-20261026 essays
python3 .agents/skills/verify-frequency/scripts/control.py drive effect-ca495094-20261026 navigation
python3 .agents/skills/verify-frequency/scripts/control.py drive effect-ca495094-20261026 search
python3 .agents/skills/verify-frequency/scripts/control.py cleanup effect-ca495094-20261026
```

The launch supervisor subsequently exited 0. Doctor/drive verified the recorded
HEAD, source fingerprint, process ownership and owned listener. Each drive used a
fresh browser context. The blocked `ingest` journey was not run; persisted intake
was exercised through the separate local backend below.

Local artifacts, relative to the repository root:

```text
.cursor/skills/verify-frequency-music/evidence/effect-ca495094-20261026/
  instance.json, doctor-process.json, cleanup.json, launch-cleanup.json
  essays-actions.jsonl, navigation-actions.jsonl, search-actions.jsonl
  essays-result.json, navigation-result.json, search-result.json
  essays-01-archive.png, essays-03-detail.png
  essays-trace.zip, navigation-trace.zip, search-trace.zip
```

Archive and body screenshots were inspected, along with their real rendered
content. All numbered before/after screenshots and ARIA snapshots remain in
that local directory. They are ignored artifacts, not committed images.

## Real local persistence

```sh
python3 scripts/local-convex/control.py run effect-ca495094-20261026
```

The existing workflow started a fresh empty Linux Docker instance, deployed the
real schema/functions/components into its disposable copy, seeded a synthetic
identity, ran four serial browser journeys, and tore down in `finally`. Its
explicit generated key and environment stayed within the local workflow. No
production deployment command or production credential was used.

Local artifacts:

```text
web/artifacts/local-convex/effect-ca495094-20261026/
  instance.json, deploy.log, relay.log, cleanup.json
  snapshot-*.json
  01-url-saved.png, 02-recovery-saved.png
  03-hypothesis-saved.png, 04-recipe-saved.png, 05-composition-saved.png
  06-listening-saved.png, 07-lineage.png, 08-feed-disabled.png
  browser/*/trace.zip
```

The Listening Session and lineage screenshots were inspected. All eight saved
screenshots and four traces survive cleanup. Independent synthetic table
snapshots establish persistence; a screenshot or success message alone does not.
The workflow removed local credential files, release copy, scratch, owned relay
listeners, container, volume and network before returning a passing cleanup
receipt.

Raw terminal logs remain local at
`/tmp/frequency-verify-20261026-ca495094/`. The [artifact manifest](artifacts.json)
records sizes and SHA-256 values for the raw logs and selected retained proof.
The [compact output](output.md) and [result assertions](results.json) provide
reviewable committed text without session state or credentials.
