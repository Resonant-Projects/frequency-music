---
title: "The Grain of Listening"
publishDate: 2026-04-02
excerpt: "Perception discretizes continuous signals into events at multiple grain sizes—from notes to phrases to forms. This essay explores why discrete representations carry more useful information than continuous ones, and what this means for composition and musical analysis."
category: "perception"
tags:
  - "perception"
  - "signal-processing"
  - "information-theory"
  - "composition"
  - "mathematical-music-theory"
  - "psychoacoustics"
author: "Keith Elliott"
byline: "Freq"
---

## The Question From Last Time

Essay #86 showed that optimal transport — moving one distribution to another at minimum cost — is the hidden geometry of voice leading, tuning, and spectral morphing. But transport theory assumes you know what the distributions _are_. It assumes the continuous signal has already been parsed into something countable: notes in a chord, frequencies in a spectrum, positions on a circle.

Who does the parsing? And why does parsing always mean _discretizing_?

---

## Three Counters

Three recent findings, from three unrelated fields, converge on the same strange fact.

**The prosodist.** A team evaluating text-to-speech systems needed to measure how _varied_ the prosody was across generated samples. They tried the obvious approach: continuous acoustic features — pitch contours, energy envelopes, duration statistics. The metrics correlated poorly with human perception. What worked instead was encoding speech into discrete semantic tokens (via HuBERT or WavLM) and computing the _edit distance_ between token sequences. Discrete beats continuous. The perceptual system doesn't hear a pitch contour — it hears a sequence of prosodic events, and judges variety by how differently those events are arranged.

**The plant.** Plants, it turns out, can track the number of discrete events in their environment — a form of rudimentary numerical cognition without a nervous system, without neurons, without anything resembling a clock or a counter. They don't measure the continuous intensity of stimulation. They count the _discrete arrivals_. This raises an uncomfortable question: if a system without a brain can count events, counting might be more fundamental than computation. It might be what physical systems do _before_ they compute.

**The codec.** Neural audio codecs compress sound by decomposing it into layers through Residual Vector Quantization (RVQ): quantize the signal, compute the residual, quantize the residual, iterate. The problem is that each stage's residual is exponentially smaller than the last — the continuous remainder vanishes geometrically, making later stages nearly useless. The fix? A discrete intervention: invertible layer normalization at each stage, rescaling the residual back to a workable magnitude. The continuous process fails; the discrete correction saves it.

---

## The Discretization Instinct

These three cases are doing the same thing. They are converting continuous phenomena into discrete events — and finding that the discrete representation carries more useful information than the continuous one.

This shouldn't be surprising. It shouldn't, but it is, because our theoretical frameworks in acoustics and signal processing are overwhelmingly continuous. We think in waveforms, spectra, envelopes. Fourier analysis decomposes a signal into a continuum of frequencies. The physics of vibration is differential equations — continuous all the way down.

But perception isn't. Not at any scale.

A cochlea performs a continuous-to-discrete conversion: the basilar membrane's mechanical frequency response is continuous, but the neural firing patterns it produces are discrete events — spikes, with timing, occurring or not. Auditory scene analysis works by grouping these discrete events into streams. Pitch perception quantizes the frequency continuum into categories (we hear "A" or "B♭," not "somewhere between"). Beat perception quantizes continuous time into a grid. Consonance perception quantizes the infinite space of interval ratios into a handful of categories.

The plant does the same thing the cochlea does, just with chemistry instead of neurons. The prosody metric does the same thing beat perception does, just with learned tokens instead of innate categories. The codec fix does the same thing quantization does, just in reverse — adding discretization to prevent continuous decay.

---

## Why Discrete?

There's a deep reason for this. Continuous signals have infinite degrees of freedom per unit of... anything. An analog audio signal has uncountably many values in any finite interval. No finite system can represent, store, or respond to all of them. Discretization isn't a compromise — it's the only option for any physical system that needs to _act on_ what it perceives.

But there's more. Discrete representations are compositional in a way that continuous ones aren't. You can rearrange tokens, count events, compute edit distances between sequences. You can't meaningfully rearrange a pitch contour — or rather, any rearrangement requires first parsing it into discrete segments. Syntax requires segmentation. Meaning requires boundaries.

This is why the prosody metric works: human listeners don't evaluate prosodic diversity by correlating continuous contours. They parse speech into discrete prosodic events (stresses, pauses, pitch accents, boundary tones) and evaluate variety in the _arrangement_ of those events. Edit distance captures this; correlation of continuous features doesn't.

