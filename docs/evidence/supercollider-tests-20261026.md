# SuperCollider test prerequisites and fleet verification

Verified on October 26, 2026. All six documented development hosts have the
native prerequisites and pass all six required real-render tests with zero
skips. No host remains blocked. This packet records pre-publication verification;
hosted CI and publication results are tracked by the accompanying PR.

## Recovery and source identity

Recovered both uncommitted patches from
`/tmp/frequency-supercollider-handoff-20261026`. Every file passed the bundle's
SHA-256 manifest before application. The Frequency checkout was clean at the
exact source base, `7eba9c8974767dc937aa90081e2d3b23c0d3b3ff`. The clean
personal-config checkout had advanced to
`b607de16bc11567db1fa74de247e3a71846cc8d0`; its patch applied without conflicts.
Neither repository was committed or pushed.

The original suite reported six skipped tests and exit 0 on ubudesk because
`sclang` and `scsynth` were absent. The recovered patch makes missing tools fail
with their names and a setup link. Its controlled missing-tools failure and
original Linux verification logs remain in the handoff bundle. No audio
assertion was weakened.

The original verification archive has SHA-256
`4568bebbd0e5ee352649dbf876c21726d9ae4d4d443a15acd910910ab639258d`.
The final archive has SHA-256
`d843e1f8ce9410f129b6bb1d9c85f736a5cf210ea963dc345fcfe9acf69d829e`.
Comparing every archived file found exactly one changed file,
`media/src/engines/sc/process.ts`, for the native macOS Qt fix below. No files
were added or removed. Every final host run checked the final archive's hash.

## Fleet results

| SSH target | Confirmed identity and OS | FFmpeg / ffprobe | SuperCollider | Final tests | Duration | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| local | MacBook-Max, macOS 26.6.2, arm64 | 9.0.2 | 3.14.1 | 6 passed, 0 skipped | 14.07 s | [MacBook-Max](supercollider-20261026/MacBook-Max.json) |
| devbox | devbox, Ubuntu 26.04.1, x86_64 | 8.0.1 | 3.13.0 | 6 passed, 0 skipped | 16.84 s | [devbox](supercollider-20261026/devbox.json) |
| macpro | macpro.rproj.art, macOS 15.7.9, x86_64 | 9.0.1 | 3.14.1 | 6 passed, 0 skipped | 39.78 s | [macpro](supercollider-20261026/macpro.json) |
| mac-mini | rproj-mini.rproj.art, macOS 26.6.2, arm64 | 9.0.2 | 3.14.1 | 6 passed, 0 skipped | 15.14 s | [mac-mini](supercollider-20261026/mac-mini.json) |
| ubudesk | ubudesk, Ubuntu 26.04.1, x86_64 | 8.0.1 | 3.13.0 | 6 passed, 0 skipped | 15.29 s | [ubudesk](supercollider-20261026/ubudesk.json) |
| ai-5090-01 | AI-5090-01, Ubuntu 24.04.3, x86_64, also known as tac | 6.1.1 | 3.13.0 | 6 passed, 0 skipped | 15.86 s | [tac / AI-5090-01](supercollider-20261026/ai-5090-01.json) |

MacBook-Max, devbox, macpro, and mac-mini completed the focused installer's dry
run, install, check, and repeat-install check. ubudesk and AI-5090-01 retained
their existing installations, passed read-back checks, and reran all six tests.
The legacy `tac` SSH route failed authentication from the Mac and timed out from
ubudesk. The Mac's existing trusted `ai-5090-01` alias reached AI-5090-01 and
completed verification. Host-key checking stayed strict throughout.

All final runs used fresh temporary verification directories and the same
archive. Each directory contained only the bundled media sources, tests,
manifest, lock, config, and shared contracts, plus installed dependencies, a
minimal ESM root manifest, and a root dependency symlink. No application
environment files, credentials, or Git checkout were copied. Tests ran as the
normal user with native tools on PATH:

```sh
cd media
vp install
APP_ENV=test SC_EVIDENCE_PATH=/absolute/path/to/render-evidence.json \
  ./node_modules/.bin/vp test tests/sc-real.test.ts --reporter=verbose
```

The per-host JSON files retain identity, tool paths and versions, source and
archive hashes, dependency-install and test exit statuses, verbose test output,
and every exported measurement. Raw installation logs, failed Mac runs,
read-back logs, archives, original handoff, and full verification logs are also
retained on MacBook-Max under
`~/Library/Logs/frequency-supercollider/20261026/`.

## Native macOS corrections

Native installation exposed differences that the earlier Linux simulation
could not establish:

- SuperCollider 3.14.1 stores `sclang` in `Contents/MacOS` and `scsynth` in
  `Contents/Resources`. The installer now checks both locations.
- Invoking `sclang` through the original symlink failed class-library
  compilation. Executing the real app path compiled successfully. The installer
  now creates executable launchers in `~/.local/bin` that execute the actual app
  binaries. It preserves existing commands and refuses to replace local files
  or dangling links. Only symlinks created by this rollout were removed before
  the corrected install.
- The app bundles Qt's `cocoa` platform plugin and lacks `offscreen`. The
  original renderer failed all six Mac tests before synthesis. The renderer
  now selects `cocoa` on macOS and retains `offscreen` on Linux. The same
  unmodified six audio tests then passed on all three Macs and all three Linux
  hosts.

The renders remain offline and use private temporary homes. They require no
audio device, running SuperCollider service, production connection, or secret.

## Measurements and repository verification

On every host, the three bounded kits measured -18.0 LUFS. Their master true
peaks were -10.9, -10.7, and -11.0 dBTP. All six tuning fundamentals reported
0.000 cents error at the estimator's resolution, within the required 0.5 cents.
Onset and offset-search assertions passed. The dense fixture rendered 4,096
notes with 3,072 concurrent voices using 4,096 node slots. The two-member job
handler test passed with an injected tool client and real local renders. These
checks establish synthesis, tuning, audio-policy, and handler behavior.
Listening fitness and later analysis/ABX stages remain separate work.

After native fixes, `PATH="$HOME/.local/bin:$PATH" APP_ENV=test vp run verify`
exited 0 on MacBook-Max. Formatting, lint, all four package typechecks, 1,626
root tests, 234 harness tests, 439 agent tests, and 147 media tests passed.
Total: 2,446 tests passed with no skips. Dependency installs used the existing
lockfiles, and web's local Panda codegen completed before typechecking. Existing
lint, Panda, SDK deprecation, and timeout warnings did not fail verification.

Shell syntax, ShellCheck, Ruby parsing, and native `brew bundle list` passed for
the personal-config changes. Repeat installation preserved the MacBook-Max
launchers byte-for-byte. Native setup and tests also passed on Intel macOS.

## CI and publication state

The media CI job now installs
`ffmpeg supercollider-language supercollider-server` using noninteractive apt.
The workflow YAML parses, and actionlint passes when supplied the existing
custom runner labels `incus`, `garm`, and `ephemeral`. Plain actionlint reports
only those unregistered labels. No hosted CI workflow was dispatched.

At evidence capture, Frequency and companion personal-config changes were local
and uncommitted in their separate Mac checkouts. No push, PR, merge, production
deployment, or live media job had occurred. A hosted media CI run with all 147
tests and zero skips is the publication-time proof tracked by the PR.
