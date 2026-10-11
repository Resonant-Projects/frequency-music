# Web dependency upgrade research

Checked on 2026-10-11 against `web/bun.lock`, `bun outdated` in `web/`, official migration guides, published npm metadata, and upstream source. The starting versions are the merged PR #123 baseline. Targets use the registry's stable `latest` tag.

## Versions and compatibility

Each registry link identifies the exact published target and its declared requirements.

| Package | Starting version | Target | Published requirements |
| --- | --- | --- | --- |
| `@clerk/clerk-js` | 5.125.7 | [6.39.0](https://registry.npmjs.org/@clerk%2fclerk-js/6.39.0) | Node >=20.9.0; no peer dependencies |
| `@tanstack/solid-router` | 1.168.9 | [1.170.39](https://registry.npmjs.org/@tanstack%2fsolid-router/1.170.39) | Node >=20.19; `solid-js ^1.9.10` |
| `solid-js` | 1.9.12 | [1.9.17](https://registry.npmjs.org/solid-js/1.9.17) | No engines or peers declared |
| `three` | 0.183.2 | [0.186.1](https://registry.npmjs.org/three/0.186.1) | No engines or peers declared |
| `@types/three` | 0.183.1 | [0.186.0](https://registry.npmjs.org/@types%2fthree/0.186.0) | Match Three revision 186; no peer constraints |
| `@fontsource/cormorant-garamond` | 5.2.11 | [5.3.0](https://registry.npmjs.org/@fontsource%2fcormorant-garamond/5.3.0) | No engines or peers declared |
| `@fontsource/jetbrains-mono` | 5.2.8 | [5.3.0](https://registry.npmjs.org/@fontsource%2fjetbrains-mono/5.3.0) | No engines or peers declared |
| `@pandacss/dev` | 1.9.1 | [2.2.0](https://registry.npmjs.org/@pandacss%2fdev/2.2.0) | Node >=22; `postcss >=8` |
| `@playwright/test` | 1.59.1 | [1.64.0](https://registry.npmjs.org/@playwright%2ftest/1.64.0) | Node >=20 |
| `@types/node` | 24.13.3 | [26.6.5](https://registry.npmjs.org/@types%2fnode/26.6.5) | Type declarations only; no engine constraints |
| `vite`, aliased to `@voidzero-dev/vite-plus-core` | 1.0.0 | [1.1.0](https://registry.npmjs.org/@voidzero-dev%2fvite-plus-core/1.1.0) | Node `^20.19.0 || ^22.18.0 || >=24.11.0`; TypeScript peer includes majors 5, 6, and 7; Node types peer includes 26 |
| `vite-plugin-solid` | 2.11.12 | [2.11.14](https://registry.npmjs.org/vite-plugin-solid/2.11.14) | `solid-js ^1.7.2`; Vite majors 3 through 9 |
| `vite-plus` | 0.1.16 | [1.1.0](https://registry.npmjs.org/vite-plus/1.1.0) | Node `^22.18.0 || ^24.11.0 || >=26.0.0`; bundles upstream Vitest 5.0.3 |

Solid's `next` tag is `2.0.0-rc.14` and the plugin's `next` tag is `3.0.0-next.27`. These are prereleases, outside the stable Latest inventory. [Solid registry](https://registry.npmjs.org/solid-js), [plugin registry](https://registry.npmjs.org/vite-plugin-solid).

The installed `@park-ui/panda-preset 0.43.1` is already latest. Its Panda peer range is `>0.22.0`, which permits 2.2.0. Its published bundle still uses some v1 syntax, discussed below. [Preset metadata](https://registry.npmjs.org/@park-ui%2fpanda-preset/0.43.1).

## Clerk 6 migration

Replace the removed `@clerk/clerk-js/headless` import. Version 6.39.0 exports only the package root and `/no-rhc`. [Published exports](https://registry.npmjs.org/@clerk%2fclerk-js/6.39.0).

Replace `afterSignInUrl` and `afterSignUpUrl` with `signInFallbackRedirectUrl` and `signUpFallbackRedirectUrl`. Keep the existing environment values and `/` defaults. Fallback redirects preserve the hosted `redirect_url` query parameter; forced redirects override it. `session.getToken()` can now reject with `ClerkOfflineError`; the existing Convex provider catches token-fetch errors. [Core 3 migration](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3), [shared redirect types](https://github.com/clerk/javascript/blob/main/packages/shared/src/types/redirects.ts).

For this direct JavaScript integration, omit `ui` from `Clerk.load()`. Clerk initializes its UI only when `options.ui.ClerkUI` is supplied. `prefetchUI` belongs to the SDK wrapper's `IsomorphicClerkOptions`; it is not a direct `ClerkOptions` field. [Clerk load implementation](https://github.com/clerk/javascript/blob/main/packages/clerk-js/src/core/clerk.ts), [published shared types](https://registry.npmjs.org/@clerk%2fshared/4.40.0).

The `/no-rhc` export means "omit remotely hosted code". Its build excludes Stripe, Coinbase, and Base account imports while using the same Clerk source entry and types. Frequency uses hosted sign-in and JWT session management, with no embedded checkout or wallet flows, so this export fits the current integration. [Official bundle configuration](https://github.com/clerk/javascript/blob/main/packages/clerk-js/rspack.config.mjs).

The downloaded 6.39.0 tarball contains a 1,539,894-byte root ESM bundle and an 839,194-byte `/no-rhc` bundle. These are package file sizes, not application gzip sizes. A true v5-style headless export is absent; upstream tracks the resulting weight in an open issue. [Published tarball metadata](https://registry.npmjs.org/@clerk%2fclerk-js/6.39.0), [upstream issue #9417](https://github.com/clerk/javascript/issues/9417).

## Panda 2 migration

Panda 2 requires ESM and Node 22+. Add `@pandacss/preset-base 2.2.0` before the custom Park preset because base utilities and conditions are no longer implicit. Regenerate once with `panda codegen --clean`, then `panda cssgen`, so stale v1 `.mjs` files cannot override v2 `.js` files. Generated `Token` imports move out of `styled-system/tokens`. The regenerated 2.2.0 output defines this type in `styled-system/types/tokens.d.ts`, which is the new import in `zodiac-data.ts`. Existing theme `extend` blocks remain valid. [Panda upgrade guide](https://panda-css.com/docs/get-started/upgrading-to-v2).

Panda changes shorthand sorting; use longhand side widths where a side must override a border shorthand. Array conditions remain supported through conversion but are deprecated. The compiler now emits variable defaults through `@property`; `optimize.propertyFallback` restores declarations for older browsers. Clean generation, typechecking, and a built-page inspection should check the resulting CSS. [Panda upgrade guide](https://panda-css.com/docs/get-started/upgrading-to-v2).

The installed Park bundle defines `conditions.hover` as an array and a fieldset legend selector as `"+ *"`. Panda reports the former as deprecated and the latter as invalid. The app's only native fieldset, in `web/src/routes/hypotheses.tsx`, uses its own `css()` call and does not consume the Park fieldset recipe. The migration overrides hover with the object form, retaining `@media (hover: hover) and (pointer: fine)` and `&:is(:hover, [data-hover])`. The unused upstream fieldset warning remains. [Published preset bundle](https://unpkg.com/@park-ui/panda-preset@0.43.1/dist/index.js).

## Three.js revision 186

Upgrade Three and its types together. The baseline is revision 183, so only migrations 183 through 186 apply. Relevant changes include `Object3D.dispose()`, `Source` becoming `TextureSource`, and `updateWorldMatrix()` requiring `matrixWorldNeedsUpdate` when callers manually edit matrices with automatic updates disabled. Other changes affect WebGPU, loaders, and specialized modifiers. [Official migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide).

The repository uses `WebGLRenderer`, `OrbitControls`, standard geometries, `InstancedMesh`, and WebGL postprocessing. Searches found no Three subclasses with custom `dispose()` implementations, manual matrix-update flags, renamed texture sources, affected loaders, or the changed modifiers. No source migration is indicated by that comparison. Typecheck both scenes and inspect the atlas and zodiac routes after installation.

## Vite Plus 1 migration

Keep `vite-plus` and the `vite` alias on 1.1.0. Its published dependencies use `vite: npm:@voidzero-dev/vite-plus-core@1.1.0` and upstream `vitest: 5.0.3`. Remove the old global `vitest: npm:@voidzero-dev/vite-plus-test@latest` override. That fork's latest version remains 0.1.24 and uses Vitest 4.1.8 peers; a fabricated 1.1.0 target does not exist. [Vite Plus metadata](https://registry.npmjs.org/vite-plus/1.1.0), [old test fork metadata](https://registry.npmjs.org/@voidzero-dev%2fvite-plus-test/latest).

Vite Plus 1 includes Vitest 5 changes and stricter CLI Node requirements. Its guide requests migration against the original lockfile before updating dependencies. Test entry points and unsupported APIs need review across all packages, even though the web package's browser tests use Playwright. [Official migration guide](https://viteplus.dev/guide/migrate), [Vitest 5 compatibility guide](https://viteplus.dev/guide/vitest-v5).

## Remaining packages and verification

TanStack's latest Solid release changes link destination reuse, pending preload cancellation, and memoization. Frequency uses router navigation and Link components, so check route navigation after the upgrade. [Solid router changelog](https://github.com/TanStack/router/blob/main/packages/solid-router/CHANGELOG.md).

The latest Vite Solid plugin release widens an optional testing-library peer range. Its published Vite and Solid peers accept the selected targets. [Plugin release](https://github.com/solidjs/solid-vite-plugin/releases/tag/vite-plugin-solid@2.11.14), [package metadata](https://registry.npmjs.org/vite-plugin-solid/2.11.14).

Font upgrades need the existing weight and italic CSS imports to resolve in the web build. Node types require typechecking; installing version 26 types does not change the runtime. Solid is a patch upgrade within the router and plugin's declared ranges. These checks should precede the full repository verification.

Playwright browsers are version-specific. Install the selected Chromium revision before browser execution. The repository's authenticated end-to-end suite must retain its production-target guardrails; upgrading its runner does not authorize live mutations. [Official browser installation guidance](https://playwright.dev/docs/browsers).

## Verification results

The implementation lane completed the following checks on the upgraded package:

- `panda codegen --clean` and `panda cssgen` succeeded. The unused upstream Park fieldset warning remains; the hover deprecation warning is gone.
- Web typechecking and lint passed after the backend lane resolved root aggregate integration errors.
- The web production build passed. Selecting Clerk `/no-rhc` reduced the built entry from about 650 kB gzip with the root Clerk export to about 410 kB gzip. This comparison uses the same upgraded app and build setup.
- A browser smoke checked essays and the atlas with inert backend configuration and no page errors.
- A final `bun outdated` in `web/` returned no remaining entries.

The full repository's `vp run verify` remains a separate handoff requirement; check its final result in the change report. Biome does not process this Markdown file under the repository's current configuration.
