# Repository guidance

## Sources of truth

- Root, `web/`, `agent/`, and `media/` are separate packages and TypeScript projects. Each owns its own `package.json` scripts, `vite.config.ts`, `tsconfig.json`, and `.env.schema`; an edit to one config rarely belongs in the others.
- `biome.json` owns formatting; the `lint` block in `vite.config.ts` owns oxlint rules. Keep each rule in one config, never both.
- `convex/schema.ts`, `convex/shared/`, and `convex/llm.ts` own data models, cross-seam contracts, and model configuration.

## Guardrails

- Convex is one live self-hosted deployment. `run`, `dev`, `codegen`, and `deploy` commands can contact production; confirm the target and effects before running them.
- Model policy: automated cron extractions use `DEFAULT_MODEL` (GPT-5.6 Terra); a manual re-extraction may pass a stronger model, historically Claude Opus, through the `model` override. Register any new model id in `MODELS` so `scripts/check-model-catalog.ts` verifies it. Llama models are excluded by policy, whatever a provider offers.
- `AUTH_BYPASS_ENABLED=true` is an intentional standing non-human service identity, not a development misconfiguration.
- CLI mutations require `devBypassSecret`. Resolve it through Varlock and 1Password; never print, paste, or commit the value.
- `/agent-tools/*` uses `AGENT_TOOL_SECRET`. Irreversible hypothesis and recipe publication remains human-approved; agents may prepare drafts and reversible provenance-bearing data only within the documented tool contract.
- `media/` (the media service on ai-5090-02) is a second standing service identity using `AGENT_TOOL_SECRET`; its tools are lifecycle writes only and are listed under 'Media lifecycle tools' in `docs/agent-tool-surface.md`.
- Cron `reconcile-episodes` (Saturday 02:00 UTC) narrates any brief of the last 14 days without a ready episode; `episodes.enqueueShootout`, `episodes.narrateBrief`, and `episodes.reconcile` enqueue real media jobs and contact production when run.
- Hosted TTS keys (`GEMINI_API_KEY`, `INWORLD_API_KEY`, `ELEVENLABS_API_KEY`) are optional on the media host: a missing key skips that voice in a shootout and fails a narration that names it. The local voice speaks Breeze TTS 2's own server API (`BREEZE_TTS_BASE_URL`; multipart form `text`/`instruction`/`cfg_scale`, raw 24 kHz PCM back, 409 while busy, 503 while loading); `tts-local` must answer `GET /health` 200 before a shootout, and the media provider waits up to 5 minutes for it. `BREEZE_TTS_BASE_URL` has no schema default: the compose file sets it, and clearing it retires the local voice so a shootout skips Breeze instead of waiting on a stopped `tts-local`.
- Wave 1 masters are 16-bit PCM because Cloudflare caps one proxied request body at 100 MB; `MAX_UPLOAD_BYTES` (95 MB) is checked before a narration, episode, or shootout upload URL is minted. Move masters to FLAC before raising it.
- Convex file storage is owned by `audioArtifacts`: `mediaSweeper` deletes any `_storage` blob older than 24 hours that no `audioArtifacts` row references, so a new table that stores `_storage` ids must be added to the sweeper's reference check first.
- Run TypeScript with `vpx tsx` and install with `vp install`. Node scripts read `.env.local` only through `import "varlock/auto-load"` at the top of the file; the runtime loads nothing on its own.
- Operator evidence exception: `scripts/frequency-queue-evidence.ts`, `scripts/convex-provenance-verify.ts`, `scripts/convex-module-identities.ts`, `scripts/convex-deployment-inspect.ts`, and its `scripts/frequency-semantic-capture.mjs` supervisor use inherited `CONVEX_SELF_HOSTED_ADMIN_KEY` only, without `.env` or Varlock loading. See `docs/frequency-worker-handoff.md` for their read-only scope and deployment prerequisites.
- In-process unit tests mock `varlock/auto-load`. Tests that spawn a CLI subprocess set `APP_ENV=test`; keep `.env.test` synchronized with `.env.schema` using inert placeholders.
- Keep contracts shared across runtime seams in `convex/shared/`.
- `scripts/archive/` is frozen reference: read it, never run, format, or edit it.

## Load on demand

- Purpose and setup: `README.md`
- Domain vocabulary: `CONTEXT.md`
- Current work and ordering: `docs/plans/README.md`
- Agent API, runtime, and tracing: `docs/agent-tool-surface.md`, `agent/README.md`, `docs/langsmith-runbook.md`
- Backend recovery inventory and isolated restore rehearsal tooling: `docs/frequency-backend-recovery-preparation-20260913.md`, `scripts/recovery/`
- Product doctrine: `docs/vision-and-meaning.md`
- Web UI design system: `DESIGN.md` (tokens, opacity tiers, named rules) and `web/docs/zodiac-style-guide.md` (3D geometry)

Run targeted checks while iterating, then `vp run verify` before handoff. If it cannot run, report the exact blocker and whether it predates the change.
