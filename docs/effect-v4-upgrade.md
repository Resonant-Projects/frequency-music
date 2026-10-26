# Effect v4 upgrade investigation

Investigated and implemented locally on 2026-10-26. The initial research and
disposable compatibility experiment established the Park upgrade path. The
user then approved application adoption through stages A-D. The implementation
changes web, media, and agent dependencies and execution modules. Production
state has not changed.

Published [research write-up](https://18nonbls26f1.postplan.dev),
[version 1](https://18nonbls26f1.postplan.dev/v/1).

The requested scope includes both the dependency upgrade and direct application
adoption. The [adoption proposal](plans/2026-10-26-effect-v4-adoption.md) maps the
full program and recommends the media TTS request module as the first slice.
The user approved stages A through D. The first application slice is media TTS,
followed by media job lifetime and agent transport/lifecycle work. Stages E and F
remain deferred until those results are reviewed.
The [published adoption plan](https://t2ljqvkt6g1c.postplan.dev) covers both scopes.

## Recommendation

At the research baseline, upgrading the existing dependency was a small web
tooling change. Frequency had no direct Effect dependency or application
imports from `effect` or `@effect/*`. Its only locked Effect dependency was
`effect@3.10.15`, required exactly by `@park-ui/panda-preset@0.43.1` in `web/`.

An Effect-based application architecture would be a separate adoption project.
It would introduce Effect into existing Promise-based code rather than migrate
existing Effect programs. Do not estimate that work from the transitive upgrade.

## Application implementation through stage D

- Web now scopes its Effect 4.0.6 override to Park. The actual production build
  passes, and the generated CSS retains SHA-256
  `62e6a1f919f80034b866bb75bf937a0a405f170584ade3046e27700e5e914a33`.
  The lockfile removes only the old Effect resolution and its unused fast-check
  dependencies, then records the scoped override and 4.0.6.
- Media and agent each declare direct `effect: 4.0.6` in their own manifest and
  lockfile. Root has no new runtime dependency.
- Media `tts/request.ts` owns typed rejection/unknown-outcome branches,
  request/body deadlines, cancellable waiting, and request resource cleanup.
  `tts/types.ts` preserves provider imports and the single rejection class.
  `Context.Service` and a Layer supply the current fetch implementation.
- Media `runner.ts` composes checkpoint reads/writes and job execution. Its
  Promise facade remains, while `main.ts` composes `runOnceEffect` directly.
  `jobLifetime.ts` owns scoped lease renewal and bounded handler completion.
  Renewal still checks expiry while an earlier request is pending and never
  overlaps renewals. Deadline/grace and retained-result acknowledgment rules
  remain unchanged. Temporary work directories are scoped separately from
  durable checkpoints.
- Media upload, HTTP, FFmpeg and SuperCollider adapters use Effect request or
  process execution. The renderer resource kills and waits for child close
  before releasing its work directory. FFmpeg retains native timeout and
  SIGKILL behavior. None of these adapters adds request retries.
- Agent `convexHttp.ts` owns scoped transport. `convexTools.ts` keeps the
  manifest-derived schemas, provenance binding, response stripping, retained
  recovery exception, and Promise interface. HTTP error class/status remain.
  A derived signal joins caller cancellation with request lifetime; tests now
  assert propagation rather than signal object identity.
- Agent lifecycle scopes signal subscriptions and cancellable idle waits.
  Graph execution scopes heartbeat maintenance; the process scopes liveness.
  `maintenance.ts` preserves native unref'ed interval cadence while owning
  task fibers in a Scope. Closing it stops future ticks and drains pending,
  natively bounded requests. Active graphs and terminal writes are not cancelled
  by a shutdown signal.

Stages E and F, operator/Convex action helpers and browser request tasks, remain
outside this delivery. There are no schema, model, prompt, publication, or
production rollout changes.

### Local implementation checks

All package dependencies were installed through `vp install`; baseline installs
used frozen lockfiles. The previously missing Biome/Vite+ setup blocker is now
resolved in this checkout. The installed baseline passed full verification.

The actual web build and CSS comparison pass. Focused TTS, lease, transport,
OS-signal, shutdown, heartbeat and liveness checks pass. Full repository
verification passes 2,447 tests, including the final custom-backoff regression
check. Independent GPT-6.1 Sol/high review completed with no actionable P0-P3
findings. See the [local acceptance record](evidence/effect-v4-20261026.md).
The additional test preserves the original rejection
classification when provider-specific backoff computation fails.

The full agent suite initially exposed a synchronous fetch fake and an MCP
signal identity assertion. The transport retains the old `await` tolerance for
the fake, while the MCP test checks that request scope cancellation does not
cancel the caller's controller. The unchanged compatibility suites then pass.

Existing warnings remain for Park's unused fieldset selector, large web chunks,
root lint advisories, AI SDK deprecations and test-clock timeout overflow. No
warning suppression was added. Local verification uses mocked services and
synthetic media; no production or paid-provider acceptance is claimed.

## Baseline dependency path

```text
web/package.json
  @park-ui/panda-preset ^0.43.1
    effect 3.10.15
      fast-check ^3.21.0
```

Evidence collected before implementation:

- All four manifests and lockfiles were searched. Only `web/bun.lock` contains
  Effect. Root, agent, and media have no locked Effect package.
- A search of active tracked source found no `effect` or `@effect/*` imports.
- `web/panda.config.ts` imports Park's `createPreset`, gold, and slate. It selects
  `radius: "lg"`.
- The published Park ESM and CommonJS bundles use Effect only in `createRadii`.
  It calls `Match.value`, `Match.when`, and `Match.orElse`.
- This is the Panda configuration path. It is not an existing Effect runtime in
  the Convex backend, agent worker, media worker, or browser application.

Sources: [Park 0.43.1 metadata][park], [published Park bundle][park-bundle],
[`web/panda.config.ts`](../web/panda.config.ts),
[`web/bun.lock`](../web/bun.lock), and the four package manifests.

## Published targets

The live npm registry returned `effect` latest **4.0.6**, prev **3.22.4**, beta
**4.0.0-beta.107**, and rc **4.0.0-rc.118**. Use the stable version for this
experiment. Context7 still lists prerelease documentation versions, so the
registry and exact published source take precedence for installation details.

Park's latest tag still points to **0.43.1**. Its manifest pins Effect to
**3.10.15**. There is no newer published preset to select for a declared v4
dependency. A local override therefore establishes Frequency's tested
compatibility, not upstream-declared support.

Sources: [Effect registry][effect], [Effect 4.0.6 metadata][effect4],
[Park registry][park-registry], [Park 0.43.1 metadata][park].

## What makes v4 a major migration elsewhere

The [upstream research](research/2026-10-26-effect-v4-upstream.md) records
the complete source links and compatibility objections. The changes that
would matter if Frequency later adopts Effect include:

- Services use `Context.Service`; `Effect.Service` and its generated default
  layers give way to explicit layers.
- Recovery APIs change, including `catchAll` to `catch`, and cause handling
  changes semantics for mixed typed failures and defects.
- `Either` becomes `Result`, and `Effect.either` becomes `Effect.result`.
- `Effect.fork` becomes `forkChild`; detached work uses `forkDetach`. Startup
  scheduling and process lifetime require behavioral checks.
- Schema has changed constructors, transformations, and decoding APIs.
  Standard Schema support does not make it a drop-in replacement for the
  project's Zod-specific contracts.
- Platform, CLI, HTTP, and other modules consolidate into `effect`. Stable
  4.0.6 uses paths such as `effect/http` and `effect/cli`; early beta guidance
  about `effect/unstable/*` does not describe the stable package exports.
- Node/Bun adapters and `@effect/vitest` remain separate packages. Use
  compatible v4 versions when they are actually needed.

These are upstream migration concerns, not changes required by Park's three
`Match` functions. For future direct adoption, select one bounded module and
preserve its public contracts while evaluating error handling, cancellation,
and resource cleanup. Do not combine this dependency update with a rewrite
of Convex, Zod contracts, LangGraph, or media execution.

Sources: [official migration entry point][migration],
[generated API map][migration-map], and [published stable package][effect4].
The upstream guides on `main` can describe changes newer than the installed
release; verify chosen APIs against the exact published target.

## Disposable experiment

Two independent fixture packages used Bun 1.4.2 through `vp install`, Panda
2.2.0, Panda preset-base 2.2.0, and Park 0.43.1. One used Effect 3.10.15.
The other selected 4.0.6 through a Park-scoped override. The final v4 fixture
had no direct Effect dependency. Runtime module resolution confirmed that
Park resolved to the selected Effect version in each fixture.

No fixture installed into or generated files in this checkout. The temporary
directory for this run was `/tmp/frequency-effect-v4-shm7fh7v`.

| Check | Result |
| --- | --- |
| Unchanged published `createRadii` helper, seven supported choices plus invalid and undefined fallbacks | Identical JSON, 858 bytes |
| Complete `createPreset` output, gold/slate, all seven radius choices | Identical JSON, 574,085 bytes |
| Park CommonJS radius helper under Node 24.22.1 with Effect v4 | Passed for the actual `lg` setting |
| Panda clean code generation against copies of the actual config and source | Passed on both versions |
| Panda CSS generation across 101 source files | Passed on both versions |
| All generated files | All 235 paths and file contents identical |
| Generated CSS | 73,548 bytes on both versions |

SHA-256 of the complete preset output:
`e9d39d7f4677bdb19d8a60e7709080acb040497d8330f3926552ab9c660adfbe`.

SHA-256 of `styled-system/styles.css`:
`62e6a1f919f80034b866bb75bf937a0a405f170584ade3046e27700e5e914a33`.

Both versions emitted the existing Park fieldset `+ *` selector warning.
There was no difference in diagnostics. The fixture initially omitted
`@pandacss/preset-base` and failed to resolve it on both versions; adding the
same 2.2.0 dependency that the real web package declares resolved that setup
error before the reported successful comparisons.

### Reproduce the comparison

Create two disposable packages with these dependencies:

```json
{
  "private": true,
  "type": "module",
  "packageManager": "bun@1.4.2",
  "dependencies": {
    "@pandacss/dev": "2.2.0",
    "@pandacss/preset-base": "2.2.0",
    "@park-ui/panda-preset": "0.43.1"
  }
}
```

Leave the baseline package unchanged. In the v4 package add:

```json
{
  "overrides": {
    "@park-ui/panda-preset": {
      "effect": "4.0.6"
    }
  }
}
```

Run `vp install` in each package. Copy `web/panda.config.ts` and `web/src/`
into each fixture. Run the fixture's Panda executables with
`panda codegen --clean` followed by `panda cssgen`.
Compare the relative paths and bytes of all files under `styled-system/`.

For complete preset data, run this in each fixture and compare stdout:

```js
import { createPreset } from "@park-ui/panda-preset";
import gold from "@park-ui/panda-preset/colors/gold";
import slate from "@park-ui/panda-preset/colors/slate";

const radii = ["none", "xs", "sm", "md", "lg", "xl", "2xl"];
console.log(JSON.stringify(Object.fromEntries(radii.map((radius) => [
  radius,
  createPreset({ accentColor: gold, grayColor: slate, radius }),
]))));
```

## Proposed existing-dependency upgrade

1. Add the scoped override above to `web/package.json`, alongside its current
   overrides. Do not add a direct application dependency on Effect.
2. Run `vp install` in `web/`. Review the `web/bun.lock` delta and confirm Park
   resolves Effect 4.0.6. Avoid unrelated dependency refreshes.
3. Run the actual web build, which already performs clean Panda generation,
   then web typechecking. Compare generated CSS with a baseline.
4. Run `vp run verify` from the root. Review the UI locally if the real build
   produces any CSS difference. No production Convex command is needed.
5. Keep the override scoped to Park. Reassess it when upstream publishes a
   compatible preset, so future direct consumers do not inherit a broad major
   version override.

The expected tracked implementation change is `web/package.json` and
`web/bun.lock`, plus concise compatibility evidence. No Effect API rewrites
are indicated by the code or the experiment.

> 🧠 **From Hindsight memory (Conventions and patterns)** — Root verification
> covers package typechecks and unit suites; the web production build is a
> separate check. The current root and web package scripts confirm this.

## Initial research verification limit

`vp run verify` was attempted in the checkout and failed before running
formatting, lint, typechecks, or tests:

```text
No project-local vite-plus installation was found.
Failed to find executable biome under cwd ...
cannot find binary path
```

The checkout had no root, web, agent, or media `node_modules` before the research
pass. This was a pre-existing setup blocker, resolved during the approved
implementation by installing the four package lockfiles. The earlier fixture
evidence remains above; the actual build and repository suite now pass as
described in the implementation section. No production command, deployment,
paid inference, or browser journey ran.

[effect]: https://registry.npmjs.org/effect
[effect4]: https://registry.npmjs.org/effect/4.0.6
[park]: https://registry.npmjs.org/@park-ui%2fpanda-preset/0.43.1
[park-registry]: https://registry.npmjs.org/@park-ui%2fpanda-preset
[park-bundle]: https://unpkg.com/@park-ui/panda-preset@0.43.1/dist/chunk-LS3ONKWL.js
[migration]: https://github.com/Effect-TS/effect/blob/main/MIGRATION.md
[migration-map]: https://github.com/Effect-TS/effect/blob/main/migration/v3-to-v4.md
