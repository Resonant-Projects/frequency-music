# Publishing & Visibility Model

## Visibility levels
- `private`: only admin + collaborators (as configured)
- `followers`: any logged-in follower
- `public`: no login needed; exported to Astro only after explicit editorial approval

## Promotion workflow
1. Ingested content starts `private`
2. After review/edit, promote to `followers`
3. Curated public writing is authored as `editorialArtifacts` inside Frequency Music
4. Only artifacts with `status=approved|published` and `visibility=public` may be exported
5. Export writes a deterministic snapshot to `exports/public-editorial/v1/`
6. Astro consumes the snapshot, not live private records

## Astro integration options
- Option A (simple): Astro fetches published content from Convex at build-time.
- Option B (export): a “publish” action generates markdown files into a GitHub repo for Astro to consume.
- Option C (hybrid): Astro static for evergreen pages; Convex-powered dynamic routes for briefs.

## Chosen approach
- Choose Option B.
- Export `manifest.json` plus one markdown file per artifact.
- Treat exported markdown as the canonical public payload.
- Use an Astro content collection with a dedicated loader that reads the manifest and markdown content.
- Do not use repo-metadata loaders as the main article ingestion strategy.

## Legal/copyright notes
- Avoid hosting copyrighted PDFs publicly.
- Store PDFs privately and publish only metadata, source titles, canonical URLs, and short public-safe summaries as appropriate.
