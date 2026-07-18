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
An addressable assertion with its own identity and provenance (which extraction produced it, from which source), carrying its own evidence level, truth confidence, and interest level. Claims are the knowledge atoms of the system — correspondences cite them as evidence. Not a fragment of an extraction; the extraction is the generative act, the claim is what it produced.
_Avoid_: fact, finding

**Domain**:
A registry-governed discipline (microtuning, cymatics, psychoacoustics, sacred geometry, …) assigned to concepts; correspondences must cross domains. A concept may live in several domains. Registry maturity (known/provisional/experimental/deprecated) and mission relevance are separate axes from domain membership.

**Domain Triage**:
The standing human curation of the domain registry: promoting, merging, or rejecting provisional domains the classifier mints as new sources arrive. A recurring decision surface, not a one-off cleanup — provisional domains accumulate continuously, and untriaged domains degrade correspondence mining (which filters on domain membership).
_Avoid_: domain cleanup (implies one-off), registry review (too generic)

**On-Mission / Off-Mission**:
Whether a concept belongs to the research program or is incidental capture (e.g. ML-engineering vocabulary from arXiv feeds). Off-mission concepts remain in the graph but are excluded from correspondence mining.
_Avoid_: relevant/irrelevant (too generic), noise (off-mission capture may still be useful reference)

**Correspondence**:
An asserted link between two concepts from different domains. The concept pair is its identity (rediscovery strengthens the one row, never duplicates it); claims cite as evidence. Lifecycle: conjectured → evidenced or contradicted → retired. A conjectured correspondence is resolved one of two ways — by found evidence (claims from sources) or by experiment (a hypothesis derived to test it). Same-domain links are ordinary edges, not correspondences.
_Avoid_: connection, link (ambiguous with edge); edge (graph plumbing — carries no review status, may be same-domain)

**Hypothesis**:
A testable musical question derived from extractions or correspondences, always carrying why-this-matters rationale.

**Recipe**:
The experiment protocol that turns a hypothesis into concrete composition instructions — parameters, DAW checklist, and study protocol.
_Avoid_: experiment (the recipe is the plan; the composition is the experiment run)

**Composition**:
A produced musical artifact, optionally a revision of a parent composition varying one variable.

**Micro-Study**:
The smallest composition artifact: a 30–90 second, one-variable litmus test of a recipe. Deliberately minimal and minimally artistic — which makes it the most mechanizable object in the ontology and the primary candidate for machine rendering. Machine-rendered micro-studies must be validated against a human rendering before their listening data is trusted.
_Avoid_: sketch, demo

**Starter Kit**:
The machine-derivable artifacts a recipe generates so composition starts at "make it sound good," not setup arithmetic: Scala tuning files from tuning parameters, a seed MIDI sketch honoring the recipe's constraints, and a parameter card.
_Avoid_: template, scaffold

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

**Source Scout**:
The need-directed discovery of new sources and feeds, driven by the graph's own gaps — under-represented on-mission domains and conjectured correspondences starving for evidence. Scouted individual sources direct-ingest with agent provenance (the source status pipeline is their review structure); scouted recurring feeds are proposals requiring human enablement, because a feed is a standing editorial commitment.
_Avoid_: crawler, discovery pipeline

**Failure Archive**:
The derived view of contradictions, retirements, and low-yield paths; negative results are first-class.

### Agent system

**Agent Run**:
A queued unit of agent work, atomically claimed by the worker and heartbeat-leased until a terminal status.

**Agent Draft**:
An agent-proposed hypothesis or recipe payload awaiting human review; the only door through which agent work enters the experimental pipeline. Graph enrichment (correspondences, edges, concepts) is agent-writable directly, provenance-stamped, without a review gate — human attention is spent at the point of irreversibility, not the point of creation.
_Avoid_: proposal, suggestion

**Draft Promotion**:
Human approval converting an agent draft into a real hypothesis or recipe, stamped with agent provenance and held to the same rigor as human creation. Promotion may carry operator amendments — the reviewer edits the payload before approving, the original agent payload is preserved, and provenance records approved-with-edits plus the changed fields.

**Agent-Tool Surface**:
The secret-guarded HTTP interface through which external agents read project state and append audit events. Human decisions (approve/reject/supersede) are never part of it.

**Cross-Seam Contract**:
A shape (draft payload, event kind, status enum, timing constant) that both the Convex backend and the agent workspace must agree on. Defined once under `convex/shared/`; zod-first for payloads.
