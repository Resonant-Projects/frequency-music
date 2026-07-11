---
description: Frequency Music Research Pipeline - Vite+ + Convex
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: true
---

# Frequency Music Research Pipeline

Research-to-composition pipeline exploring connections between music, physics, mathematics, and geometry.

## Project Overview

**Stack:**

- **Runtime:** Node 24 managed by Vite+ (`vp`); package management delegates to Bun via `bun.lock`
- **Backend:** Self-hosted Convex (managed by Cool Guy)
- **LLM:** Convex pipeline: OpenRouter + AI SDK (Claude Sonnet default, Groq/Gemini/DeepSeek variants — see convex/extract.ts MODELS). Agent workspace: LangGraph with Codex SDK + Anthropic (see agent/).
- **Tuning Files:** Scala format (.scl, .kbm)

**Repository:** `github.com:Resonant-Projects/frequency-music.git`

## Agent Tool Surface

External LangGraph/LangChain agents read project state through the secret-guarded Convex agent-tool surface documented in `docs/agent-tool-surface.md`. The surface is read-only in this phase and is enabled by `AGENT_TOOL_SECRET`. The agent workspace is prepared for LangSmith tracing; Convex-side tracing still needs a Node-runtime split before importing the LangSmith SDK.

## Directory Structure

```
frequency-music/
├── convex/              # Convex backend functions
│   ├── schema.ts        # Data model (sources, extractions, feeds, etc.)
│   ├── sources.ts       # Source CRUD + status management
│   ├── feeds.ts         # RSS feed management
│   ├── extract.ts       # AI extraction pipeline (OpenRouter)
│   ├── ingest.ts        # RSS polling
│   └── crons.ts         # Scheduled jobs (6-hour feed polling)
│
├── data/                # Source manifests and reference data
│   ├── sources-master.md
│   ├── robert-edward-grant-sources.json
│   ├── books-and-papers.json
│   ├── microtuning-sources.json
│   ├── esoteric-sources.json          # Sacred geometry, bowls, biofield, etc.
│   ├── esoteric-sources-2.json        # Extended esoteric sources
│   └── pdfs/                          # Downloaded PDF files
│
├── docs/
│   ├── essays/          # Synthesized research essays (18 essays)
│   ├── reference/       # Quick reference guides
│   │   └── microtuning-overview.md
│   └── *.md             # Planning/spec docs
│
├── planning/            # Architecture and roadmap docs
│
├── scales/              # Scala tuning files (.scl, .kbm)
│   ├── geometric-temperament.scl
│   ├── geometric-temperament.kbm
│   ├── grant-precise-temperament.scl
│   └── polygon-angles-pure.scl
│
├── scripts/             # Local ingestion scripts
│   ├── lib/             # Shared ingest library (client/env, fetch, ingestor)
│   ├── archive/         # Completed one-shot scripts (byte-identical, do not run)
│   ├── ingest-manifest.ts
│   ├── fetch-full-articles.ts
│   ├── fetch-youtube-transcripts.ts
│   └── fetch-readwise-articles.ts
│
└── skills/              # Agent skills (Fabric CLI, etc.)
```

## Key Scripts

All scripts run directly via `vpx tsx` (use `vp run <script>` for `package.json` tasks). Env is auto-loaded from `.env.local` by `varlock/auto-load` (imported at the top of each env-reading script), not by the runtime:

```bash
# Source ingestion (batches are data now — one driver + JSON manifests)
vpx tsx scripts/ingest-manifest.ts data/example-manifest.json   # dry-run by default

# Text fetching (recurring; shared scripts/lib ingestor)
vpx tsx scripts/fetch-full-articles.ts --limit 10    # Jina Reader
vpx tsx scripts/smart-fetch.ts                        # Multi-strategy fetch for blocked sources
vpx tsx scripts/fetch-notion-full-text.ts             # Notion sources → Jina

# YouTube & Notion
vpx tsx scripts/fetch-youtube-transcripts.ts          # Fabric CLI transcripts
vpx tsx scripts/sync-notion-tag.ts                    # Sync Frequency Research tag
vpx tsx scripts/fetch-readwise-articles.ts            # Readwise → sources

# Analysis & Maintenance
vpx tsx scripts/audit-extractions.ts                  # Audit extraction quality
vpx tsx scripts/list-extraction-ids.ts                # Export to /tmp/ext-summary.json
vpx tsx scripts/list-zero-sources.ts                  # Find zero-claim sources
vpx tsx scripts/migrate-dedupe-keys.ts                # Dedupe-key migration (dry-run default)
vpx tsx scripts/find-dupes.ts                         # Duplicate report

# Completed one-shot batch scripts live in scripts/archive/ (reference only)
```

