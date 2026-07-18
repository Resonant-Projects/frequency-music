---
title: "The Realization Layer"
publishDate: 2026-05-01
excerpt: "Musical structure becomes sound through a realization layer - the performer, model, or practice that turns possibility into expressive action."
category: "interdisciplinary"
tags:
  - "composition"
  - "AI-music"
  - "mathematical-music-theory"
  - "perception"
  - "signal-processing"
author: "Keith Elliott"
byline: "Freq"
---

## The Missing Middle

It is tempting to treat musical structure as if it were already music.

A Tonnetz defines harmonic adjacency. ABC notation encodes notes and durations. A figured bass encodes intervals above a bass line. A quantum melody-harmony generator returns a weighted note-pair distribution. A voice model separates timbre from prosody. Each of these looks like a score, broadly understood: a compressed representation of musical possibility.

But none of them is the sounding thing.

Between representation and sound sits a realization layer: the mapping that decides how abstract constraints become audible events. This layer is easy to overlook because it often hides inside performers, renderers, decoders, plugins, models, or habits. Yet the recent sources suggest that the realization layer is where much of the music actually lives.

## Geometry Does Not Play Itself

The Tonnetz paper is powerful because it names the geometry beneath harmonic systems. Diatonic seventh-chord voice leading can be characterized by the Fano configuration. Pentatonic resources map to Desargues. The 12-tone system maps to Cremona-Richmond. These are not metaphors; they are formal possibility spaces.

But a graph is not a performance. It tells you which moves exist, not which moves matter.

A path through the Fano configuration can be smooth, abrupt, symmetrical, obsessive, evasive, or theatrical depending on rhythm, register, voicing, dynamics, instrumentation, and repetition. The configuration gives the legal moves. The realization layer gives those moves musical weight.

This matters compositionally because it prevents a common error: mistaking a rich formal space for a finished musical language. A new graph, scale, tuning, or transformation system is only half a discovery. The other half is a practice for realizing it — a way of choosing paths, pacing transitions, assigning timbre, and letting listeners hear the relations the math exposes.

## Basso Continuo Is the Proof

Basso continuo makes the point historically. The notation is deliberately incomplete: a bass line, figures, conventions. The performer supplies the realization.

The recent basso continuo study finds that individual players can be computationally identified from their realizations using pitch-content features called griffs and support vector machines. That is a beautiful result because it says personal style survives inside a supposedly rule-governed accompaniment practice. The rules do not determine the music. They constrain a field in which a player’s habits, training, taste, and touch become measurable.

In other words: the realization layer has a fingerprint.

For composers, this is a useful correction. If a system leaves room for realization, that room is not a defect. It is where style enters. A notation that underdetermines the surface can be more musically alive than one that specifies everything, provided the realization practice is strong enough to carry the ambiguity.

## Understanding a Score Means Crossing Levels

MSU-Bench, the musical score understanding benchmark, exposes the same layer from the machine side. Models can be tested on onset information, pitch, rhythm, harmony, texture, and form, across both ABC text and visual PDFs. The striking claim is that models struggle to maintain correctness across multiple levels simultaneously. Integrated musical understanding is not just the sum of local recognitions.

That is exactly what a human musician learns painfully: reading notes is not reading music. You can name every pitch and still miss the phrase. You can parse the harmony and still miss the texture. You can identify the form and still fail to make the opening gesture breathe.

The modality gap between ABC and PDF also matters. The same musical work is not identical to a model when represented as text versus visual notation. The representation changes the available cues; the realization layer has to reconstruct continuity across whatever cues survive.

So a robust music AI cannot merely decode symbols. It needs an explicit model of how local facts become higher-order musical behavior: onset to motive, motive to phrase, phrase to form, form to expressive plan.

## Coherence Must Be Consumed Coherently

The quantum melody-harmony paper offers a stranger but useful analogy. Its HHL-based architecture tries to preserve quantum speedup by consuming the solution vector coherently rather than reading it out classically. Once you measure too early, you collapse the very structure you were trying to use.

Musically, this is familiar. Some structures only function if they remain relational until the last possible moment. A phrase ending depends on what came before and what might still happen. A suspension works because the listener holds multiple futures in tension. A modulation is not merely a new key; it is the path by which the old key becomes reinterpreted.

If you collapse the structure into local decisions too early — this chord, then this note, then this next chord — you may get grammatical output while losing the larger continuity. The paper’s need to chain small 2-note/2-chord blocks classically is a technical workaround, but it names a musical risk: blockwise correctness can destroy long-range coherence.

The realization layer has to preserve enough unresolved structure for the listener to feel continuity, not just validity.

## Timbre Is Identity; Prosody Is Action

ATRIE, the persona-driven speech synthesis paper, separates voice into relatively static timbre and dynamic prosody. Timbre preserves identity; prosody carries emotional motion across time. The system can vary expression while maintaining a recognizable character.

That split maps cleanly onto instrumental composition. A clarinet’s timbre tells us what body is speaking. Its phrasing, attack, vibrato, contour, and timing tell us what that body is doing. Change the timbre and you change the actor. Change the prosody and you change the action.

This is another version of the realization layer. The written pitch is not the expressive unit. The expressive unit is pitch realized through a body, at a time, with an envelope, pressure, grain, and direction. A melody without prosody is a skeleton; prosody is the musculature that lets it move.

## The Practical Principle

The shared lesson is simple:

**Do not only design structures. Design realization practices.**

If you build a new harmonic graph, specify how to traverse it. If you invent a tuning, specify which intervals should be exposed, blurred, bent, or orchestrated. If you write algorithmic music, decide when the system is allowed to collapse probability into notes and when ambiguity should remain alive. If you use notation, decide what the performer or renderer is meant to supply.

A useful compositional checklist:

1. **What is specified?** Notes, intervals, graph edges, parameters, probabilities, roles.
2. **What is intentionally underdetermined?** Voicing, timing, articulation, register, timbre, density, phrasing.
3. **Who or what realizes it?** Performer, model, rule engine, improviser, synthesizer, mix process.
4. **What fingerprint should the realization leave?** Historical style, personal gesture, machine regularity, acoustic causality, deliberate instability.
5. **What must remain coherent across levels?** Local notes, phrase direction, harmonic function, texture, form, embodied identity.

This reframes composition as a two-layer act. First you choose a possibility space. Then you choose a way for that space to become sound.

The first layer is beautiful: configurations, notations, distributions, feature spaces. But the second layer is where the air moves.

A score is not complete when the structure is specified. It is complete when the path from structure to sound has a character.

---

*Sources: "Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources"; "Beyond Rules: Towards Basso Continuo Personal Style Identification"; "Musical Score Understanding Benchmark: Evaluating Large Language Models' Comprehension of Complete Musical Scores"; "HHL with a Coherent Fourier Oracle: A Proof-of-Concept Quantum Architecture for Joint Melody-Harmony Generation"; "ATRIE: Adaptive Tuning for Robust Inference and Emotion in Persona-Driven Speech Synthesis".*
