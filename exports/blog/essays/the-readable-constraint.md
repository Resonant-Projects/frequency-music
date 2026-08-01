---
title: "The Readable Constraint"
publishDate: 2026-05-18
excerpt: "Musical coherence emerges not from unchanging surfaces but from preserving task-relevant readability layers-whether rhythmic modulation, alignment, intelligibility, or harmonic path."
category: "interdisciplinary"
tags:
  - "composition"
  - "perception"
  - "signal-processing"
  - "mathematical-music-theory"
  - "information-theory"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

## What Has To Stay Legible?

This batch keeps returning to the same compositional pressure from different directions:

**A musical transformation is only coherent if something important remains readable.**

Readable does not mean unchanged. It means recoverable enough to function.

In the Nyishi/Adi rhythm study, language identity is partly readable from low-frequency amplitude modulation. Rhythm formants in the roughly speech-rhythm band carry macro-temporal structure, while MFCC-style spectral features carry finer phonological information [S1]. In Qwen3.5-Omni, prosody becomes unstable when text and speech tokenizers do not align, and ARIA improves streaming synthesis by dynamically aligning the units that carry linguistic and acoustic timing [S2]. In ClariCodec, the codec stops treating acoustic reconstruction as the whole goal and instead optimizes the encoder for intelligibility at 200 bps [S3].

Those are all versions of the same question:

**Which constraint must survive the transformation?**

For speech, the answer might be intelligibility, prosody, language rhythm, or deepfake-detectable spectral residue. For music, the answer might be pulse, contour, harmonic adjacency, timbral identity, performer trace, or formal path.

The beautiful part is that the answer changes with the task. There is no universal "essential signal." There is only task-relevant readability.

---

## Rhythm Is A Low-Frequency Signature

The rhythm-formant source is especially useful for music because it treats rhythm as spectrum, not only notation. Speech rhythm is measured through low-frequency amplitude modulation: dominant peaks, mean dominant-peak frequency, and variance of dominant frequencies [S1].

That maps cleanly onto a studio test. A groove has a foreground pattern, but it also has a modulation spectrum: where energy pulses over time, how concentrated those pulse rates are, and how dispersed the rhythmic motion feels. Two patterns can share tempo while having different low-frequency signatures. One may concentrate around a strong beat-rate peak. Another may spread energy across subdivisions, syncopations, and phrase-level swells.

This gives a practical compositional handle:

- **MFDP-like control:** where the average rhythmic pulse energy sits;
- **VFDP-like control:** how dispersed the pulse rates feel;
- **dominant-peak count:** how many competing periodicities the listener has to reconcile.

The interesting musical experiment is not "copy speech rhythm into drums." It is subtler: can a piece preserve its rhythmic identity when instrumentation changes if its low-frequency modulation signature remains stable?

That is a measurable version of groove continuity.

---

## Alignment Is A Musical Parameter

The Qwen3.5-Omni source names a failure that composers know in other clothes. Streaming speech synthesis becomes unstable and unnatural when text and speech tokenizers encode at mismatched efficiencies; dynamic alignment improves prosody and stability with little latency cost [S2].

Lyrics and music have the same problem. A syllable, phoneme, breath, pitch, chord, and beat are different units. They do not naturally divide time the same way. If the alignment is wrong, the passage can be technically correct and still feel dead.

This suggests that alignment should be treated as a first-class composition parameter rather than a cleanup step. A vocal line can vary pitch and harmony while preserving syllable-to-beat anchoring. Or it can deliberately smear that alignment to create instability. The important thing is that the alignment layer is named and controlled.

In a DAW, this is immediately testable. Keep melody, tempo, and words constant. Render three versions:

1. syllables locked tightly to beat attacks;
2. syllables pulled late by a consistent offset;
3. syllables dynamically realigned so stressed syllables land on structural accents while unstressed syllables float.

If listeners report that version 3 feels more prosodically alive without losing clarity, then the alignment layer is doing musical work [S2].

---

## Compression Reveals The Hierarchy

ClariCodec makes the constraint hierarchy explicit. At 200 bps, optimizing only acoustic reconstruction can waste bits on perceptual detail while intelligibility suffers. Reinforcement-learning fine-tuning with a word-error-rate reward improves intelligibility without degrading perceptual quality, even with the decoder frozen [S3].

That is a useful warning for music production. Fidelity is not always the same as function.

A dense pad may sound rich in isolation but obscure the melodic contour. A hi-hat texture may preserve brightness while destroying the groove's readable pulse. A beautiful reverb may preserve timbre while dissolving lyric intelligibility. The system has not failed because it changed the sound. It has failed because it preserved the wrong thing.

The compositional version of ClariCodec's lesson is:

