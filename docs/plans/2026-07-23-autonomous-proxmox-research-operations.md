# Autonomous Proxmox Research Operations

**Goal:** Run Frequency Music's research and issue-maintenance loops as an always-on, observable service on the Proxmox cluster, while keeping human approval at the points where the system can publish, promote, or rewrite durable project state.

**Short answer:** yes, this can run well in the Proxmox cluster. Use a small Debian/Ubuntu VM for the main autonomous worker, not the Proxmox host directly. Start with one worker, one queue, local-first inference for cheap triage, and Codex subscription-backed inference only where the official Codex CLI/SDK path supports it. Do not treat normal ChatGPT or Claude subscriptions as general API credentials.

**Related plans and docs:**
- `../archive/plan-waves/2026-07-01-01-codex-sdk-inference-provider.md`
- `../archive/plan-waves/2026-07-01-04-production-worker-and-scheduling.md`
- `../archive/plan-waves/2026-07-01-05-self-improvement-loop.md`
- `../proxmox-agent-deployment.md`
- `../agent-tool-surface.md`

---

## 1. Operating Model

The system should run as a conservative autonomous loop:

1. Convex remains the scheduler and source of truth.
2. Convex crons enqueue `agentRuns`.
3. A Proxmox worker claims one pending run at a time.
4. The worker executes a LangGraph graph such as `research-pipeline`, `weekly-brief`, or future `source-intake-triage`.
5. The worker writes audit events and review drafts.
6. Humans approve, reject, supersede, publish, or promote. Agents do not approve themselves.
7. GitHub issues are created or updated only from narrow, auditable outputs.

This matches the existing repo decisions: the agent can create drafts and lifecycle audit writes, but promotion into first-class research data stays human-gated.

---

## 2. Proxmox Deployment Recommendation

Use a VM for the main autonomous runner.

**Recommended shape:**
- Debian or Ubuntu VM
- 2 vCPU / 4 GB RAM to start
- Docker installed inside the VM
- Persistent volumes for `CODEX_HOME`, worker state, and optional LangGraph memory store
- Outbound network access to Convex, GitHub, model providers, and LangSmith
- No inbound public access unless LangGraph Studio or an admin UI is intentionally exposed behind auth

Why VM-first:

- Proxmox officially supports KVM VMs and LXC containers. VMs are the cleaner default for Docker-based automation that may run repo tools, language runtimes, and future sandboxed code.
- Unprivileged LXC is good for lightweight trusted services, but the main agent worker will hold meaningful credentials and may eventually execute generated verification code.
- GPU/PCIe passthrough is a VM-first path in Proxmox docs, so choosing a VM avoids rework if local inference later needs GPU acceleration.

Use LXC only for secondary trusted services such as n8n, dashboards, small schedulers, or a lightweight GitHub runner with limited credentials.

Sources:
- Proxmox VE admin guide: https://pve.proxmox.com/pve-docs/pve-admin-guide.html
- Proxmox unprivileged containers: https://pve.proxmox.com/pve-docs/pve-admin-guide.html#_unprivileged_containers
- Proxmox PCI passthrough: https://pve.proxmox.com/pve-docs/pve-admin-guide.html#qm_pci_passthrough

---

## 3. Autonomy Layers

### Layer A: Repo and Issue Hygiene

Use GitHub's native automation where possible:

- Scheduled GitHub Actions for low-risk recurring checks.
- `GITHUB_TOKEN` with minimal permissions for issue creation and maintenance.
- A self-hosted runner in Proxmox only when local tools, private network access, or heavier compute is needed.

Good first jobs:

- Daily stale issue triage: identify issues blocked on missing reproduction, stale PR feedback, failed CI, or missing owner.
- Weekly plan drift report: compare open issues against active docs/plans and create/update a tracking issue.
- Research intake candidate issue creation: create issues for high-confidence source gaps or candidate research threads, but label them `needs-human-review`.

Sources:
- GitHub self-hosted runners: https://docs.github.com/en/actions/concepts/runners/self-hosted-runners
- Scheduled issue creation: https://docs.github.com/en/actions/tutorials/manage-your-work/schedule-issue-creation
- Scheduled workflow behavior: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

### Layer B: Research Pipeline

