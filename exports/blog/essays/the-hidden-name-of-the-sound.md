---
title: "The Hidden Name of the Sound"
publishDate: 2026-05-27
excerpt: "Source identity is the hidden variable that shapes both machine learning audio systems and musical composition—a concept that bridges automated curation, source separation, and orchestration through the lens of source legibility."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "composition"
  - "perception"
  - "information-theory"
  - "acoustics"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

Sometimes the most important feature in an audio system is not audible as an event. It is the answer to a quieter question: *whose sound is this?*

The recent extraction batch keeps returning to that hidden variable. FSD50K-Solo treats source identity as a dataset property. SR-CorrNet treats it as a separation problem. An anomalous-sound-detection paper treats it as an evaluation assumption. The infant-cry classifier treats it as a domain shift. In each case, the waveform is not enough by itself. The system must either know, infer, preserve, or deliberately remove the source name behind the signal.

FSD50K-Solo begins from a training-data problem: open sound corpora contain many recordings where several things happen at once. For ordinary listening this is normal. For supervised learning it is poison, because the label says one thing while the waveform contains several. The paper's practical move is to synthesize clean single-class events, then use those controlled mixtures to train a model to filter open corpora for single-source recordings. The source name becomes a purity constraint: a useful example is one where the sound can be assigned to one cause without much residue.

SR-CorrNet starts after purity has failed. Its world is overlapping speakers, noise, and reverberation. Instead of requiring a single-source input, it asks how a mixture can be unfolded back into speaker-discriminative streams. The interesting phrase in the extraction is "correlation-to-filter": spatio-spectro-temporal relationships in the mixture become the material from which recovery filters are estimated. Here source identity is not a label attached before listening. It is something reconstructed from relations inside the sound field.

The anomalous-sound-detection paper exposes the same issue from the opposite direction. Standard benchmarks often assume that the machine identity is known at test time. Remove that assumption, merge recordings from multiple machines, and performance drops in ways that were previously hidden. The model was not only detecting anomaly. It was leaning on an implicit answer to "which machine is this?" That is a useful warning for music information retrieval: many systems may appear to recognize a musical property while actually recognizing the instrument, room, performer, microphone, corpus, or production style that usually carries it.

The infant-cry classifier makes the point biologically. F0 contours, MFCCs, and STFT features help classify short nonstationary signals, but strong domain shifts across infants and datasets remain central. The acoustic class is not independent of the individual source. A cry is both a signal category and a particular body's resonant behavior. That double status is exactly what makes expressive musical performance difficult to reduce to features: pitch contour and timbre are never only abstract measurements. They are also traces of the player, instrument, technique, room, and moment.

The compositional connection is direct. Orchestration is partly the art of controlling source identifiability. A clarinet can be made unmistakable, fused into a wind chord, masked by strings, or made to impersonate an electronic partial. Counterpoint depends on a listener being able to assign notes to continuing lines. Spectral music often exploits the opposite condition, where instrumental causes dissolve into a synthetic timbral body. Studio production goes further: layering, doubling, convolution, re-amping, and granular processing all let a composer tune how confidently a listener can answer "what made that sound?"

This suggests a useful parameter:

**Source legibility**: the degree to which a sound event supports stable attribution to a single perceived cause.

It is not the same as loudness, brightness, or density, though all of those can affect it. A sparse texture can be source-ambiguous if timbres are fused. A dense texture can be source-legible if attacks, registers, spatial positions, and spectral fingerprints remain distinct. Source legibility also has time: an event may begin anonymous, reveal itself by its decay, then disappear back into the mixture.

A practical compositional recipe follows from the four extractions:

1. Choose two or three source classes with recognizable signatures: voice, bowed string, struck metal, air noise, machine hum.
2. Make a short phrase where each source is maximally legible: isolated onsets, clear register, minimal masking.
3. Recompose the phrase through progressive identity removal: overlap attacks, share pitch regions, add reverberation, cross-filter spectra, or exchange envelopes.
4. Reverse the process, but reveal the sources in a different order than they were introduced.
5. Listen for the moment when the perceived cause flips. That flip is the musical event.

The deeper lesson is that source identity is neither purely objective nor purely perceptual. It is negotiated between waveform evidence, environmental context, model assumptions, and listener expectation. Machine learning papers encounter this as data curation, separation, benchmark design, and domain generalization. Composers encounter it as orchestration, masking, fusion, and timbral transformation. The same hidden name is being handled by different disciplines.

For the knowledge graph, this is a bridge worth naming. "Single-source audio," "source separation," "machine identity," and "domain shift" are not isolated technical topics. They are variants of one larger concept: **source attribution under mixture**. That concept belongs equally to audio ML and composition, because every musical texture asks the listener to decide what remains itself when sounds begin to share the same air.

_Sources: FSD50K-Solo extraction on automated single-source sound-event curation; SR-CorrNet extraction on correlation-to-filter speech separation; anomalous sound detection extraction on hidden machine-identity assumptions; infant cry classification extraction on F0/STFT/MFCC feature fusion and cross-domain source variation._
