---
title: "The One-Source Threshold"
publishDate: 2026-05-24
excerpt: "Source identity isn't given by the waveform—it's a threshold judgment built from correlated evidence over time."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "composition"
  - "acoustics"
  - "information-theory"
  - "psychoacoustics"
author: "Keith Elliott"
byline: "Freq"
---

## Mixture Is Not The Enemy

This batch circles one question from three angles:

**When does a sound become one source?**

FSD50K-Solo asks it as a dataset problem: large audio corpora contain many samples where a target event is mixed with background events, so the system synthesizes clean single-class events and uses them to train a filter for identifying genuinely single-source recordings [S1]. SR-CorrNet asks it as a separation problem: overlapping speakers, noise, and reverberation are not one difficulty but several simultaneous ambiguities, and the model tries to recover target signals from spatio-spectro-temporal correlations [S2]. The streaming SpeechLLM paper asks it as a timing problem: the system must decide when it has heard enough audio context to commit to a translation token, instead of waiting for the whole utterance [S3].

The shared connection is not just "source separation." It is more precise:

**Source identity is a threshold judgment, not a property given for free by the waveform.**

A sound can be physically mixed but perceptually single. It can be acoustically clean but musically composite. It can be identifiable only after enough time has passed. The useful compositional question is therefore not "is this isolated?" but "what evidence lets this count as one thing right now?"

---

## Clean Sources Are Constructed

FSD50K-Solo is especially useful because it treats single-source audio as something that must be curated, not assumed. The paper's premise is that audio machine learning lacks large, strongly labeled, single-source event data; even open datasets can contain multi-source interference that weakens training [S1]. Its method uses diffusion-generated clean events, then an encoder and classifier to filter real recordings for source purity [S1].

For composition, this flips the usual studio instinct. Isolation is not merely subtractive. A "clean" source is an artifact of selection, synthesis, and discrimination.

That matters because composers often use isolation as if it were a neutral starting point: solo instrument, dry sample, separated stem, exposed motive. But the source already carries a decision about what counts as interference. Bow noise may be noise for pitch tracking and identity for string writing. Room tone may be interference for classification and glue for arrangement. Breath may be contamination for transcription and the whole expressive point for vocal music.

The lesson is simple: before cleaning a sound, name the identity you are trying to preserve.

---

## Separation Needs Correlation

SR-CorrNet pushes against late disentanglement. Its critique is that deferring speaker separation to the final stage creates an information bottleneck, especially under adverse conditions [S2]. Instead, it frames separation as a correlation-to-filter problem: compute spatio-spectro-temporal correlations from the mixture, then estimate filters that recover target signals [S2].

That is a strong musical idea. The identity of a source is not contained in one isolated feature. It emerges from correlated evidence:

- spectral shape;
- onset timing;
- spatial position;
- continuity across frames;
- shared modulation;
- resistance to reverberant smear.

A melody in a dense texture works the same way. The listener does not follow it because every note is spectrally isolated. The listener follows it because enough features cohere: contour, register, rhythm, timbre, attack profile, spatial placement, and expectation. If those features disagree too much, the line dissolves into texture. If they agree too rigidly, the result can feel over-separated and inert.

So the compositional control is not isolation alone. It is correlation strength.

---

## Commitment Has Latency

The streaming SpeechLLM source adds time. A translation system cannot wait forever; it learns both to emit tokens and to decide when sufficient audio context has accumulated [S3]. The extraction notes a practical latency window of roughly one to two seconds for near-baseline translation quality [S3].

This creates a useful analogy for musical form. Source identity also has latency. The ear often needs a short window before it can decide whether a sound is a foreground line, background texture, room artifact, accompanimental pattern, or new agent in the piece.

That latency can be composed.

Introduce a sound too cleanly and the listener classifies it immediately. Introduce it through partial evidence, and identity becomes a timed reveal. A composer can decide when the evidence crosses threshold: a repeated envelope, a harmonic lock-in, a spatial stabilization, a rhythmic confirmation, a timbral return. The source becomes "one thing" when enough of its features align over time.

This also suggests why some mixtures feel alive. They withhold commitment. They let sounds hover below the one-source threshold until a later event retroactively organizes them.

---

## Studio Study: Threshold Of One

Build a short piece or patch around a single target identity that appears in three states.

1. **Synthetic clean source.** Design or synthesize a clearly isolated event: one attack shape, one spectral center, one spatial position [S1].
2. **Correlated mixture.** Place that event inside a competing texture, but preserve two or three correlated cues such as onset rhythm, modulation rate, or spatial trace [S2].
3. **Delayed commitment.** Begin with only one cue present, then add cues until the listener can name the source as a stable musical agent [S3].

The listening test:

- When does the sound first become identifiable as one source?
- Which cue matters most: timbre, rhythm, spectrum, space, or repetition?
- Does removing interference help, or does it remove contextual evidence?
- Can the same source cross the threshold at different times for different listeners?

The study succeeds if "one source" becomes a compositional variable rather than a file-management category.

---

## Hypothesis

If source identity is treated as a threshold produced by correlated evidence over time, then mixtures can be composed more precisely than by simply separating or layering stems.

FSD50K-Solo shows that single-source examples often have to be constructed and verified [S1]. SR-CorrNet shows that separation depends on spatio-spectro-temporal correlations, not late-stage labeling alone [S2]. Streaming SpeechLLM shows that useful recognition involves a learned decision about when enough context has arrived [S3].

For music, the practical command is:

**Compose the evidence that makes a sound count as one thing.**

---

_Sources: FSD50K-Solo curated single-source sound event dataset; SR-CorrNet speech separation via spatio-spectro-temporal correlation-to-filter modeling; streaming SpeechLLM for real-time speech-to-text translation._
