# Publishing & Visibility Model

## Visibility levels
- `private`: only admin + collaborators (as configured)
- `followers`: any logged-in follower
- `public`: no login needed (optional later; or mirror to Astro)

## Promotion workflow
1. Ingested content starts `private`
2. After review/edit, promote to `followers`
3. For curated write-ups, publish to Astro as posts:
   - weekly brief
   - synthesis article
   - selected hypothesis/recipe + outcomes

## Astro integration options
- Option A (simple): Astro fetches published content from Convex at build-time.
- Option B (export): a “publish” action generates markdown files into a GitHub repo for Astro to consume.
- Option C (hybrid): Astro static for evergreen pages; Convex-powered dynamic routes for briefs.

## Legal/copyright notes
- Avoid hosting copyrighted PDFs publicly.
- Store PDFs privately (UploadThing) and publish only metadata + quotes under fair use as appropriate.