## Convex Commands

### Extraction

```bash
# Run extraction on all text_ready sources
vpx convex run extract:extractAllReady '{"limit": 20}'

# List sources by status
vpx convex run sources:listByStatus '{"status": "extracted", "limit": 50}'

# Poll all RSS feeds manually
vpx convex run ingest:pollAllFeeds

# List feeds
vpx convex run feeds:list
```

### Hypothesis & Recipe Generation

```bash
# Generate hypothesis from extraction (AI)
vpx convex run hypotheses:generateFromExtraction '{"extractionId": "..."}'

# Generate hypotheses batch (auto-pick best extractions)
vpx convex run hypotheses:generateBatch '{"limit": 3}'

# Generate recipe from hypothesis (AI)
vpx convex run recipes:generateFromHypothesis '{"hypothesisId": "..."}'

# Generate recipes for hypotheses without them
vpx convex run recipes:generateBatch '{"limit": 3}'

# List hypotheses by status
vpx convex run hypotheses:listByStatus '{"status": "draft", "limit": 10}'

# List recipes
vpx convex run recipes:listByStatus '{"limit": 10}'

# Full experiment generation script (extraction → hypothesis → recipe)
vpx tsx scripts/generate-experiment.ts --auto
vpx tsx scripts/generate-experiment.ts <extractionId>
```

## Authentication

All CLI mutations require auth bypass (Clerk integration). The bypass secret is
managed by varlock + 1Password (`.env.schema` → `op://Country Manor Lab/...`);
never paste a real value here. Scripts auto-load it via `import "varlock/auto-load"`.

```bash
# Add devBypassSecret to mutation args (value resolved from 1Password by varlock)
vpx convex run extract:extractSource '{"sourceId": "...", "model": "anthropic/claude-sonnet-4.6", "devBypassSecret": "<AUTH_BYPASS_SECRET>"}'
```

Convex env vars: `AUTH_BYPASS_ENABLED=true`, `AUTH_BYPASS_SECRET=<set via 1Password / varlock; never commit the value>`

## Environment Variables (.env.local)

```
CONVEX_SELF_HOSTED_URL='https://convex.resonantprojects.art'
OPENROUTER_API_KEY=...
GROQ_API_KEY=...
KERNEL_API_KEY=...  # Kernel.sh cloud browser (5 concurrent sessions)
```

## Data Pipeline

```
Sources → Ingest (RSS/URL/PDF) → Text Ready → Extract (AI) → Extracted
                                     ↓
                              Claims, Parameters, Topics
                                     ↓
                              Hypotheses → Recipes → Compositions
```

**Source Status Flow:**

1. `ingested` — Metadata only, no full text
2. `text_ready` — Full text fetched, awaiting extraction
3. `extracted` — AI extraction complete
4. `triaged` — Reviewed and categorized

## Models (convex/llm.ts)

```typescript
export const MODELS = {
  // === GROQ (fast, cheap) ===
  fast: "groq/openai/gpt-oss-120b", // Groq retired kimi-k2-instruct (2026-07)

  // === OpenRouter (model variety) ===
  default: "openai/gpt-5.6-terra", // medium reasoning effort (MODEL_REASONING_EFFORT)
  quality: "openai/gpt-5.6-terra",
  sonnet: "anthropic/claude-sonnet-4.6",
  haiku: "anthropic/claude-haiku-4.5",
  gemini: "google/gemini-2.5-flash",
  gpt4: "openai/gpt-4o",
  deepseek: "deepseek/deepseek-chat-v3-0324",
  grok: "x-ai/grok-4.5",
} as const;
```

> Source of truth: convex/llm.ts (MODELS moved there by the LLM-module consolidation) — update this table when that changes.
>
> **Note:** Never use Llama models. GPT-5.6 Terra (medium reasoning) is the default for automated cron extractions (per Keith 2026-07-10); Opus for manual re-extractions.

## Feeds

Feeds live in the `feeds` table; inspect the current inventory with `vpx convex run feeds:list`.

Feed domains span research publications, YouTube channels, and music-production sources.

