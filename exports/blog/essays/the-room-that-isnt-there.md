---
title: "The Room That Isn't There: Acoustic Inference and the Art of Completion"
publishDate: 2026-03-18
excerpt: "Listening is an act of completion—from spatial inference in rooms to spectral reconstruction in timbral perception. Diffusion models formalize what the auditory system does, offering composers new tools to control what listeners infer from partial acoustic information."
category: "interdisciplinary"
tags:
  - "perception"
  - "psychoacoustics"
  - "acoustics"
  - "signal-processing"
  - "composition"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The First Fifty Milliseconds

When a sound erupts in a room — a handclap, a snare hit, a spoken word — the direct sound reaches your ear first. Then, within about 5 to 50 milliseconds, the early reflections arrive: sound bouncing off the nearest walls, floor, ceiling, each one a delayed, filtered copy of the original. After that comes the late reverberation — a dense, chaotic wash of thousands of overlapping reflections that decays exponentially as energy is absorbed by surfaces.

Here's the remarkable thing: your brain uses those first few early reflections to construct a _model of the room_. Before the late reverb has even fully developed, you already have a sense of the space's size, shape, and character. The early reflections are a geometric signature — each one encodes the distance and angle of the nearest surface. Your auditory system, through millions of years of evolutionary refinement, has learned to decode this signature instantly, unconsciously, and with surprising accuracy.

You are, in effect, completing a room from fragments. A handful of echoes, and you know if you're in a cathedral or a closet.

---

## The Machine That Completes Rooms

A recent paper on room impulse response (RIR) completion via diffusion models does something strikingly parallel. The system takes as input a set of early reflections — computed geometrically via the image source method, which traces sound paths bouncing off walls like billiard balls — and generates the late reverberation that would follow in a physically plausible room.

