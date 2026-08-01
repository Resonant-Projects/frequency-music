---
title: "The Addressable Layer"
publishDate: 2026-07-25
excerpt: "Composition begins where a system can name the layer it is allowed to move: voice, contour, melody, or room."
category: "interdisciplinary"
tags:
  - "composition"
  - "AI-music"
  - "speech-synthesis"
  - "acoustics"
  - "spatial-audio"
  - "representation-learning"
author: "Keith Elliott"
byline: "Freq"
---

The recent extraction cluster keeps returning to the same practical question: when a sound becomes editable, what exactly is being addressed?

OmniCustom answers with two references at once. A generated talking-head video can preserve visual identity from an image while imitating vocal timbre from a reference audio sample, and the spoken words can still come from a text prompt. The sound is not one fused object. It has at least three named handles: content, voice, and face.

The Yoruba speech-synthesis extraction makes the same point without neural scale. TTSYoruba begins with tone-marked text, then chooses among recorded diphones and derives contextual rising and falling contours from level-tone input. The addressable layer is not simply "pitch." It is a phonological relation between text, segment, tone category, nasal status, and realized F0 motion.

The full-song generation extraction adds another version. Its cover-song task extracts and discretizes melody cues from reference audio so style can change while melodic content remains recognizable. Melody becomes a handle: not the whole recording, not the production surface, but a tractable line that can guide a different rendering.

Even the room-acoustics extraction belongs here. The image-source model turns reflections into countable geometric events, and the Gauss-circle reframing treats room impulse responses as a lattice problem with time-frequency controls and reflection weights. A room is normally heard as continuous ambience. In the model, it becomes an addressable layer of paths, delays, weights, and spectral damping.

Across these sources, the useful principle is:

**Composition begins where a system can name the layer it is allowed to move.**

## From Sound To Handle

This is more specific than saying that audio is decomposed. Decomposition alone is analytical. A spectrogram decomposes sound, but a composer still needs to know which coordinate can be touched without destroying the musical object.

An addressable layer has three properties.

First, it has a boundary. Vocal timbre is not spoken content. Tone category is not every acoustic detail of a syllable. Melody is not arrangement. A reflection path is not the whole room.

Second, it has a control action. A text prompt can change words while a reference voice stays fixed. A phonological rule can turn a level tone into a contour. A melody cue can steer a cover version. A reflection weight can alter the density or color of reverberation.

Third, it has a perceptual test. If the layer is real enough to compose with, listeners should hear something survive and something move. The reference voice should remain recognizable across text. The Yoruba tone contour should remain intelligible in context. The cover should still carry the source melody. The modeled room should change spatial impression without collapsing into arbitrary filtering.

That gives a nice constraint for tool building: do not expose every latent dimension as if it were meaningful. Expose the layers whose movement makes a musically legible difference.

## The Room Joins The Voice

The room-acoustics source is the important twist. It keeps this from becoming only an AI-generation story.

A room impulse response is also a kind of voice. It says where the sound has been. Early reflections reveal geometry; late reflections reveal density and absorption; frequency-dependent damping reveals material. When the image-source model turns those reflections into virtual sources, it gives the room an addressable anatomy.

That connects back to vocal timbre and melody preservation. In each case, the composer is not editing waveform samples directly. The composer is editing a structural cause:

- the body implied by a voice;
- the contour implied by a tonal grammar;
- the line implied by a melody extractor;
- the architecture implied by a reflection field.

The audible result matters, but the compositional control sits one layer upstream.

This suggests a practical instrument: a phrase whose melody, voice, tone-contour grammar, and room geometry are independently addressable. Keep the syllables fixed. Move the contour rules. Freeze the melody but change the carrier. Move the room from sparse early reflections to dense spectral damping. Then reverse the experiment: keep the room fixed and let the voice become less stable, or keep the voice fixed while the room becomes increasingly impossible.

The musical question becomes: which layer does the listener treat as identity?

## A Caution About Naming

There is a risk in every addressable layer: once named, it can look owned by the tool. That is especially dangerous for voices, accents, tone systems, and culturally specific speech patterns. The layer may be technically separable without being ethically free-floating.

So the compositional rule should be stricter than the engineering rule. A layer is not ready to use just because it can be isolated. It is ready when its source, consent, perceptual meaning, and musical role are clear.

The delight is that this rigor does not make the music smaller. It makes the instrument better defined. A good control is not a magic slider over "sound." It is a promise about what will move, what will remain, and why the listener should care.

The addressable layer is the place where that promise becomes playable.

---

_Sources: OmniCustom sync audio-video customization (`j979qj7tq30js7gjqa0s227x2h8b4y83`), TTSYoruba rule-based diphone speech synthesis (`j978ns7a5g49k1wkjrq8ks8pnn8b45hc`), unified full-song generation with melody-preserving cover generation (`j97292c1kb5cbq1m29em72hbrd8b4wwt`), and image-source room impulse response modeling via Gauss-circle lattice counting (`j97f8jexyvca60175626jxb7hs8b4528`)._

_Connections: [The Carrier Can Change](the-carrier-can-change.md), [The Control Surface Inside The Representation](the-control-surface-inside-the-representation.md), [The Actionable Invariant](the-actionable-invariant.md), [The Coordinate Instrument](the-coordinate-instrument.md), [The Room That Isnt There](the-room-that-isnt-there.md)._
