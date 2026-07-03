# Frequency Music

Research-to-composition pipeline: sources are ingested, distilled into claims, turned into testable musical hypotheses and experiment recipes, composed, listened to, and synthesized into weekly steering. This glossary is the canonical project language; architecture reviews and plans use these terms.

## Language

### Research pipeline

**Source**:
A research input (article, paper, video transcript, PDF) tracked from intake through triage.
_Avoid_: document, item, entry

**Source Intake**:
Any path by which a source enters the system — RSS cron polling, HTTP ingest routes, or manifest scripts. All intake paths share one dedupe contract.
_Avoid_: ingestion pipeline (ambiguous with extraction)

**Dedupe Key**:
The canonical identity of a source. Two intake paths that compute it differently create duplicate sources; only `sourceUtils` may compute it.
_Avoid_: unique key, hash

**Extraction**:
The AI-distilled structured reading of a source: claims, parameters, and topics.

**Claim**:
A single assertion within an extraction, carrying its own truth confidence and interest level.
_Avoid_: fact, finding

**Hypothesis**:
A testable musical question derived from extractions, always carrying why-this-matters rationale.

**Recipe**:
The experiment protocol that turns a hypothesis into concrete composition instructions — parameters, DAW checklist, and study protocol.
_Avoid_: experiment (the recipe is the plan; the composition is the experiment run)

**Composition**:
A produced musical artifact, optionally a revision of a parent composition varying one variable.

**Listening Session**:
Structured listening feedback on a composition; the embodied-evidence side of the loop.

**Weekly Brief**:
The Friday synthesis: narrative, persisted studio prompts, and recommended actions, steered by the active campaign.
_Avoid_: weekly turn (UI legacy name)

**Thesis**:
A broader research question that groups hypotheses.

**Campaign**:
The single active theme/chapter that steers weekly work.
_Avoid_: theme, chapter

**Generator**:
One of the four AI steps that produce pipeline rows from prompts: extraction, hypothesis, recipe, weekly brief. All generators share one LLM-call module.

**Failure Archive**:
The derived view of contradictions, retirements, and low-yield paths; negative results are first-class.

### Agent system

**Agent Run**:
A queued unit of agent work, atomically claimed by the worker and heartbeat-leased until a terminal status.

**Agent Draft**:
An agent-proposed hypothesis or recipe payload awaiting human review; the only door through which agent research enters the system.
_Avoid_: proposal, suggestion

**Draft Promotion**:
Human approval converting an agent draft into a real hypothesis or recipe, stamped with agent provenance and held to the same rigor as human creation.

**Agent-Tool Surface**:
The secret-guarded HTTP interface through which external agents read project state and append audit events. Human decisions (approve/reject/supersede) are never part of it.

**Cross-Seam Contract**:
A shape (draft payload, event kind, status enum, timing constant) that both the Convex backend and the agent workspace must agree on. Defined once under `convex/shared/`; zod-first for payloads.
