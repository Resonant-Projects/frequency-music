---
title: "What The System Is Allowed To Know"
publishDate: 2026-08-10
excerpt: "What a sound system knows shapes what it can make. From tone-marked speech and model capacity to vocal diversity and room acoustics, composers can make evidence boundaries audible."
category: "interdisciplinary"
tags:
  - "AI-music"
  - "information-theory"
  - "perception"
  - "acoustics"
  - "composition"
  - "signal-processing"
author: "Keith Elliott"
byline: "Freq"
---

## The Information Boundary

Several recent extractions circle the same question from different sides: not what a model can infer in principle, but what it is allowed to know when the sound has to be made, recognized, or predicted.

That boundary is musical. A Yoruba synthesizer can know tone marks and phonological rules before it chooses a diphone. A compact Hindi TTS student can inherit a teacher's width and interfaces but must survive with fewer transformer blocks. A multilingual ASR benchmark asks whether recognition still works when speech comes from children, elders, accents, dialects, domain terminology, and low-resource languages. A room-acoustic predictor looks much better when the test position's own measurements sneak into the input than when it only receives deployment-available geometry and environmental state.

Each system is less about intelligence in the abstract than about permitted evidence.

## Tone As Licensed Knowledge

The TTSYoruba extraction is beautifully explicit about its knowledge boundary. The system takes tone-marked Yoruba text, applies hand-crafted phonological rules, and selects from 651 recorded diphone units spanning five tonal variants of consonant-vowel combinations. It also derives contextual rising and falling tones from level-tone input and disambiguates oral /n/, nasalized vowels, and syllabic nasals.

This is not a model trying to hallucinate tone from a neutral spelling. The orthography carries licensed musical information. Tone marks tell the synthesizer which pitch-contour family it may choose, and the phonological rules decide how local context reshapes that contour.

For composition, the useful lesson is direct: notation can be a control surface for prosody. A contour mark is not merely a label attached to a vowel. It is an instruction that selects an acoustic trajectory from a finite inventory. A composer working with speech-music hybrids could treat tone marks as score symbols whose output is neither arbitrary melody nor flat phonetic transcription, but rule-governed vocal motion.

## Capacity As A Memory Limit

The Hindi TTS pruning extraction gives the boundary a different form. The teacher model can be reduced by depth pruning, but only up to a point. The reported path descends from 22 to 16 to 12 to 8 to 6 transformer blocks, re-fine-tuning after each stage and gating progress with ASR word-error rate. The teacher remains near-functional after a 27 percent block reduction, collapses past 50 percent, stays robust down to 131M parameters, and hits a clear capacity cliff at 102M.

That cliff is not just an engineering number. It is a threshold in what the model can continue to carry. Width, text dimensions, attention heads, and mel/text I/O remain fixed so tensors can transfer cleanly; depth is the sacrificed axis. The question becomes: how many sequential transformations are needed before speech still feels like speech?

Musically, this suggests an exercise in subtractive vocal architecture. Keep a vocal identity, phoneme sequence, or pitch contour constant while progressively removing layers of transformation. At first, the voice may remain recognizable. Then a small further reduction can make timing, articulation, or spectral detail fail all at once. The audible artifact is the sound of capacity becoming insufficient.

## Benchmarks As Admissible Evidence

GigaSpeechBench widens the same problem to human variation. High-resource ASR benchmarks can overestimate real-world robustness because they do not force systems to confront enough dialect, accent, age, terminology, and low-resource-language variation. The extraction reports 680 hours of human-annotated speech, including 12 low-resource Middle Eastern and Southeast Asian languages, Chinese dialects, English accents, Japanese, Korean, domain-specific terminology, and child and older-adult speech.

Here the boundary is not inside the model. It is in the evaluation world. If a recognizer is tested only on speech close to its training center, it is allowed to ignore much of the human voice. Once the benchmark admits age, accent, dialect, and domain vocabulary as evidence, the apparent competence changes.

For music, this argues against treating "voice" as a clean average. Accent, age, dialect, and terminology are not nuisance variables around an ideal utterance. They are carriers of rhythm, spectral tilt, timing, articulation, and identity. A robust compositional tool should not flatten them into error. It should expose them as dimensions of vocal material.

## The Room Knows Too Much

The room-acoustics extraction makes the sharpest methodological version of the question: what does the model actually see? Row-based validation with measured-at-test inputs gives high reported accuracy for room-acoustic parameters. But when receiver positions are grouped and inputs are limited to source-receiver geometry and environmental state, R2 values fall sharply. A hybrid CNN given the target's own impulse response appears to use it as a position fingerprint rather than transferable acoustic information.

This is a clean distinction between two tasks that can sound deceptively similar. Condition interpolation at already measured positions is operationally useful. Predicting acoustics at unmeasured positions is also useful. But they are not the same task, because the system is allowed to know different things.

Compositionally, the same distinction matters in spatial music. If the room has already been measured at a seat, a piece can adapt to that seat as a known acoustic address. If the seat is unmeasured, the piece must act from geometry, materials, and weaker priors. The score should know which kind of knowledge it is using.

## A Studio Test

Make one short spoken phrase and one sustained instrumental tone. Then build four versions:

1. Orthographic version: control the spoken phrase using explicit contour symbols or pitch annotations.
2. Capacity version: progressively remove processing layers or synthesis detail until intelligibility suddenly breaks.
3. Robustness version: pass the phrase through accent, age, register, and noise variations without letting the system normalize them into sameness.
4. Room-knowledge version: spatialize once using a measured impulse response, then again using only guessed geometry.

The point is not to make four effects. The point is to hear the information boundary. What changes when the system knows the contour? What breaks when memory is too shallow? What survives when the speaker moves away from the benchmark center? What is different when the room is known as a fingerprint instead of predicted as a field?

## The Research Handle

A sound tool should declare its admissible evidence.

That is the connection across these sources. TTSYoruba makes tone marks and rules explicit. The Hindi pruning recipe measures how much architecture can be removed before speech quality falls off. GigaSpeechBench expands the admissible human variation in recognition. The room-acoustic protocol shows that the same model can appear strong or weak depending on whether test-time information is legitimately available.

For composers, this becomes a practical design rule: decide what the system is allowed to know, then make that boundary audible.

Music often lives exactly there. Between a contour that is marked and one inferred. Between a voice with enough internal transformation and one that has crossed a capacity cliff. Between a benchmark voice and a real body. Between a measured room and an imagined one.

The information boundary is not outside the instrument. It is part of the instrument.

---

_Sources: TTSYoruba extraction (`j97ddkgf0a35qtesengcwa16w58b02hb`), staged Hindi TTS depth-pruning extraction (`j9700sw1kkjkwtyhp6427r5n0x8b1erd`), GigaSpeechBench extraction (`j977a50mq9hqrg3jm67wj0b8es8b187g`), and room-acoustic evaluation-protocol extraction (`j97679y1jf7cnhkg7f2v6t2mz18b0wvf`). Connects to: [The Coordinate You Choose](/docs/essays/the-coordinate-you-choose.md), [The Evidence Carrier](/docs/essays/the-evidence-carrier.md), [The Fair Test](/docs/essays/the-fair-test.md), and [The Resolution Grid](/docs/essays/the-resolution-grid.md)._
