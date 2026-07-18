---
title: "The Evidence of a Voice"
publishDate: 2026-06-12
excerpt: "Source identity is not given by the waveform; it has to be curated, recovered, withheld, or allowed to leak through as operational evidence for listening systems and composers."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "composition"
  - "perception"
  - "psychoacoustics"
  - "AI-music"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

Sound rarely arrives with its cause printed on it. A waveform may contain a speaker, a room, a machine, a bird, an infant, a violin, a bad bearing, or several of these at once. The recent extraction set keeps returning to one operational question: what evidence is enough to decide what source made the sound?

That question looks simple only when the world has already been curated. FSD50K-Solo begins by trying to make the world simple again. It treats single-source audio not as a given, but as a scarce and valuable condition that has to be manufactured, simulated, and filtered for at scale. A diffusion model synthesizes clean single-class events so a classifier can learn how multi-source contamination looks. The interesting move is circular but productive: clean sources are generated in order to teach a system how to find clean sources in noisy public data.

SR-CorrNet starts from the opposite premise. It does not ask for a clean source first. It assumes overlapping speakers, noise, and reverberation, then uses spatio-spectro-temporal correlations to estimate filters that recover target speech. In this framing, source identity is not a label attached before analysis. It is reconstructed from relations inside the mixture. The source is proved by the pattern of correlations it leaves behind.

The anomalous-sound-detection paper makes the hidden assumption explicit. Standard benchmarks often grant machine identity at test time, but real monitoring scenarios may not know which machine produced a recording. When test recordings from multiple machines are merged and evaluated without identity labels, model performance changes. The degradation is not incidental; it correlates with implicit machine-identification accuracy. In other words, the anomaly detector was partly an attribution machine all along.

The infant-cry classification paper adds a biological complication. Even within one nominal class, source identity leaks through the signal. F0 contours, MFCCs, and STFT features can help classify cry causes, but the work has to confront strong domain shifts across infants and datasets. A cry is not just a cry. It carries the individual body, recording situation, dataset conditions, and temporal instability of the event. The system has to preserve enough specificity to work without mistaking identity variation for category variation.

Together these sources suggest a useful distinction for music and acoustic practice:

1. **Curated identity**: isolate or synthesize clean events so source labels become reliable.
2. **Recovered identity**: infer sources from correlations inside mixtures.
3. **Withheld identity**: test whether a system still works when attribution is unavailable.
4. **Leaking identity**: notice when individual source traits shape supposedly general categories.

Compositionally, this points toward a technique of source-evidence orchestration. Instead of asking only which instrument plays a note, ask how much evidence of that instrument is available at each moment. A phrase might begin as curated identity: one dry, exposed sound. It could then enter recovered identity: overlapping streams whose sources are still inferable through correlated envelopes, shared pitch motion, common onset, or spatial coherence. Later, identity could be withheld by blending sources until the listener can hear activity without attribution. Finally, identity could leak back through a small invariant: a bow noise, breath attack, room coloration, vibrato shape, or F0 contour that reveals the source even when the musical category remains ambiguous.

This reframes timbre as evidence rather than color. Timbre is not merely the quality of a sound after pitch and rhythm are named. It is the bundle of clues by which a listener decides what kind of event occurred, where it occurred, and whether two moments belong to the same cause. A composition can therefore move not only through harmonic tension and release, but through evidential tension and release: now the source is obvious, now it is only statistically implied, now it is deliberately unprovable, now it snaps back into focus.

For a tool builder, the practical next step is to expose a "source-evidence" layer in analysis views. Given an audio segment, show features that support or weaken attribution: F0 continuity, spectral-envelope stability, onset synchrony, spatial coherence, reverberant consistency, and source-class confidence. For a composer, those same measurements become controls. How long can a sound remain itself after being mixed, filtered, reverberated, or transformed? How little evidence is enough for the ear to keep believing in a source?

The deeper connection is that listening is not passive reception. It is an ongoing proof search under time pressure. These papers do not prove source identity in a mathematical sense, but they all build machines that need operational proof: enough evidence, soon enough, to classify, separate, monitor, or act. Music can use that same pressure as material.

_Sources: "FSD50K-Solo: Automated Curation of Single-Source Sound Events"; "Asymmetric Encoder-Decoder Based on Time-Frequency Correlation for Speech Separation"; "How Much Does Machine Identity Matter in Anomalous Sound Detection at Test Time?"; "LMU-Based Sequential Learning and Posterior Ensemble Fusion for Cross-Domain Infant Cry Classification."_
