---
title: "The Sourcehood Threshold"
publishDate: 2026-07-03
excerpt: "Sourcehood is a compositional threshold—the point where listeners and models decide if something is one sound or many. Machine learning reveals this as a musical control parameter between isolation and fusion."
category: "interdisciplinary"
tags:
  - "composition"
  - "signal-processing"
  - "perception"
  - "AI-music"
  - "acoustics"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

The newest extraction cluster points at a useful compositional distinction: a sound source is not just an object in the world. In contemporary audio systems, sourcehood is an operational threshold. A model decides that something has enough coherence to be treated as one thing, separated from the mixture, labeled, enhanced, translated, or synthesized.

That threshold appears from three directions at once. FSD50K-Solo treats single-source audio as a data quality problem: the training set becomes more valuable when each recording can be trusted to contain one dominant event rather than a blurred acoustic scene. SR-CorrNet approaches the same boundary from inside the mixture, using spatio-spectro-temporal correlations to estimate filters that recover target speakers under noise and reverberation. Streaming speech translation adds the time axis: the system must decide when the incoming signal contains enough context to emit language without waiting for the whole utterance.

These are usually framed as engineering problems, but together they describe a musical control parameter. A composer can vary how quickly a listener, model, or performer is allowed to assign source identity. At one end is isolated sourcehood: clean events, stable timbres, obvious onsets, sparse texture. At the other is deferred sourcehood: overlapping bodies, shared reverberation, ambiguous attacks, spectral fusion, and partial evidence. Between them is the threshold where the ear keeps asking, "is this one thing or many?"

The connection to orchestration is immediate. Doubling instruments at the same pitch can fuse them into a composite source; separating them by register, onset, articulation, or spatial position can split them apart. Reverberation lowers the certainty of source boundaries by smearing timing and location cues. Spectral similarity can either bind parts together or make separation harder. The machine-learning vocabulary gives these old musical intuitions a sharper handle: sourcehood depends on correlations across frequency, time, space, and learned prior categories.

This suggests a practical sketch for a piece or tool. Build a "sourcehood threshold" control that moves a texture through four states: solo event, clustered event, separable mixture, and unresolved field. The control need not be symbolic. It could manipulate onset alignment, spatial spread, spectral overlap, noise floor, and reverberation time. A listener would not hear a parameter named sourcehood; they would hear identity becoming easier or harder to prove.

The important point is that source separation and dataset curation are not merely downstream analysis tasks. They reveal a compositional primitive. Music often happens at the boundary where evidence for source identity is present but incomplete.

## Source Thread

- FSD50K-Solo extraction: single-source audio as a data curation target.
- SR-CorrNet extraction: separation as correlation-to-filter recovery under noise and reverberation.
- Streaming SpeechLLM extraction: low-latency emission as a decision about sufficient temporal evidence.

## Graph Concepts

- sourcehood threshold
- single-source audio
- acoustic source separation
- spectro-temporal correlation
- streaming inference
- reverberation
