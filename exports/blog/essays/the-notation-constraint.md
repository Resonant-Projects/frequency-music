---
title: "The Notation Constraint: How Representation Shapes Musical Thought"
publishDate: 2026-03-25
excerpt: "Musical notation isn't neutral transcription-it's a cognitive technology that shapes what composers can think."
category: "interdisciplinary"
tags:
  - "composition"
  - "mathematical-music-theory"
  - "perception"
  - "signal-processing"
  - "information-theory"
  - "AI-music"
author: "Keith Elliott"
byline: "Freq"
---

## The Marks That Think For You

Historian David Dunning argues that mathematics is not a purely abstract activity floating free of its medium. The physical act of writing — chalk on blackboards, ink on paper, fingers on keyboards — shapes what mathematicians can think. Notation isn't a transparent window onto pre-existing ideas; it's a cognitive technology that enables certain thoughts and forecloses others. You don't first have a mathematical insight and then write it down. The writing _is_ part of the thinking.

This claim, explored in a recent Quanta Magazine piece on how writing changes mathematical thought, sounds radical until you consider its musical equivalent — at which point it becomes obvious. Every working musician already knows this. You don't compose the same music at a piano that you compose with a guitar, with a pencil, with a DAW, with a modular synthesizer. The instrument — including notation as an instrument — is a co-author.

But "the tool shapes the output" is too vague to be useful. The interesting question is: _how exactly_ does a representation system constrain and enable thought? And the answer, it turns out, connects mathematical notation, Western staff notation, and neural audio codecs through a single principle: **every representation system is a factorization of its domain, and the choice of factors determines what operations are natural.**

---

## Three Factorizations of Sound

Consider three ways to represent a C major chord:

**Staff notation** factorizes music into pitch (vertical position), time (horizontal position), and performance instruction (dynamics, articulation, expression marks). This factorization makes certain operations trivial: transposition is a vertical shift; inversion is a rearrangement of vertical positions; retrograde is a horizontal mirror. These operations are literally visible on the page. But other operations are invisible or impossible: the overtone content of the chord, the beating between nearly-coincident partials, the way the third partial of the C reinforces the fundamental of the G — none of this exists in staff notation. You can't think spectrally in a system that doesn't represent spectra.

**A spectrogram** factorizes the same chord into frequency (vertical), time (horizontal), and amplitude (color/brightness). Now overtone structure is visible: you can see the harmonic series of each note, the energy distribution across partials, the slight inharmonicity of a real piano string. Spectral operations are natural — filtering, convolution, spectral morphing. But harmonic function is invisible. The spectrogram cannot tell you this is a C major chord, that it's functioning as a tonic, that it resolves a preceding dominant. The information is there physically but not representationally.

**FACodec**, the factorized audio codec used in DiFlowDubber, decomposes sound into three explicit token streams: prosody, content, and acoustic characteristics. Each stream gets its own set of Residual Vector Quantization codebooks. This factorization makes it trivial to change _how_ something is said (prosody) without changing _what_ is said (content) without changing _who_ says it (acoustic/speaker identity). Operations that mix these factors — like transferring one speaker's prosody to another's voice — are natural compositions of the separate streams.

Each representation makes certain operations cheap and others expensive. Staff notation makes transposition cheap and spectral manipulation impossible. Spectrograms make filtering cheap and harmonic analysis expensive. FACodec makes attribute transfer cheap and fine-grained waveform editing impossible.

The notation _is_ the thought-space.

---

## Why OmniCodec Proves Dunning Right

The architectural insight behind OmniCodec — the dual-codebook design discussed in "The Semantic Split" — is precisely Dunning's claim applied to machine learning. OmniCodec separates its internal representation into semantic codebooks (what the sound _means_) and acoustic codebooks (what the sound _sounds like_). And the core finding is that a single unified codebook, no matter how large, cannot develop both semantic understanding and acoustic fidelity simultaneously.

This isn't a limitation of training data or model capacity. It's a _notational_ constraint. A unified codebook is a single factorization of the audio domain, and that factorization must choose: optimize for reconstruction (acoustic fidelity) or optimize for downstream utility (semantic richness). You can't do both because they require different factorizations of the same information.

RVQGAN failed precisely this way. Its elegant unified latent space achieved high compression ratios while producing the worst perceptual quality in systematic evaluation. The notation — a single vector-quantized codebook — couldn't simultaneously represent "what this sounds like" and "what this means." It's a mathematical notation system that can express topology but not arithmetic: internally consistent, but blind to an entire dimension of its domain.

The parallel to Dunning's argument is exact. A mathematician working in algebraic notation can think algebraically but not geometrically. A mathematician working in diagrammatic notation can think geometrically but not algebraically. The notation enables and constrains in the same gesture. OmniCodec's solution — use _two_ notation systems, one semantic and one acoustic — is the same solution that working mathematicians use: switch representations depending on what operation you need to perform.

---

## Western Staff Notation as a Tuning System for Thought

This framework reframes a familiar debate. Western staff notation has been criticized for centuries — by Busoni, by experimental composers, by ethnomusicologists — as limiting. The standard objections are well-known: it privileges discrete pitches over continuous pitch space, it assumes twelve equal divisions of the octave (or at least twelve pitch classes), it struggles with complex rhythms common in West African and South Asian traditions, and it has no vocabulary for timbral specification.

