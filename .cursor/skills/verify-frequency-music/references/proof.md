# Frequency Music verification proof

This skill proves the real **offline local UI**, not Clerk authentication, Convex data, persistence, media output, or a deployed production journey. It reuses the existing client auth bypass and committed essay corpus; it supplies no mocked backend response.

## Publication provenance

Publication is isolated on `docs/verify-frequency-music`, based on freshly fetched `origin/main` at `5966c77051f2604146623ea3250c397cca1cb3d2`. The original checkout, its branch and untracked skill remain untouched. Only this canonical skill and the relative `.agents/skills/verify-frequency-music` discovery link belong in the PR.

All paths below are repository-relative. Helper paths resolve from the canonical script, including when invoked through the discovery symlink. Machine-specific repository, scratch, process, port, and commit values belong in ignored receipts and the PR verification report, not portable instructions.

The preflight run `publication-preflight` completed launch, Doctor, the mapped `essays` feature, evidence capture and cleanup on the fetched base with the final helper implementation. Doctor and essays exited 0. The essay journey recorded 25 actions, 1,046 HTTP requests, zero unhandled page errors and zero attempted external requests. The owned process group stopped, port was released and scratch removed while evidence survived.

The publication acceptance run uses `publication-final` **after committing**, so `instance.json.head` identifies the exact delivered commit rather than the earlier base. The PR reports its real command outcomes and absolute evidence locations. Read receipts to resolve the actual port, process identity, source hash and Git HEAD; do not reuse the preflight URL or count it as exact-commit proof.

```bash
./.cursor/skills/verify-frequency-music/scripts/control.py launch publication-final
./.cursor/skills/verify-frequency-music/scripts/control.py doctor publication-final
./.cursor/skills/verify-frequency-music/scripts/control.py drive publication-final essays
./.cursor/skills/verify-frequency-music/scripts/control.py drive publication-final navigation
./.cursor/skills/verify-frequency-music/scripts/control.py drive publication-final search
./.cursor/skills/verify-frequency-music/scripts/control.py drive publication-final ingest
./.cursor/skills/verify-frequency-music/scripts/control.py cleanup publication-final
```

Launch is a foreground supervisor started using a background-capable terminal tool. Always run cleanup, including after a failed drive. `ingest` is an intentional nonzero refusal, not an acceptance failure for the offline mode: it skips Doctor and refuses before opening a browser because no approved isolated backend/write identity exists.

## Safety/provenance review correction

All four review findings on the original publication head were reproduced or traced against the current helper. The added regressions first failed for stale Doctor passes, omitted shared inputs, missing-executable scratch, unreceipted descendants and leader-exit descendants. The corrected helper keeps the direct child unreaped until its process group drains, covers startup in `finally`, defers signals across resource assignment without blocking signals in the child, and records supervisor teardown. Doctor invalidates an old pass before preflight and only records a new pass after Chromium succeeds. Fingerprints include shared contracts, helper sources, build configuration and nonignored new input files, excluding run evidence and Python caches.

The correction acceptance run is `review-final-v2`, with the committed correction HEAD in `instance.json`. The initial `review-final` browser journeys passed, but its concurrent explicit cleanup exposed macOS `killpg` returning EPERM for an already drained group; a regression now requires proof of an empty group before treating that error as benign. Repeat launch, Doctor, essays, navigation, search, intentional ingest refusal and cleanup with that ID. The separate `review-leader-exit` run starts the real frontend, terminates only its recorded launcher leader and verifies descendants/listener/scratch disappear. Exact-head gate logs and real outcomes remain in ignored evidence and the PR report; this document does not assert future runs passed. No live backend coverage is added.

The subsequent Codex review identified five further helper gaps: backend-port WebSocket forwarding, pass receipts preceding trace teardown, navigation entry checks already at their destination, missing mobile-collapse assertions and missing post-browser source checks. The correction closes backend sockets locally, finalizes trace/browser before writing pass, enters Essays from a real detail route with target/URL/collapse assertions, and invalidates feature receipts on post-run provenance mismatch. These have dedicated helper regressions; mocks/fixtures remain helper tests, not app proof. The final acceptance run is now `review-final-v3`; its ignored exact-head receipts and PR report supersede earlier runs for delivery provenance.

## Evidence contract

Evidence is local-only under `.cursor/skills/verify-frequency-music/evidence/`; its committed `.gitignore` excludes every artifact except the ignore file itself. Python caches are also ignored. Screenshots, traces, action logs, runtime receipts, keys and browser session state must never enter the commit. Receipts contain only the three explicit nonsecret Vite flags, not an environment dump. No session state is imported or exported.

Within `evidence/publication-final/`, require:

- `instance.json`, `launch.log`, `doctor-process.json`, `doctor-result.json`.
- `essays-actions.jsonl`, `essays-result.json`, `essays-console.json`, `essays-trace.zip`.
- `essays-01-archive.png`, `essays-03-detail.png`, `essays-11-expanded-archive.png`, `essays-16-mobile-entry.png`, `essays-25-not-found.png`, and matching `.aria.txt` files.
- Navigation/search results, action logs, traces and screenshots for their local subsets.
- `ingest-result.json` documenting the refusal without a browser trace.
- `cleanup.json` and `after-cleanup.json`: removed scratch, absent process/listener, parsed feature results and action counts, nonempty PNG/ARIA pairs and valid ZIP traces.