Use the existing `research-pipeline` graph as the autonomous research loop.

Initial cadence:

- Run once per weekday.
- Limit candidate count per run.
- Produce `agentReviewDrafts`, not published rows.
- Attach source citations, candidate IDs, provider/model metadata, and reasoning events.
- Skip or downgrade candidates that hit failure archive entries, contradictions, or low-yield memories.

Human review remains the release valve:

- Approve drafts into hypotheses/recipes.
- Reject with notes that become negative examples.
- Supersede when a better synthesis replaces an older draft.

### Layer C: Weekly Briefs

Keep the planned comparison period:

- Run Convex's existing weekly brief path and the agent-generated weekly brief in parallel.
- Evaluate both for at least three cycles.
- Cut over only if the agent path wins on practical studio usefulness, not just evaluator scores.
- Keep the deterministic Convex path as fallback.

### Layer D: Self-Improvement

After the worker is stable:

- Capture human edits as eval examples.
- Export studio outcomes as labels.
- Add LangGraph memory for contradictions, low-yield concepts, and run summaries.
- Promote prompt or provider changes only through eval-gated scripts plus decision log entries.

---

## 4. Inference Strategy

Use three provider tiers instead of trying to make one credential solve everything.

### Tier 1: Local Inference For Cheap Triage

Run Ollama first for classification, dedupe, rough source scoring, and issue summarization. This avoids provider keys for low-stakes work and keeps costs predictable.

Use vLLM later only if a Proxmox node has enough GPU capacity and the project needs higher throughput or an OpenAI-compatible local serving layer.

Sources:
- Ollama: https://github.com/ollama/ollama
- Ollama API: https://github.com/ollama/ollama/blob/main/docs/api.md
- vLLM: https://github.com/vllm-project/vllm
- Open WebUI, useful for local inspection/admin: https://docs.openwebui.com/

### Tier 2: Codex Subscription Auth For Codex-Owned Work

The repo already plans and partially documents a special path: `@openai/codex-sdk` driving the local Codex CLI session from `CODEX_HOME/auth.json`.

Use this for:

- Non-tool specialist reasoning.
- Structured draft generation where the SDK supports structured output.
- Verification sandbox tasks where Codex can inspect files, write throwaway code, and return a structured result.

Do not use it for:

- LangChain tool-binding paths that require a conventional chat model adapter.
- Generic HTTP inference for arbitrary apps.
- Public/shared CI where copying a user session token would be inappropriate.

Operational rules:

- Seed `CODEX_HOME/auth.json` once into the worker volume only if missing.
- Persist the volume so refreshed auth state survives deploys.
- Never commit, log, or bake `auth.json` into an image.
- Keep OpenRouter/API fallback enabled for quota, auth expiry, or tool-binding needs.

OpenAI sources:
- Codex CLI supports ChatGPT sign-in: https://help.openai.com/en/articles/11381614-api-codex-cli-and-sign-in-with-chatgpt
- Codex with ChatGPT plan: https://help.openai.com/en/articles/11369540-using-codex-with-your-chat

### Tier 3: API, IAM, Or Brokered Fallback

Normal ChatGPT Plus/Pro and Claude Pro/Max subscriptions should not be treated as API credentials.

OpenAI API requests use API authentication and Platform billing. ChatGPT billing and API Platform billing are separate.

Anthropic's Claude API requires Console/API authentication or supported workload identity flows. Claude Pro/Max can apply to Claude Code specifically, but that does not make Claude Pro/Max a generic inference API backend.

Sources:
- OpenAI API authentication: https://platform.openai.com/docs/api-reference/authentication
- OpenAI ChatGPT vs Platform billing: https://help.openai.com/en/articles/9039756-billing-settings-in-chatgpt-vs-platform
- Anthropic API overview: https://docs.claude.com/en/api/overview.md
- Claude Code with Pro/Max: https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan

Safer alternatives to long-lived provider keys:

- Local inference with Ollama/vLLM.
- GitHub Actions `GITHUB_TOKEN` for repo issue actions.
- Anthropic Workload Identity Federation where available.
- Cloud IAM routes such as Bedrock, Vertex, or Microsoft Foundry when those platforms already fit the infrastructure.

