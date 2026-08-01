---
title: "The Source Is a Hypothesis"
publishDate: 2026-07-02
excerpt: "Source identity in audio is not a given fact but an active inference built under time pressure."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "composition"
  - "information-theory"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

The recent extraction cluster keeps circling the same problem from different rooms: a sound source is not simply given by the waveform. It is an inference that has to be made under pressure, with incomplete evidence, before the next musical or analytical decision becomes due.

FSD50K-Solo starts at the dataset boundary. Its premise is that "single-source" audio is valuable enough to curate explicitly, because ordinary open corpora contain overlapping events, background interference, and ambiguous labels. That means source identity is not a passive fact inherited from a file. It is a condition that must be tested, filtered, and certified before the downstream model can treat it as ground truth.

SR-CorrNet moves the same issue into the signal path. It criticizes late-split speech separation systems because they postpone speaker disentanglement until the final stage, creating an information bottleneck. Its alternative is telling: compute spatio-spectro-temporal correlations from the mixture early, then use those correlations to estimate recovery filters. In other words, identity is not discovered after analysis is complete. Identity is one of the things the analysis must actively build.

Streaming SpeechLLM adds the temporal constraint. The system does not wait for a complete utterance; it learns when enough audio context has arrived to emit translation tokens with only a short delay. That makes "enough evidence" a musical parameter, not just an engineering metric. A real-time system has to decide when the source, word, or gesture has become sufficiently specified to act on.

The anomalous sound detection extraction sharpens the point. Standard benchmarks assume machine identity is known at test time, but performance degrades when recordings from multiple machines are merged and identity labels are withheld. The degradation correlates with implicit machine-identification accuracy. The model was not just detecting anomalies; it was leaning on a hidden source hypothesis. Remove that hypothesis, and the task changes.

There is a mathematical echo in the effective-zero-knowledge extraction. Some facts may be true but operationally unavailable because the proof is too long, too late, or too expensive to use. Acoustic sourcehood has a similar practical boundary. A source may be physically present in the mixture, but if the listener, model, or performer cannot establish it before action is required, it behaves compositionally like an unresolved hypothesis rather than a stable object.

The compositional implication is strong: source identity can be scored as a variable. A piece could move through degrees of source confidence instead of treating instruments or samples as fixed entities. The composer can choose when a sound becomes attributable, when it remains fused with the texture, when identity arrives too late to matter, or when a hidden identity quietly controls another process.

One practical recipe:

1. Start with a mixture of two or three related timbres.
2. Track a few simple evidence streams: onset agreement, shared F0 motion, spectral centroid drift, spatial position, or amplitude envelope correlation.
3. Define a confidence threshold for when the system is allowed to name a source.
4. Map sub-threshold evidence to texture, near-threshold evidence to unstable orchestration, and above-threshold evidence to explicit melodic or rhythmic agency.
5. Change the threshold over time so the same acoustic material alternates between "object," "background," and "unproven claim."

The aha is that separation, curation, anomaly detection, and streaming translation are all negotiating the same contract: when does evidence become identity? For music, that contract is playable. A source can be less like a noun and more like a cadence: something the sound earns over time.
