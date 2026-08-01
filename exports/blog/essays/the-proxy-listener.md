---
title: "The Proxy Listener"
publishDate: 2026-07-09
excerpt: "Every audio system listens through a surrogate—an ASR model, classifier, or decoder whose behavior stands in for human judgment."
category: "interdisciplinary"
tags:
  - "perception"
  - "signal-processing"
  - "AI-music"
  - "information-theory"
  - "composition"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

Some audio systems do not listen directly for the thing we care about. They listen through a surrogate.

That surrogate may be useful. It may be an ASR model whose word error rate stands in for human intelligibility. It may be a classifier that decides whether a sound event is single-source enough to train on. It may be an MBR decoder that chooses the transcript with lowest expected downstream loss rather than the most likely beam. It may be a streaming translation model that decides, second by second, whether enough audio has arrived to say something.

The shared concept is the **proxy listener**: an evaluator, decoder, or model whose behavior stands in for a listener's judgment.

The recent extractions make the pattern sharp. The speech enhancement evaluation paper warns that modern ASR models can correlate with human word error rates while still being misleading for acoustics-focused evaluation. A robust recognizer may ignore distortions that a human producer, musician, or engineer would consider important. In other words, the proxy succeeds at the linguistic task by becoming selectively deaf to the acoustic surface.

FSD50K-Solo uses a different proxy. Its goal is not recognition but curation: identify single-source sound events inside a noisy open corpus. A generative diffusion model creates clean single-class examples, then an encoder and classifier help filter multi-source recordings. The proxy listener here asks a musical question in technical clothing: is this sound one thing or many? That question matters for datasets, but it also matters for orchestration. A violin section, a distorted guitar chord, and a convolved field recording can each sit near the boundary where a listener stops hearing one source and starts hearing a texture.

SR-CorrNet approaches the same boundary from the opposite side. It treats mixed speech as spatio-spectro-temporal correlations that can be converted into filters. The system is not merely recognizing labels after the fact; it is deciding which correlations are source-bearing enough to reconstruct. That is a proxy listener with hands. It hears a mixture and turns its judgment into separation.

MBR decoding adds a third version. Instead of choosing the single most probable output, it chooses the output with the lowest expected loss under a distribution of possibilities. This is proxy listening as risk management. The system asks: among plausible hearings, which answer is least costly to commit to? That question is close to how musicians improvise under ambiguity. A player does not always choose the most likely next note; they choose a note that will still make sense if the harmony turns out to have been slightly different.

Streaming SpeechLLM makes the temporal dimension explicit. It learns not only what to translate, but when enough context has arrived. The proxy listener has an evidence window. Answer too early and the translation may be wrong; wait too long and the interaction fails. For music, this maps cleanly onto entrance, resolution, and recognition. A motif can be stated before its identity is fully disambiguated. A cadence can be delayed until the listener's predictive model is ready. Timing is not decoration around meaning; timing helps decide what the meaning can be.

The compositional warning is simple: every proxy listener has an invariance set. It ignores some differences so it can solve its task. That is power and danger at once.

If the proxy is an ASR model, it may ignore spectral damage as long as words survive. If it is a single-source classifier, it may flatten rich ensemble textures into "too mixed." If it is a separation model, it may treat musically intentional fusion as an error to undo. If it is an MBR decoder, it may prefer the safe answer over the strange one. If it is a streaming model, it may reward phrases that reveal themselves quickly.

For a composer, this suggests a practical tool: score for the proxy listener and against it.

One exercise would be to build a phrase that remains intelligible to ASR while becoming increasingly unacceptable as music production: clipping, comb filtering, granular smearing, phase instability. The words survive; the sound dies. That reveals the gap between linguistic sufficiency and acoustic care.

A second exercise would reverse the test: build a texture that sounds like a coherent musical object to a human listener while a single-source classifier insists it is multi-source. Or build a texture that a separation model wants to split apart even though its musical force depends on fusion. The output artifacts would not be failures; they would expose where machine source identity diverges from musical source identity.

A third exercise would use MBR-like thinking in improvisation. Given several possible harmonic readings, choose not the most probable note but the note with lowest regret across all readings. This is not blandness by default. Sometimes the lowest-regret note is a common tone; sometimes it is a tension that keeps multiple futures alive.

The broader principle is that proxy listening turns evaluation into composition. A metric is never neutral. It teaches the system what differences matter, what differences can be thrown away, and when evidence is sufficient to act. Those same choices are musical choices. They determine whether a sound is heard as language, texture, source, room, gesture, or noise.

So the useful question is not only "does the proxy match human listening?" It is more precise:

What kind of listener has this proxy become?

And once we know that, what can we make it hear?

_Sources: recent extractions on ASR-based speech enhancement evaluation (`j976gffwnjtmt3yh046sbsq1kx86nmmd`), FSD50K-Solo single-source curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), MBR decoding for speech-to-text (`j971sbhvck5ya4bstb5r02p11d86pcbq`), and streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`)._
