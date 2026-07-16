# LangChain Integration: Prep Work

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the prerequisites that both the LangSmith observability plan and the LangGraph Deep Agents plan share: accounts, env vars, an outbound HTTP tool surface for Convex, a baseline evaluation dataset, and a small structural cleanup so the two integrations can land without touching the same files repeatedly.

**Why this exists separately:** LangSmith and LangGraph are independent enough to ship on their own timelines, but both need the same foundation. Doing this prep once avoids two passes through the same code.

**Tech Stack:** Bun, Convex (self-hosted, managed by Cool Guy), AI SDK + OpenRouter, Clerk auth.

**Sibling plans:**

- `docs/superpowers/plans/2026-05-14-langsmith-integration.md` — observability and evaluation
- `docs/superpowers/plans/2026-05-14-langgraph-deep-agents-integration.md` — agent runtime for the weekly brief

---

## Decisions to lock before starting

These are not implementation tasks. They are choices that change which later tasks apply. Resolve them before Task 1.

- [ ] **LangSmith hosting**: LangSmith Cloud (US or EU region) vs self-hosted. Cloud is the default. Self-hosted is only justified if the project's data residency posture changes. Decision goes in `docs/decision-log.md`.
- [ ] **Agent Server hosting** (affects the LangGraph plan): LangSmith Cloud deployment vs self-hosted alongside the existing n8n at `zap.rproj.art`. The home-server option matches the existing operating posture and is the default recommendation. Decision goes in `docs/decision-log.md`.
- [ ] **API budget envelope**: Set a monthly LLM spend cap for traced calls and define what happens when traces fail (drop silently vs surface to logs vs fail the action). Default: drop silently with `console.warn`, never fail the user-facing action because tracing is down.

---

## File Structure

### frequency-music repo

| Action | Path                                          | Responsibility                                                       |
| ------ | --------------------------------------------- | -------------------------------------------------------------------- |
| Create | `convex/agentTools.ts`                        | Read-only Convex actions intended for external agent consumption     |
| Create | `convex/agentToolsHttp.ts`                    | HTTP-routed wrappers around the agent-tools actions, secret-guarded  |
| Modify | `convex/http.ts`                              | Register the new `/agent-tools/*` routes                             |
| Modify | `convex/auth.ts`                              | Add `requireAgentToolSecret` helper analogous to existing dev bypass |
| Create | `docs/agent-tool-surface.md`                  | Living catalog of which Convex queries are agent-callable and why    |
| Create | `data/eval/extractions-golden.jsonl`          | Golden extractions (hand-curated, 20 rows)                           |
| Create | `data/eval/hypotheses-golden.jsonl`           | Golden hypotheses with strong `whyThisMatters` (15 rows)             |
| Create | `data/eval/weekly-briefs-golden.jsonl`        | Golden weekly briefs (3 rows minimum)                                |
| Create | `scripts/export-eval-datasets.ts`             | Bun script that pulls candidates from Convex into JSONL              |
| Modify | `.env.example`                                | Add new env var names with empty values                              |
| Modify | `CLAUDE.md`                                   | Document the new agent-tools surface                                 |
| Modify | `docs/decision-log.md`                        | Record hosting and budget decisions                                  |

### Convex deployment

| Action | Setting                       | Value                                       |
| ------ | ----------------------------- | ------------------------------------------- |
| Add    | `AGENT_TOOL_SECRET`           | Random 32-byte hex string                   |
| Add    | `LANGSMITH_API_KEY`           | From LangSmith account                      |
| Add    | `LANGSMITH_PROJECT`           | `resonant-projects-prod`                    |
| Add    | `LANGSMITH_TRACING`           | `true`                                      |
| Add    | `LANGSMITH_ENDPOINT`          | `https://api.smith.langchain.com` (default) |
| Add    | `AGENT_SERVER_URL` (later)    | Set once LangGraph plan starts              |
| Add    | `AGENT_SERVER_API_KEY` (later)| Set once LangGraph plan starts              |

---

## Task 1: Outbound Agent Tool Surface (Convex side)

