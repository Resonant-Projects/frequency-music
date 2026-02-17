# System Architecture — Stack & Deployment

## Domains
- `resonantprojects.art` (Astro on Vercel): static content, curated posts
- `app.resonantprojects.art` (SolidJS on Vercel): authenticated app/dashboard

## Core services
- **Convex**: database + server functions (queries/mutations/actions) + scheduled jobs
- **Clerk**: authentication + user management (roles: admin, collaborator, follower)
- **UploadThing**: file storage (PDFs, images, audio references later) with stored asset URLs
- **n8n (home)**: background automation (RSS polling, Notion sync schedule) → calls Convex HTTP endpoints
- **Anthropic API** (or other LLM provider): extraction + brief generation (server-side via Convex Actions)

## Data flow (high level)
1. Notion items tagged `ResonantProjects` → n8n fetches → Convex ingestion endpoint
2. RSS feeds polled → n8n posts new items → Convex ingestion endpoint
3. Manual inputs (app UI): URL / YouTube / PDF upload → Convex ingestion mutation/action
4. Convex schedules/queues extraction jobs → LLM → writes `extractions`
5. Weekly job generates `weeklyBrief` doc
6. App displays + allows edits/promotions to public
7. Astro site pulls published artifacts (via build-time fetch or a publish/export pipeline)

## Hosting notes
- Vercel: Astro + Solid apps
- Convex hosted: backend
- n8n: home server initially (later optional hosted)
- UploadThing: hosted

## Role-based access
- Admin: CRUD everything, publish public artifacts, manage tags/feeds
- Collaborator: add feedback/listening sessions, comment, draft suggestions
- Follower: read published artifacts, subscribe, comment (optional), no editing
