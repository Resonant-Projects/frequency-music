# Essay Export System Design

Export `docs/essays/*.md` as blog posts to the Resonant Projects website (`rproj-website`).

## Data Flow

```
docs/essays/*.md                    # Source essays (hand-written, optional draft frontmatter)
        |
        v
scripts/generate-essay-metadata.ts  # Phase 1: AI summarization (incremental)
        |
        v
docs/essays/metadata.json           # Cached excerpts, tags, categories (editable)
        |
        v
scripts/export-essays.ts            # Phase 2: Pure transform (fast, deterministic)
        |
        v
exports/blog/
  manifest.json                     # Index of all published essays
  essays/
    the-ground-note.md              # Frontmattered markdown ready for Astro
    ...
```

Astro side (rproj-website):

```
src/loaders/frequencyEssayLoader.ts   # Reads manifest + markdown from exports/blog/
src/content/config.ts                 # post collection updated to union glob + essay loader
```

## Essay Parsing

Each `docs/essays/*.md` is parsed for:

**Title** -- H1 line, stripped of `# ` prefix.

**Draft status** -- if the file starts with YAML frontmatter containing `draft: true`, the essay is excluded from export. No frontmatter or `draft: false` means published.

**Date** -- parsed from byline via regex covering observed formats:

- `*Freq -- March 20, 2026*`
- `*February 25, 2026 -- Freq*`
- `*By Freq . February 22, 2026*`
- `*Essay #87 -- April 2, 2026*`
- `**Essay #80** -- March 31, 2026`
- `*March 6, 2026*`
- `*Freq . March 2026` (month-only -- use 1st of month)

Fallback: git first-commit date (`git log --diff-filter=A --format=%ai`).

**Essay number** -- parsed when present (`Essay #87`). Stored in metadata but not used in post frontmatter.

**Body** -- everything after title, byline, and first `---` separator. These are stripped since the metadata moves into frontmatter.

## AI Metadata Generation

`scripts/generate-essay-metadata.ts` runs incrementally -- only processes essays not already in `metadata.json` or whose content has changed (SHA-256 hash comparison).

**Per essay**, sends full body to OpenRouter requesting:

- `excerpt`: 1-2 sentence summary for blog cards (~150 chars)
- `tags`: 3-6 tags from controlled vocabulary
- `category`: single category from fixed set

**Model:** `anthropic/claude-haiku-4.5` via OpenRouter.

**Controlled tag vocabulary:**

```
microtuning, xenharmonic, psychoacoustics, wave-physics, mathematical-music-theory,
sacred-geometry, cymatics, consciousness, biofield, sound-healing, group-theory,
tuning-systems, rhythm, perception, AI-music, information-theory, acoustics,
composition, signal-processing, temperament, resonance, geometry, number-theory
```

**Fixed categories:**

```
music-theory, physics-of-sound, mathematics, perception, composition, interdisciplinary
```

**Output -- `docs/essays/metadata.json`:**

```json
{
  "the-ground-note": {
    "excerpt": "Why the bass note defines the reference frame...",
    "tags": ["psychoacoustics", "tuning-systems", "perception"],
    "category": "perception",
    "contentHash": "a1b2c3...",
    "generatedAt": "2026-04-03T..."
  }
}
```

Hand-editable. The script won't overwrite entries whose `contentHash` still matches the source file.

## Export Script

`scripts/export-essays.ts` is a pure transform -- no AI, no network calls.

**Process:**

1. Glob `docs/essays/*.md`
2. Parse each essay (title, date, draft status, body)
3. Skip if `draft: true`
4. Look up entry in `docs/essays/metadata.json` -- warn and skip if missing
5. Write frontmattered markdown to `exports/blog/essays/<slug>.md`
6. Write `exports/blog/manifest.json`

**Output markdown:**

```markdown
---
title: "The Ground Note: Why Everything in Music Is Relative to What's Underneath"
publishDate: 2026-03-20
excerpt: "Why the bass note defines the reference frame in which harmony is perceived."
category: perception
tags:
  - psychoacoustics
  - tuning-systems
  - perception
author: Keith Elliott
byline: Freq
---

## The Same Notes, Different Worlds

Play C-E-G with C in the bass...
```

**Manifest:**

```json
{
  "version": "frequency_essays_v1",
  "generatedAt": "2026-04-03T...",
  "items": [
    {
      "slug": "the-ground-note",
      "path": "essays/the-ground-note.md",
      "title": "The Ground Note: Why Everything...",
      "publishDate": "2026-03-20",
      "category": "perception"
    }
  ]
}
```

## Astro Loader

**`src/loaders/frequencyEssayLoader.ts`** in rproj-website follows the `githubEditorialLoader` pattern:

- Checks `ESSAY_MANIFEST_URL` env var for remote mode (production/Vercel builds)
- Falls back to local: `../frequency-music/exports/blog/manifest.json`
- Reads manifest, loads each markdown file, parses frontmatter
- Stores entries with the `post` schema shape
- IDs prefixed with `essay/` to avoid slug collisions with hand-written posts

**Content config changes (`src/content/config.ts`):**

- `post` collection loader becomes a composite: glob (existing posts) + `frequencyEssayLoader()`
- Schema adds `byline: z.string().optional()` for display author ("Freq") alongside `author` ("Keith Elliott") for SEO

```typescript
// mergeLoaders is a small helper (~10 lines) that runs multiple loaders
// sequentially into the same content store. Not an Astro built-in.
const postCollection = defineCollection({
  loader: mergeLoaders(
    glob({ pattern: ["**/*.md", "**/*.mdx"], base: "src/content/post" }),
    frequencyEssayLoader(),
  ),
  schema: ({ image }) =>
    z.object({
      // existing fields unchanged
      byline: z.string().optional(),
    }),
});
```

## Error Handling

**generate-essay-metadata.ts:**

- AI call fails for an essay: log error, skip, continue. Report failures at end.
- `metadata.json` doesn't exist: create from scratch (first run).

**export-essays.ts:**

- Essay has no metadata entry: warn with filename, skip. Exit non-zero if any skipped.
- Date unparseable + git fallback fails: use `null` publishDate, log warning. Schema has `publishDate` as optional.

**frequencyEssayLoader.ts:**

- No manifest found: log warning, return empty. Blog works, just no essays.
- Individual markdown missing/malformed: log and skip, don't fail the build.
