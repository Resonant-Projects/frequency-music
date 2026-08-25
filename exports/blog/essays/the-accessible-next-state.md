---
title: "The Accessible Next State"
publishDate: 2026-08-25
excerpt: "Musical form follows reachable states, not ideal destinations."
category: "interdisciplinary"
tags:
  - "composition"
  - "perception"
  - "psychoacoustics"
  - "signal-processing"
  - "wave-physics"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

The latest available synthesis batch keeps returning to a quietly strict rule:

**A system moves toward the representation it can reach, not the representation we wish it had.**

That sounds like a compromise, but it may be closer to how musical form actually works. Ice under pressure does not jump straight to the most stable possible crystal. A dynamics processor does not hear in arbitrary textbook bands if the ear resolves frequency in critical bands. A watermark survives transformations only when its embedding lives in the right complex-domain structure. A stem-retrieval model improves when pitch and phase equivariance are built into the representation instead of inferred after the fact. A score-understanding model fails when notation modality changes the accessible facts. A speech recognizer hallucinates when acoustic degradation pushes its encoder into a bad reachable state.

These are different domains, but they share one lesson: transformation is path-dependent. The next state is constrained by what remains addressable at the moment of change.

## Metastability As A Musical Form

The ice extraction gives the cleanest physical version. Ostwald's step rule says a transitioning system tends to move to the nearest accessible state rather than the most thermodynamically stable one. New crystalline phases of water appear as nearby plateaus under pressure, temperature, and timescale constraints. The mathematically possible space is enormous; the physically reachable path is narrow.

That is a useful corrective for composition. A progression is often treated as if it were optimizing toward resolution: dominant wants tonic, dissonance wants consonance, tension wants release. But actual musical motion is full of metastable plateaus. A voicing moves where fingers, instruments, register, resonance, expectation, and memory let it move. The most resolved destination may be less important than the nearest state that preserves enough identity to continue.

This suggests an "Ostwald voice-leading" rule: from any sonority, choose the closest reachable sonority that changes one salient constraint while preserving another. Do not optimize globally. Let the piece crystallize through local accessibility.

## The Ear Defines Reachability

The Bark24 dynamics extraction makes the same claim through psychoacoustics. Conventional multiband processing divides frequency with engineering convenience. The Bark scale divides frequency by critical-band behavior: where the ear itself separates, masks, and groups energy.

If a compressor acts across bands that the listener does not perceptually separate, it may be optimizing an unavailable representation. The control surface says "five bands," but the ear hears different boundaries. A Bark-aligned processor makes reachability perceptual: transformations are placed where auditory evidence can actually remain distinct.

For composition, this turns spectral orchestration into a constraint problem. A texture can move not by pitch class or instrument family, but by critical-band occupancy. The composer can ask: which spectral state is nearest in the listener's resolution grid? Which change is physically small but perceptually large? Which change looks large on an analyzer but stays masked?

## Fragility Marks The Boundary

StreamMark adds a sharper test. Its watermark survives benign transformations such as codec compression and noise, but breaks under semantic manipulations such as voice conversion or speech editing. The watermark is semi-fragile: it is designed to distinguish surface-preserving change from identity-changing change.

That gives a beautiful compositional diagnostic. If a hidden musical trace survives reverb, compression, and noise but disappears under pitch-shift, time-stretch, or timbre transfer, then the trace is not just data. It maps the boundary of musical identity for that sound.

The important point is not secrecy. It is controlled survivability. A composer could embed a rhythmic, spectral, or harmonic residue that persists through some transformations and fails through others. The failure point becomes audible form: the place where variation turns into substitution.

## Phase Keeps The Path Coherent

PHALAR makes accessibility internal to representation learning. Its stem retrieval improves when the model is explicitly pitch-equivariant and phase-equivariant. Phase information, often discarded by semantic audio embeddings, correlates more strongly with human judgments of musical coherence than phase-discarding baselines.

That matters because phase is path information. Magnitude spectra can describe what energy is present, but phase helps describe how components line up, move, and belong together across time. If phase is thrown away too early, the system may still classify content but lose the path by which one sound coheres with another.

