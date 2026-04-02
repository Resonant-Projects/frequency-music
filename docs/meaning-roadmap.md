# Meaning Roadmap

## Executive Summary

Frequency Music already has the shape of a research-to-composition system. The next stage is not to add arbitrary features, but to deepen the project's ability to accumulate meaning over time. That means improving what the system learns, how clearly it represents that learning, how directly it converts learning into music, and how honestly it publishes what it finds.

This roadmap organizes that work into four layers:

- knowledge
- experiment
- representation
- publishing

The sequence matters. The project should first improve rigor and interpretation, then make accumulated learning visible, then tighten the studio loop, and only then strengthen the outward-facing editorial surface.

This roadmap extends the operational docs that already exist:

- [loop-spec-v1.1.md](./loop-spec-v1.1.md)
- [cadence-and-operating-rules.md](./cadence-and-operating-rules.md)
- [metrics-and-dissonance.md](./metrics-and-dissonance.md)
- [weekly-brief-template.md](./weekly-brief-template.md)
- [schema.md](./schema.md)

## Why Sequencing Matters

If public narrative comes too early, the project risks sounding more certain than it has earned. If new screens come too early, the app may represent shallow learning more beautifully without actually becoming wiser. If rigor comes first, every later layer improves:

- better experiments produce better observations
- better observations produce better theses
- better theses produce better compositions
- better compositions produce stronger public explanations

The sequence is therefore:

1. improve signal quality
2. improve memory and representation
3. improve actionability in the studio
4. improve public articulation

## The 12 Ideas

### 1. Thesis Tracker
Add a layer above hypotheses for durable beliefs and long-running questions.

### 2. Why This Matters
Require each experiment to state its artistic or conceptual stake explicitly.

### 3. Failure Archive
Turn contradicted or low-yield work into durable knowledge rather than silent clutter.

### 4. Lineage Views
Show the ancestry of every composition from source to observation.

### 5. Single-Variable Experiment Mode
Make revisions more comparable by naming what changed.

### 6. Interesting vs True
Separate creative fertility from evidential strength.

### 7. Editorial Graph
Make the concept graph useful for decision-making, not just navigation.

### 8. Studio Prompts
Add shorter, more actionable outputs alongside weekly briefs.

### 9. Embodied Listening Vocabulary
Improve the language and structure used to capture felt response.

### 10. Public Editorial Cadence
Establish recurring public formats for publishing what the system learns.

### 11. Expandability Score
Track whether an experiment can become real music, not just whether it is interesting.

### 12. Seasonal Themes and Campaigns
Group weekly work into larger arcs with memory and momentum.

## Meaning Contribution of Each Idea

### Thesis Tracker
This turns isolated experiments into a coherent worldview. Meaning grows when many weekly turns can be seen as testing versions of the same underlying belief.

### Why This Matters
This keeps the system connected to stakes instead of drifting into procedural activity. It forces every experiment to answer why anyone should care.

### Failure Archive
This gives negative results dignity. The project becomes more honest and more cumulative when it remembers what did not work and why.

### Lineage Views
These make artifacts legible as consequences of inquiry. A composition becomes more meaningful when its ancestry is visible.

### Single-Variable Experiment Mode
This increases interpretability. Without it, the system records motion but learns less from comparison.

### Interesting vs True
This protects both wonder and rigor. The project can preserve speculative material without letting it masquerade as proof.

### Editorial Graph
This turns the graph into a mirror of the project's actual mind: recurring concepts, blind spots, and high-yield clusters.

### Studio Prompts
These reduce the gap between synthesis and making. Meaning in this project must survive contact with practice.

### Embodied Listening Vocabulary
This sharpens the language of felt response and allows subtle bodily knowledge to accumulate in comparable form.

### Public Editorial Cadence
This turns private research into an identifiable public practice rather than a pile of internal notes.

### Expandability Score
This keeps the system oriented toward music, not only experiments. It values ideas that can become pieces.

### Seasonal Themes and Campaigns
These give the project chapters. Weeks create momentum; campaigns create significance.

## Four-Layer Architecture

### Knowledge Layer
Focus: what the project believes, tracks, and distinguishes.

Includes:

- thesis tracker
- interesting vs true
- failure archive
- seasonal themes and campaigns

### Experiment Layer
Focus: how the project designs and evaluates work.

Includes:

- why this matters
- single-variable experiment mode
- embodied listening vocabulary
- expandability score
- studio prompts

### Representation Layer
Focus: how accumulated learning becomes legible inside the product.

Includes:

- lineage views
- editorial graph
- thesis-linked weekly briefs

### Publishing Layer
Focus: how selected learning becomes public.

Includes:

- public editorial cadence
- campaign summaries
- public thesis and experiment recaps

