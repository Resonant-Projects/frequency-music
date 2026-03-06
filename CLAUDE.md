---
description: Frequency Music Research Pipeline - Bun + Convex
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: true
---

# Frequency Music Research Pipeline

Research-to-composition pipeline exploring connections between music, physics, mathematics, and geometry.

## Project Overview

**Stack:**
- **Runtime:** Bun (not Node.js)
- **Backend:** Self-hosted Convex (managed by Cool Guy)
- **LLM:** OpenRouter + AI SDK (multi-model: Claude, Groq, Gemini, GPT-4)
- **Tuning Files:** Scala format (.scl, .kbm)

**Repository:** `github.com:Resonant-Projects/frequency-music.git`

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
│   ├── ingest-robert-grant.ts
│   ├── ingest-books-papers.ts
│   ├── ingest-microtuning.ts
│   ├── fetch-full-articles.ts
│   ├── fetch-youtube-transcripts.ts
│   └── fetch-readwise-articles.ts
│
└── skills/              # Agent skills (Fabric CLI, etc.)
```

## Key Scripts

All scripts use Bun and load env from `.env.local`:

```bash
# Source ingestion
bun run scripts/ingest-robert-grant.ts      # Robert Edward Grant sources
bun run scripts/ingest-books-papers.ts       # Books and arXiv papers
bun run scripts/ingest-microtuning.ts        # Microtuning/xenharmonic sources
bun run scripts/ingest-esoteric.ts           # Esoteric research batch 1 (26 sources)
bun run scripts/ingest-esoteric-2.ts         # Esoteric research batch 2
bun run scripts/ingest-jmm-open-access.ts    # JMM RSS full text

# Text fetching
bun run scripts/fetch-full-articles.ts --limit 10    # Jina Reader
bun run scripts/fetch-article-kernel.ts <url>        # Kernel.sh cloud browser
bun run scripts/fetch-blocked-kernel.ts              # Batch fetch blocked sources
bun run scripts/fetch-remaining-kernel.ts             # Retry remaining blocked
bun run scripts/update-text-from-files.ts             # Update Convex from /tmp files
bun run scripts/fetch-notion-full-text.ts             # Notion sources → Jina

# YouTube & Notion
bun run scripts/fetch-youtube-transcripts.ts          # Fabric CLI transcripts
bun run scripts/sync-notion-tag.ts                    # Sync Frequency Research tag

# Analysis & Maintenance
bun run scripts/audit-extractions.ts                  # Audit extraction quality
bun run scripts/list-extraction-ids.ts                # Export to /tmp/ext-summary.json
bun run scripts/list-zero-sources.ts                  # Find zero-claim sources
bun run scripts/find-e2e.ts                           # Find E2E test data
```

## Convex Commands

### Extraction
```bash
# Run extraction on all text_ready sources
bunx convex run extract:extractAllReady '{"limit": 20}'

# List sources by status
bunx convex run sources:listByStatus '{"status": "extracted", "limit": 50}'

# Poll all RSS feeds manually
bunx convex run ingest:pollAllFeeds

# List feeds
bunx convex run feeds:list
```

### Hypothesis & Recipe Generation
```bash
# Generate hypothesis from extraction (AI)
bunx convex run hypotheses:generateFromExtraction '{"extractionId": "..."}'

# Generate hypotheses batch (auto-pick best extractions)
bunx convex run hypotheses:generateBatch '{"limit": 3}'

# Generate recipe from hypothesis (AI)
bunx convex run recipes:generateFromHypothesis '{"hypothesisId": "..."}'

# Generate recipes for hypotheses without them
bunx convex run recipes:generateBatch '{"limit": 3}'

# List hypotheses by status
bunx convex run hypotheses:listByStatus '{"status": "draft", "limit": 10}'

# List recipes
bunx convex run recipes:listByStatus '{"limit": 10}'

# Full experiment generation script (extraction → hypothesis → recipe)
bun run scripts/generate-experiment.ts --auto
bun run scripts/generate-experiment.ts <extractionId>
```

## Authentication

All CLI mutations require auth bypass (Clerk integration):
```bash
# Add devBypassSecret to mutation args
bunx convex run extract:extractSource '{"sourceId": "...", "model": "anthropic/claude-sonnet-4-6", "devBypassSecret": "freq-opus-extract-2026"}'
```

Convex env vars: `AUTH_BYPASS_ENABLED=true`, `AUTH_BYPASS_SECRET=freq-opus-extract-2026`

## Environment Variables (.env.local)

```
CONVEX_SELF_HOSTED_URL='http://convex-backend.paas.rproj.art'
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

## Models (convex/extract.ts)

```typescript
MODELS = {
  fast: "groq/moonshotai/kimi-k2-instruct",
  default: "anthropic/claude-sonnet-4-6",
  gemini: "google/gemini-2.5-flash",
  grok: "x-ai/grok-3-mini-beta",
  deepseek: "deepseek/deepseek-chat-v3-0324",
}
```

> **Note:** Never use Llama models. Sonnet 4.6 for automated cron extractions, Opus for manual re-extractions.

## Current Feeds (18, 6 dead)

**Research (active):**
- Quanta Magazine, Nautilus, BRAMS
- Music Theory Online, Journal of Mathematics and Music (T&F — Cloudflare blocks full text)
- arXiv: cs.SD (Sound), eess.AS (Audio & Speech)

**YouTube (mostly dead):**
- ~~3Blue1Brown~~ (HTTP 500), ~~Adam Neely~~ (HTTP 500), ~~David Bennett Piano~~ (HTTP 404)
- ~~CymaScope~~ (HTTP 500), Andrew Huang, ~~Robert Edward Grant~~ (HTTP 404)

**Production:**
- ~~Sound on Sound~~ (HTTP 410 Gone — permanently dead), Splice Blog, Bobby Owsinski, Native Instruments

> **TODO:** Remove 6 dead feeds, find replacements

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

## Bun Defaults

- Use `bun <file>` instead of `node <file>`
- Use `bun install` instead of `npm install`
- Use `bunx <package>` instead of `npx`
- Bun auto-loads `.env.local` — no dotenv needed

## Writing Guidelines

- Document new sources in `data/*.json`
- Put synthesis essays in `docs/essays/`
- Put reference guides in `docs/reference/`
- Put tuning files in `scales/`
- Commit meaningful progress with clear messages
- Push when you have something worth sharing
