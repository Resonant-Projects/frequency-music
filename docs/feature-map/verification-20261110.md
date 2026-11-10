# Weekly verification checkpoint, 2026-11-10 (V10)

[Feature map](../feature-map.md) · [Commands, output and raw-log hashes](verification-20261110-commands.md) · [Skill](../../.agents/skills/verify-frequency/SKILL.md)

Source: `c323b26cdad5952670a7658e40ccaa47329928bb`, identical to fetched
`origin/main` before documentation edits. Node `v26.13.0`; Linux, native Docker
bridge, ffmpeg/ffprobe/sclang/scsynth available. Scope is the verification skill
and feature-map subtree. App, fixture, seed, config and baseline files were not
changed. No production Convex request, migration, deployment, provider call,
publication or external message was used as evidence.

## Verified

- Inert web build: `vp run: 3/3 successful`.
- `APP_ENV=test vp run verify`: **10/10 tasks**, **1,764 root + 234 harness +
  453 agent + 153 media tests**, no skipped media tests. This includes the six
  native SuperCollider cases in `media/tests/sc-real.test.ts`; audible/human
  render acceptance remains separate.
- Focused auth/read/creator/DOI/hypothesis/size/workflow run: **116 tests**.
  Auth-role cases distinguish no-row/follower rejection from admin/collaborator,
  service/system access; Source list tests assert 200 versus service-requested limits.
  The cap applies only where handlers use `ctx.readLimit`;
  `listening.listByComposition` collects without a cap (source inspection).
- Component Playwright suites: **23 UI + 3 playback + 4 auth + 13 feedback/Docket**
  tests. These run real components with synthetic adapters, without persistence.
  #188's old `createAction` import blocker is resolved; GitHub reports it merged
  `2026-10-22T23:00:11Z`.
- Web Node checks: **12 tests** for rating parsing, query-argument equality and
  subscription behavior, using the explicit Node environment command in the skill.
- Local workflow safety: `test_control.py` **20 tests**, full discovery **46**;
  guarded frontend helper **24 Python + 10 Node tests**. Negative-test output
  includes intentionally injected Docker/cleanup errors; both suites exit 0.
- Both automatic and manual local Convex lifecycles: **4/4 persisted journeys per
  run**. Real controls save URL admission/dedupe, missing text, manual
  hypothesis → recipe → composition → Listening Session, lineage and feed
  creation/disable. Independent HTTP table reads and reload assert the saved data.
- Fresh sequential offline run: Doctor, **25 essay / 9 navigation / 9 search
  actions**, no page errors or external requests. Archive and reloaded-body PNGs
  were visually inspected. Both initial and fresh runs have passing cleanup.

## Not verified

- Hosted Clerk/JWT validation, deployed backend state or operator role grants.
  A merge does not establish deployment or migration completion.
- No-row/follower rejection through a real browser. The auth fixture proves
  AuthGate/token behavior over fake SDK/client boundaries; only in-process tests
  exercise the negative writer-role matrix.
- New owner visibility **save**, blank-rating **save**, double-submit guard or
  audio-element preservation through new browser assertions. Their implementation
  was read; Node tests cover rating/query helpers; existing persisted proof uses
  a normal single submit and does not change visibility.
- DOI migration of a real legacy corpus, real publisher/OpenAlex fetches, automatic
  capture/extraction, paid generation, prompt quality, signers, publication,
  hosted TTS/feed playback or deployed CI export/media publication.
- Full embodied/lifecycle controls, all destination workflows, passage consumers,
  starter-kit web handoff, later analysis/ABX and existing gated product decisions.
  Historical partial/missing statuses remain unchanged.

## Synthetic writer role and persisted receipts

The unchanged [seed](../../scripts/local-convex/seed.ts.txt) inserts a `users` row
with `role: "admin"`, then sets its `clerkUserId` to that row's ID. The
[bootstrap](../../scripts/local-convex/seed.mjs) uses the same ID as identity
`subject`. #255's `roleOf` therefore finds the admin row, and `creatorOf` returns
its real users-table ID. Both lifecycle variants pass without an auth bypass
secret or seed repair. That artificial subject mapping is not hosted identity
proof. The seed's old comment about app writes casting a subject is historical;
current create paths use `creatorOf`.