## 12-Week Phased Roadmap

### Phase 1: Rigor and Interpretation
Weeks 1-3

Status:
- Implemented, with hardening now enforced for new work: new hypotheses require `whyThisMatters`, listening feedback captures embodied notes and expand verdicts, and Phase 1 regression coverage exists for the critical paths.

Quick wins first:

- add `why this matters` to hypotheses, recipes, and briefs
- add embodied listening helpers and vocabulary
- add expandability scoring in listening sessions
- add `interesting` vs `true` framing to sources/extractions
- introduce lightweight thesis records
- enforce or strongly guide single-variable revisions

Why this phase first:

- it improves the quality of all future observations
- it raises the evidential bar without slowing exploration too much
- it gives the rest of the roadmap better material to build on

Success criteria:

- every new hypothesis has an explicit stake
- every new listening session captures richer felt data
- revisions become more comparable
- speculation is no longer flattened into the same category as stronger evidence

### Phase 2: Represent Accumulated Learning
Weeks 4-6

Status:
- Implemented. Composition lineage now includes source -> extraction -> hypothesis -> recipe -> composition -> listening, and the failure archive continues to derive from those relationships.

- add lineage views for compositions
- add a failure archive or anti-library
- upgrade the graph with editorial signals
- make weekly briefs aware of theses and contradictions

Why this phase second:

- once the data improves, the product should reveal what it knows
- this turns the app from a set of records into a real memory system

Success criteria:

- a composition can be understood in context
- contradictions are easier to review than to forget
- the graph helps select next work, not just browse content

### Phase 3: Tighten the Studio Loop
Weeks 7-9

Status:
- Implemented. Campaigns steer the weekly loop, weekly briefs persist 10/30/90-minute prompts plus deterministic recommended actions, and negative evidence remains part of campaign steering.

- add studio prompt modes
- add campaigns and themes
- connect briefs, theses, and campaigns
- use listening and expandability signals to steer next actions
- current implementation path: campaigns act as themes, and each generated weekly brief persists prompt variants plus deterministic recommended actions

Why this phase third:

- the system now knows enough to direct making more intelligently
- longer arcs can emerge without losing weekly momentum

Success criteria:

- the weekly brief can produce short-form studio actions
- active work can belong to a larger campaign
- the system helps choose what to compose next

### Phase 4: Strengthen Public Narrative
Weeks 10-12

- define a recurring editorial cadence
- support experiment recaps and "what changed my mind" pieces
- publish selected thesis and campaign summaries
- improve public-safe visibility and synthesis workflows
- implement curated `editorialArtifacts` inside Frequency Music rather than publishing raw linked records directly
- export only approved public snapshots through the `public_editorial_v1` contract
- feed the anonymous public surface from Astro content collections backed by exported markdown snapshots

Why this phase last:

- outward-facing narrative is strongest once internal evidence and memory improve
- publishing should reflect earned clarity, not compensate for ambiguity

Success criteria:

- public outputs are regular, legible, and honest about uncertainty
- the project feels like a sustained inquiry rather than isolated posts
- publishing uses explicit review states and public-safe evidence cards
- Astro consumes snapshot exports rather than live private joins

## Quick Wins First

The highest-leverage first moves are:

1. `why this matters`
2. embodied listening vocabulary
3. expandability score
4. interesting vs true
5. lightweight thesis records
6. single-variable revision discipline

These all improve the value of future work without requiring major new surfaces.

## Success Criteria by Phase

### Phase 1
- better signal quality
- clearer artistic stakes
- stronger separation between evidence and inspiration

### Phase 2
- better memory and traceability
- more visible contradictions
- better decision support

### Phase 3
- tighter connection between synthesis and making
- longer thematic continuity
- more useful weekly steering

### Phase 4
- stronger public identity
- more consistent editorial practice
- more trustworthy outward-facing narrative

## Risks and Anti-Patterns

Avoid:

- shipping narrative polish before internal rigor
- turning the graph into a decorative detour
- overfitting the system to metrics while losing musicality
- adding too many new records at once without clear flows
- confusing provisional inspiration with validated findings
- letting campaigns become bloated backlogs

## Future Extension Points

Once the four phases are in place, likely extensions include:

- richer campaign analytics
- better aggregation of embodied listening language
- public-facing thesis maps
- stronger comparison tooling for revisions and A/B studies
- editorial dashboards for planning essay and recap cadence

## Relationship to the Other Docs

This is the primary strategic roadmap. It should be read alongside:

- [vision-and-meaning.md](./vision-and-meaning.md) for doctrine
- [implementation-checkpoints.md](./implementation-checkpoints.md) for build-facing detail
- [decision-log.md](./decision-log.md) for strategic continuity
