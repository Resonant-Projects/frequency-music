---
title: "The Audible Proof"
publishDate: 2026-06-17
excerpt: "Proof length becomes a musical control surface: some sonic structures are true in the signal but too expensive to prove inside the listener's time window."
category: "interdisciplinary"
tags:
  - "mathematical-music-theory"
  - "signal-processing"
  - "composition"
  - "perception"
  - "information-theory"
  - "AI-music"
author: "Keith Elliott"
byline: "Freq"
---

Proof complexity asks a disarmingly practical question: not only whether a statement is true, but how long a proof must be before anyone can use it.

That distinction opens a useful door for listening. In music and audio systems, the problem is rarely pure truth. A source may be present in a mixture. A key center may be implied. A machine may be anomalous. A translation token may be the right next word. But each claim needs evidence before it can act, and the evidence has a length: milliseconds of audio, bars of harmony, spectral frames, repeated attacks, spatial correlations, or enough negative search to treat certainty as unreachable.

The recent extractions make this feel less like metaphor and more like an engineering variable.

SR-CorrNet treats overlapping speech as a recovery problem whose proof is spatio-spectro-temporal. A source is not established by a late label. It becomes actionable when the mixture contains enough correlated structure to estimate a filter. The audible proof of the speaker is the pattern that can separate the speaker.

FSD50K-Solo moves the same issue into the dataset. A recording must prove that it is single-source enough to train on. The method synthesizes clean single-class events, builds controlled mixtures, then filters open recordings with an encoder and classifier. The proof here is curatorial: not "this file has a label," but "this file survives a procedure that makes the label operational."

Streaming SpeechLLM makes proof length temporal. The model cannot wait for the whole utterance, so it learns when the partial audio stream has become enough evidence to emit translation tokens. A wrong token is a failed proof made too early. Excess latency is a proof made too long.

The proof-complexity extraction supplies the abstract frame. Some statements may be provable in principle but only by proofs too long to write down. In practice, such a proof behaves like no available proof. This is not ignorance in the ordinary sense. It is a boundary where truth fails to become usable because its demonstration exceeds the working scale of the system.

Music has this boundary everywhere.

A tonal center can be formally latent before it is perceptually proved. A pulse can be implied before the body trusts it. An instrumental identity can flicker between bow noise, breath, room, and source before enough evidence collapses it into a name. A dense microtonal sonority can contain ratio logic that no listener can reconstruct in time, which means the compositional question is not whether the structure exists, but whether its proof is audible at the scale of listening.

That suggests a concrete compositional control: **proof length**.

Write one layer whose identity is proved immediately by attack and register. Write another whose identity requires accumulated correlation across several entrances. Let the harmony contain a true but practically unprovable relation, present in the score but too distributed for ordinary hearing. Let the room function as a theorem prover: dry sound proves source quickly, reverberant sound lengthens the proof, and moving reflections can keep a source true but operationally unavailable.

For machine-listening tools, proof length should be exposed rather than hidden. A source separator could report how many frames were needed before a stream became stable. A transcription system could distinguish "detected now" from "provable after two beats." A dataset curator could store not only a single-source decision but the amount and kind of evidence that made the decision durable.

The compositional payoff is subtle but powerful: a piece can modulate not only pitch, rhythm, timbre, and space, but the epistemic cost of hearing. Some events arrive with short proofs. Some demand a longer argument. Some are structurally real but never quite become usable before the music moves on.

That is the musical analogue of effective unprovability:

**A structure can exist in the sound while remaining too expensive to prove inside the listener's time window.**

The composer does not have to choose between clarity and obscurity. She can compose the length of the proof.

_Sources: recent extractions on effective unprovability and zero-knowledge proofs (`j97651ph1ys6ctg5xdr9b7nr0986rcwp`), SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo single-source audio curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`), anomalous sound detection without known machine identity (`j9741717c5306g0134yg8tgtb986qgdn`), and infant cry feature-fusion classification (`j9735j1x9c8dxr97dax746vccd86q4tz`)._
