# Plan 006: Make CLAUDE.md canonical, fix the LLM-stack contradiction with AGENTS.md, and turn README into a real onboarding hub

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a30f10c..HEAD -- CLAUDE.md AGENTS.md README.md`
> If any in-scope file changed since this plan was written (plan 001 legitimately
> edits CLAUDE.md lines 150–165 — that specific drift is expected and fine),
> compare the "Current state" excerpts against the live files before proceeding;
> on any other mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (docs only)
- **Depends on**: plans/001-rotate-and-decommit-secrets.md (both edit CLAUDE.md; run 001 first to avoid conflicts)
- **Category**: docs
- **Planned at**: commit `a30f10c`, 2026-07-07

## Why this matters

`CLAUDE.md` and `AGENTS.md` are ~290-line near-duplicates that have already
drifted into **contradicting each other about which LLM the extraction
pipeline uses**: `CLAUDE.md:17` says "multi-model: Claude, Groq, Gemini,
GPT-4"; `AGENTS.md:17` says "Codex, Groq, Gemini, GPT-4". Ground truth
(`convex/extract.ts`): the Convex extractor calls OpenRouter/Groq with
`DEFAULT_MODEL = "anthropic/claude-sonnet-4-6"`; Codex exists only in the
separate `agent/` workspace (`agent/src/models/codexSdk.ts`). An agent
onboarding from AGENTS.md gets a false model of the system. Meanwhile
`README.md`'s "Local development" covers only the web app — no backend, agent,
or worker bring-up — and `CLAUDE.md` self-flags stale content ("Current Feeds
(18, 6 dead)" with a TODO). Duplicated onboarding docs guarantee repeat drift;
this plan makes one file canonical and the other a thin delta.

## Current state

- `CLAUDE.md` (292 lines) and `AGENTS.md` (~same) share: project overview,
  directory tree, key scripts, convex commands, auth section, env vars, data
  pipeline, models table, feeds list, research domains, Scala format, bun
  defaults, writing guidelines. Verified divergences:
  - `:17` — "Claude" (CLAUDE.md) vs "Codex" (AGENTS.md) in the LLM stack line.
  - `:190` — model id `claude-sonnet-4-6` (CLAUDE.md) vs `claude-sonnet-4.6`
    (AGENTS.md). Ground truth in `convex/extract.ts` MODELS:
    `default: "anthropic/claude-sonnet-4-6"` (hyphen).
  - `AGENTS.md:154` uses the `<AUTH_BYPASS_SECRET>` placeholder (correct);
    CLAUDE.md had the literal until plan 001.
- `CLAUDE.md:199-216` — feeds section listing 18 feeds, 6 struck-through dead,
  ending `> **TODO:** Remove 6 dead feeds, find replacements`. Live feed truth
  is in the `feeds` table (`bunx convex run feeds:list`), not the doc.
- `README.md` — "Local development" (~line 50-80) covers root + web install
  and `VITE_*` env only; "Verification commands" lists `bun run test`,
  `bun run build:web`, `bun run typecheck:web`. No mention of: `agent/` setup
  (`agent/README.md` exists), the worker (`agent/docker-compose.yml`,
  `docs/proxmox-agent-deployment.md`), Convex env
  (`.env.example`), or the agent-tool surface (`docs/agent-tool-surface.md`).
- Design/vocabulary constraint (`CONTEXT.md` is the canonical glossary):
  docs should use its terms — Source, Source Intake, Extraction, Generator,
  Agent Draft, Draft Promotion, Agent-Tool Surface.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Ground-truth model table | `grep -A8 "MODELS" convex/extract.ts \| head -12` | model ids to copy verbatim |
| Ground-truth feeds | `bunx convex run feeds:list` (needs `.env.local`) | JSON feed list; skip if no env (see Step 3) |
| Markdown sanity | `bunx biome format CLAUDE.md AGENTS.md README.md` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `CLAUDE.md`
- `AGENTS.md`
- `README.md`

**Out of scope** (do NOT touch):
- `CONTEXT.md` — already canonical and current.
- `docs/**`, `planning/**` — historical/strategic docs; linking to them is in
  scope, editing them is not.
- `agent/README.md`, `.env.example` — link targets, not edit targets.
- Removing dead feeds from the DATABASE — operator action; the doc just stops
  pretending to be the feed registry.

## Git workflow

- Branch: `advisor/006-docs-canonicalization`
- Conventional commits, e.g. `docs: make CLAUDE.md canonical, fix LLM-stack drift`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the factual contradictions in CLAUDE.md

- Line 17 stack line → describe reality:
  `**LLM:** Convex pipeline: OpenRouter + AI SDK (Claude Sonnet default, Groq/Gemini/DeepSeek variants — see convex/extract.ts MODELS). Agent workspace: LangGraph with Codex SDK + Anthropic (see agent/).`
- Models section (~:185-197): copy the MODELS object VERBATIM from
  `convex/extract.ts` (it is the source of truth; say so in a note:
  `> Source of truth: convex/extract.ts — update this table when that changes.`).
  Keep the "Never use Llama models" policy note.

**Verify**: `grep -n "claude-sonnet" CLAUDE.md` → ids match
`grep "anthropic/" convex/extract.ts` exactly (hyphen form).

### Step 2: Collapse AGENTS.md into a thin delta

Replace AGENTS.md's duplicated content with:
1. A header: `# Agent instructions` + one line: canonical project reference is
   `CLAUDE.md` (link) + `CONTEXT.md` for vocabulary — read those first.
2. KEEP any content that is genuinely AGENTS.md-specific (diff the two files
   first: `diff CLAUDE.md AGENTS.md` — sections present only in AGENTS.md, or
   agent-specific guidance like the `<AUTH_BYPASS_SECRET>` command examples,
   survive; duplicated sections go).
If the diff shows AGENTS.md has drifted-but-duplicated sections only, the
final AGENTS.md may be ~30 lines. That is the goal, not a problem.

**Verify**: `grep -n "Codex, Groq" AGENTS.md` → no output.
**Verify**: `wc -l AGENTS.md` → materially smaller than before (record before/after in report).

### Step 3: Fix the self-flagged stale feeds section in CLAUDE.md

Replace the hardcoded feed list (`:199-216`) with:
- One line: feeds live in the `feeds` table — inspect with
  `bunx convex run feeds:list`.
- Keep the domain groupings (Research/YouTube/Production) as one summary
  sentence, not a row-per-feed list.
- If you have a working `.env.local` and `bunx convex run feeds:list`
  succeeds, note the current live count. If you don't, write the section
  without counts — do NOT copy the stale 18/6 numbers forward.

**Verify**: `grep -n "HTTP 500\|HTTP 404\|HTTP 410" CLAUDE.md` → no output.

### Step 4: Turn README's "Local development" into an onboarding hub

Extend (don't rewrite the whole README) so a new contributor can find every
subsystem. Structure:

```md
## Local development

### Web app
(existing content, keep)

### Convex backend
- Self-hosted; env in `.env.example` → `.env.local` (Bun auto-loads it).
- CAUTION: `bunx convex dev|codegen|deploy` talk to the LIVE backend.
- CLI mutation auth: see "Authentication" in CLAUDE.md.

### Agent workspace & worker
- `agent/README.md` for setup; `agent/docker-compose.yml` + `docs/proxmox-agent-deployment.md` for the production worker.
- Agent-tool HTTP surface: `docs/agent-tool-surface.md`.

### Verification
- `bun test convex/*.test.ts` · `bun run typecheck:web` · `cd agent && bun run verify && bun test`
- (plus `bun run lint:check` / `format:check` / `typecheck` if plan 003 has landed — check package.json)
```

List env var NAMES only — never values (reference `.env.example`).

**Verify**: `grep -n "agent-tool-surface\|proxmox-agent-deployment\|agent/README" README.md` → ≥3 hits.

### Step 5: Format pass

**Verify**: `bunx biome format CLAUDE.md AGENTS.md README.md` → exit 0 (run
`bunx biome format --write` on just these three files first if needed).
**Verify**: `git status --short` → only the three in-scope files.

## Test plan

Docs have no test suite; the gates are the greps above plus one human check:
in your report, paste the final `:17` stack lines of both files and the
README's new section headers so the reviewer can confirm the contradiction is
gone without opening the diff.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "Codex, Groq" CLAUDE.md AGENTS.md` → 0 in both
- [ ] Model ids in CLAUDE.md match `convex/extract.ts` (`claude-sonnet-4-6` hyphen form)
- [ ] `grep -n "TODO:.*dead feeds" CLAUDE.md` → no output
- [ ] AGENTS.md line count reduced; it names CLAUDE.md as canonical
- [ ] README links to `agent/README.md`, `docs/proxmox-agent-deployment.md`, `docs/agent-tool-surface.md`
- [ ] No secret values in any diff (`git diff | grep -i "secret\s*=" ` shows only placeholders)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

1. `diff CLAUDE.md AGENTS.md` reveals AGENTS.md sections with SUBSTANTIVE
   unique content beyond ~20 lines that you cannot cleanly classify as
   agent-specific — the collapse strategy then needs the operator's judgment
   on what survives where.
2. `convex/extract.ts` MODELS no longer matches the Current state description
   (the LLM-module plan `docs/plans/2026-07-03-03` may have moved it to
   `convex/llm.ts`) — update the source-of-truth pointer to the new location
   instead, and note the drift.
3. Plan 001 has NOT run and CLAUDE.md still contains a literal secret at
   ~:154-157 — do not work around it; run order is 001 → 006.

## Maintenance notes

- The drift engine was duplication. After this plan, the rule is: project facts
  live in CLAUDE.md once; AGENTS.md carries only agent-specific deltas. A
  reviewer seeing a PR that adds the same section to both files should reject it.
- The models table will still drift from `convex/extract.ts` eventually; the
  inline source-of-truth note is the cheap mitigation. A stronger one (a test
  asserting doc/code agreement) was judged not worth the coupling.
- Feed inventory now has exactly one home (the `feeds` table). The dead-feed
  cleanup itself (6 dead feeds noted in the old doc) is an operator/data task —
  suggest `bunx convex run feeds:list` and disabling the HTTP-4xx/5xx ones; out
  of scope here.
