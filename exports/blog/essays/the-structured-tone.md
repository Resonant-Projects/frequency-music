---
title: "The Structured Tone"
publishDate: 2026-08-14
excerpt: "Tone is not raw material before structure; pitch strength, inharmonicity, harmonic partials, and vocal plasticity show tonal organization itself can be composed."
category: "interdisciplinary"
tags:
  - "perception"
  - "psychoacoustics"
  - "acoustics"
  - "composition"
  - "signal-processing"
  - "AI-music"
author: "Keith Elliott"
byline: "Freq"
---

## Tone Is A Degree Of Organization

The newest local extraction candidates keep returning to a deceptively simple question: when does a sound become structured enough to behave like a tone?

Not "does it have a fundamental?" Not "can an analyzer assign a pitch?" The more useful musical question is whether the signal contains enough organized spectral evidence for pitch to act as a compositional force.

Four sources circle that question from different sides. The pitch-strength paper names a low-level perceptual parameter that varies within and across popular songs, contributes to small- and large-scale structure, and may make upper harmonics musically audible [S1]. The inharmonicity history paper separates noise-related inharmonicity from inharmonicity produced by interactions among discrete partials, then shows popular music moving through long historical phases of changing noise and inharmonicity [S2]. The harmonic-complex-tone source reports a studio-lab case where monophonic bass-like outputs were heard as carrying multiple simultaneous melodic lines [S3]. The birdsong trajectory-variance paper finds that more developmentally plastic vocalizations tend to be more tonal and spectrally structured, with lower spectral flatness [S4].

Together they suggest a stronger concept than pitch strength alone:

**A structured tone is a sound whose internal organization is strong enough to support musical behavior beyond its nominal pitch.**

## The Partial Can Become A Voice

The harmonic-complex-tone extraction is the most startling because it destabilizes the usual monophonic/polyphonic boundary. If one generated bass-like stream can imply two or more perceived pitch paths, then polyphony is not only a count of sources. It can emerge from how pitch authority is distributed across partials.

This is not magic. A harmonic complex already contains a stack of frequency relations. Usually the ear binds them into one pitch object. But under the right spectral, registral, and contextual conditions, upper components can become audible enough to carry independent melodic implication. The sound remains one source in the production system, yet the listener can hear internal counterpoint.

That gives composers a precise handle: do not add another voice; change whether a partial is allowed to behave like a voice.

## Inharmonicity Is Not One Material

The inharmonicity paper matters here because it refuses to treat all departures from harmonic resonance as equivalent [S2]. Noise-related inharmonicity and discrete-partial inharmonicity are different musical materials.

Noise can weaken pitch authority by smearing periodic evidence. Discrete-partial interactions can do something subtler: they can keep the sound organized while refusing a single clean harmonic explanation. That is exactly the zone where a tone becomes compositionally rich. It can be pitched, but not settled. It can support a bass function while throwing off upper-line suggestions, roughness, shimmer, or spectral argument.

This helps explain why studio-produced popular music can move away from acoustic-resonance constraints without simply becoming "noisier." Multitracking, synthesis, distortion, layering, tuning spread, and production density can increase inharmonic complexity while preserving enough organization for the mix to remain tonal. The studio does not only add effects to notes. It manufactures new degrees of tonal organization.

## Plasticity Prefers Structure

The birdsong result gives the same idea a developmental form. Trajectory variance estimates how much a vocalization would change across age-conditioned latent trajectories, and the reported correlation with lower spectral flatness suggests that more plastic vocalizations tend to have more tonal, structured spectra [S4].

That is a beautiful constraint. Learnability may not belong to the messiest sound. It may belong to sounds that are organized enough to move. A flat, noise-like signal can vary endlessly, but not every variation is a developmental path. A structured tone has handles. It has regularities that can be bent, repeated, exaggerated, and stabilized.

For composition, this suggests that plasticity is not the opposite of identity. The most transformable tone may be the one with enough identity to make transformation legible.

## A Producer-Facing Parameter

Pitch strength already points toward better generative-music controls than text prompts such as "warm," "clear," or "complex" [S1]. But the cross-source connection suggests a broader control:

**structured tone**

A structured-tone control would not merely raise or lower pitch salience. It would expose where tonal organization lives:

1. In the fundamental.
2. In upper harmonics.
3. In discrete inharmonic partials.
4. In noisy but periodic texture.
5. In a developmental or transformational trajectory.

A bass patch could keep the same MIDI note while moving through those states. At one end, it reads as a clear monophonic pitch. In the middle, upper harmonics begin acting like internal voices. Farther along, partial interactions create roughness and density without collapsing into unpitched noise. At the edge, tonal structure becomes a memory the listener has to reconstruct.

That is a real compositional surface. It controls not what note is played, but how much internal evidence the note has, and which part of the spectrum is allowed to carry it.

## A Study

Build a single-note instrument with three linked controls:

1. **Pitch-strength concentration.** Move authority between the fundamental and upper partials.
2. **Inharmonic organization.** Add discrete partial offsets separately from broadband noise.
3. **Trajectory plasticity.** Modulate those parameters along a slow path, then ask whether the listener hears one evolving tone, multiple implied lines, or a texture losing pitch identity.

The useful test is not whether a pitch tracker follows the fundamental. The useful test is whether musicians can use the control to make form: a verse where pitch authority is concentrated, a chorus where it spreads into upper-partial counterpoint, a bridge where inharmonic organization rises without dissolving the tonal center, and a final return where the fundamental is recognizable because the listener remembers it.

The practical insight is simple:

**Tone is not the raw material before structure. Tone is already a structure, and its degree of organization can be composed.**

---

## Sources

[S1] "An introduction to pitch strength in contemporary popular music analysis and production" (`jx74rd69jq2dch62gtx95nwx9h8akvm9`, extraction `j978yxjgnckm2px83ae5dqwgq18ajxwm`).

[S2] "The evolution of inharmonicity and noisiness in contemporary popular music" (`jx715n2xhxt6g1yg9jh0s28hq18akbx7`, extraction `j9762aqawbwmrwvhgfwrns5m398aj4d3`).

[S3] "Musical phrase perception from monophonic harmonic complex tones" (`jx7athsx7pfkmycrmqerst9krx8aj9xa`; local candidate extraction in `data/eval/extractions-candidates.jsonl`).

[S4] "Trajectory Variance: An Unsupervised Measure of Developmental Vocal Plasticity in Birdsong" (`jx7178w3a758g2aj2qcd9f40mn8ahdp7`, extraction `j97ckpqqxzkj19gbw70dkwhk218ahj6w`).
