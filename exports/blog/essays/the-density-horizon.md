---
title: "The Density Horizon: Where Notes Dissolve Into Texture"
publishDate: 2026-03-20
excerpt: "At ~24-30 notes per second, individual musical notes dissolve into continuous texture-a critical phase transition where discrete melodic perception gives way to statistical texture listening."
category: "interdisciplinary"
tags:
  - "perception"
  - "psychoacoustics"
  - "wave-physics"
  - "composition"
  - "mathematical-music-theory"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The Threshold No One Expected

When the developers of Amanous — an algorithmic composition system for the Yamaha Disklavier — ran a density sweep to characterize their superhuman piano textures, they found something striking. Up to about 24 notes per second, standard melodic analysis works: you can track individual pitch sequences, measure intervallic content, assess contour. The music is dense but decomposable. Each note is, in principle, a separate event.

Then, somewhere between 24 and 30 notes per second (bootstrap 95% CI: 23.3–50.0), the metrics break. Not gradually — categorically. Single-domain melodic measures lose discriminative power. The statistical tools that work for 20 notes per second simply can't tell you anything meaningful about 35 notes per second. The researchers call this a "computational saturation transition." To make sense of what's happening beyond the threshold, you need _cross-domain coupling_ — analyzing how pitch, rhythm, register, and velocity interact as a unified texture rather than as separable streams.

This is not a limitation of the metrics. It's a property of the music.

---

## The Continuum's Tollgate

In 1957, Karlheinz Stockhausen proposed that pitch, rhythm, and timbre are the same phenomenon at different timescales. Slow down a harmonic series and you get a polyrhythm. Speed up a polyrhythm and you get a timbre. The continuum is real — but it's usually discussed as a theoretical curiosity, an elegant observation about the unity of musical time. No one asks: _what happens at the transition?_

Amanous accidentally answers this. The saturation transition at ~24–30 notes/second is the **density horizon**: the point where the Stockhausen continuum actually activates. Below this threshold, we're in the regime of discrete events — notes that a listener (or an algorithm) can individuate, track, and analyze independently. Above it, we've crossed into the regime of continuous texture — where what matters isn't any individual note but the statistical properties of the aggregate: its density, its spectral centroid, its register spread, its dynamic envelope.

This is the tollgate between music-as-notation and music-as-signal. Below the horizon, a score is a reasonable representation. Above it, a spectrogram is a better one.

And the number itself — 24 to 30 Hz — is not arbitrary. It sits precisely in the range where temporal resolution gives way to pitch perception. Below ~20 Hz, we hear individual events as rhythmic pulses. Above ~20 Hz, we begin to perceive continuous pitch. The density horizon for piano notes is right at this psychoacoustic boundary, which makes physical sense: it's the threshold where your auditory system stops tracking individual attacks and starts integrating them into a tonal mass.

---

## The Uncertainty Connection

The Gabor limit tells us that Δt · Δf ≥ 1/(4π). To localize an event in time, you sacrifice frequency precision. To know the pitch, you need duration.

At the density horizon, the inter-onset interval between notes (~33–42 ms) approaches the temporal resolution needed to identify each note as a separate pitch event. Below the horizon, there's enough time between onsets for the auditory system to resolve both _when_ and _what_ for each note. Above it, the onsets blur together and the ear shifts to a different mode of listening — perceiving the _statistical envelope_ of many events rather than the _sequential identity_ of each one.

This is the uncertainty principle made compositionally tangible. The Amanous system, by pushing note density through the horizon, forces the listener across the Gabor boundary. What was a sequence of pitches becomes a textural wash — not because the notes aren't there, but because the act of perceiving them at that rate destroys the time resolution needed to hear them as separate events.

Xenakis intuited this in the 1950s when he argued that above a certain density, individual notes become "grains" in a statistical cloud. He used stochastic distributions to compose these clouds directly, bypassing note-level thinking entirely. Amanous unifies Xenakis's stochastic approach with Nancarrow's tempo canons, and in doing so, it empirically locates the transition Xenakis theorized: around 25 notes per second on a piano.

---

## The Polyphony Catastrophe, Revisited

The density horizon also reframes the polyphony problem. AI systems that analyze polyphonic music show "consistent performance degradation" as polyphonic density increases — not smooth degradation but categorical collapse. Counting simultaneous voices, tracking concurrent events, estimating durations: all break at high polyphonic density.

The density horizon suggests why. These systems are trying to maintain a discrete-event representation of something that has crossed into the continuum regime. It's not that the AI is bad at polyphony — it's that the _task description_ is wrong. Asking "how many notes are playing right now?" at 30 notes per second is like asking "what color is this pixel?" when looking at an impressionist painting from across the room. The question presupposes a level of resolution that the signal doesn't support.

The right questions above the horizon are statistical: What's the density? What's the spectral centroid? How is the energy distributed across registers? These are the cross-domain coupling measures that Amanous had to develop when single-domain metrics failed.

---

