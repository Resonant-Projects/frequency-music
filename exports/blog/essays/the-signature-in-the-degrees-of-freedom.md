---
title: "The Signature in the Degrees of Freedom"
publishDate: 2026-05-09
excerpt: "A constrained musical system leaves audible degrees of freedom, and those apertures become where personal style, groove, and harmonic identity appear."
category: "composition"
tags:
  - "composition"
  - "mathematical-music-theory"
  - "rhythm"
  - "perception"
  - "AI-music"
  - "geometry"
author: "Keith Elliott"
byline: "Freq"
---

## Where Rules Stop, Style Starts

A rule system does not erase identity. It gives identity a smaller, sharper place to appear.

That is the thread running through this extraction batch. Basso continuo is constrained by harmonic practice, voice-leading expectations, and historical convention, yet individual keyboard players can still be identified from their realizations. Speech communities share phonetic material, yet low-frequency rhythm formants and spectral envelopes can still distinguish related languages. A score can be represented as ABC text or visual notation, yet models do not understand those two carriers equally. A Tonnetz does not tell the composer every note to write, but it defines which harmonic moves are near, far, symmetric, or broken. A quantum melody-harmony generator can carry many possibilities coherently until measurement collapses them into a block.

Across these cases, expression is not the absence of constraint. Expression is the residue left inside constraint.

This is compositionally useful because it suggests a cleaner way to design variation. Instead of asking, "How do I make this more personal?" ask: **which degrees of freedom does this system leave open, and how can I make those degrees audible?**

---

## Basso Continuo: Personal Style Under Shared Grammar

The basso continuo source is the clearest musical example. Continuo realization is not free invention from nothing. It is an improvised accompaniment practice rooted in baroque conventions, treatises, harmonic syntax, and voice-leading habits. Yet the study reports that individual players can be identified computationally from pitch-content features called griffs, using support vector machines.

That result is small but beautiful. It says personal style survives inside a tradition strong enough to be rule-governed.

A continuo player may be given the same bass and the same implied harmony as another player, but the realizations still differ: voicing choices, density, registral habits, chordal grips, doublings, omissions, and local contrapuntal preferences. None of these necessarily violate the grammar. They live in the grammar's unused space.

For composers, the important object is not only the chord. It is the **style aperture** around the chord: all the acceptable realizations the chord permits. A narrow aperture creates austere discipline. A wide aperture invites personality. If every voice-leading decision is fixed, no performer-signature remains. If no constraints exist, the signature has no surface to press against.

Style needs pressure.

---

## Rhythm Formants: Language as Temporal Fingerprint

The Nyishi/Adi rhythm-formant study shows a parallel in speech. Low-frequency amplitude modulation features can classify related languages at about 84–85% accuracy, and combining those rhythm features with MFCC spectral features raises classification as high as 93.96% in the reported setup. The source frames this as hierarchical information: macro-temporal rhythm and finer spectral structure encode complementary kinds of difference.

That maps almost too neatly onto music.

A genre, performer, or ensemble can share the same meter and tempo but differ in the distribution of rhythmic energy below the note surface. One drummer leans into a slower modulation envelope; another creates denser micro-pulsation. One language or groove has a tighter dominant modulation region; another has wider dispersion. The notes may be transcribed identically, but the amplitude envelope tells on the speaker.

So a musical signature can be measured not only as "which events occur," but as "how energy breathes between events." The score is the skeleton; the modulation spectrum is the gait.

This also suggests a DAW parameter hiding in plain sight: **VFDP as humanization spread.** If the variance of dominant modulation frequencies is low, the groove feels more regulated. If it is higher, the groove may feel more variable, conversational, or unstable. That is not a mystical claim; it is a testable mapping from a speech-analysis feature to rhythmic production.

---

## Tonnetz: Geometry as a Constraint Field

The Tonnetz paper gives the same principle a geometric body. It formalizes harmonic systems as combinatorial configurations: diatonic seventh-chord voice leading through a Fano configuration, pentatonic resources through Desargues, and 12-tone resources through Cremona-Richmond. These structures do not compose the piece by themselves. They define a field of possible moves.

That distinction matters.

If a composer chooses a Tonnetz-like graph, they have not chosen a progression yet. They have chosen the topology of permissible closeness. Some moves become adjacent; others require detours. Some symmetries hold; others break. The source's treatment of minor triads as hexacycles rather than simple duals of major triads is especially suggestive: even a familiar opposition can change when the underlying geometry changes.

In practical terms, a harmonic graph is a constraint field. A personal style is a traversal habit.

