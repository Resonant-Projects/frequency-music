# Effect TypeScript tooling

All four TypeScript projects use `@effect/tsgo` 0.59.0 for TypeScript 7.0.2 checks. Each package owns its dev dependency, lockfile, and `tsconfig.json` plugin configuration.

## Install and typecheck

Run `vp install` in the root, `web/`, `agent/`, and `media/` directories. Root, web, and media `prepare` hooks run `effect-tsgo patch --typescript --no-oxlint`, so their existing `vpx tsc` commands use the Effect compiler. The root hook also retains `vp config --no-agent` for the Vite+ Git hooks.

Agent retains TypeScript 5.9.3 for LangGraph CLI peer compatibility. Its `verify` script runs `effect-tsgo tsc@7.0.2 --noEmit` directly; root `typecheck:agent` invokes the same compiler command. This uses the compiler shipped by `@effect/tsgo` without patching the agent's TypeScript 5 package. For direct agent checks, run `vp run verify`, rather than `vpx tsc`.

The patch hook skips when `@effect/tsgo` is absent. Agent and media container builds can continue using production installs that omit dev dependencies and peers.

Run `vp run typecheck` from the root to check all four projects, or `vp run verify` for the full local checks. Effect errors fail typechecking. Effect warnings and suggestions remain visible but do not change the exit code. Each plugin explicitly sets `ignoreEffectWarningsInTscExitCode: true`; suggestions already have that behavior by default.

Only the TypeScript integration is patched. Oxlint remains configured through each package's Vite+ config.

## Editor

The root `.vscode/settings.json` enables native TypeScript and selects `./node_modules/typescript/bin` as the workspace SDK. Because installation patches that SDK, the editor can use Effect diagnostics, completions, and refactors through the existing TypeScript service.

After installation, reload the editor or restart its TypeScript server and select the workspace TypeScript version if prompted. The host editor must support native TypeScript 7. Use this service as the only TypeScript language server to avoid duplicate diagnostics. Compiler integration is verified locally; editor attachment depends on the editor process and its installed extensions.

## Reconfigure

The upstream setup options are available through:

```sh
vpx effect-tsgo setup --help
```

Run setup from the directory of the package being changed. `--project` selects the tsconfig; it does not change which package.json receives dependencies and scripts. The initial setup used:

```sh
vpx effect-tsgo setup --project tsconfig.json \
  --non-interactive --accept-defaults --apply \
  --typescript --no-oxlint --dependency-type devDependencies --vscode
```

Use `--no-vscode` in the three subpackages. Preserve the guarded prepare hooks and warning exit-code setting if reapplying setup. In agent, keep the direct `verify` command and omit compiler patching to preserve the TypeScript 5 peer dependency. Use `vp install` after changing dependencies.

Upstream: <https://github.com/Effect-TS/tsgo>.
