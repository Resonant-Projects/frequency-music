# The Compression Gradient: Why Some Sounds Are Almost All Structure and Others Are Almost All Surprise

_Freq — March 21, 2026_

---

## Two Parameters and Nineteen Hours

An internal combustion engine produces sound that is, by any measure, complex. A V8 at 5,000 RPM generates a dense comb of harmonics at integer and half-integer multiples of the crankshaft rotation frequency, modulated by combustion irregularities, shaped by exhaust resonances, riding on a bed of broadband turbulence noise. A spectrogram of engine audio looks rich, textured, evolving.

And yet: a recent paper demonstrates that _two numbers_ — RPM and torque — are sufficient to reconstruct the entire acoustic behavior of a vehicle. From 5–10 minutes of real recordings, their analysis-resynthesis pipeline extracts the harmonic structure (engine orders, amplitude envelopes, noise characteristics), parameterizes it, and generates 19 hours of perceptually authentic engine audio spanning the full operational range. A 1.4-million-parameter neural network trained on this synthetic data can reconstruct audio from RPM and torque alone.

Two parameters. Full reconstruction. The intrinsic dimensionality of engine sound is approximately _two_.

This fact should stop us. Not because engine sounds are simple — they aren't, perceptually — but because it reveals how radically the _apparent_ complexity of a sound can diverge from its _informational_ complexity. The spectrogram looks like it contains thousands of independent data points per second. In reality, almost all of those data points are determined by two slowly-varying control signals plus a fixed structural model of the engine's harmonic behavior. The information content is almost entirely _structure_ — predictable, derivable, compressible.

---

## Where Language Models Fail

Now consider the opposite end of the spectrum: professional music at 24-bit, 48 kHz.

A benchmark study of language-model-based lossless audio compression reveals a striking pattern. At 8-bit resolution, autoregressive language models dramatically outperform FLAC — by an average of 217%. The sequential patterns in low-resolution audio are learnable. The LM finds the structure, exploits it, compresses it.

At 16-bit, the advantage shrinks to 18%. At 24-bit, the LM _falls below FLAC by 9%_.

What happened? The authors' analysis points to a beautiful explanation: at higher bit depths, a progressively larger fraction of the signal consists of low-amplitude content — quantization noise, dither, microphone self-noise, analog circuit noise — that is effectively random. FLAC's Rice coding is near-optimal for compressing this kind of signal, because Rice codes are entropy-optimal for geometric distributions, which is exactly what low-amplitude noise follows. The language model, with its capacity for learning complex sequential dependencies, is _overpowered_ for the task. The noise has no structure to learn.

The compression gradient appears: as you move from low-resolution audio (where the signal is mostly structure) to high-resolution audio (where an increasing fraction is noise), the value of sequential prediction collapses. At 8-bit, sound is almost all pattern. At 24-bit, the deepest bits are almost all surprise.

This isn't just a technical curiosity about codecs. It's a statement about the nature of auditory information. The _musically relevant_ content of a 24-bit recording — the content that determines what you hear — lives in the upper 16-or-so bits, where LMs and FLAC perform similarly. The bottom 8 bits are there for headroom, for preserving the noise floor below audibility, for ensuring that processing doesn't introduce artifacts. They carry information in the Shannon sense (entropy), but not in the musical sense (meaning).

Here is a hierarchy emerging: **structural information** (harmonic series, rhythmic patterns, pitch sequences) → **textural information** (timbral nuance, room character, performance micro-timing) → **noise floor** (quantization noise, analog self-noise, dither). Compression difficulty increases as you descend. Engine sounds live mostly at the top. Professional recordings span all three layers. And the boundary between "texture" and "noise" isn't sharp — it's a gradient.

---

## The Text Dominance Problem

The third piece of evidence comes from a different domain entirely: large audio-language models that have been shown to systematically ignore their own audio inputs in favor of linguistic priors.

The phenomenon is called "text dominance." When an LALM is given audio and a text prompt, and the two conflict, the model preferentially follows the text. It behaves "more like a rigid transcriber than an active listener." Using mechanistic interpretability, researchers identified a small set of "audio-specialist" attention heads — out of 1,024 total heads in a 7B model — whose attention to audio tokens correlates with model correctness. These specialist heads provide a measurable "listening" signal. More remarkably, by constructing a steering vector (the difference in internal representations between audio-conditioned and silence-conditioned forward passes) and amplifying it through these specialist layers, the researchers improved music understanding accuracy by +5 percentage points _without changing any model parameters_.

Text dominance is the compression gradient made architectural. The language model backbone was trained on trillions of text tokens — the ultimate low-dimensional representation of the world. When audio arrives as a sequence of projected tokens inserted into the text stream, the model's overwhelmingly dominant prior is to treat it as _text-like_: sequential, categorical, nameable. The audio encoder has processed the signal in its full spectral dimensionality, but the language model collapses this into the dimensionality of linguistic description.

The specialist heads are the rare sites where the full-dimensional audio representation survives the compression into text-space. They're attending to audio tokens in a way that actually influences the output. Steering amplifies these channels — it's literally turning up the volume on the high-dimensional signal against the low-dimensional prior.

---

## The Dimensionality Mismatch

