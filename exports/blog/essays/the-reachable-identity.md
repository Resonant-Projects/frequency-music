---
title: "The Reachable Identity"
publishDate: 2026-08-19
excerpt: "Systems under pressure preserve the identity layer that remains reachable: rhythm, intelligibility, phase, perceptual band, watermark, or metastable form."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "psychoacoustics"
  - "composition"
  - "information-theory"
  - "AI-music"
  - "wave-physics"
author: "Keith Elliott"
byline: "Freq"
---

Some systems do not move toward the best possible state. They move toward the nearest state they can actually reach.

That sounds like a compromise, but it may be one of the deepest links between physics, perception, and music technology. A sound, a crystal, a codec, and a listener all carry more possible structure than they can preserve under real constraints. The question is not only "what is this thing?" It is "which version of this thing remains reachable after pressure, bandwidth, masking, or representation has done its work?"

## The Ice Lesson

The new complex ice phases are a clean physical example. Under extreme pressure, water does not jump directly to the most thermodynamically stable arrangement. It may pass through metastable intermediate phases, following Ostwald's step rule: the next state is often the nearest accessible one, not the final optimum.

Ice XXI and ice XXII are striking because their order is not simple. Ice XXI has 152 molecules in its repeating unit; ice XXII has 304. At fine scale, the pattern can look almost random. From the right distance, it becomes periodic.

That is already musical. A dense texture can sound irregular locally while carrying a large-scale pulse or harmonic field. A piece can be too complex to parse event by event but still reveal form when the ear integrates over a larger window. Structure is not absent. It is scale-dependent.

The more important lesson is path-dependence. The rate and direction of compression matter. Change the process and the material lands in a different phase. The identity of the result is not only written in the material; it is written in the path.

## The Ear's Compression

The Bark-scale dynamics plugin points to the perceptual version of the same idea. Conventional multiband processors split audio at convenient crossover points. Bark-scale processing instead follows the ear's critical bands: roughly twenty-four perceptual regions where masking and frequency resolution behave differently.

This means the ear is not a neutral spectrogram. It is already a compressor with uneven bins. Two partials that are separate in a linear frequency plot may compete inside one critical band. Two events with equal acoustic distance may have very different perceptual distance.

For composition, this changes what "nearby" means. The nearest accessible spectral move is not necessarily the nearest move in hertz. It may be the nearest move that avoids masking, preserves a formant, or keeps two layers in different critical bands. A Bark-scale arrangement is a kind of perceptual voice leading: not between notes, but between bands of audibility.

## The Codec's Choice

ClariCodec makes the tradeoff explicit. At 200 bps, there is no room to preserve speech as a rich acoustic object. The system must choose what survives. Its reinforcement-learning objective optimizes word error rate rather than acoustic reconstruction, reducing WER while keeping the decoder fixed.

That is a sharp distinction: intelligibility and fidelity are separable. The codec can preserve what was said while discarding much of how it sounded.

Musically, this is not an exotic edge case. It is the same question every arrangement asks. What is the minimum information needed for a phrase to remain itself? Is it contour? Rhythm? Harmonic function? Timbre? Gesture? A melody can survive on a ringtone speaker while a mix cannot. A groove can survive through a phone recording while spatial detail disappears. A vocal identity can survive pitch correction but fail under formant conversion.

The codec forces the hierarchy into the open. Under pressure, a system reveals which layer it treats as identity.

## The Watermark's Fragility

StreamMark adds a stranger case: a watermark designed to survive benign transformations but break under semantic manipulation. Compression and noise should leave the hidden mark readable. Voice conversion and speech editing should destroy it. The system is trying to distinguish surface damage from identity damage.

This is not just security engineering. It is a theory of musical sameness in signal-processing form.

If a watermark survives Opus compression, then lossy perceptual coding has not erased the structure the watermark needs. If the same watermark falls to chance after a deepfake attack, then the attack changed the layer the system treats as identity-bearing. The carrier was not merely degraded; it was reassigned.

PHALAR's phase-sensitive stem retrieval points in the same direction from the music side. Phase and pitch equivariance improve matching missing stems to a submix, and phase-preserving representations correlate better with human judgments of musical coherence than semantic baselines. Coherence is not only high-level label agreement. Some of it lives in timing, phase, and spectral relation.

So identity is not a single coordinate. It is a bundle of possible carriers: semantic content, contour, phase, formant structure, beat, chord relation, spectral envelope, stem relation. Each system preserves a different subset.

## Rhythm As A Low-Frequency Identity

The rhythm-formant analysis of Nyishi and Adi speech gives another layer. Low-frequency amplitude modulation, around the rhythm range, can classify related languages with substantial accuracy. MFCCs add finer phonological detail, but the macro-temporal modulation already carries identity.

For music, that is a useful bridge. A groove may act like a low-frequency fingerprint. Before pitch, timbre, or harmony are even considered, the amplitude envelope may encode a cultural or stylistic identity. The phrase "rhythm formant" is wonderful because it treats rhythm as a spectrum: not just durations on a grid, but dominant modulation frequencies with dispersion, peaks, and measurable shape.

This suggests a practical compositional parameter set:

- mean modulation frequency as perceived pulse density
- variance of modulation peaks as rhythmic looseness or volatility
- Bark-band separation as masking-aware orchestration
- phase coherence as stem belonging
- survivable bitrate as identity budget

Those are not ornaments around the music. They are conditions under which the music remains recognizable.

## A Compositional Rule

The shared pattern is simple:

1. A system contains many mathematically possible states.
2. A real constraint makes only some states reachable.
3. The reachable state is often not the ideal state.
4. What survives under the constraint reveals what the system treats as identity.

In ice, the reachable identity is a metastable crystal phase. In the ear, it is a critical-band organization. In a 200 bps codec, it is intelligibility without full fidelity. In a semi-fragile watermark, it is the difference between acceptable surface transformation and identity-altering edit. In rhythm-formant analysis, it is macro-temporal pattern before fine phonetic detail.

For composers, the useful rule is: write the constraint into the piece.

Make a passage whose identity survives only as rhythm after filtering. Make another whose identity depends on phase relation between stems. Build a form where the low-frequency groove remains readable under brutal compression while the high spectral surface is allowed to evaporate. Or reverse it: make a piece whose "self" is deliberately fragile, vanishing when a platform, model, or room changes the carrier.

The artistic question becomes less "how do I preserve everything?" and more "which identity should remain reachable?"

That question is practical. It can guide mix decisions, watermark placement, stem generation, generative-model evaluation, and arrangement. It also carries a little wonder: a crystal under pressure and a melody through a codec are both negotiating the same law. Possibility is huge. Reality is local. Music happens in the path between them.

---

_Sources: complex ice phases extraction (`j97dwcq0crkhg0n8z2tmyqypfd86f0ny`), Bark-scale dynamics extraction (`j977tjh3ka74caprsf86d4e3y185maah`), StreamMark watermarking extraction (`j97b5cq4em4evnpz1dzpjk37y1854ztc`), PHALAR phase-aware music representation extraction (`j978zvv39t3wqdw578e6g057b18683jf`), ClariCodec ultra-low-bitrate codec extraction (`j9793cmwt6f6t1s819xdqpay7x854g86`), and rhythm-formant speech analysis extraction (`j97dmcxraattrt4e9gsc7dsp4185rj2e`). Connects to [Where the Signal Breaks](where-the-signal-breaks.md), [The Evidence Carrier](the-evidence-carrier.md), [The Weighting Function](the-weighting-function.md), [The Control Surface](the-control-surface.md), and [The Unmeasured Coordinate](the-unmeasured-coordinate.md)._