The approach is elegant in its framing. The image source method is good at computing early reflections (they're geometrically tractable — you can model them as direct paths from "mirror" sources behind each wall). But it fails for late reverberation, where the number of reflection paths explodes combinatorially and wave phenomena like diffraction and scattering dominate over simple ray geometry. Physics simulators can handle this, but they're expensive. So instead: learn the statistical structure of late reverberation from simulated examples, then use a diffusion model to _imagine_ a plausible completion conditioned on the early reflections you can compute cheaply.

The parallel to human perception is not superficial. Both systems face the same fundamental problem: **early reflections are computable, late reverberation is not** (at least not cheaply). Both solve it the same way: learn the statistical regularities of rooms, then use partial geometric information to condition a generative process that fills in the rest.

---

## What Completion Means

Acoustic completion is a specific instance of a much deeper pattern: **inference from partial spectral information**. And it appears everywhere in audio science, always wearing slightly different clothes.

**Spectrograms as partial views.** A spectrogram shows magnitude — how much energy at each frequency over time. But as we've explored in earlier work on phase, this is exactly half the information in the signal. The phase spectrum — where each frequency component is in its cycle — is invisible. Every spectrogram-based analysis, every convolutional neural network trained on spectrograms, is performing inference from a partial representation. The system must learn to work without the ghost in the spectrum, compensating for missing phase through learned statistical priors about how magnitudes and phases typically co-occur.

The spectrogram survey literature makes this explicit: the _design choices_ in spectrogram construction — resolution, scaling, element representation — are choices about which partial view of the signal to present. Linear frequency scaling preserves physical accuracy but makes it hard to see musical structure. Mel scaling compresses high frequencies to match perceptual resolution but distorts the harmonic series. Log scaling reveals octave structure but loses absolute frequency information. Each is a different partial view, and each requires the downstream system to perform a different kind of completion.

**Noise colors as statistical signatures.** The 1/f power law that characterizes musical signals is itself a statement about completion. Pink noise has long-range correlations — knowing what happened in the past constrains what can happen in the future. White noise has no such correlations — each sample is independent, and no completion is possible. Brown noise is _over_-correlated — the past determines the future too strongly, leaving no room for surprise.

Music sits at β ≈ 1 precisely because this is the regime where _partial information is maximally useful_. You can predict, but not perfectly. You can be surprised, but not bewildered. The listener is always completing — inferring what comes next from what came before — and music at the 1/f boundary is optimally designed for this kind of inference.

---

## The Listener as Completion Engine

The unifying insight is that listening is never passive reception. It is always, at every level, an act of completion:

- **Spatial completion.** Early reflections → model of room geometry. A few echoes become a three-dimensional space.
- **Spectral completion.** Magnitude spectrum → inferred timbral identity. We hear the pitch, the instrument, the vowel — all from partial spectral information, filling in the phase, the microstructure, the context.
- **Temporal completion.** Past events → predicted future. The melody implies its continuation. The rhythm sets up expectations that can be fulfilled or violated. Each moment is heard partly and predicted partly.
- **Harmonic completion.** Fundamental frequency → inferred harmonic series. We hear the "missing fundamental" because our auditory system completes the harmonic template. A telephone speaker that cuts off below 300 Hz still conveys a bass voice, because the brain infers the fundamental from the upper partials.

Each of these is the same operation at a different scale: given partial information, reconstruct a plausible whole using learned priors about how sound behaves.

---

## The Diffusion Connection

It's not a coincidence that diffusion models have become the tool of choice for acoustic completion tasks. The diffusion framework — start with noise, iteratively denoise toward a target distribution conditioned on partial information — is a mathematical formalization of exactly what the auditory system does.

The RIR completion model starts with Gaussian noise and sculpts it into late reverberation, conditioned on early reflections. A spectrogram inpainting model starts with noise and sculpts it into missing time-frequency regions, conditioned on surrounding context. A music generation model starts with noise and sculpts it into coherent audio, conditioned on text, melody, or style.

In each case, the model has learned a prior over what "plausible sound" looks like, and uses partial observations to steer the generation toward a specific instance consistent with those observations. This is Bayesian inference made concrete: prior × likelihood → posterior. The prior is the learned distribution of sounds. The likelihood is the constraint imposed by the observed partial information. The posterior is the completed sound.

And the quality of the completion depends critically on the quality of the prior — on how well the model has captured the statistical structure of real acoustic phenomena. A model trained on rooms knows what rooms sound like. A model trained on music knows what music sounds like. The partial information constrains _which_ room or _which_ music, but the prior determines the space of possibilities.

---

## Compositional Implications

If music is an art of managed completion — if the composer's craft is partly about controlling what the listener infers from partial information — then the physics of acoustic completion offers concrete tools:

**Room as instrument.** The choice of acoustic space is a choice about what completion the listener will perform. A reverberant cathedral tells the listener "this space is vast, these sounds decay slowly, long sustained tones will bloom." A dry studio says "every detail is exposed, nothing is hidden, the direct sound dominates." The room sets the prior for spatial completion, and the composer can exploit this.

**Spectral implication.** A chord that strongly implies missing harmonics activates the listener's harmonic completion machinery. Organ stops that omit the fundamental but include the 2nd and 3rd harmonics create the perception of a bass an octave below any physical pipe. Power chords work partly because the distorted harmonics create a dense spectral field that the ear completes into a richer harmonic structure than any clean dyad could produce.

**Temporal scaffolding.** A rhythm that establishes a strong predictive pattern — then strategically withholds expected beats — creates tension through _failed completion_. Syncopation is a completion error. The groove in funk and hip-hop lives in the gap between what the pattern predicts and what actually arrives. The listener's completion engine generates the expected beat internally; the actual silence where it should have been creates a phantom accent — the rhythm that isn't there.

**The room that isn't there.** Convolution reverb lets you place a sound in a room that doesn't exist — or in a room that existed once and was captured as an impulse response. Now, diffusion-based RIR generation lets you create rooms that _never_ existed, rooms with physically plausible but never-measured acoustic properties. The composer gains access to an infinite library of phantom spaces, each one a different completion prior, a different set of assumptions about how sound should decay and diffuse.

---

## The Deeper Pattern

Across all of these — room completion, spectral completion, temporal completion, harmonic completion — the same structure recurs:

1. **Partial observation** provides geometric or statistical constraints
2. **Learned priors** encode what is typical or possible
3. **Inference** combines constraints and priors to produce a complete percept
4. **The quality of the result** depends on the match between the prior and the actual generative process

This is why trained musicians hear more than untrained listeners: their priors are richer. It's why familiar music feels more spacious than unfamiliar music: you complete more of it, so more of the signal is "free" to carry other information. And it's why the measurement wall exists: no objective metric can perfectly predict the output of a completion process that depends on listener-specific priors.

The room that isn't there is the room your brain builds from echoes. The melody that isn't there is the one your expectations sing ahead of the music. The beat that isn't there is the one your body anticipates and moves to before it arrives — or doesn't.

Sound is always partial. Listening is always completion. The art is in choosing what to leave out.
