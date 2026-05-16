# LangGraph + Deep Agents Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a self-hosted LangGraph Agent Server next to the existing n8n at `zap.rproj.art`, build a Deep Agent for weekly brief generation that uses Convex agent-tools as its data source, and prove the value vs. the current static-prompt weekly brief before expanding to hypothesis generation and audio verification.

**Why second:** This plan changes runtime architecture. The static-prompt pipeline already works. The reason to do this is that the weekly brief is the most agentic-feeling step in the current pipeline — it has to look across many extractions, pick a few, surface contradictions, and recommend recipes — and a deep agent with planning, subagents, and tool use should outperform a single prompt template. If it does, the same pattern extends to hypothesis generation. If it does not, the project keeps what works and avoids deeper integration.

**Prerequisites:**

- Complete `docs/superpowers/plans/2026-05-14-langchain-integration-prep.md`. Specifically, `convex/agentTools.ts` must be live, the `/agent-tools/*` HTTP routes must be reachable, and `AGENT_TOOL_SECRET` must be set.
- LangSmith tracing should be in place (`docs/superpowers/plans/2026-05-14-langsmith-integration.md`). Deep Agents emit detailed traces that are invaluable for debugging multi-step plans; tracing is technically optional but practically required.

**Tech Stack:** Bun for tooling. New `agent/` workspace using Node-compatible packages: `deepagents`, `langchain`, `@langchain/core`, `@langchain/anthropic`, `@langchain/langgraph`, `@langchain/langgraph-sdk`. LangGraph CLI for local dev and deployment.

---

## Architecture summary

```
                      ┌─────────────────────────────────────┐
                      │  Self-hosted LangGraph Agent Server │
                      │  (Docker, alongside n8n)            │
                      │                                     │
   Convex cron ──────▶│  weekly-brief-agent                 │
   (Friday 16:00 UTC) │   ├─ supervisor                     │
                      │   ├─ research subagent              │
                      │   ├─ contradiction-check subagent   │
                      │   └─ stake-naming subagent          │
                      │                                     │
                      │  Tools: Convex agent-tools (HTTP)   │
                      │         web_search                  │
                      │         writeFile (virtual FS)      │
                      └────────┬────────────────────────────┘
                               │
                               ▼  POST result back to Convex
                      ┌─────────────────────────────────────┐
                      │  convex/weeklyBriefs.create         │
                      │  (existing internalMutation)        │
                      └─────────────────────────────────────┘
```

Key choices:

- **Separate workspace** for the agent code (`agent/` directory or a sibling repo). Reasons: different runtime than Convex (Node vs Convex sandbox), different deploy target (Docker container), different dependency set.
- **Convex stays the system of record.** The agent reads via agent-tools, writes results back via existing Convex actions. Convex never depends on the agent; if the agent is down the rest of the pipeline keeps working.
- **The first agent replaces only the weekly brief generation.** Not extraction. Not hypothesis. Not recipe. Weekly brief is the right starting point because it is the most multi-step and least time-sensitive (Friday afternoon batch, not on-demand from a user).
- **No write tools on the agent in this phase.** The agent produces a draft brief; the existing `weeklyBriefs.create` internal mutation persists it. Human-in-the-loop comes later.

---

## File Structure

### New `agent/` workspace (inside the frequency-music repo)

| Action | Path                                          | Responsibility                                                            |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------- |
| Create | `agent/package.json`                          | Separate package with Node-compatible deps                                |
| Create | `agent/tsconfig.json`                         | TypeScript config                                                         |
| Create | `agent/langgraph.json`                        | LangGraph CLI config: which graphs to expose                              |
| Create | `agent/src/tools/convexTools.ts`              | Wrap each `/agent-tools/*` HTTP route as a LangChain `tool()`             |
| Create | `agent/src/tools/index.ts`                    | Bundle and export the toolset                                             |
| Create | `agent/src/agents/weekly-brief/index.ts`      | Main entry: createDeepAgent with supervisor + subagents                   |
| Create | `agent/src/agents/weekly-brief/subagents.ts`  | Subagent definitions (research, contradiction, stake-naming)              |
| Create | `agent/src/agents/weekly-brief/prompts.ts`    | System prompts for supervisor and subagents                               |
| Create | `agent/src/agents/weekly-brief/schema.ts`     | Zod schema for the structured brief output                                |
| Create | `agent/src/agents/weekly-brief/index.test.ts` | Unit tests with fake chat model                                           |
| Create | `agent/Dockerfile`                            | Build the agent image                                                     |
| Create | `agent/docker-compose.yml`                    | Compose file co-locating with n8n if useful, or standalone                |
| Create | `agent/.env.example`                          | LangSmith key, Convex URL, agent secret, OpenRouter key                   |
| Create | `agent/README.md`                             | How to run locally, how to deploy, where things live                      |

