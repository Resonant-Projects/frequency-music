---
title: "Hearing Backwards"
publishDate: 2026-04-02
excerpt: "Sound encodes the physical geometry of its source-rooms, bodies, authenticity-and these geometric signatures can be recovered through inverse problems. This reveals composition as the art of choosing which physical projections to layer."
category: "interdisciplinary"
tags:
  - "acoustics"
  - "signal-processing"
  - "wave-physics"
  - "composition"
  - "perception"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The Forward Problem Is Easy

Sound travels in one direction through causation: a physical system vibrates, the vibration propagates through a medium, and arrives at a listener as a pressure wave. The forward problem — given the source, predict the sound — is well understood. It's the province of physics, of simulation, of synthesis.

The inverse problem is harder and more interesting: _given the sound, recover the source._

Three recent papers each attempt this inversion, and together they reveal something unexpected about the relationship between sound and the physical world.

---

## Three Inversions

### 1. The Room in the Voice

EchoMark recovers Room Impulse Responses directly from reverberant speech. No access to the dry recording, no knowledge of the room's dimensions — just the wet signal, carrying the room's fingerprint in every reflection.

The key insight is that the RIR is not merely added to speech; it is _convolved_ with it, which means the room's geometry is mathematically interleaved with every phoneme. The researchers work in a latent domain specifically because RIRs vary wildly in duration and energy decay — the same variability that essay #84 identified as the carrier of identity. They recover the room with enough fidelity that re-applied acoustic transfer scores a 4.22/5 MOS from human listeners.

The room is in the voice. It was always there. The inverse problem is just learning to hear it.

### 2. The Body in the Sound

Acoustic-to-articulatory inversion recovers the physical geometry of the vocal tract — from glottis to lips — using only the audio signal and RT-MRI training data. The average error is 1.48 mm, which is _below the spatial resolution of the MRI itself_ (1.62 mm pixel size). The model reconstructs the source more precisely than the imaging modality used to define ground truth.

This is remarkable and deserves emphasis: **the sound contains more information about the vocal tract than a direct image of it.** The reason is temporal: an MRI frame captures a static cross-section at a single instant, but a few milliseconds of speech encodes the *continuous trajectory* of every articulatory surface — tongue, velum, glottis, lip aperture — as they move through a gesture. Sound integrates geometry over time; an image freezes it. The articulatory contour representation works better than raw MRI pixels precisely because it captures those dynamics of shape change rather than snapshots. The body's geometry is more legible in its acoustic shadow than in its photograph.

The choice of audio embedding matters: HuBERT features outperform MFCCs, suggesting that the relevant information for inversion isn't in the spectral envelope alone but in learned representations that capture temporal dynamics. The sound knows the body that made it, but you need the right language to ask.

### 3. The Authenticity in the Pattern

A third paper approaches a different inversion: given a speech signal, determine whether a physical human body produced it. Deepfake detection, framed as an inverse problem, asks: _is there a consistent physical source behind this sound?_

The approach is striking — inject structured textual descriptions of low-level acoustic features (prosodic, spectral, physiological) into a language model prompt, creating what amounts to an "acoustic chain of thought." A lightweight model trained this way outperforms larger audio language models, because the chain of thought forces the model to reason about whether the observed acoustic patterns are _physically consistent_ — whether they could plausibly be produced by a single, coherent resonant body.

Authenticity, in this framing, is invertibility. A real voice can be traced back to a body. A synthetic voice, no matter how convincing spectrally, lacks the coherent physical source that would make the inverse problem well-posed.

---

## What Inversion Reveals

These three papers, read together, establish a principle: **sound is a lossy projection of its physical source, but the losses are structured, and structure can be inverted.**

The room inversion (EchoMark) recovers geometry from convolution. The body inversion (articulatory) recovers anatomy from radiation. The authenticity inversion (deepfake detection) tests whether a coherent source _exists at all_. Each operates at a different scale — architectural, anatomical, existential — but all share the same logical structure:

