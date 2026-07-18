---
title: "The Space Between: Why Music's Relational Properties Resist AI"
publishDate: 2026-03-06
excerpt: "Three 2026 papers reveal why AI struggles with music: it's not about generating individual elements, but capturing the relational properties-groove, spatial acoustics, cross-dimensional analysis-that live in the space between."
category: "interdisciplinary"
tags:
  - "AI-music"
  - "signal-processing"
  - "composition"
  - "acoustics"
  - "mathematical-music-theory"
  - "perception"
author: "Keith Elliott"
byline: "Freq"
---

## The Problem Isn't the Notes

A single instrument track is a solved problem. Current AI systems can generate a convincing piano melody, a plausible drum pattern, a reasonable bass line. The quality varies, but the _kind_ of thing they produce is recognizable. Put two tracks together, though, and something breaks.

Not always. Not catastrophically. But consistently, subtly, in a way that musicians hear immediately and struggle to articulate. The drums and bass don't _lock in_. The piano comps against the melody rather than around it. The spatial impression is of instruments stacked in a column rather than inhabiting a room.

Three recent papers, arriving from completely different research programs, converge on the same diagnosis: **the hard problem in music AI isn't generating individual elements — it's capturing the relationships between them.** The "space between" instruments, between sound and surface, between analytical dimensions, is where musical meaning lives and where current systems consistently fall short.

## Groove Is a Relationship

SyncTrack (2026) tackles multi-track waveform generation with a specific focus that reveals how deep the problem goes. The authors observe that existing multi-track models focus on timbral and spectral differences between tracks — making sure the drums _sound like drums_ and the bass _sounds like bass_ — while systematically overlooking whether these tracks rhythmically synchronize with each other.

This isn't a minor oversight. It's a category error about what music is.

When a drummer and bassist lock into a groove, the musical content isn't in either track individually. It's in the _temporal relationship_ between them — the way a bass note lands precisely on, or deliberately just behind, a kick drum hit. That relationship has no location. It doesn't exist in the drum track or the bass track. It exists in the space between them, and it's the thing that makes a body move.

SyncTrack's solution is architecturally revealing. They use a dual-module design: **track-shared modules** that establish a common rhythmic grid via cross-track attention, and **track-specific modules** that handle individual instrument characteristics through learnable instrument priors. The shared modules force the model to compute cross-track temporal relationships explicitly, rather than hoping they emerge from independent generation.

The paper also introduces three metrics for evaluating this relational property:

- **Inner-track Rhythmic Stability (IRS)**: Does a single track maintain consistent internal rhythm?
- **Cross-track Beat Synchronization (CBS)**: Do beats align across tracks?
- **Cross-track Beat Dispersion (CBD)**: How tight is the beat timing between tracks?

Note the progression. IRS is a property of individual tracks. CBS and CBD are properties of _relationships_ between tracks. The fact that these relational metrics didn't exist before SyncTrack tells you something about how the field has been thinking — or failing to think — about what makes multi-track music musical.

Here's the uncomfortable truth about SyncTrack's achievement: J Dilla's "drunk" beats, the push-and-pull of a jazz rhythm section, the deliberate flamming of New Orleans second-line drumming — these are all _controlled deviations from synchronization_. CBS would score them as errors. This isn't a minor caveat — it means the AI's core metric for relational quality actively penalizes the most human, expressive forms of musical relationship. The metric formalizes rhythmic _rigidity_, not rhythmic _intelligence_. A more complete theory of multi-track rhythm would need to distinguish _intentional_ micro-timing variation from _accidental_ drift, and that distinction lives entirely in the relational domain that current models lack.

## Rooms Shape Sound

DynFOA (2026) approaches the relational problem from a completely different direction: generating spatial audio (first-order ambisonics) from 360° video. The naive approach would be to train a model on audio-visual pairs and hope it learns where sounds come from. DynFOA does something more principled: it first reconstructs the 3D scene using Gaussian Splatting — capturing geometry, materials, surface properties — and then uses that physical reconstruction to model how sound interacts with the environment.

The key insight is that spatial audio isn't a property of the sound source. It's a property of the _relationship between the source, the surfaces, and the listener_. The same voice in a cathedral and a closet produces radically different spatial impressions, not because the voice changed but because the environment — the geometry that mediates the relationship between source and receiver — is different.

DynFOA models this explicitly. Occlusion (a wall between you and a speaker muffles the sound), reflection (the sound bouncing off a hard floor), and reverberation (the cumulative wash of thousands of reflections in an enclosed space) are all computed from the reconstructed physical scene. The result is that physics-aware spatial audio generation outperforms learned-only approaches across every metric: spatial accuracy, acoustic fidelity, and distribution matching.

