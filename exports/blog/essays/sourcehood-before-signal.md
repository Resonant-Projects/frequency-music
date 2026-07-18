---
title: "Sourcehood Before Signal"
publishDate: 2026-05-25
excerpt: "Speech separation, single-source dataset curation, and machine-identity evaluation all point to sourcehood as a first-class audio parameter. This essay proposes source-legibility as a compositional control layer."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "composition"
  - "perception"
  - "psychoacoustics"
  - "AI-music"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

Three recent extractions keep circling the same problem from different angles: modern audio systems do not merely need better spectrograms. They need an account of *sourcehood*.

In SR-CorrNet, the problem is explicit. Real speech separation has to resolve overlapping speakers, background noise, and reverberation at the same time. The extraction's most useful claim is architectural: if speaker disentanglement is postponed until the end of a time-frequency pipeline, the model creates an information bottleneck. The system improves by separating earlier, then reconstructing speaker-discriminative features through staged refinement.

FSD50K-Solo reaches the same terrain from the dataset side. A large sound-event corpus is less useful when many examples contain more than one source. The proposed curation pipeline synthesizes clean single-class events, mixes them in controlled ways, and trains a classifier to separate single-source from multi-source recordings. Here, sourcehood is not an output of analysis. It is a precondition for useful supervision.

The anomalous-sound-detection extraction adds a third pressure. Standard benchmarks often assume that the machine identity is known at test time. When recordings from multiple machines are merged and evaluated without identity labels, hidden robustness differences appear, and performance degradation tracks implicit machine-identification accuracy. The model was partly solving "which body made this sound?" even when the benchmark framed the task as "is this sound anomalous?"

The connection is simple, but it changes the compositional reading:

> A sound is not just a spectrum evolving over time. It is evidence for a body.

That body may be a speaker, a machine, an instrument, a room, or a synthetic event class. But once multiple bodies overlap, the analysis task changes. Pitch, timbre, noise, and reverberation are no longer independent features. They become clues in an attribution problem.

For composition, this suggests a useful control layer between orchestration and mixing: **source-legibility**. A passage can vary not only in density, brightness, register, or spatial width, but in how confidently a listener can assign each event to a sounding body.

Some practical axes:

- **Single-source clarity:** one event, one apparent cause. Useful for exposed gestures, motif statements, and timbral calibration.
- **Controlled mixture:** multiple bodies present, but with stable cues such as common onset, register separation, spatial separation, or harmonic identity.
- **Attribution stress:** bodies overlap enough that the listener can hear components but cannot confidently assign them.
- **Source collapse:** separate causes fuse into one apparent body.
- **Source hallucination:** processing or reverberation implies a body or space that is not physically present.

This is more than a mixing trick. It is a way to compose with the listener's inference engine. SR-CorrNet says separation suffers when disentanglement is delayed. FSD50K-Solo says training quality depends on knowing what counts as one source. The ASD paper says even anomaly detection secretly depends on identity. Together they point to a musical question:

What happens if a piece treats source identity as a first-class parameter?

A sketch:

1. Start with three sharply legible bodies: a bowed harmonic, a keyed transient, and a breath-noise tone.
2. Convolve each with a different short room impulse response so identity and space are aligned.
3. Gradually cross-assign the reverbs: the breath inherits the keyed body's room, the harmonic inherits the breath's room, the transient inherits the harmonic's decay.
4. Add spectral masking so the bodies remain locally audible but globally hard to attribute.
5. Resolve by making the processing chain itself the apparent source: the listener stops hearing three bodies in rooms and starts hearing one room-like instrument.

The technical literature is optimizing for robustness, classification, and separation. The compositional opportunity is almost the inverse: to make sourcehood controllable, then decide when to reveal it, when to blur it, and when to let the wrong body appear behind the sound.
