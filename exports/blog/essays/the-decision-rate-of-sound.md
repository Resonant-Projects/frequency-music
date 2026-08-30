---
title: "The Decision Rate of Sound"
publishDate: 2026-08-30
excerpt: "Decision rate—the speed at which a system decides what acoustic evidence counts—connects spectral authority, contour, perception, and musical form."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "composition"
  - "acoustics"
  - "AI-music"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

A sound does not become musical evidence all at once.

The recent linked extractions point toward a useful missing layer between spectrum, gesture, and perception. **Partial authority** says that different components of a tone can be granted different amounts of musical force. **Surviving contour** says that, after a system compresses or transforms sound, only some trajectories remain actionable. **Operating clock** says that every such judgment happens at a rate: frame by frame, phrase by phrase, generation step by generation step, or listener expectation by listener expectation.

The concept that joins them is **decision rate**: the temporal rate at which a musical system decides which evidence is allowed to count.

This matters because two systems can observe the same acoustic material and produce different music simply by deciding at different speeds. A pitch tracker that updates every few milliseconds treats instability as local detail. A phrase-level emotion model treats the same instability as part of a longer affective arc. A latent audio generator operating at a compressed temporal rate may preserve contour while losing the fine evidence that made the original contour feel physical. A listener may update even more unevenly, holding a source identity through momentary spectral changes and then suddenly hearing the sound as something else.

## Authority Needs A Clock

Partial authority already breaks the simple idea that a tone has one pitch and one timbre. A fundamental, a cluster of upper harmonics, an inharmonic band, and a noisy component can each carry different amounts of musical evidence. But authority without time is incomplete.

If upper partials become salient for only 30 milliseconds, they color the attack. If they persist for a bar, they can imply an inner line. If they recur at phrase boundaries, they become form. The same spectral event changes category as its decision rate changes.

This gives composers a sharper question than "what frequencies are present?" Ask: **how often is the system allowed to reconsider what those frequencies mean?**

A synthesizer that exposes this parameter would not merely automate brightness or roughness. It would let the musician choose whether spectral authority flickers, pulses, accumulates, or locks. A monophonic tone could briefly flash a second pitch, slowly transfer authority from fundamental to upper partials, or hold noisy energy below the threshold of pitch for an entire section before making it count.

## Contour Is A Sampling Contract

Surviving contour adds the complementary pressure. Any representation that survives compression has already made decisions about what kind of motion matters. A valence-arousal curve over four-bar windows keeps a different contour than a 25 Hz latent stream. A vocal-plasticity trajectory keeps different evidence than a pitch-strength trace. A score-alignment path keeps different evidence than a spectral-flatness measurement.

The decision rate is the sampling contract behind the contour.

If the clock is too fast, the system may preserve local fluctuations while missing musical intention. If the clock is too slow, it may preserve broad form while flattening the small instabilities that make a sound feel alive. This is not only an engineering tradeoff. It is a compositional choice.

One piece could make this audible by giving several listeners or models different clocks. A fast layer hears attacks, roughness, and partial flicker. A middle layer hears motif and harmonic pressure. A slow layer hears affective drift. The composition is the disagreement among their decisions.

## A Practical Control Surface

Decision rate suggests a tool design:

1. Choose an evidence carrier: pitch strength, spectral flatness, upper-partial salience, inharmonic coherence, affect, source identity, or alignment confidence.
2. Choose a decision rate: transient, beat, bar, phrase, section, or adaptive.
3. Choose a persistence rule: reset, average, accumulate, hysteresis, or threshold crossing.
4. Map the result to sound: timbral opening, detune density, spatial position, harmonic substitution, stem exposure, or generated continuation.

The important move is that the composer does not only control a value. The composer controls when the value becomes eligible to act.

That makes decision rate especially useful for the Frequency project. It connects spectral analysis to musical form without pretending that all evidence belongs on the same clock. It also gives a clean research question for future extraction and interface work: when a source claims that some feature matters, what rate does that claim require in order to be musically true?

A sound is not just a bundle of measurements. It is a sequence of permissions. At each moment, some evidence is ignored, some is held in reserve, and some is allowed to steer the piece.

The rate of that permission is part of the instrument.

---

_Sources: operating-clock extraction cluster (`j97ew31wh4x6nr72xa9y9n7y3s8amm58`, `j976e5vb7x58dvzmpyf8rv69318anrwg`, `j97d7hq5d3kndbx5sq26qppqwn8afr0d`, `j97bw3c6d199ghsv0fnshtgpex8afycn`), surviving-contour extraction cluster (`j97ew31wh4x6nr72xa9y9n7y3s8amm58`, `j976e5vb7x58dvzmpyf8rv69318anrwg`, `j974yd33462rqhtvpb249eyccx8anewd`, `j978yxjgnckm2px83ae5dqwgq18ajxwm`, `j97ckpqqxzkj19gbw70dkwhk218ahj6w`), and partial-authority extraction cluster (`j978yxjgnckm2px83ae5dqwgq18ajxwm`, `jx7athsx7pfkmycrmqerst9krx8aj9xa`, `j9762aqawbwmrwvhgfwrns5m398aj4d3`, `j97ckpqqxzkj19gbw70dkwhk218ahj6w`)._
