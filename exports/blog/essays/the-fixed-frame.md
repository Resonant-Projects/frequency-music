---
title: "The Fixed Frame"
publishDate: 2026-05-19
excerpt: "Musical transformation becomes audible when measured against a fixed frame-whether harmonic, timbral, spatial, or prosodic."
category: "composition"
tags:
  - "composition"
  - "mathematical-music-theory"
  - "tuning-systems"
  - "resonance"
  - "perception"
  - "signal-processing"
author: "Keith Elliott"
byline: "Freq"
---

## Motion Needs Something That Does Not Move

This batch points to a simple compositional constraint:

**Change becomes legible when it is measured against a fixed frame.**

The frame can be physical, computational, vocal, spatial, spectral, or harmonic. Ice does not explore every mathematically valid structure equally; it moves through nearby, path-dependent, metastable phases [S1]. Speech enhancement models appear to stabilize one part of their representation while letting another part adapt to noise and reverberation [S2]. Persona-driven speech synthesis separates static timbre from dynamic prosody [S3]. Sound-source localization becomes easier when spatial position is expressed through distance-matrix geometry rather than a brute-force search over all coordinates [S4]. Full-spectrum bioacoustics improves when separate frequency-band embeddings are fused instead of forcing all information through the 0-8 kHz baseband [S5]. Tonnetz theory turns harmonic change into movement through an incidence structure [S6].

The shared lesson is not that all systems contain one literal invariant. The sharper claim is practical:

**A musical transformation is easier to hear, control, and test when one layer stays fixed enough to make the moving layer readable.**

That is an old musical instinct in new clothes. A drone clarifies tuning. A ground bass clarifies variation. A meter clarifies syncopation. A timbral identity clarifies expressive prosody. A graph clarifies harmonic travel. What the sources add is a stronger engineering discipline: name the fixed frame, name the adaptive layer, and do not confuse one for the other.

---

## Nearby States Are Not Neutral

The ice source is useful because it refuses the fantasy of unconstrained possibility. Simulations may predict tens of thousands of mathematically valid water configurations, but physical water reaches only some of them under real pressure, temperature, direction, and timescale constraints [S1]. Ostwald's step rule says a transitioning system often moves to the nearest accessible state rather than the globally most stable one [S1].

For composition, this matters because generative systems often treat possibility space as if every point were equally reachable. But musical materials have their own accessibility: a singer's breath, an instrument's fingering, a room's resonance, a listener's memory, a tuning's voice-leading cost. The next state is not simply the most theoretically elegant state. It is the state the current frame makes reachable.

This suggests a useful rule:

**Let the fixed frame define reachability.**

If the frame is a tuning lattice, move by low-cost interval changes. If the frame is a vocal identity, vary contour and rhythm while keeping enough timbral code intact. If the frame is a spatial array, move in ways that preserve localizable distance relations. If the frame is a band-fusion texture, let each band change independently but keep the fusion logic stable.

The frame does not make the music static. It gives motion a physics.

---

## The Encoder Holds, The Decoder Bends

The speech-enhancement source gives the clearest computational version. Across controlled degradation, encoder layers maintain comparatively noise-invariant representations while decoder layers adapt strongly to acoustic conditions; the same asymmetry appears across multiple architectures, suggesting the behavior comes from the enhancement objective rather than one model design [S2]. Skip-connection boundaries mark sharp transitions in sensitivity [S2].

That is a beautiful model for musical transformation. One layer extracts what must survive. Another layer bends toward the current environment.

In compositional terms, the encoder layer might be a contour, harmonic path, rhythmic cell, source identity, or spatial relation. The decoder layer might be orchestration, distortion, room response, articulation, density, or register. A weak transformation lets every layer drift at once; the listener loses the reference. A stronger transformation protects an invariant while letting the surface negotiate local conditions.

The key is that invariance is not purity. The invariant layer is useful because it can be carried through change.

---

## Voice Splits The Problem

ATRIE gives the voice-synthesis version: static timbre and dynamic prosody are modeled as separable tracks, so character identity can remain consistent while emotional expression changes [S3]. The source treats timbre as a discrete, quantizable feature space and prosody as a dynamic, hierarchical, time-varying property [S3].

Musically, this distinction is immediately usable. Timbre answers, roughly, _who or what is speaking?_ Prosody answers, _how is it moving right now?_

A string quartet can keep instrumental identity fixed while transferring a prosodic contour between players. A synth patch can keep its envelope and pitch contour while stepping through timbral codebook states. A vocal line can preserve speaker color while changing affect through pitch contour, rhythm, loudness envelope, and timing.

The caution is important: if timbre and prosody are varied independently, the composition has to decide which layer carries identity. Otherwise the ear may hear mere parameter motion rather than expressive transformation.

---

## Geometry Is A Fixed Frame

