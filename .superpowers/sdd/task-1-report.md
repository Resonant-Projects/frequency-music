# Task 1 Report — plan-01 remainders in research-pipeline nodes

Worktree: `/Users/kelliott/code/frequency-music/.claude/worktrees/master-sequence-remainder`
Branch: `worktree-master-sequence-remainder`

## Summary

Both TODOs in `agent/src/graphs/research-pipeline/nodes.ts` are implemented, tested, and verified. Status: **DONE**.

## What was implemented

### Requirement A — per-model-call `agentRunEvents` audit event

- `createReviewDraftNode` now appends a `"model_call"` audit event whenever a specialist model actually answers (OpenRouter or Codex), carrying `provider`, `model`, `usage`, and `threadId` (when Codex answered).
- The provider recorded is the **answering** provider, read from the model response's `llmOutput.provider` (populated by `codexSdk`/`withFallback`) — not the static `getConfiguredModelProvider()` label. This required a small, deliberate change to `agent/src/agents/research-pipeline/deepAgent.ts` (see "Scope exception" below): the specialist's model call was switched from `model.invoke()` (discards `llmOutput`) to `model.generate()` (returns the full `LLMResult`, including `llmOutput`), threaded through `ResearchDraftSpecialistResult.llmOutput`.
- New `"model_call"` event kind added to **every** place the event-kind union is validated, to avoid the "prior wave shipped a rejected kind" bug class the brief warned about:
  - `convex/schema.ts` — `agentRunEventKindValidator` (the canonical source)
  - `convex/agentTools.ts` — `appendAgentRunEvent` action's inline `v.union` (confirmed via `convex/agentToolsHttp.ts` that this is the actual gate the HTTP agent-tool surface enforces)
  - `convex/agentRuns.ts` — `appendRunEvent` internal helper's inline TS type
  - `agent/src/state/researchPipelineState.ts` — `AuditEvent["kind"]`
  - `agent/src/tools/convexTools.ts` — the `appendAgentRunEvent` tool's zod `z.enum([...])`

### Requirement B — `CODEX_SPECIALIST` wiring

