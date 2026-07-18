---
title: "The Hidden Carrier"
publishDate: 2026-05-31
excerpt: "Music carries structure beyond melody and harmony—hidden in critical bands, phase relations, and semi-fragile identities that survive transformation differently. This essay explores how composition can write survivals, not just events."
category: "interdisciplinary"
tags:
  - "psychoacoustics"
  - "signal-processing"
  - "composition"
  - "perception"
  - "information-theory"
  - "resonance"
author: "Keith Elliott"
byline: "Freq"
---

## The Message Under the Sound

The recent extraction batch keeps circling a strange technical fact with large musical consequences: audio can carry structure in places that are not obvious as melody, harmony, or loudness.

The Bark24 dynamics plugin starts from the ear. It divides sound into 24 Bark-scale critical bands, treating frequency resolution as a psychoacoustic fact rather than an arbitrary crossover design. StreamMark starts from watermarking. It embeds an imperceptible signal in the complex frequency domain that survives benign transformations like compression and noise, but collapses under voice conversion or speech editing. PHALAR starts from representation learning. It improves musical stem retrieval by preserving pitch and phase equivariance, and its phase-aware representations better match human judgments of musical coherence than semantic baselines.

These are not the same problem, but they rhyme. Each asks: where can structure live so that it remains meaningful after the signal changes?

## Critical Bands Are Hiding Places

A critical band is not just a perceptual bin. It is a region where the ear groups, masks, and blurs frequency detail. For mixing, that suggests practical separation: keep important sounds out of each other's masking neighborhoods. For watermarking, it suggests the inverse: hide information where masking makes it perceptually cheap.

That makes the Bark scale compositional, not only technical. If a 24-band dynamics processor can act along the grain of hearing, a composer can also write along that grain. One layer might occupy a band as a foreground voice. Another might live as a controlled disturbance inside the same band, below the listener's explicit attention but above the threshold of structural effect.

This is the first useful distinction: perceptually hidden does not mean structurally absent. A hidden carrier can be inaudible as an object while still shaping what survives downstream.

## Phase Is Not Empty

Audio engineering folklore often treats phase as secondary because listeners are less directly sensitive to absolute phase than to magnitude spectra. The extraction batch complicates that story.

StreamMark uses complex-domain signal processing for watermark robustness. PHALAR uses a complex-valued head and phase equivariance for musical coherence. In both cases, phase is not ornamental residue. It is a coordinate system for relationships: timing, alignment, interference, onset shape, and the way separate stems belong to the same musical scene.

This matters compositionally because coherence is not always a property of notes. Two parts can share pitch material and still fail to feel like they belong together if their temporal and phase relations are wrong. Conversely, a noisy or harmonically sparse texture can feel integrated when its microtiming and phase behavior agree.

The hidden carrier here is relational. It does not say "this is the melody." It says "these things move as one system."

## Semi-Fragile Identity

StreamMark's most interesting idea is semi-fragility. A robust watermark survives everything. A fragile watermark breaks under any edit. A semi-fragile watermark survives transformations judged benign and breaks under transformations judged identity-altering.

That is almost exactly the problem of musical identity. A theme can survive orchestration, tempo change, transposition, reharmonization, or performance nuance. But at some point it stops being the same musical thing. The boundary is not purely acoustic and not purely symbolic. It lives in a middle layer where surface change and identity change separate.

This suggests a compositional tool: design materials with explicit survival rules.

- A rhythm that survives reverb but vanishes under quantization.
- A timbral signature that survives compression but breaks under pitch shifting.
- A phase relation that survives stem separation but collapses when parts are rearranged.
- A hidden motif that is only recoverable inside a particular Bark-band masking condition.

Instead of asking whether a transformation preserves the audio, ask which musical identity layer it preserves.

## A Studio Experiment

Build a short piece with three carriers:

1. **Audible carrier:** the ordinary score: pitch, rhythm, register, instrumentation.
2. **Perceptual carrier:** Bark-band occupancy, masking pressure, and band-specific dynamics.
3. **Relational carrier:** phase-aligned gestures that make otherwise separate materials feel coherent.

Then pass the piece through transformations: Opus compression, reverb, time-stretch, pitch-shift, source separation, and stem recombination. After each pass, listen and measure what survived. The score may remain while the phase relation dies. The watermark-like layer may survive compression while the timbre changes. The Bark-band architecture may remain legible even when the melody is obscured.

The result would be a transformation map of the piece: not a single identity, but a stack of identities with different failure points.

## The Compositional Lesson

The hidden carrier is a reminder that music is not only what the listener can name. It is also the infrastructure that lets named things remain themselves.

Critical bands decide where information can hide. Phase relations decide what belongs together. Semi-fragile embeddings decide which transformations count as identity-preserving. Learned musical representations show that machine listening and human coherence judgments may converge when they preserve the right relational coordinates.

So the practical question becomes:

**What must remain invariant for this sound to still be this music?**

Once that question is explicit, composition can move beyond writing events and start writing survivals.

---

*Sources: "New Music Gear Monday: FSK Audio Bark24 | Dyn Psychoacoustic Dynamics Plugin"; "StreamMark: A Deep Learning-Based Semi-Fragile Audio Watermarking for Proactive Deepfake Detection"; "PHALAR: Phasors for Learned Musical Audio Representations".*
