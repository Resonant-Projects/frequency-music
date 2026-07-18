---
title: "The Decision-Bearing Representation"
publishDate: 2026-06-13
excerpt: "Musical structure lives across multiple representations—notation, body, room, expectation—but only one gets to decide. This essay explores how choosing which representation bears decision-making authority becomes a compositional tool."
category: "composition"
tags:
  - "composition"
  - "signal-processing"
  - "perception"
  - "AI-music"
  - "acoustics"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The Question

Every audio system computes many representations, but only one of them usually gets to decide.

That choice is easy to miss because it hides inside architecture. A waveform becomes a spectrogram. A spectrogram becomes an embedding. An embedding becomes a label, filter, translation, or simulated room. The system looks like a chain of transformations, but the important musical question is more political: which layer is trusted with action?

Several recent extractions make that hidden choice visible.

SR-CorrNet treats spatio-spectro-temporal correlation as decision-bearing. It does not wait until a late bottleneck has compressed the mixture into a nearly inseparable object. It computes correlations from the observed mixture and uses them to estimate filters that recover target speakers. The decisive representation is not the waveform by itself, and not a final speaker label. It is the correlation field that still remembers enough about how sources overlap.

The infant-cry classifier refuses to let a single acoustic feature decide. F0, MFCCs, and STFT features each carry partial evidence, but infant cries are short, nonstationary, and body-dependent. The decision-bearing representation is therefore fused: a negotiated feature space where pitch trajectory, spectral envelope, and time-frequency texture can correct each other's blind spots.

Minimum Bayes Risk decoding makes the same move at the output end. Instead of choosing the locally most probable ASR or speech-translation string, it chooses the hypothesis that minimizes expected loss across a distribution. Here the decision-bearing representation is not the single best path through a decoder. It is the candidate distribution plus a loss function. The system acts from uncertainty, not after pretending uncertainty has vanished.

Text-conditioned room impulse response generation shifts the decision earlier and stranger. A verbal description of a room is used to generate an acoustic transfer function. The decisive representation is not a measured impulse response, but a semantic prompt that stands in for geometry, material, size, and reverberant behavior. Language becomes an acoustic control surface.

## The Musical Version

Composers do this constantly.

Sometimes the decision-bearing representation is notation: the score decides before any sound exists. Sometimes it is the body: a fingering pattern makes one musical path easier than another. Sometimes it is the room: a reverberant space decides that staccato detail will blur and sustained harmony will bloom. Sometimes it is a listener's expectation: a style model decides what counts as resolution before the chord has finished sounding.

The mistake is to assume that musical structure lives in only one place.

A chord chart, a spectral centroid curve, a performer gesture, a resonant body, and a probability distribution can all be representations of the same musical situation. But they do not have equal authority. The one that controls the next action becomes the instrument's real score.

This gives a useful compositional question:

What representation is allowed to move the music?

If a live system follows onset detection, it will write one kind of piece. If it follows source identity, it will write another. If it follows roughness, spatial stability, semantic tags, predicted phrase endings, or expected-loss distributions, each produces a different musical intelligence.

## A Compositional Tool

A decision-bearing representation could become an explicit control in Frequency Music.

Imagine routing the same audio stream through several analyses:

- source-separation confidence
- spectral roughness
- pitch-class stability
- rhythmic entrainment
- room-response estimate
- semantic audio caption
- uncertainty over possible next events

The composer would not merely inspect those layers. They would assign authority. In one passage, roughness drives harmony while source identity is ignored. In another, spatial stability gates the density of the texture. In another, the system waits until the expected loss of responding falls below a threshold, borrowing the MBR idea for musical timing.

The result is not a better classifier. It is a clearer instrument.

Instead of asking "what does the machine hear?", the tool asks "which hearing gets to act?"

## The Claim

Representation is not neutral when it controls behavior.

SR-CorrNet makes correlations act. Feature fusion makes a composite acoustic space act. MBR makes uncertainty act. Text-conditioned RIR generation makes semantic description act. Each system is useful because it chooses the layer where the relevant structure is still available.

For music, that is a practical design principle. Put authority where the musical distinction still exists. Do not ask a late label to recover what an earlier representation has already erased. Do not ask a waveform to carry a decision that belongs to gesture, space, expectation, or probability.

The representation that gets to act becomes part of the composition.

---

_Sources: recent extractions on SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), infant cry acoustic feature fusion (`j9735j1x9c8dxr97dax746vccd86q4tz`), Minimum Bayes Risk decoding for ASR/ST (`j971sbhvck5ya4bstb5r02p11d86pcbq`), and text-conditioned room impulse response generation (`j971jm21g3hsts9fxexgvbsrcd86qnqy`)._
