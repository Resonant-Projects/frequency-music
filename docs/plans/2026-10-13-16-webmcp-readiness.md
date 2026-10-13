# WebMCP Readiness — Deferred Plan

> **Status: DEFERRED (2026-10-13).** Do not start until a start trigger below
> fires. This plan records the research so the work can begin without
> repeating it. Re-verify the "Status snapshot" against Chrome's docs before
> executing; the API has already changed shape once.

## Why

WebMCP lets a page register structured tools with the browser so an in-browser
AI agent can call `navigate_to("/hypotheses")` or `search_site("tritone")`
instead of navigating by screenshots and clicks. For Frequency this would make
the web app legible to browser agents acting in Keith's signed-in session.

It complements, and does not replace, the server-side `/agent-tools/*`
surface ([agent-tool-surface.md](../agent-tool-surface.md)): that serves
headless agents with `AGENT_TOOL_SECRET`; WebMCP serves agents inside a browser
tab and inherits the user's Clerk session, so it needs no new credential.

## Why deferred

On 2026-10-13 WebMCP was a proposed standard in a Chrome origin trial, with no
stable release and no Firefox or Safari commitment. Shipping now would mean
renewing per-origin trial tokens and tracking a moving API for an audience of
test extensions. Keith chose to keep the research and wait.

## Start triggers (any one)

1. WebMCP ships enabled by default in stable Chrome or Edge (check
   [Chrome Platform Status](https://chromestatus.com/) for "WebMCP").
2. An agent Keith actually uses (Claude in Chrome, Gemini in Chrome, or
   similar) consumes WebMCP tools on ordinary sites.
3. Keith wants browser agents to drive Frequency badly enough to accept
   origin-trial maintenance.

## Status snapshot (2026-10-13)

Sources: Chrome for Developers [WebMCP](https://developer.chrome.com/docs/ai/webmcp)
(updated 2026-10-07), [Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api),
[Declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api),
[Tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools).

- **Availability:** origin trial from Chrome 149. Third-party reports put the
  trial end at Chrome 156, around 2026-11-16/17; Chrome's page states no end
  date. Without a token the API is absent in ordinary Chrome.
- **Local testing:** `chrome://flags/#enable-webmcp-testing`; inspect tools with
  the Model Context Tool Inspector extension.
- **Object:** `document.modelContext`. Older guides use `navigator.modelContext`,
  which third-party reports say Chrome 150 deprecated. Detect both.
- **Imperative API:** `registerTool(tool, { signal, exposedTo })`. A tool has
  `name`, `description`, `inputSchema` (JSON Schema), `execute(args, { signal })`
  returning a string, and optional `annotations`: `readOnlyHint`,
  `untrustedContentHint`, `consequentialHint`, `debugging` (Chrome 156+).
  Aborting the signal unregisters. `document.modelContext` fires `toolchange`.
  JSON-stringified `executeTool` arguments are deprecated from Chrome 155.
- **Declarative API:** form attributes `toolname`, `tooldescription`,
  `toolautosubmit`; field attribute `toolparamdescription`. Submission exposes
  `SubmitEvent.agentInvoked` and `SubmitEvent.respondWith(promise)` (call
  `preventDefault()` first). `toolactivated` and `toolcancel` fire on
  `document.modelContext`.
- **Permissions:** gated by the `tools` Permissions Policy (default `self`);
  cross-origin iframes need `allow="tools"`. Tools are invisible to other
  origins unless listed in `exposedTo`.

## Design

Progressive enhancement: when the API is absent, nothing registers and nothing
changes.

### Module

`web/src/lib/webmcp.ts` owns feature detection and a `registerTools(tools,
signal)` helper. It types the small API surface locally rather than depending on
an unstable `@types` package. A Solid helper registers tools for a component's
lifetime and aborts on cleanup.

### Site-wide tools (registered once in `web/src/router.tsx`, while signed in)

| Tool | Source | Annotation |
|------|--------|------------|
| `list_pages` | `navigationGroups` in `web/src/lib/app-navigation.ts` (route, label, description) | read-only |
| `navigate_to(path)` | TanStack router; accepts only paths in `appLinks` or known detail routes | read-only |
| `search_site(query)` | Same Convex queries as the search palette (`api.graph.searchConcepts`, `api.dashboard.pipelineItems`, `api.compositions.list`; see `web/src/components/site-search-results.tsx`). Extract a shared search function rather than duplicating the palette's logic | read-only, untrusted content |
| `get_current_page` | Current route plus a short text summary | read-only |

### Page tools (registered while the route is mounted)

Start read-only: `list_hypotheses`, `open_hypothesis(id)`, `list_docket_items`,
`list_review_queue`. Add write tools only after the read set proves useful.

### Doctrine constraints

- Never expose irreversible hypothesis or recipe publication, signed docket
  decisions, or anything AGENTS.md reserves for human approval. A browser agent
  acts with Keith's session, so the tool list *is* the permission boundary.
- Any write tool carries `consequentialHint: true`.
- Tool output built from Sources, Claims, essays, or other ingested text carries
  `untrustedContentHint: true`: it is third-party content and a prompt-injection
  vector.
- No `exposedTo` entries; tools stay same-origin.

### Origin-trial token (only if starting before stable)

Register the production origin, then add
`<meta http-equiv="origin-trial" content="…">` to `web/index.html`, or send the
`Origin-Trial` header from `web/vercel.json`. Tokens are public by design but
expire; record the expiry next to the token.

## Tasks

1. Re-verify the status snapshot; update this plan if the API moved.
2. `web/src/lib/webmcp.ts` + unit test with a fake `modelContext` (registration,
   abort-unregister, absent-API no-op).
3. Extract the palette's search into a shared function; wire the four site-wide
   tools.
4. Page tools for the read-only set above.
5. Optional: declarative attributes on the ingest URL form
   (`web/src/routes/ingest.tsx`), answering through `respondWith`.
6. Playwright check in real Chrome with WebMCP testing enabled (look up the
   command-line equivalent of `#enable-webmcp-testing` when executing),
   asserting `getTools()` lists the tools. Mocked tests alone have passed while
   real Chrome registered nothing (see
   [ModelPiper](https://modelpiper.com/blog/webmcp-chrome-api-migration-mocked-tests)).
7. Document the tool list in `docs/agent-tool-surface.md` beside the server
   tools.

## Non-goals

- A remote MCP server for the web app (headless agents already have
  `/agent-tools/*` and the Wave 2 MCP service).
- Polyfills or third-party WebMCP bridges.
- Write tools in the first pass.

## Cheap adjacent step (independent of WebMCP)

A static `web/public/llms.txt` describing routes and purpose helps fetch-only
agents today. Most routes sit behind sign-in, so its value is limited; do it
only if a fetch-only agent needs it.
