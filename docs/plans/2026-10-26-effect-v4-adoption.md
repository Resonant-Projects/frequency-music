# Effect v4 adoption in Frequency Music

Status: approved for stages A through D. The user selected both the Park
dependency upgrade and adoption in Frequency-owned application code. The first
slice is media TTS requests. The first delivery includes the media job lifetime
and agent transport/lifecycle stages. Stages E and F remain later work.

Review the [published plan](https://t2ljqvkt6g1c.postplan.dev),
[approved scope, version 2](https://t2ljqvkt6g1c.postplan.dev/v/2).

Stages A-D are implemented in the working copy. Full verification passes 2,447
tests, and independent review is complete with no actionable P0-P3 findings.
See the [local acceptance record](../evidence/effect-v4-20261026.md) and the
[implementation evidence](../effect-v4-upgrade.md).

## Intended result

Use Effect v4 to compose asynchronous work, typed operational failures, deadlines,
and resource lifetimes in Frequency-owned modules. Keep existing user behavior,
research provenance, persisted records, and public interfaces during each change.
Upgrade the existing Park dependency independently so its small compatibility
change does not hide the cost or risks of application adoption.

For example, a TTS provider that replies 429 before synthesis can receive another
attempt. A request that times out after the provider starts must not receive
another synthesis attempt. Effect must express that distinction, not replace it
with a broad retry rule.

The expected benefit is less repeated lifecycle code and failure policies that
the type system and tests can check. This is an engineering goal, not a measured
performance improvement. A Promise wrapped with `Effect.tryPromise` and immediately
run at every call site does not meet the goal.

## Evidence and package ownership

At the research baseline, the checkout had no direct Effect dependency or
application imports. Only `web/bun.lock` contained Effect, pinned to 3.10.15
by Park 0.43.1. The registry's
stable target is 4.0.6. The prior [dependency experiment](../effect-v4-upgrade.md)
compared full preset output and Panda generation. All 235 generated files were
byte-identical on v3 and v4. This is compatibility evidence for Park, not evidence
that the application has adopted Effect.

> 🧠 **From Hindsight memory (Deep modules and automatic pipeline recovery)** —
> Convex owns durable failure recovery, the agent owns LangGraph execution, and
> media owns audio job execution. Current workflows, worker, and runner code
> confirm those roles. Effect adoption must preserve those owners.

The four packages install and typecheck independently. Add a direct runtime
dependency only when a package first imports Effect. Pin `effect` to 4.0.6 for
the initial work and use each package's own lockfile. Reconfirm the registry
before implementation; a newer patch requires its own compatibility check.
The web override alone does not install Effect into another package.

## Proposed destination across the repository

| Package / module | Reuse | Proposed Effect responsibility | External interface / owner |
| --- | --- | --- | --- |
| Web Panda config | Park preset, gold/slate, existing radius selection | None; upgrade its transitive dependency | Existing CSS and generated types |
| Media TTS | `fetchAudioWithRetry`, provider options, rejection class, existing tests | Compose attempts, classified failure, deadline propagation, cancellable wait | Existing `Promise<ArrayBuffer>` and provider `Promise<void>` interfaces |
| Media job execution | `runOnce`, `JobContext`, retained checkpoints, completion acknowledgment | Scope local timers, heartbeat task, work directory, subprocess and upload lifetime | Convex Media Jobs keep durable state, leases, and recovery authority |
| Agent tool transport | `callConvex`, manifest, Zod schemas, provenance binding | Typed request failure and signal handling within transport | LangChain tools still return Promises; HTTP request/response shapes stay fixed |
| Agent execution | `runWorkerLoop`, heartbeat, liveness, graph registry | Compose process lifetime and scoped background tasks | LangGraph owns graph execution; shutdown drains outstanding work |
| Root operator scripts | `createSourceIngestor`, `fetchViaJina`, injected clients | Compose bounded capture batches and local resources | Existing CLI flags, dry runs, results, credentials and approval rules |
| Convex Node actions | PDF capture, LLM wrappers, existing internal actions | Request-local composition and typed failures inside action helpers | Convex owns transactions, scheduler, workflow steps and durable retry budgets |
| Web application | Podcast refresh, feed parser, Solid lifecycle and row identity | A browser-only request task, timeout and disposal | Solid signals, router, Convex subscriptions, auth and audio player stay native |
| Shared contracts and pure domain logic | `convex/shared`, Zod-to-Convex validators, pure tuning helpers | Keep runtime-pure values and schemas; share error DTOs only if actually needed | No Effect contexts, fibers, or runtime objects across HTTP/database seams |

Pure parsers, formatting helpers, pitch calculations, and synchronous record
transformations remain ordinary functions. Adoption covers asynchronous modules
that benefit from composition rather than every function in the repository.

## Interface rules

1. Run an Effect program once at an existing application entrypoint or a
   compatibility facade. Compose nested Effects without running a separate
   runtime for each helper. Later migrations can move that execution point
   outward as the module grows.
2. Preserve Promise-facing interfaces while neighboring modules migrate. Keep
   original error classes, status fields, and cancellation outcomes at that seam.
   Use an Exit-returning runner where outcome translation needs control.
3. Pass the fiber's ordinary `(signal)` parameter through `tryPromise` to the
   underlying fetch or process. Combine it with the caller's deadline and attempt
   cap. Interruption alone does not prove a provider stopped or a write rolled
   back. Effect cannot cancel an SDK call that ignores the signal.
4. Add `Context.Service` and Layers for dependencies with real live/test adapters,
   such as the outbound transport. Avoid one service per function or global
   service lookup. Compose the live Layer once at the module's execution seam.
5. Use scoped child fibers and `acquireRelease` for local resources. Keep cleanup
   failures observable without changing an original failure into success. Retain
   the existing best-effort exception for HTTP response-body cancellation:
   ignore its rejection so cleanup cannot replace successful audio or change
   confirmed synthesis rejection into an ambiguous outcome. Do not log raw
   provider cancellation errors, which may contain sensitive response data.
   Keep existing bounded grace periods for handlers that ignore cancellation.
6. Define failure types by the actual policy decision. For TTS, distinguish
   retryable confirmed rejection, terminal confirmed rejection, cancellation
   before any attempt, and unknown synthesis outcome. Do not retry defects or
   ambiguous completion. Use the configured provider rejection statuses.
7. Keep models, prompts, caps, trace attribution, authentication, publication
   decisions, lease ownership, and stored error codes unchanged by this refactor.
8. Keep SDK-specific Zod schemas at existing seams. Standard Schema compatibility
   does not prove a Zod-specific consumer supports Effect Schema.

V4's runtime no longer has the old FiberFailure wrapper. Outcome translation
must use the installed v4 Exit/Cause semantics rather than v3 interoperability
recipes. There is no need to introduce Effect Schema or `@effect/ai` to use the
runtime, and neither is included in this program.

## Delivery sequence and acceptance

### A. Upgrade the existing web tooling dependency

Reuse the tested Park-scoped override. Proposed implementation files:
`web/package.json` and `web/bun.lock`. Merge the override with the existing entries:

```json
"@park-ui/panda-preset": {
  "effect": "4.0.6"
}
```

Install with `vp install` in `web/`. Review the lock delta for unrelated refreshes.
Run the real web build, web typecheck, and root verification. Compare the generated
CSS with the checkout baseline. Pass when Park resolves 4.0.6 and generation and
the application build preserve behavior. Keep this change reviewable separately
from application runtime work.

### B. First application slice: media TTS request execution

Reuse the current five provider implementations and `TtsProvider` interface.
Extract request execution from `media/src/tts/types.ts` into a small module such
as `media/src/tts/request.ts`. The current import path remains a facade for
`fetchAudioWithRetry`, `SynthesisRejectedError`, retry options, and helper exports.
Keep a single rejection class identity. Effect composes the request, body read,
classified retry and cancellable backoff. Existing providers continue to call
the same Promise interface. Breeze health polling stays unchanged initially;
its shared helper behavior must remain compatible.

Expected first-slice files:

- `media/package.json` and `media/bun.lock`, adding direct `effect: 4.0.6`.
- `media/src/tts/types.ts`, retaining its provider contract and public re-exports.
- New `media/src/tts/request.ts`, owning request execution and failure policy.
- New `media/tests/tts-request.test.ts`, for focused behavior at the public seam.
- `docs/effect-v4-upgrade.md`, recording implementation evidence and remaining work.

The current provider suite is 23,306 bytes, above the repository's staged-file
limit. Do not grow or restage it unchanged. Put new targeted request tests in the
new file. If moving tests is necessary, split transport tests from provider tests
as an explicit part of this slice. Run the existing suite without editing it
when possible. Every newly staged text file must remain below 20,000 bytes.

Acceptance must preserve:

- The default three total attempts, exact backoff inputs, status-only failures,
  refused redirects, and caller signal plus 180-second attempt timeout.
- Hosted 429 retries and Breeze-configured 409/503 handling; normal 5xx,
  408/499, transport errors, and truncated success bodies do not authorize a
  second paid synthesis request.
- `SynthesisRejectedError` on validation/preflight rejection and confirmed
  rejection, including cancellation while waiting after a rejected attempt.
  Cancellation after request start retains the current ambiguous outcome policy.
- Timeout covers body consumption as well as initial fetch. Cancellation ends
  backoff promptly and starts no further attempt. Cleanup leaves no pending timer
  or abort listener owned by the module.
- Existing provider payloads, audio bytes, and request counts remain identical.

Use ordinary `vite-plus/test` tests at the Promise seam first. If internal
clock-driven Effect tests are necessary, use core testing tools and prove their
clock setup under the existing runner. Add `@effect/vitest` only after verifying
that its matching 4.0.6 adapter and Vitest instance work with Vite+. Do not change
the test runner just to adopt Effect.

Run media typechecking, the focused request suite, all media tests, then root
verification. No hosted provider request or paid voice call is needed. Pass the
slice only when it replaces the request/wait control flow rather than wrapping
the old retry loop wholesale. Review the resulting interface and diff before
the larger lifecycle conversion.

### C. Media job and resource lifetime

Reuse `runOnce`, `JobContext`, checkpoint storage, `ToolClient`, `runFfmpeg`, and
the SuperCollider process module. Move temporary-directory release and periodic
lease renewal into a scope, then scope subprocess and upload tasks.

Primary implementation locations: `media/src/runner.ts`, `media/src/main.ts`,
`media/src/convex.ts`, `media/src/upload.ts`, `media/src/audio/ffmpeg.ts`, and
`media/src/engines/sc/process.ts`. Break this into separate reviewable changes,
with runner ownership before individual process adapters.

Pass existing runner, retained-durability, checkpoint, and process tests. Prove
the 30-minute job deadline and 30-second grace behavior, non-overlapping renewal,
lease-loss cancellation, and work directory cleanup. Keep completion replay on
the same lease: retry only the acknowledgment once, never synthesis or upload.
Retained results must survive failure. A scoped finalizer must not delete durable
checkpoints on failure. A hung foreign Promise must not block cleanup forever.

### D. Agent transport, then execution lifecycle

Reuse `callConvex` in `agent/src/tools/convexTools.ts`, preserving
`ConvexToolHttpError.status`, response stripping, retained recovery input,
manifest-derived schemas, and run attribution. Keep timeout selection unchanged;
do not add broad retries to research writes. Split transport from tool/schema
binding if that reduces the module's responsibilities.

Then migrate `agent/src/worker/lifecycle.ts`, heartbeat and graph execution in
`runner.ts`, and `liveness.ts`. Reuse the graph registry and existing LangGraph
Promises/streams. Pass worker lifecycle, signal, runner, liveness, graph input,
and tool-abort suites. Shutdown must stop future claims, wake idle wait, and drain
an outstanding claim, graph, terminal write, heartbeat stop, and liveness stop.
It must not interrupt/requeue paid graph work. Keep worker concurrency at one
and terminal-status ownership in the shared contract. Observe scoped child
failures; do not silently detach heartbeat or audit tasks.

Add direct Effect only to `agent/` at this stage. Do not replace LangGraph,
LangChain tool/model contracts, LangSmith tracing, or provider selection.

### E. Root operator tooling and Convex action helpers

First reuse `scripts/lib/fetchText.ts` and `createSourceIngestor` in
`scripts/lib/ingest.ts` to compose one bounded capture batch with injected
clients. Keep CLI flags, dry-run behavior, summary types, source fences,
Varlock loading, and paid-call budgets intact. Root adds its direct dependency
when this stage starts. Run `fetchText`, ingest, and CLI subprocess tests under
their existing inert environments. Do not touch frozen archive scripts.

Then introduce Effect inside one Node action helper, starting with
`convex/pdfCaptureNode.ts`. Keep its action as an ordinary Convex action and
preserve validators and public result codes. Scope response reader cleanup
and model the existing parse/scrape outcomes. Preserve response limits,
configuration gate, one longer PDF retry, and state updates in `pdfCapture.ts`.

Validate through existing PDF Node and lifecycle tests, the runtime-boundary
test, and a deployment/build check against an explicitly isolated backend.
Do not run Convex dev/run/codegen/deploy against the live deployment. Effect
must not span `ctx.runMutation` transactions or durable workflow steps. In
particular, keep extraction workflow `retry: false` where operational recovery
owns the generation budget. Wrap `llmNode.ts` only after this action integration
passes and its model/provider contract tests remain unchanged.

### F. Browser application tasks

The first browser candidate is `PodcastEpisodes` in `web/src/routes/listen.tsx`.
It already owns a 20-second fetch timeout, a visibility-aware 60-second refresh,
request exclusion, disposal, and row reuse that preserves playback. Extract the
request task to `web/src/lib/podcast-refresh.ts`; Solid keeps signals and event
bindings. Reuse `parsePodcastFeed`. Add a direct `effect` dependency to `web/`
only when browser application code imports it.

Use core Effect imports without Node adapters. Run the existing local Listen
fixture, web typecheck and production build. Test refresh, unmount, timeout,
duplicate-trigger suppression, and unchanged native player identity. Measure
production chunk/gzip change against the same baseline. Record actual bytes
and decide on that result before expanding browser usage; do not invent a
bundle-cost target before measuring it.

The later upload candidates are `submitPdf` in `routes/ingest.tsx` and the studio
comparison submit operation. They require separate mutation/outcome handling:
cancelling a client task does not roll back stored blobs or server writes.
Do not auto-retry a submission or delete artifacts in a finalizer without an
existing server contract authorizing it. Leave Convex subscriptions, router,
Clerk auth, and Solid reactivity under their current owners.

## Stop conditions and rollout

After each stage, run its targeted checks and `vp run verify`. Web changes also
need the separate production build. Record a pre-existing failure separately
from new diagnostics. Do not expand while the changed module's required checks
fail or the retry/shutdown semantics differ.

Review each stage separately. Record adapter overhead, deleted lifecycle code,
test behavior, and operational error readability. A new service hierarchy with
unchanged old control flow does not justify wider adoption. If the first slice
does not simplify the module, revise its design before advancing.

Local acceptance uses fakes and synthetic audio without paid services. Container
smoke and isolated backend checks follow their existing tooling. Production
deployment, paid synthesis/model calls, feature gates, and human publication
remain separate operator actions under repository guidance. Roll back each stage
by reverting its code and manifest/lock change together; no schema migration is
part of this proposal.

## Decisions for review

1. First application slice: media TTS request module, recommended. Agent worker
   lifecycle is an alternative, but shutdown and claim draining make it a larger
   first integration. Both remain in the overall program.
2. Initial implementation authorization: stages A through D. The user selected
   the wider delivery after reviewing the plan. Stages E and F need their own
   integration and browser evidence before expansion.

## Research and verification state

The planning pass ended after approval. Implementation now changes only package
manifests, package lockfiles, and the stage A-D modules and tests named above.
It must not contact production or make paid provider calls.
At planning time, the checkout had no package installations. `vp run verify`
was attempted again and stopped immediately because project-local Vite+/Biome
was absent. This was the same pre-existing setup blocker as the research pass.
The proposal made no claim of green implementation checks at planning time;
the completed implementation and acceptance evidence are recorded above.

Primary references: [v4 migration entry point][migration], [services][services],
[error recovery][errors], [forking][forking], [published 4.0.6 package][release],
and the [upstream research](../research/2026-10-26-effect-v4-upstream.md).
The exact published 4.0.6 source confirms `tryPromise`, `runPromiseExit`,
`Context.Service`, scoped lifetime and runner signal options. Current `main`
documentation can be newer than that target.

[migration]: https://github.com/Effect-TS/effect/blob/main/MIGRATION.md
[services]: https://github.com/Effect-TS/effect/blob/main/migration/services.md
[errors]: https://github.com/Effect-TS/effect/blob/main/migration/error-handling.md
[forking]: https://github.com/Effect-TS/effect/blob/main/migration/forking.md
[release]: https://registry.npmjs.org/effect/4.0.6