---

## 5. Issue Automation Policy

The autonomous system may create or update issues when all of the following are true:

- The issue is backed by a concrete source, failing check, stale plan item, or explicit draft.
- The body includes provenance: run id, graph name, source URLs or repo paths, and confidence.
- Labels route it correctly, for example `agent-generated`, `needs-human-review`, `research-intake`, `maintenance`, or `blocked`.
- It does not assign humans, close issues, merge PRs, approve drafts, or publish content without explicit human action.

Suggested issue flow:

1. Worker writes an `issueProposal` event.
2. A GitHub Action or narrow worker job converts high-confidence proposals into GitHub issues.
3. Created issue URL is written back to the agent run event stream.
4. Weekly hygiene job checks whether agent-generated issues were accepted, closed, ignored, or converted into plans.

---

## 6. Implementation Plan

### Phase 0: Preflight

- [ ] Confirm current worker branch state and merge or rebase the completed PR follow-ups.
- [ ] Verify `agent/README.md`, `docs/proxmox-agent-deployment.md`, and plan 04 reflect current code.
- [ ] Decide whether the first worker is VM-only or split VM + LXC.
- [ ] Pick labels for agent-created issues.

### Phase 1: Proxmox Worker

- [ ] Provision one Debian/Ubuntu VM on Proxmox.
- [ ] Install Docker and deploy `agent/docker-compose.yml`.
- [ ] Mount persistent volumes for `CODEX_HOME` and optional LangGraph memory.
- [ ] Configure environment without committing populated `.env` files.
- [ ] Run `bun run automation:local` and `bun run smoke:research-pipeline`.
- [ ] Run a 72-hour soak with at least five queued runs.

### Phase 2: Local Triage Inference

- [ ] Add Ollama service to the VM or a nearby LXC.
- [ ] Add a small provider adapter for triage-only tasks.
- [ ] Route source classification, dedupe hints, stale issue summaries, and rough candidate scoring to the local model.
- [ ] Keep final draft generation on Codex/OpenRouter until local quality is proven.

### Phase 3: Autonomous Research Runs

- [ ] Enable weekday `research-pipeline` enqueue.
- [ ] Cap candidate count and model spend per run.
- [ ] Require every candidate draft to include citations and provenance.
- [ ] Ensure rejection notes and edits export into eval candidates.
- [ ] Add weekly report section: what changed, what was rejected, what the system learned.

### Phase 4: Issue Operations

- [ ] Add an `issueProposal` event shape.
- [ ] Add a script or GitHub Action that turns eligible proposals into issues using `GITHUB_TOKEN`.
- [ ] Add a dry-run mode that prints the issue body and labels without creating anything.
- [ ] Enable creation only for `needs-human-review` issues first.
- [ ] Track issue outcomes back into the weekly self-improvement report.

### Phase 5: Guarded Expansion

- [ ] Add LangGraph memory after the worker is stable.
- [ ] Add provider/prompt promotion gates.
- [ ] Add verification sandbox only after Gate G3 and after weekly-brief comparison favors the agent path.
- [ ] Consider vLLM only if local GPU capacity exists and Ollama is not enough.

---

## 7. Definition Of Done

- [ ] The Proxmox worker runs unattended for two weeks.
- [ ] Stale runs are detected and marked without manual database repair.
- [ ] Research-pipeline runs daily on weekdays and produces review drafts with citations.
- [ ] Issue proposals can be dry-run and then created with `GITHUB_TOKEN`.
- [ ] No browser-session scraping or unsupported subscription-to-API bridge is used.
- [ ] Codex subscription auth is limited to the official Codex CLI/SDK path with fallback.
- [ ] Local inference handles at least one low-risk triage job reliably.
- [ ] Weekly report shows approved drafts, rejected drafts, issue outcomes, and memory/eval changes.

---

## Open Questions

- Which Proxmox node should host the first worker VM?
- Should issue creation be fully automatic for low-risk maintenance issues, or should the first release only create issue proposal drafts?
- Which labels should become the canonical issue workflow labels?
- Do we want a local Ollama-only phase before enabling any subscription/API-backed autonomous run?
- Should the worker run only Frequency Music, or become a shared Resonant Projects automation runner later?
