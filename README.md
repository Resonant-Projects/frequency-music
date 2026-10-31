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
- Files: **no PDFs in GitHub**; PDF uploads use **Convex file storage**, referenced by `sources.pdfStorageId`. Lab Firecrawl extracts their text; see [PDF capture](./docs/pdf-capture.md) for admission limits and operator enablement.
- Weekly output: **doc-style narrative** brief.
- Feedback: **purely subjective** (for now).
- Public + login: public-facing app content is readable after login; some content may be truly public later.

## Deliverables

- `resonantprojects.art` (Astro): static “why”, curated posts, selected published findings
- `app.resonantprojects.art` (SolidJS): dashboard, ingestion, briefs, hypotheses/recipes, compositions, feedback
- Convex backend: data + actions + scheduled jobs
- Scheduling: Convex crons (feed polling every 6h, batch extraction every 8h, weekly briefs) — see `convex/crons.ts`.
- Operator extraction: `scripts/operator-extraction.ts` exports `text_ready` Sources in chunks using the shared `extract_v3` prompt in `convex/shared/extractionPrompt.ts`. The operator writes the JSON and imports it through `extract.storeOperatorExtraction`, retaining the selected producer model (Opus by default; use the registered `--model` override for another producer). The CLI contacts the deployed backend and pins durable snapshots; it does not invoke the worker or a model provider.

## Strategic Docs

- [Vision and Meaning](./docs/vision-and-meaning.md)
- [Meaning Roadmap](./docs/meaning-roadmap.md)
- [Implementation Checkpoints](./docs/implementation-checkpoints.md)
- [Decision Log](./docs/decision-log.md)

## Local development

### Web app

1. Run `vp i` at the repository root. It installs all four packages and generates the web's Panda files.
2. Set web env:
   - Create `web/.env.local` and set `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_SIGN_IN_URL`, and `VITE_CLERK_SIGN_UP_URL`.
3. Run web app:
   - `cd web && vp run dev`

### Convex backend

- Run `vp i` at the repository root before deploying. The root install also installs the agent and media dependencies used by the pre-deployment typecheck.
- The root typecheck discovers files in `convex/`, `harness/`, and `scripts/`, plus root-level TypeScript files. Private `scratchpad/` helpers are outside that file discovery; TypeScript still checks any file imported by maintained code.
- The backend is self-hosted. Copy [`.env.example`](./.env.example) to `.env.local`; scripts load it via `varlock/auto-load` (imported at the top of each env-reading script); Node does not auto-load `.env` files.
- Caution: `vpx convex dev`, `vpx convex codegen`, and `vpx convex deploy` talk to the live backend.
- Deploy with `vp run convex:deploy` (or `vp run convex:deploy:dry-run`, which still uploads and prepares schema). It typechecks, refuses uncommitted changes and `.env`/`.env.local` files in the release checkout, pins the target to `https://convex.resonantprojects.art`, resolves the admin key through Varlock, and asks you to type `deploy` before it runs the audited CLI per the [CLI contract](./docs/frequency-supported-deployment-rollback.md#cli-contract-and-side-effects).
- The [operator evidence scripts](./docs/frequency-worker-handoff.md#privileged-queue-and-deployed-artifact-evidence) use inherited administrative credentials only; their environment-loading exception is documented in [AGENTS.md](./AGENTS.md#guardrails).
- For CLI mutation auth, see [Guardrails in AGENTS.md](./AGENTS.md#guardrails).
- For parked concept classifications and explicit retries, see [Concept classification](./docs/concept-classification.md).

### Agent workspace & worker

- See [`agent/README.md`](./agent/README.md) for workspace setup.
- The production worker uses [`agent/docker-compose.yml`](./agent/docker-compose.yml) and the [Proxmox agent deployment guide](./docs/proxmox-agent-deployment.md).
- External agents use the [Agent-Tool HTTP surface](./docs/agent-tool-surface.md).

### Verification

Run `vp i` at the repository root before verification. Its install lifecycle installs `web/`, `agent/`, and `media/` from their own lockfiles and generates the web's Panda files. Each package keeps its own dependencies and configuration. Child installs use `--frozen-lockfile`; after changing a child package's dependencies, update its lockfile by running `vp install` in that package. `--ignore-scripts` skips this setup along with the existing hook and compiler setup.
Media development and full verification require `ffmpeg`, `ffprobe`, `sclang`,
and `scsynth` on PATH. Rebuilt development machines must restore them through
[personal-config's native media setup](https://github.com/keithce/personal-config/blob/main/README.md#frequency-music-media-prerequisites)
and pass all six real-render tests with zero skips. See
[media test setup](media/README.md) for native package installation.

- Convex: `vp test convex`
- Web: `vp run typecheck:web` and `vp run build:web`
- Agent: `cd agent && vp run verify && vp test`
- Everything at once: `vp run verify`.
- Commits run a pre-commit hook that blocks files over 5,000 estimated tokens (20,000 bytes); `vp install` enables it. See the token-limit guardrail in `AGENTS.md`.

### Dependency updates

- [Renovate](https://developer.mend.io/github/Resonant-Projects/frequency-music)
  updates dependencies and lockfiles for the root, `web/`, `agent/`, and `media/`
  Bun packages, plus Docker base images. Its policy lives in
  [`renovate.json`](./renovate.json).
- The Dependency Dashboard issue lists pending updates. Major upgrades need
  approval there before Renovate opens a PR. All updates require a manual merge
  after reviewing the diff and CI results.
- Renovate waits three days after a release, opens at most five concurrent PRs
  and two PRs per hour, and refreshes lockfiles on Monday between 3am and 6am
  America/New_York. Convex dependencies and Vite Plus packages have dedicated
  groups. Docker images retain their digest pins.
- Bun runtime upgrades remain manual. Update the package-manager declarations
  in all four packages, `bun-version` in GitHub workflows, and `BUN_VERSION` in
  both Dockerfiles together. Refresh all four lockfiles and run `vp run verify`.
- Dependabot continues to own GitHub Actions updates in
  [`.github/dependabot.yml`](./.github/dependabot.yml). Renovate's enabled managers
  exclude GitHub Actions to avoid duplicate PRs. `scripts/archive/` is excluded
  from Renovate updates.

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
