---
title: "The Pitch Field"
publishDate: 2026-08-11
excerpt: "Pitch is not a fixed location but a field of constraints: adjacency, contour, detuning, and partials shape whether tones become melody, speech, texture, or polyphony."
category: "interdisciplinary"
tags:
  - "perception"
  - "psychoacoustics"
  - "acoustics"
  - "composition"
  - "tuning-systems"
author: "Keith Elliott"
byline: "Freq"
---

Pitch is often taught as a location. A note sits somewhere on a staff, a frequency scale, a piano roll, or a tuner display. But the recent extraction set keeps suggesting a better image: pitch is a field of constraints. What matters is not only where a tone lands, but what neighboring motions, fusions, spellings, and partials are made available around it.

The global-scale extraction states this most plainly. Across 1,314 scales from 96 countries, the authors report a near-universal preference for scale steps of 1-3 semitones. Harmonic intervals still matter, especially in music-theoretic scale systems, but the stronger claim is melodic: scale structure is shaped by what can be sung, remembered, perceived, and moved through. A scale is not just a set of allowed points. It is a contour machine. It defines which next steps feel locally reachable.

That turns the old pitch-space picture inside out. Instead of starting with octave, fifth, fourth, and then filling the gaps, this evidence suggests beginning with adjacency. The scale is a field where small motions are cheap, large leaps are special, and harmonic landmarks exert weaker or more style-dependent gravity. For composition, the important control is not only interval inventory. It is the local cost of motion.

The Yoruba speech-synthesis extraction sharpens this idea because lexical tone makes pitch relational at the level of language. TTSYoruba does not merely assign one pitch height to one syllable. It uses a recorded inventory of 651 diphone units, five tonal variants for consonant-vowel combinations, and phonological rules that can derive contextual rising and falling contours from level-tone input. Orthography, phonology, and acoustics form one conversion surface.

This is pitch as grammar. A marked vowel does not fully determine the sound by itself; its contour depends on local context, nasal categories, syllable type, and rule selection. The pitch field here is not a Western scale, but the principle rhymes: pitch identity emerges from constraints on movement. A tone is a permitted trajectory through a linguistic-musical space.

The supersaw extraction moves the same question into synthesis. A. G. Cook's Super*Saw stacks and detunes sawtooth oscillators until chord identity can blur into a dense, percussive mass. A chord built from stable notes becomes less chord-like as its internal pitch field thickens. Detune amount, voice count, modulation, register, envelope, and stereo spread can make the same nominal harmony behave either as harmonic information or as a fused timbral object.

That is a beautiful inversion. In the scale case, discrete pitch steps organize motion. In the supersaw case, too many near-neighbor pitch traces can dissolve discreteness. The field becomes so dense that the listener stops following individual locations and starts hearing pressure, width, brightness, and impact. Pitch has not disappeared. It has become texture.

The harmonic-complex-tone extraction adds a third state between point and cloud. Producers in a studio-lab setting reportedly used monophonic bass-like harmonic complex tones to convey two or more perceived pitches at once. One waveform could imply simultaneous melodic lines because upper partials became pitch-bearing enough to be heard or used compositionally. Here the pitch field is vertical: a single tone contains internal routes that can be followed as multiple voices.

Together these sources sketch four pitch-field regimes:

1. **Adjacency field:** scale steps make some melodic moves cheaper than others.
2. **Contour field:** lexical tone and phonological rules turn pitch into contextual trajectory.
3. **Density field:** detuned unison layers blur pitch locations into timbral mass.
4. **Partial field:** harmonic complexes let one source imply multiple pitch paths.

This matters for instrument design because many music tools still expose pitch as either note number or frequency. That is too thin. A more musician-facing control could expose the field around the pitch:

- local motion cost, from stepwise to leap-prone;
- contour rule strength, from fixed height to context-derived motion;
- unison density, from readable chord to fused pressure;
- partial audibility, from single residue pitch to multiple internal pitch lines.

Such controls would not replace notes. They would explain why the same note behaves differently in a melody, a tonal language, a supersaw stack, and a harmonic bass tone. The pitch is the visible coordinate. The field is the musical affordance.

Compositionally, this suggests a useful exercise: write a short phrase whose nominal pitch sequence stays almost unchanged while the pitch field changes underneath it. First, make the phrase stepwise and scalar. Then render it as contextual tone contours. Then thicken it with detuned unison until harmony turns into impact. Finally, resynthesize selected notes as harmonic complexes whose upper partials imply counterlines.

The listener may hear "the same notes" becoming speech, cloud, and polyphony without the surface melody needing to change much. That is the point. Pitch is not only the thing being placed. It is the set of relations that placement activates.

_Sources: global scale-structure extraction (`j974tgk5gh6tc1deh6bse6vzg98avknh`), Yoruba situational speech-synthesizer extraction (`j97ddkgf0a35qtesengcwa16w58b02hb`), A. G. Cook Super*Saw extraction (`j97c0c18c59gs2hkhr70xgnyys8aq40b`), and harmonic-complex-tone generative music extraction (`j977947yy1vh3x3jhxef6heb218akdxv`). Connections: pitch field, melodic constraint, lexical tone contour, detune density, harmonic-complex multipitch, compositional affordance._
