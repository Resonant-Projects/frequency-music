---
title: "The Identity Carrier"
publishDate: 2026-08-04
excerpt: "Identity can survive distortion when its carrier is preserved. This essay connects codecs, vocal stems, voice attribution, and modulation effects into a practical compositional strategy."
category: "interdisciplinary"
tags:
  - "AI-music"
  - "perception"
  - "signal-processing"
  - "composition"
  - "information-theory"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

The newest extraction cluster points to a useful compositional distinction: a sound's identity is not always carried by the same layer that makes it vivid.

Locodec makes this explicit in representation terms. Its 8 Hz, 768-dimensional continuous tokens trade temporal update rate against bandwidth, predictability, and long-horizon stability. At one level this is codec engineering. At another, it is a theory of musical memory: a system can afford to update slowly only if each update carries enough latent structure for the next moment to remain recognizable.

WanSong shifts the question from representation to arrangement. The model is described as generating five-minute multilingual songs with vocal and background-music stems in a single diffusion run. That matters because stem identity is not a post-hoc separation step there. Vocal identity and accompaniment identity are generated as coupled but distinct carriers. The song is not a single waveform later divided into parts; it is a coordinated identity field with at least two named streams.

The voice-actor attribution extraction gives the warning label. Professional actors crowd speaker-embedding space because voice identity is distributed across timbre, style, performance, register, and character. A clone detector that treats identity as one clean coordinate makes two different errors at once: it can falsely accuse non-enrolled voices and miss synthetic copies of enrolled voices. In musical terms, the voice is not a point. It is a bundle of partially separable invariants, and a performer can deliberately move some of them while holding others.

The differentiable modulation-effects extraction adds a more tactile version. Flanger, chorus, and phaser effects are built from short delays, phase relations, feedback, and time variation. The reported low-frequency loss weighting is fascinating because the model apparently needs a perceptual or structural anchor to learn delay times without falling into bad local minima. The identity carrier of a modulation effect may be less "the whole spectrum" than a low-frequency motion pattern that tells the ear how the effect is breathing.

Put together, these sources suggest a practical rule:

When composing with transformation, decide which layer carries identity before deciding which layer carries spectacle.

A voice can keep identity in formant motion while losing ordinary speech clarity. A generated song can keep identity in stem roles while its surface changes. A codec can keep identity in sparse high-dimensional tokens while discarding frame-by-frame detail. A modulation effect can keep identity in the slow path of delay motion while spectral coloration churns above it.

This gives a strong recipe for sound design:

1. Choose an identity carrier: voice, stem role, modulation trajectory, latent token rhythm, register, spectral envelope, onset pattern, or room response.
2. Make a second layer unstable: timbre, language, accompaniment, phase, distortion, density, or spatial position.
3. Let the listener hear the tension between the stable carrier and the unstable surface.

The interesting musical object is not the invariant alone. It is the bargain between what survives and what mutates.

That also reframes "recognition through distortion." Distortion is only compositionally rich when something remains available to recognize. The new extractions sharpen the question from "what survives?" to "where is survival stored?"

_Sources: recent extractions on Locodec low-frame-rate continuous audio tokens (`j978xyn771qzqjyj5t3c3q2ah18brza7`), WanSong diffusion-based long-form song generation with vocal/accompaniment stems (`j976t4qkbnd0zzk4y8en49re6x8btn74`), professional voice-actor clone attribution and speaker-embedding crowding (`j978nhjxgvpfdsmyeh7skkyyz58bv276`), and differentiable flanger/chorus/phaser modelling (`j972yndw1n1thvn0y6992w35z18bv54b`). Connections: voice identity, identity budget, identity invariant, spectral modulation, amplitude modulation, audio effects, source separation, latent temporal resolution._
