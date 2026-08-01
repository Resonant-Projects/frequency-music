---
title: "The Separable Sound"
publishDate: 2026-07-26
excerpt: "“Separable sound” links native AI stems, deepfake provenance, and inharmonic perception—showing how audio can become more editable while its identity grows less certain."
category: "interdisciplinary"
tags:
  - "AI-music"
  - "perception"
  - "psychoacoustics"
  - "signal-processing"
  - "composition"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

The newest extraction batch draws an uncomfortable triangle around generated audio.

WanSong claims a diffusion-only route to long-form song generation: up to five minutes, multilingual vocals, and two stems, vocals plus background music, emitted in a single run. The important point is not only that the model generates a complete song. It generates a song that is already organized for downstream action. The mix arrives with handles.

The deepfake survey points at the other side of that power. Detection systems that perform well on familiar generators reportedly fail to generalize to deepfakes from unseen generators. In other words, synthetic media can become operationally legible before it becomes reliably attributable. A system may separate, edit, or extend a signal while another system still cannot say with confidence where the signal came from.

The Vitalic extraction gives the musical version. A single inharmonic tone in "No Fun" can evoke two simultaneous melodic lines. That is not stem separation in the engineering sense, but it is separation in the listener's ear. One acoustic event carries more than one perceived musical object.

Together these sources suggest a useful concept for the knowledge graph: **separable sound**. A separable sound is any sound whose layers can be addressed independently, even when its source identity, authorship, or perceptual unity remains ambiguous.

## Handles Before Identity

Traditional recording practice often treats separation as a recovery problem. There was a singer, a guitar, a room, a noise floor; the mix hid them; source separation tries to recover them.

Generative systems change the order. WanSong's reported dual-stem output means the separation can be native to the generation process. The vocal/background distinction is not reconstructed after the fact. It is part of the artifact's control surface.

That matters compositionally because stems are not just files. They are promises about what can be changed without changing everything else. A vocal stem says: edit the lyric, singer, language, breath, or tuning here. A backing stem says: keep the arrangement, alter the groove, change the orchestration, or make room for another voice there. Whether WanSong's particular implementation fulfills those promises is an empirical question, but the direction is clear: generated music increasingly arrives with pre-separated musical affordances.

The deepfake survey warns that affordance and provenance are not the same thing. A sound may be editable, remixable, and cleanly layered while remaining hard to authenticate against a generator that the detector has never seen. The handle works before the lineage is known.

For musicians, that creates both a tool and an ethical pressure. The more precise the separation, the easier it becomes to alter a voice while preserving enough surface continuity to imply identity. Detection that fails out of distribution means the burden cannot sit entirely on forensic classifiers. Compositional systems need provenance, disclosure, and review paths as part of the instrument, not as paperwork after the export.

## Perceptual Stems

The Vitalic case broadens the idea beyond machine-generated stems. A single inharmonic tone that evokes two melodies is not split into two audio files. It is split into two perceptual trajectories.

That may be the more interesting compositional lesson. A stem is usually thought of as a production object: vocals, drums, bass, guitars, effects. But the ear can make stems of its own. It can hear a partial group as a line, a spectral tilt as a register, a repeated transient as a pulse, or a noisy residue as a room. The separability is not always in the waveform alone. It lives in the relation between waveform, listener, and task.

This suggests a practical synthesis design. Instead of building one oscillator stack that aims at a single pitch, build a tone with two addressable partial groups. One control moves the apparent upper melody. Another moves the apparent lower melody. A third changes how strongly they fuse into one object. The output is still one sound event, but the listener receives something closer to counterpoint.

The same idea applies to generated song. A model that emits vocal and backing stems gives the composer two engineering handles. A model or synthesizer that shapes inharmonic multipitch gives the composer perceptual handles. The deeper category includes both: sound becomes composable when independent action can be taken on layers the listener can follow.

## The Certification Problem

Separable sound also explains why authenticity gets harder.

If a sound has only one obvious address, detection can focus on that address. Is this recording of this speaker real? Is this performance continuous? Does this spectrum contain known synthesis traces?

But once a sound is layered, the question fractures. Which layer is authentic? The vocal identity? The words? The timing? The backing track? The room? The mix? The generator family? The prompt? A song can be human-written and machine-sung, machine-written and human-performed, human-sung and machine-separated, or machine-generated and honestly labeled. Each case has a different ethical and musical meaning.

That is why the deepfake generalization result matters for music. The hard case is not only a fake clip pretending to be real. It is a mixed artifact where some layers are sourced, some inferred, some generated, and some transformed. The detector has to answer a question the artifact itself has made multidimensional.

## A Compositional Test

A useful studio test follows from the three extractions.

Make a short phrase with three versions:

- a conventional mix with no exposed stems;
- a generated or manually prepared version with vocal and backing layers separately editable;
- an inharmonic single-tone version where two melodic paths are implied inside each note.

Then ask two questions.

First: which version gives the composer more meaningful control?

Second: which version gives the listener more confidence about what the sound is?

The answers may diverge. That divergence is the important finding. Modern audio tools can increase separability while decreasing certainty. They can make sound more playable and less self-evident at the same time.

The compositional opportunity is not to retreat from that ambiguity. It is to make the layers audible, name the handles honestly, and treat provenance as part of the score. A separable sound is powerful because it gives us more than one way in. It is risky for the same reason.

---

_Sources: "WanSong v1.0 Technical Report" (`j979h80mbdexf9dgvv0995zyvx8b7ee7`), "Deepfake Media Generation and Detection in the Generative AI Era: A Survey and Outlook" (`j972bs8dwfa48jtdav7xjt2hdn8b7c9y`), and "Methods for pitch analysis in contemporary popular music: Vitalic's use of tones that do not operate on the principle of acoustic resonance" (`j97f45bmgastb8hjpawntc48758b7h9b`)._

_Connections: separable sound, stem-native generation, audio provenance, perceptual stems, inharmonic multipitch, source attribution under mixture, generated-song control surfaces._
