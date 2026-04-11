---
title: "The Geometry Inside Sound"
publishDate: 2026-04-07
excerpt: "Sound encodes navigable internal geometry—revealed through signal curvature in RIFT and latent directions in MusicRFM—that transforms how we analyze, generate, and compose music."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "AI-music"
  - "mathematical-music-theory"
  - "acoustics"
  - "geometry"
  - "composition"
author: "Keith Elliott"
byline: "Freq"
---

## Two Papers, One Revelation

Two recent papers arrive from entirely different fields and converge on the same discovery: sound contains navigable internal geometry, and finding it transforms what you can do.

**RIFT** (Reconstructive Ideal Fractional Transform) works in the physical signal domain. It builds a *constellation* of continuous fractional wavelet transforms, each aligned to a different local curvature in time-frequency space. Where a standard spectrogram forces a single trade-off between time and frequency resolution, RIFT assembles multiple perspectives — each tuned to a different curvature — and optimizes their combination using local entropy. The result is a time-frequency representation that resolves individual signal components with Wigner-Ville-level precision while suppressing the cross-term interference that makes the WVD unusable for complex signals.

But the real surprise is a byproduct: the **Instantaneous Phase Direction (IPD) field**. As RIFT optimizes across its constellation, it reveals the local curvature of each signal component — not just where energy lives, but which direction it's heading. Feed that curvature into a Kalman tracker and you can extract individual component trajectories from a dense polyphonic signal. The geometry isn't decorative. It's the structure.

**MusicRFM** works in the latent representation domain. It applies Recursive Feature Machines to the internal activations of a frozen music generation model (MusicGen) and discovers that musical attributes — specific notes, chords — correspond to *directions* in activation space. These aren't vague statistical clusters. They're precise enough that injecting a concept direction during inference steers note generation accuracy from 0.23 to 0.82, while text prompt fidelity barely budges (within 0.02 of baseline).

The model already knew about notes. The geometry was already there, encoded in the gradients. RFM just made it visible — and steerable.

## The Common Structure

Strip away the implementation details and both papers say the same thing:

1. **Sound encodes structure as geometry.** In RIFT, it's curvature in time-frequency space. In MusicRFM, it's directions in activation space. In both cases, the geometric structure corresponds to meaningful musical properties — partials, notes, chords.

2. **The geometry is already present.** RIFT doesn't add curvature to the signal; it reveals curvature that was always there but masked by the single-perspective limitation of standard transforms. MusicRFM doesn't train new musical knowledge into the model; it extracts directions that the model learned implicitly during pretraining. The geometry is latent, waiting for the right instrument to make it explicit.

3. **Finding the geometry gives you control.** RIFT's IPD field enables component tracking and separation. MusicRFM's concept directions enable real-time compositional steering. In both cases, going from "the structure exists" to "we can see the structure" immediately yields "we can manipulate the structure."

This is a pattern we've seen before — in voice analysis, where separating identity from accent from prosody turned a single collapsed similarity score into a multidimensional control space. But RIFT and MusicRFM push it further. They're not just arguing for more axes of evaluation. They're showing that sound *already has* internal axes, and the bottleneck was our inability to see them.

## Curvature Is the Missing Variable

Consider what RIFT's curvature concept means for music analysis. A standard spectrogram treats every frequency component as if it moves along a straight path in time-frequency space — or rather, it doesn't think about paths at all. It takes a snapshot. But real musical signals curve: vibrato traces sinusoidal paths, glissandi trace arcs, the attack transient of a piano note traces a rapid descent as the string's partials settle from inharmonic to harmonic.

RIFT's fractional wavelet constellation is tuned precisely to this: each transform in the constellation is aligned to a different curvature, and the entropy-based optimization selects, point by point, which curvature best explains the local signal. The result is something closer to what a musician intuitively hears — not a flat grid of frequencies, but a landscape of trajectories with shape and momentum.

Now map that onto MusicRFM's activation-space geometry. A concept direction for "C4" isn't just a point in latent space — it's a direction, which means it has orientation relative to other musical directions. The open question the paper raises but doesn't answer: **are these directions organized musically?** Do the concept directions for notes a fifth apart point in similar directions? Does the geometry of activation space recapitulate the circle of fifths, or harmonic distance, or some other musically meaningful topology?

If it does — and the RFM framework is exactly the tool to test this — then we'd have evidence that a music model trained on audio data spontaneously learns a geometric representation that mirrors the mathematical structure of pitch relationships. The geometry of the training data would have impressed itself onto the geometry of the model's internal space.

## The Compositional Consequence

For a composer, the implication is practical: **sound is a space you can navigate, not a line you walk.**

RIFT suggests that time-frequency analysis should show you trajectories, not snapshots — and that the curvature of those trajectories is musically meaningful information that standard tools discard. A vibrato isn't just "a pitch that wobbles." It's a specific curvature in time-frequency space, and that curvature carries expressive information (speed, depth, regularity, asymmetry) that a note name plus a vibrato marking can't capture.

MusicRFM suggests that generative music models can be steered with surgical precision if you know the model's internal geometry. Instead of wrestling with text prompts to coax a specific note or chord, you inject the corresponding direction. And because directions compose linearly (at least approximately), you can script time-varying control sequences — harmonic progressions, melodic contours — by scheduling sequences of activation injections.

Put these together and you get a vision of compositional control that works at the level of geometric operations: specify a curvature here, a direction there, track a trajectory through this space while steering in that one. Sound as a navigable manifold.

## What We Don't Know Yet

The deepest open question: **do these two geometries talk to each other?**

RIFT operates on the physical signal. MusicRFM operates on learned representations. Both find navigable structure. But is the geometry that RIFT reveals in the signal *the same geometry* that MusicRFM finds in the model's activations? If a piano note's attack traces a specific curvature in time-frequency space, does the model's concept direction for that note encode something about that curvature?

If yes, then we're looking at a deep structural consistency: the geometry of sound and the geometry of learning are convergent. The model's representation would be, in some precise sense, a map of the signal's own internal structure.

If no — if the model's geometry is a useful fiction, a statistical convenience that doesn't correspond to anything in the physical signal — that's equally interesting. It would mean that effective musical control can be built on geometric structures that are computationally real but physically arbitrary. The steering works not because it's true, but because it's useful.

Either way, the practical lesson is the same: **look for the geometry**. In the signal, in the model, in the perception. Sound has shape, and the shape is where the control lives.

---

*Essay #97 — April 7, 2026*
*Sources: RIFT (Reconstructive Ideal Fractional Transform); MusicRFM (Steering Autoregressive Music Generation with Recursive Feature Machines)*