The existing HTTP endpoints in `convex/http.ts` are **inbound** ingest endpoints (n8n → Convex). They write data. Deep Agents need **outbound** read endpoints: agent → Convex to fetch sources, extractions, theses, failure archive, and editorial signals.

We expose these as Convex actions (so they can be invoked from inside the app too) and route them over HTTP for the agent runtime.

### Step 1: Define the agent-tool surface

The agent needs strictly less than the full Convex API. Pick the minimum useful set first; expand only when an agent run demonstrably needs more.

- [ ] Create `docs/agent-tool-surface.md` that lists the read tools agents will get. Initial set:

  | Tool name                     | Backed by                                          | Returns                                           |
  | ----------------------------- | -------------------------------------------------- | ------------------------------------------------- |
  | `listRecentExtractions`       | `extractions.listRecent`                           | Last N extractions with claims and parameters     |
  | `getExtraction`               | `extractions.get`                                  | One extraction by id                              |
  | `listRecentHypotheses`        | new query in `hypotheses.ts`                       | Last N hypotheses with `whyThisMatters`           |
  | `listActiveTheses`            | `theses.listByStatus("active")`                    | Active theses                                     |
  | `listFailureArchive`          | `failures.listRecent`                              | Recent derived failures                           |
  | `getEditorialSignals`         | `graph.computeEditorialSignals`                    | High-yield / low-yield concept clusters           |
  | `getRecentRecipes`            | `recipes.listRecent`                               | Recipes with parameters                           |
  | `getRecommendedActions`       | `weeklyBriefs.computeRecommendedActionContext`     | Deterministic action candidates                   |
  | `searchSourcesByConcept`      | new query                                          | Sources tagged with a concept name                |

  No write tools in this phase. Write tools (`createHypothesisDraft`, `markFailure`) come later in the LangGraph plan once human-in-the-loop is wired.

### Step 2: Create `convex/agentTools.ts`

- [ ] Create `convex/agentTools.ts` that wraps each query/action with a uniform `action` shape:

  ```typescript
  // convex/agentTools.ts
  import { v } from "convex/values";
  import { action } from "./_generated/server";
  import { api } from "./_generated/api";
  import { requireAgentToolSecret } from "./auth";

  export const listRecentExtractions = action({
    args: {
      agentSecret: v.string(),
      limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
      requireAgentToolSecret(args.agentSecret);
      return await ctx.runQuery(api.extractions.listRecent, { limit: args.limit ?? 20 });
    },
  });

  // ... one action per tool from the table above
  ```

  Reasons for `action` and not `query` directly:

  - Lets us call other queries/actions internally without exposing the full Convex API.
  - Gives a single place to enforce the agent secret.
  - Lets us add tracing or rate limiting later without touching the underlying queries.

### Step 3: Add the secret guard

- [ ] In `convex/auth.ts`, add:

  ```typescript
  export function requireAgentToolSecret(provided: string): void {
    const expected = process.env.AGENT_TOOL_SECRET;
    if (!expected || provided !== expected) {
      throw new Error("Invalid agent tool secret");
    }
  }
  ```

  Mirrors the n8n ingest secret pattern already in `convex/http.ts`.

### Step 4: HTTP routes for the agent tools

- [ ] Create `convex/agentToolsHttp.ts`:

  ```typescript
  import { httpAction } from "./_generated/server";
  import { api } from "./_generated/api";

  export const listRecentExtractionsHttp = httpAction(async (ctx, request) => {
    const body = await request.json();
    if (body.secret !== process.env.AGENT_TOOL_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }
    const result = await ctx.runAction(api.agentTools.listRecentExtractions, {
      agentSecret: body.secret,
      limit: body.limit,
    });
    return Response.json(result);
  });
  // ... one per tool
  ```

- [ ] Modify `convex/http.ts` to register routes under `/agent-tools/*`:

  ```typescript
  http.route({ path: "/agent-tools/listRecentExtractions", method: "POST", handler: listRecentExtractionsHttp });
  // ... etc.
  ```

### Step 5: Write a contract test for each tool

