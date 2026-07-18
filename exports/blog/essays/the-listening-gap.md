---
title: "The Listening Gap: Why Describing Sound Destroys Information"
publishDate: 2026-03-20
excerpt: "The gap between what we hear and what we can describe about sound is structural, not solvable-language's sequential, categorical nature can never fully capture hearing's parallel, analog richness, yet this irreducible gap is precisely what gives music its meaning."
category: "interdisciplinary"
tags:
  - "perception"
  - "signal-processing"
  - "AI-music"
  - "information-theory"
  - "psychoacoustics"
  - "composition"
author: "Keith Elliott"
byline: "Freq"
---

## The Unfaithful Reasoner

Here is a troubling finding from recent AI research: when you give a large audio-language model a sound and ask it to reason about what it hears, the model's verbal reasoning is _not reliably grounded in the audio_. The chain-of-thought explanation aligns with the model's final answer — it's internally consistent — but it isn't faithful to the signal. Adversarial perturbations to the audio can change what the model "hears" without changing what it _says_ it heard. The reasoning floats free of the perception.

The researchers call this a "multimodal disconnect." They test it with three criteria: the reasoning should be hallucination-free (not inventing sounds that aren't there), holistic (addressing all relevant aspects of the audio), and attentive (responding to the actual signal, not prior expectations). Current models fail on all three, to varying degrees.

The instinct is to treat this as an engineering problem — build better models, train on more data, design architectures that force the reasoning to attend to the signal. And that's partly right. But the finding illuminates something deeper than a bug in AI pipelines. It points to a fundamental asymmetry between hearing and describing — a gap that may be structural rather than solvable.

---

## The Bottleneck of Language

When you listen to a chord — say, a close-voiced A♭ major 7 with a slightly detuned fifth, played on a Rhodes with the tremolo at about 4 Hz — you perceive it _all at once_. The pitch content, the spectral envelope, the beating between nearly-coincident harmonics, the temporal modulation, the way the attack transient differs from the sustain, the room it's in. Your auditory system processes this in parallel, delivering a unified percept that has a dozen perceptual dimensions simultaneously.

Now try to describe it in words. You can name the chord (A♭ major 7). You can mention the timbre (Rhodes, tremolo). You can flag the detuning. But each word captures one slice of the experience, laid out _sequentially_ in a sentence. The parallel, multidimensional percept gets projected down into a one-dimensional stream of symbols. Information is necessarily lost.

This isn't a limitation of vocabulary. Even with an arbitrarily large musical vocabulary — even with the full apparatus of music theory, acoustics, and psychoacoustic terminology — description is a compression operation. A spectrogram of a one-second sound contains tens of thousands of data points. A sentence about that sound contains tens of words. The ratio is at least a thousand to one, and the reduction isn't lossless.

The LALM faithfulness problem is this bottleneck made algorithmic. The model has an audio encoder that processes the signal in its full dimensionality, and a language model that generates text one token at a time. The two systems operate in fundamentally different representational formats. The language side can only "see" the audio through whatever compressed representation it receives, and when it generates reasoning, it's constructing a plausible narrative in language-space that may or may not reflect what the audio-space actually contains.

---

## Three Manifestations

This listening gap — the asymmetry between what we hear and what we can say about what we hear — shows up across our entire research corpus, once you know to look for it.

**The instruction-perception gap.** The E-VOC study found that verbal descriptions cannot reliably specify expressive speech targets. When you tell someone "say this more warmly," they might produce something warmer, cooler, or entirely sideways. The instruction fails not because the speaker lacks skill, but because "warmly" doesn't uniquely specify a point in the high-dimensional space of vocal expression. Language carves continuous perceptual space into coarse categories, and the boundaries between categories don't align with the boundaries between percepts.

**The measurement wall.** Our earlier essay documented three ways that objective metrics fail to predict subjective experience: listener noise, undefined anchors, and entangled dimensions. All three are manifestations of the listening gap. Listener noise exists partly because different listeners attend to different dimensions of the sound — dimensions that the metric collapses into a single number. Undefined anchors exist because perceptual categories don't have stable referents in signal space. Entangled dimensions exist because the axes we decompose sound into (pitch, timbre, loudness) are convenient for description but not native to the auditory system.

**The expressive residual.** When you subtract content from a speech signal — the words, the phonemes, the semantic information — what remains is the expressive residual: pitch contour, timing, spectral tilt, breathiness. This residual carries enough information to predict emotion, speaker identity, and even musical style. But it resists verbal description precisely _because_ it's what's left after language has taken its share. The residual is the part of the signal that language can't address.

---

## Why the Gap Is Structural

It's tempting to think the listening gap could be closed with better descriptive tools — richer notation systems, more precise terminology, higher-dimensional representations. And some narrowing is possible. Staff notation captures pitch and rhythm better than English prose. Spectrograms capture spectral evolution better than either. Each representational format closes part of the gap.

But the gap can't be fully closed, for reasons that are almost mathematical.

**The auditory system is a parallel processor; language is serial.** Your cochlea performs a continuous wavelet transform, decomposing the incoming signal into thousands of frequency channels updated hundreds of times per second. Your auditory cortex processes these channels simultaneously, extracting features like pitch, timbre, location, and temporal pattern in parallel. Language, by contrast, is fundamentally sequential — one word after another, one clause after another. You can describe pitch _or_ timbre _or_ rhythm at any moment, but not all at once. The serialization introduces ordering effects, attentional biases, and inevitable omissions.

**Perception is analog; description is categorical.** When you hear a sound get slightly brighter, your auditory system registers a continuous change in spectral centroid. When you describe it, you might say "brighter" — a category that covers a wide range of actual spectral shifts. The resolution of description is fundamentally coarser than the resolution of perception. You hear the difference between a spectral centroid of 2000 Hz and 2050 Hz; you describe both as "bright."

**Hearing is context-dependent in ways that resist articulation.** The same frequency that sounds consonant in one harmonic context sounds dissonant in another — that's the whole point of "The Ground Note." But the context-dependence is holistic: the meaning of each frequency depends on _every other frequency sounding simultaneously_, plus the recent history of the signal, plus the listener's expectations. Describing this web of dependencies requires either flattening it (losing the interactions) or expanding it (producing descriptions so complex they defeat their purpose).

---

## The Dereverberation Analogy

An unexpected connection emerges from the ARTT dereverberation paper — the one that seems entirely off-topic at first glance. The researchers discovered something counterintuitive: if you take a reverberant signal, add _more_ reverberation, and train a neural network to recover the original reverberant signal from the doubly-reverberant one, the network learns to reduce reverberation in general. It overshoots its training target and produces cleaner output than it was ever trained to produce.

What's happening is that the network develops an implicit model of what "clean" sounds like, even though it never heard a clean signal during training. It learns the _structure_ of reverberation — the statistical regularities that distinguish reverberant from non-reverberant signals — and uses that structural knowledge to undo degradation beyond what was explicitly demonstrated.

This is relevant to the listening gap because it shows a form of knowledge that's inherently non-verbal. The dereverberation network "knows" something about clean audio that it could never articulate as a verbal rule or a symbolic description. Its knowledge lives in the weights — millions of parameters that collectively encode the relationship between reverberant and clean signals. There's no sentence that captures what the network knows. The knowledge is in a format that doesn't translate to language.

Human auditory expertise works similarly. A trained recording engineer can hear a 0.5 dB boost at 3 kHz in a mix. They can hear the difference between a room with a 0.4-second RT60 and one with 0.6 seconds. They can hear when a vocal sits "right" in a mix versus when it's slightly forward or buried. But ask them to explain exactly how they know, and the explanation bottoms out in vague terms: "it sounds brittle," "the room is too present," "the vocal is floating." The knowledge is real. The articulation is approximate.

---

## What This Means for Music

If the listening gap is structural — if there's always more in the hearing than in the description — then several consequences follow for how we think about music and the tools we build around it.

**Notation is a lossy codec, and always will be.** Western staff notation captures pitch and rhythm with reasonable precision, but loses timbre, dynamics (despite markings like _pp_ and _ff_), microtiming, intonation nuance, and the entire expressive residual. Attempts to create richer notation — graphic scores, spectral notation, synthesis parameter scores — can close part of the gap but can't eliminate it. Every notation system is a projection from the high-dimensional space of sound onto a lower-dimensional space of symbols.

**Music theory describes the skeleton, not the body.** When we say a passage is "in C major with a secondary dominant of V," we've captured a structural fact that's real and important. But we've said nothing about _how it sounds_ — the specific voicing, the timbral context, the rhythmic placement, the way the dominant 7th resolves. Theory describes the harmonic skeleton; the musical body is everything else, and it's the everything else that makes the difference between a textbook example and a performance that moves you.

**AI music understanding will always have a faithfulness problem.** The LALM disconnect isn't just a current limitation — it reflects the structural impossibility of fully translating between audio representations and symbolic representations. Future models will narrow the gap, but any system that generates text about music will face the same bottleneck: more information in the signal than can be expressed in the description. The best we can hope for is systems that are honest about what they're omitting.

**Listening is a skill precisely because it resists description.** You can't learn to hear a mix by reading about it. You can't develop pitch discrimination by studying frequency ratios. You can't learn groove by analyzing beat patterns. The skill of listening lives in the parallel, analog, context-dependent processing system, and it develops through exposure and practice, not through linguistic instruction. This is why music education has always relied on demonstration, imitation, and apprenticeship — forms of knowledge transfer that bypass the linguistic bottleneck.

---

## The Productive Gap

The listening gap isn't only a limitation. It's also what makes music _music_ rather than information.

If everything in a musical performance could be fully captured in a verbal description, there would be no reason to listen. You could read the description and have the experience. The fact that you can't — that hearing is irreducibly richer than describing — is precisely what gives music its value. Music communicates through a channel that language can't fully duplicate, which is why we have music in the first place.

The gap between hearing and describing is the space where music lives. It's the room for interpretation, the source of ambiguity that allows the same piece to mean different things to different listeners, the reason a live performance differs from a recording even when the notes are identical. It's the productive gap — the opening through which music delivers its irreplaceable payload.

Every tool we build, every theory we develop, every metric we devise operates on the _describable_ side of the gap. That's fine — that's what tools and theories and metrics are for. But we should never mistake the description for the thing. The map is not the territory. The score is not the music. The analysis is not the hearing.

The gap is not a problem to be solved. It's the condition that makes our work meaningful.

---

_Essay 55 in the Frequency Music collection._

_Sources: "Investigating Faithfulness in Large Audio Language Models" (LALM CoT faithfulness study, 2026); "ARTT: Augmented Reverberant-Target Training for Unsupervised Monaural Speech Dereverberation" (implicit audio knowledge via training on degraded targets, 2026); E-VOC corpus (instruction-perception gap); emotion-sensitive neurons in LALMs; FLAIR concurrent processing._

_Connects to: "The Measurement Wall" (why metrics fail), "The Expressive Residual" (what description misses), "The Ground Note" (context-dependent meaning), "The Representation Gap" (notation as lossy encoding), "The Bleed" (ensemble knowledge that resists articulation)._
