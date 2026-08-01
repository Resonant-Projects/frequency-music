---
title: "The Minimum Proof of Sound"
publishDate: 2026-05-26
excerpt: "Music works through minimum proof: composers calibrate how much evidence listeners need to bind events, predict structure, and trust processes while maintaining perceptual aliveness."
category: "interdisciplinary"
tags:
  - "perception"
  - "information-theory"
  - "composition"
  - "signal-processing"
  - "psychoacoustics"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The Question

How much of a sound must be revealed before a listener can act on it?

Recent extractions point at the same pressure from very different domains. A streaming SpeechLLM learns when it has heard enough audio to emit a translation token. SR-CorrNet estimates filters from spatio-spectro-temporal correlations so separated speakers can be recovered from mixtures. FSD50K-Solo curates single-source events by building controlled mixtures and asking whether a classifier can detect contamination. Quanta's account of zero-knowledge proofs adds an unexpected mathematical mirror: a proof can convince a verifier without revealing the underlying secret.

The shared shape is not classification. It is **minimum sufficient evidence**.

## The Evidence

### Streaming Translation Is an Evidence Gate

The SpeechLLM extraction is explicit: a real streaming system cannot wait for a complete utterance, and fixed-interval token emission is too crude. The model must learn whether the audio so far is enough to support the next output token.

That is not just a latency optimization. It changes the unit of listening. The system treats each partial window as a claim with an evidence threshold. Too early, and the translation hallucinates structure the signal has not licensed. Too late, and the listener loses the temporal usefulness of speech.

Music has the same problem. A cadence, entrance, timbral change, or metric turn is only useful while it can still shape expectation. The listener does not need the whole future phrase. They need enough evidence, soon enough, to commit attention.

### Separation Is a Proof From Correlation

SR-CorrNet frames speech separation as a correlation-to-filter problem. The model does not merely label sources after the fact. It computes spatio-spectro-temporal correlations and turns them into filters that recover target signals.

This is close to a proof procedure. The mixture makes a claim: there are recoverable sources here. The correlations are the evidence. The filters are the constructive witness that the claim was usable.

For composition, that suggests a richer view of polyphony. A line proves itself by maintaining enough correlated evidence across frequency, timing, spatial position, envelope, and gesture. Counterpoint is not only pitch against pitch. It is simultaneous proof of distinct sourcehood.

### Single-Source Audio Is a Curated Claim

FSD50K-Solo makes the single-source label less naive. The pipeline synthesizes clean single-class events into controlled noisy mixtures, then uses a pretrained encoder and classifier to identify samples that likely contain one source rather than several.

That turns "single source" into a tested proposition. It is not guaranteed by the file name, the dataset row, or even the apparent event class. It has to survive adversarial context: background, overlap, interference, and the messy residue of real recordings.

Musically, this matters because instrumental identity is often treated as a given. But a note only behaves as one source if the listener has enough coherent evidence to bind it. The single source is not the acoustic atom. It is the successful proof.

### Zero-Knowledge Gives the Compositional Analogy

The Quanta extraction describes zero-knowledge proofs as a way to convince a verifier that a statement is true without revealing why it is true. The surprising connection to mathematical unknowability is specific to cryptography, but the broader idea is useful here: a system can reveal enough for trust without revealing everything.

That is a strong musical analogy. A listener can be convinced that a hidden process governs the sound without being handed the process directly. A piece can prove "this texture has rules" through recurring constraints, partial symmetries, bounded transformations, or consistent response patterns while keeping the generative mechanism opaque.

The secret is not a gimmick. It is part of the experience. The listener receives sufficient evidence to trust the structure, but not enough to collapse it into explanation.

## The Compositional Claim

Music often works by minimum proof. It gives the listener enough evidence to bind, predict, or trust, while withholding enough to keep the event alive.

This suggests three practical controls:

- **Proof timing:** decide how early a musical process becomes legible. A fast proof supports action and anticipation; a slow proof supports suspense.
- **Proof bandwidth:** choose which cues carry the evidence. Pitch, timbre, space, rhythm, dynamics, and register can each bear part of the burden.
- **Proof disclosure:** decide whether the process should be transparent, partially hidden, or deliberately zero-knowledge-like: convincing without full explanation.

The interesting compositional zone is not maximum clarity. It is calibrated sufficiency. Too little evidence and the listener cannot bind the event. Too much evidence and the event becomes inert, already solved.

## A Tool Shape

A Resonant Projects tool could estimate a **minimum proof curve** for audio or symbolic material. For each moment, it would ask: what claim is this passage making, and how much evidence currently supports it?

Possible claims include source continuity, tonal center, meter, phrase boundary, room identity, process identity, or transformation rule. The evidence could include spectral correlation, onset regularity, pitch-class concentration, spatial coherence, repetition density, and learned embedding stability.

The output would not be a correctness score. It would be a map of when the listener is likely to have enough evidence to commit. That map could become a compositional surface: write a melody whose source identity proves early but whose harmony proves late; write a texture whose rhythm proves quickly while its generating rule remains partially hidden; write a transition where the old process stops proving itself before the new one fully does.

## Why It Matters

The bridge across these sources is elegant: audio models, dataset curation, streaming translation, and zero-knowledge proofs all care about what must be shown, when, and to whom.

For music, that reframes structure as evidence management. Sound is not merely perceived. It argues. It offers partial proof of source, process, space, and intention. Composition is the art of deciding how much proof the listener gets before the next event changes the question.

---

_Connections: streaming speech translation, SR-CorrNet, FSD50K-Solo, zero-knowledge proofs, source separation, evidence thresholds, perceptual binding, process identity, musical expectation_
