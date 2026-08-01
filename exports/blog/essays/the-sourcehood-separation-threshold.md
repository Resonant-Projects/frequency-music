---
title: "The Sourcehood Separation Threshold"
publishDate: 2026-07-10
excerpt: "Sourcehood is not discovered in sound but decided by task."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "composition"
  - "acoustics"
  - "information-theory"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

The newest extraction batch sharpens a question that keeps returning in the corpus:

**When does one sound become many sources?**

That question looks simple only if the answer is already labeled. A clean dataset says "one event." A separation benchmark says "two speakers." A room model says "signal plus environment." A classifier says "same class, different individual." But the recent sources keep showing that sourcehood is not merely discovered in the waveform. It is decided by the task.

Four extractions make the pattern unusually clear. SR-CorrNet frames multi-speaker speech separation as a correlation-to-filter problem. FSD50K-Solo tries to manufacture a strongly labeled single-source dataset by filtering out recordings where multiple events overlap. The anomalous-sound paper removes machine identity at test time and finds that model performance depends on implicit source attribution. The room impulse response paper turns the acoustic environment into a text-conditioned generative object.

Together they suggest a practical compositional principle:

**Sourcehood is a threshold, not a property.**

## The Threshold Can Move Upstream

SR-CorrNet is interesting because it criticizes late-split architectures. If speaker disentanglement waits until the final stage, the model carries too much entangled information through a bottleneck. The proposed separation-reconstruction strategy moves the decision earlier: compute spatio-spectro-temporal correlations from the observation, then estimate filters that recover the target signals.

That is not only an engineering choice. It is a claim about where identity should enter the system. The model does not wait until the end to ask "which speaker is this?" It lets sourcehood organize the representation before reconstruction.

For music, this matters because many tools still behave like late-split systems. They first compute a global representation of the mix, then ask for notes, stems, timbres, onsets, or anomalies afterward. But polyphonic music often needs the source decision earlier. A violin harmonic, a breathy flute onset, a sung consonant, and a cymbal wash may overlap in the same time-frequency region while requiring different listening contracts.

Compositionally, the upstream move is powerful: decide the source model before deciding the sound model. A piece can make that audible by presenting a dense texture whose events become intelligible only when the listener is given a source hypothesis. The same spectrum can be heard as one fused object, several masked voices, or an acoustic space acting on a foreground source.

## Single-Source Is A Curated Fiction

FSD50K-Solo approaches the problem from the opposite direction. It begins with a dataset where many recordings contain background interference or overlapping events, then uses diffusion-generated clean events and encoder-classifier filtering to construct a single-source subset.

The important word is "construct." The dataset does not simply find single-source reality lying around in the world. It curates recordings until they satisfy a single-source standard useful for supervised learning.

That is valuable. Strong labels need clean referents. But it also reveals how artificial the one-source threshold can be. A door slam with room tone, a footstep with clothing noise, a bird call with wind, or a piano note with pedal resonance may all be "one event" for one task and "multiple sources" for another.

Music depends on that ambiguity. A distorted guitar chord is one instrumental gesture, many strings, many partials, amplifier coloration, room response, and electrical noise. Which level counts as the source? The answer changes with the compositional question.

The FSD50K-Solo extraction therefore gives composers a useful inversion: instead of cleaning mixtures into single-source examples, deliberately move sounds across the threshold. Start with a clean isolated source, then add just enough contextual residue that the listener cannot tell whether it is still one object or a small scene.

## Identity Can Be Hidden Inside Performance

The anomalous-sound paper shows what happens when the source label is withheld. Standard benchmarks often assume machine identity is known at test time. Remove that assumption, merge recordings from multiple machines, and performance degrades in ways hidden by ordinary evaluation. The degradation correlates with implicit machine identification accuracy.

That means the system was not only detecting anomaly. It was also trying to name the body that produced the sound.

This is the same problem as musical interpretation. A wrong-note detector may depend on knowing the instrument. A tuning analyzer may depend on knowing the performer, tuning system, or room. A timbre classifier may perform well because identity is stable rather than because the target feature is robust.

But again, this is not merely a flaw. Hidden identity is part of musical meaning. A note is not just a frequency; it is a frequency enacted by a source under constraints. The same A4 sung by a tired voice, bowed near the bridge, struck on a prepared piano, or rendered through a synthetic room has different evidential weight.

The compositional question is not "can identity be removed?" It is "which identity cues are allowed to count?"

## The Room Crosses The Line

Room impulse response generation pushes sourcehood past the sound-producing body. The RIR model uses vision-language descriptions and text-to-audio priors to generate plausible acoustic spaces. A room becomes promptable: small tiled bathroom, wide wooden hall, stone corridor.

In ordinary signal language, the room is a transfer function. It is not the source. But perceptually, the room can cross the sourcehood threshold. It contributes stable spectral and temporal signatures. It can make unrelated sounds belong together. It can dominate recognition so strongly that the "same" sound in a different room feels like a different musical object.

This connects directly back to separation. If the room is treated as background, a separator may try to remove it. If the room is treated as source-like, the separator should preserve or even foreground it. A convolution reverb is not only an effect; it is an attribution layer.

That suggests a studio exercise: compose a phrase where sourcehood passes from body to room. Begin with a dry sound whose identity is obvious. Gradually increase convolution, early reflections, and resonant coloration until the room becomes more recognizable than the source. Then replace the source while preserving the room. If the listener hears continuity, the room has crossed the sourcehood threshold.

## A Practical Test

The threshold can be tested rather than only described.

Take a small sound collection and create four versions of each event:

- isolated source
- source plus weak context
- source plus competing event
- source through a strongly identifying room

Then run or listen for several judgments: pitch, onset, timbre, source count, anomaly, room identity, phrase function. The question is where each judgment flips from one-source hearing to multi-source hearing.

That flip point is compositionally meaningful. It is the place where a sound stops being an object and becomes a relation.

## Why It Matters

The recent extractions point toward a more flexible theory of sourcehood. SR-CorrNet says separation can improve when source decisions move upstream. FSD50K-Solo says single-source examples are carefully manufactured. Anomalous sound detection says identity can be hidden inside a task. RIR generation says the environment can become source-like.

For a composer, these are not separate facts. They are four handles on one material parameter: the separability of sound.

The sourcehood separation threshold asks how much evidence is required before one stream becomes two, before a room becomes an instrument, before a classifier stops hearing an event and starts hearing a body. Music has always worked at that boundary. The difference now is that the boundary can be measured, modeled, and deliberately moved.

---

_Sources: SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo single-source dataset curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), anomalous sound detection without machine identity (`j9741717c5306g0134yg8tgtb986qgdn`), and text-conditioned room impulse response generation (`j971jm21g3hsts9fxexgvbsrcd86qnqy`)._

_Connections: [The Identity-Withholding Test](the-identity-withholding-test.md), [The One-Source Threshold Revisited](the-one-source-threshold-revisited.md), [The Single-Source Illusion](the-single-source-illusion.md), [The Early Separation Principle](the-early-separation-principle.md), [The Room Is Part Of The Source](the-room-is-part-of-the-source.md)._
