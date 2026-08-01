---
title: "The Source Before the Sound"
publishDate: 2026-05-22
excerpt: "Before systems can understand sound, they must decide what counts as a source."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "composition"
  - "AI-music"
  - "acoustics"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

Three recent audio papers make the same argument from different directions: before a system can understand sound, it has to decide what counts as a source.

That sounds almost too obvious. A listener hears a voice, a violin, a room tone, a cough behind the melody. But for a machine, sourcehood is not given. It is an inference made from spectral fragments, temporal continuity, spatial hints, learned priors, and task pressure. The decision can happen early or late. It can be explicit or hidden. It can be trained from clean examples or recovered from mixtures. But it cannot be skipped.

The speech-separation paper gives the strongest engineering version of the problem. It criticizes late-split time-frequency architectures, where a model waits until the final stage to disentangle speakers. The authors' claim is practical: deferring speaker separation creates an information bottleneck under noise, reverberation, and overlap. Their alternative is to separate and reconstruct progressively, using spatio-spectro-temporal correlations as features for estimating filters [S1].

That is a useful compositional idea. In dense music, a source is not merely an isolated track. It is a pattern of correlations: shared onset, harmonic coherence, spatial placement, envelope shape, recurring spectral behavior. A bass partial, a vocal consonant, and a room reflection can occupy the same time-frequency neighborhood, but they do not necessarily belong to the same musical agent. Sourcehood is the rule that says which fragments should be heard together.

The dataset-curation paper starts one level earlier. It argues that audio machine learning lacks large, strongly labeled, single-source sound-event data, because open corpora contain many samples with background interference or overlapping events. Their solution is beautifully circular: synthesize clean single-class sounds with a diffusion model, create controlled mixtures, then train a classifier to filter real samples into single-source and multi-source cases [S2].

Here the source is not something found in the world. It is something manufactured as a training condition. The clean event becomes an acoustic axiom: this is what one source is allowed to mean. Once that axiom exists, mixtures can be judged against it.

The streaming SpeechLLM paper adds a third constraint: time. A real streaming translator cannot wait for the whole utterance before deciding what to say. It must learn both what token to emit and when enough audio context has arrived. The source decision is now coupled to a latency budget. Too early, and the system guesses. Too late, and it fails as a live instrument [S3].

For music, this triangulates a deep design problem:

1. **Separation:** Which fragments belong to which sounding agent?
2. **Curation:** What examples teach the system what a single agent is?
3. **Timing:** When is there enough evidence to act?

Most composition systems treat these as separate concerns. Mixing handles separation. Sampling handles curation. Performance handles timing. But the listener experiences them as one fused perceptual event. A note has an identity, a context, and a moment of commitment.

This suggests a studio practice: compose the source decision itself.

Start with a small set of clean events: one bowed tone, one breath, one pluck, one scrape. Treat them as single-source axioms. Then build controlled mixtures where the evidence for each source becomes ambiguous: shared attacks, crossed pitch contours, reverberant smearing, spectral masking, doubled envelopes. Instead of asking whether the mix is clear, ask when the listener can no longer assign fragments to agents.

Then make that assignment unstable on purpose.

A phrase can begin as a single source and split into two. A chord can enter as a fused block and reveal that its upper partials belong to a hidden voice. A reverberant tail can stop behaving like space and start behaving like an instrument. A live system can delay its response until enough acoustic evidence accumulates, making latency part of the musical grammar rather than a technical flaw.

The connection to source separation is direct but not literal. The goal is not just cleaner stems. The goal is control over perceptual binding. A composer can decide whether the audience hears one object, many objects, or a field that keeps changing its mind.

There is also a warning here. If sourcehood is deferred too long, later intelligence may inherit a damaged representation. If training data defines "single source" too narrowly, the system may reject the very textures musicians care about. If a real-time model commits too early, it may flatten ambiguity into premature labels. The source decision is not a housekeeping step. It is part of the music's epistemology.

The useful phrase is **source commitment**: the moment when a system, listener, or composition has enough evidence to treat an acoustic pattern as one thing.

A conventional mix hides source commitment by making it easy. A more interesting piece can expose it. Let the ear hear the evidence gather. Let a voice become separable only after its rhythm repeats. Let a room become an instrument only after its decay answers in time. Let a translation, accompaniment, or processing layer wait until the sound has declared enough of itself.

The source comes before the sound, not chronologically, but structurally. What we hear depends on what we have decided is there.

## Sources

- [S1] "Asymmetric Encoder-Decoder Based on Time-Frequency Correlation for Speech Separation" — arXiv:2603.29097.
- [S2] "FSD50K-Solo: Automated Curation of Single-Source Sound Events" — arXiv:2605.13931.
- [S3] "Streaming Speech-to-Text Translation with a SpeechLLM" — arXiv:2605.14766.