## Research Domains

- **Microtuning/Xenharmonic:** EDOs, JI systems, Scala files
- **Geometric Music Theory:** Robert Edward Grant's polygon-angle correspondence
- **Psychoacoustics:** Perception, consonance/dissonance
- **Wave Physics:** Harmonics, resonance, cymatics, Faraday waves
- **Mathematical Music Theory:** Group theory, Tonnetz, voice-leading geometry
- **Sacred Geometry:** Music of the Spheres, Pythagorean harmony, cathedral acoustics
- **Consciousness & Sound:** General Resonance Theory, noetic science, Schumann resonance
- **Biofield Science:** Biophotons, electromagnetic bioinformation, biofield therapies
- **Sound Healing:** Singing bowls, toning/chanting, vibroacoustic therapy, 40Hz gamma
- **Cymatics:** Chladni patterns, Hans Jenny, Lauterwasser water images
- **Ley Lines & Earth Energy:** Rory Duff classification, Watkins, Becker-Hagens grid

## Scala File Format

```scala
! filename.scl
! Description comment
12
!
100.00000
200.00000
... (cents or ratios)
2/1
```

## Vite+ Defaults

- Use `vpx tsx <file>` to run a TypeScript/JS file (replaces `bun <file>` / `node <file>`)
- Use `vp install` instead of `npm install` / `bun install` (delegates to Bun via `bun.lock`)
- Use `vpx <package>` instead of `npx` / `bunx`
- Use `vp run <script>` (or `vpr <script>`) to run a `package.json` script
- `.env.local` is auto-loaded by `varlock/auto-load` (imported at the top of each env-reading script), not by the runtime — Node does not auto-load `.env` files the way Bun did

## Lint & format
- **biome** = formatter (`vp run format`); its linter config exists but oxlint is the primary linter.
- **oxlint** = linter (`vp run lint`, check-only: `vp run lint:check`).
- Don't add overlapping rules to both configs; oxlint wins for lint rules.

## Writing Guidelines

- Document new sources in `data/*.json`
- Put synthesis essays in `docs/essays/`
- Put reference guides in `docs/reference/`
- Put tuning files in `scales/`
- Commit meaningful progress with clear messages
- Push when you have something worth sharing

## Design Context

### Users

A small circle of collaborators and fellow researchers exploring connections between music, physics, mathematics, and geometry. They share deep domain knowledge and use this as a research-to-composition workbench — not a consumer product.

### Brand Personality

**Elegant, contemplative, deep.** Quiet authority — the kind of calm you feel in a cathedral or observatory. The interface should feel like opening an illuminated manuscript in a well-lit study, not like using software.

### Aesthetic Direction

- **Theme:** Dark mode only. Deep void purple (`#0d0620`) ground, gold (`#c8a84b`) accent, violet (`#8b5cf6`) secondary, cream (`#f5f0e8`) text.
- **Typography:** Cormorant Garamond for display and body (serif, editorial feel). JetBrains Mono / IBM Plex Mono for labels, metadata, and code.
- **Visual language:** "Zodiac" — astrolabe-inspired 3D home, glassmorphism cards with backdrop-blur and translucent backgrounds, monospace uppercase eyebrows, gold-bordered navigation.
- **Tone:** Somewhere between an astronomical atlas and a literary journal. Generous whitespace, restrained animation, precise typographic hierarchy.
- **Anti-references:** No dry LaTeX/academic-journal walls of text. No neon-overload crypto/Web3 aesthetic. No generic SaaS gray dashboards.

### Emotional Goals

- **Wonder & discovery** — like finding hidden connections in an ancient star chart
- **Flow & focus** — minimal friction, the tool disappears into the work
- **Intuitive & obvious** — navigation and hierarchy should be self-evident without explanation

### Design Principles

1. **Substance over spectacle.** Every visual element should earn its place. Decoration serves meaning, never the reverse.
2. **Typography carries the weight.** Cormorant Garamond at large sizes, tight leading, and generous measure is the primary design tool. Let the type breathe.
3. **Gold is earned.** Use gold accent sparingly for active states, key labels, and moments of emphasis. Overuse dulls it.
4. **Depth through translucency.** Glassmorphism cards and backdrop-blur create spatial layering without heavy borders or shadows.
5. **Monospace whispers, serif speaks.** Metadata, labels, and system information in small monospace uppercase. Content and titles in serif.
