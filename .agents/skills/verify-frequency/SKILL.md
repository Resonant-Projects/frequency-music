---
name: verify-frequency
description: Verify Frequency Music features locally, trace backend capabilities to UI entry points, and report evidence and reachability gaps without production access.
---

# Verify Frequency

Read [the feature map](../../../docs/feature-map.md), then the relevant stage
matrix. Use its feature IDs in the verification report. This skill covers the
four packages and their seams; the existing
[essay verification skill](../verify-frequency-music/SKILL.md) owns the guarded
frontend lifecycle and essay/navigation/search driver. This skill exposes that single
implementation through its `scripts` symlink; run commands from this skill path.
Evidence still lives in `.cursor/skills/verify-frequency-music/evidence/<run-id>/`.

## Choose the proof boundary

Read root `AGENTS.md`, the four `package.json` files, and the selected test or
fixture before execution. Keep existing product decisions and gates intact.
Do not enable gates, repair gaps, seed a shared backend, or publish as part of
an audit. Record gaps as **small-fix** or **needs-decision**.

Use local files, in-process `convex-test` databases, injected fake tools,
the isolated browser configs, or the owned local Convex workflow below. `APP_ENV=test` selects the
committed inert environment for CLI subprocess tests. Do not read credentials.
`VITE_AUTH_BYPASS=1` is client rendering only, not authenticated backend proof.

The default `web/playwright.config.ts` and `test:e2e` script use hosted Clerk
and a shared Convex backend, including writes and cleanup. They are outside
this local workflow. Convex `run`, `dev`, `codegen`, and `deploy` can touch the
single live deployment. Worker, media, ingestion, operator-extraction, export,
and paid eval CLIs can also contact services. Do not run them to fill a proof
gap. The local workflow below is the sole deployment exception: it creates an
empty localhost instance and its own key. Never point commands or environment
variables at production or read its admin key. A local Vite server can proxy `/podcast/*/feed.xml` to a hosted service;
the guarded essay driver blocks that traffic. Do not open that proxy path.

## Build and checks

From the repository root, install only missing dependencies. Each package has
its own lockfile and project boundary:

```bash
vp install --frozen-lockfile
(cd web && vp install --frozen-lockfile)
(cd agent && vp install --frozen-lockfile)
(cd media && vp install --frozen-lockfile)
(cd web && vp exec playwright install chromium)
```

Media tests need `ffmpeg` and `ffprobe`; real renderer tests also need `sclang`
and `scsynth`. Report skipped tests. Do not install or start a media service
merely to remove a skip.

Build with explicit inert Vite values. This generates ignored Panda output
needed by the web typecheck; complete it before running checks or browsers:

```bash
(cd web && VITE_AUTH_BYPASS=1 VITE_E2E_MODE=0 \
  VITE_CONVEX_URL=http://127.0.0.1:9 \
  vp run build -- --mode verification)
APP_ENV=test vp run verify
```

`verify` covers formatting, linting, all four typechecks, root tests, the
backend harness, agent tests and media tests. Its pass does not include the web
build or browser fixtures. Preserve exact failures and distinguish pre-existing
failures from changes under review; never weaken configuration to get a pass.

## Run and exercise

Choose a fresh run ID and retain the terminal session for this foreground
supervisor. Its receipt records the allocated loopback port and process group:

```bash
python3 .agents/skills/verify-frequency/scripts/control.py launch <run-id>
```

In separate terminal calls, require Doctor, drive the selected journeys, then
clean up after success or failure:

```bash
python3 .agents/skills/verify-frequency/scripts/control.py doctor <run-id>
python3 .agents/skills/verify-frequency/scripts/control.py drive <run-id> essays
python3 .agents/skills/verify-frequency/scripts/control.py drive <run-id> navigation
python3 .agents/skills/verify-frequency/scripts/control.py drive <run-id> search
python3 .agents/skills/verify-frequency/scripts/control.py cleanup <run-id>
```

Use the helper's fresh browser context, external-request blocking, WebSocket
blocking, action log, ARIA snapshots, screenshots and traces. Inspect archive
and body screenshots. Its `ingest` journey intentionally refuses before opening
a browser: no isolated backend exists in this mode. Port 9 supplies no fake
data. Research loading is not an empty-state pass.

## Persisted local UI journeys

Use the [local Convex workflow](../../../scripts/local-convex/README.md) on Linux
with Docker and a native bridge reachable by the host. It deploys the real
functions/schema/components into an empty instance, with crons suppressed only in
the disposable copy and a synthetic seed/snapshot module. A local-only bootstrap
authenticates a synthetic user; hosted Clerk/JWT verification is outside this
boundary. Backend egress is blocked and browser traffic stays on owned loopback
origins. No checkout `.env` files or inherited credentials are loaded.

After the build/dependency prerequisites above, run from root with a fresh id:

```bash
python3 scripts/local-convex/control.py run local-proof-01
```

