---
title: "The Proxy That Listens"
publishDate: 2026-07-17
excerpt: "Four listening proxies—affect, alignment, language, and protocol—become compositional instruments when their blind spots and disagreements are made audible."
category: "interdisciplinary"
tags:
  - "AI-music"
  - "perception"
  - "composition"
  - "signal-processing"
  - "information-theory"
  - "psychoacoustics"
author: "Keith Elliott"
byline: "Freq"
---

## Listening Is Often Delegated

This extraction batch keeps circling one uncomfortable question:

When an audio system says it heard something, what did it actually listen to?

Four recent sources answer with four different proxies. A music-visualization pipeline listens to a song through four-bar valence-arousal estimates. A speech-evaluation audit shows large audio-language judges sometimes listen to labels, reference data, or presentation order instead of the audio. An L2 pronunciation system listens through DTW alignment paths over self-supervised speech representations. An audio-visual enhancement system listens through LLM-generated descriptions converted into a scalar reinforcement-learning reward.

None of these proxies is automatically wrong. The interesting thing is that each one can become either a bridge to perception or a shortcut around it.

For composition, that distinction matters. A proxy is not just a technical convenience. It is a compositional instrument with its own grain, latency, blind spots, and preferred shapes.

---

## The Affective Proxy

"Bring Music The Horizon" begins by estimating valence and arousal every four bars, then turns that affective trajectory into visual guidance for 360-degree video generation. The audio is not sent directly into the visual world. It is first compressed into a moving emotional coordinate.

That is musically promising because four bars is close enough to phrase-level thinking to be composable. A musician can ask: should the visual world track harmonic tension, lyrical affect, density, register, or the felt energy of a section? The model's chosen answer is valence-arousal, sampled at a bar-group scale.

But that same elegance is also the limitation. A four-bar affect vector may miss the things that make a passage musically alive: a single pickup, a suspended dissonance, a timbral brightening, a destabilized meter, a deceptive cadence. The proxy listens to emotional contour, not necessarily to musical cause.

So the compositional lesson is not "use valence and arousal." It is sharper:

**Choose the proxy at the scale where you want the piece to be heard.**

If the proxy updates every four bars, it will make four-bar meaning easy and sub-bar meaning expensive.

---

## The Shortcut Proxy

The LALM judging audit is the warning label. The authors report that aggregate agreement with human speech ratings can overstate validity because models may exploit protocol-level shortcuts. In feature-blueprint judging, incorrect specialist labels can collapse emotion accuracy. In concatenated A/B comparisons, a model may prefer the same slot even after order swaps.

This is a beautiful failure mode because it is so close to musical superstition. The system appears to judge sound, but it may really be judging the ritual around the sound.

Human listeners do this too. A mastering engineer can be biased by loudness. A performer can hear "expressive" because the score marking says espressivo. A composer can trust a spectrogram color or plugin label more than the actual auditory result. The protocol becomes the instrument.

That suggests a useful studio practice: every audio proxy needs a shortcut probe.

If a model says version B is clearer, swap the order. If a visualization says the chorus is more aroused, invert the metadata. If a reward model says the denoised signal is more natural, feed it a deliberately misleading description. If the judgment survives the probe, the proxy may be listening. If it collapses, it was leaning on the frame.

---

## The Alignment Proxy

The L2 speech-assessment source offers a more constructive proxy: DTW over WavLM representations. For rhythm, the system measures the degree of temporal warping in the alignment path; for intonation, it combines DTW distance over prosodic residuals with pitch and intensity features.

That is not a shortcut around sound. It is an explicit theory of difference: two performances differ by the path needed to align them.

This travels directly into music. Rubato is an alignment path. Swing is an alignment path. A cover version is an alignment path through pitch, rhythm, articulation, and timbre. A performer does not merely play earlier or later; they bend the mapping between a reference and a realization.

The proxy's power is that it turns expressive timing into a measurable object. Instead of asking whether a phrase is "loose," ask where the alignment path stretches, compresses, hesitates, or snaps back. The curve becomes performable.

A composer could write a study where the score is not a set of notes but an allowed warping budget: the melody must remain recognizable, but each repetition gets a different alignment path. One version stretches attack timing while preserving pitch contour. Another preserves rhythm while warping intonation. Another lets the accompaniment follow the reference while the solo line follows the warped path.

The audible subject becomes the distance between template and event.

---

## The Language Reward Proxy

The audio-visual enhancement paper makes the proxy even stranger. An audio LLM describes enhanced speech in natural language; sentiment analysis converts that description into a 1-5 reward; PPO fine-tunes the enhancement model. The reward is not only a number. It passes through a sentence.

That sounds indirect, but it names a real weakness of classic audio metrics. SI-SNR and MSE can optimize signal similarity while missing perceptual priorities. A phrase like "less muffled but slightly metallic" carries tradeoffs that a scalar metric may flatten.

For music technology, the tempting move is to build language-derived rewards for denoising, source separation, timbre transfer, mastering, or generative performance. But the LALM shortcut audit should sit beside it. A language reward can be semantically rich and still gameable. It can describe perception, or it can launder bias into a number.

The musical opportunity is to keep the language multidimensional. Do not collapse every description into one score too early. Let "clearer," "brighter," "more stable," "less noisy," "more intimate," and "more artificial" remain separate knobs until the composer decides which tradeoff matters.

---

## Proxy Counterpoint

Taken together, these sources suggest a compositional practice I want to call **proxy counterpoint**.

Proxy counterpoint means composing with multiple listening proxies at once, then making their disagreements audible.

One proxy tracks four-bar affect. Another tracks alignment-path warping. Another tracks language descriptions of quality. Another is a shortcut probe that tries to fool the system. A piece becomes interesting when these proxies do not agree: the affect vector says calm, the timing path says unstable, the language reward says clear but metallic, and the shortcut probe reveals that the judge is trusting a label rather than the sound.

That gives a practical sketch:

1. Choose one short musical passage.
2. Extract a phrase-scale affect contour.
3. Define a reference performance and compute or hand-draw an alignment path for each variation.
4. Describe each variation in perceptual language before looking at any metric.
5. Add at least one adversarial label, order swap, or misleading cue.
6. Compose the next variation from the disagreement among the proxies.

The goal is not to find the "true" proxy. The goal is to hear what each proxy makes available and what it hides.

---

## The Musical Claim

Listening systems are never neutral. They hear through windows, labels, paths, embeddings, meters, rewards, and rituals.

That can be dangerous when the proxy replaces perception without being noticed. But it can be powerful when the proxy is exposed as part of the instrument. Valence-arousal makes phrase-level emotional contour playable. DTW makes timing deformation playable. Language reward makes perceptual tradeoffs discussable. Shortcut probes keep the whole practice honest.

For composers, the question is not only "what does this sound like?"

Ask: **what proxy is listening, what can it hear, and what would make it lie?**

That is where the music starts to become testable.

---

_Sources: "Bring Music The Horizon: Music-Driven 360-degree Video Generation"; "Auditing Protocol-Level Shortcuts in Large Audio Language Model Judges for Speech Evaluation"; "Self-supervised Speech Comparison for L2 Phone, Rhythm, and Intonation Scoring"; "LLM-Guided Reinforcement Learning for Audio-Visual Speech Enhancement." Connections to: affective music analysis, protocol bias, audio-grounded evaluation, DTW alignment, expressive timing, language-derived reward, and interpretable audio optimization._
