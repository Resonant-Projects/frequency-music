---
title: "The Source Before the Signal"
publishDate: 2026-05-22
excerpt: "Source identity is not metadata but part of the signal model: single-source curation, speech separation, and anomalous-sound evaluation all depend on deciding what kind of source exists before…"
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "acoustics"
  - "composition"
  - "AI-music"
  - "psychoacoustics"
author: "Keith Elliott"
byline: "Freq"
---

## The Hidden First Question

Before a system can decide what a sound means, it has to decide what kind of source made it.

That sounds obvious until you notice how often audio systems pretend the question has already been answered. Speech separation models assume there are speakers to separate. Sound-event datasets assume there are individual events worth labeling. Anomalous-sound detectors assume the monitored machine identity is known at test time. In each case, the interesting failure appears when that identity layer is uncertain.

Three recent extractions converge on this point from different sides. FSD50K-Solo tries to curate clean single-source sound events out of a messy open corpus. SR-CorrNet tries to recover speech streams from overlapping speakers, noise, and reverberation by turning spatio-spectro-temporal correlations into filters. A paper on anomalous sound detection shows that removing known machine identity from evaluation exposes robustness failures that ordinary benchmark protocols hide.

The shared lesson is sharp: source identity is not metadata. It is part of the signal model.

## Single-Source Is a Construction

FSD50K-Solo begins from a dataset problem: open audio corpora contain many multi-source recordings. A "dog bark" sample may include traffic, room tone, speech, wind, or another event crossing the same time window. For many models, that background is not harmless context. It changes what the example teaches.

The paper's solution is revealing. It synthesizes clean single-class events with a diffusion model, constructs controlled noisy mixtures, then trains an encoder-classifier pipeline to distinguish single-source from multi-source samples. In other words, the system does not simply find purity; it learns a contrast between isolated cause and mixed scene.

For composition, this reframes the idea of an isolated sound. A solo timbre is not just one object in the world. It is an editorial decision: this much reverberation counts as part of the source, that background hum does not; this onset belongs to the event, that overlapping transient does not. The "single source" is a listening contract.

That contract is musically powerful. A composer can write with deliberately unstable source boundaries: a bowed cymbal that becomes room resonance, a voice that becomes breath noise, a granular texture where no listener can decide whether the unit is one event, many events, or an acoustic field. The question "how many sources are present?" becomes a compositional parameter.

## Separation Needs an Early Hypothesis

SR-CorrNet attacks the opposite problem: not filtering a corpus down to isolated sources, but separating overlapping speech in realistic acoustic environments. Its critique of late-split architectures is important. If speaker disentanglement waits until the final stage, the model carries mixed information too long, creating a bottleneck precisely where discrimination is needed.

The proposed alternative performs coarse separation earlier, then progressively reconstructs speaker-discriminative features. The key phrase is "correlation-to-filter": correlations in the observed mixture become the evidence used to estimate filters for target recovery.

That is very close to what skilled listening does in dense music. The ear does not receive a clean cello, a clean clarinet, and a clean room. It receives one pressure waveform. It infers sources by correlating partials, onsets, spatial cues, envelopes, and plausible physical behaviors. The "instrument" is reconstructed from evidence distributed across time and frequency.

This suggests a compositional rule: if you want a listener to track a voice through density, give them correlation handles. Shared onset, coherent vibrato, stable formant region, spatial position, register continuity, or rhythmic fingerprint can each act as a filter cue. If you want the voice to dissolve, break those correlations one by one.

Counterpoint can be heard this way too. Traditional independence rules are not only symbolic constraints; they are source-separation aids. Parallel motion, register collision, and synchronized articulation reduce the evidence that two streams are distinct. Contrary motion, staggered rhythm, and timbral contrast increase it. The score is already a source-separation interface.

## Identity Is a Benchmark Assumption

The anomalous sound detection paper makes the hidden assumption explicit. Standard benchmarks often evaluate machine-wise: the system knows which machine produced the recording. In deployment, several machines may operate at once, and a recording may not be reliably attributable to one identity. When the authors merge test recordings and remove machine identity at inference time, performance drops in ways that were invisible under the standard protocol.

That finding matters beyond industrial monitoring. Many musical listening tasks quietly depend on known identity. Detecting a "wrong" note is easier if the instrument is known. Judging an anomalous timbre is easier if the performer, room, tuning, and style are fixed. A jazz saxophone multiphonic, a broken reed, and a spectral processing artifact may occupy nearby acoustic territory but imply different musical meanings because their source identities differ.

So a robust musical system cannot treat sound classification as a flat label problem. It must ask: anomaly relative to which source? Wrong note relative to which tuning? Noise relative to which instrument? Expressive deviation relative to which performer?

This is where machine listening and music theory touch. Functional harmony already works this way. A pitch is not dissonant in the abstract; it is dissonant relative to a key, chord, voice-leading path, register, and expectation. Timbre has the same relational structure. A sound is anomalous only after a source model has been established.

## A Compositional Parameter: Source Certainty

The connection across these papers suggests a practical axis for composition: source certainty.

At one extreme, source identity is maximally clear. A dry solo flute, centered in the mix, with stable articulation and a known register gives the listener a strong object. At the other extreme, source identity collapses into texture: overlapping partials, shared envelopes, reverberant smearing, and ambiguous attacks prevent the ear from deciding what made what.

Between those poles is a rich field. A piece can modulate source certainty the way tonal music modulates key. It can begin with clean isolated objects, let them overlap until their identities become probabilistic, then restore one cue at a time. Or it can invert the path: start from a field and allow a source to crystallize out of it.

The useful controls are concrete:

- **Onset alignment:** synchronized attacks fuse; staggered attacks separate.
- **Spectral continuity:** stable harmonic or formant trajectories preserve identity through masking.
- **Spatial consistency:** fixed location supports source tracking; moving reflections blur ownership.
- **Envelope correlation:** shared amplitude shapes imply one cause; independent envelopes imply multiple causes.
- **Register spacing:** separated bands reduce masking and make concurrent identities easier to maintain.
- **Noise ownership:** breath, bow scrape, room tone, and mechanical noise can either belong to a source or detach from it.

These controls are not effects layered onto composition after the fact. They are structural. They decide whether the listener hears lines, objects, mixtures, or environments.

## The Ear's First Act

The deepest musical implication is that source identity precedes many of the categories we usually treat as primary. Pitch, timbre, gesture, and anomaly are not raw facts. They are measurements made after the auditory system has guessed what sort of thing it is measuring.

This makes source certainty a bridge between acoustics, machine learning, and composition. Dataset curation asks whether a sound is one thing or many. Separation architecture asks when and how to infer independent causes. Robust evaluation asks what breaks when identity is no longer given. Music asks the same question in a more embodied form: what does the listener believe is sounding?

Composition can work directly with that belief. Not just by choosing instruments, but by controlling the evidence from which instrumenthood is inferred.

The source comes before the signal because the signal is never heard alone. It is heard as the trace of a cause. And when the cause becomes uncertain, music enters one of its most fertile regions: the space where sound is not yet an object, not merely texture, but a hypothesis forming in the ear.

---

_Sources: "FSD50K-Solo: Automated Curation of Single-Source Sound Events"; "Asymmetric Encoder-Decoder Based on Time-Frequency Correlation for Speech Separation"; "How Much Does Machine Identity Matter in Anomalous Sound Detection at Test Time?" Connections to: auditory scene analysis, counterpoint as source-separation aid, timbral identity, anomaly as relation, and source certainty as a compositional parameter._