Runtime logs and source-fingerprint receipts are the source of truth. Visually inspect an archive and full essay screenshot before handoff. Evidence retained in a scratch worktree is subject to scratch expiration; copy it to a durable local ignored evidence directory before removing the worktree. That copy is not a new run and retains the original worktree provenance. Local evidence is not automatically published or backed up by Git.

The essay journey covers latest/archive/newly revealed/related cards, rendered body, detail reload, pagination and focus, desktop/mobile menu entry, all three search controls, a local essay search result, back links, and an unknown slug. Navigation proves local menu links and keyboard access, not destination backend data. Search proves the shipped local subset; backdrop dismissal, shortcut toggle, keyboard result activation and full live research search remain additional unexecuted recipes unless separately reported.

## Validation and scope

Pre-publication checks on current main plus the skill:

- `python3 .cursor/skills/verify-frequency-music/scripts/test_control.py -v`: 8 offline safety/contract tests passed. The new ingest-before-Doctor regression test first failed on the copied implementation and passed after the helper fix. Mocks in these helper tests are not application proof.
- `node --check .cursor/skills/verify-frequency-music/scripts/drive.mjs`: exit 0.
- `vp exec biome format .cursor/skills/verify-frequency-music/scripts/drive.mjs`: exit 0, no fixes.
- `vp run format:check`: exit 0; existing bibliography-size warning remains.
- `vp run verify`: initially exit 1 because `media/node_modules/.bin/vp` was missing in the fresh worktree. After frozen installs in root, web, agent and media, and ordinary web launch/Panda generation, **exit 0**: format, lint, all four typechecks and all repository test suites passed. Reported suites: 941 convex/scripts, 211 harness, 321 agent and 98 media tests.
- `vp run typecheck:web`: exit 0 after Panda generation. The older checkout's Node-module TS2307 blocker is not reproduced on fetched current main with its own dependencies. No product source/configuration change was made to address it.
- `vp run lint:check`: exit 0 with existing type-assertion warnings.
- `(cd web && vp run build -- --mode verification)` with the same three inert Vite flags: exit 0; existing large-chunk warning remains.
- `git diff --check`: exit 0.

Full validation and browser acceptance are repeated on the committed publication head before push. Ignored `evidence/publication-checks/` holds pre-publication command logs; the final run holds exact-commit logs and command exit receipts.

The matching Chromium is provided by `(cd web && vp exec playwright install chromium)`. All four package installs use `vp install --frozen-lockfile`; manifests and lockfiles remain unchanged. No 1Password sign-in, credential reads, Convex migration/deploy/codegen, data seeds, authenticated live E2E suite, extraction, publication, or paid model/media operation is required or performed by this UI proof.

The browser permits only read-only HTTP traffic and WebSocket connections to its owned frontend. Backend WebSockets to loopback port 9 are closed locally without connecting to a server, regardless of what may be listening there. It aborts HTTP writes and other destinations before dispatch, then asserts no forbidden request attempts or unhandled page errors. Port 9 is not a backend fixture; connection warnings do not establish a completed live-search empty state.

## Source grounding

The original generator used these upstream references:

- [Pstack create-verification-skill](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/create-verification-skill/SKILL.md).
- [Feature map index](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/create-verification-skill/references/feature-map-example/README.md).
- [Feature recipe](https://raw.githubusercontent.com/cursor/plugins/main/pstack/skills/create-verification-skill/references/feature-map-example/search.md).

Repository sources:

| Recipe or constraint | Sources |
| --- | --- |
| Commands and separate packages | `AGENTS.md`; root and package `package.json` files |
| Existing client flags and required backend URL | `web/src/main.tsx`; `web/src/router.tsx`; `web/.env.schema` |
| Corpus, ordering and lazy bodies | `web/vite.config.ts`; `web/src/lib/essays.ts`; `web/src/lib/essay-parse.ts`; `docs/essays/*.md` |
| Archive size, Show more focus and detail handles | `web/src/routes/essays.tsx`; `web/src/routes/essay-detail.tsx`; `web/src/components/essay-card.tsx` |
| Navigation and search | `web/src/lib/app-navigation.ts`; `web/src/components/app-navigation.tsx`; `web/src/components/site-search.tsx`; `web/src/components/site-search-results.tsx`; `web/tests/e2e/navigation.spec.ts` |
| Ingest and live-test risks | `web/src/routes/ingest.tsx`; `web/playwright.config.ts`; `web/scripts/start-dev-for-e2e.sh`; `web/tests/e2e/global-setup.ts`; `web/tests/e2e/cleanup.ts` |

Use `/maintain-verification-skill` when routes, corpus pagination, user entry points or backend prerequisites change.