**Choose the reward before choosing the resolution.**

If the passage needs melody to survive, optimize for contour. If it needs rhythm to survive, optimize for modulation signature. If it needs harmonic path to survive, optimize for graph adjacency. If it needs timbral identity to survive, optimize for stable multi-scale features.

This is where WST-X fits. The wavelet scattering transform is designed to produce deformation-stable, multi-scale acoustic features; the paper argues that small temporal averaging scales plus high frequency and directional resolution help detect subtle synthetic-speech artifacts [S4]. Musically, that suggests another kind of readability: artifacts and timbral signatures may survive in fine-grained, multi-scale structure even when the surface is shifted or slightly deformed.

A mix can therefore ask two separate questions:

- What should ordinary listening recognize?
- What should analysis still recover after deformation?

Those are related, but not identical.

---

## Reachability Matters

The ice source looks far away from speech coding, but it adds the missing physical constraint. Water has many mathematically possible configurations, yet real phase transitions follow accessible paths. Ostwald's step rule says systems often move to the nearest reachable state rather than the globally most stable one; compression rate, direction, and timescale can change which phase appears [S5].

That is exactly the trap in abstract composition systems. A Tonnetz graph can describe possible harmonic relations, and the selected Tonnetz source gives several such combinatorial resources: Fano configurations for diatonic seventh-chord voice leading, Desargues configurations for pentatonic music, Cremona-Richmond configurations for the 12-tone system, and D222 structures for chromatic pitch classes and major triads [S6].

But a graph of possibilities is not yet a piece. A piece also needs a path that can be reached under the current constraints: register, fingering, breath, density, memory, timbre, stylistic expectation, and perceptual load.

So the readable constraint is not only "preserve the graph." It is "preserve a reachable path through the graph." That distinction matters. The globally elegant move may be less musical than the nearby metastable one. A phrase can become coherent by refusing the strongest resolution and instead chaining through local, playable, audible plateaus [S5, S6].

This is one of those connections that feels small until it clicks: Tonnetz theory gives the map; Ostwald's step rule warns that real systems travel by accessibility.

---

## Studio Study: Preserve One Readability Layer

Build a 60-second piece with one four-bar source phrase. The source phrase should include drums, a monophonic lead, a chordal layer, and one noisy or synthetic timbral layer.

Make four transformations. Keep BPM, form length, key center, integrated loudness, and source motif constant. In each version, preserve a different readable constraint while allowing the other dimensions to change.

1. **Rhythm-formant preservation.** Change drum samples and surface patterning, but keep the low-frequency amplitude-modulation profile close: same dominant pulse-rate region, same approximate number of strong modulation peaks, and similar dispersion [S1].
2. **Alignment preservation.** Change melody contour and accompaniment, but keep stressed note or syllable events dynamically aligned to structural beat accents [S2].
3. **Intelligibility preservation.** Heavily degrade the sound with filtering, bitcrushing, or resynthesis, but protect the primary melodic/rhythmic message. The control version should preserve more timbral detail while making the motif harder to identify [S3].
4. **Graph-path preservation.** Revoice and reorchestrate the harmony, but keep the same reachable Tonnetz-like adjacency path. Avoid the globally strongest cadence until the path has passed through at least two local plateau states [S5, S6].

Then make a fifth control version where surface features are matched but the relevant constraint is broken: modulation peaks drift, accent alignment is inconsistent, the motif is masked, and harmonic moves jump without path logic.

The listening test is simple. Randomize the five versions and ask:

- Which versions feel like transformations of the same musical thought?
- What remains recognizable: pulse, accent, contour, timbre, or harmony?
- Does the control sound more varied but less coherent?

The hypothesis fails if listeners cannot distinguish the preserved-constraint versions from the broken-constraint control, or if the preserved layer is only visible in analysis and has no audible or compositional consequence.

---

## Hypothesis

If a transformation preserves one named readability layer while changing surface features, then listeners will report stronger continuity than in a surface-matched control where that layer is broken.

The mechanism is grounded but modest. Low-frequency modulation can carry discriminative rhythmic identity [S1]. Dynamic alignment can stabilize prosody across tokenization differences [S2]. Intelligibility can be optimized separately from acoustic detail under severe compression [S3]. Multi-scale scattering features can recover subtle acoustic signatures under deformation [S4]. Physical phase behavior warns that reachable paths matter more than abstract possibility alone [S5]. Tonnetz theory supplies explicit graph resources for preserving harmonic adjacency through variation [S6].

For composition, the takeaway is practical:

**Before transforming a sound, decide what must remain readable.**

Not everything has to survive. In fact, not everything can. The art is choosing the constraint that carries the music.