- New `createSpecialistOutcome(input, options)` in `nodes.ts` is the routing entry point: when `process.env.CODEX_SPECIALIST === "true"` it calls `createReviewDraftViaCodex`, otherwise `createReviewDraftViaOpenRouter` (the pre-existing behavior, now factored out).
- `createReviewDraftViaCodex` delegates to `runCodexTask` (default read-only sandbox) with the same context the OpenRouter specialist receives (`selectedCandidate`, `candidateCount`, `fallbackDraft`, `scope`) and an `outputSchema` (`codexSpecialistOutputSchema`) mirroring the OpenRouter specialist's JSON contract. The parsed result is passed through the existing `sanitizeSpecialistDraft` so the node's output shape is identical regardless of path.
- On any Codex failure (thrown error from `runCodexTask`), it falls back to `createReviewDraftViaOpenRouter` and marks `usedFallback: true` with a warning that mentions Codex was unavailable — the run is never failed solely because Codex is down.
- The Codex thread id is captured in the `modelCall.threadId` field, which flows into the Requirement A `"model_call"` audit event, so a future `resumeThread` call has what it needs.
- `RESEARCH_DRAFT_SPECIALIST_INSTRUCTIONS` (the specialist's system prompt) was extracted to an exported constant in `deepAgent.ts` so both the OpenRouter and Codex paths share one copy of the payload contract instead of duplicating ~25 lines.
- `agent/.env.example`: added `CODEX_SPECIALIST=` (default off) with a one-line comment, placed next to the other `CODEX_*` vars.
- `runCodexTask` and the specialist `model` are both injectable via `createSpecialistOutcome(input, { runCodexTask?, model? })`, mirroring the existing DI pattern (`createResearchDeepAgentDraft(input, { model })`) so routing is unit-testable without a live Codex CLI or configured model provider. `agent/src/subagents/codexWorker.ts` was **not** modified — its existing signature was sufficient.

## What was tested

New file: `agent/tests/research-pipeline-codex-specialist.test.ts` — unit-tests the routing decision with a mocked `runCodexTask` (and a mocked/failing specialist `model` to keep the OpenRouter branch network-free), per the brief's explicit ask ("unit-test the routing decision ... with mocked `runCodexTask`").

- `flag off: takes the OpenRouter path and never calls the Codex runner` — asserts the injected Codex runner is called 0 times when `CODEX_SPECIALIST` is unset.
- `flag on: routes through Codex and threads the draft/provider/threadId/usage` — asserts `outcome.provider === "codex-sdk"`, `outcome.usedFallback === false`, the draft comes from the Codex output, and `outcome.modelCall` carries `threadId`/`usage` from the Codex result.
- `flag on + Codex runner throws: falls back to OpenRouter and never fails the run` — asserts `usedFallback: true`, a warning mentioning both "Codex specialist unavailable" and the underlying error, and that the run completes with a draft rather than throwing.

Also updated `agent/tests/codex-deep-agent.test.ts` (two existing tests) from `.invoke()`-style mocks to `.generate()`-style mocks to match the `deepAgent.ts` change, and added two new assertions verifying `llmOutput.provider`/`llmOutput.threadId` thread through `createResearchDeepAgentDraft`'s successful-response path.

TDD note: implementation and the new routing-test file were designed together as one coupled unit (the routing function's signature was shaped specifically to be testable), so this was closer to test-alongside than strict RED-then-GREEN. I did observe a genuine RED state along the way: the first version of the routing tests (before adding the `model` DI option to `createSpecialistOutcome`) failed with an uncaught `Error: Anthropic API key not found` thrown synchronously out of `ChatAnthropic`'s constructor — `getResearchModel()` is called outside the `try/catch` in `deepAgent.ts`, so a misconfigured/absent model provider throws past both `createReviewDraftViaOpenRouter` and the Codex-fallback catch block. I fixed this by adding an optional `model` DI parameter through `createSpecialistOutcome` → `createReviewDraftViaOpenRouter`/`createReviewDraftViaCodex`'s fallback (matching the existing `{ model }` pattern in `createResearchDeepAgentDraft`), rather than changing `deepAgent.ts`'s error handling — see "Issues / concerns" below for why this remains a latent gap I did not fix.

### Verification gates (all pass)

1. `cd agent && bunx tsc --noEmit` — clean (exit 0)
2. `cd agent && bun test` — **64 pass, 0 fail** (baseline 61 + 3 new), 154 `expect()` calls, across 11 files
3. `bunx convex codegen` (repo root) — succeeded (exit 0), typechecked and pushed additively to the self-hosted dev deployment
4. `bun test convex scripts` (repo root) — **116 pass, 0 fail** (unchanged from baseline), 266 `expect()` calls, across 19 files
5. Both original `TODO(plan-01 T3)` and `TODO(plan-01 T5)` comments are removed — confirmed via `grep -rn "TODO(plan-01" agent/src/graphs/research-pipeline/nodes.ts` (no matches)

## Files changed

- `agent/src/graphs/research-pipeline/nodes.ts` — both TODOs implemented; new helpers `codexSpecialistOutputSchema`, `ModelCallInfo`, `SpecialistOutcome`, `specialistContext`, `createReviewDraftViaOpenRouter`, `createReviewDraftViaCodex`, `createSpecialistOutcome`; `createReviewDraftNode` rewritten to use them and append the `model_call` event.
- `agent/src/agents/research-pipeline/deepAgent.ts` — `.invoke()` → `.generate()` to preserve `llmOutput`; `ResearchDraftSpecialistResult.llmOutput` field added; `RESEARCH_DRAFT_SPECIALIST_INSTRUCTIONS` extracted to an exported constant.
- `agent/.env.example` — added `CODEX_SPECIALIST=`.
- `convex/schema.ts`, `convex/agentTools.ts`, `convex/agentRuns.ts` — added `"model_call"` to every kind validator.
- `agent/src/state/researchPipelineState.ts` — added `"model_call"` to `AuditEvent["kind"]`.
- `agent/src/tools/convexTools.ts` — added `"model_call"` to the tool's zod enum.
- `agent/tests/codex-deep-agent.test.ts` — updated two mocks to `.generate()` style, added `llmOutput` assertions.
- `agent/tests/research-pipeline-codex-specialist.test.ts` (new) — the routing-decision unit tests.

## Self-review findings

- **Completeness**: both TODOs fully implemented; the `model_call` event is appended for both the OpenRouter and Codex paths (not just Codex), which is what "per-model-call" in the plan text calls for.
- **Quality**: ran `bunx biome check` against every changed file. Found and fixed one genuine issue I introduced (an 80-char-line violation in `deepAgent.ts`'s new `llmOutput` cast). All other biome findings in touched files (import-sort ordering in `nodes.ts`, `deepAgent.ts`, `codex-deep-agent.test.ts`; an unrelated multi-line-union/line-width finding in `researchPipelineState.ts`; pre-existing findings in `convex/agentRuns.ts`/`convex/agentTools.ts`) were confirmed **pre-existing on `main`** via `git stash` + `bunx biome check` before re-applying my changes — left alone per "do not refactor unrelated code."
- **Discipline**: stayed within the brief's file list except for the one documented, justified exception below. Did not touch `codexWorker.ts` (no signature change was needed) or `web/`.
- **Testing**: new test file follows the existing DI-mock style (`codex-deep-agent.test.ts`), asserts behavior (call counts, returned shape, warning text) not implementation details, and runs with no network/live-model calls.

## Scope exception (flagged, not hidden)

The brief's literal file list for Requirement A didn't include `deepAgent.ts`, but the TODO text itself required reading `response.llmOutput.provider` — that data doesn't exist anywhere without changing the specialist's model call from `.invoke()` to `.generate()`. I made that change plus the accompanying `llmOutput` DI threading in `deepAgent.ts`, since it was the only way to satisfy Requirement A as written. Verified via `bunx tsc --noEmit` and the updated `codex-deep-agent.test.ts` (4/4 pass).

I also added an optional `model` DI parameter to `createSpecialistOutcome`/`createReviewDraftViaOpenRouter`/`createReviewDraftViaCodex` (all in `nodes.ts`, within scope) purely to make the routing tests network-free — this doesn't change `createReviewDraftNode`'s own call site (still calls `createSpecialistOutcome(specialistInput)` with no options), so production behavior is unchanged.

## Issues / concerns

1. **Pre-existing gap, not fixed**: `getResearchModel()` is constructed outside the `try/catch` in `createResearchDeepAgentDraft` (`deepAgent.ts`). If the configured model provider throws synchronously during construction (e.g. missing API key, as reproduced while writing tests in this env), the error propagates uncaught out of `createResearchDeepAgentDraft`, and therefore out of `createReviewDraftViaOpenRouter` — including when it's called from inside `createReviewDraftViaCodex`'s Codex-failure fallback. In that specific combination (Codex down **and** OpenRouter misconfigured), the node would throw instead of degrading gracefully. This is pre-existing behavior (not introduced by this change) and out of this task's scope, but worth a follow-up since it slightly weakens the "never fail the run solely because Codex is down" guarantee when both providers are unavailable simultaneously.
2. **Pre-existing gap, not fixed**: before this change, `convex/agentTools.ts`'s `appendAgentRunEvent` action and `convex/agentRuns.ts`'s `appendRunEvent` inline type were already missing `"memory_recall"`, which is present in `convex/schema.ts`'s `agentRunEventKindValidator`. This is exactly the bug class the brief warned about ("a prior wave shipped an event kind the HTTP surface rejected at runtime"), just for a different kind than the one I added. `bunx convex codegen` does not currently catch this mismatch. Left unfixed as out-of-scope for this task (unrelated to `model_call`), flagging for a future pass.
3. **Environment note**: the brief states root `.env.local` contains an OpenRouter key; in this worktree it does not (`OPENROUTER_API_KEY` is absent from `.env.local`, and `agent/.env.local` doesn't exist). This didn't block verification since live model runs were explicitly out of scope and all new tests use dependency injection to avoid real model/network calls, but it means the "flag off" and "Codex throws" test paths exercise the *real* (uninjected) `createResearchDeepAgentDraft` code path only via the injected-`model` override — not an actual OpenRouter round trip.

## Commit

A single commit was created on `worktree-master-sequence-remainder` implementing all of the above. Branch was not pushed, merged, or rebased onto main.

## Fix: reviewer finding — CODEX_MODEL not forwarded to the Codex thread (commit f69fba0)

**Finding (Important):** `createReviewDraftViaCodex` read `process.env.CODEX_MODEL` only to build the audit-event `model` label but never passed it into `codexRunner({...})`. Since `runCodexTask` only applies a model override when `input.model` is set, an operator setting `CODEX_MODEL` + `CODEX_SPECIALIST=true` would run the thread on the SDK default model while the `model_call` audit event reported the configured model as honored.

**Fix (`agent/src/graphs/research-pipeline/nodes.ts`):** a single `const codexModel = process.env.CODEX_MODEL || undefined;` now feeds both `model: codexModel` in the `codexRunner(...)` call and the audit label (`model: codexModel ?? "codex-default"`), so the audit event can never report a model the thread didn't run with — matching the `CodexSdkChatModel` pattern where the same model value threads into both the thread options and audit metadata. Also fixed two 80-char formatting violations I had introduced in the same function (biome).

**Test added** (`agent/tests/research-pipeline-codex-specialist.test.ts`): `flag on + CODEX_MODEL set: forwards the model to the Codex thread and audits the same value` — sets `CODEX_MODEL=gpt-5-codex`, captures `input.model` inside the mocked runner, and asserts both `forwardedModel` and `outcome.modelCall?.model` equal `"gpt-5-codex"`. `CODEX_MODEL` is saved/restored in `afterEach` alongside `CODEX_SPECIALIST`.

**RED evidence** (new test vs pre-fix code, via `git stash push -- agent/src/graphs/research-pipeline/nodes.ts`):

```
$ cd agent && bun test tests/research-pipeline-codex-specialist.test.ts
error: expect(received).toBe(expected)
Expected: "gpt-5-codex"
Received: undefined
(fail) CODEX_SPECIALIST routing decision > flag on + CODEX_MODEL set: forwards the model to the Codex thread and audits the same value
 3 pass
 1 fail
```

**GREEN evidence** (post-fix):

```
$ cd agent && bunx tsc --noEmit   # exit 0
$ bun test tests/research-pipeline-codex-specialist.test.ts
 4 pass
 0 fail
 15 expect() calls
$ bun test
 65 pass
 0 fail
 156 expect() calls
Ran 65 tests across 11 files.
```

Biome check on both touched files: 0 format errors (only the pre-existing import-sort finding in `nodes.ts`, confirmed present on main, remains). No Convex files were touched by this fix, so the Convex gates from the original run stand.

**Commit:** `f69fba0` — "Forward CODEX_MODEL into the Codex specialist thread"

## Fix: whole-branch review findings (commit 3b03ff4)

### CRITICAL — `model_call` events never fired on the default production path

**Finding:** `createResearchDeepAgentDraft` read `generated.llmOutput` after `model.generate(...)`, but LangChain only populates `result.llmOutput` via `_combineLLMOutput`, which none of the production models (`FallbackChatModel`, `CodexSdkChatModel`, `ChatAnthropic`) implement. On every real run `generated.llmOutput === undefined`, so `modelCall` was undefined, zero `model_call` events fired, and the answering-provider correction from `withFallback` never applied. The original tests passed only because they mocked `.generate()` and handed `llmOutput` back directly.

**Reproduced empirically** before fixing (real `BaseChatModel` subclass through `generate()` against the worktree's installed `@langchain/core`):

```
llmOutput: undefined
response_metadata: {"provider":"codex-sdk","model":"codex-default","usage":{"total_tokens":42},"threadId":"thread-abc"}
```

LangChain merges the single generation's `llmOutput` into `generations[0][0].message.response_metadata`, exactly as the reviewer stated.

**Fix (`agent/src/agents/research-pipeline/deepAgent.ts`):** new `extractLlmOutput(generated, message)` helper — prefers `message.response_metadata` (when non-empty), falls back to `generated.llmOutput` (covers mocked models), and normalizes ChatAnthropic-style `tokenUsage` metadata onto the `usage` key so OpenRouter-answered calls also carry usage in the `model_call` audit event.

**TDD evidence.** RED — two new tests in `agent/tests/codex-deep-agent.test.ts` drive a REAL `BaseChatModel` subclass (`StubResponseModel` implementing `_generate`, NOT a mocked `.generate()`) through the actual LangChain `generate()` pipeline:

```
$ cd agent && bun test tests/codex-deep-agent.test.ts   # against pre-fix deepAgent.ts
error: expect(received).toEqual(expected)   # llmOutput fields undefined
(fail) ... surfaces llmOutput through a REAL generate() pipeline (response_metadata path)
(fail) ... maps ChatAnthropic-style tokenUsage metadata onto the usage audit field
 4 pass
 2 fail
```

GREEN — after the `extractLlmOutput` fix:

```
$ cd agent && bun test tests/codex-deep-agent.test.ts
 6 pass
 0 fail
 17 expect() calls
```

### IMPORTANT — `"memory_recall"` missing from two inline kind unions

**Finding:** `convex/agentTools.ts` `appendAgentRunEvent` action's `v.union` and `agent/src/tools/convexTools.ts` `appendAgentRunEvent` `z.enum` accepted `model_call` but not `memory_recall`, while this branch ships a `memory_recall` reader (selfImprovementStats) — so the only agent write path would reject that kind at runtime. (This is the pre-existing gap I flagged in the original report's concern #2, now in-scope per review.)

**Fix:** added `v.literal("memory_recall")` to `convex/agentTools.ts` (line ~217) and `"memory_recall"` to the `z.enum` in `agent/src/tools/convexTools.ts` (line ~211). The canonical union in `convex/schema.ts` already contained it. Note: the reviewer cited "~line 683" for `convexTools.ts`; the file is 330 lines and contains exactly one `appendAgentRunEvent` kind enum (line 203) — that is the one fixed.

### Gates (all pass)

```
$ cd agent && bunx tsc --noEmit        # exit 0
$ cd agent && bun test
 77 pass / 0 fail (176 expect calls, 13 files)   # baseline grew: Tasks 2-3 landed on branch
$ bun test convex scripts               # repo root
 138 pass / 0 fail (319 expect calls, 21 files)
```

`bunx convex codegen` skipped per coordinator instruction (live backend outage, tracked). Biome: fixed one line-width violation I introduced in the new test; remaining findings in touched files (`getForWorkerRef` line width in `agentTools.ts`, `useTemplate` lint in `convexTools.ts`) confirmed pre-existing via `git stash` + re-check.

**Commit:** `3b03ff4` — "Fix model_call audit sourcing and memory_recall kind gaps"
