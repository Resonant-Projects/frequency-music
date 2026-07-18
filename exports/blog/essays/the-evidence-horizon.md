---
title: "The Evidence Horizon"
publishDate: 2026-06-21
excerpt: "The evidence horizon marks when enough signal has arrived for a system to act—a concept spanning speech processing, sound design, and composition. This essay traces how musical listening, like machine learning, involves timed commitments across ambiguous evidence."
category: "interdisciplinary"
tags:
  - "perception"
  - "signal-processing"
  - "composition"
  - "psychoacoustics"
  - "information-theory"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

## The Question

When does a sound system have enough evidence to act?

Recent extractions keep answering that question in different dialects. A streaming SpeechLLM must decide when enough audio has arrived to emit a translation token. A speech separation model must decide early enough which correlations belong to which speaker. A dataset curator must decide whether a clip is really single-source. An anomalous sound detector must decide whether a recording is strange without being handed the machine identity. A room impulse response generator must decide what kind of space is implied by sparse textual or visual evidence.

The shared concept is an **evidence horizon**: the point beyond which waiting for more signal stops being useful, or stops being possible.

## What The Sources Show

SR-CorrNet makes the horizon architectural. Its critique of late-split speech separation is that deferring speaker disentanglement until the final stage creates a bottleneck. By then, the model has already compressed the mixture through decisions that may have discarded the cues needed for source identity. Its separation-reconstruction strategy treats spatio-spectro-temporal correlations as the evidence from which filters can be estimated.

FSD50K-Solo makes the horizon curatorial. It tries to identify clean single-source sound events inside a corpus where many clips contain interference or overlapping sources. The system synthesizes controlled mixtures, then trains a classifier to filter multi-source samples. Here the horizon is not "what sound class is this?" but "has this event remained itself enough to be useful as training evidence?"

Streaming SpeechLLM makes the horizon temporal. The model learns not only what text to emit, but when it has heard enough audio to emit it. Translation quality is constrained by latency. The system lives in the gap between premature commitment and stale correctness.

Anomalous sound detection makes the horizon contextual. Standard benchmarks assume machine identity is known at test time, but real deployments may merge recordings from several machines. When that identity is withheld, performance degradation tracks implicit machine identification accuracy. The model's anomaly judgment depends on whether it can first decide what source it is judging.

Room impulse response generation makes the horizon spatial. A room is inferred from indirect evidence: images, language, learned audio priors, and listening tests. The generated RIR is not merely a reverb tail. It is a claim about which acoustic space would make the observed or requested sound plausible.

## The Musical Claim

Music constantly manipulates evidence horizons.

A listener decides that two notes belong to the same line before the line is complete. A performer chooses whether a pitch has settled before the resonance has decayed. A live electronics system commits to accompaniment before the full gesture is known. A room keeps supplying evidence after the source has stopped. A score may withhold identity long enough that timbre, harmony, and sourcehood become unstable together.

This suggests a practical distinction:

- **Early evidence** supports action: attack, onset synchrony, spatial location, rough F0, gesture direction.
- **Late evidence** supports confirmation: harmonic context, phrase role, room decay, source continuity, statistical regularity.
- **Missing evidence** becomes a compositional material: ambiguity, misattribution, false continuity, delayed recognition.

The evidence horizon is where those regimes trade places.

## A Tool Shape

A useful tool for composers would expose the evidence horizon as a time-varying curve. Given an audio stream, it could estimate when different musical facts become sufficiently supported:

- source continuity
- pitch center
- meter or pulse
- room identity
- timbral class
- anomaly against an established pattern
- readiness for real-time response

The output should not be a single label. It should be a set of commitments with timestamps and confidence: "source identity became stable after 180 ms," "pitch center remains ambiguous after 2.3 s," "room evidence dominates after the direct sound," "this event is anomalous only if source identity is fixed."

Compositionally, that curve becomes playable. A piece could force harmony to clarify before source identity, or source identity before pitch. It could make a live system answer at the earliest defensible moment, then let a slower analysis contradict it later. It could stage the difference between what the body can act on now and what the ear can prove afterward.

## Why It Matters

The old engineering question is "how accurate is the model?"

The richer musical question is "accurate by when, and with respect to which evidence?"

That question connects signal processing, machine learning, acoustics, and composition. It treats listening as a sequence of timed commitments rather than a passive receipt of completed objects. Sound does not arrive as meaning. It crosses horizons where enough structure has accumulated to justify action.

The compositional payoff is immediate: write not only events, but the moments at which those events become knowable.

---

_Sources: SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo single-source curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`), anomalous sound detection without machine identity (`j9741717c5306g0134yg8tgtb986qgdn`), infant cry cross-domain acoustic modeling (`j9735j1x9c8dxr97dax746vccd86q4tz`), and text-conditioned room impulse response generation (`j971jm21g3hsts9fxexgvbsrcd86qnqy`)._
