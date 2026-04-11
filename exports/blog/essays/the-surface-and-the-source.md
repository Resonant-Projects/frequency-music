---
title: "The Surface and the Source: Why Timbre Is Easier — and Harder — Than We Think"
publishDate: 2026-03-01
excerpt: "Timbre perception maps cleanly to simple acoustic parameters, yet producing timbre requires understanding the hidden causal chain. Exploring the gap between what sounds like and what makes it."
category: "physics-of-sound"
tags:
  - "signal-processing"
  - "acoustics"
  - "perception"
  - "composition"
  - "psychoacoustics"
  - "wave-physics"
author: "Keith Elliott"
byline: "Freq"
---

## Two Levels of the Same Thing

Two recent papers address the same phenomenon — timbre — from opposite directions:

1. A compact set of interpretable acoustic parameters — spectral centroid, harmonics-to-noise ratio, spectral flux — can match or outperform deep learning embeddings at detecting voice timbre attributes. (This is well-established DSP; the 2026 paper's contribution is the _specific comparison_ against modern neural methods, not the acoustic analysis itself.)

2. The acoustic speech signal is "the most accessible but least causally informative" product of sound production. To understand what's actually happening — which muscles contracted, what neural commands were sent — you need simultaneous MRI, EEG, and EMG.

These aren't contradictory; they're different levels of description. The first captures what timbre _sounds like_ (surface); the second reveals what timbre _comes from_ (source). The gap between them is where the interesting compositional questions live.

## What the Timbre Paper Shows

A 2026 preprint on voice timbre attribute detection (vTAD) makes a striking empirical claim. The researchers constructed a compact, training-free parameter set — standard acoustic measures like spectral centroid, harmonics-to-noise ratio, shimmer, jitter, and their temporal dynamics — and tested it against deep neural network embeddings on the task of comparing timbre qualities across utterances.

The result: the interpretable parameters outperformed conventional cepstral features _and_ supervised DNN embeddings, approaching the accuracy of state-of-the-art self-supervised models. No gradient descent. No millions of parameters. Just physics you can write on a napkin.

The key insight was temporal dynamics. Static snapshots of acoustic parameters performed modestly, but capturing _how_ those parameters change over time — the trajectory of spectral centroid, the fluctuation pattern of harmonics-to-noise ratio — brought performance to near-neural-network levels. Timbre, it turns out, isn't just a spectral snapshot. It's a spectral _story_.

This matters because it means timbre perception, at least at the attribute level, isn't a deep computational mystery. It's grounded in physical measurements that have clear acoustic interpretations. You can point to what makes a voice "bright" or "rough" or "breathy" in terms a physicist would recognize. The ear isn't doing anything magical here — it's tracking features that are right there in the signal, waiting to be measured.

## What the Speech Production Paper Shows

Now consider the other side. A separate 2026 preprint presents the first simultaneous capture of real-time MRI (articulatory movements), EEG (brain signals), and surface EMG (muscle activations) during speech production. The motivation is precisely that the acoustic signal alone is insufficient:

> "The acoustic speech signal is the most accessible product of the speech production act, [but] it does not directly reveal its causal neurophysiological substrates."

Speech production spans at least four layers: neural planning, motor control, muscle activation, and articulatory kinematics. The acoustic signal emerges from the _end_ of this chain. By the time air vibrates in recognizable patterns, the causal history — the intention, the motor program, the precise muscular coordination — is largely invisible.

This is true of all sound production, not just speech. When a violinist produces a particular timbre, that timbre emerges from the interaction of bow pressure, bow speed, contact point, string properties, bridge response, body resonance, and room acoustics. The waveform reaching your ear is a many-to-one projection: vastly different causal chains can produce similar acoustic outputs. The surface is accessible; the source is deep.

## The Resolution: Two Kinds of "Understanding"

The apparent contradiction dissolves when you recognize that the two papers are answering different questions.

The timbre paper asks: **Can we classify what a sound _is like_?** And the answer is yes, surprisingly well, with simple tools. Perceptual timbre — brightness, roughness, breathiness — maps cleanly onto measurable acoustic properties. The ear's timbre judgment is largely a readout of spectral shape, harmonicity, and temporal dynamics. You don't need to know what caused the sound to describe what it sounds like.

The speech production paper asks: **Can we understand what _produced_ a sound?** And the answer is: not from the sound alone. The acoustic signal is a lossy summary of a rich causal process. Reconstructing the source from the surface is an inverse problem, and like most inverse problems, it's ill-posed.

This distinction — surface description vs. source reconstruction — runs through all of acoustics and, by extension, all of music. And it has profound implications for how we build tools and think about composition.

## Implications for Music

### 1. Timbre Analysis Is More Tractable Than We Feared

If compact acoustic parameters can capture perceptual timbre attributes in speech, they can likely do the same for musical instruments and ensembles. The transfer isn't automatic — instrumental timbre has different spectral structures than voice — but the principle holds: interpretable, physics-grounded features should get you most of the way.

This is liberating for tool-builders. You don't need a massive neural network to build a useful timbre analyzer. A well-chosen set of acoustic parameters — spectral centroid, spectral flux, spectral rolloff, harmonics-to-noise ratio, attack time, and their temporal trajectories — gives you a transparent, explainable system. Every dimension has a physical interpretation. Every comparison can be grounded in "this sound has more energy above 3kHz" rather than "this embedding is 0.3 units away in a 512-dimensional space we can't interpret."

### 2. Timbre _Synthesis_ Remains Hard

But the ease of timbre _analysis_ doesn't extend to timbre _synthesis_. Knowing that a sound is bright (high spectral centroid) doesn't tell you how to produce brightness. The same spectral centroid value can arise from a trumpet, a distorted guitar, a synthesizer with a resonant filter, or a soprano singing [i]. The surface-to-source mapping is one-to-many.

This is why physical modeling synthesis — where you simulate the actual causal chain (string vibration, body resonance, air column) — remains the gold standard for realistic timbre. Spectral analysis tells you _where you are_ in timbre space. Physical modeling tells you _how to get there_.

### 3. Temporal Dynamics Are the Hidden Dimension

The timbre paper's finding that temporal dynamics are "crucial" connects to a broader pattern in music perception research. Attack transients, vibrato rate, spectral flux — these temporal features are often _more_ perceptually salient than static spectral properties.

This explains the old synthesizer truism: "the first 50 milliseconds matter more than the next 5 seconds." The attack transient — a burst of temporal information about _how_ the sound was initiated — carries disproportionate perceptual weight. In the language of the speech production paper, attack transients are the closest the acoustic signal gets to revealing its causal history. They're a brief, noisy window into the source.

### 4. Composition Operates at Both Levels

Composers work with both surface and source. When you orchestrate — choosing a flute instead of a clarinet for a melodic line — you're working at the surface level: selecting a timbre for its perceptual qualities. But when you write for a specific performer, when you specify a bowing technique or a breath articulation, you're reaching down into the source level, manipulating the causal chain itself.

The most sophisticated composition happens when these levels interact. Spectralist composers like Grisey and Murail worked explicitly at the intersection: analyzing the spectral surface of natural sounds, then reconstructing those surfaces through the causal mechanisms of orchestral instruments. The surface informed the source, which generated a new surface. It's a dialogue between the two levels.

## The Broader Pattern

This surface/source duality shows up everywhere in our research:

- **Tuning systems:** The _surface_ is an interval ratio (3:2, a perfect fifth). The _source_ is the physics of coupled oscillators, string lengths, air columns. Same ratio, vastly different physical realizations.

- **Rhythm:** The _surface_ is a pattern of onsets in time. The _source_ is the coordination of breath, muscle, intention, groove. Why two drummers playing "the same" rhythm sound completely different.

- **Harmony:** The _surface_ is a set of simultaneous frequencies. The _source_ is the voice-leading, the preparation, the resolution — the compositional logic that led to those frequencies appearing together.

In each case, the surface is analyzable with simple tools. The source is deep, contextual, and often irreducible to the parameters that describe the surface. And in each case, the most interesting music happens at the boundary — where composers work deliberately between levels, exploiting the gap between what a sound _is_ and what _made_ it.

## An Open Question

The voice timbre paper raises an intriguing possibility for future research: if temporal dynamics of simple acoustic parameters are sufficient for timbre classification, could the _same_ parameter trajectories serve as a compositional control space?

Imagine specifying a timbre not as "clarinet" or "bright" but as a trajectory through a space of spectral centroid × harmonics-to-noise ratio × spectral flux, evolving over time. You'd be composing in the surface space directly, leaving the source (which instrument, which technique, which synthesis method) as an implementation detail. This is essentially what some spectral music already does, but the timbre paper suggests the parameter space could be smaller and more interpretable than we thought.

The gap between surface and source isn't a problem to solve. It's a space to compose in.

---

_Sources: Voice timbre attribute detection (vTAD) preprint, 2026; Simultaneous MRI/EEG/EMG speech production framework, 2026. Both arXiv preprints, claims at preprint evidence level._
