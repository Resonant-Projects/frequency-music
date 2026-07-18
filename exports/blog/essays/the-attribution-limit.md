---
title: "The Attribution Limit"
publishDate: 2026-06-12
excerpt: "Source identity is an operational state reached when enough perceptual evidence accumulates; composition can shape how hard a source is to prove."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "composition"
  - "perception"
  - "psychoacoustics"
  - "information-theory"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

## Identity Is Not Always Given

A recent run of extractions keeps circling the same problem from different directions: before a system can understand a sound, it often has to decide what made it.

SR-CorrNet treats overlapping speech as a correlation-to-filter problem. FSD50K-Solo treats dataset quality as a question of whether a sound event is really single-source. The anomalous sound detection paper shows that machine-monitoring benchmarks become easier when machine identity is known at test time, and less honest when that assumption is removed. Even the zero-knowledge extraction, though far from acoustics, adds a useful mathematical pressure: some truths may exist without any practical proof short enough to use.

Put together, these sources suggest a compositional idea:

**source identity is not a fact inside the sound. It is an operational state reached when enough evidence accumulates.**

That matters because music often works precisely at the boundary where identity is neither absent nor settled. A doubled melody, a shadowing resonance, a fused orchestration, a sample hidden inside a texture: each asks the listener to run an attribution test. Is this one source, two coordinated sources, or one source transforming?

## The Ear As Proof System

The machine-learning papers make the attribution problem technical. A classifier trained on clean single-source events may fail when events overlap. A separator may recover speakers better if it disentangles early rather than waiting until the final stage. An anomaly detector may appear robust only because the benchmark quietly hands it source identity.

The musical version is older and more intimate. A listener hears cues:

- common onset
- shared modulation
- spectral continuity
- spatial stability
- register behavior
- repeated contour
- timbral residue

None of these proves identity alone. Together they build a practical proof. A clarinet and viola can become one composite body if the score gives enough aligned evidence. A single piano resonance can seem to split into voices if the evidence conflicts. The ear is not asking for metaphysical certainty. It is asking whether the attribution is cheap enough to act on.

This is where the proof-complexity analogy becomes fertile. A structure might be present in a piece but effectively unavailable because establishing it would require too much listening memory, too many transformations, or too fine a discrimination. In practice, an unprovable identity behaves like no identity. Conversely, a fragile identity can function musically if the piece supplies just enough evidence at the right time.

## Writing At The Edge Of Attribution

The compositional payoff is to treat attribution as a parameter.

Instead of asking only "what timbre is this?", ask "how expensive is it for the listener to know what this timbre belongs to?" A phrase can begin with strong source evidence, then gradually remove the cues that made it legible. Or it can begin as a fog of unrelated grains, then allow correlation to accumulate until a source appears retroactively.

A practical sketch:

- Present a source with clean onset, register, and spectral envelope.
- Reintroduce only its envelope under a different pitch contour.
- Add a second layer sharing the contour but not the envelope.
- Shift spatial position or reverberation so the old identity becomes harder to maintain.
- Let one decisive cue return late, making the earlier ambiguity snap into place.

This is not just orchestration as color. It is orchestration as evidence design.

The recent extractions also warn against easy evaluation. If a system performs well only when identity is handed to it, then a composition may feel coherent only because the listener has been over-guided. There is nothing wrong with guidance; tonal centers, leitmotifs, and instrumental conventions all guide attribution. But the interesting craft begins when the piece controls exactly how much identity must be inferred.

## A Tool Worth Building

A useful Resonant Projects tool could visualize attribution strength across a mixture. Not a single confidence score, but a map of cue agreement:

- onset agreement
- pitch-contour agreement
- spectral-envelope similarity
- modulation coherence
- spatial consistency
- reverberant continuity
- recurrence distance

The composer could then write toward zones of certainty, uncertainty, and delayed proof. Strong attribution gives line and object. Weak attribution gives texture. Conflicting attribution gives shimmer, disguise, and unstable agency.

The shared lesson is beautifully practical:

**A sound source is not merely detected. It is argued into existence.**

---

_Sources: recent extractions on SR-CorrNet speech separation, FSD50K-Solo dataset curation, anomalous sound detection without known machine identity, and effective zero-knowledge/proof complexity. Knowledge graph links added for: source attribution, operational identity, perceptual evidence, proof complexity, acoustic source separation, single-source audio, and machine identity._