### frequency-music repo (existing)

| Action | Path                                          | Responsibility                                                            |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------- |
| Modify | `convex/weeklyBriefs.ts`                      | Add `generateInternalAgentic` action that calls the Agent Server         |
| Modify | `convex/crons.ts`                             | Add a new weekly cron at a separate time for the agentic brief           |
| Create | `convex/agentClient.ts`                       | Thin HTTP client for the LangGraph Agent Server                          |
| Modify | `web/src/routes/weekly-brief-detail.tsx`      | Show "Agentic" vs "Static" provenance badge on briefs                    |
| Modify | `docs/decision-log.md`                        | Log the result of the side-by-side comparison after week 3               |

---

## Task 1: Stand Up the Agent Workspace

Before any agent logic, get the workspace bootstrapped and running an empty deep agent.

### Step 1: Create the workspace

- [ ] Create `agent/` directory at the repo root with this structure:

  ```bash
  mkdir -p agent/src/{agents/weekly-brief,tools}
  cd agent
  npm init -y  # using npm here, not bun, because LangGraph CLI expects Node tooling
  ```

- [ ] Edit `agent/package.json`:

  ```json
  {
    "name": "resonant-projects-agent",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "langgraph dev",
      "build": "langgraph build",
      "up": "langgraph up",
      "test": "node --test"
    },
    "dependencies": {
      "@langchain/anthropic": "^0.3.0",
      "@langchain/core": "^0.3.0",
      "@langchain/langgraph": "^0.2.0",
      "@langchain/langgraph-sdk": "^0.1.0",
      "deepagents": "^0.1.0",
      "langchain": "^0.3.0",
      "langsmith": "^0.3.0",
      "zod": "^3.23.0"
    },
    "devDependencies": {
      "@langchain/langgraph-cli": "^0.1.0",
      "typescript": "^5.5.0"
    }
  }
  ```

  Pin to exact versions after running the smoke test in Step 4. Versions move fast in this ecosystem.

- [ ] Create `agent/tsconfig.json` with Node ESM settings, `"module": "esnext"`, `"target": "es2022"`, `"moduleResolution": "bundler"`.

- [ ] Create `agent/.env.example`:

  ```
  LANGSMITH_API_KEY=
  LANGSMITH_PROJECT=resonant-projects-agent-dev
  LANGSMITH_TRACING=true
  ANTHROPIC_API_KEY=
  OPENROUTER_API_KEY=
  CONVEX_SITE_URL=
  AGENT_TOOL_SECRET=
  ```

  Note: Anthropic key is direct, because Deep Agents and `@langchain/anthropic` route to Anthropic by default. OpenRouter is for the rare case the agent needs a non-Anthropic model.

### Step 2: Smallest possible deep agent

- [ ] Create `agent/src/agents/weekly-brief/index.ts`:

  ```typescript
  import { createDeepAgent } from "deepagents";
  import { z } from "zod";
  import { tool } from "langchain";

  const echoTool = tool(
    ({ message }) => `Echo: ${message}`,
    {
      name: "echo",
      description: "Echoes back a message.",
      schema: z.object({ message: z.string() }),
    },
  );

  export const agent = createDeepAgent({
    tools: [echoTool],
    system: "You are a research synthesis assistant. Use the echo tool to confirm setup.",
  });
  ```

- [ ] Create `agent/langgraph.json`:

  ```json
  {
    "graphs": {
      "weekly-brief": "./src/agents/weekly-brief/index.ts:agent"
    },
    "env": ".env"
  }
  ```

