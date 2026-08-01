---
title: "The Semantic Split: Why Perfect Reproduction Isn't Understanding"
publishDate: 2026-03-25
excerpt: "Perfect acoustic reproduction doesn't guarantee semantic understanding."
category: "interdisciplinary"
tags:
  - "tuning-systems"
  - "information-theory"
  - "signal-processing"
  - "mathematical-music-theory"
  - "perception"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

## Two Kinds of Knowing

A neural audio codec called OmniCodec recently achieved something that should have been impossible to achieve badly: it reconstructed audio at a given bitrate better than competing codecs while _also_ producing more useful representations for downstream generation tasks. The surprise isn't the result — it's the architecture that made it necessary. OmniCodec explicitly separates its internal representation into two streams: a _semantic_ codebook (what the sound _means_ — its category, structure, identity) and an _acoustic_ codebook (what the sound _sounds like_ — its timbre, texture, spatial image). The authors' central claim is stark: high reconstruction quality does not necessarily yield semantically informative representations.

Read that again. You can build a codec that perfectly reconstructs a violin sonata and learns _nothing_ about what a violin is, what a sonata is, or how the notes relate to each other. The acoustic stream captures every spectral detail; the semantic stream captures the structure that makes those details _music_ rather than noise. And these two kinds of knowing are separable — you can have either without the other.

This is a fundamental claim about the nature of musical information, and it maps precisely onto a distinction that tuning theory has been dancing around for centuries.

---

## The Lead Sheet and the Recording

Consider two representations of the same performance of "Autumn Leaves":

1. A lead sheet: melody in standard notation, chord symbols (Am7, D7, Gmaj7...), tempo marking, maybe a few dynamic indications. Total information: perhaps 2 KB of text.

2. A 24-bit/96 kHz WAV recording of the same performance. Total information: roughly 1 GB.

The lead sheet is a semantic representation. It captures what the music _is_ — the harmonic progression, the melodic contour, the formal structure. From this representation, any competent jazz musician can reconstruct a _performance_ — not the same performance, but one that is recognizably the same _piece_. The semantic content is preserved; the acoustic content is completely absent.

The WAV file is an acoustic representation. It captures exactly what the air molecules did during those four minutes. From this representation, any loudspeaker can reconstruct the _sound_ — with perfect fidelity, every overtone in place, every room reflection preserved. But the WAV file contains no explicit information about what key the piece is in, where the phrases begin and end, or why the B section modulates to the relative minor. The acoustic content is preserved; the semantic content is implicit, buried in patterns that require analysis — or a trained ear — to extract.

OmniCodec's architecture says: these are genuinely different kinds of information, and a single codebook conflates them at the cost of both. A traditional codec optimized for reconstruction (acoustic fidelity) may achieve spectacular waveform accuracy while its internal representations are semantically opaque — they can reproduce the sound but can't _use_ it for anything except playback. This is why RVQGAN, with its mathematically elegant latent space, produced the worst perceptual quality in the codec evaluation discussed in "The Fidelity Trade." It optimized for a representation that was internally consistent but semantically hollow.

---

## The Tuning Parallel

Every tuning system is a codec, and every tuning system makes the semantic-acoustic trade-off.

**Equal temperament** is a pure acoustic codec. It defines twelve pitch classes by a single ratio (2^(1/12)), guaranteeing that every interval sounds the same regardless of transposition. This acoustic uniformity is its selling point — and its semantic limitation. In 12-TET, a major third is always 400 cents, whether it functions as the third of a tonic chord, the seventh of a dominant, or a chromatic passing tone. The tuning carries no semantic information about the interval's _function_. The acoustic representation is perfect; the semantic content is flattened.

**Just intonation** is a semantic codec. It defines intervals by their harmonic function — the 5:4 major third of the tonic triad is different from the 9:7 septimal third of a dominant, which is different from the 81:64 Pythagorean third of a melodic sequence. Each ratio encodes the interval's _relationship to the harmonic series_, its semantic position in a web of resonance. The acoustic representation varies constantly — pitches shift as harmonic context changes — but the semantic content is maximally explicit. Every sounding pitch _means_ something specific about its harmonic context.

**Well temperament** is OmniCodec's architecture applied to tuning: a deliberate separation of acoustic and semantic streams. The acoustic stream provides twelve usable pitch classes that approximate the harmonic series well enough for practical music-making. The semantic stream is encoded in the _deviation pattern_ — the specific way each key differs from equal temperament. Werckmeister III's C major is nearly pure (semantic: home, rest, clarity) while its F# major is noticeably rough (semantic: distance, tension, wildness). The tuning itself carries semantic information that equal temperament erases.

This is why key character was a real phenomenon in the 18th century and a historical curiosity in the 20th. Well temperament's semantic codebook was rich — each key had a distinct color, a distinct personality, a distinct meaning. Equal temperament replaced it with a uniform acoustic codebook — perfect reconstruction fidelity, zero semantic differentiation. We gained transposition invariance and lost key character. The codec got better at reproducing; it got worse at meaning.

---

## Beyond Physical Limits

A second recent paper illuminates the other side of the split. Neural Directional Filtering uses a compact microphone array plus a neural network to achieve directivity patterns that are physically impossible for traditional beamformers — specifically, frequency-invariant directivity above the spatial aliasing frequency.

