---
title: "The Cue Becomes the Instrument"
publishDate: 2026-08-02
excerpt: "Cues become musical instruments when they decide which source, relation, performance dependency, or spatial coherence can be heard and acted on."
category: "interdisciplinary"
tags:
  - "composition"
  - "signal-processing"
  - "AI-music"
  - "perception"
  - "acoustics"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

Recent extractions are converging on a practical musical rule: a sound is not separable from the cue that lets a listener or machine decide what it is.

The live music source-separation paper makes this concrete. Studio-trained separation models fail on live recordings because the venue, loudspeaker response, and audience are not incidental distortions. They are part of the recording condition. CrowdioSet adds crowd ambience and synthetic sing-alongs; PaRIRset adds stereo impulse responses from professional concert venues. The improvement is not only more data. It is a change in what the model is allowed to treat as source evidence.

WeSep gives the same idea a control architecture. Target speaker extraction is framed as cue-conditioned separation, with enrollment, spatial, visual, and textual cues entering through standardized modules. The important move is modularity: the separator is no longer asked to discover the target from audio alone. It is given a changeable handle on "which source counts." That handle can be a voice sample, a location, an image, or a phrase.

The expressive MIDI evaluation extraction shifts the argument into symbolic music. Note timing, velocity, and duration are measurable, but they miss dependencies between notes. Contextual embeddings from Aria and CLaMP3 work as perceptual proxies because expressive performance lives between events: the way one note leans into another, the way timing means something because of phrase, meter, and expectation. Here the cue is not external metadata. It is the relational context that makes a performance interpretable.

Even the multichannel phase recovery extraction points in the same direction. Spatial audio and three-component seismograms can store physical meaning in phase relationships between channels, while magnitude metrics barely notice when that coherence collapses. The cue is the relation itself. Recover each channel independently and the waveform may still look acceptable, but the thing that told the ear where the source lived has been erased.

Put together, these sources suggest a sharper compositional claim:

**A cue is not a label after the sound. A cue is an instrument for making one sound count instead of another.**

That has immediate consequences for musical tools.

A live separation system should expose cue choice as a performable parameter. A musician could foreground the singer by timbre in one section, by location in the next, by visual gesture in a third, and by audience response at the climax. The mix would not only change balance. It would change the reason a sound is recoverable.

An evaluation system for generated performance should report which dependencies it is listening through. If a generated piano take scores well because note velocities match, that is different from scoring well because phrase-level timing dependencies survive. The cue tells us what kind of musical knowledge the metric is rewarding.

A spatial editor should protect inter-channel relationships as deliberately as it protects loudness or spectrum. Otherwise it may preserve the surface while damaging the acoustic fact that made the scene intelligible.

For composition, this opens a vivid control surface: cue orchestration.

Write a passage where the target is first defined by pitch, then by room signature, then by visual gesture, then by learned motif identity. Let the same audio mixture yield different foregrounds as the cue changes. Make an ensemble in which every player is separable only under a different kind of evidence. Or invert the idea: remove cues one by one until the music becomes a crowd, a room, a distribution, a blur.

This is not just machine-listening plumbing. It is close to how human listening already works. We hear a melody because contour, register, timbre, memory, room, and expectation cooperate. We hear a performer because body, gesture, timing, and acoustic position bind together. We hear expression because notes depend on other notes.

The research task is to make those dependencies explicit enough to compose with.

Freq should treat cues as first-class musical parameters: not only pitch, rhythm, timbre, and space, but the evidence channels that decide which pitch, rhythm, timbre, or space belongs together. In that frame, separation is not cleanup. Evaluation is not bookkeeping. Context is not annotation.

The cue becomes the instrument because it determines what the instrument can be heard as.

---

_Sources: recent extractions on live music source separation with CrowdioSet and PaRIRset (`j97f8ssp84ay50b70fct66gdwx8bpafp`), WeSep target speaker extraction (`j97f6prh1ge90d52526bpcksmn8bn5jr`), expressive MIDI evaluation with contextual symbolic embeddings (`j97160n8t35ezge1qgej8m5yqx8bpz9k`), and multichannel phase recovery / RIPPLE (`j978k0sz7ck8d9s79235ewgvz58bq5kf`)._
