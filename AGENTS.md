# Repository guidance

## Sources of truth

- Root, `web/`, `agent/`, and `media/` are separate packages and TypeScript projects. Each owns its own `package.json` scripts, `vite.config.ts`, `tsconfig.json`, and `.env.schema`; an edit to one config rarely belongs in the others.
- `biome.json` owns formatting; the `lint` block in `vite.config.ts` owns oxlint rules. Keep each rule in one config, never both.
- `convex/schema.ts`, `convex/shared/`, and `convex/llm.ts` own data models, cross-seam contracts, and model configuration.

## Guardrails

- Before adding complexity for a speculative or vanishingly unlikely race or security edge case, explain the concrete failure mode, likelihood, and complexity cost to the user and get their buy-in. Do not silently expand scope for theoretical robustness.
- Convex is one live self-hosted deployment. `run`, `dev`, `codegen`, and `deploy` commands can contact production; confirm the target and effects before running them.
- Model policy: worker and Convex inference use direct Anthropic with the 1Password-backed `ANTHROPIC_API_KEY`. `convex/shared/llmPolicy.ts` assigns Sonnet 5.5 to extraction/synthesis, Haiku 5.5 to bounded classification, and Opus 5.5 to hypothesis/recipe design. Current-catalog Anthropic calls use adaptive thinking with at least medium effort; Opus uses high. Manual calls may select a registered model override, including GPT-6.1 Sol. Persisted attempts retain their selected model; older Anthropic models keep their original OpenRouter route. Register any new model id in `MODELS` so `scripts/check-model-catalog.ts` verifies it. Llama models are excluded by policy, whatever a provider offers.
- `AUTH_BYPASS_ENABLED=true` is an intentional standing non-human service identity, not a development misconfiguration.
- CLI mutations require `devBypassSecret`. Resolve it through Varlock and 1Password; never print, paste, or commit the value.
- `/agent-tools/*` uses `AGENT_TOOL_SECRET`. Irreversible hypothesis and recipe publication remains human-approved; agents may prepare drafts and reversible provenance-bearing data only within the documented tool contract.
- `media/` (the media service on ai-5090-02) is a second standing service identity using `AGENT_TOOL_SECRET`; its tools are lifecycle writes only and are listed under 'Media lifecycle tools' in `docs/agent-tool-surface.md`.
- Weekly Turns stay in text; automatic narration and the `reconcile-episodes` cron are disabled. Essay audio uses `scripts/essay-audio/` with an explicit paid-character cap; `episodes.enqueueShootout`, `episodes.narrateBrief`, and `episodes.reconcile` enqueue real media jobs and contact production when run.
- Hosted TTS keys (`GEMINI_API_KEY`, `INWORLD_API_KEY`, `ELEVENLABS_API_KEY`) are optional on the media host: a missing key skips that voice in a shootout and fails a narration that names it. The local voice speaks Breeze TTS 2's own server API (`BREEZE_TTS_BASE_URL`; multipart form `text`/`instruction`/`cfg_scale`, raw 24 kHz PCM back, 409 while busy, 503 while loading); `tts-local` must answer `GET /health` 200 before a shootout, and the media provider waits up to 5 minutes for it. `BREEZE_TTS_BASE_URL` has no schema default: the compose file sets it, and clearing it retires the local voice so a shootout skips Breeze instead of waiting on a stopped `tts-local`.
- Wave 1 masters are 16-bit PCM because Cloudflare caps one proxied request body at 100 MB; `MAX_UPLOAD_BYTES` (95 MB) is checked before a narration, episode, or shootout upload URL is minted. Move masters to FLAC before raising it.
- Convex file storage is owned by `audioArtifacts` and by PDF Sources (`sources.pdfStorageId`): `mediaSweeper` deletes any `_storage` blob older than 24 hours that neither references, so a new table that stores `_storage` ids must be added to the sweeper's reference check first.
- PDF Sources get text from Lab Firecrawl (`docs/pdf-capture.md`); Convex never fetches a user-supplied URL itself. Capture stays off until an operator sets `FIRECRAWL_API_URL` and `FIRECRAWL_SCRAPE_EGRESS_GUARDED=true` in the Convex environment.
- Run TypeScript with `vpx tsx` and install with `vp install`. Node scripts read `.env.local` only through `import "varlock/auto-load"` at the top of the file; the runtime loads nothing on its own.
- A pre-commit hook (`.vite-hooks/pre-commit`; `prepare` runs `vp config --no-agent` to install the Vite+ dispatcher, or run `vp hooks enable`) blocks any staged file over 5,000 estimated tokens (bytes / 4, so 20,000 bytes). Split oversized files by responsibility instead of bypassing; generated or binary paths belong in `IGNORE_PATTERNS` in `scripts/check-file-tokens.mjs`. `vp run check:file-tokens -- --all` lists tracked files already over the limit.
- Operator evidence exception: `scripts/frequency-queue-evidence.ts`, `scripts/convex-provenance-verify.ts`, `scripts/convex-module-identities.ts`, `scripts/convex-deployment-inspect.ts`, and its `scripts/frequency-semantic-capture.mjs` supervisor use inherited `CONVEX_SELF_HOSTED_ADMIN_KEY` only, without `.env` or Varlock loading. See `docs/frequency-worker-handoff.md` for their read-only scope and deployment prerequisites. `scripts/wave2-revision-backfill.ts --execute` uses the same inherited key for the revision backfill in `docs/wave2-rollout-packet.md`; `scripts/wave2-signer-readiness.ts` reads only its inherited environment and makes no network call.
- In-process unit tests mock `varlock/auto-load`. Tests that spawn a CLI subprocess set `APP_ENV=test`; keep `.env.test` synchronized with `.env.schema` using inert placeholders.
- Keep contracts shared across runtime seams in `convex/shared/`.
- `scripts/archive/` is frozen reference: read it, never run, format, or edit it.

## Load on demand

- Purpose and setup: `README.md`
- Domain vocabulary: `GLOSSARY.md`
- Current work and ordering: `docs/plans/README.md`
- Agent API, runtime, and tracing: `docs/agent-tool-surface.md`, `agent/README.md`, `docs/langsmith-runbook.md`
- Backend recovery inventory and isolated restore rehearsal tooling: `docs/frequency-backend-recovery-preparation-20260913.md`, `scripts/recovery/`
- Product doctrine: `docs/vision-and-meaning.md`
- Web UI design system: `DESIGN.md` (tokens, opacity tiers, named rules) and `web/docs/zodiac-style-guide.md` (3D geometry)

Run targeted checks while iterating, then `vp run verify` before handoff. If it cannot run, report the exact blocker and whether it predates the change.
