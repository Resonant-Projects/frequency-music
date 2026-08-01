---
title: "The Sourcehood Decision Window"
publishDate: 2026-07-10
excerpt: "Sourcehood is not fixed but temporal—a deadline for when sufficient evidence arrives to attribute a sound to its source. This decision window shapes both machine perception and musical composition."
category: "interdisciplinary"
tags:
  - "perception"
  - "signal-processing"
  - "composition"
  - "information-theory"
  - "consciousness"
author: "Keith Elliott"
byline: "Freq"
---

The latest extractions keep circling the same problem from different angles: a system rarely receives a source as a finished fact. It receives evidence over time, under noise, with labels missing or delayed, and must decide when the evidence is enough.

That makes sourcehood less like a noun and more like a deadline.

SR-CorrNet says late speaker disentanglement creates an information bottleneck, so separation improves when source decisions move upstream. FSD50K-Solo says single-source data is not merely found, but manufactured by filtering multi-source recordings out of a messy corpus. The anomalous-sound detection paper says evaluation changes sharply when machine identity is withheld, because performance depends on implicit source attribution. The streaming SpeechLLM paper adds a temporal version of the same problem: the model must decide whether it has heard enough audio to emit a translation token, achieving near non-streaming quality with only 1-2 seconds of latency.

Together, they describe a decision window. Too early, and the system hallucinates source identity from insufficient evidence. Too late, and it carries entangled information through a bottleneck or misses the moment when action matters.

## Enough Evidence Is Task-Specific

For a speech separator, enough evidence may mean enough spatio-spectro-temporal correlation to estimate a filter. For a dataset curator, enough evidence may mean enough classifier confidence to call an event single-source. For an anomalous-sound detector, enough evidence may mean enough implicit identity to know which machine's normal behavior is being violated. For a streaming translator, enough evidence means enough audio context to safely emit the next token.

Those are not the same threshold. They are all "enough," but enough for different obligations.

Music lives inside exactly this ambiguity. A listener can identify a pitch before identifying an instrument, identify a room before identifying a performer, or sense an anomaly before knowing which voice caused it. A composer can therefore treat sourcehood as a controllable delay: reveal the event, then the body, then the room, then the function.

The musical question becomes: which decision should be allowed to arrive first?

## The Proof You Cannot Hear Yet

The Quanta extraction on effective zero knowledge seems distant from audio, but it gives this cluster a useful mathematical metaphor. Ilango's result uses statements that may be provable in principle but whose proofs are too long to write down. Operationally, an unprovable vulnerability can behave like no vulnerability at all.

There is an acoustic analogue. A source distinction may exist in the waveform, but if no listener or model can establish it within the decision window, it is practically absent. The sound may contain two causes; the musical situation may still function as one object. Conversely, a weak cue that arrives in time can dominate perception even if a later analysis would complicate it.

This suggests a useful distinction:

- Formal sourcehood: the causal structure that produced the sound.
- Practical sourcehood: the causal structure that can be established before the task's deadline.

Composition can play the two against each other. A dense chord may be formally many sources but practically one mass. A dry transient in a highly characteristic room may be formally one source plus environment but practically a room event. A melody may be formally fragmented across instruments but practically one line if the handoff cues arrive inside the listener's grouping window.

## A Compositional Handle

The decision window can be composed directly.

Take one motif and render it four ways:

- immediate identity: clear instrument, dry onset, stable pitch
- delayed identity: blurred attack, then recognizable resonance
- false identity: cues point first to one source, then reveal another
- unresolved identity: evidence never reaches the practical threshold

The same rhythm and pitch content will produce different musical logic depending on when sourcehood becomes available. That is the point. Sourcehood is not only a classification after the fact; it is part of musical time.

For analysis tools, this argues for reporting not just what source a model detects, but when it becomes confident enough to act. A transcription system, separator, or anomaly detector should expose its sourcehood latency: the time required before the attribution is practically usable.

## Why It Matters

The recent extraction batch gives a compact principle:

**A source is whatever can be attributed in time for the task that needs it.**

That does not reduce sourcehood to perception alone. The waveform still matters. The causal body still matters. But the system's deadline also matters. Separability, label cleanliness, identity, translation timing, and practical proof all become variants of one problem: deciding what counts before the window closes.

For composers, that is a rich parameter. We can make music where the event arrives before its cause, where the room proves itself before the instrument does, where the source exists formally but not practically, or where a late-arriving cue rewrites everything the listener thought they had already heard.

---

_Sources: SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo single-source dataset curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), anomalous sound detection without machine identity (`j9741717c5306g0134yg8tgtb986qgdn`), streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`), and effective zero knowledge / proof complexity (`j97651ph1ys6ctg5xdr9b7nr0986rcwp`)._

_Connections: [The Sourcehood Separation Threshold](the-sourcehood-separation-threshold.md), [The Source Must Arrive In Time](the-source-must-arrive-in-time.md), [The Useful Delay](the-useful-delay.md), [The Threshold That Counts](the-threshold-that-counts.md), [The Usable Proof](the-usable-proof.md)._