Local artifacts (ignored, not GitHub attachments):

| Run | Owned backend / frontend | Outcome and artifacts |
| --- | --- | --- |
| `upkeep-20261110-auto` | `127.0.0.1:35941` / `:47325` | 4 passed (14.4s); `web/artifacts/local-convex/upkeep-20261110-auto/`: PNGs, snapshots, per-test traces, deploy log, `cleanup.json`. |
| `upkeep-20261110-manual` | `127.0.0.1:35793` / `:35589` | 4 passed (11.0s); same artifact layout under `web/artifacts/local-convex/upkeep-20261110-manual/`. |
| `upkeep-20261110-solo` | Frontend `127.0.0.1:43261`; backend port 9 blocked | `.cursor/skills/verify-frequency-music/evidence/upkeep-20261110-solo/`: action logs, ARIA, traces, PNGs, Doctor and feature receipts; scratch removed and owned group stopped. |

Both persisted `cleanup.json` files report `status: pass`, the named
container/volume/network removed, and `local_credentials_removed: true`.
The image is pinned to
`ghcr.io/convex/convex-backend@sha256:e9c084e8bd6c1f249012c672193f0988c748824f55a24cdad45f6185a8462f9a`;
it reports backend version `unknown`. Both source fingerprints are
`3303aa35fc3887844637d13ebeb998a1006104a9ea45146f53376a769995aceb`.
Only the disposable release suppresses crons and adds the seed/snapshot module;
Docker's internal network blocks backend egress. The generated local credentials
and disposable release are removed. Browser traffic is confined to owned loopback
origins by the existing test harness.

## Command failures and reproduction

**Overlapping offline/persisted workflows (verification gap, small-fix).** The
first offline run overlapped local persistence and fixture servers. Reproduction
sequence from this run:

```bash
python3 scripts/local-convex/control.py run upkeep-20261110-auto
# While that run is active, in another terminal:
python3 .agents/skills/verify-frequency/scripts/control.py launch upkeep-20261110
# In another terminal:
python3 .agents/skills/verify-frequency/scripts/control.py doctor upkeep-20261110
python3 .agents/skills/verify-frequency/scripts/control.py drive upkeep-20261110 essays
python3 .agents/skills/verify-frequency/scripts/control.py drive upkeep-20261110 navigation
python3 .agents/skills/verify-frequency/scripts/control.py drive upkeep-20261110 search
python3 .agents/skills/verify-frequency/scripts/control.py cleanup upkeep-20261110
```

Initial Doctor passed; essays exited 1 on reload:

```text
Locator: getByRole('main').getByRole('heading', { name: 'Representation Debt', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found
```

Navigation/search then exited 1 during Doctor, missing the `Essays` heading.
The failure ARIA snapshots were empty. The foreground Vite log records:

```text
page reload artifacts/local-convex/upkeep-20261110-auto/browser/.playwright-artifacts-0/traces/resources/c8a51b65e954236da74a93632782da4242d0c548.html
changed tsconfig file detected: .../web/artifacts/local-convex/upkeep-20261110-auto/release/tsconfig.json - Clearing cache and forcing full-reload
```

This is timing-sensitive interference, not a deterministic product bug. After
all persisted/fixture work stopped, a **new** run ID (`upkeep-20261110-solo`)
passed Doctor and all three drives (25/9/9), followed by cleanup. The skill now
requires sequential execution of these workflows. No helper/app fix was made;
raw failed receipts remain under the initial run directory.

**Web test discovery/environment (command gap, small-fix).** From `web/`:

```bash
APP_ENV=test vp test src/lib/rating.test.ts src/lib/query-args.test.ts src/integrations/convex/query.test.ts
```

Exit 1 despite `Tests 12 passed (12)`:
`MISSING DEPENDENCY Cannot find dependency 'jsdom'`. The explicit
`--environment node` command passes 12/12, exit 0. The equivalent paths invoked
from root exit 1, `No test files found`, because root include patterns exclude
web. These were additional diagnostic attempts; the skill now supplies the
working Node command. No dependency/config fix was made.