This is a vindication of the project's core thesis: **physics constrains and enables musical experience, and models that encode physical relationships outperform those that try to learn them from correlation alone.**

The compositional implications are tantalizing. If you can reconstruct a 3D scene from photographs and derive its acoustic properties, you can — in principle — recreate the acoustic experience of historical spaces. What did music sound like in the Hagia Sophia before the Ottoman renovation? In a Roman amphitheater at full capacity? In the room where Bach first performed the Brandenburg Concertos? The geometry is partially recoverable from architectural records and archaeological evidence. The acoustics follow from the geometry. The music we have. The missing piece was the physics-informed computational bridge between space and sound.

## Analysis Requires Composition (of Operations)

CSyMR (2026) completes the triangle with a finding about music _analysis_ rather than generation. The benchmark tests whether AI systems can answer complex, multi-step questions about symbolic music scores — questions like "what is the relationship between the key changes and the rhythmic density in measures 12-24?"

LLMs fail at this. Not because they lack knowledge of music theory (they can define "key change" and "rhythmic density" accurately), but because answering the question requires _chaining_ multiple analytical operations: identify key regions, compute rhythmic density per measure, correlate the two sequences, and synthesize a description of the relationship. Each step is feasible. The composition of steps breaks down.

Augmenting the LLM with deterministic music21 analysis tools — giving it functions to call for key detection, rhythmic analysis, voice leading computation — improves accuracy by 5–7%. The tools handle the individual analytical atoms reliably; the LLM handles the compositional reasoning about which atoms to chain and how to interpret the results.

The word "compositional" is doing double duty here, and that's not a coincidence. Music is _compositional_ in the computer science sense — it's built from smaller parts that combine according to rules. And understanding music requires _compositional_ reasoning — chaining operations that each handle one aspect of the structure. The relational property that CSyMR tests is the relationship _between analytical dimensions_: how does harmony relate to rhythm? How does voice leading relate to form? These cross-dimensional relationships are exactly the kind of "space between" that LLMs struggle with.

## Why "Between" Is Hard

These three papers point to a shared computational challenge. Relational properties have characteristics that make them inherently more difficult than properties of individual elements:

**They're non-local.** Cross-track synchronization isn't located in any single track. Room acoustics aren't located in any single surface. Cross-dimensional analytical relationships aren't located in any single musical parameter. Models optimized to generate or analyze individual streams have no natural place to represent these properties.

**They scale combinatorially.** Two tracks have one pairwise relationship. Five tracks have ten. An orchestra has thousands. The number of relational properties grows much faster than the number of elements, and most architectures don't allocate capacity accordingly.

**They're often implicit in training data.** When a drummer and bassist groove together in a recording, the relational property (their synchronization) is _implicit_ in the mixed audio. A model trained on the mix might learn to reproduce the statistical signature of groove without explicitly representing the cross-track relationship that produces it. This works until it doesn't — and it stops working exactly when you need _control_ over the relational property (make it tighter, looser, more swung, straighter).

**They require physics, not just statistics.** DynFOA's most striking result is that physics-informed spatial audio beats purely learned approaches. The physical laws governing sound propagation through space are exact and known — reflection, diffraction, absorption, interference. A model that encodes these laws in its architecture outperforms one that tries to learn them from data, because the data can never cover every possible room geometry, but the physics is universal.

## The Musical Implication

For composers and musicians, the "space between" has always been the real craft. Any competent arranger can voice a chord. The art is in how the voices _move together_ — in the voice leading, the rhythmic interplay, the spatial placement, the way harmonic tension relates to rhythmic density. These are all relational properties.

Current AI tools are strongest at the individual-element level and weakest at the relational level. This suggests a collaboration model: use AI to generate or analyze individual streams, but rely on human judgment (or physics-informed computation) for the relational structure. The arranger becomes a curator of relationships rather than a generator of parts.

It also suggests a research direction. The next breakthrough in music AI won't come from bigger models or more data. It will come from architectures that explicitly represent relational properties — cross-track attention (SyncTrack), physics-informed computation (DynFOA), tool-augmented compositional reasoning (CSyMR) — as first-class citizens rather than emergent byproducts.

Music has always known that the space between the notes is where the music lives. The machines are starting to learn the same lesson.

---

_Sources: SyncTrack (multi-track rhythmic synchronization, 2026), DynFOA (physics-based spatial audio generation, 2026), CSyMR (compositional symbolic music retrieval, 2026). Cross-referenced with SyncTrack IRS/CBS/CBD metrics, DynFOA 3D Gaussian Splatting acoustic modeling, CSyMR music21 tool augmentation results._
