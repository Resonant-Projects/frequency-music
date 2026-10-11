# Agent dependency upgrade research

Research date: 2026-10-11. This records the `agent/package.json` baseline after PR #123 and the npm `latest` dist-tags observed during this upgrade. Release candidates, development builds, and alpha tags are excluded. Registry metadata and release notes are primary sources. Verification results belong in the implementation handoff; this document does not claim that production inference or deployment ran.

## Version inventory

| Package | Baseline | Latest observed | Primary source |
| --- | --- | --- | --- |
| `@langchain/anthropic` | 1.3.29 | 1.5.12 | [Published metadata](https://registry.npmjs.org/@langchain/anthropic/1.5.12) |
| `@langchain/core` | 1.2.4 | 1.2.17 | [Published metadata](https://registry.npmjs.org/@langchain/core/1.2.17) |
| `@langchain/langgraph` | 1.4.8 | 1.4.21 | [Published metadata](https://registry.npmjs.org/@langchain/langgraph/1.4.21) |
| `@langchain/langgraph-sdk` | 1.9.28 | 1.12.3 | [Published metadata](https://registry.npmjs.org/@langchain/langgraph-sdk/1.12.3) |
| `@langchain/langgraph-cli` | 1.4.3 | 1.5.2 | [Published metadata](https://registry.npmjs.org/@langchain/langgraph-cli/1.5.2) |
| `@openai/codex-sdk` | 0.146.0 | 0.162.1 | [Published metadata](https://registry.npmjs.org/@openai/codex-sdk/0.162.1) |
| `convex` | 1.46.0 | 1.46.0 | [Published metadata](https://registry.npmjs.org/convex/1.46.0) |
| `convex-helpers` | 0.1.124 | 0.1.128 | [Published metadata](https://registry.npmjs.org/convex-helpers/0.1.128) |
| `deepagents` | 1.12.1 | 1.14.2 | [Published metadata](https://registry.npmjs.org/deepagents/1.14.2) |
| `langchain` | 1.5.4 | 1.5.16 | [Published metadata](https://registry.npmjs.org/langchain/1.5.16) |
| `langsmith` | 0.8.9 | 0.10.11 | [Published metadata](https://registry.npmjs.org/langsmith/0.10.11) |
| `esbuild` | 0.28.1 | 0.28.2 | [Published metadata](https://registry.npmjs.org/esbuild/0.28.2) |
| `hono` | 4.13.12 | 4.13.13 | [Published metadata](https://registry.npmjs.org/hono/4.13.13) |
| `tsx` | 4.23.4 | 4.23.15 | [Published metadata](https://registry.npmjs.org/tsx/4.23.15) |
| `zod` | 4.4.3 | 4.6.6 | [Published metadata](https://registry.npmjs.org/zod/4.6.6) |
| `postcss` | 8.5.25 | 8.5.29 | [Published metadata](https://registry.npmjs.org/postcss/8.5.29) |
| `typescript` | ^7.0.2 | 7.0.2 | [Published metadata](https://registry.npmjs.org/typescript/7.0.2) |
| `uuid` override | 11.1.1 | 14.0.3 | [Published metadata](https://registry.npmjs.org/uuid/14.0.3) |
| `ws` override | ^8.21.0 | 8.22.0 | [Published metadata](https://registry.npmjs.org/ws/8.22.0) |

## Upgrade the LangChain family together

The latest `langchain` requires `@langchain/core` ^1.2.17 and depends on LangGraph ^1.4.18. Anthropic requires core ^1.2.14. LangGraph 1.4.21 requires SDK ~1.12.3. Deep Agents requires core ^1.2.14, LangGraph ^1.4.10, SDK ^1.9.23, and langchain ^1.5.10. The versions above satisfy those relationships. Anthropic, core, and langchain require Node 20 or later; the repository's agent image uses Node 24. See the corresponding published metadata in the inventory.

Anthropic 1.5.1 stopped sending `thinking: { type: "disabled" }` when callers omit the thinking option. The class still initializes its `thinking` property to the disabled value, but `thinkingExplicitlySet` controls whether that value reaches `invocationParams()`. Tests for omitted configuration should inspect the request parameters. Explicit adaptive thinking remains appropriate for the repository's configured adaptive model. Later patches accept system messages beyond the first position and narrow provider system content to supported blocks. [Anthropic changelog](https://raw.githubusercontent.com/langchain-ai/langchainjs/main/libs/providers/langchain-anthropic/CHANGELOG.md), [omission implementation](https://github.com/langchain-ai/langchainjs/commit/baa57ba7cdce2046ba3dd40e9e8cf3c93c9c1ac4).

Core 1.2.17 preserves ambient runtime context through nested runnables and tools. Intermediate releases fix streamed token accounting and tracing of structured tool arguments. These affect the repository's model adapters, audit traces, and usage reporting, so the existing model and graph tests are relevant checks. [Core changelog](https://raw.githubusercontent.com/langchain-ai/langchainjs/main/libs/langchain-core/CHANGELOG.md).

Langchain 1.5.9 stops retrying errors marked non-retryable. In 1.5.13, a model specified as an `openai:` string defaults to Responses; an explicit model instance retains its own configuration. Frequency supplies custom model instances to its Deep Agent, so that string-model default does not require a migration here. Later fixes preserve graph interrupts and successful return-direct behavior. [Langchain changelog](https://raw.githubusercontent.com/langchain-ai/langchainjs/main/libs/langchain/CHANGELOG.md).

LangGraph 1.4.21 accepts actual `Command` instances, including instances from another installed copy, but no longer interprets command-shaped plain objects as directives. SDK 1.12.2 percent-encodes raw identifiers and rejects `.` and `..`; 1.12.3 copies caller headers to prevent API-key sharing between clients. Pass raw identifiers and construct commands with `new Command(...)`. [Graph changelog](https://raw.githubusercontent.com/langchain-ai/langgraphjs/main/libs/langgraph-core/CHANGELOG.md), [SDK changelog](https://raw.githubusercontent.com/langchain-ai/langgraphjs/main/libs/sdk/CHANGELOG.md).

Deep Agents 1.14 adds explicit skill reloads by setting stored `skillsMetadata` to `null`. Its latest patch adds unsupported-content filtering before model calls. Earlier patches fix subagent call-counter isolation and sandbox symlink escapes. Frequency's weekly brief uses the default agent with explicit models, tools, and subagents, so subagent and tool behavior deserve coverage. [Deep Agents changelog](https://raw.githubusercontent.com/langchain-ai/deepagentsjs/deepagents%401.14.2/libs/deepagents/CHANGELOG.md).

The CLI 1.5 fixes Docker discovery by using the inherited environment, adds Studio URL support, and introduces agent ID/environment flags. It depends on LangSmith ^0.10.5. Upgrade the CLI without running its production-capable `dev`, `up`, or deployment commands during verification. [CLI changelog](https://raw.githubusercontent.com/langchain-ai/langgraphjs/main/libs/langgraph-cli/CHANGELOG.md).

## LangSmith peer conflict

Deep Agents 1.14.2 declares `langsmith >=0.7.1 <0.10.0`. The current upstream main package still declares that upper bound. The newest registry version within it is 0.9.0; latest LangSmith 0.10.11 falls outside it. This is an actual declared incompatibility even if local tests pass. [Deep Agents release manifest](https://raw.githubusercontent.com/langchain-ai/deepagentsjs/deepagents%401.14.2/libs/deepagents/package.json), [LangSmith 0.9.0 metadata](https://registry.npmjs.org/langsmith/0.9.0).

Inspection of the published Deep Agents bundle found only `Client` and the experimental `SandboxClient`, `LangSmithResourceNotFoundError`, and `LangSmithSandboxError` imports from LangSmith. Its sandbox backend uses the established sandbox and snapshot methods. Comparing the published 0.9.0 and 0.10.11 declarations found those methods, overloads, and errors still present. The newer declarations add filesystem, service URL, and access-delegation capabilities. Frequency does not instantiate `LangSmithBackend` or call the experimental sandbox API. This supports an inference of compatibility for Frequency's current usage, not a claim of upstream support. [LangSmith sandbox source](https://github.com/langchain-ai/langsmith-javascript/tree/v0.10.11/src/sandbox), [Deep Agents sandbox backend](https://github.com/langchain-ai/deepagentsjs/blob/deepagents%401.14.2/libs/deepagents/src/backends/langsmith.ts).

LangSmith 0.10.11 changes packaging to a CommonJS package with `.mjs` import entry points and wildcard experimental exports. Its published manifest retains `langsmith/traceable` and experimental sandbox resolution. A package import and mock-backed agent invocation should exercise those exports without sending traces or requesting inference. The release fixes CommonJS and older-resolution Vitest declarations. [Published manifest](https://registry.npmjs.org/langsmith/0.10.11), [release changelog](https://raw.githubusercontent.com/langchain-ai/langsmith-javascript/main/CHANGELOG.md).

The implementation keeps direct LangSmith 0.10.11 and Deep Agents 1.14.2 and records the unsupported upstream peer range explicitly. No nested override or dependency-metadata patch is applied. Bun 1.4.2 ignored the attempted nested override forms in an isolated resolver check. Current Bun documentation describes one-parent overrides and warns that they produce lockfile version 3, but that documentation does not prove support in the repository's installed version. [Bun override documentation](https://bun.sh/docs/pm/overrides).

The graph-compilation suite imports and invokes the real weekly-brief graph with a mocked Anthropic response. Its fetch replacement accepts only the expected Anthropic messages URL, rejects every other request, and verifies that Convex ID tools reach the provider as string schemas. Tracing is disabled and no request leaves the process. This exercises Deep Agents graph execution under the latest LangSmith packaging. It does not prove hosted LangSmith sandbox compatibility or production inference, and it does not change the upstream peer declaration.

Actual invocation exposed a preexisting tool-schema conversion failure that compilation alone missed. Convex Helpers represents `zid` with `z.custom`, which Zod cannot directly serialize into JSON Schema. An isolated baseline probe using core 1.2.4, Zod 4.4.3, and Helpers 0.1.124 also failed with `Custom types cannot be represented in JSON Schema`. The adapter now converts registered Convex IDs to model-facing strings while retaining the original Zod parsing before tool execution. Arbitrary custom schemas are rejected. The shared converter uses the same Helpers registry as the shared argument contracts, which matters when packages have independent installs. Its output is plain JSON because Zod attaches a Standard Schema adapter that would otherwise trigger another conversion without the Convex-ID override. [Helpers `zid` implementation](https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/server/zod4.ts), [Zod JSON Schema documentation](https://zod.dev/json-schema).

## Other dependencies and overrides

The Codex SDK remains an API for local threads with `startThread`, `run`, and `resumeThread`, and requires Node 18 or later. The published 0.162.1 SDK depends on the matching `@openai/codex` 0.162.1 runtime. Frequency constructs `new Codex()` without a binary override, so the SDK resolves its packaged native binary. Its installed Linux binary reports `codex-cli 0.162.1` with `--version`. The separately installed global CLI pin in `agent/Dockerfile` is used by image smoke checks for `codex --version`; Frequency's inference paths use the SDK binary. Keep structured-output, abort, error-classification, and argument tests. [Official Codex SDK documentation](https://learn.chatgpt.com/docs/codex-sdk), [SDK metadata](https://registry.npmjs.org/@openai/codex-sdk/0.162.1).

Convex Helpers 0.1.125 requires Convex ^1.46.0, which is already installed. Subsequent patches fix resumed stream cursors and Zod output validator types for nested codecs, pipes, and defaults. Verify the existing cross-package schema contracts rather than running Convex deployment/codegen commands. [Helpers changelog](https://raw.githubusercontent.com/get-convex/convex-helpers/main/packages/convex-helpers/CHANGELOG.md).

Zod remains in major 4 and satisfies the latest LangChain, Deep Agents, and Helpers ranges. Its 4.6.6 release notes describe bug and performance fixes but do not provide a migration checklist. Existing schema conversion and structured-output tests are the useful evidence for this project. [Zod release](https://github.com/colinhacks/zod/releases/tag/v4.6.6).

`tsx` 4.23.15 depends on esbuild ~0.28.0 and requires Node >=18; esbuild 0.28.2 fits. Recent tsx fixes address Node 24's CommonJS bridge and bounded transform-cache memory. Esbuild's patch fixes TypeScript import-alias tree shaking and CSS minification. Keep its direct dependency and override synchronized. [tsx 4.23.14 release](https://github.com/privatenumber/tsx/releases/tag/v4.23.14), [tsx 4.23.15 release](https://github.com/privatenumber/tsx/releases/tag/v4.23.15), [esbuild changelog](https://raw.githubusercontent.com/evanw/esbuild/main/CHANGELOG.md).

Hono 4.13.13 adds mount middleware and deprecates `app.mount` ahead of version 5. Its latest stable tag remains major 4; the version 5 release candidate is excluded. PostCSS 8.5.26 through 8.5.29 fix source-map symlink protection, parser/list behavior, types, and style escaping. Synchronize direct dependencies and overrides. WebSocket 8.22.0 adds the protocols option and corrects state changes after invalid close arguments. [Hono release](https://github.com/honojs/hono/releases/tag/v4.13.13), [PostCSS changelog](https://raw.githubusercontent.com/postcss/postcss/main/CHANGELOG.md), [ws release](https://github.com/websockets/ws/releases/tag/8.22.0).

UUID 12 removed CommonJS support; 14 requires globally available `crypto` and Node 20 or later. Latest LangSmith no longer depends on UUID, unlike baseline LangSmith 0.8.9. The refreshed agent lockfile contains no UUID package, so the implementation removes the unused override instead of forcing an unnecessary major version. [UUID changelog](https://raw.githubusercontent.com/uuidjs/uuid/main/CHANGELOG.md), [baseline LangSmith metadata](https://registry.npmjs.org/langsmith/0.8.9), [latest LangSmith metadata](https://registry.npmjs.org/langsmith/0.10.11).

## Existing audit exception

Raw production audit still reports high-severity [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) through `deepagents > micromatch > braces`. The registry's latest braces remains 3.0.3 and the advisory provides no patched version. The old Deep Agents dependency graph also contained this chain, so this upgrade does not introduce it. [Latest braces metadata](https://registry.npmjs.org/braces/latest).

The repository already documents and applies this specific exception in [the agent image workflow](../.github/workflows/publish-agent-image.yml). Its October 3 rationale accepts the failed-run risk within its own agent tooling and calls for removing the exception when a patch ships. The implementation lane ran the workflow's production audit command with `--ignore=GHSA-vfj7-8cjw-p6xm`; it passed for 84 packages with one advisory ignored. The unfiltered audit still fails for that advisory.
