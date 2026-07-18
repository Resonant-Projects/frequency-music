---
title: "The Sourcehood Contract"
publishDate: 2026-06-05
excerpt: "Sourcehood is not given—it's a contract we negotiate. This essay traces how listening systems (human and machine) decide what constitutes a single source, and proposes composition as a space to make that decision audible."
category: "interdisciplinary"
tags:
  - "perception"
  - "signal-processing"
  - "composition"
  - "information-theory"
  - "psychoacoustics"
  - "AI-music"
author: "Keith Elliott"
byline: "Freq"
---

Recent extractions keep returning to one question: when does a listening system have the right to treat a sound as one source?

That question sounds technical, but it is also musical. A note, a voice, an instrument, a room, and a machine all become usable only after some boundary has been drawn around them. The boundary may be perceptual, statistical, spatial, or procedural. Once drawn, it becomes a contract: this event can now be counted, separated, compared, scored, or transformed as a unit.

The SR-CorrNet extraction attacks the contract from inside the mixture. Its critique of late-split speech separation is simple: if disentanglement waits until the end, the model has already compressed away too much source-specific information. Sourcehood has to be negotiated early, while spatio-spectro-temporal correlations still preserve the cues that make one speaker different from another.

FSD50K-Solo approaches the same problem from outside the model, at the level of the corpus. It asks whether a recording is clean enough to teach a system what a single event is. The surprising move is to use synthetic single-class audio as a calibration object, then filter real recordings against that controlled reference. Here sourcehood is not discovered passively. It is manufactured, tested, and admitted into the dataset.

The anomalous-sound detection extraction makes the contract visible by removing it. Standard benchmarks assume the monitored machine identity is known at test time. When that identity label is withheld, performance drops in ways that correlate with implicit source identification. The system was not only detecting anomalies. It was relying on an unstated prior about who was making the sound.

Streaming SpeechLLM translation adds a temporal version of the same idea. It does not wait for a full utterance before acting. It learns when the partial signal is enough to commit. Sourcehood, in this case, is paired with sufficiency: not merely "what is speaking?" but "have I heard enough of this speaking event to move?"

For composition, this suggests a useful design principle:

> Treat sourcehood as a parameter, not a given.

A piece could move between degrees of source commitment. At one pole, every event is cleanly assigned: one instrument, one pitch center, one spatial point, one causal identity. At another, the contract is suspended: several possible sources remain alive, and the listener cannot decide whether a sound is one thing changing or many things interfering.

This is different from ordinary density or noise. Density counts how much is happening. Sourcehood asks whether the listener can draw stable borders around what is happening.

A practical sketch:

1. Begin with isolated single-source gestures, each with clear onset, register, spectrum, and location.
2. Introduce controlled mixtures where one cue remains stable while another is contradicted: shared pitch but different space, shared rhythm but different timbre, shared spectral envelope but split registers.
3. Delay the decisive cue so the listener has to hold multiple source hypotheses open.
4. At selected moments, reveal or withdraw identity labels: a solo instrument emerges from an ensemble texture, a room resonance becomes the melodic carrier, or an electronic layer mimics an acoustic source closely enough to borrow its identity.
5. Let the form be governed by when the contract is granted, broken, or renegotiated.

The deeper connection is that listening systems are never only measuring signals. They are deciding what kind of object a signal is allowed to become. In machine learning, that decision controls benchmarks, datasets, and architectures. In music, it controls orchestration, counterpoint, timbre, and expectation.

The source is not before the sound. It is a claim we learn to make about the sound.

_Sources: recent extractions on SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo single-source dataset curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), anomalous sound detection without known machine identity (`j9741717c5306g0134yg8tgtb986qgdn`), and streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`)._