## Restoration and the Arrow of Dissolution

There's a beautiful complement to this from the emerging field of Music Source Restoration. Where Amanous pushes notes _forward_ through the density horizon into texture, MSR tries to reach _backward_ through production processes to recover pre-production audio — reversing equalization, compression, reverberation, and other transformations that blur individual sources.

The insight from MSR is that this recovery is possible _but not through simple inversion_. You can't un-EQ by inverting the EQ curve, because the production process destroyed information — it collapsed distinctions that existed in the original. The best MSR systems use a two-stage approach: first, ensemble separation to extract approximate stems, then dedicated restoration to reconstruct what the mixing process destroyed.

This is exactly the challenge of working at the density horizon, run in reverse. The mixing process is a many-to-one map (multiple stems → one mix), just as the density horizon is a many-to-one map (multiple notes → one texture). In both cases, information is lost — not destroyed, but _folded_ into a lower-dimensional representation that can't be unambiguously unfolded.

The fact that MSR works at all — that you can recover stems from a mix, imperfectly but meaningfully — suggests that the density horizon isn't a brick wall. It's a lossy compression. Some structural information survives the transition from event to texture, encoded in the statistical properties of the aggregate. A sufficiently sophisticated listener (or algorithm) can partially reconstruct the discrete events from the continuous texture, just as MSR can partially reconstruct dry stems from a wet mix.

But _partially_ is the operative word. The Measurement Wall sets a floor on how much can be recovered. The Listening Gap sets a floor on how much can be described. And the density horizon sets a floor on how much can be individuated. These are three faces of the same fundamental constraint: the lossy interface between dimensions.

---

## Compositional Implications

For a composer, the density horizon isn't a limitation — it's a resource. Knowing _where_ the transition happens gives you a new parameter to control: the degree of note-individuation.

At 10 notes/second, every note is heard as a discrete event. A passage at this density is _melodic_ — it rewards pitch tracking, invites contour perception, activates tonal cognition. At 40 notes/second, no note is individually perceptible. A passage at this density is _textural_ — it rewards timbral listening, invites spectral comparison, activates a different cognitive mode entirely.

Between 20 and 30 notes/second, you're in the transition zone. Here, the music is ambiguous — it flickers between event and texture depending on register, dynamics, and the listener's attention. This is the most compositionally interesting region, because the listener's perceptual mode is unstable. The same passage can be heard as a rapid figuration (if you try to track individual notes) or as a textural wash (if you let go and hear the aggregate). The choice of listening mode changes what the music _is_.

Nancarrow and Xenakis both intuited the power of this zone. Nancarrow's canons often accelerate voices through the horizon, starting melodic and ending textural. Xenakis's stochastic works often hover near the boundary, creating textures that are almost but not quite resolvable into individual events. Ligeti's micropolyphony lives exactly at the density horizon — many individual voices moving slowly enough to be notionally separable, but dense enough that the ear gives up and hears texture.

The compositional toolkit this suggests:

- **Density ramps** — accelerating or decelerating through the horizon as a structural device
- **Register-dependent horizons** — the threshold likely differs by register (lower notes need more time to establish pitch, so the horizon may be lower for bass voices)
- **Attack-envelope shaping** — sharp attacks maintain individuation at higher densities than soft attacks (percussive notes resolve more easily than legato)
- **Horizon counterpoint** — simultaneous layers at different densities, some above and some below the horizon, creating a texture that is partly discrete and partly continuous

---

## The Phase Map of Musical Time

The density horizon, the Gabor limit, the Stockhausen continuum, and the polyphony catastrophe are all describing the same underlying structure: _musical time has phases_, and the transitions between phases are where the most interesting compositional possibilities live.

Below ~1 Hz: Form. We perceive large-scale structure — sections, movements, arcs.
~1–20 Hz: Rhythm. We perceive individual events with temporal pattern.
~20–30 Hz: **The density horizon.** Discrete events dissolve into continuous texture.
~30–20,000 Hz: Pitch and timbre. We perceive tonal and spectral qualities.

The density horizon is the critical phase transition in this continuum — the point where the musical substance changes state from particle to wave, from countable events to continuous field. Amanous found it empirically. Xenakis theorized it compositionally. Gabor proved it mathematically. And every listener who has heard a Nancarrow canon accelerate into a blur has felt it perceptually.

The music is the phase transition.

---

_Connections: [The Uncertainty of Sound](the-uncertainty-of-sound.md), [The Polyphony Problem](the-polyphony-problem.md), [The Spectrum as Score](the-spectrum-as-score.md), [The Measurement Wall](the-measurement-wall.md), [The Listening Gap](the-listening-gap.md), [The Topology of Time](the-topology-of-time.md)_

_Sources: Amanous (Distribution-Switching for Superhuman Piano Density on Disklavier), Music Source Restoration with Ensemble Separation and Targeted Reconstruction, FLAC (Few-shot Acoustic Synthesis with Multimodal Flow Matching)_