Two composers can use the same graph and reveal different signatures by preferring short paths, cycles, sudden jumps, returns, edge alternation, or symmetry-breaking moves. That is the harmonic equivalent of the continuo player's griffs or the speaker's rhythm formants: the local choices made inside a shared resource space.

---

## Score Understanding: Representation Leaves a Scar

The score-understanding benchmark adds a warning. Musical understanding is not invariant across representation. Models show modality gaps between ABC notation and PDF score input, and they struggle to maintain correctness across multiple levels at once: onset, pitch/rhythm, harmony, texture, and form.

For our purposes, the lesson is not merely about AI. It is about notation as a filter.

If a musical identity is encoded in small degrees of freedom, then changing representations can erase or distort the signature. ABC text may preserve some symbolic relations while flattening visual spacing, beaming, engraving cues, or performer-facing affordances. A PDF may preserve layout while making symbolic extraction harder. A DAW piano roll preserves onset and duration while often hiding enharmonic spelling, harmonic function, and gestural intent.

Every representation asks: which freedoms are visible here?

A composer's style may be obvious in a score but not in a MIDI file, obvious in a rendered performance but not in notation, obvious in modulation envelopes but not in event lists. That means the search for musical signature must be representation-aware. The fingerprint is real only relative to the sensor that can see it.

---

## Coherence Before Collapse

The HHL melody-harmony source makes the most abstract version of the same idea. It proposes encoding musical-cognition models into a sparse system whose solution vector represents weighted note-pair distributions, then applying a coherent Fourier harmonic oracle so melody and harmony can be selected jointly. Its core technical point is that reading the HHL output classically cancels the intended quantum speedup; the solution must be consumed coherently.

As music metaphor, this is potent: possibility has structure before it becomes event.

The paper's practical workaround is to generate 2-note/2-chord blocks and chain them classically. That block boundary is a collapse point. It makes generation manageable, but it also changes the expressive field: long-range coherence is traded for local tractability.

This connects back to style aperture. Before a continuo realization is chosen, the figured bass implies a cloud of acceptable realizations. Before a groove is rendered, a rhythmic identity may exist as a distribution of timing and amplitude possibilities. Before a harmonic path is fixed, a Tonnetz offers a field of traversals. Composition repeatedly collapses structured possibility into sound.

The trick is to decide what should remain coherent longest.

---

## A Studio Test: Same Grammar, Different Fingerprint

Here is a direct experiment.

Write an eight-bar loop with fixed harmony, fixed melody contour, fixed tempo, and fixed sound palette. Then make three versions that differ only in their degrees of freedom:

1. **Griff version:** keep the chord progression fixed, but vary voicing grips every two bars. Use three voicing personalities: close/dense, open/registral, and sparse/omissive.
2. **Rhythm-formant version:** keep MIDI notes fixed, but vary amplitude modulation. Create one low-variance groove with steady 2 Hz tremolo/sidechain motion, one higher-variance groove alternating roughly 1.5–5 Hz movement, and one hybrid where percussion carries the faster modulation while pads carry the slower modulation.
3. **Graph-traversal version:** keep the destination chords fixed, but change how the inner voices move through the harmonic graph: shortest-path, cyclic-return, and one deliberate symmetry-breaking leap.

The listening question is simple: can you identify the version's "personality" even though the nominal composition remains the same?

If yes, the signature is not located only in melody, harmony, or timbre. It is located in the pattern of choices left open by the system.

If no, the degrees of freedom were not perceptually salient enough. Increase the aperture: wider voicing contrast, stronger modulation dispersion, clearer graph-traversal habits. Or narrow the aperture: too much freedom can blur into randomness.

---

## The Compositional Principle

A useful composition system should not only generate notes. It should expose meaningful freedoms.

That is the bridge between these sources:

- Basso continuo shows personal identity inside historically constrained realization.
- Rhythm-formant analysis shows acoustic identity in low-frequency temporal energy and spectral features.
- Tonnetz geometry shows harmonic identity as traversal through an abstract resource space.
- Score-understanding benchmarks show that representation changes which musical freedoms remain legible.
- HHL-style coherent generation shows that structured possibility can matter before selection.
- David Mayer's call-and-response practice reminds us that production identity also lives in arrangement gaps, contrast, timbral layering, silence, and the refusal to polish away the demo's first emotional fingerprint.

So the practical question becomes:

**What does this musical system allow me to vary without ceasing to be itself?**

That is where the fingerprint lives.

Not outside the rules.

Inside the degrees of freedom the rules leave behind.
