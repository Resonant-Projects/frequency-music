# Repository guidance

## Sources of truth

- Package files own commands and package-manager behavior; root, `web/`, and `agent/` are separate package and TypeScript projects.
- `vite.config.ts`, `tsconfig.json`, and `biome.json` own tooling behavior.
- `.env.schema` owns environment configuration.
- `convex/schema.ts`, `convex/shared/`, and `convex/llm.ts` own data models, cross-seam contracts, and model configuration.

## Guardrails

- Convex is one live self-hosted deployment. `run`, `dev`, `codegen`, and `deploy` commands can contact production; confirm the target and effects before running them.
- `AUTH_BYPASS_ENABLED=true` is an intentional standing non-human service identity, not a development misconfiguration.
- CLI mutations require `devBypassSecret`. Resolve it through Varlock and 1Password; never print, paste, or commit the value.
- `/agent-tools/*` uses `AGENT_TOOL_SECRET`. Irreversible hypothesis and recipe publication remains human-approved; agents may prepare drafts and reversible provenance-bearing data only within the documented tool contract.
- In-process unit tests mock `varlock/auto-load`. Tests that spawn a CLI subprocess set `APP_ENV=test`; keep `.env.test` synchronized with `.env.schema` using inert placeholders.
- Keep contracts shared across runtime seams in `convex/shared/`.
- `scripts/archive/` is frozen reference. Do not run, format, or edit archived one-shot scripts.

## Load on demand

- Purpose and setup: `README.md`
- Domain vocabulary: `CONTEXT.md`
- Current work and ordering: `docs/plans/README.md`
- Agent API and runtime: `docs/agent-tool-surface.md` and `agent/README.md`
- Product and design doctrine: `docs/vision-and-meaning.md`

Run targeted checks while iterating, then `vp run verify` before handoff. If it cannot run, report the exact blocker and whether it predates the change.