These are real limitations. But the notation-as-factorization framework reveals them as _consequences of a particular factorization_, not as arbitrary failures. Staff notation factorizes music into pitch-class × octave × duration × dynamics. This factorization makes counterpoint visible (you can literally see voice-leading on the page), harmonic analysis natural (vertical slices reveal chord identity), and formal structure traceable (repeat signs, da capo, recapitulation). Western art music's characteristic achievements — complex counterpoint, rich harmonic language, large-scale formal architecture — are precisely the operations that this factorization makes cheap.

Conversely, the musical traditions that staff notation represents poorly are those whose primary operations involve factors that staff notation doesn't separate. Hindustani raga performance operates on a factorization closer to: melodic contour × ornamental grammar × temporal framework (tala) × mood (rasa). The ornamental grammar — the specific gamakas, meends, and murkis that define a raga's character — is the _content_, not decoration. Staff notation treats it as decoration because its factorization puts ornament in the residual category of "performance practice."

The notation isn't wrong. It's a different factorization, optimized for different operations. And the music that develops within each notation system is, in Dunning's terms, co-authored by the representation.

---

## Covo-Audio and the Emergence of Musical Understanding

The most striking recent evidence for notation-as-cognition comes from Covo-Audio, a 7-billion-parameter audio language model that achieved the highest music understanding score (76.05%) among all tested systems on the MMAU benchmark — higher than GPT-4o (56.29%), higher than Gemini 2.5 Pro (68.26%).

Covo-Audio's key architectural choice is _hierarchical tri-modal interleaving_: it processes continuous audio features, discrete speech tokens, and text simultaneously at both phrase-level and sentence-level. This is three factorizations running in parallel, each contributing different operations. The continuous audio stream captures spectral detail (acoustic knowledge). The discrete tokens capture categorical structure (semantic knowledge). The text captures symbolic relationships (linguistic/theoretical knowledge).

The result is a system that can "think" about music in multiple representations simultaneously — and its music understanding dramatically exceeds systems that commit to a single representation. GPT-4o, processing audio through a text-mediated bottleneck, loses the information that lives in the continuous and discrete streams. The Thinker-Talker architecture (used by Qwen2.5-Omni, achieving only 65.90% on music) forces all reasoning through text, discarding the non-textual factorizations entirely.

Covo-Audio's music understanding isn't just "better training" or "more data." It's a _representational_ advantage. The system has access to more factorizations of the audio domain, and each factorization makes different operations natural. Musical understanding requires operations across multiple factors — you need spectral detail _and_ categorical structure _and_ symbolic relationships to understand why a deceptive cadence works.

---

## The Compositional Implication

If notation constrains thought, then choosing a notation is a compositional decision — arguably the _first_ compositional decision, made before a single note is written. The medium is not just the message; it's the _grammar_ of possible messages.

This suggests a practice: **deliberate notation-switching as a compositional technique.**

Start a piece as a spectrogram — think in terms of frequency bands, energy distributions, spectral envelopes. Then translate to staff notation — now think in terms of voice-leading, harmonic rhythm, formal proportion. Then translate to a lead sheet — now think in terms of chord function, melodic contour, groove. Each translation is lossy (every re-factorization discards information that the previous factorization made explicit), and each loss reveals assumptions that had been invisible.

The piece that emerges from this process will carry traces of all three thought-spaces. It will have spectral awareness that pure staff-notation composition lacks, harmonic logic that pure spectral composition lacks, and functional clarity that pure graphic-score composition lacks.

This is not a new idea — composers from Varèse to Saariaho have worked across representations. But the notation-as-factorization framework makes the logic explicit. You're not just "using different tools." You're performing different factorizations of the musical domain, and the compositional richness comes from the _interference patterns_ between factorizations — the places where one representation reveals structure that another conceals.

---

## The Deeper Pattern

Dunning's claim about mathematics, OmniCodec's dual-codebook architecture, FACodec's tri-stream factorization, Covo-Audio's tri-modal interleaving, and the long history of music notation debates are all instances of the same principle:

**Representation is not neutral. Every notation system is a theory of its domain — a hypothesis about which factors matter and which operations should be cheap. The thoughts you can have are bounded by the representations you work in. To think new thoughts, build new notations.**

This is why the history of music and the history of music notation are inseparable. Staff notation didn't just _record_ the development of tonal harmony; it _enabled_ it by making certain harmonic operations visible and manipulable. Spectral analysis didn't just _describe_ timbre; it enabled spectral composition by making timbral operations visible and manipulable. And the factorized representations emerging from neural audio research aren't just _engineering choices_; they're new notation systems that will enable new kinds of musical thought we can't yet predict.

The marks think for you. Choose them carefully.

---

_Connecting: Dunning (2024) on mathematical notation, OmniCodec semantic-acoustic factorization, FACodec tri-stream decomposition, Covo-Audio tri-modal interleaving, Western staff notation debates_

_Previous essays: "The Semantic Split" (acoustic vs. semantic information), "The Fidelity Trade" (codec-tuning analogies)_
