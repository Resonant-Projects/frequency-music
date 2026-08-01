---
title: "The Single-Source Illusion"
publishDate: 2026-06-19
excerpt: "Sourcehood in audio is not a physical property but an operational commitment systems make under constraints—from AI source separation to orchestration, the boundaries of what counts as 'one sound'…"
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "composition"
  - "information-theory"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

Several recent audio papers circle the same hidden premise: before a system can classify, separate, synthesize, or diagnose sound, it must decide what counts as one source.

That decision is easy to overlook because the phrase "single source" feels physical. One speaker. One machine. One event. One room. But the papers make a sharper claim by implication: sourcehood is not merely a property of the world. It is an operational commitment made by a listening system under constraints.

FSD50K-Solo makes the commitment explicit. The paper starts from a practical dataset problem: open audio corpora often contain background interference or overlapping events, so they are not clean examples of single sound classes. Its solution is to synthesize clean single-class events with a diffusion model, construct controlled mixtures, and train a classifier to identify real samples that behave like single-source examples [S1]. The "single source" here is not simply discovered. It is calibrated.

SR-CorrNet approaches the same boundary from the opposite direction. Its speech-separation problem begins with mixtures: overlapping speakers, noise, and reverberation must be resolved at once. The paper criticizes late-split time-frequency architectures because deferring speaker disentanglement creates a bottleneck. Its alternative uses spatio-spectro-temporal correlations to estimate filters and progressively recover speaker-discriminative features [S2]. In other words, a source is what remains coherent across time, spectrum, and space strongly enough to be separated.

The anomalous-sound-detection paper adds a useful warning. Standard benchmarks often assume the monitored machine is known at test time. When recordings from multiple machines are merged and evaluated without identity labels, performance degrades, and that degradation correlates with the model's implicit machine-identification ability [S3]. The system was never only detecting anomaly. It was also relying on a background act of attribution: which object made this sound?

Then the room-impulse-response paper widens the frame. A room is not a sound source in the usual sense, but convolution reverb makes it behave like a causal partner. The paper adapts text-to-audio priors to generate plausible RIRs from acoustic descriptions, using vision-language labeling to bridge image-room data and acoustic response [S4]. Here the "source" is distributed: direct sound, early reflections, late decay, geometry, material, and microphone position. The room is a source-like transformation.

Together, these papers suggest a compositional principle:

**A source is not one object. A source is the smallest acoustic story a system is willing to keep intact.**

That story can be trained from synthetic clean examples [S1]. It can be recovered from correlations in a mixture [S2]. It can be hidden inside identity assumptions that benchmarks accidentally grant [S3]. It can be outsourced to the room, whose impulse response gives every event a second body [S4].

For music, this is more than an analysis trick. Orchestration already plays with sourcehood constantly. A flute and violin in unison can fuse into one impossible instrument. A piano note can split into hammer, string, soundboard, pedal noise, and room. A reverb tail can stop sounding like space and start answering like another performer. A noisy texture can be heard as one mass until a repeated contour teaches the ear to separate it.

The practical studio question is not only "can I isolate this stem?" It is:

**What evidence lets the listener treat this as one thing?**

There are several levers.

Shared onset binds fragments. Harmonicity binds partials. Spatial position binds reflections and direct sound. Repetition binds events across time. Envelope shape binds noisy and pitched components. A known timbre binds ambiguous spectra to a remembered instrument. A room response binds unrelated gestures into one place.

A composer can weaken any of these. Offset the attacks. Bend the partials out of harmonic alignment. Move only the reflection. Repeat the contour with a different body. Keep the envelope while swapping the spectrum. Preserve the room while changing every instrument inside it.

This produces a useful exercise: write a passage where sourcehood is the form.

Start with a deliberately clean event: one pluck, one breath, one bowed tone. Treat it as the FSD50K-Solo-style calibration object. Then introduce controlled interference: a second event with the same onset, a room response that smears the tail, a partial that belongs harmonically to two possible fundamentals, or a background layer that shares the envelope but not the pitch. The goal is not to make the mix muddy. The goal is to move the listener across thresholds of attribution.

At first the sound is one thing. Then it is maybe two. Then the room becomes suspiciously active. Then the original object returns, but the listener now hears it as a negotiated result rather than a given fact.

This also gives tool builders a test. A music-analysis system should not only output stems, labels, or embeddings. It should expose its source commitments: which fragments it believes belong together, which identity assumptions it is using, and when the evidence is too weak. A separator that hides this uncertainty can sound impressive while being musically brittle. A tool that reveals it can become compositional.

The single-source illusion is not an error. It is one of the ear's great creative acts. We do not hear every pressure variation separately. We bind, attribute, infer, and revise. The interesting music lives near the revision point, where the source is almost stable enough to trust and almost unstable enough to transform.

## Sources

- [S1] "FSD50K-Solo: Automated Curation of Single-Source Sound Events" — arXiv:2605.13931.
- [S2] "Asymmetric Encoder-Decoder Based on Time-Frequency Correlation for Speech Separation" — arXiv:2603.29097.
- [S3] "How Much Does Machine Identity Matter in Anomalous Sound Detection at Test Time?" — arXiv:2602.16253.
- [S4] "Adapting a Text-to-Audio Model for Room Impulse Response Generation" — arXiv:2603.09708.