`drive ... ingest` still exits 1 with the expected `BLOCKED` refusal before a
browser opens. Persisted intake belongs to the separate local Convex workflow.
No auth fixture or synthetic-admin write failure was found.

## Changed source contracts and linked work

Source inspection supports these intent/backend/UI descriptions; execution
claims are limited to the named receipts above:

| Features | Source finding | Work |
| --- | --- | --- |
| A01/O05 | [auth](../../convex/auth.ts), [users](../../convex/users.ts), [creatorOf](../../convex/creatorIdentity.ts), [readerQuery](../../convex/readerQuery.ts), [sourceReads](../../convex/sourceReads.ts), [public query ratchet](../../convex/publicQueryAuth.test.ts): writer roles with service/system exceptions, handler-applied reader caps and internal twins (`listening.listByComposition` collects without a cap). Remaining ungated reads are explicitly allowlisted; this is not universal query authentication. | [#255](https://github.com/Resonant-Projects/frequency-music/pull/255) |
| R01/R03/R06 | [shared DOI](../../convex/shared/doi.ts), [dedupe](../../convex/sourceUtils.ts), [creator/resubmit tests](../../convex/creatorIdentity.test.ts): trusted publisher URLs and PDF forms share DOI identity; unsupported IDs/hosts retain URL identity; resubmission patches supplied fields only. | [#254](https://github.com/Resonant-Projects/frequency-music/pull/254), [#255](https://github.com/Resonant-Projects/frequency-music/pull/255) |
| S02/R13/O03 | [workflows](../../convex/workflows.ts), [hypotheses](../../convex/hypotheses.ts), [payload projection](../../convex/hypothesisPayload.ts), [hunter targets](../../convex/correspondenceCandidates.ts), [draft exclusions](../../convex/draftTargetExclusions.ts): workflow extraction/hypothesis retries disabled (full-pipeline recipe generation retains `retry: true`), known-field projection, all linked extractions excluded, daily rotation/28-day rest. | [#255](https://github.com/Resonant-Projects/frequency-music/pull/255) |
| M03/M06 | [feedback](../../web/src/routes/feedback.tsx), [composition detail](../../web/src/routes/composition-detail.tsx), [query adapter](../../web/src/integrations/convex/query.ts): omit blank score; in-flight guard; expandability value; owner visibility; query equality avoids needless subscription recreation. | [#255](https://github.com/Resonant-Projects/frequency-music/pull/255) |
| O07 | [CI](../../.github/workflows/ci.yml), [export](../../.github/workflows/public-editorial-export.yml), [media publish](../../.github/workflows/publish-media-image.yml), [size checker](../../scripts/check-file-tokens.mjs), [package installer](../../scripts/install-packages.mjs), [deploy wrapper](../../scripts/convex-deploy.ts): Node 26/inert build, root typecheck, read-only CI, main-only publication, git-backed size ratchet; root prepare installs child packages. | [#255](https://github.com/Resonant-Projects/frequency-music/pull/255), [#245](https://github.com/Resonant-Projects/frequency-music/pull/245), [#233](https://github.com/Resonant-Projects/frequency-music/pull/233) |

Effect v4 and required native SuperCollider rendering were already recorded in
V26/[#229](https://github.com/Resonant-Projects/frequency-music/pull/229)/
[#227](https://github.com/Resonant-Projects/frequency-music/pull/227); this audit
rechecks their local aggregate boundary rather than declaring a new feature.

Inventory was re-enumerated using `^export const (\w+) =
(query|readerQuery|mutation|action)\(` across non-test `convex/*.ts`: **46 modules /
249 public declarations**, including **9 readerQuery declarations** and new
`users.viewer`. The corpus still has **413** top-level Markdown essays.

Existing grilling issues remain linked in the parent map/gap ledger:
[#189](https://github.com/Resonant-Projects/frequency-music/issues/189),
[#191–#199](gaps.md#decisions-and-prerequisites-retained). None is resolved by
this checkpoint. No new product/UI decision was selected or issue opened.
