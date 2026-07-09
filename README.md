# Resonant Projects — Project Overview (README)

## One-liner

A research-to-composition web app that ingests sources + Notion notes, extracts structured musical/physics/math concepts and compositional parameters, generates weekly narrative briefs with actionable hypotheses/recipes, and tracks compositions + subjective listening feedback.

## Core loop

1. **Ingest** (Notion tag + manual URL/PDF/YouTube + RSS)
2. **Extract** (AI-assisted summaries, claims, parameters, citations)
3. **Synthesize** (connections + hypotheses)
4. **Output** (weekly narrative brief + compositional recipes)
5. **Execute** (compose + publish updates)
6. **Evaluate** (subjective listening sessions)
7. **Iterate** (revise hypotheses/recipes)

## Users

- **Owner/Admin:** Keith (full access)
- **Collaborators (1–2):** can add feedback, comments, maybe draft hypotheses
- **Followers:** login-required access to the app to follow, subscribe, comment, and view public research

## Non-goals (for MVP)

- No medical claims; no measurement devices/HRV/EEG
- No advanced knowledge-graph visualization required
- No bidirectional Notion sync (Notion is input source of truth for notes)

## Key constraints / decisions

- Notion: single `Notes` database + generic tags; create a dedicated tag to isolate project items.
- Files: **no PDFs in GitHub**; store uploads via **UploadThing** and keep links in Convex.
- Weekly output: **doc-style narrative** brief.
- Feedback: **purely subjective** (for now).
- Public + login: public-facing app content is readable after login; some content may be truly public later.

## Deliverables

- `resonantprojects.art` (Astro): static “why”, curated posts, selected published findings
- `app.resonantprojects.art` (SolidJS): dashboard, ingestion, briefs, hypotheses/recipes, compositions, feedback
- Convex backend: data + actions + scheduled jobs
- n8n: RSS polling + Notion scheduled sync + webhook pushes

## Strategic Docs

- [Vision and Meaning](./docs/vision-and-meaning.md)
- [Meaning Roadmap](./docs/meaning-roadmap.md)
- [Implementation Checkpoints](./docs/implementation-checkpoints.md)
- [Decision Log](./docs/decision-log.md)

## Local development

### Web app

1. Install dependencies:
   - `bun install`
   - `cd web && bun install`
2. Set web env:
   - Create `web/.env.local` and set `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_SIGN_IN_URL`, and `VITE_CLERK_SIGN_UP_URL`.
3. Run web app:
   - `cd web && bun run dev`

### Convex backend

- The backend is self-hosted. Copy [`.env.example`](./.env.example) to `.env.local`; Bun auto-loads it.
- Caution: `bunx convex dev`, `bunx convex codegen`, and `bunx convex deploy` talk to the live backend.
- For CLI mutation auth, see [Authentication in CLAUDE.md](./CLAUDE.md#authentication).

### Agent workspace & worker

- See [`agent/README.md`](./agent/README.md) for workspace setup.
- The production worker uses [`agent/docker-compose.yml`](./agent/docker-compose.yml) and the [Proxmox agent deployment guide](./docs/proxmox-agent-deployment.md).
- External agents use the [Agent-Tool HTTP surface](./docs/agent-tool-surface.md).

### Verification

- Convex: `bun test convex/*.test.ts`
- Web: `bun run typecheck:web` and `bun run build:web`
- Agent: `cd agent && bun run verify && bun test`
- If present after Plan 003 lands: `bun run lint:check`, `bun run format:check`, and `bun run typecheck`

## App routes (TanStack Router)

- `/` Zodiac 3D knowledge navigation (live Convex pipeline + sector metrics)
- `/ingest` manual URL/YouTube ingest + extraction trigger
- `/display` inbox triage and source review actions
- `/hypotheses` hypothesis drafting and source-citation selection
- `/recipes` manual/auto recipe generation
- `/weekly-turns` weekly brief generation and publish flow
- `/compositions` composition lifecycle tracking
- `/feedback` listening session capture and ratings
- `/admin` feed controls + operational overrides
