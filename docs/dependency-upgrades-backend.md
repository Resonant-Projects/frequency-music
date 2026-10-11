# Backend dependency upgrade research

Researched on 2026-10-11 against npm's published `latest` metadata, official migration notes, and the published package declarations. This note covers root dependencies after PR #123. It records migration requirements and checks, not completed verification or a production deployment.

> 🧠 **From Hindsight memory (Component map)** — Root owns the Convex backend and scripts. Root, `web/`, `agent/`, and `media/` have separate package and TypeScript configurations. Runtime contracts belong in `convex/shared/`; backend integration tests use the explicit `harness/modules.ts` registry.

## Published targets and compatibility

| Package | Previous version | Latest version | Published constraint |
| --- | --- | --- | --- |
| `ai` | 6.0.303 | 7.0.137 | Node >=22; Zod ^3.25.76 or ^4.1.8; provider 4.0.26 and provider-utils 5.0.58 |
| `@ai-sdk/groq` | 3.0.72 | 4.0.59 | Node >=22; same provider and provider-utils versions as `ai` |
| `@openrouter/ai-sdk-provider` | 2.10.0 | 3.1.0 | Node >=22; peer `ai` ^7.0.0; Zod ^3.25.76 or ^4.1.8 |
| `@convex-dev/aggregate` | 0.2.2 | 0.3.2 | Peer Convex ^1.43.0; adds batch-worker 0.3.3 |
| `@convex-dev/workflow` | 0.3.12 | 0.4.10 | Peers Convex ^1.46.0, convex-helpers ^0.1.127, workpool ^0.4.4 |
| `@onkernel/sdk` | 0.37.0 | 0.123.0 | No declared engines or peers |
| `langsmith` | 0.7.17 | 0.10.11 | No declared engines; OpenAI, ws, and OpenTelemetry peers are optional |
| `convex-test` | 0.0.60 | 0.0.61 | Peer Convex ^1.43.0 |

