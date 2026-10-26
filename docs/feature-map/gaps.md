# Classified gaps

[Feature map](../feature-map.md) · [Evidence](../evidence/feature-map-20261022/README.md)

The original audit recorded findings and acceptance prerequisites. This follow-up
implements only the authorized bounded fixes and localhost verification workflow;
all other questions remain open. No production state or product gate was changed. **small-fix** means the existing contract determines the correction.
**needs-decision** means the repository leaves a scope, sequencing, acceptance,
or environment choice open. An absent UI for an intentionally operator-only
capability is not automatically a product defect.

## Current local checkpoint, 2026-10-26

[V26 evidence](../evidence/effect-verification-20261026/README.md) at `ca495094`
re-exercises the shipped fixes. G01's Docket targets and desktop/mobile navigation,
G03's 13 feedback/Docket fixtures, and G04's 10 graph-filter fixtures pass. These
specific proof gaps are resolved in the current checkout. PR #188 merged as
`ac1c205f5f587e2a00474111cc94d2af6ccc7258` before the audited source; the
[V26 provenance](../evidence/effect-verification-20261026/README.md#feedback-fixture-source-provenance)
explains the stale skill baseline. G05's four real local
persistence journeys pass with independent table reads and owned teardown; wider
feature coverage remains partial. The old G11 missing-tools boundary is resolved
on this host: all six real-SC tests ran. Missing analysis/ABX and human acceptance
remain unchanged. The rows below preserve the original findings and linked work.

Two follow-ups remain classified without implementation: the preceding CI
reproduction exposed a one-millisecond mixed-clock recovery test flake
(**small-fix**, compare one transaction clock), while starting handler grace at
lease loss is a change to existing execution policy (**needs-decision**). The
current audit passed without altering either test or runtime behavior.

## Small fixes with established intent

Findings describe the original audit baseline; the final column records proof on
the separate unmerged fix branches.

| ID | Gap / affected features | Evidence and bounded next step | Linked PR / issue |
| --- | --- | --- | --- |
| G01 | Navigation proof lags the shipped Docket entry (A02). | `app-navigation.ts` includes `/docket`, but the guarded driver's Compose list omits it. Add the existing link to the assertion set and separately verify each intended destination. Current B2 proves menu visibility plus desktop/mobile **Essays** transitions, not all destination workflows. | [fix #200](https://github.com/Resonant-Projects/frequency-music/pull/200): 9 guarded actions and 2 affected navigation tests pass; destination workflows remain separate. |
| G03 | Audio feedback/Docket fixture cannot load (M07–M09, O04). | F1 reproduces `convex-fixture.ts does not provide an export named 'createAction'`. The real Listen route now imports `studio-comparison.tsx`, which imports that adapter function; fixture has no export. The repair branch exports the action factory, supplies the mounted studio list queries and passes all 13 behavior tests using the real routes. Studio upload behavior and optional feedback screenshots were not exercised. | [fix #188](https://github.com/Resonant-Projects/frequency-music/pull/188): missing export reproduced; all 13 real-route behavior tests pass over the repaired adapter. No studio upload claim. |
| G04 | Agent Runs filter lists two of nine registered graphs (O01). | `web/src/routes/agent-runs.tsx` has only research-pipeline and weekly-brief; shared `KNOWN_GRAPH_NAMES` and worker registry include seven more. The unfiltered list is not evidence those graphs are hidden, but users cannot select them in this filter. Derive display choices from the existing registry with labels. | [fix #201](https://github.com/Resonant-Projects/frequency-music/pull/201): shared registry drives all nine choices; 10 browser tests verify options and list/count arguments. |
| G12 | Setup and verification prose has stale specifics (R03, R08, S04, M09). | Root README still names UploadThing and `extract_v2`; current PDF capture stores `sources.pdfStorageId` in Convex, and extraction uses shared `extract_v3`. Plan 13 says generation is a CLI ritual, but `/recipes` now calls `generateFromHypothesis`. `settings.ts` comments still mention a Saturday reconcile cron that `crons.ts` no longer registers. Reconcile these facts without revising product policy. | [docs #202](https://github.com/Resonant-Projects/frequency-music/pull/202): storage/prompt/setup/current UI and narration facts reconciled; no policy change. |
| G14 | Verification skill run path disagrees with its installed directory. | `.agents/skills/verify-frequency/scripts` now links to the single guarded helper; all commands use that path. Launch, Doctor, navigation and cleanup pass. | Direct commit in [PR #185](https://github.com/Resonant-Projects/frequency-music/pull/185); [path evidence](../evidence/feature-map-gap-fixes-20261022/skill-path.md). |

## Decisions and prerequisites retained

| ID | Gap / affected features | Existing intent, constraint and next decision | Linked PR / issue |
| --- | --- | --- | --- |
| G02 | Recipe approval-to-draft loop and promoted editing/status controls absent (S04–S05, O06). | `recipe-detail.tsx` has no recipe mutations; `recipes.update/updateStatus` exist; hypothesis approval does not reserve/schedule a recipe draft. Plan 13 explicitly waits on plan 008. Honor that ordering; confirm gate satisfaction before implementation. Plan 13's “approve/deprecate” prose also needs translation to the actual `draft/in_use/archived` vocabulary and legal transitions. The audit does not choose them. | [#189](https://github.com/Resonant-Projects/frequency-music/issues/189) — grilling; intent/options/open decisions recorded, none selected. |
| G06 | Operator/external capabilities have no product UI (R05–R06, O03/O05/O07). | Notion ingress, scout enqueue, cron/worker lifecycle, auth-failure counters, maintenance/backfill, eval/export/deployment/recovery tools are explicit operational surfaces. `authFailures.summary` has no web caller. Decide which, if any, need human UI exposure; do not expose secrets, schedulers or destructive tools merely to make every API clickable. Source API existence alone does not establish a promised admin screen. | [#191](https://github.com/Resonant-Projects/frequency-music/issues/191) — grilling; intent/options/open decisions recorded, none selected. |
| G07 | Passage retrieval has no UI or generator consumer; steering remains deferred (R14, O06). | The bounded search tool/index exists and tests pass, but no graph/generator consumes `searchSourcePassages` and the search palette does not call it. Plan 15 distinguishes foundation from later hypothesis/recipe context. Semantic-quality probes and keep-enabled decisions are dated operator acceptance items, not verified here. Generator model/prompt/scope controls are explicitly deferred in the decision log. | [#192](https://github.com/Resonant-Projects/frequency-music/issues/192) — grilling; intent/options/open decisions recorded, none selected. |
| G08 | Starter kits stop at CLI/local files and recipe metadata (M04). | The accepted implementation is CLI-first. Offline generator tests produce files, but recipe detail neither renders `starterKit` metadata nor offers downloads. Decide whether a UI handoff is intended and how files are served; do not invent an upload/download service. Real studio load/audible correctness remains human acceptance. | [#193](https://github.com/Resonant-Projects/frequency-music/issues/193) — grilling; intent/options/open decisions recorded, none selected. |
| G09 | Rendering and decision automation retain human/operator gates (M05/M08, S11, O04). | `renders.setPlan/request` have no web caller. Study families require `renderValidation=go`; human studio comparison and go/no-go are still distinct from pitch correctness. Signer/channel configuration, docket preparation and tournament enablement default closed in test config; this audit did not read live values or enable anything. Decide acceptance and intended UI admission before exposing/starting these operations. | [#194](https://github.com/Resonant-Projects/frequency-music/issues/194) — grilling; intent/options/open decisions recorded, none selected. |
| G10 | Narration availability and first house-voice side effect need separate acceptance (S08, M09–M10). | Weekly Turns remain text; there is no automatic weekly narration call or reconcile cron. Explicit first `settings.setHouseVoice` still schedules a 14-day `episodes.reconcile`, covered by tests. Choosing a voice is therefore not a harmless settings proof. Current essay narration is a capped operator workflow, not an essay-reader control. Confirm desired product behavior before changing this path; do not enable/call TTS to audit it. | [#195](https://github.com/Resonant-Projects/frequency-music/issues/195) — grilling; intent/options/open decisions recorded, none selected. |
| G11 | Later render analysis/ABX stages absent (M05/M11). | Spec describes an `analyze` roughness job, but shared job kinds and handler registry contain only probe/narrate/shootout/assembleEpisode/litmusRender. A–D study-family labels do not implement ABX's X stage. All six development hosts now pass the six required real SuperCollider tests with zero skips: MacBook-Max, devbox, macpro, mac-mini, ubudesk, and tac / AI-5090-01. [2026-10-26 evidence](../evidence/supercollider-tests-20261026.md) records native versions, measurements, and the macOS fixes. CI prerequisite changes are prepared locally; hosted CI has not run. Keep later analysis/listening-fitness work behind its existing design/validation decisions. | [#196](https://github.com/Resonant-Projects/frequency-music/issues/196) — grilling; intent/options/open decisions recorded, none selected. |
| G13 | Research-pipeline extract/critique/archive specialists intentionally stop (O07). | Conditional routes go to `unsupportedWriteRouteNode`, which records an explicit stop instead of specialist writes. The two draft-producing routes are separate. Decide whether to activate those specialists and their contracts; do not interpret successful graph finalization as completed extraction/critique/archive. Recovery/deployment tools also remain operational, not UI requirements. | [#197](https://github.com/Resonant-Projects/frequency-music/issues/197) — grilling; intent/options/open decisions recorded, none selected. |

## Local proof environment implemented

| ID | Resolution | Remaining proof boundary | Linked PR / issue |
| --- | --- | --- | --- |
| G05 | The authorized throwaway localhost Convex workflow deploys real functions/schema/components, supplies synthetic seed/identity, and removes owned resources and local credentials. | Four browser journeys prove selected manual saves through independent database reads. Hosted authentication, automatic/generator/media stages and unexercised controls remain unproved. This is now coverage work, not an environment decision. | [Local workflow PR](https://github.com/Resonant-Projects/frequency-music/pull/203); [#190](https://github.com/Resonant-Projects/frequency-music/issues/190) closed as superseded; [receipts](../evidence/feature-map-gap-fixes-20261022/README.md). |

## Aspirations that do not define new work

README's user overview mentions followers subscribing/commenting and possible
collaborator drafts. The current schema has visibility/users but no comment or
follower-subscription tables; private podcast subscription is a different,
implemented contract. WebMCP is explicitly deferred in plan 16. Broad roadmap
aspirations and this overview do not settle new social UI, role policy or browser
tool scope. They are **needs-decision**, not silently added features or missing
implementation commitments. Questions are tracked in [#198](https://github.com/Resonant-Projects/frequency-music/issues/198) (social/collaborator scope) and [#199](https://github.com/Resonant-Projects/frequency-music/issues/199) (WebMCP); neither selects an option. See [README](../../README.md),
[schema](../../convex/schema.ts), [plan 16](../plans/2026-10-13-16-webmcp-readiness.md).

Only the linked bounded fixes and local workflow were authorized. Open issues
remain decisions, and dated historical deployment statements are not fresh runtime observations.
