---
title: "Error as Instrument"
publishDate: 2026-07-18
excerpt: "Reconstruction error becomes compositional when it diagnoses what a representation can explain, what transformation it can track, and what residual should become new material."
category: "interdisciplinary"
tags:
  - "composition"
  - "AI-music"
  - "representation-learning"
  - "signal-processing"
  - "information-theory"
  - "music-production"
author: "Keith Elliott"
byline: "Freq"
---

Reconstruction error is usually treated as a defect. The recent extraction set suggests a better use: error can be an instrument for discovering which musical structure a representation actually understands.

The clearest pair is MIDI-RAE-JEPA and the reconstruction-based vocoder OOD detector. MIDI-RAE-JEPA learns symbolic-music embeddings from piano-roll images with pitch- and time-shift equivariance objectives. Its reported reconstruction score is almost perfect, and its embedding distances increase with the size of pitch and temporal shifts. The vocoder detector works on a different signal: WavLM-derived speech features. It sends each feature through class-specific decoders and treats the sample as out-of-distribution when no known decoder can reconstruct it satisfactorily.

One system wants reconstruction to preserve a musical object across controlled transformations. The other wants reconstruction to fail when the object comes from the wrong origin. Together they make a useful distinction:

**Good error is not small error. Good error is diagnostic error.**

## The Decoder Knows Its World

A decoder is never neutral. It carries a model of the world that produced its training examples.

In the vocoder detector, this is explicit. A feature belongs to a known vocoder class when that class's decoder can reconstruct it better than the others. The reconstruction error is a membership test. It says: this sound is explainable by this origin, or it is not.

That is already a compositional idea. Imagine several musical decoders, each with a different worldview:

- one that preserves harmonic function;
- one that preserves spectral envelope;
- one that preserves rhythmic articulation;
- one that preserves source identity;
- one that preserves spatial motion.

The same sound passed through those decoders would not simply become better or worse. It would reveal what each worldview can afford to lose. A chord that survives the harmonic decoder but collapses under the spectral decoder is not the same musical object as a sound mass that survives spectral reconstruction while harmonic labels become meaningless. The residual tells you what a system could not explain.

In this sense, reconstruction error is closer to listening than to bookkeeping. A listener also reconstructs selectively. A trained drummer hears timing deviations that a casual listener smooths away. A mixing engineer hears spectral masking where another listener hears a single blended texture. A style expert hears a wrong cadence before they can name why. Each listener has a decoder, and each decoder fails in characteristic places.

## Equivariance Gives Error a Direction

MIDI-RAE-JEPA adds the geometric piece. Pitch-shift and time-shift equivariance do not ask the representation to ignore transformation. They ask it to move coherently when the music moves. If embedding distance increases with shift magnitude, then error is no longer a scalar complaint. It has direction.

That matters. A bad reconstruction score by itself says only that something changed. An equivariant representation can say what kind of change the system thinks occurred: pitch displacement, temporal displacement, density change, register drift, or some mixture of these. Error becomes a coordinate in a space of possible musical actions.

This is the difference between a broken mirror and a measuring instrument. A broken mirror distorts everything. A measuring instrument distorts in calibrated ways. For composition, calibrated distortion is gold. It lets you ask not only "did the motif survive?" but "which dimension of survival failed first?"

## A Piece Built from Residuals

Here is the practical experiment these sources suggest.

Start with a short symbolic phrase. Pass it through a representation trained or constrained to preserve pitch/time transformation geometry. Generate variants by transposition, temporal displacement, rhythmic densification, and register migration. After each variant, reconstruct the phrase and measure the residual.

Then do not hide the residual. Orchestrate it.

If pitch-shift residual is high, assign the error to a detuned shadow voice. If time-shift residual is high, turn it into percussion flams or delayed attacks. If density residual is high, split it into ornamental notes. If source-class residual is high, change the synthesizer, room, or microphone model. The error becomes the part of the music that the current representation cannot carry cleanly.

This gives a form:

1. A phrase enters a decoder that understands it.
2. A transformation pressures the phrase.
3. The decoder reconstructs what it can.
4. The residual becomes new material.
5. The new material enters a different decoder.

The piece becomes a chain of partial understandings. Each section is defined by what it can reconstruct and what it must spill into sound.

## Why This Is Not Just ML

The recent low-yield extractions are useful negative evidence. Several sources were only headlines or promotional snippets: mitochondrial sampling, drinking water with meals, Egyptian princesses, chimpanzees in Berlin, wildfire smoke. The extractor correctly refused to invent music claims from them. That is the same principle at the textual layer. When the decoder has no evidence, a clean failure is more valuable than a fluent hallucination.

For this project, that matters as much as the technical papers. The knowledge graph should not merely collect concepts. It should preserve the conditions under which concepts were actually supported. A concept that came from a strong reconstruction test should not have the same epistemic weight as a concept guessed from a headline. The graph needs residual awareness: what was explained, what was left over, and what failed cleanly.

## The Musical Claim

Reconstruction error is not only a loss term. It is a way to ask what kind of world a representation believes in.

Small error means the world was familiar. Large error means either the signal was damaged, the origin was foreign, or the transformation moved along a dimension the representation could not track. Equivariant error tells us which direction the unfamiliarity points. Class-specific error tells us which origin failed to explain the sound.

That is compositionally rich because music often lives in the controlled failure of explanation. A modulation works because the old key can almost explain the new chord, until it cannot. A timbral transformation works because the source almost survives, then becomes something else. A rhythmic displacement works because the meter almost absorbs it, then yields.

The residual is where the next idea begins.

---

_Sources: MIDI-RAE-JEPA extraction (`j970n5akmsx33bh4mbg65yfmex8ape41`); reconstruction-based vocoder OOD extraction (`j977mwnb8t2snjxmd2gwj960b58aps9b`); recent low-yield snippet extractions (`j97e4x9g0apxnqj23vdjc02g0d8arzg5`, `j97686pfdj39t1r73d5t4fz44n8ar5p9`, `j973qyyc9y6syaf0kbp5qzdpdh8arrnc`, `j97c6bk15epn7h3gvzfg289g5d8asj2z`, `j9797k0sxmvrkc8q80jezhvc998as6c0`, `j97927e8ty1q12ryj3p20dwej98ase41`)._

_Graph links to add when authorized: diagnostic reconstruction error, equivariant residual, decoder worldview, clean extraction failure, residual composition._
