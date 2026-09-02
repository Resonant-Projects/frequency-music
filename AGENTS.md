# Repository guidance

## Sources of truth

- Root, `web/`, and `agent/` are separate packages and TypeScript projects. Each owns its own `package.json` scripts, `vite.config.ts`, `tsconfig.json`, and `.env.schema`; an edit to one config rarely belongs in the others.
- `biome.json` owns formatting; the `lint` block in `vite.config.ts` owns oxlint rules. Keep each rule in one config, never both.
- `convex/schema.ts`, `convex/shared/`, and `convex/llm.ts` own data models, cross-seam contracts, and model configuration.

## Guardrails

- Convex is one live self-hosted deployment. `run`, `dev`, `codegen`, and `deploy` commands can contact production; confirm the target and effects before running them.
- Model policy: pick from `MODELS` in `convex/llm.ts`. GPT-5.6 Terra is the default for automated cron extractions and Opus for manual re-extractions; Llama models are excluded by policy, whatever a provider offers.
- `AUTH_BYPASS_ENABLED=true` is an intentional standing non-human service identity, not a development misconfiguration.
- CLI mutations require `devBypassSecret`. Resolve it through Varlock and 1Password; never print, paste, or commit the value.
- `/agent-tools/*` uses `AGENT_TOOL_SECRET`. Irreversible hypothesis and recipe publication remains human-approved; agents may prepare drafts and reversible provenance-bearing data only within the documented tool contract.
- Run TypeScript with `vpx tsx` and install with `vp install`. Node scripts read `.env.local` only through `import "varlock/auto-load"` at the top of the file; the runtime loads nothing on its own.
- In-process unit tests mock `varlock/auto-load`. Tests that spawn a CLI subprocess set `APP_ENV=test`; keep `.env.test` synchronized with `.env.schema` using inert placeholders.
- Keep contracts shared across runtime seams in `convex/shared/`.
- `scripts/archive/` is frozen reference: read it, never run, format, or edit it.

## Load on demand

- Purpose and setup: `README.md`
- Domain vocabulary: `CONTEXT.md`
- Current work and ordering: `docs/plans/README.md`
- Agent API, runtime, and tracing: `docs/agent-tool-surface.md`, `agent/README.md`, `docs/langsmith-runbook.md`
- Product doctrine: `docs/vision-and-meaning.md`
- Web UI design system (palette, type, opacity, components): `web/docs/zodiac-style-guide.md`

Run targeted checks while iterating, then `vp run verify` before handoff. If it cannot run, report the exact blocker and whether it predates the change.