1. A physical system has geometry
2. That geometry constrains sound production
3. The constraints leave traces in the signal
4. Those traces can be read backwards

This is the inverse of essay #84's argument. That essay showed that a decaying sound progressively reveals its source's identity — entropy increases as the system rings down, and there is a calculable moment when the sound has said everything it has to say. These three inversions demonstrate that the "everything" is geometrically specific: the sound literally encodes the shape of what made it.

---

## The Acoustic Hologram

There's a useful metaphor here. A hologram encodes three-dimensional information in a two-dimensional surface through interference patterns. Sound, propagating from a physical source through a medium, similarly encodes three-dimensional geometric information in a one-dimensional pressure wave through the interference of reflections, resonances, and radiation patterns.

The forward direction (hologram → image, or source → sound) loses a dimension. The inverse direction (image → hologram, or sound → source) requires recovering that lost dimension from the redundancy that interference provides.

The three papers show that this recovery is possible because physical systems are not arbitrary signal generators — they are _constrained_ by geometry, material properties, and the laws of wave propagation. These constraints create the redundancy that makes inversion tractable.

A random signal has no invertible source. A resonant body does. The difference is physics.

---

## The Compositional Implication

If every sound is an invertible projection of its physical source, then composition is the art of choosing which projections to layer — which geometric stories to tell simultaneously.

Consider reverb not as an effect but as _geometric information_. When you place a dry vocal in a convolution reverb, you are asserting that this voice exists in a room with specific dimensions, specific materials, specific absorption characteristics. The listener's auditory system attempts the same inversion that EchoMark performs — unconsciously recovering the room from the reverberation. The emotional impact of "intimate" versus "cathedral" reverb is literally the impact of different recovered geometries.

Consider the voice itself. A singer's vibrato isn't just pitch modulation — it's the periodic variation of vocal tract geometry, and a trained listener hears the _body_ in the vibrato. The articulatory inversion paper confirms that this hearing is physically grounded: the sound really does encode the shape, and we really can recover it.

And consider authenticity. The uncanny valley of synthetic speech may be precisely a failed inversion — the listener's auditory system attempts to recover a coherent physical source and fails, not because the spectrum is wrong but because there is no consistent geometry behind it. The "wrongness" of a deepfake voice is the wrongness of a projection that doesn't project from anywhere.

### Three Compositional Parameters

1. **Geometric legibility:** How much of the source's physical geometry is audible in the sound? Close-miking maximizes it; heavy processing obscures it. This is a parameter composers already manipulate (dry vs. wet, close vs. far, natural vs. processed) but rarely conceptualize as _geometric information_.

2. **Inversion depth:** How many layers of physical source can a listener recover from the signal? A solo voice in a room offers two inversions (body + space). An orchestra offers dozens. Electronic music can offer zero — or, provocatively, can offer _impossible_ inversions: geometries that couldn't physically exist.

3. **Source coherence:** Does the sound project from a consistent, physically possible source? Real sounds always do. Processed and synthetic sounds may or may not. The boundary between coherent and incoherent sources is a boundary between the natural and the uncanny — and it's compositionally powerful in both directions.

---

## The Thread

This essay continues the arc from "What Survives" (#82) through "What We Measure" (#83) and "The Information in Decay" (#84):

- **#82** asked what persists through transformation — and answered: structure.
- **#83** showed that our measurement tools see surface but miss structure.
- **#84** demonstrated that decay is the process by which structure reveals itself.
- **#85** closes the loop: the revealed structure is _geometric_, and it can be recovered — run backwards from sound to source.

The implication for the next step is clear: if sound encodes geometry, and geometry can be recovered from sound, then the space of possible sounds is isomorphic to the space of possible resonant geometries. Composing in one space is composing in the other.

What does it mean to write music in the space of geometries rather than the space of pitches?

---

_The room is in the voice. The body is in the sound. The geometry is in the wave. To hear is to solve an inverse problem — and to compose is to choose which problems are worth solving._
