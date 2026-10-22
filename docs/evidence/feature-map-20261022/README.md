# Feature verification evidence — 2026-10-22

Source baseline: `a9b728466f9254938e40761e012451b4d896825b`, branch
`docs/feature-map`, Linux host. The audit PR changes documents and a local
skill only. These results describe local code at that baseline, not a deployed
service. No production data, credentials or paid providers were used.

[Feature status map](../../feature-map.md) ·
[Classified gaps](../../feature-map/gaps.md) ·
[Verification skill](../../../.agents/skills/verify-frequency/SKILL.md)

## Results and exact proof boundaries

| ID | Result | Evidence | What it establishes |
| --- | --- | --- | --- |
| E0 | Four frozen installs + browser install, exit 0 | [setup output](checks.md) | Fresh package setup; lockfiles unchanged. |
| E1 | Web build, exit 0 | [build output](checks.md) | Panda assets and production frontend bundle compile with inert flags; existing >500 kB chunk warning. |
| V | `APP_ENV=test vp run verify`, exit 0 | [aggregate output](checks.md) | Format/lint, four typechecks, 1,620 root + 234 harness + 430 agent + 141 media tests; six real-SC tests skipped. **2,425 tests passed**. |
| U1 | 13 browser tests passed | [review fixture output](review-fixture.md) | Four draft deep-link/history/focus tests and nine immutable-intent/binding tests over synthetic adapters. |
| U2 | Three browser tests passed | [target-audio output](target-audio-fixture.md) | Authorized playback-query/player wiring and target changes; empty/error/revoked stale-player handling. No audible file proof. |
| U3 | Four browser tests passed | [auth output](auth-fixture.md) | Real Clerk SDK adapter/AuthGate over fake clerk-js: signed-in/out, token template, sign-out and load failure. No hosted login. |
| B1 | Guarded essays journey, exit 0 | [browser receipts](browser-journeys.md) | 25 real UI actions over committed corpus, bodies/pagination/related/mobile/search/missing slug; no page errors/external requests. |
| B2 | Guarded navigation, exit 0 | [browser receipts](browser-journeys.md) | Eight actions: grouped links, keyboard focus, desktop/mobile Essays transitions. Docket assertion absent; other destination workflows not proved. |
| B3 | Guarded local search, exit 0 | [browser receipts](browser-journeys.md) | Nine actions: all three entry controls, local page results, selection reset/Escape. Research-search integration unproved. |
| B4 | Ingest refused, exit 1 expected | [refusal output](browser-journeys.md) | Guardrail rejects live/shared backend writes before browser launch. **Not** a successful ingest. |
| F1 | Feedback browser fixture failed, exit 1 | [complete failure output](feedback-blocker.md) | Missing mock `createAction` export prevents route initialization; one failed, 12 not run in bounded reproduction. |
| C | Owned server cleanup, exit 0 | [cleanup receipt](browser-journeys.md) | Port released, process group stopped, scratch removed, 85 evidence files preserved. |

The 20 passing browser fixture tests are separate from V's 2,425 tests. V does
not run these browser suites, so its success does not contradict F1. Test
assertions are local/injected; no full persisted ingest-to-listening journey
was run. Rows with only source inspection remain partial/missing in the map.

## Install, build and run

Run from the repository root. Each package owns its dependencies/configuration.
This checkout initially had none installed:

```bash
vp install --frozen-lockfile
(cd web && vp install --frozen-lockfile)
(cd agent && vp install --frozen-lockfile)
(cd media && vp install --frozen-lockfile)
(cd web && vp exec playwright install chromium)
(cd web && VITE_AUTH_BYPASS=1 VITE_E2E_MODE=0 \
  VITE_CONVEX_URL=http://127.0.0.1:9 vp run build -- --mode verification)
APP_ENV=test vp run verify
```

The build performs Panda generation, needed before the web typecheck. The
media tests used installed local `ffmpeg/ffprobe`; `sclang/scsynth` were absent.
Manifest package manager is Bun 1.4.2; install output reported Bun 1.4.3 on this
host. Frozen installs and checks succeeded, and no version/lockfile was changed.

Launch the actual app using the existing supervised offline helper:

```bash
python3 .cursor/skills/verify-frequency-music/scripts/control.py launch <fresh-run-id>
```

Keep that foreground session alive. Read its receipt for the allocated port;
do not reuse this audit's now-released port. In separate calls:

```bash
python3 .cursor/skills/verify-frequency-music/scripts/control.py doctor <fresh-run-id>
python3 .cursor/skills/verify-frequency-music/scripts/control.py drive <fresh-run-id> essays
python3 .cursor/skills/verify-frequency-music/scripts/control.py drive <fresh-run-id> navigation
python3 .cursor/skills/verify-frequency-music/scripts/control.py drive <fresh-run-id> search
python3 .cursor/skills/verify-frequency-music/scripts/control.py cleanup <fresh-run-id>
```

The helper's existing metadata says macOS; its POSIX lifecycle/Doctor/drivers
also completed successfully on this Linux host. This audit does not revise its
supported-platform contract. The new skill documents the observed Linux run
without altering that helper.

For isolated browser suites, run from `web/` with the exact commands in U1–U3
and F1. Their strict ports are 4186, 4187, 4188 and 5192. Do not adopt existing
listeners. They start real fixture servers without the app bootstrap/production
Convex client; U3 uses fake clerk-js and locally fulfills the sign-in redirect.

## Blockers and exclusions

- **Pre-existing fixture blocker:** F1 is present on baseline application/test
  source; no test or runtime source changed. Repair is G03, not performed here.
- **Pre-existing host limitation:** six real-SC cases skip without
  `sclang/scsynth`. Local audio-processing/injected-renderer tests passed.
- **Missing full-app isolation:** there is no general local Convex fixture,
  synthetic seed and worker/identity lifecycle covering every UI stage. Existing
  `web/playwright.config.ts` uses hosted Clerk plus a shared writable backend,
  so it was inspected but never run. UI persistence proof remains blocked by
  that environment boundary, not by an inferred product failure.
- **Existing gates:** recipe loop baseline, render studio/go-no-go, signers,
  tournament/docket activation, semantic passage probes and generator follow-ons
  remain decisions documented in the gap ledger. No gate was changed or live
  value inspected.
- **Build warning:** large frontend chunks remain; build exited 0. No chunk
  redesign or performance claim is part of this audit.

Never run Convex `dev/deploy/codegen/run`, `agent worker`, media `start`,
operator extraction, live eval/export or narration commands merely to make a
status green. No backend was seeded, no queue was polled, and no private feed
or media was fetched. Registry/API inspection and in-process tests do not
require production access.

The final aggregate run and document/skill checks are recorded in [final validation](final-validation.md).

## Evidence retention

Committed Markdown preserves commands, exit codes and relevant output.
`command-log-manifest.json` hashes full local command logs in
`scratchpad/feature-map-20261022/`.
`browser-journeys-manifest.json` and `browser-receipts-manifest.json` hash the
existing helper's local ignored output under
`.cursor/skills/verify-frequency-music/evidence/feature-map-20261022/`.
Screenshots/traces are explicitly local-only; remote PR readers can assess
the committed command output without possessing them. Checksums are provenance,
not a substitute for the output itself.

Selected archive/body screenshots were visually inspected. T3's collaborative
preview independently rendered the local archive. All app/fixture processes
created for the run were stopped; browser proof files and traces survived.