Spatial aliasing is a hard physical limit. When the wavelength of sound is shorter than the spacing between microphones, the array cannot resolve the direction of arrival. This is the Nyquist theorem applied to space rather than time: below the spatial Nyquist frequency, you can reconstruct the wavefield; above it, you're guessing. Traditional beamformers hit this wall and stop.

The neural approach doesn't make the physics go away. The microphones still can't resolve those wavelengths. But the neural network has learned statistical priors about how sound sources behave — that a violin doesn't suddenly teleport, that room reflections follow predictable decay patterns, that a voice maintains spatial coherence. It uses these priors to infer the spatial information that the array physically cannot measure.

This is semantic knowledge filling in acoustic gaps. The network doesn't have the acoustic data (the spatial samples above Nyquist), but it has semantic knowledge about sources (their likely positions, movements, and radiation patterns). This semantic prior allows it to reconstruct spatial information that is, in the strict signal-processing sense, not there.

The musical parallel is immediate. When a baroque ensemble performs in meantone temperament, they routinely play intervals that fall outside the system's "spatial aliasing" limit — keys where the comma errors pile up badly. They navigate this by using semantic knowledge: they know the harmonic function of each note, so they adjust intonation in real time based on context. The semantic stream (harmonic understanding) fills in where the acoustic stream (the fixed tuning system) fails.

A harpsichord can't do this — it's a traditional beamformer, bound by its fixed tuning. A singer can — they're a neural directional filter, using learned priors about harmonic function to exceed the physical limits of any fixed pitch grid.

---

## The Hierarchy, Revisited

"The Fidelity Trade" proposed a hierarchy of musical information by compressibility:

1. **Identity** (melody, rhythm, form) — survives everything
2. **Harmony** (chord quality, key relationships) — degraded by aggressive tuning/spectral changes
3. **Timbre** (spectral shape, formant structure) — degraded by moderate compression
4. **Texture** (spatial image, micro-timing, noise) — degraded by any lossy process
5. **Noise floor** — meaningless except as headroom

OmniCodec's semantic-acoustic split maps cleanly onto this. The semantic codebook captures layers 1 and 2 — the structural, functional aspects of sound that survive drastic compression because they're low-dimensional and abstract. The acoustic codebook captures layers 3 through 5 — the physical, sensory aspects that require high-dimensional representation and are the first casualties of any lossy process.

The hierarchy's key insight is that these layers are not just different levels of detail — they're different _kinds_ of information. You don't get semantic content by adding more acoustic resolution. A 24-bit/192 kHz recording of a C major chord doesn't contain "more" information about why it resolves to tonic than a 16-bit/44.1 kHz recording. The semantic content is invariant to acoustic resolution because it lives in a different representational space.

This is why RVQGAN failed so spectacularly in the codec comparison. It learned a unified codebook that tried to capture everything in a single latent space. But because semantic and acoustic information have different structures — different dimensionalities, different invariances, different compression behaviors — a single codebook optimized by reconstruction loss inevitably prioritizes the acoustic (which dominates the loss function) at the expense of the semantic (which the loss function can't see). The result is a codec that reconstructs waveforms with mathematical precision and can't tell a symphony from a traffic jam.

---

## The Composer's Dilemma

This has direct implications for anyone who makes music.

When you choose a tuning system, you're designing a codec. The question isn't just "how accurate are my intervals?" (acoustic fidelity) but "how much does my tuning system _know_ about my music?" (semantic informativeness).

Equal temperament knows nothing about your music. It provides twelve pitch classes and treats all keys identically. This is the RVQGAN approach: uniform coverage, zero semantic content, musically functional but semantically mute.

A custom tuning designed for a specific piece — like La Monte Young's _The Well-Tuned Piano_, with its 7-limit just intonation network — knows everything about the harmonic relationships in that piece. Every interval is tuned to express its specific function in the harmonic web. This is maximum semantic coding: the tuning _is_ a harmonic analysis. But it's also acoustically rigid — it can't play other music without breaking.

The OmniCodec insight suggests a third path: design tuning systems with explicit semantic and acoustic streams. The acoustic stream provides a practical set of playable pitches. The semantic stream encodes the functional relationships — which intervals are consonances, which are tensions, how keys relate to each other. A performer or adaptive system reads the semantic stream to know _what the tuning means_ and adjusts the acoustic stream accordingly.

This is, in fact, what great ensemble players already do. A string quartet doesn't play in equal temperament or in strict just intonation. They play in a fluid system where the acoustic pitch is constantly adjusted based on the semantic context — raising a leading tone, purifying a perfect fifth, widening a major third for brightness. Their "codec" has separate semantic and acoustic channels, updated in real time by musical understanding.

The question for computational music-making is whether we can build this into our tools: tuning systems, synthesizers, and composition environments that maintain separate semantic and acoustic representations, each optimized for its own purpose, linked but not conflated. Not just "how does this interval sound?" but "what does this interval _mean_ in this context, and how should it sound _because_ of what it means?"

---

_The ear doesn't hear frequencies. It hears meaning. The hair cells transduce acoustic energy into neural signals, but what reaches consciousness is not a spectrum — it's a scene: sources, locations, identities, emotions. The ear's own codec is the original semantic-acoustic split. Everything we build is an attempt to match it._

_Related: [The Fidelity Trade](the-fidelity-trade.md), [The Reconstruction Limit](the-reconstruction-limit.md), [The Tuning Codec](the-tuning-codec.md), [The Codec Ear](the-codec-ear.md), [The Compression Gradient](the-compression-gradient.md)_