- [ ] Create `convex/agentTools.test.ts` using the `makeDb` helper already in `convex/testHelpers.ts`. For each tool, assert:

  - Rejects requests without the secret.
  - Returns an array of the expected shape for the happy path.
  - Does not leak fields marked private (e.g. `rawText` should be excluded from `searchSourcesByConcept` results because raw text dumps blow up the agent context window).

- [ ] Run:

  ```bash
  bun test convex/agentTools.test.ts
  ```

  Expected: all pass.

### Step 6: Commit

- [ ] Commit:

  ```bash
  git add convex/agentTools.ts convex/agentToolsHttp.ts convex/http.ts convex/auth.ts convex/agentTools.test.ts docs/agent-tool-surface.md
  git commit -m "feat(agent-tools): expose read-only Convex surface for external agents"
  ```

---

## Task 2: Baseline Evaluation Datasets

Both LangSmith experiments and any future LangGraph A/B comparison need a small, hand-curated set of "good" outputs. We build this from existing Convex data the project already has.

### Step 1: Decide what "good" means for each artifact

These criteria go into `docs/agent-tool-surface.md` next to each dataset.

- **Good extraction**: at least 3 claims, evidence levels not all `speculative`, at least 1 composition parameter, no obvious hallucination on re-read.
- **Good hypothesis**: non-empty `whyThisMatters` that names a musical stake, traceable to source claims, not in the failure archive.
- **Good weekly brief**: contains 3+ experiment cards, references at least one active thesis, names at least one contradiction or low-yield path.

### Step 2: Export candidates from Convex

- [ ] Create `scripts/export-eval-datasets.ts`:

  ```typescript
  #!/usr/bin/env bun
  /**
   * Pull candidates for golden datasets from Convex into JSONL files.
   * Manual curation step happens after — review the output and trim.
   */
  import { ConvexHttpClient } from "convex/browser";
  import { writeFile } from "node:fs/promises";

  const client = new ConvexHttpClient(process.env.CONVEX_URL!);

  // Extractions: pick ones with >= 3 claims and >= 1 parameter
  const extractions = await client.action("agentTools:listRecentExtractions" as any, {
    agentSecret: process.env.AGENT_TOOL_SECRET,
    limit: 100,
  });
  const goodExtractions = extractions.filter(
    (e: any) => e.claims.length >= 3 && e.compositionParameters.length >= 1,
  );
  await writeFile(
    "data/eval/extractions-candidates.jsonl",
    goodExtractions.map((e: any) => JSON.stringify(e)).join("\n"),
  );

  // Same shape for hypotheses, weekly briefs.
  ```

- [ ] Run:

  ```bash
  bun scripts/export-eval-datasets.ts
  ```

  Expected: three `*-candidates.jsonl` files in `data/eval/`.

### Step 3: Hand-curate the golden set

This is a manual review step.

- [ ] Open each `*-candidates.jsonl` file in an editor.
- [ ] For each row, keep, edit, or discard. Target counts: 20 extractions, 15 hypotheses, 3 weekly briefs.
- [ ] Rename to `*-golden.jsonl` once curated.
- [ ] Commit only the golden files, not the candidates:

  ```bash
  git add data/eval/*-golden.jsonl scripts/export-eval-datasets.ts
  git commit -m "data: add golden evaluation datasets for extractions, hypotheses, briefs"
  ```

  Note: golden files contain real source content. Confirm visibility rules — these should probably stay in the private repo and never end up in `exports/` or the Astro site.

---

## Task 3: Environment Variables and Secrets

Both downstream plans assume these are set. Get them in place before either plan starts.

### Step 1: Create a LangSmith account

- [ ] Sign up at https://smith.langchain.com.
- [ ] Create a workspace named `resonant-projects`.
- [ ] Create an API key. Label it `convex-prod`.
- [ ] Create a project named `resonant-projects-prod` for production traces.
- [ ] Create a project named `resonant-projects-dev` for local development traces.

### Step 2: Generate the agent-tool secret

- [ ] Generate a strong secret:

  ```bash
  bun -e "console.log(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex'))"
  ```

- [ ] Save the output. This becomes `AGENT_TOOL_SECRET`.