And this is why music has notes, beats, and measures — not because the physics requires them (it doesn't; a vibrating string produces a continuous waveform), but because perception requires them. Discretization is the price of syntax. To have musical grammar — phrases, periods, cadences, development — you must first have discrete musical events that can be arranged, permuted, varied, and compared.

---

## The Exponential Decay Problem

The RVQ finding illuminates something crucial about the relationship between continuous decomposition and discrete correction. When you try to capture a signal through iterated residual analysis — subtract the approximation, analyze the remainder, repeat — the remainders decay exponentially. Each stage captures less and less. The _interesting_ information (fine texture, subtle timbral detail, the stuff that makes a Stradivarius different from a student violin) lives in exactly the stages that contribute least.

This is a parable for musical analysis. Schenkerian analysis does something structurally identical to RVQ: strip away surface elaboration, find the "fundamental structure," then claim the residual (all the actual notes) is "prolongation" of the skeleton. But the exponential decay problem suggests that what we call "surface detail" isn't noise on top of a structure — it's the fine-grained information that requires an entirely different representational framework. You can't reach it by iterating the same analysis at smaller scales.

The codec's fix — normalizing each residual back to a standard magnitude — is equivalent to saying: every scale of detail deserves its own full-resolution analysis. Not a zoomed-in version of the same analysis, but a re-calibrated one. This is, implicitly, a theory of hierarchical listening: each perceptual grain size gets its own discrete vocabulary.

---

## The Grain Spectrum

So perception discretizes. But into _what_? Not into a fixed grid. The prosody work shows that the "right" discrete tokens emerge from self-supervised learning — they aren't predefined phonemic categories but learned statistical regularities in the speech signal. Different tokenizers (HuBERT, WavLM) produce different vocabularies, and they're approximately equally good. The discretization isn't unique.

This suggests that the grain of perception is a _parameter_, not a constant. You can listen at different grain sizes: the level of individual notes, of motives, of phrases, of sections, of the whole piece. Each grain size has its own discrete vocabulary (notes, figures, themes, forms) and its own notion of similarity (interval, contour, tonal relationship, genre).

The optimal transport framework from essay #86 operates at a single grain size — it needs to know what the "particles" are before it can compute the cost of moving them. But a complete theory of musical perception would need transport across _multiple grain sizes simultaneously_. Moving from a C major chord to an F major chord (fine grain) is cheap voice leading. Moving from a sonata exposition to a development section (coarse grain) is a different kind of transport entirely, with different particles, different costs, different geometries.

---

## Compositional Implications

**1. Compose the grain, not just the content.** If the discretization itself is a parameter, a composer can choose _what counts as an event_ at each moment in a piece. Ligeti's micropolyphony dissolves individual notes into a continuous texture — it shifts the perceptual grain from note-level to texture-level. Nancarrow's player piano studies create multiple simultaneous grain sizes through polytempo. The choice of grain is a compositional decision prior to any choice of pitch or rhythm.

**2. Edit distance as a compositional metric.** If prosodic variety is best measured by edit distance between token sequences, musical variety might be too. Two melodies that share most of their tokens but differ in a few positions (low edit distance) sound like variations. Two melodies with no shared tokens (high edit distance) sound like contrasting themes. Composers already think this way intuitively — now there's a formal metric for it.

**3. Normalization as a compositional technique.** The RVQ insight — that each scale of detail needs its own full-resolution analysis — suggests a compositional strategy: write music where the "residual" at each structural level is _rescaled_ to be as important as the level above it. This is arguably what great variation form does: each variation is a "residual" that's promoted to full structural weight.

**4. Count the uncountable.** If even plants count discrete events, then counting — numerical cognition in its most basic form — is a prerequisite for temporal perception, not a consequence of it. Music that exploits the boundary between countable and uncountable (additive rhythms that blur into irrational proportions, tuning systems that hover between rational and irrational intervals) is playing at the edge of perception's most fundamental operation.

---

## What This Means

The continuous universe makes sound. Perception, at every scale from chloroplast to cortex, makes _events_. The gap between continuous signal and discrete percept is where music lives — not in either domain alone, but in the translation between them.

Optimal transport (#86) tells us how to measure cost in a space of discrete particles. The grain of listening tells us that the choice of particles is itself a compositional variable. The next question: if you can move between different grain sizes — hearing the same sound as a single event, then as a texture of micro-events, then as a rhythmic pattern — what is the geometry of _that_ space? What does it cost to change not the notes, but the resolution at which you hear them?

---

_Essay #87 of the Frequency Music project. Connecting weighted edit distance in prosody metrics, plant numerical cognition, and residual vector quantization to the perceptual necessity of discretization._
