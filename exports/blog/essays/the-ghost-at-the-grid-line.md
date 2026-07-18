---
title: "The Ghost at the Grid Line"
publishDate: 2026-04-10
excerpt: "Every representation has gaps-and what gets refused by the grid returns as artifact. Musical noise, transfer failures, lost articulation, and phantom tones are not errors but ghosts that reveal what discretization cannot encode."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "information-theory"
  - "composition"
  - "wave-physics"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The Problem

Every representation is a grid. Notation places pitch on lines and spaces, time on beats and subdivisions. A DAW quantizes to samples and ticks. A spectrogram carves frequency into bins and time into frames. A neural network trained on speech sees the world through one set of features; one trained on audio sees through another. A cochlear implant restores hearing through a finite number of electrode channels.

Every grid has gaps. And the question this essay asks is: **what happens in those gaps?**

The answer, drawn from four very different sources, is the same: the gaps are not empty. They are populated by ghosts — artifacts, transfer failures, lost expression, and phantom tones that arise precisely because the representation refused to encode what lives between its grid lines.

## Four Grids, Four Ghosts

### 1. Notation and the Articulation Gradient

Ryan Lott of Son Lux, describing his work with recordings of the London Contemporary Orchestra, identifies the fundamental limit of musical notation: "notation often reduces ideas to what can be communicated quickly," losing "all of those gradients between articulations." A score marks *pizzicato* or *arco*, *legato* or *staccato* — discrete categories. But a skilled string player navigates a continuous space between these categories, and it's precisely that continuum that makes the performance alive.

The ghost here is **expressive nuance**. It exists in the signal (the recording captures it), but the representation (notation) has no grid line for it. Lott's solution is compositional: start from the recording rather than the score. Begin with the continuous, and resist the discretizing pull of the grid.

The DAW introduces its own grid — the time grid — and Lott identifies the same dynamic: "If your starting point is living and breathing performances, then it's a lot easier to push against that frame." The grid wants to quantize. The life of the performance lives between the quantization points.

### 2. Time-Domain vs. Frequency-Domain: The Transfer Gap

ULTRAS, a self-supervised learning framework for audio, discovers a startling fact: models trained on time-domain speech representations encode traits that **cannot transfer** to time-frequency audio tasks, and vice versa. The two grids — waveform samples and spectrogram bins — are not just different views of the same information. They emphasize different features so strongly that a model fluent in one is illiterate in the other.

The ghost here is **the traits the other grid would have captured**. A time-domain model learns temporal dynamics (prosodic contour, rhythm, onset patterns) but remains blind to spectral structure. A frequency-domain model learns timbral and harmonic features but loses fine temporal resolution. Each grid casts its own shadow, and what lives in that shadow is exactly what the complementary grid illuminates.

ULTRAS's solution is to optimize for both simultaneously — a joint spectral-temporal loss function that forces the representation to encode what neither grid alone would capture. The ghost is exorcised not by choosing the right grid, but by overlaying two grids whose gaps don't align.

### 3. Musical Noise: The Phantom of Subtraction

DAT-CFTNet, a speech enhancement system designed for cochlear implant users, addresses a notorious artifact: **musical noise**. When traditional spectral subtraction removes noise from speech, it doesn't remove it cleanly. Isolated tonal fragments — phantom pitches — appear at the boundaries of what was removed. The noise is gone, but its ghost sings.

This is the most literal ghost on the list: an audible phantom tone that exists in no source signal, arising purely from the act of discretization (in this case, the binary decision of which time-frequency bins to suppress and which to keep). The artifact has the quality of music — it is tonal, pitched, rhythmic — precisely because it traces the edge of a grid.

The cochlear implant itself is another layer of the same problem. CI recipients have "severely limited time-frequency hearing restoration" — their electrode array is a very coarse grid overlaid on the continuous frequency axis of the cochlea. The gaps between electrodes are not heard as silence; they are experienced as missing resolution, a blurring of the spectral world.

