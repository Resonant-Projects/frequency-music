---
title: "The Precursor Field"
publishDate: 2026-05-13
excerpt: "Many musical arrivals are shaped by a precursor field: three seconds of prosody, accessible harmonic paths, and hidden-source cues that teach the listener how to hear the event before it happens."
category: "composition"
tags:
  - "composition"
  - "prosody"
  - "harmony"
  - "acousmatics"
  - "music-cognition"
  - "generative-systems"
author: "Keith Elliott"
byline: "Freq"
---

## Before the Event, There Is a Field

This batch points toward a useful compositional idea: many musical events are not best understood as isolated objects. They are outcomes of a **precursor field** — a short-lived region of constraints, tendencies, alignments, and accessible next states that makes some events likely and others almost unreachable.

The stuttering-prediction paper gives the most literal version. A three-second audio window can contain prosodic information about an upcoming severe disfluency, while less severe filler-like events do not carry the same predictive signal [S3]. The event is not fully visible yet, but the acoustic field has already begun to bend toward it.

ATRIE gives a complementary decomposition. It treats voice as a relatively static timbral identity plus dynamic, hierarchical prosody, and argues that emotional expression can vary through prosody without losing identity [S6]. In musical terms, this says the "who" of a sound and the "where it is going" of a sound are separable layers. The precursor field mostly lives in the dynamic layer: contour, pressure, timing, energy, and articulation.

The quantum-music preprint makes the abstraction sharper. Its HHL architecture only preserves the claimed quantum advantage if the output is consumed coherently; reading out too much classical information collapses the state and forces the system into chained short blocks [S1]. Whatever we think of the practical quantum claim, the musical analogy is strong: if a phrase is reduced too early to discrete labels, the field of joint melodic-harmonic possibility disappears.

A composer can use this directly. Do not ask only, "What note comes next?" Ask: **what field must exist before that note so the arrival feels inevitable, surprising, or resisted?**

---

## Accessibility Beats Optimality

The ice source contributes the physical law hiding underneath the musical metaphor. Under pressure, water does not necessarily jump to the most stable possible crystal. It often moves to the nearest accessible metastable state, and small differences in compression rate, direction, and timescale can produce different phases [S2]. The mathematically possible state space is huge; the physically reachable path is narrower.

That is a profound warning for generative composition. A system may contain thousands of valid chords, timbres, rhythms, or formal states, but a listener does not experience them as an unordered menu. The listener hears path. The next state must be reachable from the present state through some perceptual, physical, or stylistic corridor.

Tonnetz theory supplies a formal harmonic corridor. The selected Tonnetz paper frames musical resources as combinatorial configurations: Fano structures for diatonic seventh-chord relations, Desargues configurations for pentatonic systems, Cremona-Richmond geometry for twelve-tone resources, and D222/D228 structures for chromatic and Tristan-family relations [S5]. These are not just pretty diagrams. They define neighborhoods. They tell a composer which moves are nearby under a chosen geometry.

Put the ice and Tonnetz claims together, and a compositional rule appears:

**A progression is not shaped only by its destination; it is shaped by the nearest accessible state under the active geometry.**

Sometimes the musically right move is not the globally most resolved chord. It is the chord that the current voice-leading pressure, timbral energy, rhythmic density, and listener expectation can actually reach.

---

## The Hidden Source and the Visible Result

Omni2Sound adds one more layer: sound may need to account for causes that are not visible. Its off-screen audio task asks a model to generate sound sources not present in the image, and its broader training problem concerns alignment among video, text, and audio under modality bias [S4]. This has an old musical cousin in acousmatic listening: the source is hidden, but the sound still implies a world.

In the precursor-field frame, off-screen sound is not an exception. It is the rule. Every audible event implies hidden causes: a breath before a note, a hand preparing a string crossing, a harmonic tension before a cadence, a room before a resonance, a body before a voice.

That is why premature symbolic reduction can be dangerous. A note label says C4. The precursor field says: approached from below, breath thinning, bow pressure increasing, harmonic neighborhood narrowing, room decay still carrying the prior chord. The label is true, but incomplete.

For composition, the hidden source can become a controllable parameter. One can write music where the foreground stays stable while the implied off-screen cause changes:

- the same chord as a relaxed arrival, a blocked utterance, or a metastable plateau;
- the same melody as one coherent quantum-like gesture or as collapsed two-note fragments;
- the same timbre with different prosodic futures;
- the same image or scene with incompatible off-screen sonic worlds.

This is not merely cinematic. It is structural. The precursor field lets a composer decide what kind of future the present seems to contain.

---

## A Studio Study: Three Seconds Before Arrival

A small experiment could test the idea in a DAW.

Write a sixteen-bar loop with four target arrivals: a cadence, a timbral bloom, a rhythmic break, and a sudden silence. Keep the target events fixed across versions. Only vary the three seconds before each event.

1. **Accessible-path version.** Use Tonnetz-like nearest-neighbor voice leading into each harmonic arrival [S5]. Let timbre and rhythm move gradually toward the target, as if following Ostwald's nearest-accessible rule [S2].
2. **Collapsed-block version.** Build the same loop from two-beat or two-note blocks with hard resets at the boundaries, echoing the classical chaining workaround in the HHL music architecture [S1].
3. **Prosodic-warning version.** Before each target, exaggerate subtle precursor cues: slight tempo drag, energy envelope tilt, pitch-contour narrowing, spectral flux increase, or breath-like noise over a three-second window [S3].
4. **Hidden-cause version.** Add off-screen/acousmatic cues that imply a source not visible in the main texture: room tone swelling, mechanical friction, distant impact, or vocal preparation [S4].
5. **Identity/prosody split version.** Keep the timbral identity constant while changing only dynamic prosody — articulation, contour, timing, and intensity — before the target [S6].

Then listen blind. The target events are identical, so the question is not whether the cadence or break is recognized. The question is whether the arrival feels prepared, forced, surprising, blocked, inevitable, or emotionally coherent.

A falsifying result would be simple: if listeners cannot reliably distinguish the versions, or if the three-second precursor changes do not alter perceived arrival quality, then this particular precursor-field design is not load-bearing. But if the fixed targets feel different because their approach fields differ, then the method gives composers a powerful lever.

---

## Composing the Before

The practical lesson is beautifully simple: compose the before.

A score often treats events as points: noteheads, chord symbols, hit points, cuts. But sound often behaves like a field. Prosody anticipates disruption. Crystal phases follow accessible paths. Harmonic geometries define neighborhoods. Multimodal systems struggle when the hidden audio cause is not aligned with the visible or textual cue. Voice identity persists while prosody carries motion.

So a composer can build form by shaping the conditions of arrival rather than only the arrival itself:

- choose a harmonic geometry, then move to the nearest accessible state rather than the theoretically optimal one;
- reserve three-second precursor windows before important events;
- separate timbral identity from prosodic trajectory;
- decide when to preserve coherent joint possibility and when to collapse into discrete blocks;
- use off-screen sound as evidence of hidden causes.

The event is what the listener names. The precursor field is what teaches the listener how to hear it.
