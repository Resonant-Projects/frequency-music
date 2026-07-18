---
title: "The Actionable Invariant"
publishDate: 2026-07-18
excerpt: "A musical identity becomes useful when it survives filtering, reconstruction, or transformation strongly enough to steer what happens next."
category: "interdisciplinary"
tags:
  - "composition"
  - "signal-processing"
  - "AI-music"
  - "spatial-audio"
  - "representation-learning"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

Three new extractions landed in the same narrow band of the pipeline, and they look, at first, like three separate engineering problems. One tracks a moving speaker so a spatial filter can enhance the right direction. One detects unknown speech vocoders by asking which class-specific decoder can reconstruct an acoustic feature. One learns symbolic-music embeddings whose distances change predictably under pitch and time shifts, then uses those embeddings to condition generation.

The common thread is not "audio AI." It is a more useful principle: **a representation becomes musically actionable when it preserves the invariant that the next operation needs.**

That invariant is different in each case. For moving-speaker enhancement, the needed invariant is source direction through time. For vocoder OOD detection, it is the acoustic signature of a generating mechanism. For MIDI-RAE-JEPA, it is a symbolic musical identity that can survive pitch and time transformations while still changing enough to measure the transformation. But all three systems are doing the same deeper work. They are asking which facts about a sound remain stable enough to guide action after the signal has been filtered, reconstructed, or transformed.

## Tracking Is Not Description

The Bayesian tracking extraction is the clearest case because the representation immediately acts on the world. A moving speaker is not just represented; the direction estimate guides a deep spatially selective filter. The tracker listens to the enhanced signal and feeds that evidence back into the next directional estimate. The representation is therefore not a passive label attached to audio. It is a steering variable.

This matters compositionally. A spatial music system that says "the violin is at 32 degrees" has not yet made that fact musical. It becomes musical when that coordinate can drive a filter, a reverb send, a score-following decision, a lighting cue, or a counterpoint rule. Direction becomes a compositional parameter only when it survives time, noise, reverberation, and competing sources well enough to change the next event.

The social-force trajectory detail is also suggestive. Movement is not treated as arbitrary frame-to-frame displacement; it is modeled as behavior with continuity and pressure. That gives the tracker a world in which motion has expectations. For composition, this suggests a spatial counterpoint rule: do not merely automate panning. Give sound sources motion laws, then let filtering, masking, and attention respond to those laws.

## Reconstruction Is a Test of Origin

The vocoder detector makes the invariant stranger. It does not ask directly, "what class is this?" It asks, "which decoder can reconstruct this feature well?" Identity becomes operational: a source belongs to the class whose reconstruction machinery can carry it with least damage. If no known decoder reconstructs it satisfactorily, the sound is treated as out-of-distribution.

That is a powerful model for musical authenticity and style. A style is often discussed as a surface vocabulary: chords, timbres, rhythms, production habits. But this extraction suggests a harder criterion. A style is the generative apparatus that can reconstruct a musical object without erasing the wrong details. A baroque cadence, a supersaw drop, a rubbed vocal phrase, or a spectral chord belongs to a tradition not because it has a label, but because that tradition's decoder can make sense of it.

There is a compositional trick here. Build several deliberately biased reconstructors: one trained to preserve harmonic function, one to preserve spectral envelope, one to preserve rhythmic articulation, one to preserve source identity. Then send the same material through all of them and listen to the residuals. The residual is not just error. It is the part of the sound that one musical worldview cannot explain.

## Equivariance Is Controlled Survival

MIDI-RAE-JEPA adds the most explicitly mathematical version of the idea. Pitch-shift and time-shift equivariance mean that the representation does not collapse under transformation. A transposed or displaced passage remains related to itself, but not identical in a meaningless way. Its embedding distance reportedly increases monotonically with shift magnitude. That is exactly the kind of representation a composer wants: one that knows the difference between identity, variation, and departure.

This is different from invariance. Full invariance would say: the motif is the same no matter where or when it appears. Equivariance says something subtler: the motif changes in a structured way when it moves. The representation carries the action of the transformation. For music, that distinction is everything. A fugue subject in augmentation is not identical to the original, but it is not unrelated either. A melody transposed up a fifth preserves intervallic contour while changing register, tonal function, and orchestral consequence. A rhythm shifted by half a beat may preserve onset pattern while changing its metric meaning.

Equivariance is the grammar of controlled survival.

## The Compositional Principle

Taken together, these extractions sharpen a principle that has been circling this project for months:

**Identity is not what a representation stores. Identity is what remains usable after an operation.**

If the operation is spatial filtering, identity is whatever keeps a source trackable. If the operation is reconstruction, identity is whatever makes one decoder succeed and another fail. If the operation is generation, identity is whatever can condition new material while preserving register, density, or transformation geometry. In each case, identity is judged by action.

That suggests a practical compositional workflow:

1. Choose the action before choosing the feature. Do not ask "what descriptors can I extract?" Ask "what decision should this descriptor steer?"
2. Decide what should survive. A pitch contour, source direction, room signature, rhythmic density, timbral grain, or harmonic function can each become the invariant.
3. Apply transformations that threaten that invariant: transposition, delay, reverberation, masking, resynthesis, compression, spatial motion.
4. Use the survival or failure of the invariant as musical form.

A piece could make this audible by assigning different invariants to different layers. One layer preserves spatial identity but loses harmonic clarity. Another preserves rhythmic density but loses source identity. Another preserves motivic contour while its register and timbre drift. The form would not be a sequence of themes, but a sequence of survival tests.

## What This Adds

This extends the recent "representation pressure" line. Representation pressure says that task, dataset, body, or tradition decides which musical facts remain legible. The actionable invariant adds the next step: legibility matters because it permits action. A feature that can be decoded but cannot steer anything is an annotation. A feature that changes the future is a control surface.

That distinction keeps the theory honest. It prevents us from treating knowledge-graph nodes, embeddings, or extracted concepts as discoveries by themselves. The graph is only musically useful when its concepts can do work: generate a hypothesis, guide an experiment, suggest a composition parameter, reveal a correspondence, or expose a failure mode.

The three sources disagree about many details, but they agree on this: useful listening is not complete listening. It is selective preservation under pressure. The musical question is not "what is in the sound?" It is "what can survive the next operation, and what can that survivor make possible?"

---

## Sources

- **Autoregressive Bayesian tracking for moving-speaker enhancement** — temporal feedback from enhanced speech improves direction tracking for spatial filters.
- **Reconstruction-based vocoder OOD detection** — class-specific decoders identify known vocoder signatures and reject features no decoder can reconstruct.
- **MIDI-RAE-JEPA** — pitch- and time-shift equivariant symbolic-music embeddings support reconstruction and conditioned generation.

## Connections

- **Representation pressure** — the task determines which facts remain legible.
- **The aligned control surface** — control begins when one identity can be held steady while another dimension moves.
- **The reconstruction limit** — reconstruction error reveals what a model cannot explain.
- **The source is a hypothesis** — source identity is inferred from the tests it survives.
