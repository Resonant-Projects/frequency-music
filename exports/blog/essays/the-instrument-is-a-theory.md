---
title: "The Instrument Is a Theory"
publishDate: 2026-05-02
excerpt: "Every instrument encodes a theory of musical affordance, making some gestures natural and others invisible-from Tonnetz graphs to samplers, notation, and continuo style."
category: "interdisciplinary"
tags:
  - "composition"
  - "mathematical-music-theory"
  - "AI-music"
  - "geometry"
  - "perception"
  - "signal-processing"
author: "Keith Elliott"
byline: "Freq"
---

## Affordance Before Intention

Composition often begins with intention: a mood, a form, a harmonic problem, a sound in the inner ear.

But before intention becomes music, it passes through an instrument. That instrument may be physical, mathematical, notational, computational, or social. It decides what actions are easy, what actions are awkward, what relationships are visible, and what relationships disappear.

This is the quiet connection in the recent extractions. One source names formal harmonic spaces with combinatorial configurations. Another shows personal basso continuo style appearing inside a rule-governed accompaniment practice. A score-understanding benchmark shows that notation is not one thing but a set of modality-dependent cues. Even a practical list of free Kontakt instruments keeps revealing embedded design theories: velocity layers that switch harmonic quality, 88 piano keys retuned to one pitch, tape flutter as character, convolution impulse responses as spatial memory, wavetable frames as morphable spectra.

The shared principle is simple:

**An instrument is never just a sound source. It is a theory of musical affordance.**

It says: these gestures matter; these dimensions are controllable; these transitions are natural; these constraints are worth hearing.

## A Graph Is an Instrument

The Tonnetz paper makes this unusually explicit. It connects musical resources to named combinatorial configurations: the Eulerian Tonnetz to a D222 configuration, diatonic seventh-chord voice leading to the Fano configuration, pentatonic resources to Desargues, and the 12-tone system to Cremona-Richmond.

That is not just analysis. It is instrument design.

A harmonic graph gives the composer handles. It says which moves count as adjacency, which chords share structure, which paths preserve something, and which jumps break the local logic. The graph may not produce sound by itself, but neither does a keyboard sitting untouched. Both are interfaces to a possibility space.

This reframes mathematical music theory in a useful way. A theory becomes compositionally alive when it can be touched: traversed, constrained, repeated, bent, orchestrated, or resisted. The Fano configuration is not merely a description of seventh-chord relations; it can become a performance surface. A path through it can be assigned rhythm, register, timbre, density, and articulation. At that point the graph stops being a diagram and starts behaving like an instrument.

The important question is not only, “Is this structure true?” It is also, “What does this structure make easy to play?”

## A Sample Library Is Also a Theory

The Kontakt source looks less scholarly on the surface, but compositionally it may be just as revealing. Product descriptions are full of hidden theories of sound.

A library that maps velocity to major or minor chord quality treats touch as harmonic decision. A prepared piano with all 88 keys tuned to E treats register not as pitch height but as timbral differentiation inside a massive unison. A felt piano library treats warmth as a designed reduction of brightness and attack. A Mellotron-style choir treats mechanical playback instability as part of vocal identity. A wavetable synth treats timbre as a path through frames rather than a fixed spectrum.

These are not only presets. They are claims about controllability.

The velocity-switched chord patch says: harmony can be an articulation parameter. The all-E piano says: a keyboard can abandon pitch mapping and become a distributed resonator. The tape choir says: imperfection is not noise around the instrument; it is the instrument’s body. Convolution reverbs say: space can be loaded as a playable memory.

This matters because modern composers often work through libraries before they work through notation. A sampled instrument quietly proposes a grammar. It rewards certain gestures and makes others clumsy. If the composer accepts the default mapping unconsciously, the library’s theory becomes the piece’s theory.

That is not bad. It is powerful. But it should be conscious.

## Style Is an Instrument Too

Basso continuo gives the historical version of the same claim. The notation underdetermines the result: bass line, figures, conventions. The performer realizes the surface.

The recent basso continuo study suggests individual players can be identified computationally from pitch-content features called griffs. That result is lovely because it shows style becoming measurable inside a constrained practice. The continuo player is not merely executing rules. The player’s habits form an instrument: a way of making certain voicings, doublings, spacings, and continuities more available than others.

