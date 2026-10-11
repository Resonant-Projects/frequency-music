# Remaining dependency upgrades after PR #123

Completed against the merged `main` baseline `662f45e` on 2026-10-11. The four independent packages were inventoried with `bun outdated`; root/media upgrades and web/agent lanes proceeded concurrently. Coupled providers, LangChain packages, Vite Plus aliases, and Three.js types were upgraded together. Registry `latest` tags were used, excluding prereleases. No production deployment or paid inference ran.

## Research and migrations

- [Backend research](dependency-upgrades-backend.md) covers AI SDK 7, provider V4 alignment, Convex components, Kernel, LangSmith, and the test runtime.
- [Web research](dependency-upgrades-web.md) covers Clerk 6, Panda 2, Three.js revision 186, browser testing, fonts, and Vite Plus 1.
- [Agent research](dependency-upgrades-agent.md) covers LangChain/LangGraph/Deep Agents, Codex, provider serialization, security overrides, and the upstream LangSmith peer limitation.

The root and media packages now use Varlock 1.22.0 with its 1Password plugin 2.0.5. Plugin 2 makes service-account tokens internal by default. Frequency uses that token to initialize secret resolution and never reads it from application code, so no schema exception is required. Subprocess tests retain `APP_ENV=test` and inert placeholders. [Plugin changelog](https://github.com/dmno-dev/varlock/blob/main/packages/plugins/1password/CHANGELOG.md), [published plugin requirements](https://registry.npmjs.org/@varlock/1password-plugin/2.0.5).

Biome is 2.5.15 and its schema URL matches. The formatter changed several `test.each` layouts; only the reported active tests were reformatted, and frozen archive files were not edited or formatted. [Biome changelog](https://github.com/biomejs/biome/blob/main/CHANGELOG.md).

Vite Plus and its core alias are consistently pinned to 1.1.0. It requires Node 22.18, 24.11, or 26 and uses upstream Vitest 5.0.3. The old web Vitest fork override was removed. The updated linter required explicit underscore argument/variable exceptions and a computed-namespace exception restricted to the test that checks every exported tool. [Published Vite Plus requirements](https://registry.npmjs.org/vite-plus/1.1.0).

The Aggregate, Action Cache, and Workflow declaration blocks in `convex/_generated/api.d.ts` were refreshed offline from each installed package's published `dist/component/_generated/component.d.ts`, substituting their mounted component names into `FunctionReference` types. Root module declarations were retained. No Convex command or server contact was used to generate these types. Workflow's ineffective retry-policy cast was replaced with its supported workpool options; a real local component test confirms opted-in actions stop after three failed attempts. Another test exercises synchronous Aggregate insert, replacement, deletion, counts, and sums.

An actual Deep Agents invocation exposed an existing Convex-ID JSON-schema serialization failure. The model-facing schema converter now represents registered Convex IDs as strings and rejects arbitrary custom validators; tool callbacks still parse the original Zod schema before binding run provenance. A mocked weekly-brief invocation verifies both schema transmission and graph execution.

Real AI SDK and provider adapters are exercised through intercepted fetches for OpenRouter reasoning/instructions/token caps, Groq routing, Zod structured outputs, and provider token counts. All responses are local fixtures; tracing is disabled.

## Deployment prerequisites and limits

AI SDK 7 and both upgraded providers require Node >=22. Local Node is 24.21.0; CI selects Node 24. The actual Convex executor remains unverified. A read-only attempt through the documented `prox5` / CT113 route failed with `ssh: connect to host prox5 port 22: Connection timed out`. Verify the executor before deploying, because self-hosted Convex ignores `convex.json` Node selection. [Convex runtime documentation](https://docs.convex.dev/functions/runtimes#nodejs-version-configuration).

Deep Agents' latest published LangSmith peer upper bound remains below 0.10. The latest direct versions are installed, and actual runtime tests cover Frequency's usage; this establishes local compatibility only, not upstream-declared support. Its existing braces advisory remains covered by the repository's existing explicit CI exception. The web build also retains an unused Park fieldset-selector warning.

Authenticated production E2E tests, container deployment, and Convex deployment were not run. Local browser smoke uses an inert backend and blocks external requests.

## Final verification

`vp run verify` passed formatting, lint, all four package typechecks, and 1,223 tests: 810 backend/script tests, 96 harness tests, 246 agent tests, and 71 media tests. The separate web build passed. All four frozen-lockfile installs and final `bun outdated` checks passed with no remaining entries. Playwright collected 31 tests; local Chromium smoke covered essays and the home atlas without live service calls.

The local independent review workflow could not produce a validated report: the installed Codex 0.160 CLI rejected its legacy approval flag, and a temporary compatible 0.153.4 CLI then reported the required `gpt-6.1-sol` model unavailable. This limitation was disclosed before the user requested the PR, GitHub review/CI, and merge workflow. Local validation results do not constitute an independent review approval.

Verification initially found missing FFmpeg on this workstation; it was installed locally, and all media tests then passed. Updated lint emits warnings for existing code but no errors. The web build retains its chunk-size warning and the documented upstream Park warning.
