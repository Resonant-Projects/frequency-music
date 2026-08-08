---
title: "The Plastic Tone"
publishDate: 2026-08-08
excerpt: "Pitch is not fixed: spectral structure, inharmonicity, learning, and listening can reshape a tone’s authority. Explore composition through tones that transform without losing identity."
category: "perception"
tags:
  - "perception"
  - "psychoacoustics"
  - "acoustics"
  - "composition"
  - "signal-processing"
author: "Keith Elliott"
byline: "Freq"
---

## Tone Is Not A Given

Several recent extractions point to the same quiet correction: tonality is not simply present or absent in a sound. It can be strengthened, weakened, learned, masked, split across harmonics, or made more plastic by the developmental path that produced it.

The pitch-strength source gives the most direct name for this. It treats pitch strength as a low-level perceptual parameter in contemporary popular music: not the note itself, but how strongly a note declares itself as a pitch. The inharmonicity source adds historical pressure. Since the studio era, popular music has been less bound to acoustic-resonance instruments, and its spectra can carry inharmonicity from noise or from interactions among discrete partials. The birdsong source moves the question into development: more plastic vocalizations in zebra finches tend to be more tonal and spectrally structured, with lower spectral flatness. The harmonic-complex-tone source adds the perceptual surprise: a monophonic bass-like tone can be used to communicate multiple perceived pitches when upper harmonics become musically active.

Put together, these sources suggest a useful compositional concept: a tone is not a point. It is a negotiable relation among salience, spectrum, learning, and listening.

## Pitch Strength Is A Handle

Pitch strength is valuable because it separates pitch height from pitch authority. Two sounds can share a fundamental frequency while differing sharply in how confidently they read as pitched. One may behave like a note; the other may behave like a color, a pressure, or a noisy trace with only partial pitch evidence.

This matters for AI music systems because text prompts usually operate too high above the studio surface. "Make it darker" or "add tension" may work as a vague semantic wish, but a producer often wants a lower-level handle: make the bass less pitch-certain without losing its register, make the pad's upper partials declare the harmony more clearly, make the chorus feel more anchored by increasing the pitch strength of one layer while leaving loudness almost unchanged.

Pitch strength is therefore a control parameter for identity. It says how much of the sound should be allowed to count as a tone.

## Inharmonicity Has Kinds

The popular-music inharmonicity extraction is especially useful because it distinguishes noise-related inharmonicity from inharmonicity produced by interactions among discrete partials. That distinction is compositional gold. Noise blurs pitch evidence by filling the spectrum. Discrete partial interactions can create roughness, fused tone color, beating, or secondary pitch implications while still leaving the ear with structured material to organize.

Studio production lives in that difference. Distortion, multitracking, saturation, sampling, close miking, and layered synthesis can all increase inharmonic complexity, but they do not all do the same perceptual work. A noisy cymbal wash, a detuned stacked vocal, and a saturated bass are not three versions of "more spectrum." They are three different negotiations over whether pitch should remain a stable center, become a contested center, or dissolve into texture.

The historical claim is also musically suggestive: recent popular music may remain more inharmonic than 1960s popular music or orchestral music, while becoming less noisy. That describes a modern studio aesthetic where sound can be spectrally complex without surrendering clarity. The tone has become more engineered, not simply less pure.

## Plasticity Leaves A Spectrum

The birdsong extraction adds a developmental axis. Trajectory variance estimates how much a vocalization would change across age-conditioned positions in latent space. More plastic vocalizations tend to have lower spectral flatness: they are more tonal and structured.

That is a beautiful inversion of a common assumption. We might expect plasticity to sound unstable, noisy, or underformed. Here, at least in the reported zebra-finch data, the sounds most open to developmental change are also the ones with stronger tonal structure. Structure is not the opposite of change. It may be the scaffold that change can act on.

For composition, that suggests a way to write "learning" into sound. Do not make developmental transformation a drift from chaos to order only. Instead, let tonal structure become the material that is most capable of transformation. A noisy layer can remain relatively inert while a pitched layer mutates through register, contour, spectral emphasis, and articulation. The most learnable voice may be the clearest one.

## One Tone, Several Lines

The harmonic-complex-tone extraction completes the circle. If a monophonic bass-like sound can imply multiple perceived pitches through its upper harmonics, then pitch strength is not confined to the fundamental. A single tone can contain a small polyphony of saliences.

This is not the same as writing a chord. The sound remains one source at the waveform or instrument level, while the listener may hear more than one melodic implication. That makes it a hinge between timbre and counterpoint. Instead of adding voices, a composer can redistribute attention among partials until one tone carries several possible lines.

Now the practical question becomes: which partial gets authority, and when? A bass note can begin as a stable root, then reveal a fifth-like or third-like upper region, then dissolve into inharmonic color. The line has not moved in the ordinary pitch-symbol sense, but the perceived center of tonal evidence has migrated.

## A Study

Build a short piece around one sustained or repeated low-register tone.

First, make a clean version with high pitch strength and low spectral flatness. Then create three transformations:

1. Increase noise-related inharmonicity while preserving the perceived fundamental.
2. Increase discrete-partial inharmonicity so upper components start to imply secondary pitches.
3. Keep the sound tonal but move its spectral emphasis over time, as if the tone were learning what kind of voice it wants to become.

The form should not ask "is this pitched?" It should ask "where is pitch authority located now?" Sometimes it belongs to the fundamental. Sometimes to an upper harmonic. Sometimes to a noisy envelope that still remembers the note. Sometimes to the listener's effort to hold the identity together.

## The Compositional Claim

The plastic tone is a tone whose pitch identity can be acted on without being destroyed.

That gives a useful bridge between music theory, production, and machine listening. Traditional theory names pitch classes and intervals. Production shapes spectral evidence and perceptual salience. Representation learning asks which features remain recoverable under transformation. Developmental vocal analysis asks which sounds can change over time while remaining meaningfully themselves.

The shared question is not whether the tone is pure. Purity is too static. The better question is: what transformations can this tone survive, and what does it become more capable of expressing because it is not perfectly pure?

---

_Sources: recent extractions on pitch strength in contemporary popular music (`j978yxjgnckm2px83ae5dqwgq18ajxwm`), the evolution of inharmonicity and noisiness in popular music (`j9762aqawbwmrwvhgfwrns5m398aj4d3`), trajectory variance and developmental vocal plasticity in birdsong (`j97ckpqqxzkj19gbw70dkwhk218ahj6w`), and harmonic-complex-tone perception in AI-generated bass material. Connects to: [The Resolution Grid](/docs/essays/the-resolution-grid.md), [The Small Descriptor Becomes The Instrument](/docs/essays/the-small-descriptor-becomes-the-instrument.md), [The Identity Under The Note](/docs/essays/the-identity-under-the-note.md), and [Everything Is A Resonant Body](/docs/essays/everything-is-a-resonant-body.md)._