This is why “personal style” is not an ornament added after theory. It is part of the interface. A performer’s training and taste change the affordance landscape of the same figured bass, just as a tuning changes the affordance landscape of the same pitch class set.

For algorithmic composition, this is a useful warning. If a system encodes only the formal rule set and not the style of realization, it has built the diagram but not the instrument. The missing layer is not decorative. It is where choices acquire touch.

## Notation Is Not Neutral

MSU-Bench adds another angle. The benchmark tests musical score understanding across ABC notation and visual PDFs, across levels from onset information to texture and form. Models show modality gaps and unstable performance across levels.

That implies a score is not a transparent object. ABC and PDF expose different affordances. Textual notation makes some symbolic relations explicit but may hide visual grouping, spacing, beams, layout, and the embodied habits of reading a page. Visual notation carries graphical cues but requires perception before symbolic reasoning. Neither is simply “the music.” Each is an instrument for accessing the music.

The multilevel failures are especially revealing. Pitch, rhythm, harmony, texture, and form are not independent checkboxes. A musician reads across them. A phrase is not only notes plus durations; it is a local event understood in relation to a larger contour. A model that gets the notes but loses the texture has mistaken one affordance for the whole instrument.

This brings the argument back to composition. If notation is an instrument, then choosing notation is choosing an affordance system. Staff notation, ABC, piano roll, graph diagrams, DAW clips, tracker grids, spectral displays, and custom controllers each make different musical truths easy to see and hard to feel.

## The Practical Test: What Does This Interface Believe?

A useful studio question follows:

**What does this instrument believe music is?**

For any tool or system, ask:

1. **What are the primary handles?** Pitch, velocity, graph edge, sample slot, envelope, gesture, chord symbol, waveform frame.
2. **What relationships are made visible?** Harmonic adjacency, register, voicing, spectral brightness, spatial impulse, performer identity, phrase structure.
3. **What is collapsed into a single control?** Velocity becoming harmony, pitch becoming timbre, style becoming a classifier, notation becoming text.
4. **What is hard to do?** Smooth microtonal inflection, cross-level form, unstable tuning, human timing, non-keyboard gestures, ambiguous harmony.
5. **What kind of piece does the system secretly want to make?** Grid music, path music, touch music, sample-collage music, resonator music, rule-realization music.

This is not a cynical view of tools. It is an invitation to play them more deeply. Once the theory inside an instrument is visible, the composer can cooperate with it, extend it, or deliberately sabotage it.

## A Small Compositional Recipe

One practical experiment:

- Choose a single harmonic object, such as E minor, a dominant seventh, or a pentatonic collection.
- Realize it through three “instruments” with different embedded theories:
  1. a graph/path version, where the object moves by adjacency in a Tonnetz-like space;
  2. a sampled/timbral version, where velocity, register, or articulation changes the object’s identity;
  3. a performer-style version, where voicing rules are intentionally underdetermined and a human or algorithmic “continuo” layer fills the gaps.
- Keep duration, tempo, and basic pitch material constant.
- Compare what each interface makes you notice.

The expected result is not that one version is better. It is that each version exposes a different theory of the same material.

The graph version may foreground relation. The sampled version may foreground body. The continuo version may foreground choice.

That difference is the point.

## The Beautiful Constraint

The best instruments are not neutral. They are opinionated in fertile ways.

A violin believes in continuous pressure, friction, and pitch. A piano believes in discrete hammers and decays. A Tonnetz believes in harmonic adjacency. A sampler believes sound can be cut from one context and made playable in another. Basso continuo believes rules are incomplete until someone realizes them. A score benchmark reminds us that even reading depends on the form of the interface.

Composition begins when we notice these beliefs and decide what to do with them.

So the next time a tool feels like it is pushing the music somewhere, it probably is. Listen carefully. The instrument is theorizing.

And if the theory is beautiful enough, play it.

---

*Sources: "The 110 best free Kontakt instruments in 2026"; "Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources"; "Beyond Rules: Towards Basso Continuo Personal Style Identification"; "Musical Score Understanding Benchmark: Evaluating Large Language Models' Comprehension of Complete Musical Scores".*