Version and constraint sources are the registry records for [AI SDK](https://registry.npmjs.org/ai/7.0.137), [Groq](https://registry.npmjs.org/@ai-sdk%2Fgroq/4.0.59), [OpenRouter](https://registry.npmjs.org/@openrouter%2Fai-sdk-provider/3.1.0), [Aggregate](https://registry.npmjs.org/@convex-dev%2Faggregate/0.3.2), [Workflow](https://registry.npmjs.org/@convex-dev%2Fworkflow/0.4.10), [Kernel](https://registry.npmjs.org/@onkernel%2Fsdk/0.123.0), [LangSmith](https://registry.npmjs.org/langsmith/0.10.11), and [convex-test](https://registry.npmjs.org/convex-test/0.0.61).

## AI SDK and providers

Upgrade `ai`, Groq, and OpenRouter together. OpenRouter 3 targets provider V4 and exclusively supports AI SDK 7. All three now publish ESM and require Node >=22. Root already uses ESM; CI uses Node 24. [OpenRouter changelog](https://github.com/OpenRouterTeam/ai-sdk-provider/blob/main/CHANGELOG.md)

In `convex/llmNode.ts`, `generateObject` remains available. `system` remains a deprecated fallback for `instructions`; rename the SDK option without changing the project-owned `GenerateOpts.system` contract. The same optional modernization applies to generation calls under `scripts/langsmith/` and `scripts/generate-essay-metadata.ts`. Token totals remain `usage.inputTokens` and `usage.outputTokens`. The new aggregated usage semantics affect multi-step generations; these root calls use one step. The repo wraps calls with LangSmith `traceable`, so no custom AI SDK OpenTelemetry setup needs migration. [AI SDK 7 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)

Keep existing OpenRouter model-level `reasoning: { effort }` routing unless a focused test proves the replacement request is equivalent. Top-level AI SDK reasoning now exists, but mixing it with provider-specific settings can override the new setting. [Reasoning migration](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0#reasoning)

Before deployment, verify the actual self-hosted Convex Node executor is >=22. Convex's official runtime docs say self-hosted deployments use the backend's `.nvmrc` version and ignore `convex.json` Node selection. Local Node 24 and passing CI do not establish the server's runtime version. [Convex runtime configuration](https://docs.convex.dev/functions/runtimes#nodejs-version-configuration)

## Convex components and test runtime

Aggregate 0.3 adds optional queued writes and stale reads. Existing synchronous calls need neither option. Keep their current transaction semantics. Mixing queued operations with normal reads or writes can throw. Its component now mounts a batch worker and exposes new `deadLetter` endpoints, which are absent from the checked-in component type declarations. [Aggregate changelog](https://github.com/get-convex/aggregate/blob/main/CHANGELOG.md), [component configuration](https://github.com/get-convex/aggregate/blob/main/src/component/convex.config.ts)

Workflow 0.4 requires a completion `context` when `onComplete` is provided. Current `workflowManager.start` calls provide neither, so this requirement does not affect them. Its generated mutation argument and result signatures changed; inspect all workflow definitions and component declarations during type checking. Explicitly resolve its workpool peer. [Workflow changelog](https://github.com/get-convex/workflow/blob/main/CHANGELOG.md)

`convex/components.ts` currently hides an unsupported `defaultRetryPolicy` shape behind an `unknown` cast. Both the old and new package expect `workpoolOptions.defaultRetryBehavior`, containing `maxAttempts`, `initialBackoffMs`, and `base`. `maxBackoffMs` is not supported. Any repair here changes an ineffective existing setting into a real retry policy, so verify retry behavior separately. [Workflow retry configuration](https://github.com/get-convex/workflow#specifying-retry-behavior)

Refresh component type contracts from the installed packages' published `/_generated/component.js` declarations without running production-connected codegen. Confirm that the resulting types cover Aggregate's new endpoints and Workflow's validators. Runtime component registration still occurs only on deployment, which this upgrade research does not perform.

convex-test 0.0.61 adds `defineTestApp`, rejects pagination inside components, and fixes text search on absent or non-string values. Existing `convexTest(schema, modules)` tests remain supported. Run the backend tests and full harness; the new component-pagination restriction can expose behavior the earlier test runtime incorrectly allowed. [convex-test changelog](https://github.com/get-convex/convex-test/blob/main/CHANGELOG.md)

## Kernel and LangSmith

The active Kernel consumer is the dynamic import in `scripts/smart-fetch.ts`. Its browser creation, Playwright execution, session ID, and cleanup methods still exist in 0.123.0. The documented browser-pool profile change in 0.72 does not affect this code, which does not use pools or profiles. Frozen `scripts/archive/` consumers require no edits. [Kernel changelog](https://github.com/kernel/kernel-node-sdk/blob/v0.123.0/CHANGELOG.md), [browser declarations](https://github.com/kernel/kernel-node-sdk/blob/v0.123.0/src/resources/browsers/browsers.ts)

An existing Kernel fallback bug merits a separate focused correction: `smart-fetch.ts` reads `.text` from the whole Playwright response. Both 0.37 and 0.123 return the executed value under `.result`, with a separate `.success` flag. Read and validate `response.result.text`; preserve `finally` cleanup on success, execution failure, and invalid output. This bug predates the upgrade. [Old response contract](https://github.com/kernel/kernel-node-sdk/blob/v0.37.0/src/resources/browsers/playwright.ts), [new response contract](https://github.com/kernel/kernel-node-sdk/blob/v0.123.0/src/resources/browsers/playwright/playwright.ts)

LangSmith 0.10 adds a generated `Langsmith` client while retaining the named legacy `Client` export used here. `traceable`, `getCurrentRunTree`, `Run`, `Example`, `evaluate`, and the legacy two-argument evaluator callbacks remain available. Avoid converting root scripts to the generated client merely because it is now the default export. Version 0.10.11 fixes packaging for the Vitest entrypoint. [LangSmith exports](https://github.com/langchain-ai/langsmith-javascript/blob/v0.10.11/src/index.ts), [release notes](https://github.com/langchain-ai/langsmith-javascript/blob/v0.10.11/CHANGELOG.md)

## Verification to complete

- Run root type checking after installation to catch changed component contracts and provider versions.
- Run backend unit tests, the full harness, and LangSmith evaluator/promotion tests. Existing workflow smoke tests do not demonstrate the configured retry policy.
- Verify provider routing, structured outputs, token totals, and reasoning request bodies with mocked transport. No paid provider calls are necessary for these checks.
- If repairing Kernel response extraction, cover successful text, unsuccessful execution, malformed results, and cleanup with a mocked SDK. A CLI dry run skips Kernel and cannot validate this behavior.
- Run `vp run verify`, the separate web build, and a fresh `bun outdated` inventory across all four packages.
- Record the Convex server runtime requirement as a deployment prerequisite until a read-only host check confirms Node >=22. Do not use `convex dev`, `run`, `codegen`, or `deploy` as dependency verification.
