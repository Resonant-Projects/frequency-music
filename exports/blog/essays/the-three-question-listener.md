---
title: "The Three-Question Listener"
publishDate: 2026-07-15
excerpt: "When sounds overlap, listeners ask three questions: who is present, what are they doing, and when? Keeping those dimensions separate makes machine listening more musically useful."
category: "interdisciplinary"
tags:
  - "perception"
  - "composition"
  - "signal-processing"
  - "AI-music"
  - "psychoacoustics"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

Recent speech-audio extractions keep circling the same problem from different sides: when several sounds arrive together, a useful listener has to answer three questions at once.

Who is present?

What are they doing?

When does each event happen?

That sounds like a diarization problem, but it is also a compositional problem. A string quartet, a choir, a podcast roundtable, a field recording, and a dense electronic texture all ask the same structural question: how does a listener keep identity, event, and time from collapsing into one undifferentiated surface?

TagSpeech states the problem directly. Its temporal-anchor grounding is designed to align spoken content, speaker identity, and fine-grained timestamps, explicitly modeling "who spoke what and when." The interesting move is not only that it separates semantic and speaker streams, but that timing becomes the synchronization signal between them. Time is not just metadata attached after recognition. Time is the hinge that lets identity and content stay coordinated.

MUGEN exposes the same hinge by failure. Its benchmark for multi-audio understanding reports that large audio-language models degrade sharply as the number of concurrent inputs increases, across speech, general audio, and music. If that result holds beyond the abstract, then the bottleneck is not merely "audio is hard." The harder claim is that present systems do not yet have a stable way to preserve multiple auditory objects through time while also reasoning about them.

DSEF-PNet adds another axis. Personalized speech enhancement needs an enrollment utterance to identify a target speaker, but the enrollment carries more than identity: emotional tone, linguistic content, duration, recording condition. The proposed consistency constraint, pairing a mixture with two different enrollments, tries to isolate speaker identity from the variables that should not define the target. This is a useful analogy for musical listening. A singer is not only a source label. Their identity is braided with register, vowel, affect, vibrato, microphone, room, and phrase. Some of those are stable enough to track; others are expressive changes the model should preserve rather than erase.

The speech world model paper frames the broader design language: a modular causal graph over latent speech states and actions. Its relevance to music is still speculative, but the concept is attractive. Musical analysis often needs counterfactual listening: if the same entrance happened one beat later, if the viola doubled the cello, if the singer changed vowel but not pitch, if the noise floor rose, what would still be perceived as the same event? A graph of states and actions gives that question somewhere to live.

The connection across these sources is a three-part listener:

1. Identity tracking: preserve stable source information without mistaking expressive variation for a new source.
2. Event tracking: describe what each source is doing without reducing sound to transcript-like content.
3. Temporal anchoring: keep overlapping objects aligned to a shared time base so identity and event can be recombined.

For composition tools, this suggests a concrete design target. Instead of asking an audio model for one caption, one transcription, or one global embedding, ask it for a layered event ledger:

```text
time span -> source identity -> action/event -> confidence -> competing interpretations
```

In music, the "source identity" might be singer, instrument, register, spectral region, or synthetic layer. The "action" might be onset, held tone, vowel shift, bow change, filter sweep, rhythmic cell, or harmonic function. The point is not to force all music into speech categories. The point is to borrow the discipline of keeping who, what, and when separable until the composer chooses to fuse them.

This also gives a testable research direction. Take a short polyphonic vocal or chamber excerpt and annotate it with overlapping temporal anchors: entrances, exits, sustained regions, identity ambiguities, and event labels. Then compare model outputs under three conditions: single mixed audio, separated stems, and permuted multi-audio candidates. If performance changes strongly with input ordering or stem grouping, that is not just an engineering nuisance. It reveals where the model's auditory object permanence breaks.

The compositional payoff is subtle but real. A tool that can maintain this three-question structure could let a composer search for "moments where the alto keeps identity while vowel color changes," "places where two sources share rhythm but not timbre," or "overlaps where a model cannot decide whether one object split into two." Those are not just MIR tasks. They are ways to compose with the boundary between stream and texture.

The emerging lesson is that machine listening becomes musically useful when it stops pretending the sound field is a single answer. Overlap is not a defect to remove. It is where identity, action, and time negotiate.