### Step 3: Local dev server

- [ ] From `agent/`:

  ```bash
  cp .env.example .env
  # fill in keys
  npm install
  npm run dev
  ```

  Expected: LangGraph CLI starts a local server on port 2024. Studio UI opens. Visit, send "echo hello", see the agent call the tool and respond.

### Step 4: Confirm tracing

- [ ] In the LangSmith UI, project `resonant-projects-agent-dev`, find a trace for the echo run. Expected: full trace tree with the agent step and the tool call visible.

### Step 5: Commit

- [ ] Commit:

  ```bash
  git add agent/
  echo "agent/.env" >> .gitignore
  git add .gitignore
  git commit -m "feat(agent): scaffold LangGraph agent workspace with echo deep agent"
  ```

---

## Task 2: Convex Tools

Wrap each `/agent-tools/*` HTTP endpoint as a LangChain `tool()` the agent can call.

### Step 1: Define one tool wrapper

- [ ] Create `agent/src/tools/convexTools.ts` starting with the simplest tool, `listRecentExtractions`:

  ```typescript
  import { tool } from "langchain";
  import { z } from "zod";

  const CONVEX_URL = process.env.CONVEX_SITE_URL!;
  const AGENT_SECRET = process.env.AGENT_TOOL_SECRET!;

  async function callConvex<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const resp = await fetch(`${CONVEX_URL}/agent-tools/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: AGENT_SECRET, ...body }),
    });
    if (!resp.ok) {
      throw new Error(`Convex tool ${path} failed: ${resp.status} ${await resp.text()}`);
    }
    return resp.json();
  }

  export const listRecentExtractions = tool(
    async ({ limit }) => {
      const items = await callConvex<any[]>("listRecentExtractions", { limit });
      // Strip rawText if any leaks through — never let raw source dumps reach the agent context.
      return JSON.stringify(
        items.map(({ rawText: _, ...rest }) => rest),
        null,
        2,
      );
    },
    {
      name: "list_recent_extractions",
      description:
        "Returns the most recent extractions from Convex, each with summary, claims, composition parameters, topics, and source metadata. Use this to see what research has come in recently. Default limit is 20; raise it only when needed.",
      schema: z.object({
        limit: z.number().min(1).max(50).default(20).describe("How many extractions to return"),
      }),
    },
  );
  ```

### Step 2: Add the rest of the tools

- [ ] Add wrappers for every tool in `docs/agent-tool-surface.md`. Each follows the same pattern: typed Zod schema, descriptive `description`, calls `callConvex`. Keep descriptions specific — the agent decides which tool to call based on them.

  Required tools for the weekly brief agent:

  - `list_recent_extractions`
  - `list_recent_hypotheses`
  - `list_active_theses`
  - `list_failure_archive`
  - `get_editorial_signals`
  - `get_recent_recipes`
  - `get_recommended_actions`
  - `search_sources_by_concept`

### Step 3: Add web search

- [ ] LangChain has built-in web search integrations. The simplest is Tavily (free tier). Add to `agent/src/tools/index.ts`:

  ```typescript
  import { TavilySearch } from "@langchain/tavily";
  import * as convex from "./convexTools";

  export const tools = [
    convex.listRecentExtractions,
    convex.listRecentHypotheses,
    convex.listActiveTheses,
    convex.listFailureArchive,
    convex.getEditorialSignals,
    convex.getRecentRecipes,
    convex.getRecommendedActions,
    convex.searchSourcesByConcept,
    new TavilySearch({ maxResults: 5 }),
  ];
  ```

  Web search is the one tool the static prompt cannot offer. It is the most likely source of agent advantage on recent topics.

### Step 4: Tool contract tests

- [ ] Create `agent/src/tools/convexTools.test.ts` using Node's built-in `node:test`. For each tool:

  - Mock `fetch` to return a known response.
  - Call the tool with valid args.
  - Assert the tool returns the expected stringified shape.
  - Call with the wrong secret simulation, assert error.

- [ ] Run `npm test`. Expected: all pass.

### Step 5: Commit

- [ ] Commit:

  ```bash
  git add agent/src/tools agent/package.json
  git commit -m "feat(agent): wrap Convex agent-tools as LangChain tools"
  ```

---

## Task 3: Weekly Brief Deep Agent

Now the agent gets real work.

### Step 1: Output schema

- [ ] Create `agent/src/agents/weekly-brief/schema.ts`:

  ```typescript
  import { z } from "zod";

  export const briefOutputSchema = z.object({
    weekOf: z.string().describe("ISO date of Monday of this week"),
    bodyMd: z.string().describe("Markdown body of the brief"),
    recommendedHypothesisIds: z.array(z.string()).max(10),
    recommendedRecipeIds: z.array(z.string()).max(10),
    activeThesisIds: z.array(z.string()).max(10),
    referencedFailureKeys: z.array(z.string()).max(10),
    studioPrompts: z.object({
      tenMinuteMd: z.string(),
      thirtyMinuteMd: z.string(),
      ninetyMinuteMd: z.string(),
    }),
    todo: z.array(z.string()).max(20),
    recommendedActions: z.array(
      z.object({
        kind: z.enum([
          "advance_recipe",
          "revive_recipe",
          "expand_composition",
          "compare_branch",
          "prototype_hypothesis",
        ]),
        targetType: z.enum(["hypothesis", "recipe", "composition"]),
        targetId: z.string(),
        durationBucket: z.enum(["10-minute", "30-minute", "90-minute"]),
        reason: z.string(),
      }),
    ),
  });
  ```

  This matches the existing `internalMutation` in `convex/weeklyBriefs.ts:create`. Keep them in sync.

### Step 2: Subagent prompts

- [ ] Create `agent/src/agents/weekly-brief/prompts.ts`:

  ```typescript
  export const SUPERVISOR_PROMPT = `You are the lead research synthesis assistant for "Resonant Projects," a music + physics + mathematics composition project.

Your job is to produce a weekly brief that helps Keith decide what to work on in the studio this weekend.

Your workflow:
1. Use list_recent_hypotheses, list_recent_extractions, list_active_theses, and list_failure_archive to gather the week's context.
2. Use get_editorial_signals to see high-yield and low-yield concept areas.
3. Delegate to the research subagent for any extraction that needs deeper unpacking.
4. Delegate to the contradiction-check subagent before recommending any hypothesis.
5. Delegate to the stake-naming subagent for any hypothesis whose whyThisMatters is weak.
6. Produce a brief that:
   - Names 3-7 experiment cards with clear stakes and DAW requirements
   - References at least one active thesis
   - Surfaces at least one contradiction or low-yield path
   - Includes 10/30/90-minute studio prompts
   - Returns the result as a structured object matching the brief schema

Be specific. Avoid procedural filler. Every experiment must answer "what would change musically if this holds?"`;

  export const RESEARCH_SUBAGENT_PROMPT = `You investigate a single extraction in depth. Pull related sources by concept, scan for cross-references, and report:
- What the extraction strongly claims
- What it leaves uncertain
- What other recent extractions touch the same concepts
- Whether anything in the failure archive contradicts it
Output: a short markdown briefing.`;

  export const CONTRADICTION_SUBAGENT_PROMPT = `You check a candidate hypothesis against the failure archive and active theses.
Use list_failure_archive and list_active_theses with search_sources_by_concept.
Output: { contradicts: boolean, contradictions: [string], notes: string }.
Be strict. Soft alignment is not a contradiction. Direct reversal or repeated low-yield is.`;

  export const STAKE_SUBAGENT_PROMPT = `You rewrite whyThisMatters for a hypothesis so it names a concrete musical or perceptual stake.
Input: the hypothesis, its claims, and its composition parameters.
Output: a single paragraph naming what would change in listening, harmony, rhythm, or timbre if the hypothesis holds. No procedural language ("we will explore"). State the consequence.`;
  ```

### Step 3: Wire up the agent

- [ ] Create `agent/src/agents/weekly-brief/subagents.ts`:

  ```typescript
  import {
    RESEARCH_SUBAGENT_PROMPT,
    CONTRADICTION_SUBAGENT_PROMPT,
    STAKE_SUBAGENT_PROMPT,
  } from "./prompts";
  import { tools } from "../../tools";

  export const subagents = [
    {
      name: "research",
      description: "Use to investigate a single extraction in depth.",
      prompt: RESEARCH_SUBAGENT_PROMPT,
      tools: tools, // all tools available to subagents
    },
    {
      name: "contradiction-check",
      description: "Use to check whether a candidate hypothesis contradicts the failure archive or active theses.",
      prompt: CONTRADICTION_SUBAGENT_PROMPT,
      tools: tools,
    },
    {
      name: "stake-naming",
      description: "Use to strengthen a weak whyThisMatters with a concrete musical stake.",
      prompt: STAKE_SUBAGENT_PROMPT,
      tools: [], // no tools needed; pure reasoning
    },
  ];
  ```

- [ ] Replace `agent/src/agents/weekly-brief/index.ts` (was echo agent) with the real one:

  ```typescript
  import { createDeepAgent } from "deepagents";
  import { ChatAnthropic } from "@langchain/anthropic";
  import { tools } from "../../tools";
  import { subagents } from "./subagents";
  import { SUPERVISOR_PROMPT } from "./prompts";

  export const agent = createDeepAgent({
    model: new ChatAnthropic({ model: "claude-sonnet-4-6", maxTokens: 8000 }),
    tools,
    subagents,
    system: SUPERVISOR_PROMPT,
  });
  ```

### Step 4: Local end-to-end test

- [ ] From `agent/`:

  ```bash
  npm run dev
  ```

- [ ] In the LangGraph Studio UI, send: `Generate the weekly brief for the week of {today's Monday}.`

  Expected: the agent uses `write_todos` to plan, calls `list_active_theses`, `list_recent_hypotheses`, etc., delegates to subagents, produces a structured output. Total wall time: 1-3 minutes. Total cost on Sonnet 4.6: roughly $0.30-$1.00 per run; confirm by inspecting the trace token counts.

- [ ] Inspect the LangSmith trace. Walk the planning tree. Expect 10-30 tool calls across the supervisor and subagents.

### Step 5: Iterate on prompts

This is the part that takes time. The first run will probably:

- Either over-call tools (40+ tool calls; not enough planning) or under-call (5 calls; not enough exploration).
- Sometimes produce a brief that does not match the schema (extra prose around the JSON).

- [ ] Add `prompts.ts` adjustments based on the first 3-5 runs. Common edits:
  - Add "Plan first, call tools second" if it skips planning.
  - Add "Cap tool calls at 30 total; if you cannot complete with 30, fall back to fewer experiment cards" if it spirals.
  - Add explicit JSON-only instruction if it adds preamble.

### Step 6: Test

- [ ] Create `agent/src/agents/weekly-brief/index.test.ts` with at least:
  - A test using a `FakeChatModel` that always returns a known structured output, asserting the agent passes it through unchanged.
  - A test that the agent rejects an output failing schema validation.

  Note: full integration testing of agent behavior against real models is not worth automating here; rely on the LangSmith dataset eval in Task 6.

### Step 7: Commit

- [ ] Commit:

  ```bash
  git add agent/src/agents/weekly-brief/
  git commit -m "feat(agent): weekly brief deep agent with research, contradiction-check, and stake-naming subagents"
  ```

---

## Task 4: Convex ↔ Agent Server Wiring

The agent server now produces briefs. The Convex backend needs to invoke it on schedule and persist the result.

### Step 1: HTTP client

- [ ] Create `convex/agentClient.ts`:

  ```typescript
  import { z } from "zod";

  const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL!;
  const AGENT_SERVER_API_KEY = process.env.AGENT_SERVER_API_KEY ?? "";

  export async function runWeeklyBriefAgent(input: {
    weekOf: string;
  }): Promise<unknown> {
    // Use the LangGraph SDK's runs endpoint:
    //   POST /threads/{thread_id}/runs/wait
    // For a stateless run, create thread on the fly via /runs/wait.
    const resp = await fetch(`${AGENT_SERVER_URL}/runs/wait`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AGENT_SERVER_API_KEY ? { "X-Api-Key": AGENT_SERVER_API_KEY } : {}),
      },
      body: JSON.stringify({
        assistant_id: "weekly-brief",
        input: {
          messages: [
            {
              role: "user",
              content: `Generate the weekly brief for the week of ${input.weekOf}.`,
            },
          ],
        },
      }),
    });
    if (!resp.ok) {
      throw new Error(`Agent server error: ${resp.status} ${await resp.text()}`);
    }
    return resp.json();
  }
  ```

  Reasons for the stateless `/runs/wait` path: the agent does not need conversation memory across weeks. Every weekly run starts fresh. If memory becomes useful later, switch to threaded runs.

### Step 2: New internal action in `convex/weeklyBriefs.ts`

- [ ] Add `generateInternalAgentic` alongside the existing `generateInternal`:

  ```typescript
  export const generateInternalAgentic = internalAction({
    args: { daysBack: v.optional(v.number()) },
    handler: async (ctx, args) => {
      const monday = new Date();
      monday.setDate(monday.getDate() - monday.getDay() + 1);
      const weekOf = monday.toISOString().split("T")[0];

      const result = await runWeeklyBriefAgent({ weekOf });

      // result.output should contain the structured brief from the schema.
      // The Deep Agent returns it inside the final message; parse defensively.
      const structured = extractStructuredOutput(result);
      const validated = briefOutputSchema.parse(structured);

      const briefId = await ctx.runMutation(internal.weeklyBriefs.create, {
        weekOf: validated.weekOf,
        model: "claude-sonnet-4-6@deepagent",
        promptVersion: "agentic-v1",
        bodyMd: validated.bodyMd,
        sourceIds: [], // populated by a follow-up pass that resolves recommended IDs
        recommendedHypothesisIds: validated.recommendedHypothesisIds as any,
        recommendedRecipeIds: validated.recommendedRecipeIds as any,
        activeThesisIds: validated.activeThesisIds as any,
        referencedFailureKeys: validated.referencedFailureKeys,
        studioPrompts: validated.studioPrompts,
        recommendedActions: validated.recommendedActions as any,
        todo: validated.todo,
      });
      return { briefId };
    },
  });

  function extractStructuredOutput(runResult: any): unknown {
    // Deep Agents typically put the final structured output in the last message.
    // Defensive extraction: walk the messages array for the latest JSON block.
    const messages = runResult?.messages ?? runResult?.output?.messages ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const content = typeof messages[i].content === "string" ? messages[i].content : "";
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          return JSON.parse(m[0]);
        } catch {
          continue;
        }
      }
    }
    throw new Error("No structured output in agent run");
  }
  ```

  Note the `sourceIds: []` shortcut: the agent emits hypothesis/recipe IDs but not source IDs explicitly. A small follow-up pass resolves them from the hypotheses table after creation. Add this as a TODO in the code with a link back to this plan.

### Step 3: Second weekly cron (do not replace the existing one)

- [ ] Modify `convex/crons.ts`:

  ```typescript
  // Existing static brief: Friday 16:00 UTC.
  crons.weekly(
    "generate-weekly-turn",
    { dayOfWeek: "friday", hourUTC: 16, minuteUTC: 0 },
    internal.weeklyBriefs.generateInternal,
    { daysBack: 7 },
  );

  // NEW: agentic brief, Friday 17:00 UTC (one hour later, so we can compare).
  // After the comparison period (see Task 6) ends, decide which to keep.
  crons.weekly(
    "generate-weekly-turn-agentic",
    { dayOfWeek: "friday", hourUTC: 17, minuteUTC: 0 },
    internal.weeklyBriefs.generateInternalAgentic,
    { daysBack: 7 },
  );
  ```

  Running both for ~3 weeks gives a real side-by-side comparison before we trust the agent enough to replace the static brief.

### Step 4: Visual differentiation in the app

- [ ] Modify `web/src/routes/weekly-brief-detail.tsx` to show a small badge derived from `promptVersion`:
  - `v2.phase3` → "Static brief"
  - `agentic-v1` → "Agentic brief"

  This is purely so the listening sessions / studio routine can tell which brief Keith is reading.

### Step 5: Commit

- [ ] Commit:

  ```bash
  git add convex/agentClient.ts convex/weeklyBriefs.ts convex/crons.ts web/src/routes/weekly-brief-detail.tsx
  git commit -m "feat(weeklybriefs): add agentic brief generator alongside the static brief"
  ```

---

## Task 5: Deploy the Agent Server

Local dev works. Now run it where the weekly cron can reach it.

### Step 1: Dockerfile

- [ ] Create `agent/Dockerfile`:

  ```dockerfile
  FROM node:20-slim
  WORKDIR /app
  COPY package.json package-lock.json* ./
  RUN npm ci --omit=dev
  COPY . .
  RUN npm run build
  EXPOSE 8123
  CMD ["npm", "run", "up"]
  ```

  Adjust port to match what `langgraph up` exposes.

### Step 2: Run alongside n8n

The project already self-hosts n8n at `zap.rproj.art`. The cleanest place to run the agent server is on the same host.

- [ ] Create `agent/docker-compose.yml`:

  ```yaml
  services:
    agent:
      build: .
      restart: unless-stopped
      env_file: .env
      ports:
        - "8123:8123"
      environment:
        # langgraph up reads these to configure persistence
        - POSTGRES_URI=postgres://...   # use a small Postgres for checkpointing
        - REDIS_URI=redis://...
  ```

- [ ] On the home server:

  ```bash
  scp -r agent/ keith@zap.rproj.art:/srv/resonant-agent/
  ssh keith@zap.rproj.art
  cd /srv/resonant-agent && docker compose up -d
  ```

- [ ] Expose via the same reverse proxy fronting n8n. Recommended path: `agent.rproj.art` or `zap.rproj.art/agent/`. Pick a stable hostname and lock it in. The exact reverse-proxy config depends on whichever Caddy/Traefik/nginx setup is already running n8n.

### Step 3: Set Convex env

- [ ] Set:

  ```bash
  bunx convex env set AGENT_SERVER_URL https://agent.rproj.art
  bunx convex env set AGENT_SERVER_API_KEY <some-key-if-the-server-requires-one>
  ```

  LangGraph self-hosted has no auth by default. Two options:
  - Put the agent server behind the same auth wall as n8n (reverse-proxy basic auth).
  - Add a custom middleware in the agent that requires a header. See LangGraph docs `langsmith/custom-middleware`.

### Step 4: Smoke test from Convex

- [ ] In the Convex dashboard, run `internal.weeklyBriefs.generateInternalAgentic` manually:

  ```bash
  bunx convex run weeklyBriefs:generateInternalAgentic '{}'
  ```

  Expected: returns `{ briefId: "..." }` within 3 minutes. Open the brief in the app; confirm content quality.

### Step 5: Commit

- [ ] Commit:

  ```bash
  git add agent/Dockerfile agent/docker-compose.yml
  git commit -m "infra(agent): docker setup for self-hosted agent server"
  ```

---

## Task 6: Three-Week Comparison

The whole point of this plan is to find out whether the agent is actually better.

### Step 1: Define the comparison rubric

- [ ] Document in `docs/decision-log.md` what "better" means before any comparisons happen. Recommended criteria:

  - **Useful new connections.** Does the agentic brief surface 1+ cross-source connection per week that the static brief misses?
  - **Failure-archive awareness.** Does the agentic brief reference contradictions more accurately than the static one? Track false positives too.
  - **Stake quality.** Are `whyThisMatters` strings substantively stronger? Score with the LangSmith `whyThisMattersEvaluator` from the LangSmith plan.
  - **Recipe quality.** Are recommended experiments more specific (parameter values, not just parameter types)?
  - **Cost.** What is each brief costing in tokens? The agentic version will be 5-10x more expensive per brief; this is acceptable only if the quality wins are real.
  - **Reliability.** Does the agent finish? How often does the schema validation fail?

### Step 2: Run for three weeks

Both crons fire weekly. No code changes needed during this period.

- [ ] Week 1 (passive observation): just read both briefs each Friday evening. Take rough notes.
- [ ] Week 2 (structured review): score each brief against the rubric. Add notes to a comparison sheet in Notion or a file in `docs/`.
- [ ] Week 3 (decisive review): if the agent is clearly winning, plan the cutover. If the static brief is winning, write up why and keep the static cron only.

### Step 3: Write the decision

- [ ] After week 3, add an entry to `docs/decision-log.md` titled "Weekly brief: agentic vs static" with the result and the data behind it.

- [ ] If agentic wins:
  - Disable the static cron.
  - Promote `agentic-v1` to the primary `promptVersion` for new briefs.
  - Plan Task 7 (expand to hypothesis generation).

- [ ] If static wins:
  - Disable the agentic cron.
  - Document what the agent missed.
  - Keep the agent server running for ad-hoc experiments; do not expand to hypothesis generation until you understand why it underperformed here.

---

## Task 7: Hypothesis Generation (Conditional)

Only proceed if Task 6 resolved in favor of the agent.

The hypothesis-generation path is analogous to the weekly brief but stateful: it runs per-extraction, not per-week, and writes back through a different mutation. Keep this section short — the prep is the same as Task 3 with different prompts and a different schema.

- [ ] Create `agent/src/agents/hypothesis/` mirroring `weekly-brief/`.
- [ ] Subagents: `research` (existing pattern), `parameter-grounding` (pulls in tuning files from a future Convex tool that exposes Scala data), `stake-naming`.
- [ ] Add `generateFromExtractionAgentic` in `convex/hypotheses.ts` that calls `runHypothesisAgent`.
- [ ] Wire into `workflows.batchHypothesisWorkflow` as an opt-in mode: pass `mode: "agentic" | "static"` and route accordingly.
- [ ] Run side-by-side for 2 weeks against the same extractions; score with the LangSmith hypothesis evaluators.

---

## Task 8: Audio Verification Sandbox (Conditional, Stretch)

This is the speculative high-upside piece. Worth attempting only after Tasks 6 and 7 are settled.

Use a Deep Agents sandbox backend (Modal, Daytona, or Deno) to give the agent shell access. Add a tool `verify_recipe_parameters` that:

1. Generates short Python (with `numpy`, `librosa`, `scipy`) or SuperCollider code from the recipe's parameters.
2. Synthesizes a 5-10 second audio clip.
3. Computes FFT, identifies dominant frequencies, checks they match the recipe's claimed tuning.
4. Returns a structured report: did the parameters produce what they claimed?

If this works, recipes that fail verification get a `verificationFailed` flag in Convex and surface in the failure archive automatically. The agent learns to avoid ungrounded parameter combinations.

This is genuinely novel work. Treat the whole thing as a research project with its own plan once Task 7 succeeds.

---

## Definition of Done (initial scope)

- [ ] `agent/` workspace exists, runs locally via `npm run dev`, traces appear in LangSmith.
- [ ] Convex `agentTools` are wrapped as LangChain tools; web search tool is integrated.
- [ ] The weekly-brief deep agent has supervisor + 3 subagents and produces schema-valid briefs.
- [ ] `convex/agentClient.ts` and `generateInternalAgentic` are live.
- [ ] Both crons run for three weeks.
- [ ] A decision-log entry resolves the comparison.

---

## Notes for Reviewers

- The `agent/` workspace is intentionally Node-based and separate from the Convex codebase. Do not try to run LangGraph inside Convex actions; the SDK is not designed for it and the timeouts will not cooperate.
- The static brief stays until the comparison decisively resolves. Removing it prematurely loses our control case.
- Subagents share the same toolset by default in the current design. If a subagent abuses tools (e.g. the stake-naming agent calling web search), tighten its toolset rather than its prompt.
- The agent emits IDs the supervisor read from `list_recent_hypotheses` etc. Validate they exist before the Convex mutation accepts them; hallucinated IDs should fail loudly, not silently corrupt the brief.
- Cost matters. Sonnet 4.6 with 30 tool calls per run lands in the $0.30-$1.50 range per brief. Weekly is fine; daily would not be. If you ever want a daily brief, switch the supervisor model to Haiku 4.5 with Sonnet only on the synthesis step.
- Self-hosting the agent server on the same box as n8n is reasonable while the load is one run per week. If load grows (per-extraction hypothesis runs, on-demand briefs), revisit. LangGraph's Postgres checkpointing handles concurrency but the box's RAM and CPU don't.
