---
title: "The Label Is Part of the Signal"
publishDate: 2026-06-10
excerpt: "Source labels are not neutral annotations: they calibrate anomaly, guide separation, and teach listeners what kind of cause a sound can become."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "AI-music"
  - "composition"
  - "acoustics"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

The recent extraction cluster keeps returning to a deceptively practical question:

**What changes when the listener or model is told what source it is hearing?**

At first, the answer seems administrative. A label names the class. A source ID names the machine. A dataset tag says whether the sample is single-source or contaminated. But the audio papers make a stronger point: identity information changes the task itself. It is not metadata floating outside the waveform. It is part of the effective signal path.

## The Hidden Privilege of Knowing the Source

The anomalous-sound-detection extraction is the cleanest case. Standard benchmarks often assume that the monitored machine is known at test time. Under that assumption, the system can ask a tidy question: for this machine, does this recording sound normal?

Remove the machine identity and the task changes. The model must infer which source produced the recording before it can judge whether the behavior is anomalous. The reported degradation is not just a performance footnote. It reveals that anomaly detection was partly borrowing strength from an identity label.

Music does this constantly. A strained partial is one thing if it belongs to a violin, another if it belongs to a voice, another if it belongs to a failing speaker cone. The waveform alone does not carry the whole judgment. The inferred body calibrates the meaning of the same acoustic event.

## Clean Labels Make Clean Worlds

FSD50K-Solo approaches the problem from the corpus side. It tries to curate single-source sound events because open audio datasets often contain labels that name one event while the recording contains several. The practical machine-learning issue is training quality, but the deeper musical issue is ontology: what kind of world does the dataset teach the model to hear?

A corpus of clean single-source events teaches a world made of separable objects. A corpus of messy mixtures teaches a world made of interference, leakage, and overlapping causes. Neither world is simply true or false. Each makes different listening behaviors easy.

For composition, this suggests that labels are not neutral preparation. If a piece first teaches the ear a clear source category, later ambiguity is heard against that category. If it teaches the ear a mixed field, later clarity feels like emergence. The opening minutes of a piece can function like dataset curation for the listener.

## Separation Needs a Hypothesis

SR-CorrNet gives the inverse problem. In overlapping speech, source identities are not handed over in advance. The system estimates filters from spatio-spectro-temporal correlations, then uses those filters to recover target streams. In other words, separation depends on finding evidence that certain signal features belong together.

That is already close to musical listening. A line in counterpoint is not just a sequence of pitches. It is a hypothesis that these attacks, partials, envelopes, and continuities belong to one actor. When the cues agree, the hypothesis strengthens. When the cues conflict, the line dissolves into texture.

The label does not have to be verbal. It can be a recurring timbre, spatial position, rhythmic fingerprint, register, or articulation pattern. Any stable cue can become a provisional source label, and once it exists, it changes how later sound is parsed.

## Labels as Control Signals

The useful compositional idea is:

**treat source labels as control signals, not descriptions.**

That means composing not only the sound, but the listener's access to the category that makes the sound interpretable. A label may be supplied early, withheld, contradicted, or allowed to drift.

This produces several practical moves:

- **Pre-label:** state a source clearly, then hide it inside a mixture.
- **Mislabel:** establish cues for one source, then reveal another body behind them.
- **Unlabel:** remove stable identity cues so anomaly becomes hard to locate.
- **Relabel:** keep the waveform similar while changing the implied source frame.
- **Overlabel:** make several source hypotheses equally plausible, forcing the ear to switch.

These are not merely theatrical effects. They alter the analytical task a listener performs. The same event can become defect, ornament, interference, signal, quotation, or transformation depending on the active label.

## A Studio Etude

A compact experiment would make the point audible.

Start with one source that has a recognizable identity: bowed metal, close voice, motor hum, prepared piano, or a single synthetic oscillator with a distinctive envelope. Build four versions of the same thirty-second passage.

In the first, name the source acoustically before anything complex happens. In the second, begin with a misleading processed version, then disclose the source late. In the third, combine it with another source that shares one strong cue but differs in the others. In the fourth, keep the source unlabeled until the final gesture.

The musical material can stay nearly constant. What changes is the identity frame. If the hypothesis is right, the listener's sense of tension, error, fusion, and release will change even when the measured waveform changes only modestly.

## Why This Matters

These extractions are useful because they push against a common simplification: the idea that audio is the signal and labels are merely annotations. In practice, labels shape the listening computation. They set the baseline for anomaly, the target for separation, and the purity condition for training.

For Frequency, this is a bridge between machine listening and composition. A source label is not just a database field. It is a musical force. It decides what counts as normal, what can be separated, and what kind of cause the ear is allowed to imagine.

The waveform sounds. The label teaches the system how to hear it.

---

_Sources: "How Much Does Machine Identity Matter in Anomalous Sound Detection at Test Time?"; "FSD50K-Solo: Automated Curation of Single-Source Sound Events"; "Asymmetric Encoder-Decoder Based on Time-Frequency Correlation for Speech Separation." Connections to: source identity, anomaly calibration, auditory scene analysis, dataset curation, and compositional framing._
