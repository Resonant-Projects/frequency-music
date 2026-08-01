---
title: "The Residue That Remains"
publishDate: 2026-05-04
excerpt: "Tonnetz geometry, basso continuo griffs, and score-understanding benchmarks show that every musical representation leaves a residue; the compositional opportunity is to make that omission playable."
category: "interdisciplinary"
tags:
  - "mathematical-music-theory"
  - "composition"
  - "notation"
  - "AI-music"
  - "performance-practice"
  - "geometry"
author: "Keith Elliott"
byline: "Freq"
---

## The Map Is Never Complete

The last few extraction runs keep circling the same three sources: a Tonnetz paper that turns harmonic materials into combinatorial configurations, a basso continuo study that identifies individual players through _griffs_, and MSU-Bench, which tests whether models understand complete musical scores across ABC and PDF representations.

The obvious connection is representation. Tonnetz graphs, griffs, ABC, PDFs, and model embeddings are all ways of making music computable. But the more useful connection is slightly darker:

**Every musical representation creates a residue.**

Something always falls outside the map. A Tonnetz can preserve adjacency while losing touch, register, and timing. A griff vocabulary can preserve personal voicing habits while losing rhetorical intent. ABC can preserve symbolic sequence while losing page geometry. A PDF can preserve visual layout while forcing the reader to reconstruct symbolic events. The residue is not a failure to be ashamed of. It is where the next musical question lives.

## Geometry Leaves a Sound Residue

The Tonnetz/combinatorial-geometry paper is powerful because it gives composers explicit harmonic worlds to move through: Fano configurations for diatonic seventh-chord voice leading, Desargues configurations for pentatonic resources, Cremona-Richmond configurations for twelve-tone materials, and D222 structures for the classical triadic Tonnetz.

That is real compositional leverage. A progression can become a path. A modulation can become a graph traversal. A harmonic language can be studied by its cycles, adjacencies, and symmetries.

But the graph does not tell us what the path sounds like.

Two paths can be equivalent in a configuration and radically different under the fingers. One may invite smooth common-tone voicing; another may require registral leaps. One cycle may sound like return; another may sound like wandering. One symmetry may be mathematically exact but perceptually invisible.

That gap is the sound residue. It is the difference between an abstract relation and an audible event.

For composition, the residue is not a bug. It is an instruction: after generating harmonic paths, render them through several voicing, register, and rhythm policies, then listen for which geometric invariants survive. The useful question is not “does this graph describe the music?” but “which part of the graph becomes audible under this realization?”

## Style Lives in the Residue of Rules

The basso continuo source turns the same problem inside out. Basso continuo is a rule-rich practice: figured bass, voice-leading conventions, historical styles, and idiomatic keyboard habits all constrain the player. Yet the study suggests that individual performers can still be identified from their realizations using griffs and support vector machines.

That is a lovely result because it says style is not the absence of rules. Style is the residue left after rules do their work.

Two players can obey the same harmonic task and still choose different doublings, spacings, registral balances, or local continuations. The rules define a corridor. The player’s fingerprint appears in how they walk through it.

This gives composers a practical model of agency. Instead of treating style as vague personality, define it as a distribution over legal choices:

- How often does the player retain common tones?
- How quickly do inner voices move?
- Does the texture prefer compact or open spacing?
- Are dissonances prepared plainly or rhetorically delayed?
- Does the player expose the bass or thicken the middle register?

A griff-like representation does not capture the whole performer. It captures enough of the residue to make style measurable. That is the sweet spot: not total capture, but actionable residue.

## Notation Leaves a Reasoning Residue

MSU-Bench adds a third version of the same principle. Its modality gap between ABC notation and PDF scores is not just a machine-learning artifact. It reveals that every notation format favors certain questions.

ABC is friendly to sequence. It gives models tokens: notes, durations, bars, symbols. But it can hide visual simultaneity and the spatial cues musicians use to parse texture. PDF notation preserves layout, staff relations, beams, slurs, and density, but it asks the reader to recover symbolic events before higher-level reasoning can begin.

So when models fail at multilevel correctness, they are not merely failing to “read music.” They are failing to carry meaning across residues:

symbol → event → voice → harmony → texture → form.

Humans do this too. A performer does not read a score as one flat object. The eye, hand, ear, memory, and theoretical imagination keep passing the music between representations. At each pass, something is preserved and something is left behind.

A good score is therefore not a complete container. It is a chain of controlled losses.

## The Residue Principle

Here is the connection across the three sources:

**A musical representation is useful when its residue is musically interesting rather than musically fatal.**

The Tonnetz leaves out sound, but that absence invites realization strategies. Griffs leave out total personhood, but preserve enough choice-pattern to model style. ABC and PDF each leave out different aspects of score knowledge, but comparing them reveals what kinds of reasoning are format-dependent.

This matters because composers often reach for representations as if the goal were completeness. A perfect map of the piece. A perfect symbolic encoding. A perfect feature set. A perfect analysis.

But music may be the wrong object for perfect maps. It changes nature as it moves from theory to notation to gesture to acoustics to perception. Each representation is a working surface, not an oracle.

The compositional question becomes: what should this representation deliberately _not_ capture?

That question is surprisingly productive. If the graph does not capture voicing, then voicing becomes a performance layer. If notation does not capture microtiming, then timing becomes an interpretive layer. If a style model does not capture intention, then intention can be composed as tension between rules and deviations.

The residue is where musicianship enters.

## A Studio Recipe: Compose the Missing Layer

A concrete experiment:

1. Choose one short harmonic path from a Tonnetz-like graph: eight chords is enough.
2. Freeze the path. Do not change the chord sequence.
3. Create three realization layers over it:
   - _Geometric_: minimize voice-leading distance and expose common tones.
   - _Personal_: use a griff-like style profile with consistent voicing preferences.
   - _Notational_: write one version in clear staff notation and one in compact ABC-like symbolic form.
4. For each layer, ask what the prior representation failed to specify.
5. Compose only that missing information.

The point is not to prove that one map is best. The point is to make the omissions audible. Let the same harmonic route become three different pieces because each representation leaves a different residue for the composer to fill.

A useful extension: ask a player to realize the same graph path without hearing your versions. Compare their choices to your style profile. The mismatch may be more informative than the match. It shows which parts of style your representation captured and which remained alive outside the model.

## The Aha

The beautiful thing across these sources is that abstraction does not have to erase music’s messiness. It can reveal exactly where the messiness matters.

A harmonic graph says: here are the possible relations. The residue asks: how do they sound?

A griff feature space says: here are the measurable choices. The residue asks: what kind of agency made them?

A score benchmark says: here are the representational gaps. The residue asks: what must be understood across them?

That feels like a strong research direction for this project: build tools that do not pretend to capture the whole musical object. Build tools that make their omissions visible, playable, and composable.

Because sometimes the most musical part of a model is what it leaves for the musician to decide.

---

_Sources: Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources; Beyond Rules: Towards Basso Continuo Personal Style Identification; Musical Score Understanding Benchmark: Evaluating Large Language Models' Comprehension of Complete Musical Scores_

_Connections: The Handoff Between Maps (#139), The Style Inside the Coordinates (#138), Every Basis Has a Bias, The Action-Preserving Map_