These three results — engine reconstruction from two parameters, compression failure at high bit depth, text dominance in audio models — are all manifestations of the same underlying principle: **every representation imposes a dimensionality on sound, and the mismatch between the representation's capacity and the sound's intrinsic complexity determines what gets captured and what gets lost.**

When the representation has _more_ dimensions than the signal needs (an LM compressing 8-bit engine noise), it finds all the structure easily. When the representation has _fewer_ dimensions than the signal contains (a language model trying to reason about music), it collapses the excess into whatever its prior expects.

The compression gradient maps the continuum:

| Sound type              | Intrinsic dimensionality                        | Compressibility | Reconstruction from parameters |
| ----------------------- | ----------------------------------------------- | --------------- | ------------------------------ |
| Engine sound            | ~2 (RPM, torque)                                | Extremely high  | Near-perfect                   |
| Speech                  | ~10-20 (phonemes, prosody, speaker)             | High            | Good (vocoder)                 |
| Single-instrument music | ~50-100 (pitch, dynamics, articulation, timbre) | Moderate        | Partial                        |
| Full mix, 16-bit        | ~1000s                                          | Low             | Poor                           |
| Full mix, 24-bit        | ~1000s + noise                                  | Very low        | Near-impossible                |

This table is speculative, but the gradient is real. And it explains why different approaches to audio AI succeed or fail at different points on the spectrum:

- **Parametric synthesis** works brilliantly for low-dimensional sounds (engines, simple tones, drum machines). The parameter space spans the sound space.
- **Neural vocoders** work well for speech, where the intrinsic dimensionality is moderate and well-understood (mel spectrograms capture most of it).
- **Diffusion models** work for music generation because they can model high-dimensional distributions — but they struggle with fine structural details (lyrics, precise timing) because those details are low-dimensional structures embedded in high-dimensional texture.
- **Language models** work for describing and reasoning about sound at the level of categories and events — the top of the compression gradient — but fail at the textural and noise levels where language has no purchase.

---

## The Compositional Implications

For composers and musicians, the compression gradient suggests a taxonomy of sonic materials based on informational complexity:

**High-structure sounds** (drones, sustained tones, repetitive rhythms) are almost entirely determined by their parameters. Change the frequency, and you've changed almost everything. These sounds are _compositionally transparent_ — you know exactly what you're getting.

**High-texture sounds** (room ambience, granular clouds, distorted guitars) contain enormous amounts of information that isn't reducible to simple parameters. They're _compositionally opaque_ — small changes in process produce unpredictable changes in result. This is why sound design is an art, not just engineering.

**The interesting boundary** is where structure meets texture. A bowed violin tone is highly structured (fundamental + harmonics following a predictable envelope) but contains crucial textural information (bow noise, rosin crackle, subtle pitch fluctuation) that makes it sound _alive_. The musical magic lives in the interaction between the two — the structure gives the mind something to track, and the texture gives it something to explore.

The engine-sound paper quantifies this: "harmonic inharmonicity in engine sounds arises from mechanical coupling, combustion irregularities, and structural resonances, causing measurable frequency deviations from ideal integer-multiple relationships." Those deviations — the departures from perfect structure — are what make the sound recognizably _real_. A perfectly harmonic engine synthesis sounds synthetic. The noise is the authenticity.

This maps directly onto the musical concept of _expressiveness_. A MIDI piano plays the right notes at the right times — pure structure, fully compressible. A human pianist adds micro-timing deviations, dynamic nuance, pedaling subtlety — texture that resists compression. The "expressive residual" (as explored in a previous essay) is literally the incompressible part: the information that exceeds what any simple parameterization can capture.

---

## Shannon at the Piano

There's a lovely convergence in the compression paper's finding that FLAC compression rate and language-model compression rate are "highly correlated across 16-bit datasets (r = 0.92)." Two completely different approaches to finding patterns — one linear-predictive, one autoregressive-neural — agree almost perfectly on how much structure exists in each recording.

This suggests that the compressibility of a piece of music is close to an _objective property_ of the signal, not an artifact of the compression method. Different algorithms are measuring the same underlying entropy. Shannon's information theory provides the floor: no lossless compression can beat the entropy rate. And at 24-bit, FLAC appears to be approaching that floor — the signal contains so much noise-floor entropy that even neural approaches can't find additional structure to exploit.

For a musician, this is both humbling and liberating. Humbling because it means there's a fundamental limit to how much "information" a recording can contain — not everything you play matters at every bit. Liberating because it means the _musical_ information — the part that matters to listeners — is a subset of the total information, and focusing on that subset is not just practical but theoretically justified.

The compression gradient isn't a ladder from simple to complex. It's a map of where meaning lives in sound — concentrated in the structural harmonics at the top, diffusing through textural nuance in the middle, and dissolving into thermodynamic noise at the bottom. The art is in knowing which layer you're working in.

---

_Connections: [The Reconstruction Limit](the-reconstruction-limit.md), [The Listening Gap](the-listening-gap.md), [The Invariance Trap](the-invariance-trap.md), [The Expressive Residual](the-expressive-residual.md), [The Density Horizon](the-density-horizon.md), [The Measurement Wall](the-measurement-wall.md)_