### Step 3: Set Convex environment variables

- [ ] Set vars in the self-hosted Convex deployment (coordinate with Cool Guy):

  ```bash
  bunx convex env set LANGSMITH_API_KEY <key>
  bunx convex env set LANGSMITH_PROJECT resonant-projects-prod
  bunx convex env set LANGSMITH_TRACING true
  bunx convex env set AGENT_TOOL_SECRET <hex>
  ```

  Note: do not set `AGENT_SERVER_URL` or `AGENT_SERVER_API_KEY` yet — those come with the LangGraph plan.

### Step 4: Update `.env.example`

- [ ] Modify `.env.example` to include the new keys with empty values and inline comments pointing at this document.

### Step 5: Document in CLAUDE.md

- [ ] Modify `CLAUDE.md` to add a short section under "Project Overview" describing the agent-tool surface and which env vars enable tracing. One paragraph, link to `docs/agent-tool-surface.md`.

### Step 6: Commit

- [ ] Commit (secrets stay out of git):

  ```bash
  git add .env.example CLAUDE.md
  git commit -m "docs: document agent-tools env vars and tracing setup"
  ```

---

## Task 4: Verify the Foundation

Smoke-test that all the pieces work before declaring prep done.

### Step 1: Verify the agent-tool surface is reachable

- [ ] From a separate shell:

  ```bash
  curl -X POST $CONVEX_SITE_URL/agent-tools/listRecentExtractions \
    -H "Content-Type: application/json" \
    -d "{\"secret\": \"$AGENT_TOOL_SECRET\", \"limit\": 3}"
  ```

  Expected: JSON array with up to 3 extractions. Confirm the response does not include `rawText` blobs that would blow up an agent context window.

### Step 2: Verify the wrong-secret path

- [ ] Same request with a bogus secret:

  ```bash
  curl -X POST $CONVEX_SITE_URL/agent-tools/listRecentExtractions \
    -H "Content-Type: application/json" \
    -d '{"secret": "wrong", "limit": 3}'
  ```

  Expected: 403.

### Step 3: Verify env vars are present in deployed actions

- [ ] Add a temporary debug action that reads the env (delete after verifying):

  ```typescript
  export const debugEnv = action({
    args: { devBypassSecret: v.optional(v.string()) },
    handler: async (_ctx, args) => {
      await requireAuth(_ctx, args);
      return {
        hasLangsmithKey: !!process.env.LANGSMITH_API_KEY,
        langsmithProject: process.env.LANGSMITH_PROJECT,
        hasAgentSecret: !!process.env.AGENT_TOOL_SECRET,
      };
    },
  });
  ```

- [ ] Run via the Convex dashboard or CLI, confirm all three are `true`/set.
- [ ] Remove the debug action and commit the removal.

---

## Definition of Done

- [ ] `convex/agentTools.ts` exposes 8+ read-only tools, secret-guarded, tested.
- [ ] HTTP routes at `/agent-tools/*` work from outside Convex with the correct secret.
- [ ] `data/eval/*-golden.jsonl` exists with curated samples.
- [ ] All four env vars (`LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, `LANGSMITH_TRACING`, `AGENT_TOOL_SECRET`) are set in the deployed Convex environment.
- [ ] Decisions on hosting and budget are written into `docs/decision-log.md`.
- [ ] `docs/agent-tool-surface.md` is the canonical doc for which tools agents can call.

Once this plan is done, the LangSmith plan and the LangGraph plan can proceed in either order or in parallel.

---

## Notes for Reviewers

- The agent-tool secret is single-string for now. If the project ever exposes these tools to multiple distinct agent identities, swap to scoped tokens. Not worth the complexity at one agent.
- We do not add write tools in prep on purpose. Writes need approval flows. Adding them here would tempt the next plan to skip the human-in-the-loop step.
- We do not install LangSmith or LangChain packages in this plan. Each downstream plan installs only what it needs.
- The 100-row export limit in `scripts/export-eval-datasets.ts` is intentional: golden datasets should stay small enough to inspect by hand. If the project grows past that, switch the script to sample by stratified random selection rather than raising the limit.
