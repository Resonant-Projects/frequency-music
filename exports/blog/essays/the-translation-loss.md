---
title: "The Translation Loss"
publishDate: 2026-06-19
excerpt: "Musical identity isn't uniform across the signal—it concentrates in load-bearing layers that survive some transformations but fracture under others. This essay maps which layers carry meaning across notation, audio, and perception."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "composition"
  - "information-theory"
  - "acoustics"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

## What Has to Survive?

Every musical transformation is a translation. A phrase becomes a score. A score becomes a performance. A performance becomes a recording. A recording becomes a codec stream, a stem embedding, a watermark carrier, a spectrogram, a prompt, a memory.

The dangerous assumption is that the same music simply passes through these translations intact. It does not. Each representation preserves some layers and weakens others. The compositional question is not "did the signal survive?" but "which layer was carrying the identity?"

The recent synthesis set makes this unusually clear. StreamMark survives benign audio transformations but breaks under deepfake-style semantic edits. PHALAR improves stem retrieval by enforcing pitch- and phase-equivariant structure. Bark-scale dynamics divides the spectrum according to perceptual critical bands rather than arbitrary crossovers. MSU-Bench shows that models reason differently about the same score depending on whether it arrives as notation text or visual page. A speech-recognition fairness study finds that the audio encoder, not the language-model decoder, drives robustness and bias. And the ice-phase extraction reminds us that systems under pressure move to the nearest accessible structure, not the abstract optimum.

Together they point to a principle: identity is not spread evenly across the signal. It has load-bearing layers.

## Surface Quality Is Not Identity

StreamMark is the cleanest example. Its watermark is designed to remain recoverable after ordinary signal processing: compression, noise, and other benign distortions. But when the audio undergoes transformations that alter semantic identity, such as speech editing or voice conversion, the message recovery falls toward chance.

That distinction matters for music. A transformation can leave the surface polished while damaging the layer that made the passage itself. A melody can survive EQ but not reharmonization. A groove can survive timbral substitution but not microtiming quantization. A vocal identity can survive compression but not formant transfer. A chord progression can survive orchestration but not a change in bass implication.

This is why "high fidelity" is too blunt a goal. Fidelity to what? Waveform? Timbre? Gesture? Harmonic function? Sourcehood? Phrase role? A representation can be faithful to one layer and treacherous to another.

## Phase as Relation

PHALAR sharpens the point by treating phase not as expendable detail but as structure. Its learned musical audio representation uses pitch equivariance and phase equivariance to match missing stems to a submix, and the extracted summary notes stronger alignment with human coherence judgments than semantic baselines.

That suggests that musical relatedness can live in relations that ordinary symbolic descriptions often discard. Phase is not melody, harmony, or rhythm in the score-theoretic sense. But in audio, phase relationships shape attacks, spatial placement, interference, groove, and the felt coherence between parts. If a translation preserves pitch labels while flattening phase-sensitive timing and interference, it may retain the map while damaging the terrain.

For composition, this is a warning against treating notation-level identity as complete identity. A passage can be "the same notes" and still lose the thing that made it cohere.

## The Ear's Coordinate System

The Bark-scale dynamics extraction gives the perceptual version of the same problem. Conventional multiband dynamics processors divide frequency by chosen crossover points. Bark-scale processing instead follows critical-band structure: the ear's own coarse frequency partitioning.

That is a translation from mathematical spectrum to perceptual spectrum. The question changes from "which hertz range is being compressed?" to "which auditory band is carrying energy, masking, and salience?" If a transformation respects critical bands, it may preserve perceptual balance even while changing the literal spectrum. If it violates them, it may measure as orderly while sounding wrong.

The ear is not a neutral analyzer. It has a coordinate system. Any musical identity that depends on masking, roughness, brightness, or spectral blend is partly defined in that coordinate system.

## Modality Changes the Question

MSU-Bench extends the argument from sound to score. The same musical work can be presented as ABC notation or as a visual score, and models do not understand those forms equivalently across onset, texture, form, and higher-level reasoning. The modality is not a passive container. It decides which operations are easy.

Musicians know this physically. A piano roll foregrounds timing and duration. Staff notation foregrounds contour, harmony, and voice. A spectrogram foregrounds energy distribution. A lead sheet foregrounds chord function and melody. None is "the music." Each is a translation with affordances and blind spots.

The speech-recognition fairness extraction adds the hardest edge: changing the encoder changes robustness and bias. The downstream model may be huge, but if the front-end representation damages accented speech, inserts silence pathologies, or hallucinates repetitions under masking, scale cannot fully repair it. The first translation decides what later reasoning can know.

## The Nearest Surviving Form

This returns to the ice phases. Under pressure, water does not scan every possible crystalline structure and choose the most stable. It often enters the nearest accessible metastable phase. The path of compression matters. The realized form depends on rate, direction, and timescale.

Musical transformations behave the same way. When a passage is compressed into notation, quantized to a grid, rendered through a synth, separated into stems, encoded for streaming, or reimagined by a performer, it does not become the ideal equivalent. It becomes the nearest form that the translation path can actually reach.

Sometimes that nearest form preserves identity. Sometimes it preserves only surface.

## A Compositional Test

A useful experiment would be simple. Compose a one-minute miniature with three recognizable layers:

- a melodic contour
- a rhythmic cell
- a distinctive timbral or source identity

Then make three translations.

The first preserves pitch and rhythm while weakening phase-sensitive microtiming or interference. The second preserves the audible surface but processes dynamics by perceptual bands, letting the Bark bands breathe independently. The third preserves notation-level pitch and rhythm while changing carriers and inserting short silence masks.

Blind-listen against the reference. Rate surface quality and same-piece identity separately. The interesting case is the version that still sounds "good" but no longer sounds like the same musical object. That is the translation loss. It reveals the load-bearing layer.

## Writing for Translation

This changes how a composer can think about variation. Instead of asking how much material can change, ask which identity layer is protected.

If the load-bearing layer is contour, harmony can move freely. If it is bass function, melody can ornament. If it is phase-coherent groove, quantization is dangerous even when the notes remain correct. If it is sourcehood, reverb and masking matter as much as pitch. If it is notation-level form, timbral changes may be cheap. If it is perceptual-band balance, spectral edits should follow the ear rather than the analyzer.

The practical rule is:

> Preserve the layer that carries identity; spend the other layers.

That is not a conservative rule. It is a license to transform aggressively once the load-bearing layer is known. A phrase can survive astonishing damage if the right relation remains intact. It can also collapse after a tiny edit if the edit touches the hidden carrier.

Translation loss is the difference between changing the clothing and breaking the skeleton. Composition becomes more precise when we know which is which.

---

_Sources: StreamMark extraction on semi-fragile audio watermarking; PHALAR extraction on phase- and pitch-equivariant musical representations; Bark24 extraction on Bark-scale dynamics processing; MSU-Bench extraction on score-understanding modality gaps; speech-recognition fairness extraction on encoder-driven robustness and bias; Quanta ice-phase extraction on nearest accessible metastable forms. Connects to: [The Accessible Phase](/docs/essays/the-accessible-phase.md), [Sourcehood as a Compositional Parameter](/docs/essays/sourcehood-as-a-compositional-parameter.md), [Every Basis Has a Bias](/docs/essays/every-basis-has-a-bias.md), [The Codec Ear](/docs/essays/the-codec-ear.md), and [The Representation Gap](/docs/essays/the-representation-gap.md)._
