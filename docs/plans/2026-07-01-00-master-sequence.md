# 00 — Master Sequence: Self-Improving Research-to-Composition System

> **For Hermes:** This is the index and sequencing contract for plans 01–05. Do not implement from this file; implement from the numbered plans, in gate order.

**Goal:** Take the current system (working deterministic Convex pipeline + dry-run LangGraph agents + audit-only writes) to the full end-to-end vision: an autonomous, observable, self-improving research-to-composition loop, with subscription-based Codex inference as the primary model provider and OpenRouter as fallback, running always-on on Proxmox, with humans approving research-data writes.

**Non-goals for this wave:** DAW connectors, 3D explorer expansion, public automation surfaces. Those remain sequenced by `docs/next-wave-roadmap.md` Tiers 3–4.

---

## The end-state loop

```
RSS/URL/YouTube/PDF ingest (Convex, autonomous)
        │
source-intake-triage graph (agent, cheap model) ── proposes skip/extract
        │
extraction (Convex action, traced)
        │
research-pipeline graph (agent: research → contradiction → composition → quality gate)
        │
agentReviewDrafts (pending_review) ──► human approve/reject in app
        │ approved
hypotheses / recipes (real rows, whyThisMatters enforced)
        │
weekly-brief graph (agent) ──► brief draft ──► human edit ──► publish
        │
weekend studio session ──► listening feedback (embodied, expandVerdict)
        │
outcome labels + human edits ──► LangSmith datasets ──► evaluators
        │
eval-gated prompt/policy promotion + agent memory store
        └──────────────► feeds back into every generation step
```

Inference: Codex SDK (ChatGPT subscription) for non-tool-binding generation, critique, synthesis, and verification-sandbox work; OpenRouter Anthropic for tool-binding supervisor/subagent calls and as fallback; Haiku via OpenRouter for LLM-as-judge.

---

## Sequence and gates

### Phase A (parallel): 01 Codex SDK provider + 02 LangSmith completion

These two do not depend on each other. 01 changes how models are called; 02 changes how calls are measured. Run them in parallel.

**Gate G1 — "Measured and subscription-powered":**

- [ ] `spike-codex-sdk.ts` returns a structured response using ChatGPT-subscription auth, no API key set.
- [ ] `getResearchModel()` routes non-tool calls to Codex, tool-binding calls to OpenRouter, with automatic fallback on Codex failure/limit.
- [ ] All four Convex AI call sites traced; a full pipeline run shows `extract_v2`, `hypothesis_v1`, `recipe_v1`, `brief_v2.phase3` traces.
- [ ] Golden datasets uploaded; baseline experiments recorded for extraction, hypothesis, and brief.

### Phase B: 03 Draft writes and review promotion

Depends on G1 only for observability (agent runs that create drafts should be traced). The convergence gate from the June plan is already satisfied (audit runs + build/smoke automation work).

**Gate G2 — "Human-approved research writes flowing":**

- [ ] An agent run produces a structured draft; approving it in the app creates a real hypothesis or recipe row that passes `whyThisMatters` enforcement; rejecting archives it.
- [ ] Promoted rows carry provenance (`agentRunId`, trace URL).
- [ ] At least 3 drafts have gone through the full cycle with real research data.

### Phase C: 04 Production worker and scheduling

Depends on G2 (a worker with nothing to write is a demo) and on 01's headless-auth work.

**Gate G3 — "Cutover decision":**

- [ ] Always-on worker on Proxmox executes queued runs unattended for 2+ weeks without secret leakage or manual restarts.
- [ ] Weekly-brief parallel comparison (Convex cron vs agent graph) ran ≥3 cycles; LangSmith evals + manual review compared.
- [ ] A decision-log entry resolves the comparison: cut over, extend, or reject. Only after cutover does the Convex-side brief generation get demoted to fallback.

### Phase D (ongoing): 05 Self-improvement loop

Starts as soon as G1 lands (edit capture and outcome labeling need traces + datasets, not the worker). Verification sandbox and memory store land after G3.

**Gate G4 — "The loop learns":**

- [ ] Human brief/hypothesis edits automatically become dataset rows.
- [ ] Listening-session outcomes join back to the recipes/hypotheses that produced them and appear as eval labels.
- [ ] A prompt version has been promoted (or rejected) purely through the eval-gated runbook, with a decision-log entry.
- [ ] Agent memory store recalls at least one prior contradiction across runs.

---

## Interlocks with next-wave workstreams

The agent track does not make the *product* end-to-end by itself. Two `docs/next-wave-workstreams.md` items gate the full vision and should be scheduled alongside Phases B–D (they are Convex/UI work, not agent work):

1. **Autonomous ingest (workstream 1).** `source-intake-triage` (plan 04) is only worth running when URL/YouTube/PDF sources reach `text_ready` without manual pasting. Sequence: readable-text fetch → transcript fetch → PDF extraction, in that order.
2. **Canonical parameter schema + recipe export (workstreams 2, 6–8).** The composition agent's quality gate (plan 03) should validate against `parameter_value_v1` once it exists; the verification sandbox (plan 05) verifies exported `.scl`/`.kbm`/`recipe.json` artifacts. Until then both validate prose parameters, which is acceptable but weaker.

Neither blocks Phases A–C. Both should exist before declaring the end-to-end vision done.

## Cost and quota posture

- Codex usage draws on the ChatGPT plan's agentic usage limits, not per-token billing. Weekly briefs and a handful of research runs per week fit comfortably; batch triage across dozens of sources may not. Every Codex call path must degrade to OpenRouter on limit errors (plan 01).
- Judge evaluators stay on Haiku via OpenRouter (established cost-control decision).
- Track per-run usage from Codex `turn.completed` events into `agentRunEvents` so quota consumption is auditable.

## Standing rules (apply to every plan)

- Convex remains the database/control plane; agents get narrow, typed, audited tools only.
- No research-data writes without a `pending_review` draft and human approval until G3+G4 both hold and a decision-log entry explicitly relaxes this.
- Secrets and Codex auth state are mounted at runtime, never baked into images, never printed.
- Side-by-side comparison before any cutover; the deterministic path stays as fallback.
- Every phase completion gets a decision-log entry.
