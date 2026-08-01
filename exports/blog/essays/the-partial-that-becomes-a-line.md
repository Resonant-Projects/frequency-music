---
title: "The Partial That Becomes a Line"
publishDate: 2026-07-15
excerpt: "Produced pitch becomes composable when pitch strength, upper-partial salience, and inharmonicity are treated as controls over whether one sound behaves as a note, timbre, or hidden counterpoint."
category: "interdisciplinary"
tags:
  - "composition"
  - "psychoacoustics"
  - "signal-processing"
  - "AI-music"
  - "acoustics"
  - "music-production"
author: "Keith Elliott"
byline: "Freq"
---

## Pitch Is Not Only a Note

Three recent extracts converge on a useful compositional problem: pitch can be present without behaving like a note.

The pitch-strength source names the first layer. It treats pitch strength as a low-level perceptual parameter that varies within and across contemporary popular songs, contributes to form, helps manage polyphonic dissonance, and may involve upper harmonics becoming audible under conditions of perceptual richness [S1]. That is not the same as saying "this track has these notes." It says that the degree of pitch-salience itself can be shaped.

The harmonic-complex-tone source gives a more surprising version. In a studio-lab experiment with generative music AI, producers reportedly used bass-like monophonic harmonic complex tones to convey two or more pitches at once [S2]. A single tone became a carrier for simultaneous melodic implication. If the observation holds under controlled listening, then a partial is not merely color on a fundamental. Under the right register, spectrum, envelope, and musical context, it can become a line.

The inharmonicity source widens the historical frame. It argues that popular music since 1961 can be divided into phases of changing inharmonicity and noise, with contemporary popular music remaining more inharmonic than 1960s popular music or orchestral music even as noise has decreased [S3]. Studio production did not simply decorate harmonic sound. It shifted the operating conditions under which pitch, noise, and partial interaction are perceived.

The connection is small but sharp: modern production may have made pitch less like a discrete symbolic object and more like an adjustable spectral contract between harmonicity, salience, and ambiguity.

## The Studio As A Pitch-Strength Instrument

Traditional harmony assumes a relatively stable mapping between sounding body and pitch object. A string, pipe, voice, or resonant chamber produces something close enough to a harmonic spectrum that the listener can collapse it into a pitch. The partials support the note.

Studio sound complicates that collapse. Multitracking, saturation, synthesis, sampling, pitch correction, compression, chorus, resampling, and layered bass design can all increase the amount of spectral information competing around the pitch center. The inharmonicity paper's distinction between noise-related inharmonicity and discrete-partial inharmonicity is important here [S3]. Noise muddies pitch by filling space. Discrete partial interactions can do something more interesting: they can make several pitch candidates live inside one sound.

Pitch strength then becomes a control surface. A producer can decide how strongly a sound should ask to be heard as one note, how much of its upper spectrum should remain individually audible, and how much ambiguity the harmonic field can tolerate before it stops feeling intentional.

This suggests a practical axis:

- high pitch strength, low ambiguity: the sound behaves like a clear note;
- high pitch strength, high ambiguity: the sound behaves like a chord squeezed into a tone;
- low pitch strength, low ambiguity: the sound behaves like tonal atmosphere;
- low pitch strength, high ambiguity: the sound behaves like spectral weather.

The generative bass observation sits in the second quadrant. The tone remains pitch-bearing, but it carries more than one implied pitch trajectory [S2]. That is a beautiful compositional target because it gives monophony a hidden polyphonic interior.

## Upper Harmonics As Voice-Leading

If upper harmonics can become audible as pitch-bearing elements, then voice-leading does not have to occur only between fundamentals. It can occur between salient partials.

A bass line can therefore be written in two layers. The first layer is ordinary: the fundamental moves through roots or scale degrees. The second layer is spectral: chosen upper partials trace a counterline by becoming more or less audible across the phrase. The listener may not label the second layer as melody, but the ear can still use it to explain tension, brightness, and dissonance.

This makes the "single tone with two or more pitches" less mysterious. It may not require the listener to hear a clean chord in the usual sense. It may require the production context to increase the effective pitch strength of particular partials until they participate in melodic inference.

The compositional rule is:

**Do not only ask what pitch a sound has. Ask which of its partials are allowed to act.**

That question connects directly to AI music controls. A text prompt such as "warm bass" or "tense bass" is too coarse. A useful production model should expose controls for pitch strength, partial salience, harmonic fusion, inharmonic spread, and noise floor. Those are the handles that let the musician decide whether a sound is a note, a timbre, a hidden dyad, or a small spectral ensemble.

## A Study: Monophonic Counterpoint Inside One Bass

Build a short bass study with one sounding voice and two perceived lines.

Start with a low fundamental pattern at a moderate tempo. Keep the rhythm simple enough that spectral motion can be heard. Use additive synthesis, FM, wavetable editing, or resonant filtering to emphasize two upper partial regions. Treat one partial region as a stable anchor and the other as a moving counterline.

Then render four versions:

1. **Clear Note** - strong fundamental, harmonic partials balanced, little inharmonicity.
2. **Hidden Dyad** - preserve the fundamental but lift one upper partial path until it suggests a second pitch.
3. **Inharmonic Line** - detune selected partials enough that they separate from the harmonic series without dissolving into noise.
4. **Noisy Mask** - add broadband or textured noise until the second line loses pitch strength.

Listen for when the second pitch becomes musically usable. The threshold matters more than the effect. Below it, the partial is color. Above it, the partial becomes counterpoint. Beyond it, the sound may split, roughen, or lose the bass identity.

That threshold is a compositional material.

## The Deeper Claim

These sources point toward a broader theory of produced pitch. Acoustic resonance gives us spectra that usually agree with a fundamental. Studio production gives us spectra whose agreement can be negotiated. Generative models add a new pressure: they can accidentally discover pitch-bearing configurations that producers recognize before theorists have named the control.

So the next useful object is not simply a better pitch detector. It is a **pitch-agency map**: a way to show which parts of a spectrum are acting as stable note evidence, which are acting as independent melodic candidates, which are acting as roughness or dissonance, and which are acting as noise.

For a composer, that map would answer a living question:

Where, inside this one sound, are the other lines hiding?

---

## Sources

[S1] "An introduction to pitch strength in contemporary popular music analysis and production" - arXiv:2506.07473v5.

[S2] "Insights on Harmonic Tones from a Generative Music Experiment" - arXiv:2506.07073v2.

[S3] "The evolution of inharmonicity and noisiness in contemporary popular music" - arXiv:2408.08127v3.