The EDM localization paper reduces multi-source position estimation from a three-variable coordinate search to a smaller distance-matrix problem, and its direction-of-arrival method can eliminate continuous optimization by selecting TDOA candidates through eigenvalue-based costs on a rank-reduced Gram matrix [S4]. In plain terms: the geometry of relations can be a better frame than raw coordinates.

That is directly relevant to spatial composition. A sound's absolute position matters, but the relational geometry among sources may matter more: who approaches whom, which distances remain stable, which direction-of-arrival cues stay coherent, which sources collapse into ambiguity.

The same idea applies harmonically. Tonnetz theory uses combinatorial configurations to make relations among notes, chords, and scales explicit [S6]. The important object is not only the chord label, but the relation preserved as the music moves.

Geometry is a fixed frame when it tells us which transformations count as the same kind of motion.

---

## Fusion Needs Independence First

The bioacoustics source adds a spectral warning. Systems trained at 16 kHz often see only the 0-8 kHz baseband, discarding higher-frequency information important for non-human vocalizations [S5]. The proposed multi-band method decomposes calls into band-specific features and fuses them; some architectures produce decorrelated band embeddings, and that independence improves class separation after fusion [S5].

This matters for music because fusion is not the same as averaging. If every band is forced into one representation too early, high-frequency behavior can disappear. If every band is independent forever, the texture may never cohere. The useful frame is a fusion rule that preserves enough independence for each layer to speak and enough common structure for the listener to bind them.

Compositionally, this suggests writing multi-band textures as counterpoint rather than EQ. Low band, mid band, and high band can each carry different motion, but the fusion frame should be stable: shared pulse, shared contour family, shared harmonic path, or shared spatial trajectory.

---

## Harmony As Reference Geometry

The Tonnetz source gives the most explicit musical fixed frame. Diatonic seventh-chord voice leading can be characterized by a Fano configuration; pentatonic and twelve-tone systems can be represented by other combinatorial configurations; chromatic pitch classes and major triads can be related through the same D222 structure as the Eulerian Tonnetz [S6].

This does something subtle. It lets harmonic motion be judged by preserved incidence relations rather than by surface chord names alone. Two passages may use similar pitch material but traverse different graph paths. Conversely, two very different surfaces may preserve the same path through a configuration.

That is the fixed-frame principle in harmonic form:

**The graph is the measuring instrument for change.**

It does not replace listening. It gives composition a way to ask whether the intended relation survived transposition, orchestration, register change, or timbral masking.

---

## Studio Study: Fixed Frame / Adaptive Surface

Build a 75-second study with two layers:

- a fixed frame that remains identifiable across the whole piece;
- an adaptive surface that changes by section.

Use four passes.

1. **Harmonic frame.** Choose a small Tonnetz-like graph path of six to eight chord states. Keep that path constant while changing voicing, register, and instrumentation [S6].
2. **Prosody surface.** Assign one melodic or gestural contour to the passage. Render it with one stable timbral identity, then with the same contour transferred across timbres. Compare whether identity or contour dominates [S3].
3. **Degradation surface.** Add controlled noise or reverberation changes while preserving the harmonic path and contour. Treat the path/contour as the encoder-like invariant and the mix/orchestration as the decoder-like adaptive layer [S2].
4. **Band-fusion surface.** Split the texture into low, mid, and high bands. Let each band move independently for eight bars, then fuse them by reintroducing the shared graph path or contour [S5].

Add one optional spatial version: place two sources in a stereo or multichannel field and preserve their relational motion while changing absolute positions, echoing the EDM distinction between raw coordinates and relational geometry [S4].

The listening test is simple:

- Can the fixed frame still be recognized after each surface change?
- Which adaptive layer makes the frame clearer?
- Which layer destroys it?
- Does the nearest accessible next state feel more coherent than a theoretically attractive but remote jump [S1]?

The study fails if the fixed frame is only visible in the score or analysis. It has to constrain actual musical decisions and leave an audible trace.

---

## Hypothesis

If a composition preserves one explicit fixed frame while varying one adaptive surface, then listeners and analysis tools will identify stronger continuity than in a matched version where both layers vary simultaneously.

The evidence is convergent but not identical. Ice shows path-dependent reachability rather than free movement through all possible structures [S1]. Speech enhancement suggests an invariant/adaptive split between encoder and decoder layers under degradation [S2]. ATRIE separates static timbre from dynamic prosody while preserving identity [S3]. EDM localization shows that relational geometry can reduce and stabilize a difficult spatial inference problem [S4]. Multi-band bioacoustics shows that decorrelated spectral-band information can become more useful after fusion [S5]. Tonnetz theory provides a harmonic reference geometry for transformations [S6].

For composition, the practical command is:

**Before transforming material, decide what must stay still enough for the transformation to mean something.**
