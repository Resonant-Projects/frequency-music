---
title: "The Promptable Room"
publishDate: 2026-06-18
excerpt: "Generative models can now create room impulse responses from natural-language descriptions, transforming acoustic space from a measured artifact into a compositional parameter that lives between physics and fiction."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "composition"
  - "AI-music"
  - "acoustics"
  - "perception"
author: "Keith Elliott"
byline: "Freq"
---

The newest useful extraction has a quiet but important shift in it: a room impulse response is no longer only something measured after the fact. It can become something requested.

The text-to-audio RIR paper adapts a generative audio prior to produce plausible room impulse responses from natural-language acoustic descriptions. Because paired text-RIR data is scarce, the authors use vision-language models to label image-RIR datasets, then fine-tune the audio model so free-form descriptions can steer the response. The result is not just "better reverb." It is a new interface to acoustic causality: describe a space, receive a transfer function.

That connects back to the recent sourcehood cluster in a useful way. SR-CorrNet treats mixed speech as a correlation-to-filter problem: enough spatio-spectro-temporal structure lets the system estimate filters that recover voices. FSD50K-Solo treats single-source identity as something a dataset must earn through synthesis, filtering, and curation. Streaming SpeechLLM treats linguistic output as something that can happen only when enough context has arrived. The RIR extraction adds a fourth layer: the environment itself can be inferred, generated, and auditioned as a manipulable object.

Compositionally, this suggests a distinction between two kinds of space:

- **Measured space:** the room has already answered, and the composer captures its answer as an impulse response.
- **Prompted space:** the composer specifies a desired acoustic behavior, and a model proposes a plausible room response.

The first is documentary. The second is speculative. Both are musically useful, but they invite different kinds of form.

Measured space says: "This source happened here." Prompted space says: "What would this source become if the environment had these properties?" That turns reverb from an effect into a conditional statement. A dry gesture can be passed through a sequence of increasingly impossible but perceptually plausible rooms: narrow tiled stairwell, soft crowded archive, glass atrium with asymmetric early reflections, small wooden chamber with a too-long low-frequency tail. The melody is not varied by changing its notes. It is varied by changing the acoustic world that proves it.

The caution is important: a generated RIR is not the same as a physically measured room. The extraction reports perceptual plausibility, not guaranteed physical truth. But for composition, that limitation is also the point. A promptable room lives between physics and fiction. It is constrained enough to sound like space, but loose enough to become orchestration.

This gives Frequency a practical experiment:

1. Start with one dry, source-legible gesture.
2. Render it through one measured RIR and several prompted or hand-designed RIR-like transfer functions.
3. Keep the notes, timing, and source constant.
4. Listen for when the room becomes the primary musical actor.

If the identity of the gesture survives, the room is coloration. If the gesture becomes inseparable from the generated decay, the room has become form. The compelling idea is that acoustic space can now be composed at the level of language, transfer function, and perception at once.

_Sources: text-conditioned room impulse response generation (`j971jm21g3hsts9fxexgvbsrcd86qnqy`), SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo single-source curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), and streaming SpeechLLM latency-bound context (`j976ynszeyaxehsqvje6nx8mms86s4wx`)._
