# Agent Tool Surface

This document defines the narrow Convex surface exposed to external LangGraph/LangChain agents.

The current phase is deliberately narrow: agents can read research state and can write audit-only agent-run lifecycle records. They cannot create or mutate hypotheses, recipes, sources, failures, or other project research data. Research-data write tools need a separate human-in-the-loop design before they are exposed.

## Authentication

All tool calls require `AGENT_TOOL_SECRET`.

- Convex actions accept `agentSecret`.
- HTTP routes accept `secret` in the JSON body.
- HTTP routes live under `/agent-tools/*`.

## Tools

### Read-only research tools

| Tool | HTTP path | Backing function | Purpose | Context notes |
| --- | --- | --- | --- | --- |
| `listRecentExtractions` | `/agent-tools/listRecentExtractions` | `extractions:listRecent` | Fetch recent extractions with claims, topics, questions, and composition parameters. | Use first when a brief or synthesis needs fresh source material. |
| `getExtraction` | `/agent-tools/getExtraction` | `extractions:get` | Fetch one extraction by id. | Use after `listRecentExtractions` when the agent needs full detail for a selected item. |
| `listRecentHypotheses` | `/agent-tools/listRecentHypotheses` | `hypotheses:listByStatus` | Fetch recent hypotheses with rationale and `whyThisMatters`. | No status filter in phase one; returns newest rows. |
| `listActiveTheses` | `/agent-tools/listActiveTheses` | `theses:list` | Fetch active theses. | Helps the weekly brief connect recommendations to durable research questions. |
| `listFailureArchive` | `/agent-tools/listFailureArchive` | `failures:listArchive` | Fetch recent derived failures. | Use to avoid recommending ideas already contradicted, retired, archived, or repeatedly low-yield. |
| `getEditorialSignals` | `/agent-tools/getEditorialSignals` | `dashboard:editorialSignals` | Fetch high-yield and low-yield concept clusters. | Useful for naming promising research lanes and weak paths. |
| `getRecentRecipes` | `/agent-tools/getRecentRecipes` | `recipes:listByStatus` | Fetch recent recipes with parameters and protocols. | Gives the agent concrete studio actions, not just abstract claims. |
| `getRecommendedActions` | `/agent-tools/getRecommendedActions` | `campaigns:getRecommendedActions` | Fetch deterministic next-action candidates. | Agent recommendations should explain when they diverge from these deterministic suggestions. |
| `searchSourcesByConcept` | `/agent-tools/searchSourcesByConcept` | `graph:searchSourcesByConcept` | Fetch sources linked to a concept name. | Returns source metadata only. It intentionally omits `rawText` and transcripts to protect context windows. |

### Audit-only write tools

These are the only write tools currently exposed. They write only to `agentRuns` and `agentRunEvents` for observability/review. They must not be used as a substitute for approved research-data writes.

| Tool | HTTP path | Backing function | Purpose | Context notes |
| --- | --- | --- | --- | --- |
| `createAgentRun` | `/agent-tools/createAgentRun` | `agentRuns:create` + `agentRuns:markRunning` | Create an audit run and mark it running. | Returns safe metadata: run id, status, and timestamps. |
| `appendAgentRunEvent` | `/agent-tools/appendAgentRunEvent` | `agentRuns:appendEvent` | Append a lifecycle/tool/decision/error event to an audit run. | Payloads should be sanitized; never include secrets or raw env data. |
| `markAgentRunCompleted` | `/agent-tools/markAgentRunCompleted` | `agentRuns:markCompleted` | Mark an audit run completed. | Optional summary and trace URL only. |
| `markAgentRunFailed` | `/agent-tools/markAgentRunFailed` | `agentRuns:markFailed` | Mark an audit run failed and optionally append sanitized error payload. | Error payloads should be high-level, not secrets. |

Research-data mutation tools such as `createHypothesisDraft`, `createRecipeDraft`, `markFailure`, source mutation tools, and review-approval mutations remain deferred.

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
