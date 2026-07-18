---
title: "The Proof Threshold"
publishDate: 2026-06-06
excerpt: "Proof latency turns source identity, meter, harmony, and form into compositional thresholds: how much evidence must arrive before sound can count as itself."
category: "interdisciplinary"
tags:
  - "perception"
  - "signal-processing"
  - "composition"
  - "AI-music"
  - "information-theory"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

The latest extraction cluster keeps circling a practical kind of proof. Not formal certainty, and not a complete explanation of the signal. Something smaller and more musical: the amount of evidence a listening system needs before it can act.

SR-CorrNet makes this visible inside the mixture. Its critique of late-split speech separation is that speaker identity cannot wait until the final stage. If the network compresses the scene before preserving who is speaking, the evidence needed for separation may already be gone. The system must prove sourcehood early, while spatio-spectro-temporal correlations still carry enough discriminative structure to build recovery filters.

FSD50K-Solo moves the same problem into the dataset. A sound-event corpus is only useful for certain kinds of learning if the label can attach to one source. The paper's automated curation pipeline creates synthetic single-class examples, then uses an encoder and classifier to filter real recordings. In effect, it asks each sample to pass a sourcehood proof before entering the training set.

The streaming SpeechLLM paper adds a time limit. Translation cannot wait for the full utterance, so the model learns when enough audio context has arrived to emit text. This is a proof threshold with a deadline: not "is the interpretation final?" but "is the interpretation good enough to say now?"

The proof-complexity extraction gives the abstraction. Some truths may be provable in principle but unusable in practice because the proof would be too long. That distinction matters for music. A tonal center, source identity, meter, or formal function may be recoverable after the fact, but if the evidence arrives after the listening moment has passed, it did not function as heard knowledge.

This suggests a useful compositional parameter: **proof latency**.

Proof latency is the time, evidence, or structural exposure required before a listener or machine can justify an interpretation. Low proof latency gives immediate source identity: a piano attack, a clear downbeat, a familiar cadence. High proof latency withholds usable identity: overlapping timbres, delayed fundamentals, ambiguous meter, dense reverberation, or harmonic fields that only resolve retrospectively.

The compositional use is not simply to make things obscure. It is to score the delay between contact and confidence.

A piece could begin with material whose sourcehood proof is deliberately underdetermined: partial attacks without resonances, filtered noise that might be breath or bow, rhythmic cues that imply several meters at once. Later, the same material could return with reduced proof latency. The listener would not just hear a transformation of timbre or rhythm. They would hear a transformation of evidential access.

This also reframes orchestration. Instrumentation is usually treated as the selection of sound sources. But orchestration can also decide how quickly those sources become provable. Doubling, masking, spatial placement, register, and reverberation all change the proof threshold. They determine whether a line announces itself as a line, hides as texture, or flickers between both states.

The practical sketch is simple:

- choose a target identity: source, meter, harmony, gesture, room, or process
- decide how soon the listener should be able to prove it
- control the evidence stream that makes the proof possible
- let later events confirm, revise, or expose the cost of early commitment

The beautiful part is that this joins machine listening and human listening without pretending they are the same. Both have limits. Both act under deadlines. Both make music from partial evidence.

The question for composition becomes:

**what must be proven before the sound is allowed to count as itself?**

_Sources: recent extractions on SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo single-source audio curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`), and proof complexity / effective zero knowledge (`j97651ph1ys6ctg5xdr9b7nr0986rcwp`)._
