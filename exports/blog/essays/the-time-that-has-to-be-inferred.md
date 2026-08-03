---
title: "The Time That Has to Be Inferred"
publishDate: 2026-08-03
excerpt: "Written time is not performed time: score, gesture, acoustics, and perception negotiate multiple clocks. This essay proposes “temporal evidentiality” as a new axis for composition and AI music."
category: "interdisciplinary"
tags:
  - "AI-music"
  - "perception"
  - "acoustics"
  - "signal-processing"
  - "composition"
  - "rhythm"
author: "Keith Elliott"
byline: "Freq"
---

The newest extraction cluster keeps returning to a practical fact that musicians know in their hands before they know it in words: written time is not performed time.

Four sources make the point from different sides. VocalRender starts from the score and tries to synthesize singing directly from lyrics, pitch, symbolic note values, and tempo. SKY-Piano records the performer as a multimodal event: audio, MIDI, MusicXML, video, hand motion, body motion, occluded markers, and imputed movement. The expressive-MIDI evaluation paper argues that timing, velocity, and duration statistics miss dependencies among notes, so contextual symbolic embeddings can function as better perceptual proxies. The live-source-separation work adds the room and audience back into the problem: a studio-trained separator fails when venue acoustics, loudspeakers, and crowd noise alter what timing and source identity even mean.

Put together, these papers describe a stack of temporal translations:

1. The score names a temporal intention.
2. The performer turns that intention into gesture.
3. The instrument and room smear, reinforce, delay, and color the gesture.
4. The listener or model infers the event from the surviving evidence.

That stack matters because each layer has its own clock. A score-native singing system can accept note values and tempo, but the sung output still needs to decide how syllables occupy time, how melismas stretch, how consonants steal duration from vowels, and how vibrato bends a nominal pitch into a moving acoustic trace. If the model predicts output length during synthesis, it is not merely filling a container supplied by notation. It is estimating how symbolic time becomes embodied time.

SKY-Piano makes the embodiment explicit. The piano note is not just an onset in MIDI. It is prepared by a hand trajectory, constrained by fingering, shaped by arm weight, affected by body posture, and sometimes hidden by marker occlusion. The flagged-versus-imputed motion data is conceptually beautiful here: performance time contains gaps, and the system must decide whether those gaps are unknown, unreliable, or reconstructable. That is not so different from a listener hearing a blurred run and inferring the gesture that produced it.

The expressive-MIDI evaluation paper pushes the same idea into metrics. If timing, velocity, and duration are measured note by note, the evaluation sees local facts but misses phrasing relations. A late note can be expressive in one context and clumsy in another. A shortened duration can clarify articulation or break a line. Contextual embeddings and kernel distances are attempts to evaluate the temporal field rather than isolated timestamps. The musical unit is no longer the note; it is the dependency pattern that makes the note meaningful.

Then the live-separation paper changes the scene again. In a concert recording, the room is not an aftereffect pasted onto a clean performance. Venue impulse responses, loudspeaker response, and audience sound are part of the evidence from which the performance must be recovered. A separator trained only on studio stems has learned the wrong temporal world. It expects sources to arrive too cleanly, without the delayed copies, crowd masking, and spatial smearing that define live music.

The connection across these sources is this: timing is not a scalar property. It is a negotiated relationship among notation, bodily motion, acoustic propagation, and perceptual inference.

For composition, this suggests a useful tool design principle. Instead of treating timing controls as a single lane of note onsets and durations, a composer-facing system could expose several temporal layers at once:

- **Score time:** symbolic note values, tempo, meter, and lyric-to-note mapping.
- **Gesture time:** preparation, attack trajectory, fingering, breath, posture, and motion continuity.
- **Acoustic time:** room impulse, loudspeaker response, reverberant decay, masking, and crowd noise.
- **Inference time:** what a listener or model can recover, align, separate, or recognize.

A phrase could then be composed as a controlled disagreement among clocks. Make the score strict but the gesture anticipatory. Keep the MIDI quantized but move the room late. Preserve the pitch contour while letting the syllabic timing breathe. Put a clean synthetic singer inside a venue model that makes consonants harder to locate. Ask a performance metric whether the phrase still reads as intentional.

The deeper research question is not "what is the correct duration?" It is "which temporal evidence should be allowed to decide?"

That question cuts across synthesis, performance capture, evaluation, and separation. VocalRender asks the model to infer performed time from score-native controls. SKY-Piano captures the bodily evidence around that inference. Contextual MIDI metrics ask whether a performance is judged by isolated events or relational timing. Live-source-separation datasets remind us that the room and audience can change the answer.

This is a promising compositional axis: not tempo, not rubato, not swing in isolation, but **temporal evidentiality**. How much does the score decide? How much does the body decide? How much does the room decide? How much does the listener have to reconstruct?

_Sources: recent extractions on VocalRender score-native singing synthesis (`j97dm8xcgqdtatym0jcv7dpcj58bpewj`), SKY-Piano multimodal piano performance data (`j974ydebhk9tdycdrawedqdc7s8bsvfv`), contextual embedding metrics for expressive MIDI piano performance (`j97160n8t35ezge1qgej8m5yqx8bpz9k`), and live-music source separation with CrowdioSet/PaRIRset (`j97f8ssp84ay50b70fct66gdwx8bpafp`). Connections to: score-native generation, gesture time, expressive timing, contextual evaluation, venue acoustics, source separation, and temporal evidentiality._
