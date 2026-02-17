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
