# Agent Tool Surface

This document defines the narrow Convex surface exposed to external LangGraph/LangChain agents.

Agents can read research state, write audit-only agent-run lifecycle records, and **propose** structured research drafts. They cannot create, mutate, or approve hypotheses, recipes, sources, failures, or other project research data directly. Research data only enters the system through the **draft → human-approval** path: an agent writes a `pending_review` draft, and a human approves it in the app, which promotes it into a real row. Agents must never approve their own work — the decision mutations are Clerk-authenticated and are deliberately **not** exposed on `/agent-tools/*`.

## Authentication

All tool calls require `AGENT_TOOL_SECRET`.

- Convex actions accept `agentSecret`.
- HTTP routes accept `secret` in the JSON body.
- HTTP routes live under `/agent-tools/*`.

## Tools

<!-- AGENT_TOOLS:BEGIN -->

### Read-only research tools

| Tool | HTTP path | Backing function | Purpose | Context notes |
| --- | --- | --- | --- | --- |
| `listRecentExtractions` | `/agent-tools/listRecentExtractions` | `extractions:listRecent` | Fetch recent structured source extractions with claims, topics, open questions, and composition parameters. | Use first when a brief or synthesis needs fresh source material. |
| `getExtraction` | `/agent-tools/getExtraction` | `extractions:get` | Fetch one extraction by Convex extraction id. | Use after listRecentExtractions when the agent needs full detail for a selected item. |
| `listRecentHypotheses` | `/agent-tools/listRecentHypotheses` | `hypotheses:listByStatus` | Fetch recent hypotheses with rationale and whyThisMatters. | No status filter in phase one; returns newest rows. |
| `listActiveTheses` | `/agent-tools/listActiveTheses` | `theses:list` | Fetch active research theses that should anchor weekly brief recommendations. | Helps the weekly brief connect recommendations to durable research questions. |
| `listFailureArchive` | `/agent-tools/listFailureArchive` | `failures:listArchive` | Fetch recent failed, retired, contradicted, archived, or low-yield research paths to avoid repeating them. | Use to avoid recommending ideas already contradicted, retired, archived, or repeatedly low-yield. |
| `getEditorialSignals` | `/agent-tools/getEditorialSignals` | `dashboard:editorialSignals` | Fetch high-yield and low-yield concept clusters from the editorial graph. | Useful for naming promising research lanes and weak paths. |
| `getRecentRecipes` | `/agent-tools/getRecentRecipes` | `recipes:listByStatus` | Fetch recent composition recipes with parameters, DAW checklists, and protocols. | Gives the agent concrete studio actions, not just abstract claims. |
| `getRecommendedActions` | `/agent-tools/getRecommendedActions` | `campaigns:getRecommendedActions` | Fetch deterministic recommended action candidates from the current campaign scope. | Agent recommendations should explain when they diverge from these deterministic suggestions. |
| `searchSourcesByConcept` | `/agent-tools/searchSourcesByConcept` | `graph:searchSourcesByConcept` | Find source metadata linked to a concept name. Raw text is intentionally omitted. | Returns source metadata only. It intentionally omits rawText and transcripts to protect context windows. |
| `getSelfImprovementStats` | `/agent-tools/getSelfImprovementStats` | `agentTools:selfImprovementStats` | Fetch read-only self-improvement stats for the weekly brief's 'what the system learned' section: new edit-captures count, agent-review-draft approve/reject counts with rejection notes, and memory_recall run-event notes, all window-filtered by daysBack (default 7). Prompt promotions are not tracked here yet — never claim one happened unless told separately. All counts come straight from Convex; never invent or round numbers not present in the response. | Accepts optional `daysBack` (default 7, max 90) and degrades to all-zero counts and empty note arrays when the window is empty. Prompt/policy promotions are not included because they live in `docs/eval-baselines.md` and the decision log via `scripts/langsmith/promote.ts`; wire a field here once a queryable store exists. |

### Audit-only write tools

These are the only write tools currently exposed. They write only to agent audit/review records and must not substitute for approved research-data writes.

