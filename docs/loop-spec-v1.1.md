# Resonant Projects — Loop Spec v1.1 (Foundation)

### Purpose

Create a repeatable pipeline that turns (1) research + notes into (2) testable musical hypotheses and (3) composable recipes, then (4) captures embodied + musical outcomes and (5) iterates with traceability.

### Core Principle

**Protocol before Recipe.**  
A hypothesis must specify *what we’re testing*, and the recipe specifies *how we express it musically*. This keeps experiments comparable over time.

* * *

## Canonical Objects (Vocabulary)

*   **Source**: external material (paper, video, URL, RSS item, PDF).
*   **Note**: your captured thoughts (Notion, voice transcript, manual).
*   **Extraction**: structured distillation of a Source/Note (summary, claims, params).
*   **Claim**: an asserted statement with a supporting snippet pointer.
*   **Parameter**: a musical/scientific “knob” with units (Hz, BPM, ratio, etc.).
*   **Concept**: canonical topic node (e.g., “harmonic series”, “roughness”).
*   **Hypothesis**: testable if/then statement.
*   **Protocol**: test procedure (what varies, what’s constant, conditions, panel).
*   **Recipe**: DAW-ready composition spec (constraints + sketch).
*   **Artifact**: produced audio output (micro-study, expanded study, full track).
*   **Observation**: evaluation data (subjective + computed + context).
*   **Update**: hypothesis decision + next action, with versioning.

* * *

## Loop Steps (v1.1)

### 1) Ingest → Inbox (continuous)

**Input:** RSS items, PDFs, URLs, YouTube links, Notion pages/voice transcripts  
**Output:** InboxItem

Rules:

*   Everything lands as raw first.
*   No required tags at ingest.
*   De-dupe by hash (URL canonicalization + file hash where possible).

* * *

### 2) Distill → Atoms (AI-assisted extraction)

**Input:** InboxItem content  
**Output:** Extraction containing:

1.  **Summary**

*   3–7 bullets, with “what this is about” + “why it matters”

1.  **Claims\[\]** (1–10)  
    Each claim includes:

*   claimText
*   supportingSnippet (quote or timestamp range)
*   sourcePointer (page, timestamp, or selector)
*   evidenceType (see below)
*   actionability (see below)

1.  **Parameters\[\]**  
    Structured with:

*   name (e.g., “referencePitch”, “bpm”, “carrierFrequency”)
*   value
*   unit (Hz, BPM, ratio, cents, dB, etc.)
*   notes (constraints/ranges)

1.  **Concepts\[\]**

*   canonical labels for cross-linking

1.  **Ratings per claim**

*   **EvidenceType:**peer\_reviewed | preprint | popular | anecdotal | personal\_inference | metaphysical\_unsourced
*   **Actionability:**directly\_composable | indirectly\_composable | inspirational\_only

* * *

### 3) Synthesize → Candidate Hypotheses (weekly narrowing)

**Input:** extractions + your notes  
**Output:** 1–3 CandidateHypotheses per week

Selection constraints:

*   Max 3 experiments per weekly brief.
*   Prefer hypotheses with clear parameters and at least one plausible compositional mapping.

Hypothesis format (short):

*   **Mechanism/structure:** “Emphasizing X (relationship/pattern) may induce Y (sensation/quality) under Z (conditions).”
*   **Target outcomes:** bodily pleasantness, goosebumps, consonance (ear+computed), musicality, ease-of-composability.
*   **Scope:** micro-study first unless obviously song-ready.

* * *

### 4) Design → Protocol + Recipe (make it testable + composable)

#### 4a) Protocol (the test)

Minimum required fields:

*   studyType: litmus | comparison
*   duration: 30–120s (micro-study default)
*   panelPlanned: self, wife, colleague (any subset)
*   listeningContextPlan: headphones/monitors, time-of-day, approximate loudness target
*   baselineArtifactId? (optional but recommended for comparison)
*   whatVaries + whatStaysConstant (1–3 bullets each)

Protocol ladder:

*   **Level 1 (Litmus):** gut check + ratings
*   **Level 2 (Compare):** A/B vs baseline (random order if possible)
*   **Level 3 (Expand):** compose into listenable piece + broader feedback

#### 4b) Recipe (the composition spec)

Default micro-study canvas:

*   bars: 16–32
*   timeSignature: 4/4
*   bpm: 100–125 typical, allowed 80–145 if justified by hypothesis/genre

Recipe fields:

*   bpmTarget or bpmRange
*   tuningSystem (12TET, JI, meantone, etc.)
*   referencePitchHz (e.g., A4=440 or other)
*   pitchMaterialRules (allowed intervals/ratios, avoidances)
*   harmonyRules (voicing constraints, chord grammar)
*   rhythmRules (subdivision, density, syncopation limits)
*   timbreRules (harmonicity/noise, spectral centroid range, instruments)
*   arrangementSketch (bar-by-bar outline)
*   expansionPath (how to turn micro-study → section → full track)

* * *

### 5) Produce → Artifact (versioned)

**Input:** Recipe  
**Output:** Artifact

Artifact types:

*   microStudy (default)
*   expandedStudy (2–3 min)
*   fullTrack

Versioning:

*   semantic-ish: v0.1, v0.2, v1.0
*   store a short “diff note”: what changed, why

* * *

### 6) Evaluate → Observation (bodily + musical + composability)

**Input:** Artifact + listening session  
**Output:** Observation

Required subjective metrics (0–5):

1.  **Bodily Pleasantness**
2.  **Goosebumps / Chills**
3.  **Perceived Consonance (Ear)**
4.  **Musicality / Listenability**
5.  **Ease of Composability**

Required context:

*   listener role (self/wife/colleague)
*   monitors/headphones, rough volume, time-of-day
*   freeform body map notes (where/how it’s felt)
*   “expand?” verdict: yes | maybe | no

Also compute a **Consonance (Computed)** value (see metrics-and-dissonance.md).

* * *

### 7) Update → Decision + Next Action (close the loop)

Each hypothesis version gets a resolution:

*   supported | inconclusive | contradicted (based on observations)  
    and a lifecycle state:
*   draft → queued → active → evaluated → revised/retired

Next action templates:

*   “expand micro-study to 2–3 min”
*   “run A/B vs baseline X”
*   “revise: change only tuning” (single-variable change)
*   “retire: low pleasantness twice”

* * *

## Weekly Output Contract (what the system must produce)

Every Friday brief must contain up to 3 “Experiment Cards” with:

*   hypothesis
*   protocol
*   micro-study recipe (16–32 bars, 4/4, BPM guidance)
*   exit criteria (expand/revise/retire thresholds)
*   citations to sources/claims

(Template in weekly-brief-template.md.)
