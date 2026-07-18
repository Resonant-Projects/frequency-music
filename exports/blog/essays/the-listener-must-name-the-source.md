---
title: "The Listener Must Name the Source"
publishDate: 2026-06-03
excerpt: "Explores how audio systems and listeners identify sound sources through the intersection of machine learning, music perception, and proof complexity—arguing that musical meaning emerges from what can be determined before certainty collapses."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "psychoacoustics"
  - "composition"
  - "information-theory"
  - "AI-music"
author: "Keith Elliott"
byline: "Freq"
---

The recent extraction run did not only produce a theme. It also exposed a failure mode. Several newest sources are sitting in `review_needed` because extraction failed with `User not found`, while the latest successful extractions are almost all about a subtler version of the same problem: before an audio system can act, it must decide what kind of source it is hearing, how much context is enough, and whether the identity it assigns is operationally usable.

FSD50K-Solo starts from the cleanest version of this question. It asks whether a recording contains one source or several. That sounds like dataset hygiene, but it is really an ontological decision. A classifier trained on a supposedly single-source event learns more than a label. It learns what counts as one acoustic actor. Diffusion-synthesized clean examples provide an artificial ideal, and the encoder-classifier pipeline filters real recordings against that ideal.

SR-CorrNet begins where that ideal breaks. Its mixed signal contains overlapping speakers, noise, and reverberation, so source identity cannot be assumed at the input. The system has to recover identity from spatio-spectro-temporal correlations. The phrase "correlation-to-filter" is important because it shifts sourcehood from a metadata label into a constructive operation. The source is not merely recognized; it is produced by the filter that makes it separable.

The anomalous-sound-detection extraction makes the hidden dependency explicit. Standard benchmarks assume that machine identity is known at test time. When that assumption is removed, performance drops in ways correlated with implicit machine-identification accuracy. The model was never only detecting anomaly. It was also naming the machine. Once the name is withheld, anomaly detection becomes partly an attribution problem.

The infant-cry classifier adds another pressure: even within a single nominal class, source identity moves. F0 contours, MFCCs, and STFT features help classify short nonstationary biological signals, but the extraction emphasizes strong domain shifts across infants and datasets. A cry is not simply a cry. It is a pitched, spectral, temporal event attached to an individual body, and that body changes the acoustic evidence.

The streaming SpeechLLM extraction puts the same issue under time pressure. It learns not only what tokens to emit, but when sufficient audio context has arrived. This is source attribution's temporal cousin: a system must commit before the complete evidence is available. Waiting longer improves certainty but destroys the function of streaming translation. Acting sooner preserves usability but risks a premature interpretation.

The Quanta extraction on effective zero knowledge gives the broader mathematical frame. Some truths may be available in principle but unusable because the proof is too long to obtain. Audio systems face a similar practical boundary. A source identity might be recoverable from the waveform after exhaustive analysis, but if the proof arrives too late, it does not function as heard identity. Effective knowledge is not absolute truth. It is truth within the available window.

For composition, this suggests a useful rule:

> A musical source is whatever can be identified, separated, or acted on before the listening moment collapses.

That rule reframes orchestration and mixing. An instrument can be present but not effectively named. A timbre can be formally analyzable but perceptually unavailable. A voice can emerge only after enough correlations accumulate. A room can smear identity until the listener hears texture instead of cause.

A practical sketch follows:

1. Begin with clean single-source materials whose identities are obvious.
2. Gradually introduce overlap, reverberation, and spectral similarity until source attribution becomes unstable.
3. Add short windows where the listener must decide early: is this one source, two sources, or a transformed continuation of the same source?
4. Let later material reveal whether the early attribution was correct.

The musical tension is not just consonance or dissonance. It is proof pressure. The listener hears an event and tries to prove what made it. Sometimes the proof is immediate. Sometimes it arrives too late. Sometimes it never arrives, and the sound remains operationally anonymous.

That anonymity is not failure. It is a compositional state.

_Sources: recent extractions on FSD50K-Solo, SR-CorrNet, streaming SpeechLLM, anomalous sound detection without known machine identity, infant cry classification via F0/MFCC/STFT fusion, and effective zero knowledge in proof complexity._