| Tool | HTTP path | Backing function | Purpose | Context notes |
| --- | --- | --- | --- | --- |
| `createAgentRun` | `/agent-tools/createAgentRun` | `agentRuns:create + agentRuns:markRunning` | Create an audit-only Convex agent run record and mark it running. Does not mutate research data. | Returns safe metadata: run id, status, and timestamps. |
| `appendAgentRunEvent` | `/agent-tools/appendAgentRunEvent` | `agentRuns:appendEvent` | Append an audit-only lifecycle event to a Convex agent run. Does not mutate research data. | Payloads should be sanitized; never include secrets or raw env data. |
| `markAgentRunCompleted` | `/agent-tools/markAgentRunCompleted` | `agentRuns:markCompleted` | Mark an audit-only Convex agent run completed. Does not mutate research data. | Optional summary and trace URL only. |
| `markAgentRunNeedsReview` | `/agent-tools/markAgentRunNeedsReview` | `agentRuns:markNeedsReview` | Mark an audit-only Convex agent run as needs_review after producing a human-review draft. Does not mutate research data. | Draft is sanitized server-side. |
| `createAgentReviewDraft` | `/agent-tools/createAgentReviewDraft` | `agentDrafts:createFromAgentRun` | Persist a sanitized human-review draft linked to an agent run. Creates an agentReviewDraft row and audit event; does not publish research artifacts. | `whyThisMatters` is enforced at draft creation; payload-less drafts are acknowledge-only and cannot be promoted. The research-pipeline hallucinated-ID gate rejects payloads referencing source, extraction, or hypothesis ids the run never read. |
| `markAgentRunFailed` | `/agent-tools/markAgentRunFailed` | `agentRuns:markFailed` | Mark an audit-only Convex agent run failed and optionally record sanitized error details. Does not mutate research data. | Error payloads should be high-level, not secrets. |
| `claimNextPendingRun` | `/agent-tools/claimNextPendingRun` | `agentRuns:claimNextPending` | Atomically claim the oldest queued Convex agent run for a worker, flipping it to running. Production worker only. | Production worker only. A lifecycle write, not a research-data write. |
| `getAgentRun` | `/agent-tools/getAgentRun` | `agentRuns:getForWorker` | Fetch the full Convex agent run document including raw input by id for status polling. Audit-only read. | Worker status polling; public getters strip input. |

<!-- AGENT_TOOLS:END -->

### Human-only decision mutations (NOT on the agent surface)

Draft promotion is where agent proposals become real research data. These are Clerk-authenticated `mutation`s in `agentDrafts.ts` and are intentionally **absent** from `/agent-tools/*` — an agent can never call them.

| Mutation | Effect |
| --- | --- |
| `agentDrafts.approve` | `pending_review` → `approved`. Promotes the payload into a real hypothesis/recipe with `origin: "agent"` provenance (`agentRunId`, `agentDraftId`, trace URL), full `whyThisMatters` enforcement, and concept linking; logs a `draft_write` event. |
| `agentDrafts.reject` | `pending_review` → `rejected`. A decision note is **required** (rejections are learning signal for the eval loop, never silent). |
| `agentDrafts.supersede` | `pending_review` → `superseded`, pointing at the replacing draft (for re-runs). |

**Promotion invariants**

- A draft is promotable only if it carries a structured `payload`; payload-less (legacy dry-run) drafts are acknowledge-only.
- `whyThisMatters` is enforced both at draft creation and again at promotion (a blank stake is rejected).
- Recipe drafts must reference a `hypothesisId` to promote; promotion synthesizes `bodyMd`/`dawChecklist` when absent so the promoted recipe satisfies every recipes-table requirement.
- Promoted rows are indistinguishable in rigor from human-authored ones, differing only in provenance fields.
- Only `pending_review` drafts can be decided; approving/rejecting an already-decided draft is rejected.

Remaining deferred research-data tools: direct source mutation tools and `markFailure`.

## Dataset Quality Criteria

These criteria guide the eval dataset export and manual curation step.

**Good extraction**

- At least 3 claims.
- Evidence levels are not all `speculative`.
- At least 1 composition parameter.
- No obvious hallucination on re-read.

**Good hypothesis**

- Has a non-empty `whyThisMatters` that names a musical stake.
- Is traceable to source claims.
- Is not represented in the failure archive.

**Good weekly brief**

- Contains 3 or more experiment cards.
- References at least one active thesis.
- Names at least one contradiction, weak path, or low-yield area.

## Expansion Rules

Add a new tool only when an agent run demonstrably needs it. Prefer small, specific read tools over exposing broad table access.

Do not add research-data write tools in this phase. Candidate write tools such as `createHypothesisDraft` and `markFailure` belong in the later LangGraph plan after approval flows are designed. The four audit-only write tools above are the sole exception and must remain limited to agent-run lifecycle records.
