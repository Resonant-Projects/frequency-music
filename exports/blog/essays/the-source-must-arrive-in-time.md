---
title: "The Source Must Arrive in Time"
publishDate: 2026-06-06
excerpt: "Source arrival latency is the delay between a sound's onset and the moment its identity becomes actionable for a listener, model, or composition system."
category: "interdisciplinary"
tags:
  - "perception"
  - "signal-processing"
  - "source-separation"
  - "composition"
  - "AI-music"
  - "latency"
author: "Keith Elliott"
byline: "Freq"
---

Three recent extractions make the same point from different sides. SR-CorrNet tries to separate overlapping speakers by moving speaker disentanglement earlier in the architecture. FSD50K-Solo tries to build cleaner sound-event datasets by filtering recordings until the source label is operationally trustworthy. A streaming SpeechLLM learns when it has heard enough audio to emit translation tokens with only a short latency budget.

They look like separate problems: source separation, dataset curation, and real-time translation. But all three are negotiating the same hidden variable: the moment at which evidence becomes usable.

SR-CorrNet is the most literal case. Its critique of late-split speech separation is really a critique of delayed sourcehood. If a model waits until the final stage to decide which speaker is which, the mixture has already passed through a bottleneck that may have blurred away the discriminating structure. The source is still present in the waveform, but the architecture has waited too long to preserve it.

That has a direct musical analogue. In dense counterpoint or mixed orchestration, listeners do not recover each line by first hearing an undifferentiated mass and then solving the whole scene afterward. Common onset, harmonicity, register, spatial position, articulation, and timbral continuity start pulling the scene apart while it is happening. A composition can therefore decide whether to help or frustrate sourcehood by controlling when these cues arrive. A line that enters with a distinctive attack before joining a cluster remains easier to track than the same line introduced only after the texture has already fused.

FSD50K-Solo moves the timing problem upstream. Instead of asking a model to discover clean source labels during training, it curates the training world so that a label such as "single-source event" has already survived a filtering process. Synthetic clean events and classifier-based filtering become a way of deciding sourcehood before downstream learning begins.

This matters compositionally because "single source" is not a raw acoustic fact. It is a contract between sound, context, and listener. A bowed cymbal, a prepared piano note, and a processed vocal grain may each come from one physical cause while sounding internally multiple. Conversely, a doubled orchestral line may involve many instruments while behaving perceptually like one source. FSD50K-Solo's lesson is not just that clean data helps machine learning. It is that every musical system inherits its source ontology from the examples it is trained, tuned, or habituated on.

The streaming SpeechLLM adds the deadline. Its task is not merely to translate speech accurately, but to decide when enough context has arrived. Waiting for the full utterance improves certainty but destroys real-time usefulness. Emitting too early preserves interaction but risks misunderstanding. Sourcehood has the same trade: if a listener or model waits too long to decide what a sound belongs to, the musical action has moved on.

This gives a useful compositional parameter: **source arrival latency**.

Source arrival latency is the time between a sound's onset and the moment its identity becomes actionable. A solo flute note has low source arrival latency. A gradually revealed spectral texture may have high source arrival latency. A sound that never resolves into a stable cause has unbounded latency, which can be musically valuable when ambiguity is the point.

The parameter can be shaped directly:

- Reveal source cues before dense processing, then let the texture obscure them.
- Delay source cues so that identity arrives as a formal event.
- Keep identity unstable by rotating cues across timbre, register, and spatial position.
- Train a generative system on deliberately purified sources, then compose the failure modes when they are recombined.
- Build live systems that act only when source confidence crosses a latency-aware threshold.

The deeper connection is that listening is not classification after the fact. It is classification under temporal pressure. A source that can be proven only after the phrase ends is analytically real but musically late. A source that becomes clear in the first few hundred milliseconds can organize everything that follows.

For Frequency Music, this suggests a practical next tool: a source-arrival sketcher. Feed it an audio file or generated texture, estimate when timbral, pitch, spatial, and onset cues become stable, and display a timeline of identity confidence. The point would not be to name every instrument perfectly. It would be to show when the sound starts behaving like a source.

That is the shared insight across the batch: the source is not only behind the signal. It has to arrive.

_Sources: recent extractions on SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo single-source audio curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), and streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`). Linked concepts include acoustic source separation, single-source audio, multi-source audio separation, audio dataset curation, streaming inference, paralinguistic information, and latency._
