# 04 — Production Worker, Scheduling, and Weekly-Brief Cutover
> Landed: 550fbbb (2026-07-02)

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Move the agent system from laptop-run demos to an always-on Proxmox worker that picks up queued runs, run the weekly-brief comparison period, and make the cutover decision. Convex stays the scheduler-of-record: crons enqueue `agentRuns` rows; the worker polls and executes. n8n is deliberately not in this loop (one fewer moving part between scheduler and worker; revisit only if multi-system fan-out appears).

**Depends on:** Plan 01 Task 6 (headless Codex auth), Plan 03 (something worth writing), Plan 02 (evals for the comparison).

---

## Task 1: Queue surface — pending runs

**Files:**
- Modify: `convex/agentRuns.ts`, `convex/agentTools.ts`, `convex/agentToolsHttp.ts`, `agent/src/tools/convexTools.ts`, `docs/agent-tool-surface.md`

**Steps:**

- [ ] Add `queued` handling: `enqueue(graphName, input)` internal mutation creating a `queued` run; `claimNextPending(graphName?, workerId)` mutation that atomically flips `queued → running` and stamps `workerId`/`startedAt` (single-worker now, but atomic claim prevents the two-worker future from double-running).
- [ ] Expose `/agent-tools/claimNextPendingRun` and `/agent-tools/getAgentRun` (both `AGENT_TOOL_SECRET`-gated). Claiming is a lifecycle write, consistent with the audit-write policy.
- [ ] Stale-run sweep: internal cron marks `running` runs with no event for >N minutes as `failed` with a `stale_worker` payload so crashed workers don't wedge the queue.
- [ ] Verify: convex tests for enqueue/claim/stale-sweep transitions.

## Task 2: Worker runner loop

**Files:**
- Create: `agent/src/worker/runner.ts`
- Modify: `agent/package.json` (script `worker`), `agent/Dockerfile`, `agent/docker-compose.yml`

**Steps:**

- [ ] Runner: poll `claimNextPendingRun` on an interval; map `graphName` → compiled graph (`weekly-brief`, `research-pipeline`); invoke with the run's `input`; stream node decisions into `appendAgentRunEvent`; finish with `markCompleted`/`markFailed`. Honor a max-concurrent of 1 initially.
- [ ] Graceful shutdown: on SIGTERM finish or fail the in-flight run; never abandon it silently.
- [ ] Compose services: `langgraph-worker` (runner) with mounted `.env` and the `CODEX_HOME` volume from plan 01 Task 6; optional `langgraph-dev` profile for Studio use.
- [ ] Verify: enqueue a research-pipeline run via `bunx convex run`, watch the local worker claim, execute, and complete it end-to-end.

## Task 3: Proxmox deployment

**Files:**
- Modify: `docs/proxmox-agent-deployment.md`, `agent/docker-compose.yml`

**Steps:**

- [ ] Provision an LXC/VM on `prox` or `prox2` (Docker host; add it to the Pulse-agent candidate list from the monitoring plan). Size for LangGraph JS + one Codex process: 2 vCPU / 4 GB is enough at one run at a time.
- [ ] Deploy via compose; secrets in the host env / mounted `.env`, `auth.json` seeded once per plan 01 Task 6. Network egress: Convex site URL, OpenRouter, OpenAI/ChatGPT endpoints, LangSmith.
- [ ] Monitoring hooks: container in Pulse; alert on worker container down and on stale-run sweep firing (reuse the monitoring plan's alert channel decision — resolve open question 6 there first).
- [ ] Verify: 72-hour soak — enqueue at least 5 runs across days; zero manual intervention; no secrets in logs (grep the container logs for token-shaped strings as a check).

## Task 4: Weekly-brief parallel comparison

**Objective:** Three cycles of Convex-cron brief vs agent-graph brief, judged with plan-02 evals plus manual review.

**Files:**
- Modify: `convex/crons.ts`, `convex/weeklyBriefs.ts` (or a small `convex/agentSchedule.ts`)

**Steps:**

- [ ] Add a Friday cron that enqueues a `weekly-brief` agent run alongside the existing `generate-weekly-turn` cron. Keep both producing; agent output lands as a draft (plan 03 path), never auto-publishing.
- [ ] Label both outputs per week: run `eval-weekly-brief.ts` against each; record scores side by side in `docs/eval-baselines.md`.
- [ ] Manual review each week: which brief actually drove the better weekend session? Note it in the brief's feedback or the decision log scratchpad — the embodied answer outranks the eval score if they disagree.
- [ ] After ≥3 cycles, write the decision-log entry: cut over / extend / reject, with the evidence.

## Task 5: Cutover (conditional on Task 4 resolving in the agent's favor)

**Steps:**

- [ ] Flip the Friday cron to enqueue-only; keep `internal.weeklyBriefs.generateInternal` as the documented fallback path, triggered automatically if the agent run fails or its draft isn't approved by Sunday 18:00 (deadline mirrors the weekend cadence).
- [ ] Enqueue `research-pipeline` on a weekday cron (start 1×/day, cap candidates per run) so hypothesis/recipe drafts accumulate for weekly review — this is where the pipeline becomes continuously autonomous rather than brief-only.
- [ ] Build `source-intake-triage` as the third graph (nodes per the June plan: load_new_sources → classify_domain → score_relevance → detect_duplicate_or_low_value → propose_status_update), using the cheap/fast model tier; wire its proposals as status-change drafts, not direct writes. Gate its usefulness on next-wave autonomous ingest landing (see `00-master-sequence.md` interlocks).
- [ ] Decision-log entry for the cutover and for triage-graph activation.

## Definition of Done (Gate G3)

- [ ] Worker runs unattended ≥2 weeks on Proxmox with monitoring and stale-run protection.
- [ ] 3-cycle comparison completed and resolved in the decision log.
- [ ] Post-cutover: agent-first brief with deterministic fallback; daily research-pipeline enqueue live.
