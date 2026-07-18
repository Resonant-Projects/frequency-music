---
title: "The Trace Before Report"
publishDate: 2026-07-09
excerpt: "Sound shapes listening before it can be named. This essay explores how acoustic traces operate below conscious report, with implications for music composition and audio system design."
category: "perception"
tags:
  - "perception"
  - "signal-processing"
  - "composition"
  - "psychoacoustics"
  - "AI-music"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

Most audio systems are judged by what they can report.

A recognizer reports words. A separator reports stems. A curation model reports whether a clip is single-source. A streaming translator reports tokens once enough context has arrived. A room model reports a plausible impulse response. These reports matter, but they also hide an earlier layer: the acoustic trace that changes the system before it can name what happened.

The anesthesia source is only a teaser, so it has to be handled carefully. It suggests, without enough detail for strong claims, that the brain may still process or learn from the outside world under anesthesia. If that is true in the auditory case, the important point is not that unconscious listeners "understand music" in any ordinary sense. The grounded hypothesis is narrower: sound can leave a trace below the threshold of conscious report.

That same threshold appears in the machine-listening sources, though under different names.

The ASR evaluation paper warns that word error rate can correlate with human recognition while missing acoustically important damage. A robust recognizer may report the right words because its language model and noise training let it work around the signal. The report survives, but the acoustic trace has been partly discarded. For music, that distinction is crucial. A compressor, enhancer, or restoration tool can preserve what is reportable while injuring what is felt as surface, breath, distance, or weight.

Streaming SpeechLLM makes the threshold temporal. The model must decide when enough audio context has arrived to emit translation tokens. Before report, the incoming speech is not nothing. It is accumulating evidence: prosodic slope, phonetic onset, timing, maybe speaker state. The report is a late event in a longer process of trace formation.

SR-CorrNet makes the threshold spatial and spectral. It does not wait until the final layer to decide who is speaking. It uses spatio-spectro-temporal correlations as evidence for deep filters that recover targets. Here the trace is not a verbal output but a pattern of relation: which partials, envelopes, delays, and channels move together strongly enough to become source-bearing.

The RIR generation paper adds the room. A room impulse response is almost pure trace. It is not the source event; it is the acoustic memory left by a space after excitation. Text-conditioned RIR generation is interesting compositionally because it tries to synthesize that memory directly: "stone cathedral," "small office," "long decay" become prompts for how a sound should keep touching the listener after the cause is gone.

Taken together, these sources suggest a useful distinction:

**Reportable audibility** is the point at which a listener or model can name, transcribe, classify, separate, or translate a sound.

**Trace audibility** is the point at which sound has begun to shape the listening state, even if no stable report is available yet.

The distinction is not mystical. In signal-processing terms, trace audibility can mean energy entering a filterbank, correlation building across channels, reverberant decay establishing room size, or partial evidence changing a decoder's posterior distribution. In musical terms, it is the moment before naming: the pressure before a downbeat, the spectral color before a pitch, the room before the instrument, the affective contour before the lyric becomes intelligible.

This gives composers a precise exercise. Build a phrase in three layers:

1. A trace layer that is not meant to be consciously identified: low-level room tone, barely periodic modulation, pre-echo, breath, bow noise, or masked harmonic residue.
2. A threshold layer that lets the trace become almost reportable: repeated timing, shared envelope, spatial consistency, or spectral alignment.
3. A report layer that finally gives the listener something nameable: pitch, word, source, cadence, or gesture.

Then remove the report layer and ask what remains. If the piece still has direction, the trace layer is carrying form. If it collapses, the piece was only using trace as atmosphere.

This also suggests a test for audio tools. Do not ask only whether a model preserves the report. Ask what trace it preserves before report becomes possible. Does enhancement keep the room's early reflections? Does separation keep the fused pressure that made the ensemble feel like one body? Does a streaming model retain prosodic tension before translation? Does a generated RIR give the sound a believable acoustic past?

The compositional payoff is strong because music often lives below reportability. A listener may not be able to say why a transition feels prepared, why a room feels large, why a voice feels near, or why a texture is about to split. But the system has already been changed.

The trace arrived first.

_Sources: recent extractions on unconscious auditory processing under anesthesia (`j974gtwmrad9zxbdz7787858m586pwp7`), ASR-based speech enhancement evaluation (`j976gffwnjtmt3yh046sbsq1kx86nmmd`), streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`), SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), and text-conditioned RIR generation (`j971jm21g3hsts9fxexgvbsrcd86qnqy`)._
