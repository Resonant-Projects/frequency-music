---
title: "The Filter Is The Decision"
publishDate: 2026-07-01
excerpt: "Three audio ML papers reveal how recognition systems embed decisions into the signal path itself: curation filters, separation correlations, and emission gates become compositional tools rather than post-hoc labels."
category: "composition"
tags:
  - "AI-music"
  - "signal-processing"
  - "composition"
  - "perception"
  - "information-theory"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

Three recent audio papers share a quiet structural move: they do not treat recognition as a label placed on top of sound. They make recognition into an operation that changes what can happen next.

FSD50K-Solo curates a dataset by deciding which recordings are single-source enough to keep. SR-CorrNet separates speech by turning spatio-spectro-temporal correlations into recovery filters. Streaming SpeechLLM translates in real time by learning when enough audio has arrived to emit the next token. In each case, the judgment is not commentary. The judgment becomes a gate, a filter, or a commitment.

That matters for composition because music often hides its decisions as if they were after-the-fact interpretations. A listener hears a source, a model labels a class, a performer recognizes a cue. But these papers suggest a stronger claim:

**A listening system's decision is part of the signal path.**

## Curation As Filtering

FSD50K-Solo begins with an apparently administrative problem: open audio datasets contain too many samples where several events overlap under one label. The proposed fix is more interesting than simple cleanup. The system synthesizes clean single-class events with a diffusion model, builds controlled noisy mixtures, then trains an encoder and classifier to filter real recordings for single-source examples.

The dataset is not merely collected. It is carved out by a model of purity.

For musical work, this reframes sampling. A sample library is usually treated as raw material, but every library already encodes a decision about what counts as one instrument, one object, one gesture, one usable fragment. FSD50K-Solo makes that boundary explicit. It says: before composition begins, there is already a filter deciding which sounds are allowed to function as stable actors.

A composer could make that filter audible. Instead of starting with a clean sample and then processing it, start with a field recording and let a classifier-like process gradually admit only the events that satisfy a chosen identity condition. The music would not move from source to effect. It would move from mixture to eligibility.

## Separation As A Recovery Operation

SR-CorrNet makes the same principle more directly acoustic. It criticizes architectures that wait until the final stage to split speakers, because late disentanglement creates an information bottleneck. Its alternative performs coarse separation early, then progressively reconstructs speaker-discriminative features. Most importantly, it frames separation as correlation-to-filter: relationships across space, spectrum, and time become the input from which deep filters are estimated.

Here the decision is literally a filter.

That is a beautiful compositional idea. A voice in a dense texture does not survive because it owns a frequency band. It survives because enough cues keep agreeing: onset, contour, spatial position, modulation, harmonic relation, memory. Those agreements are correlations. Once strong enough, they become a perceptual filter that lets the listener pull a line out of the surrounding sound.

This suggests an orchestration practice based on correlation strength. Give two instruments the same contour but different envelopes and they half-bind. Give them common onset and spatial proximity and they bind more tightly. Add conflicting modulation or reverberation and the filter weakens. The source is not present or absent; it is more or less recoverable.

## Translation As An Emission Gate

Streaming SpeechLLM adds a temporal version of the same operation. The model does not wait for a full utterance, and it does not emit tokens at a fixed clock rate. It learns whether it has seen enough audio to produce output. The paper reports near non-streaming quality with only one to two seconds of latency, but the deeper object is the learned gate between listening and speaking.

That gate is musical too. Performance is full of moments where action must happen before certainty is complete: entering after a cue, following a rubato phrase, deciding whether a noisy transient belongs to the beat, recognizing the next harmony soon enough to voice-lead into it. Waiting longer may improve analysis, but action has a deadline.

A real-time musical system could expose this gate instead of hiding it. Low confidence might hold a note, blur a timbre, delay a response, or keep multiple continuations alive. High confidence might collapse the field into a definite pitch, word, rhythm, or spatial point. The model's decision would not be metadata. It would be audible form.

## The Compositional Connection

The connection across these sources is not simply "audio systems need evidence." It is sharper: evidence becomes machinery.

- In FSD50K-Solo, evidence of singleness becomes a dataset boundary.
- In SR-CorrNet, evidence of source correlation becomes a recovery filter.
- In Streaming SpeechLLM, evidence of linguistic sufficiency becomes an emission gate.

For a composer, these are three versions of the same control surface. Boundary, filter, gate. Decide what may enter the piece, what may separate from the mixture, and when it may act.

An etude could make this explicit. Begin with a noisy archive of overlapping events. A curation layer admits only sounds that meet a chosen source criterion. A separation layer tries to recover one actor from the admitted mixture, with its filter strength controlled by how many cues agree. A translation layer converts the recovered actor into notes only when enough temporal evidence has accumulated. The piece would not just use machine listening. It would stage listening as a chain of consequential decisions.

That is the useful lesson from this extraction batch. Recognition is not passive. Once a system decides what a sound is, it changes the future of that sound.

The filter is the decision, and the decision is part of the instrument.

_Sources: FSD50K-Solo: Automated Curation of Single-Source Sound Events (`j97c8pg9neak74x61xchz55s6s86ryfx`), Asymmetric Encoder-Decoder Based on Time-Frequency Correlation for Speech Separation / SR-CorrNet (`j9707xjeskqasppyj6nw1v99vs86sw9a`), and Streaming Speech-to-Text Translation with a SpeechLLM (`j976ynszeyaxehsqvje6nx8mms86s4wx`). Connections: [When Evidence Becomes Enough](when-evidence-becomes-enough.md), [The Proof Of A Source](the-proof-of-a-source.md), [The Useful Delay](the-useful-delay.md)._
