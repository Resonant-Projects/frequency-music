# Archive — Completed & Superseded Planning Material

Everything in this folder is **done, superseded, or historical**. Nothing here
should drive new work. The live picture is:

- **What remains, in order** — [docs/plans/README.md](../plans/README.md)
- **Full status analysis** — [docs/plan-status-report-2026-07-15.md](../plan-status-report-2026-07-15.md)
- **Decision history** — [docs/decision-log.md](../decision-log.md) (append-only; its
  references to `planning/` predate this archive)

## Contents

### `planning/` — original MVP planning folder (May 2026)

The founding spec: PRD, roadmap (milestones M0–M5), data model, architecture,
ingest, Notion sync, prompts, publishing. **All milestones shipped and were
exceeded** — the live system has 24 Convex tables vs the ~10 planned, 22 app
routes, and a LangGraph agent workspace. Superseded by `docs/schema.md`,
`docs/meaning-roadmap.md`, `docs/next-wave-roadmap.md`, and the decision log.

`planning/langchain/` (2026-05-14 trio): the agent-tool surface and LangSmith
plans landed (~90%; the one open gap — golden eval datasets — is tracked by
`plans/008-eval-baseline-sweep.md`). The LangGraph deep-agents plan was
implemented with a deliberate pivot: the planned push model (Convex cron →
LangGraph server) became a pull-based worker (`agent/src/worker/runner.ts`
polls `agentRuns`, writes `agentReviewDrafts` for human review), and the
primary graph became `research-pipeline` rather than `weekly-brief`.

### `plan-waves/` — completed implementation waves from `docs/plans/`

| Wave | Plans | Status |
|------|-------|--------|
| 2026-06-02 LangGraph research agent system | 1 | Superseded by the 2026-07-01 v2 wave |
| 2026-06-06 Proxmox monitoring stack | 1 | Executed (Pulse LXC 102 installed on prox2) |
| 2026-07-01 agent system v2 | 00 + 01–05 + v2 status doc | **All landed** (`550fbbb`, `32166aa`) |
| 2026-07-03 architecture deepening | 00 + 01–07 | **All landed** (see per-file `> Landed:` headers) |

The in-progress **2026-07-07 knowledge-loop wave stays in `docs/plans/`**
(including its landed plans 01–03) because plans 04–11 reference the earlier
plans' interfaces and the master sequence's gate order.

### `superseded/` — retired docs

- `minimal-schema-for-loop.md` — early schema sketch; superseded by `docs/schema.md`
- `mvp-screens-and-actions.md` — MVP screen inventory; the shipped app outgrew it

### `../../plans/archive/` — completed improve-skill plans (2026-07-07 audit)

Plans 001–007, 009, 010 — all DONE per the status table in `plans/README.md`,
which stays as the ledger. Only 008 (eval baseline sweep) remains active.
