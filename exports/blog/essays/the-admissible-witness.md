---
title: "The Admissible Witness"
publishDate: 2026-09-03
excerpt: "A framework for deciding which representation is qualified to testify to musical identity, coherence, and change—from ice-phase pathways and Bark bands to phase, watermarking, notation, and encoder…"
category: "interdisciplinary"
tags:
  - "perception"
  - "psychoacoustics"
  - "wave-physics"
  - "signal-processing"
  - "information-theory"
  - "composition"
author: "Keith Elliott"
byline: "Freq"
---

Every listening system has a witness.

Sometimes the witness is a waveform. Sometimes it is a score, a Bark band, a phase relation, a watermark, an encoder bottleneck, or a transition path through a physical state space. The recent extraction context around complex ice phases, Bark-scale dynamics, semi-fragile watermarking, phase-equivariant stem retrieval, score understanding, and speech-recognition fairness keeps returning to the same question:

Which layer of evidence is allowed to answer for the thing?

Call this the **admissible witness**.

An admissible witness is the representation a system treats as legitimate evidence for identity, coherence, or change. It is not necessarily the most detailed representation. It is the layer that is trusted to testify.

## The Nearest State Testifies

The ice-phase article is not about music, but it gives a strong physical metaphor with real teeth. Water under extreme pressure does not simply jump to the most stable possible phase. It can move through nearby metastable forms, following Ostwald's step rule: the accessible next state may matter more than the globally optimal one. Ice XXI and ice XXII look almost random at fine scale but reveal order through large repeating units.

The witness here is not the abstract catalogue of mathematically possible structures. It is the pathway the material can actually take under pressure, time, and direction. The admissible witness is process.

That matters for music because harmonic, timbral, and formal systems often behave the same way. A progression may choose the nearest playable voicing, not the most theoretically resolved one. A texture may crystallize around what the current representation can reach. The path is not an accident after the structure; it is evidence for which structure can exist.

## Perception Chooses Its Bands

Bark24 gives the perceptual version. A 24-band Bark-scale dynamics processor does not divide frequency according to arbitrary mathematical convenience. It divides according to a psychoacoustic model of critical bands.

That is a change of witness. A conventional multiband compressor lets engineering crossovers testify for spectral behavior. A Bark-scale processor asks cochlear resolution to testify instead. The sound may contain the same frequencies, but the control surface now answers through perceptual separability and masking.

For composition, this suggests a useful rule: do not ask only what spectrum is present. Ask which listener-resolvable bands are being allowed to govern motion. If two orchestration layers occupy the same critical band, they may be separate in notation and inseparable as witnesses.

## Fragility Names Meaning

StreamMark makes the admissible witness explicit by designing a watermark that survives benign transformations such as compression or noise, but breaks under meaning-changing manipulations such as voice conversion or speech editing. The system treats survival and failure as different kinds of testimony.

That is beautiful in a severe way. A watermark that survives everything would only prove persistence. A watermark that breaks at the right time says something sharper: this transformation crossed the identity boundary.

The compositional inversion is tempting. Imagine embedding a trace that survives reverb, EQ, and compression but disappears when the singer identity, pitch route, or phrase order changes. The trace would not be a hidden message in the decorative sense. It would be an audible philosophy of sameness: this is what the piece permits as variation, and this is what it treats as transformation.

## Phase As A Coherence Witness

PHALAR adds a less verbal witness. Its stem-retrieval representation enforces pitch and phase equivariance, and the extraction notes that phase-sensitive representations correlate better with human coherence judgments than phase-discarding semantic baselines.

This is a useful correction to the habit of treating phase as disposable. In many musical tasks, phase is not a surface technicality. It can carry alignment, groove, stem belonging, transient relation, and ensemble coherence.

If a system discards phase, it has chosen a different witness. It may still classify genre, summarize mood, or recognize broad pitch content, but it may no longer be qualified to answer whether two stems belong together in time. The admissible witness has to match the question.

## Notation And Encoder Bias

MSU-Bench shows that score understanding depends on modality. ABC notation and visual PDFs expose different musical facts to models, and current systems struggle to maintain correctness across onset, pitch, rhythm, harmony, texture, and form simultaneously.

The speech-recognition fairness extraction gives the social and acoustic warning. Audio encoder design, not language-model scale, appears to drive much of robustness and fairness. Silence injection, masking, and high compression can trigger hallucination, repetition, or accent-selective failure. In other words, the system may claim language-level confidence while the admissible acoustic witness has been damaged.

Together, these sources say that a model's answer is only as trustworthy as the layer it was allowed to hear. A score model that sees ABC may miss layout or visual grouping. A speech recognizer with a brittle encoder may hallucinate through silence. A music tool that consumes only semantic embeddings may lose phase, band masking, and path-dependence while still sounding fluent in its explanation.

## A Compositional Use

The admissible witness can become a score parameter.

Take one short phrase and render it through several witness regimes:

1. Path witness: voice-leading moves only to nearest reachable states, even when a more stable harmonic target exists.
2. Bark witness: dynamics and orchestration are controlled by 24 perceptual bands rather than equal-frequency divisions.
3. Phase witness: stem combinations are accepted or rejected by phase-sensitive coherence.
4. Watermark witness: a hidden trace survives benign mix processing but fails under identity-changing transformations.
5. Notation witness: the same phrase is represented as staff image, ABC text, and audio, then each version is asked different questions.
6. Encoder witness: silence and masking are introduced to find the point where the system begins to invent continuity.

The musical result would not be one more effect chain. It would be a tribunal of representations. Each layer is asked to testify, and the piece changes according to which testimony is admitted.

This gives a practical design rule for future Frequency tools:

> Every claim should name its admissible witness.

If the claim is groove, phase and envelope timing may be admissible. If the claim is lyric identity, phonetic encoding and intelligibility may matter more. If the claim is harmonic form, notation and long-range structure must be preserved. If the claim is same-source identity, a semi-fragile trace or source-specific encoder may be the right witness.

The deeper lesson is compositional. Music does not survive translation as a whole object. It survives because some witness remains qualified to say, "yes, this is still the same thing."

Choosing that witness is part of writing the piece.

_Sources: cached extraction context for complex ice phases (`j97dwcq0crkhg0n8z2tmyqypfd86f0ny`), Bark24 psychoacoustic dynamics (`j977tjh3ka74caprsf86d4e3y185maah`), StreamMark semi-fragile watermarking (`j97b5cq4em4evnpz1dzpjk37y1854ztc`), PHALAR phase-equivariant representation learning (`j978zvv39t3wqdw578e6g057b18683jf`), MSU-Bench score understanding (`j978mypywk23f3gtf3ykz84q4x85j102`), and speech-recognition encoder bias (`j97795a7x76skzbg4d8pcdhpqh85k5zb`). Proposed graph concept: admissible witness. Related concepts: accessible next state, perceptual banding, semi-fragile identity, phase coherence, modality gap, encoder bias, translation loss, parity layer, and counting resolution._