`run` performs start, deploy, seed/browser proof and teardown in `finally`. To
inspect between steps, use another fresh id and always stop it afterward:

```bash
python3 scripts/local-convex/control.py start local-proof-02
python3 scripts/local-convex/control.py deploy local-proof-02
python3 scripts/local-convex/control.py exercise local-proof-02
python3 scripts/local-convex/control.py stop local-proof-02
python3 scripts/local-convex/test_control.py -v
```

The receipt records allocated `http://127.0.0.1:<port>` origins, image digest and
source fingerprint. The scripts reject remote targets before reading the generated
local key. UI saves are checked through independent real Convex HTTP table reads;
no adapter or backend response is mocked. Screenshots, traces, synthetic snapshots,
deploy logs and `cleanup.json` remain in `web/artifacts/local-convex/<id>/`.
Require cleanup to remove the owned container/volume/network, stop relay listeners,
and remove local credentials. A retry or source edit requires a new run.

The four journeys cover URL-only admission/dedupe, source-text recovery, manual
hypothesis → recipe → composition → Listening Session with lineage readback, and
feed creation/disable. They do not prove automatic capture/extraction, generators,
real audio/media/renderer operation, signers or publication. Extend coverage
explicitly; do not promote an entire feature from one saved row.

## Component fixtures

Run the existing isolated fixture suites from `web/`. Each starts its own
strict-port server and refuses an existing listener; run them sequentially.
These import actual components/routes over synthetic adapters, not the full
authenticated app or a persisted database:

```bash
APP_ENV=test vp exec playwright test --config playwright.ui.config.ts --reporter=list
APP_ENV=test vp exec playwright test --config tests/listen/playwright.config.ts --reporter=list
APP_ENV=test vp exec playwright test --config tests/auth/playwright.config.ts --reporter=list
APP_ENV=test vp exec playwright test --config tests/feedback/playwright.config.ts \
  feedback.spec.ts --workers=1 --max-failures=1 --timeout=8000 --reporter=list
```

The feedback fixture is known to fail at the audit baseline: its adapter lacks
`createAction`, imported by the real Listen page through studio comparison.
The separately authorized repair is [PR #188](https://github.com/Resonant-Projects/frequency-music/pull/188), still unmerged.
Preserve the baseline finding until that repair lands. Do not patch
the adapter during an audit. The optional `screenshots.spec.ts` uses
`SHOTS_DIR`/`SHOTS_LABEL`; unset values skip screenshots and must not count as
visual proof. An interrupted fixture runner may leave a server: verify exact
command, checkout, PID/start identity and process-group ownership before stopping
only the process it created. Never use `reuseExistingServer:true` to adopt it.

For other feature IDs, use the stage matrix's named tests and manual recipe.
Existing full-pipeline specs in `web/tests/e2e/` are intent/reference only here.
The local backend above supplies an empty deployment, seed and synthetic identity.
Its manual journeys are bounded coverage; report remaining unexercised seams
instead of substituting the live service.

## Pass criteria and report

- **Source inspection:** link model, API, route/component and applicable spec.
  A declared API or route is not execution evidence.
- **Backend/worker proof:** command exits 0, relevant assertions ran, and no
  provider/service was used beyond the test's injected/local boundary. Identify
  skipped suites and mocked seams; do not call this a UI pass.
- **Fixture UI proof:** real controls reach expected states and expected adapter
  calls; expiry, unauthorized, stale, retry, double-submit and loading/error
  states are asserted where applicable. No persistence claim follows.
- **Persisted local UI proof:** real controls save through the real local client;
  independent table reads assert content, ownership and lineage; reload verifies
  readback; no forbidden requests/page errors; teardown receipt passes.
- **Offline UI proof:** Doctor and selected driver exit 0, screenshot/ARIA/action
  evidence survives, no forbidden requests or page errors, and cleanup confirms
  the owned group stopped, listener released and scratch removed.
- **Complete feature (`done`):** every mapped stage and intended entry point has
  evidence at its required boundary. Use `partial` for an implemented but
  unexercised seam or unreachable operation; `missing` for an absent intended
  stage. Keep an intentionally gated feature distinct from a defect.

Record source HEAD, scope, commands, exit codes, relevant output, screenshot
paths and blockers in `docs/evidence/<run-id>/`. Preserve full raw logs locally
and commit compact redacted excerpts with checksums when useful. Do not commit
credentials, session state, captured private data, or the existing essay
helper's ignored screenshots/traces. Link local artifacts explicitly as local;
GitHub readers must have committed textual evidence for a pass claim.

Update the feature map's status/evidence and linked PR/issue column. A gap is
**small-fix** only when an existing contract determines the correction; use
**needs-decision** for gates, unspecified UI exposure, missing runtime isolation,
or scope/acceptance choices. Preserve that classification without implementing
the gap. Follow repository file-size limits by splitting matrices by stage.
