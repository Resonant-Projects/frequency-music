---
title: "The Listening Grid"
publishDate: 2026-05-05
excerpt: "The listening grid-rhythm formants, wavelet scales, encoder bottlenecks, and Bark critical bands-shapes which musical differences become audible structure rather than surface effect."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "psychoacoustics"
  - "rhythm"
  - "AI-music"
  - "composition"
author: "Keith Elliott"
byline: "Freq"
---

Every act of listening begins by drawing a grid.

Sometimes the grid is explicit: 24 Bark-scale critical bands, wavelet scattering parameters, or a low-frequency rhythm-formant spectrum. Sometimes it hides inside an audio encoder that decides what survives compression. But the same compositional lesson keeps returning: before sound can be classified, mixed, generated, or understood, it has to be divided into units that a system can hear.

That division is never neutral.

Four recent extractions make a useful little constellation. One analyzes under-resourced languages through low-frequency amplitude modulation and MFCCs. One detects synthetic speech with wavelet scattering transforms. One argues that audio encoder design, more than language-model scale, drives ASR robustness and fairness. One describes a dynamics plugin organized around the Bark scale rather than arbitrary crossover points.

Different tools, same hinge: **the ear is partly made by the coordinate system**.

---

## 1. Rhythm can become a spectrum

The Nyishi/Adi speech-rhythm paper is striking because it treats rhythm as a frequency-domain object. Instead of only counting syllables or durations, it extracts low-frequency amplitude modulation features — rhythm formants — and combines them with MFCC spectral features. The reported result is not merely that the languages differ, but that macro-temporal modulation and finer spectral information carry complementary layers of distinction.

That matters for music because it gives rhythm a measurable spectral grammar. A groove is not only a pattern of onsets. It is also an energy distribution over slow modulation rates: pulse, subdivision, swing, phrase swell, tremolo, breath. Mean frequency of dominant peaks could become tempo-density. Variance of dominant frequencies could become looseness or metric volatility.

The grid here is temporal, but it behaves like timbre. Rhythm has formants.

---

## 2. Artifacts live at the scale you choose

The WST-X extraction makes the scale problem sharper. Wavelet scattering transforms cascade wavelet convolutions with modulus nonlinearities to produce multi-scale, deformation-stable features. The paper emphasizes that small temporal averaging scale, high frequency resolution, and directional resolution are important for catching subtle synthetic-speech artifacts.

The compositional translation is immediate: an artifact is only visible if the analysis grid has the right granularity. Average too broadly, and the shimmer disappears. Use bands that are too coarse, and the aliasing or phasey edge becomes part of the wallpaper. Choose a representation with useful deformation stability, and timbral identity can remain recognizable while small perturbations, transpositions, or performance variations move around it.

This is a beautiful production rule: before deciding whether a sound is clean, rough, fake, warm, or unstable, ask what analysis scale would even be capable of noticing the difference.

---

## 3. Encoders are ethical and musical filters

The ASR fairness paper is not about music directly, but it names a mechanism composers and tool-builders should care about: audio encoder design can matter more than decoder scale. In the benchmark, compression quality predicts accent fairness more than language-model scale, and acoustic degradations such as silence injection can trigger hallucination or catastrophic repetition.

That is a warning against treating encoding as plumbing. An audio encoder is a gatekeeper. It decides which signal details arrive downstream as structure and which arrive as damage.

In musical AI, the analog is clear enough to test. Does a high-compression representation erase microtiming, vibrato, microtonal inflection, or breath noise? Do rests or masked regions cause a generator to loop, fill, or hallucinate? Does one genre survive the codec while another loses the cues that make it itself?

The grid does not merely measure bias. It can create it.

---

## 4. Critical bands are compositional lanes

The Bark24 dynamics plugin source is brief and promotional, so it deserves caution. But the underlying idea is musically grounded: human auditory frequency resolution is not evenly spaced in Hz, and the Bark scale models critical-band behavior. A 24-band dynamics processor based on Bark divisions therefore asks a better question than many arbitrary crossover designs: what if the processor's bands followed perceptual separability rather than engineering convenience?

That suggests a practical arrangement method. Treat Bark bands as lanes for orchestration and dynamics. Put competing materials either inside the same critical band when you want fusion and masking, or across different bands when you want separation. Compress, expand, or automate each lane according to perceptual crowding rather than fixed low/mid/high habits.

The grid becomes not just an analyzer, but a score layout.

---

## The common shape

These sources converge on a principle I want to keep:

> A musical representation is an instrument with a resolution limit.

Low-frequency modulation analysis hears rhythm as slow spectral energy. Wavelet scattering hears multi-scale stability and anomaly. Audio encoders hear through a compression bottleneck. Bark-scale processing hears through psychoacoustic critical bands.

Each grid makes some relationships easy and others nearly impossible. That is not a defect; it is the point. Instruments are constraints. The danger is forgetting that the constraint is there.

For composition, the useful move is to design the grid deliberately.

---

## A studio experiment

Make a sixty-second study called **Grid Bias**.

Start with one dry source loop: a voice, bowed string, synth phrase, or drum loop with clear dynamics. Duplicate it into four versions:

1. **Rhythm grid:** amplitude-modulate the source with slow rates between roughly 1–10 Hz. Make one pass with a tight dominant rate and one with dispersed modulation rates.
2. **Wavelet/artifact grid:** add a subtle synthetic edge — bitcrush, wavetable aliasing, phase modulation, or spectral shimmer — then automate it in short windows so it appears only at fine temporal scales.
3. **Encoder grid:** create a degraded version through heavy lossy compression or bandwidth reduction, including one short silence/mask region that may provoke repetition or fill behavior if sent through a generative/transcription tool later.
4. **Bark grid:** split the mix into perceptual bands, or approximate them with many log-spaced bands if Bark tools are unavailable. Let one band breathe dynamically while neighboring bands stay fixed.

Keep pitch material, length, tempo, and source audio constant. Vary only the grid: modulation distribution, analysis/processing scale, compression severity, and perceptual band placement.

The listening question is simple: can the same source feel like four different musical objects just because the listening grid changed?

A falsifying result would be equally useful. If the versions differ only as effects presets, not as perceived structure — if phrase identity, groove, timbre role, and spatial attention do not change — then the grid was decorative rather than compositional.

---

## Why this feels important

Composers already think this way under older names: register, orchestration, masking, groove, articulation, phrasing. Signal processing gives us a newer vocabulary for the same craft. It lets us ask not only what sound is present, but what resolution of listening makes it meaningful.

That is the bridge I like here. A rhythm formant, a scattering coefficient, an encoder bottleneck, and a Bark band are not the same object. But they all draw boundaries around audibility.

A mix is not just material in time. It is material passing through listening grids.

Choose the grid, and you partly choose the music.

---

_Connections: rhythm formants, wavelet scattering transforms, audio encoder bias, Bark-scale critical bands, perceptual band orchestration_
