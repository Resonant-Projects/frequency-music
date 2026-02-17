# Product Requirements Document (PRD) — MVP

## Problem
Research across math/physics/music is scattered across papers, videos, and personal notes. Converting it into actionable composition experiments is slow and unstructured.

## MVP objective
Every weekend, produce a narrative **Weekly Brief** that gives Keith 3–10 actionable studio experiments (hypotheses + recipes) derived from the week’s ingested materials, with traceable sources and lightweight tracking of outcomes.

## Success criteria
- Ingestion is low-friction (Notion tag + paste link + upload PDF).
- Weekly Brief is generated automatically and is actually used in the studio.
- Each recipe can be traced back to sources/claims.
- Subjective listening session feedback is easy to capture and attach to a composition.

## MVP user stories
### Ingestion
- As Keith, I can tag a Notion note and it appears in the app within X minutes.
- As Keith, I can paste a URL or YouTube link and the system ingests and summarizes it.
- As Keith, I can upload a PDF and get an extraction + citation metadata.

### Extraction & structuring
- As Keith, I can see “key claims” and “composition parameters” extracted from each source.
- As Keith, I can correct/override extractions (human edit wins).

### Synthesis
- As Keith, I can create a hypothesis referencing sources and concepts.
- As Keith, I can generate a recipe (tempo/key/tuning/rhythm/etc.) from a hypothesis.

### Weekly brief
- As Keith, I can receive a weekly narrative brief (doc-style) with:
  - what came in this week
  - what seems promising
  - 3–10 recommended experiments (hypotheses + recipes)
  - citations/links to supporting sources

### Experiments & feedback
- As Keith, I can create a “composition project” linked to a recipe.
- As collaborator, I can log a listening session with subjective notes/ratings.

### Followers
- As follower, I can log in and read published briefs, sources, and experiments (visibility-controlled).

## Out of scope (MVP)
- Semantic auto-linking across entire corpus (beyond simple suggested connections)
- Measurement tooling (HRV/EEG)
- Full public read-without-login mode (optional later)
- Multi-tenant “everyone brings their own Notion” support

## Compliance / safety
- Clear disclaimer: research exploration only; no medical advice.
- Store “evidence level” for claims (peer-reviewed / preprint / anecdotal / speculative / personal).
