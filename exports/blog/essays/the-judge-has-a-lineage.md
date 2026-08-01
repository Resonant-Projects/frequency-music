---
title: "The Judge Has a Lineage"
publishDate: 2026-07-12
excerpt: "Audio judgments inherit the histories of their models, datasets, and timing distributions. Mapping disagreement across machine and human listeners turns evaluation bias into compositional material."
category: "interdisciplinary"
tags:
  - "AI-music"
  - "perception"
  - "composition"
  - "signal-processing"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

Recent extractions keep circling the same uncomfortable fact: an audio system does not merely hear a signal. It hears through a history.

That history might be a model family, a training dataset, a timing distribution, a phoneme recognizer, or a pairing rule between real and synthetic examples. Whatever its form, it becomes part of the judgment. The score is never just about the sound in front of the system. It is also about the path by which the judge learned what counts.

The cleanest case is the best-of-N text-to-speech extraction. Multiple TTS candidates are generated, then an ASR verifier chooses the one with the strongest content consistency. This sounds sensible until the verifier is evaluated by a related ASR family. The reported rankings reverse across Whisper, wav2vec 2.0, and HuBERT evaluators, and same-family verifier/evaluator pairs recover two to three times more oracle headroom than cross-family pairs despite very high representation similarity. The learned representations can look almost identical by linear CKA while their judgments still carry family loyalty.

That is a beautiful warning. Similar coordinates do not guarantee independent ears.

The conversational-timing extraction gives the same warning in temporal form. A recognizer trained on synthetic multi-speaker conversation is not shaped only by the words or speakers it sees. It is shaped by the induced distribution of overlap and gaps. Higher overlap exposure was associated with lower cpWER, while longer and more variable gaps were associated with higher cpWER. The downstream behavior followed timing statistics more directly than raw simulator coordinates or corpus proximity.

So the judge has a timing diet. Feed it a world with one kind of interruption pattern, and it learns one definition of conversational competence. Feed it another, and the boundary of intelligibility moves.

The phoneme-level deepfake detector makes the lineage visible at a finer grain. Its explanation pipeline combines Grad-CAM with speech recognition, aligning detector saliency to phonemes and pauses. That move is useful because it gives humans terms for the detector's evidence: particular phonetic cues vary by spoofing attack and speaker. But it also means the explanation is mediated by a recognizer's segmentation of the voice. The artifact is not simply "the model noticed a fake." It is "the model's heat has been translated into a phoneme-and-pause vocabulary."

That translation is already a theory of listening.

The Echoes music-deepfake dataset pushes the problem into music. Its construction uses semantically aligned real and generated tracks, conditioning synthetic examples on bona-fide waveforms or song descriptors, with provider diversity across ten AI music systems. The point is to prevent shortcut learning. A detector should not win merely by noticing one generator's surface artifact. It should be forced to compare sounds that are close enough in musical identity that the easy cue disappears.

This is the musical version of cross-family evaluation. If the judge and the trick share a lineage, the result may be impressive but narrow. If the judge survives across providers, pairings, genres, and semantic alignments, then it begins to look like a listener rather than a fingerprint matcher.

There is a compositional principle here:

> Every musical judgment should name the lineage of its judge.

For a human listener, lineage means ear training, cultural exposure, room memory, instrumental habit, and taste. For a machine listener, it means architecture, pretraining corpus, evaluator family, calibration set, prompt, timing distribution, and target metric. In both cases, the judgment is not invalid because it has a history. It becomes invalid when the history is hidden and mistaken for neutrality.

This matters for composition because many interesting pieces live exactly at the boundary where judges disagree. A sung vowel can be human enough for one detector and synthetic enough for another. A dense vocal texture can be intelligible to a listener trained on overlap and opaque to one trained on clean turn-taking. A generated song can preserve enough semantic identity to fool a shallow detector while failing some deeper test of phrase, production, or embodied timing.

Those disagreements are not just evaluation problems. They are material.

Imagine a tool that exposes several audio judges side by side: a speech recognizer, a music-deepfake detector, a phoneme saliency model, a source-separation model, a pitch tracker, and a human annotation layer. The interesting output would not be a winner. It would be the disagreement map:

- where verifier families reverse rank
- where phoneme saliency concentrates on pauses instead of vowels
- where overlap improves machine intelligibility while reducing human clarity
- where semantic alignment preserves song identity but changes production fingerprints
- where a detector calls something synthetic because it resembles a known provider rather than because it violates musical plausibility

Composers could write for those fractures. A piece could begin as consensus speech, drift into verifier-family disagreement, pass through a region where timing exposure determines intelligibility, then arrive at a generated/human hybrid where semantic identity remains stable while authenticity judgments split apart. The score would not only specify sound. It would specify which judge is allowed to be confident.

This reframes evaluation as orchestration. Each judge is an instrument with a range, bias, latency, and preferred repertoire. Whisper, wav2vec 2.0, HuBERT, a phoneme aligner, a music-deepfake detector, and a listener in a room are not interchangeable measurement devices. They are different ears with different lineages.

The practical next step for Frequency Music is to treat "judge lineage" as a first-class graph concept alongside semantic alignment, speech overlap, phoneme-level analysis, provider diversity, and evaluation confounds. The graph should not merely say that these sources concern machine listening. It should preserve the deeper connection: learned audio judgments are conditioned by the histories that produced their evidence.

That connection is not a reason to distrust every measurement. It is a reason to make measurement composable. Once the judge has a named lineage, disagreement stops being noise. It becomes a playable surface.

_Sources: best-of-N TTS verifier/evaluator coupling (`j970r1k7q7f6ap0pkcmvbscv258adgrv`), conversational overlap-gap timing for ASR (`j975s3wd5syra0ynwdqaaexks98ac12w`), phoneme-level speech deepfake explanations (`j977fepy1fx8pknsckn3zq3za18add1q`), and Echoes music-deepfake semantic alignment (`j975pyh69ve1zwv2xwe8e45wrd8ab3rv`)._