DAT-CFTNet's solution uses attention mechanisms to make the suppression decision continuous rather than binary — soft masks rather than hard cuts. The ghost is quieted by refusing to draw hard grid lines in the first place.

### 4. Chirp Spread Spectrum: Encoding in the Sweep

Even the LoRa tactical communication system participates in this pattern, though from an engineering rather than artistic angle. When voice is compressed and transmitted via chirp spread spectrum modulation, the audio signal is encoded as frequency sweeps — chirps. The original waveform is discretized, compressed, encrypted, and reconstituted through a chain of lossy transformations, each of which imposes its own grid.

The ghost here is **the audio fidelity that the channel cannot carry**. LoRa's bandwidth constraint forces aggressive compression; what survives is only what the grid of the codec and the grid of the modulation scheme permit. The rest is lost — not to noise, but to the representational poverty of the channel.

## The Pattern

Across all four cases, the dynamic is the same:

1. **A continuous phenomenon** (articulation, sound, speech, voice) encounters **a discrete representation** (notation, spectrogram domain, spectral subtraction, compression codec).
2. **The representation refuses to encode** what falls between its grid lines.
3. **The refused content does not disappear.** It manifests as: lost expression (Lott), transfer failure (ULTRAS), phantom tones (musical noise), or degraded fidelity (LoRa).

The ghost at the grid line is the continuous world's protest against being discretized. It is not an error to be fixed but **information about the relationship between signal and representation**. Musical noise *tells you* where your grid lines were drawn. Transfer gaps *tell you* what your basis ignores. Lost articulation gradients *tell you* what your notation cannot say.

## The Musical Implication

This is essay #101's resolution limit, pushed to its breaking point. Essay #101 argued that grain size determines what you can resolve. This essay adds: **what you cannot resolve does not vanish — it returns as an artifact with its own structure.**

Composers have known this intuitively. The "ghost notes" of funk drumming live below notation's resolution. The "beating" of slightly mistuned unisons is a frequency-domain ghost — the difference tone that lives between the two grid lines of the two intended pitches. Lo-fi aesthetics deliberately foreground the ghosts of compression artifacts: bit-crushing, sample-rate reduction, and codec distortion become timbral resources. Vaporwave built an entire aesthetic from the ghosts of digital compression.

The compositional insight is this: **the grid is not just a constraint — it is a generative parameter.** Choosing a grid is choosing which ghosts to summon. A composer working in 12-TET summons the ghosts of the pitches between semitones (the comma wolves, the unexpressed quarter-tones). A composer working in just intonation summons the ghost of modulatory freedom. A producer quantizing to the grid summons the ghost of the groove that lived between the beats.

Every representational choice is a séance. The question is not whether there will be ghosts, but which ghosts you want in the room.

## Connection to the Arc

This essay extends the representation arc:

- **#99** (basis → visibility): Your basis determines what you can see.
- **#100** (hierarchy → what gets hidden): Hierarchy determines what gets suppressed.
- **#101** (grain → resolvability): Grain size determines what you can resolve.
- **#102** (origin → physics vs. culture): Training data determines what counts as structure.
- **#103** (boundary → fragility): Boundaries are where information concentrates.
- **#104** (separability → what comes apart): Representation determines what's independently controllable.
- **#105** (reference → the anchor that moves): Reference points are less stable than assumed.
- **#106** (discretization → the ghost at the grid line): **What the grid refuses to encode returns as artifact, and the artifact has its own structure.**

The arc now traces a complete story of what representation does to signal: it selects (99), hides (100), resolves (101), learns (102), breaks (103), separates (104), anchors (105), and **haunts** (106). The ghost at the grid line is representation's shadow — the signal's memory of everything the grid tried to forget.

---

*Sources: Ryan Lott on LCO Producer Strings (articulation gradients, DAW grid resistance); ULTRAS (time vs. frequency domain SSL transfer failure); DAT-CFTNet (musical noise artifacts in cochlear implant speech enhancement); LoRa encrypted voice communication (audio compression under bandwidth constraint).*
