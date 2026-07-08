# SDD Progress Ledger — master-sequence remainder wave

Plan: docs/plans/2026-07-01-00-master-sequence.md (plans 01–05 mostly merged via PR #17 / 74c2ddc; this wave executes the remaining code tasks)
Worktree: /Users/kelliott/code/frequency-music/.claude/worktrees/master-sequence-remainder
Branch: worktree-master-sequence-remainder (base 9eb99d7 = main)
Baseline: convex+scripts `bun test convex scripts` 116 pass; `cd agent && bunx tsc --noEmit && bun test` 61 pass. Root `bun test` shows 6 pre-existing web/ Playwright spec errors — out of scope, ignore.
Do NOT push or merge; Keith reviews the branch diff at the end.

## Tasks
- Task 1: plan-01 TODOs in agent/src/graphs/research-pipeline/nodes.ts (T3 per-model-call audit events @419, T5 CODEX_SPECIALIST wiring @372)
- Task 2: plan-05 T1 remainder — edit-capture hooks for extractions + weekly briefs
- Task 3: plan-05 T5 — weekly self-improvement "what the system learned" brief section
- Task 4: final whole-branch review

## Skipped (gated/blocked, do not implement)
- Plan 05 T3 memory store + T6 verification sandbox: gated on G3 (Proxmox 2-week soak — Keith)
- Plan 01 T6, 02 datasets/baselines, 04 soak/comparison/cutover: blocked on Keith/infra/time

## Status
(append one line per completed task)
Task 1: complete (commits 9eb99d7..f69fba0 = 87210c3 + f69fba0, review clean after 1 fix round)
Task 2: complete (commit 40d7bda, review clean; PENDING GATE: bunx convex codegen — self-hosted backend down, Cloudflare 524; re-run before final review)
Task 3: complete (report: task-3-report.md; PENDING GATE: bunx convex codegen — same backend outage, still down; re-run before final review)

## Minor findings deferred to final review
- research-pipeline-codex-specialist.test.ts "flag on" test doesn't delete CODEX_MODEL — not hermetic if env sets it
- createReviewDraftViaCodex catch: OpenRouter fallback can itself throw synchronously via getResearchModel() (pre-existing)
- "memory_recall" kind missing from inline unions in convex/agentTools.ts / convex/agentRuns.ts (pre-existing bug class; confirmed still present in appendAgentRunEvent's kind union — Task 3 only reads memory_recall events, doesn't touch the write path, so left as-is per scope)
- No test exercises the appendAgentRunEvent.invoke model_call call site itself (only the data assembly)
- Task 2: structural duplication between extraction/brief pure-helper blocks (fine at 2 entities, revisit at 3)
- Task 2: editExtraction/editBrief call ctx.db.patch with {} when updates empty (harmless no-op write)
- Task 3: touched convex/http.ts (route registration) despite it not being in task-3-brief.md's literal "may modify" list — necessary for the new /agent-tools/getSelfImprovementStats endpoint to be reachable at all; flagged explicitly in task-3-report.md for review rather than silently going out of bounds
- Task 3: selfImprovementStats query fetches recent rows via order("desc").take(500) for editCaptures/agentRunEvents (no index by date exists on those tables) rather than a true date-range query — fine at current data volume, would need a new index if either table grows large before a window's data is captured within the first 500 rows