Musically, this argues for transformations that preserve relational timing, not only pitch inventory or timbre. Two stems can "belong" because their attacks, phase relations, and microtiming form a shared trajectory. The accessible next state is not merely the nearest chord; it is the nearest coherent motion.

## Notation Also Has A Path

MSU-Bench brings the problem into symbolic music. Models show modality gaps between ABC notation and visual score PDFs, and they struggle to maintain correctness across onset, pitch, harmony, texture, and form simultaneously. The score is not one representation. It is several representations with different paths into reasoning.

This is a useful warning for any composition assistant. If the model can answer local pitch questions from ABC but loses texture in PDF, or sees visual layout but misses harmonic function, then the representation is deciding which musical facts are reachable. "Understanding the score" is not a single capacity. It is a route through layers of notation.

For composers, the inverse is promising: choose notation as an instrument of accessibility. A passage can be notated so rhythm is obvious and harmony is hidden, or so texture is visible and pitch is ambiguous. The notation does not merely record the music. It controls which next musical thought is easy to reach.

## Bad Reachability Is Still Reachability

The speech fairness extraction supplies the caution. Under acoustic degradation, some systems do not merely become less accurate. They enter specific bad states: hallucination, insertion spikes, catastrophic repetition, and accent-selective failure. Audio encoder design matters more than language model scale because the encoder determines which acoustic evidence survives into decoding.

This belongs in the same family as metastable ice. A bad reachable state can be stable enough to trap the system. Silence injection can make a recognizer invent speech. Heavy compression can produce repetition. Severe degradation can flatten fairness gaps only because everyone is pushed toward uniformly high error.

The compositional analog is direct: a degraded input can force an instrument, model, or performer into a local attractor. Sometimes that attractor is musically useful. Sometimes it is a failure mode masquerading as style. The distinction depends on whether the composer understands the path that made it reachable.

## A Studio Exercise

Build a short piece from a single rule:

At every change, move to the nearest accessible state under one active constraint.

Use six constraints, one per section:

- physical adjacency: small voice-leading moves only
- perceptual adjacency: Bark-band redistribution only
- identity survivability: a hidden trace must survive the transformation
- phase coherence: preserve attack or microtiming relations
- notational accessibility: change what the score makes easy to parse
- degraded attractor: let silence, masking, or compression trigger repetition

The result should not sound like a demonstration of six papers. It should sound like a system learning what kind of next state it is allowed to have.

## Why It Matters

The useful connection across these sources is not "everything is representation." That is too broad. The sharper claim is that musical transformation is governed by reachable representations. The body, ear, codec, neural encoder, score format, and acoustic channel each define a local map of possible next states.

That gives composers a practical question:

**What does this material know how to become next?**

Not what could it become in theory. Not what would be optimal. What can it become while preserving the address of the thing we care about?

That is where form begins: in the gap between the possible and the reachable.

---

_Sources: recent synthesis context from `data/generated/synthesis/2026-05-21T00-26-47-882Z/context.md`, including extractions on complex ice phases and Ostwald's step rule (`j97dwcq0crkhg0n8z2tmyqypfd86f0ny`), Bark-scale dynamics processing (`j977tjh3ka74caprsf86d4e3y185maah`), StreamMark semi-fragile audio watermarking (`j97b5cq4em4evnpz1dzpjk37y1854ztc`), PHALAR phase- and pitch-equivariant audio representations (`j978zvv39t3wqdw578e6g057b18683jf`), MSU-Bench score understanding (`j978mypywk23f3gtf3ykz84q4x85j102`), and speech-recognition encoder bias under degradation (`j97795a7x76skzbg4d8pcdhpqh85k5zb`)._

_Concepts to link when Convex is available: accessible next state, reachable representation, Ostwald voice-leading, metastable musical form, critical-band orchestration, semi-fragile musical identity, controlled survivability, phase coherence, notation as accessibility, degraded attractor, encoder-defined evidence, representation path-dependence._

_Connections: [The Survival Layer](the-survival-layer.md), [The Sourcehood Separation Threshold](the-sourcehood-separation-threshold.md), [The Resolution Grid](the-resolution-grid.md), [The Weighting Function](the-weighting-function.md), [When Silence Becomes Instruction](when-silence-becomes-instruction.md), [The Representation That Gets To Act](the-representation-that-gets-to-act.md)._
