# Feature-map follow-up evidence — 2026-10-22

[Feature map](../../feature-map.md) · [Gap ledger](../../feature-map/gaps.md)

Every fix remains unmerged. Evidence below is scoped to its named branch; the audit
branch does not silently integrate those product/test changes. No production
endpoint, administrative key, configuration or data was used.

## Independent fixes

| Gap | Branch / head | PR | Commands and selected output |
| --- | --- | --- | --- |
| G03 | `fix/audio-feedback-fixture` / `4a762fd1` | [#188](https://github.com/Resonant-Projects/frequency-music/pull/188) | Failing adapter restored from main reproduced missing `createAction`; repaired adapter: **13 passed (6.4s)**. |
| G01 | `test/docket-navigation` / `0fb92af1` | [#200](https://github.com/Resonant-Projects/frequency-music/pull/200) | **9** guarded navigation actions, zero page errors/external requests; **2 passed (1.9s)** affected navigation tests; helper safety **24 + 10** tests pass. |
| G04 | `fix/agent-runs-graph-filter` / `66079fb2` | [#201](https://github.com/Resonant-Projects/frequency-music/pull/201) | Before: seven expected options missing. After: **10 passed (3.0s)**, including all nine values reaching list/count queries and clearing to All graphs. |
| G12 | `docs/current-setup-contracts` / `a459c852` | [#202](https://github.com/Resonant-Projects/frequency-music/pull/202) | Read source/schema/route/prompt/cron declarations; confirmed `extract_v3`, `pdfStorageId`, manual recipe action and 14-day first-choice reconcile; no scheduled episode cron. |
| G14 | Direct commit `5477f200` to `docs/feature-map` | [#185](https://github.com/Resonant-Projects/frequency-music/pull/185) | [Own-path launch/Doctor/navigation/cleanup pass](skill-path.md); **8** baseline navigation actions. |
| G05 | `test/local-convex-journeys` / `7e4fe9e2` | [#203](https://github.com/Resonant-Projects/frequency-music/pull/203) | Real local deployment, **4** persistence journeys, **7** safety tests; teardown independently checked. |

Exact focused commands (from `web/` except the guarded driver, which runs at root):

```sh
APP_ENV=test vp exec playwright test --config tests/feedback/playwright.config.ts feedback.spec.ts --workers=1 --max-failures=1 --timeout=8000 --reporter=list
python3 .cursor/skills/verify-frequency-music/scripts/control.py drive gap-docket-20261022 navigation
APP_ENV=test vp exec playwright test --config /tmp/frequency-gap-evidence/navigation.config.mjs
APP_ENV=test vp exec playwright test --config tests/ui/agent-runs.playwright.config.ts --workers=1 --max-failures=1 --reporter=list
```

The navigation temporary config/wrapper and exact output are reproduced in #200's
body. It imports the two affected original tests and blocks outbound requests,
HTTP writes and backend WebSockets; it does not run hosted-auth global setup.
Each PR body contains its exact command output, including full verification.

## L1–L4: real local persistence

The local PR extends the `verify-frequency` skill and includes the start/deploy/
exercise/stop commands and [runbook](https://github.com/Resonant-Projects/frequency-music/blob/test/local-convex-journeys/scripts/local-convex/README.md).
It is based on PR #185 because that branch owns the skill. On the local PR branch,
from root, this command exited **0**:

```sh
python3 scripts/local-convex/control.py run gap-local-owned-scratch
```

Selected exact output:

```text
{"status": "started", "backend": "http://127.0.0.1:42277", "frontend": "http://127.0.0.1:50863", "image": "ghcr.io/convex/convex-backend@sha256:294944b33dc55e8f68b2feda11c5e7b195f7778b9ad2951f1bea2744ad392e5a", "version": "unknown", "internal_network": true}
✔ Deployed Convex functions to http://127.0.0.1:42277
Running 4 tests using 1 worker

(node:524372) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  1 tests/local/journeys.spec.ts:55:1 › URL intake and dedupe persist without requesting generation (2.0s)
  ✓  2 tests/local/journeys.spec.ts:97:1 › recover missing source text through the real Display form (1.4s)
  ✓  3 tests/local/journeys.spec.ts:135:1 › manual hypothesis recipe composition and Listening Session preserve lineage (5.7s)
  ✓  4 tests/local/journeys.spec.ts:283:1 › feed creation and toggling persist without polling (2.0s)

  4 passed (13.6s)
{
  "status": "pass",
  "container_removed": "frequency-verify-gap-local-owned-scratch",
  "volume_removed": "frequency-verify-gap-local-owned-scratch",
  "network_removed": "frequency-verify-gap-local-owned-scratch",
  "local_credentials_removed": true
}
```

Tested runtime source digest: `7ef8650c07b8a0eaa776d78f59f3f0b927f5dc891573112f046d82332a52b90b`.
Image: `ghcr.io/convex/convex-backend@sha256:294944b33dc55e8f68b2feda11c5e7b195f7778b9ad2951f1bea2744ad392e5a`. The backend `/version` reports `unknown`, so the image digest identifies the runtime.

| Journey | Actual saved/control proof | Boundary still unproved |
| --- | --- | --- |
| L1 (R01) | URL-only form save, completion notice, second submission completion and stable Dedupe Key/row identity through an independent table read. | Automatic fetching and extraction. |
| L2 (R07) | Real Display recovery form → text_ready; exact supplied text with coverage/evidence header; block cleared and author preserved. | Archive, access-change and stale-version browser cases. |
| L3 (S01/S04/M01/M02/M03) | Manual Hypothesis cites Source; Recipe links Hypothesis and parameters; Composition links Recipe and becomes rendered; Listening Session links Composition with private synthetic ownership/ratings; reload shows saved notes and composition detail shows lineage. | Remaining lifecycle, revisions, embodied/visibility controls, generator and real listening acceptance. |
| L4 (R04) | Add Feed → independent enabled row; Disable → persisted false; reload exposes Enable. | Polling, external ingress and proposed-feed acceptance. |

These checks use the real App/routes, Convex adapters and local backend, with a
separate HTTP reader for persistence. A synthetic identity is accepted using only
the new instance's local key. Hosted Clerk/JWTs are not tested. The disposable copy
has empty crons and an additional seed/snapshot module; application functions,
schema and components otherwise deploy from source. Backend egress is blocked,
no provider credentials are supplied, and browser requests stay on the three
owned loopback origins. No product gate or publication operation was enabled.

Selected independent table evidence:

```json
{
  "hypothesisSourceIds": [
    "p97dfsm5v9s44xctw38srhnv158gs4wg"
  ],
  "recipeHypothesisId": "n17ayrnbwmwxjyg55jeg96kwk58gr0e5",
  "hypothesisId": "n17ayrnbwmwxjyg55jeg96kwk58gr0e5",
  "compositionRecipeId": "nx73hav2dvfebmrj7pdsttw5058gr6y1",
  "recipeId": "nx73hav2dvfebmrj7pdsttw5058gr6y1",
  "compositionStatus": "rendered",
  "sessionCompositionId": "k97as5fy0xstdj8d2nh82m72498gshgs",
  "compositionId": "k97as5fy0xstdj8d2nh82m72498gshgs",
  "sessionVisibility": "private",
  "sessionCreatedBy": "ps70czszbdyvrxp5c9nwxa1gd98gsm8t",
  "sessionRatings": {
    "bodilyPleasantness": 3,
    "goosebumps": 2,
    "musicality": 3
  },
  "feedEnabled": false
}
```

Offline lifecycle/target/ownership checks, exit **0**:

```sh
python3 scripts/local-convex/test_control.py -v
```

```text
test_clean_environment_carries_no_inherited_credentials_or_urls (__main__.LocalBoundary.test_clean_environment_carries_no_inherited_credentials_or_urls) ... ok
test_deploy_failure_still_tears_down_the_owned_run (__main__.LocalBoundary.test_deploy_failure_still_tears_down_the_owned_run) ... ok
test_docker_is_pinned_to_local_socket_with_no_inherited_secrets (__main__.LocalBoundary.test_docker_is_pinned_to_local_socket_with_no_inherited_secrets) ... ok
test_foreign_docker_label_refuses_cleanup (__main__.LocalBoundary.test_foreign_docker_label_refuses_cleanup) ... ok
test_invalid_run_ids_cannot_escape_owned_directory (__main__.LocalBoundary.test_invalid_run_ids_cannot_escape_owned_directory) ... ok
test_nonlocal_or_ambiguous_origins_refused_before_any_command (__main__.LocalBoundary.test_nonlocal_or_ambiguous_origins_refused_before_any_command) ... ok
test_state_cannot_name_another_checkouts_resources (__main__.LocalBoundary.test_state_cannot_name_another_checkouts_resources) ... ok

----------------------------------------------------------------------
Ran 7 tests in 0.006s

OK
```

Postflight used Docker inspect for the exact owned resource names, socket connects
to the three recorded loopback ports, and file existence checks; all passed:

```json
{
  "container_absent": true,
  "volume_absent": true,
  "network_absent": true,
  "backend_listener_absent": true,
  "site_listener_absent": true,
  "frontend_listener_absent": true,
  "credentials_and_scratch_absent": true
}
```

Eight PNG screenshots, four Playwright traces, four independent snapshots and the
run/cleanup receipts remain in `web/artifacts/local-convex/gap-local-owned-scratch/`.
`06-listening-saved.png` was opened: it shows the real Feedback route and saved
synthetic notes after reload. Artifact sizes and SHA-256 values are committed in
[local-artifacts.json](local-artifacts.json). Binary artifacts remain local/ignored.

## Aggregate checks and limitations

`APP_ENV=test vp run verify` passed on each fix branch. Selected exact final local
PR output (exit **0**):

```text
 ⊘ cache disabled

~/web$ vpx tsc --noEmit ⊘ cache disabled

~/agent$ vpx tsc --noEmit ⊘ cache disabled

~/media$ vpx tsc --noEmit ⊘ cache disabled

$ vp test convex scripts ⊘ cache disabled

 RUN  v5.0.5 /home/kelliott/.t3/worktrees/frequency-music/verify-gap-fixes

(node:541232) Warning: AI SDK Warning System: To turn off warning logging, set the AI_SDK_LOG_WARNINGS global to false.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:541232) [AISDK_DEP_GENERATE_OBJECT] DeprecationWarning: AI SDK Warning: Deprecated: "generateObject". Use generateText with an output setting instead.

 Test Files  141 passed (141)
      Tests  1620 passed (1620)
   Start at  21:35:25
   Duration  40.20s (tests 80%, import 16%, transform 3%, worker 1%)


$ vp test harness ⊘ cache disabled

 RUN  v5.0.5 /home/kelliott/.t3/worktrees/frequency-music/verify-gap-fixes


 Test Files  25 passed (25)
      Tests  234 passed (234)
   Start at  21:36:05
   Duration  4.93s (tests 67%, import 25%, transform 8%, worker 1%)


~/agent$ vp test ⊘ cache disabled

 RUN  v5.0.5 /home/kelliott/.t3/worktrees/frequency-music/verify-gap-fixes/agent


 Test Files  38 passed (38)
      Tests  430 passed (430)
   Start at  21:36:11
   Duration  11.27s (tests 51%, import 43%, transform 6%, worker 1%)


~/media$ ./node_modules/.bin/vp test ⊘ cache disabled

 RUN  v5.0.5 /home/kelliott/.t3/worktrees/frequency-music/verify-gap-fixes/media


 Test Files  16 passed | 1 skipped (17)
      Tests  141 passed | 6 skipped (147)
   Start at  21:36:23
   Duration  33.63s (tests 96%, import 3%, transform 1%)


---
vp run: 10/10 successful. (Run `vp run --last-details` for full details)
```

That output follows the root, web, agent and media typecheck commands. It includes
format/lint/typecheck plus **1,620 root**, **234 harness**, **430 agent**, and
**141 media** passing tests. Six real SuperCollider checks skip because `sclang`
and `scsynth` are absent. Existing lint/Panda/deprecation warnings remain.

Corrected setup/probe failures: missing package dependencies and ignored Panda
output; old image namespace `denied`; internal-network port publishing required
a loopback relay; initial browser expectations missed the recovery provenance
header and full accessible button names. A later browser/report finalization
returned nonzero after printing passing assertions during a host temporary-file
quota failure; that run is not counted. The final workflow owns its scratch,
uses a home-filesystem log, returns 0, preserves evidence and removes scratch.

The broad feature rows remain partial where only their manual-save seam is
proved. Hosted authentication, automatic capture/extraction, model/generator
quality, real audio/media/renderer services, signer/channel operations, publication
and other unexercised UI journeys remain unverified. [#190](https://github.com/Resonant-Projects/frequency-music/issues/190)
is closed with a comment pointing to #203: the environment is implemented rather
than an open decision. All other decision issues retain intent/options/questions.

Final documentation-branch check: `APP_ENV=test vp run verify` exited 0 with the
same 1,620/234/430/141 passing counts, six media skips, and `10/10 successful`.
A local link/inventory check reported 11 Markdown documents checked, no broken
relative links, 47 feature rows, all five fix PRs and eleven issue URLs linked,
and every report under 20,000 bytes. `git diff --check` exited 0 with no output.
