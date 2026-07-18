---
title: "The Identity Clock"
publishDate: 2026-06-05
excerpt: "Identity in sound emerges through time—machines and listeners must accumulate spectral, spatial, and temporal evidence before recognizing a source. This insight transforms composition into an exploration of when and how sounds become identifiable."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "composition"
  - "psychoacoustics"
  - "AI-music"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

The newest successful extractions keep returning to a practical truth about sound: identity is timed.

A sound does not arrive with a stable name already attached. A listener, model, dataset, or instrument has to gather enough evidence to say what the sound is. That evidence can be spectral, spatial, temporal, or contextual, but it is never free. It takes time to accumulate, and the system must decide when the name is reliable enough to act on.

SR-CorrNet treats this as a separation problem. Overlapping voices, reverberation, and noise make speaker identity fragile, so the model moves disentanglement earlier in the architecture. Its correlation-to-filter frame is especially suggestive: spatio-spectro-temporal relations become the evidence from which recovery filters are built. Identity is not just classified after the mixture is processed. It is stabilized into an operation.

FSD50K-Solo moves the same problem upstream into the corpus. A recording is useful only if it counts as single-source enough. The method synthesizes clean events, builds controlled mixtures, and trains a classifier to filter real recordings. Here identity is curatorial time: before a model can learn a sound class, the dataset has to decide which examples are pure enough to teach with.

The anomalous-sound-detection extraction makes the dependency visible by removing a hidden assumption. Standard benchmarks often know which machine is being monitored at test time. When that identity label is withheld, performance drops, and the drop tracks implicit machine-identification accuracy. The anomaly detector was partly an identity detector all along.

Streaming SpeechLLM adds the clock. The system cannot wait for the whole utterance. It learns when enough audio context has arrived to emit translation tokens with tolerable latency. That is not a separate engineering detail from recognition. It is the temporal boundary where evidence becomes action.

For composition, the connection is direct. A musical source can be made to become identifiable gradually. A piece can begin with correlations but no named source: breath noise without voice, bow texture without pitch, room response before instrument, partials that could belong to several causes. Then the music can decide how quickly those clues converge.

This suggests an "identity clock" as a compositional parameter:

- Fast identity: sharp attacks, stable spectra, dry space, clear spatial placement.
- Slow identity: reverberation, masking, shared onsets, ambiguous partials, delayed pitch centers.
- Broken identity: cues that point to different sources at different times.
- Curated identity: material selected because it teaches one source cleanly before being recombined.

The important shift is that identity becomes dynamic rather than categorical. Instead of asking "what is this sound?", the composer can ask "how long does it take before this sound can be treated as one thing?"

That question links dataset curation, source separation, anomaly detection, and live translation because all four systems need a rule for when evidence is sufficient. Music can make that rule audible. It can stretch the moment before identification, compress it into an attack, or let several possible identities compete until one becomes operationally useful.

The result is not just ambiguity for its own sake. It is a way to compose with the listener's evidence-gathering process. The source is not merely hidden or revealed. It is timed.

_Sources: recent extractions on SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo single-source dataset curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), anomalous sound detection without known machine identity (`j9741717c5306g0134yg8tgtb986qgdn`), and streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`)._
