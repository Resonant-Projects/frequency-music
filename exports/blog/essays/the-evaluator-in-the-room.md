---
title: "The Evaluator in the Room"
publishDate: 2026-07-12
excerpt: "Evaluation is not outside the music: verifiers, timing habits, saliency maps, and codecs shape what becomes audible. Compose the signal—and the evaluator that judges it."
category: "interdisciplinary"
tags:
  - "perception"
  - "AI-music"
  - "psychoacoustics"
  - "signal-processing"
  - "composition"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The False Neutral Judge

Three recent extractions circle the same uncomfortable fact from different sides. A TTS paper reports that best-of-N speech selection depends strongly on which ASR family is used as the verifier: Whisper, wav2vec 2.0, and HuBERT can reverse the apparent ranking of candidates, and same-family verifier/evaluator pairs recover two to three times more oracle headroom despite very high representational similarity. A conversational ASR paper finds that recognition performance is shaped less by raw simulator coordinates than by induced overlap and gap timing statistics. A speech-deepfake explanation paper aligns detector saliency with phonemes and pauses, showing that spoof cues depend on attack and speaker.

The common thread is not simply "machine listening is biased." The stronger claim is that evaluation is an acoustic environment. The verifier family, the timing distribution, and the phoneme-aligned saliency map are not outside the sound, looking in. They are part of the practical system that decides which differences become audible, measurable, or actionable.

That matters for music because composition already lives inside evaluators. The ear is an evaluator. A venue is an evaluator. A notation system is an evaluator. A mix bus is an evaluator. A streaming codec is an evaluator. A model trained to detect AI music is an evaluator. Each one privileges some invariants and discounts others, and the music that survives those filters is not identical to the music that was made.

## Lineage Is Not Similarity

The most striking number in the TTS extraction is the reported linear CKA similarity of 0.978 between representations that still behave differently when used as evaluators. If that result holds beyond the abstract, it is a useful warning: two listening systems can occupy nearly the same representational geometry and still make different practical judgments because they share a lineage, a training history, a task framing, or an error habit.

For composition, this suggests a difference between surface similarity and evaluative kinship.

Two sounds can look close in a feature space and still belong to different listening lineages. A whispered vocal and a bowed cymbal can share noise-rich spectra while triggering completely different source expectations. A human performance and an AI imitation can be semantically aligned while leaving tiny provider-specific residues in attack shape, vowel stability, ambience, or mastering texture. A raga phrase and a Western melodic borrowing can share pitch inventory while differing in which notes carry grammatical weight.

Similarity says "these points are near." Lineage says "these points are judged by the same inherited habits." The first is geometry. The second is history embedded in measurement.

## Timing as a Training Condition

The overlap-gap extraction adds another axis. In synthetic conversation, more overlap exposure was associated with lower cpWER, while longer and more variable gaps were associated with higher cpWER. The finding is about ASR, not music, but it points at a compositional lever: temporal density is not only a perceptual surface. It trains the evaluator.

A listener who has been immersed in sparse call-and-response hears interruption as disruption. A listener acclimated to dense ensemble polyphony may hear overlap as coherence. A model trained on clean turn-taking may fail where humans track layered speech, while a model trained on overlap learns to expect simultaneity. The boundary between "too crowded" and "richly interwoven" is partly a property of the listener's timing diet.

This gives composers a practical question: what overlap-gap distribution does a piece teach before it asks the listener to understand something difficult?

A work for voices could begin with generous separation, then gradually increase overlap exposure until the ear learns the ensemble's crossing patterns. Or it could do the reverse: train the ear on dense simultaneity, then make a single isolated pause feel enormous. The parameter is not only note duration or rest duration. It is the listener's adaptation curve.

## Saliency Has a Phoneme

The deepfake-explanation extraction makes the evaluator more local. Grad-CAM plus speech recognition can align detector saliency with phonemes and pauses, revealing attack- and speaker-dependent cues. This is fascinating because it turns a black-box authenticity judgment into a time-aligned vocal map: this vowel, this pause, this consonant transition carried the evidence.

Musically, that suggests a way to treat authenticity as an orchestratable texture rather than a binary label. If some phonemes, pauses, or transitions carry more human/synthetic ambiguity than others, a vocal composition can move through zones of confidence and uncertainty. A phrase might sound human at the level of melody but synthetic at the level of fricative noise. A chorus might preserve speaker identity in vowels while making plosives shimmer with artificial precision. Pauses might become charged events, not empty gaps, because the evaluator treats them as evidence.

This is not an argument for fooling detectors. It is an argument for listening to where detectors listen. Saliency maps can become strange scores: not instructions for pitch and rhythm, but maps of evidential pressure.

## The Compositional Rule

The rule that emerges is simple:

**Never compose only the signal. Compose the evaluator.**

That can mean several concrete practices:

- Use multiple evaluators when judging generated or transformed audio, and treat disagreement as musical information rather than noise.
- Design overlap and silence distributions deliberately, because timing trains intelligibility.
- Inspect where a model places saliency, then ask whether those regions correspond to humanly meaningful vocal gestures.
- When comparing sounds, separate representational similarity from evaluative lineage.
- Treat authenticity, intelligibility, and naturalness as situated judgments, not intrinsic scalar properties.

The deeper connection to the knowledge graph is with earlier notes on representation and measurement. The observer's instrument shapes the object. The surface and the source can diverge. The codec ear does not receive music passively; it constructs music through a particular compression. These new extractions sharpen that frame: even when the representation is nearly the same, the evaluator's lineage can change the answer.

## A Studio Prompt

Make a short vocal study with three passes through the same text.

In the first pass, maximize semantic clarity: separated phrases, clean vowels, stable consonants. In the second, preserve the text but increase overlap exposure between voices until intelligibility begins to depend on learned timing patterns. In the third, keep the overlap profile but alter only the phoneme-level surface: breath noise, plosive sharpness, vowel formants, and pause texture.

Then evaluate it three ways: by ear, by transcription, and by some learned audio or speech model. The interesting material is not where the evaluators agree. It is where one hears continuity, another hears error, and another hears evidence.

That disagreement is not a failure of measurement. It is the room the music is actually in.

---

_Bridges: [The Observer's Instrument](the-observers-instrument.md), [The Surface and the Source](the-surface-and-the-source.md), [The Codec Ear](the-codec-ear.md), [The Voice Has More Axes Than the Metric](the-voice-has-more-axes-than-the-metric.md), [What the Machine Hears](what-the-machine-hears.md)_

_Sources: extractions `j970r1k7q7f6ap0pkcmvbscv258adgrv` (ASR-family verifier coupling in best-of-N TTS), `j975s3wd5syra0ynwdqaaexks98ac12w` (overlap-gap timing statistics in conversational ASR), and `j977fepy1fx8pknsckn3zq3za18add1q` (phoneme-aligned saliency for speech deepfake detection)._
