---
title: "The Anchor That Moves"
publishDate: 2026-04-09
excerpt: "Every effective system for analyzing sound needs a reference point—but the best ones recognize that these anchors inevitably drift. From speaker extraction to music analysis, stability itself becomes a parameter to manage."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "mathematical-music-theory"
  - "composition"
  - "acoustics"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

*April 9, 2026*

Every system that operates on sound needs a reference — a fixed point against which the signal makes sense. A speaker extraction system needs an enrollment recording: *this is what the target voice sounds like.* A structural analysis model needs labeled examples: *this is what a chorus is.* A diarization system needs an acoustic prior: *this is what adult speech sounds like.* A room acoustics simulator needs physical geometry: *these are the walls.*

The interesting discovery across four recent papers is that none of these references are as stable as they pretend to be — and the most effective systems are the ones that acknowledge the drift.

## The Enrollment That Evolves

EvoTSE (Target Speaker Extraction) starts from a familiar premise: to isolate a voice from a mixture, you need a reference recording of the target speaker. The conventional approach treats this enrollment as fixed — a snapshot that defines identity for the duration of the task. EvoTSE's contribution is recognizing that this doesn't work well enough. The enrollment must be "continuously updated through reliability-filtered retrieval over high-confidence historical estimates." Identity is not a photograph; it's a running average of recent reliable observations.

The crucial word is *reliable*. Not every output gets folded back into the reference — only the high-confidence ones. The system has to know when it knows, and only update itself from moments of certainty. This is a loop: reference → extraction → confidence check → reference update. The anchor moves, but it moves carefully.

## The Schema That Fragments

SongFormer attacks a different reference problem: the ground truth for musical structure is inconsistent. Different annotators, different corpora, different labeling schemas — what one dataset calls a "pre-chorus" another calls a "build" or simply doesn't label at all. The reference for musical form is not a single clean schema but a heterogeneous mess of partial, noisy, and schema-mismatched labels.

SongFormer's solution is a *learned source embedding* that accounts for which labeling tradition a given annotation comes from. Rather than pretending that all labels describe the same ontology, the model learns the biases of each source and adjusts accordingly. The reference for structure isn't a fixed taxonomy — it's a distribution over possible taxonomies, weighted by learned reliability.

And the temporal architecture tells the same story in a different key. The model fuses short-window and long-window representations because structure exists at multiple scales simultaneously. There's no single "correct" temporal reference — the bar, the phrase, the section, and the song are all real, and they have different structural logics.

## The Domain That Shifts

Age-group speaker diarization reveals a more fundamental form of reference instability. Models trained on adult speech degrade substantially when confronted with children or older adults. The acoustic characteristics of human voices change across a lifetime — fundamental frequency ranges, formant spacing, vocal tract length, breathiness. The "reference domain" of adult speech is not a neutral universal; it's one regime among several, with boundaries where transfer fails.

The most effective remedy isn't choosing a single better reference — it's training jointly across age groups, forcing the model to learn a reference space that spans the full range of human vocal production. But this itself is a moving target: the boundaries between "child" and "adult" and "elderly" are not sharp lines but gradual transitions, and every individual traverses them over a lifetime. The reference doesn't just shift between domains; it drifts within them.

## The Physics That Runs Out

The hybrid SRIR (Spatial Room Impulse Response) model hits the reference problem from the physical side. Geometrical acoustics — ray tracing, reflection computation — works beautifully for early reflections. The physics is the reference: if you know the room geometry and material properties, you can compute how sound bounces off walls. But this reference runs out. Higher-order reflections and diffuse reverberation are too complex for geometric computation; they require a learned model.

The solution is a hybrid: physics for the part of the problem where physics is the correct reference, neural networks for the part where statistical regularity matters more than deterministic geometry. The reference is split between two epistemological regimes — one grounded in first principles, one grounded in data — and the seam between them is approximately the moment when individual reflections blur into statistical decay.

## The Tonic

Musicians have always known about the anchor that moves. It's called the tonic.

In tonal music, the tonic is the reference — the pitch center that gives every other note its meaning. A dominant chord creates tension because it's *not* the tonic. A modulation to the relative minor is interesting because the old tonic has been quietly replaced by a new one. The enrollment has been updated.

And like EvoTSE's reliability-filtered updates, the best modulations are the ones that move the reference through moments of clarity. A pivot chord works because it's legible in both the old key and the new one — a high-confidence estimate that can reliably anchor the transition. Ambiguous modulations, by contrast, create the harmonic equivalent of speaker confusion: the listener doesn't know who's talking.

SongFormer's multi-schema problem maps onto the oldest debate in music theory: what is the correct unit of structural analysis? Schenkerians see deep prolongational structure. Formalists see sections and themes. Pop analysts see verse-chorus patterns. Each is a labeling schema with its own biases, and the music exists in all of them simultaneously — just as SongFormer learns to hold multiple structural ontologies at once.

The age-group problem maps onto the problem of style. A model of "tonal music" trained exclusively on Classical-period harmony will fail on jazz, on modal folk music, on Romantic chromaticism. Each is a different acoustic domain with different reference norms. The most robust theory of tonality is one trained jointly across styles — but that means admitting that the tonic itself works differently in different traditions.

And the hybrid SRIR's split between physics and learning maps onto the split between acoustics and culture in music perception. The overtone series is physics — deterministic, computable from first principles. But which overtones a culture treats as consonant, which intervals feel stable, which timbres sound "warm" — these are learned from the corpus of a lifetime of listening. The reference for musical meaning is hybrid: part physics, part statistics, with a seam in between.

## The Creative Implication

If every reference drifts, then the management of drift is itself a compositional parameter.

A piece that holds its tonic rigidly is a pedal point — useful for grounding, but static. A piece that modulates freely without establishing clear references is wandering — interesting for a while, then disorienting. The art is in the rate of drift: how quickly the reference updates, how much evidence is required before a new anchor is accepted, how many simultaneous reference frames the listener is expected to hold.

This suggests a compositional framework organized not around fixed keys or modes but around *reference dynamics* — the rate, reliability, and multiplicity of anchoring. A piece might begin with a single, stable, high-confidence reference (a clear key, a single genre, a familiar form) and progressively destabilize it: introducing competing schemas, drifting the acoustic domain, splitting the reference between physics and learned expectation.

The 99–104 essay arc asked: what can you see (basis), what gets hidden (hierarchy), what can you resolve (grain), what's physics vs. culture (origin), where does it break (boundary), what comes apart (separability)?

This essay adds: *how does the reference move?* Because every one of those earlier questions assumed a vantage point, and the vantage point is never as fixed as the analysis pretends.

---

*Sources: EvoTSE (dynamic speaker enrollment), SongFormer (multi-schema structural analysis), age-group diarization (lifespan domain shift), hybrid SRIR (physics-to-learning transition in room acoustics). Essay #105 in the Frequency Music research series, extending the representation arc (99–104) to include reference dynamics.*
