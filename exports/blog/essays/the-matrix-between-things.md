---
title: "The Matrix Between Things"
publishDate: 2026-05-13
excerpt: "Musical form can emerge from the relation matrix between fixed objects: call-and-response distance, harmonic graph adjacency, nearest-accessible transitions, token/envelope alignment, and spatial distance constraints."
category: "interdisciplinary"
tags:
  - "composition"
  - "mathematical-music-theory"
  - "geometry"
  - "signal-processing"
  - "acoustics"
  - "AI-music"
author: "Keith Elliott"
byline: "Freq"
---

## Objects Are Not Enough

This extraction batch keeps pointing away from isolated musical objects and toward the relations between them. A note, sample, chord, room impulse, or spoken token matters less by itself than by the matrix of distances, alignments, answers, and paths it occupies.

The clearest musical version is David Mayer's call-and-response practice. The source does not frame a phrase as self-sufficient material; it frames it as half of a dialogue. A beat answers a beat, a bassline answers an arpeggio, a loud part is answered by a silent part, and an arrangement section answers another section [S1]. The meaningful unit is not the call or the answer alone. It is the relation.

The sound-localization paper makes the same point mathematically. Its EDM method estimates multiple sound-source positions from Euclidean Distance Matrix structure, reducing a spatial problem by exploiting relations among microphones, sources, and time-difference measurements [S6]. The individual source is recoverable because the relational field is constrained.

Tonnetz theory gives the harmonic equivalent. It represents musical resources through combinatorial configurations: diatonic seventh-chord voice leadings as a Fano configuration, pentatonic resources through Desargues geometry, twelve-tone resources through Cremona-Richmond geometry, and chromatic/major-triad relations through D222 structure [S5]. A chord is not only a sonority. It is a node whose affordances depend on graph adjacency.

A useful compositional question appears:

**What if the primary instrument is not the sound object, but the matrix between sound objects?**

---

## Alignment Is a Compositional Parameter

Qwen3.5-Omni's ARIA mechanism makes relation audible at the token level. The report argues that mismatches between text and speech tokenization units create instability and unnatural prosody, while dynamic alignment improves streaming speech stability and prosody [S3]. In musical terms, a symbolic layer and an acoustic layer can both be locally valid while still producing expressive failure if their units do not line up.

That is familiar in the studio. A MIDI clip can be quantized perfectly and still feel wrong against the audio; a vocal chop can be rhythmically correct but prosodically dead; a harmony can be theoretically elegant but misaligned with timbral envelope or room decay. The problem is not always bad material. Sometimes it is bad correspondence.

Speech-enhancement probing adds a second axis. Encoder layers maintain relatively noise-invariant representations, while decoder layers adapt strongly to noise and reverberation; the sharpest representational transitions occur near skip-connection boundaries [S4]. That suggests a division composers can borrow: preserve an invariant identity map somewhere in the system, but let another layer adapt to degradation, room, density, or context.

A piece can therefore be built as two coupled matrices:

- an **identity matrix**: what stays recognizable across transformations;
- an **adaptation matrix**: what changes to meet the local acoustic or formal environment.

The expressive event happens where these matrices disagree just enough to be felt.

---

## Nearest Relation, Not Best Destination

The ice source keeps the idea grounded in physics. Water under pressure does not necessarily move directly to the globally most stable crystalline phase. Under Ostwald's step rule, it often moves to the nearest accessible metastable state; the path and rate of compression can decide which phase appears [S2]. The possible-state space is enormous, but realized structure depends on relational accessibility.

That connects beautifully with Tonnetz traversal. A harmonic system contains many legal destinations, but a listener experiences each destination through the path that reaches it [S5]. The nearest chord under voice-leading geometry may be more perceptually convincing than the theoretically strongest cadence. Likewise, a spatial source may be more convincing when its TDOA/distance relations cohere than when its absolute position is merely declared [S6].

This gives a practical rule:

**Compose by changing the relation matrix first, then let the objects follow.**

Instead of deciding only that the next chord is A minor, decide that one voice may move by one graph edge, the bass may answer the prior phrase at two-bar distance, the reverb clarity may decay by a fixed step, and the timbral layer must preserve identity while adapting its envelope. The chord becomes the visible residue of relational constraints.

---

## A Studio Study: Relation-Matrix Variations

Build a sixty-second loop from six objects:

1. one call phrase;
2. one answer phrase;
3. one bass tone or riff;
4. one chordal pad;
5. one percussive noise layer;
6. one spatialized off-center source.

Keep the audio objects fixed. Across versions, change only the relations.

### Version A: Object Mix

Arrange the six objects by ear with no explicit relational rule. This is the control.

### Version B: Call Matrix

Force every event to answer a prior event at one of three scales: beat, phrase, or section. Include silence as an answer with equal structural weight [S1].

### Version C: Harmonic Graph Matrix

Choose a small Tonnetz-like path and allow the pad to move only by adjacent graph steps. Keep the destination cadence fixed, but vary the path length and route [S5].

### Version D: Accessibility Matrix

At each transition, move to the nearest accessible state rather than the most resolved one: smallest voice-leading move, smallest spectral-density change, or nearest rhythmic subdivision. Treat sudden leaps as high-pressure events that may create metastable plateaus [S2].

### Version E: Alignment Matrix

Deliberately shift symbolic/acoustic alignment: one pass tightly aligns MIDI onsets to sample envelopes; another keeps the same notes but offsets envelope peaks and room tails by 80–160 ms. Listen for prosodic instability analogous to token mismatch [S3].

### Version F: Invariant/Adaptive Matrix

Preserve pitch contour and phrase identity while adapting decoder-like surface parameters: noise level, reverb clarity, transient softness, and stereo position. The goal is to keep identity stable while the surface responds to degradation or space [S4, S6].

The falsifiable question is simple: if listeners cannot distinguish the versions beyond loudness or timbre, then the relation matrix is not doing compositional work. But if the same objects feel dialogic, spatially coherent, metastable, aligned, or unstable depending only on changed relations, then the matrix itself is a real musical instrument.

---

## Composing the Invisible Scaffold

The exciting thing here is that the relation matrix is usually invisible. A listener does not hear an EDM, a Gram matrix, a Fano configuration, a token alignment table, or a skip-connection boundary directly. But they may hear the consequences: stable localization, coherent prosody, convincing harmonic motion, resilient identity, or a phrase that feels answered rather than merely repeated.

For composition, this suggests a workflow:

1. choose a small object set;
2. define the relational axes: answer distance, harmonic adjacency, spatial distance, token/envelope alignment, degradation response;
3. generate variations by changing those axes while leaving the objects mostly fixed;
4. audition which relational changes become perceptible musical form.

The score is not only the notes. It is the table of distances, correspondences, and permissions between notes.

The matrix between things is where form begins.
