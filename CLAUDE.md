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
│   └── microtuning-sources.json
│
├── docs/
│   ├── essays/          # Synthesized research essays
│   │   └── geometric-microtuning-composition.md
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
# Ingest Robert Edward Grant sources (PDFs + articles)
bun run scripts/ingest-robert-grant.ts

# Ingest books and arXiv papers
bun run scripts/ingest-books-papers.ts

# Ingest microtuning/xenharmonic sources
bun run scripts/ingest-microtuning.ts

# Fetch full article text via Jina Reader
bun run scripts/fetch-full-articles.ts --limit 10 [--re-extract]

# Fetch YouTube transcripts via Fabric CLI
bun run scripts/fetch-youtube-transcripts.ts
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

## Environment Variables (.env.local)

```
CONVEX_SELF_HOSTED_URL='http://convex-backend.paas.rproj.art'
OPENROUTER_API_KEY=...
GROQ_API_KEY=...
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
  fast: "groq/llama-3.3-70b-versatile",
  kimi: "groq/moonshotai/kimi-k2-instruct",
  default: "anthropic/claude-sonnet-4",
  haiku: "anthropic/claude-3-5-haiku-20241022",
  gemini: "google/gemini-2.0-flash-001",
  gpt4: "openai/gpt-4o",
}
```

## Current Feeds (17)

**Research:**
- Quanta Magazine, Nautilus, BRAMS
- Music Theory Online, Journal of Mathematics and Music
- arXiv: cs.SD (Sound), eess.AS (Audio & Speech)

**YouTube:**
- 3Blue1Brown, Adam Neely, David Bennett Piano
- CymaScope, Andrew Huang, Robert Edward Grant

**Production:**
- Sound on Sound, Splice Blog, Bobby Owsinski, Native Instruments

## Research Domains

- **Microtuning/Xenharmonic:** EDOs, JI systems, Scala files
- **Geometric Music Theory:** Robert Edward Grant's polygon-angle correspondence
- **Psychoacoustics:** Perception, consonance/dissonance
- **Wave Physics:** Harmonics, resonance, cymatics
- **Mathematical Music Theory:** Group theory, Tonnetz, voice-leading geometry

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
