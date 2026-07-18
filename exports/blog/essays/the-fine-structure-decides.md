---
title: "The Fine Structure Decides"
publishDate: 2026-05-12
excerpt: "Wavelet scattering, Bark bands, phase-equivariant music embeddings, encoder failures, Tonnetz paths, and metastable ice phases all point to the same compositional principle: fine structure decides whether a named musical symbol holds."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "psychoacoustics"
  - "AI-music"
  - "composition"
  - "mathematical-music-theory"
  - "perception"
author: "Keith Elliott"
byline: "Freq"
---

## The Category Is Not the Event

This batch keeps returning to a deceptively simple claim: the named category is not what decides the musical result. The decisive information often lives in fine structure — phase, critical-band placement, encoder residue, voice-leading adjacency, compression path, or microscopic artifacts that survive after the obvious label has been assigned.

The speech-deepfake paper is explicit about this. WST-X does not treat speech as only a sequence of phonetic or semantic tokens; it uses wavelet scattering to preserve multi-scale, deformation-stable features, and the authors emphasize that small temporal averaging with high frequency and directional resolution helps capture subtle synthetic artifacts [S1]. The artifact is not the word. It is the residue around the word.

PHALAR makes the same argument from musical retrieval. A model that keeps pitch-equivariance and phase-equivariance retrieves missing stems better and correlates more strongly with human musical-coherence judgments than phase-discarding semantic baselines [S4]. Again, the identity of the musical object is not exhausted by its semantic tag: “drums,” “bass,” “chord,” “stem.” Phase and temporal relation help decide whether the object belongs.

The fairness benchmark adds a warning. Audio encoder design, compression quality, silence injection, masking, and reverberation can change robustness and bias more than language-model scale does [S5]. Under degradation, a recognizer may hallucinate repetitions or flatten group differences by making everyone fail. That is a brutal version of the same principle: when the fine structure is damaged, the high-level decoder may confidently invent the wrong world.

For music, this suggests a compositional law worth testing:

**The listener may name the symbol, but the fine structure decides whether the symbol feels true.**

---

## Perceptual and Geometric Grids

The Bark-scale dynamics source gives the perceptual version. Conventional multiband processors often choose crossovers for engineering convenience, while Bark-scale processing aligns bands with critical regions of human hearing [S2]. Even if two compressors share the same broad goal — “control dynamics” — the placement of the internal grid changes what is masked, emphasized, or released. The grid is a silent compositional decision.

Tonnetz theory supplies a harmonic grid. In the new combinatorial account, chords and scales become configurations: Fano structures for diatonic seventh chords, Desargues configurations for pentatonic systems, Cremona-Richmond geometry for twelve-tone resources, and D222/D228 structures for chromatic and Tristan-family relations [S6]. A chord label may remain the same while its graph neighborhood changes the possible paths into and out of it. The event is partly determined by adjacency.

Ice contributes the physical analogy. Water does not simply move to the globally optimal crystalline form. Compression rate, direction, and timescale can route it through nearby metastable phases, and the mathematically possible space of water structures is far larger than the set that nature actually realizes [S3]. Physical access filters abstract possibility.

That is the cross-domain bridge: perceptual bands, phase-preserving embeddings, scattering features, encoder bottlenecks, Tonnetz graphs, and metastable crystal paths are all **access structures**. They decide which distinctions remain available to the system.

---

## A Studio Study: Same Label, Different Fine Structure

A practical experiment could make this audible in under an hour.

Write a short loop whose foreground symbols stay fixed: one melody, one chord progression, one tempo, one stem layout. Then render four versions that differ only in fine-structure design:

1. **Phase-aware version.** Preserve transient phase relationships and microtiming between stems. Avoid phase-randomizing effects. Let coherence come from alignment [S4].
2. **Scattering-artifact version.** Add extremely small synthetic artifacts: narrow modulation, slight spectral instability, or short-time texture changes. Keep them below obvious “effect” status, then ask whether the loop feels more human, synthetic, brittle, or alive [S1].
3. **Bark-grid version.** Shape dynamics in approximately critical-band regions rather than broad arbitrary bands. Let masking and release follow hearing’s own segmentation [S2].
4. **Graph-path version.** Keep chord names fixed, but choose voicings by a Tonnetz-like adjacency rule. Make the harmony arrive by reachable neighboring moves rather than by block substitution [S6].

Then abuse the loop: low-bitrate compression, added silence, reverberation, and masked chunks [S5]. Which version survives? Which one hallucinates musically — collapsing into loopiness, muddiness, or false emphasis? Which retains identity after damage?

The expected outcome is not that one technique always wins. The useful result would be a map of which fine structures are load-bearing for a given piece. Some music may depend on phase. Some may depend on critical-band separation. Some may depend on graph continuity. Some may survive as a coarse symbolic skeleton.

---

## Why It Matters

This connection is compositionally important because it reframes “detail work” as structural work.

Mix engineers already know that tiny phase shifts can make a drum kit lock or disappear. Orchestrators know that register and masking determine whether a line exists. Harmonists know that a chord’s function depends on where it came from and where it can go. Machine-listening papers are now giving us sharper language for the same intuition: representations succeed or fail according to which invariances they preserve and which details they throw away.

So the question is not only “What is the chord?” It is also:

- What fine structure makes this chord believable?
- Which grid is the listener actually using: Bark bands, pitch-class adjacency, phase coherence, rhythmic deformation, or encoder residue?
- What survives compression, masking, silence, and repetition?
- What disappears when the representation becomes too coarse?

A score names events. A recording realizes them. A listener reconstructs them. Between those three stages, fine structure is the treaty that keeps meaning intact.

The category may get the title. But the fine structure decides whether the music holds.
