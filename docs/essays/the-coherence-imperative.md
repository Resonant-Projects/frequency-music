# The Coherence Imperative: Why Sound Resists Being Divided

_Freq — March 17, 2026_

---

## The Atomist's Temptation

The spectrogram is a grid. Time on one axis, frequency on the other, energy at every intersection. It looks like a spreadsheet — and spreadsheets invite you to treat each cell independently. Process this bin. Mask that bin. Make a decision here, another decision there. Each time-frequency pixel is a tiny, self-contained universe.

This is the atomist's temptation: the assumption that because a representation is _discrete_, its elements are _independent_. It's wrong, and three recent papers from different subfields of audio processing have all rediscovered why — each from a different angle, each arriving at the same conclusion.

---

## Three Failures of Independence

### The Dereverberation Problem

When sound bounces off walls before reaching a microphone, the recorded signal is a convolution of the original sound with the room's impulse response. Dereverberation — recovering the original from the reverberant recording — is an old and difficult problem.

IF-CorrNet approaches this by recognizing something that bin-independent methods miss: reverberation creates _correlations between adjacent STFT frames_. A reverberant signal literally copies spectral content from one time frame into the next, creating inter-frame dependencies that are the fingerprint of the room. Instead of fighting these correlations, IF-CorrNet estimates them directly and uses them as the basis for filter design.

The insight: reverberation is a _temporal coherence_ phenomenon. Methods that process each time frame independently are blind to the very structure they need to remove.

### The Beamforming Problem

When multiple microphones capture a sound scene with more sources than microphones (the "underdetermined" case), beamforming tries to steer spatial filters to isolate a target source. The standard approach combines beamformer outputs with weights that can vary across the time-frequency grid.

NN-TFLC reveals the cost of this freedom. When combination weights are chosen independently for each time-frequency bin, the extracted signal develops discontinuities — sudden jumps in the spectral envelope, temporal artifacts, loss of the smooth evolution that makes a voice sound like a voice or a violin like a violin. The paper's solution is a cross-attention mechanism that enforces _temporal-spectral coherence_ in the combination weights, ensuring that adjacent bins make consistent decisions.

The insight: source identity is a _coherence_ property. A sound source isn't defined by what's happening at any single time-frequency point — it's defined by how energy evolves smoothly across time and frequency simultaneously. Break that smoothness and you break the source.

### The Room Completion Problem

Room impulse responses (RIRs) have two parts: early reflections (discrete echoes off nearby surfaces) and late reverberation (the dense, diffuse tail). Simulating early reflections geometrically is tractable. Simulating the late tail — with its million overlapping paths — is expensive.

A diffusion-model approach to RIR completion generates the late reverberation conditioned on the early reflections, essentially asking: "Given these first echoes, what does the rest of the room sound like?" This works because early and late portions aren't independent. The room's geometry constrains both. The energy decay curve, the frequency-dependent absorption, the density of reflections — these are global properties that thread through the entire impulse response.

The insight: a room is a _coherent physical system_. Its acoustic signature can't be generated bin by bin or echo by echo. It has to be generated as a whole, because the physics that shapes the early part also shapes the late part.

---

## The Pattern

Each of these problems looks different on the surface — removing room effects, isolating sources, generating acoustic environments. But they share a deep structure:

1. **A time-frequency representation is computed** (STFT in all three cases).
2. **An independent-bin approach is attempted** (or is the natural baseline).
3. **The approach fails because it destroys coherence** — the smooth, structured dependencies across time, frequency, or both that carry the signal's meaning.
4. **The fix is to model coherence explicitly** — through correlation estimation, cross-attention, or global generative conditioning.

This isn't a coincidence. It's a consequence of what sound _is_.

---

## Why Sound Demands Coherence

A musical note isn't a collection of independent frequency bins that happen to be active simultaneously. It's a _coherent excitation_ — a vibrating string, a column of resonating air, a membrane in oscillation — that produces a family of harmonics locked in precise frequency ratios and phase relationships. These harmonics rise together, decay together, and fluctuate together. Their coherence is what makes them perceptually fuse into a single auditory object rather than a pile of unrelated whistles.

The auditory system knows this. Bregman's auditory scene analysis framework identifies _common fate_ — correlated change across frequency components — as one of the primary cues for grouping sounds into perceptual streams. Components that onset together, modulate together, and offset together are heard as one source. Components that evolve independently are heard as separate sources.

This means coherence isn't a nice-to-have property that we can approximate with post-processing. It's the _definition of the signal_. When an algorithm breaks coherence — by making independent decisions at each time-frequency bin — it isn't just introducing artifacts. It's destroying the very thing that made the input intelligible.

The Fourier transform decomposes a signal into independent sinusoidal components. This is mathematically exact and invertible. But the independence is a property of the _representation_, not the _signal_. The original signal is rich with dependencies — harmonics that are integer multiples of a fundamental, formants that track smoothly with articulation, amplitude envelopes that reflect physical excitation and decay. The transform reveals these dependencies as patterns across bins, but it doesn't enforce them. Any algorithm that operates on bins independently has to rediscover the dependencies from scratch — and most can't.

---

## Implications for Music

If coherence is the signal, then every tool in the musical signal processing chain is a potential coherence destroyer. Consider:

**Spectral processing.** Equalization, noise gating, spectral subtraction — all operate on magnitude bins independently or in broad bands. They can suppress frequencies, but they can't know whether two bins are part of the same harmonic series. Aggressive spectral processing sounds "phasey" or "watery" precisely because it disrupts the coherence between related components.

**Source separation.** Current systems use masks in the time-frequency domain — a soft binary decision at each bin about which source it belongs to. The NN-TFLC paper shows that even when these masks are accurate in isolation, the lack of temporal-spectral consistency produces audible artifacts. This is why source separation of music still sounds slightly wrong even when it's technically impressive.

**Reverberation and spatialization.** Adding artificial reverb means convolving with an impulse response, which preserves coherence (convolution is a linear operation). But _removing_ reverb, or _modifying_ a room's character, requires untangling the convolution — a fundamentally harder problem because you need to know which aspects of the signal's coherence come from the source and which come from the room.

**Compression.** Audio codecs like MP3 and Opus make independent bit-allocation decisions across frequency bands. The auditory masking models they use are sophisticated, but they're essentially independent-bin models of perception. This is why heavily compressed audio sounds "small" or "flat" — not because any individual frequency is wrong, but because the fine-grained coherence between frequencies has been quantized away.

---

## The Deeper Lesson

There's a philosophical resonance here that goes beyond signal processing. The atomist's temptation — the belief that understanding the parts is sufficient to understand the whole — is one of the oldest intellectual traps. In audio, the Fourier transform makes it technically rigorous: the whole _is_ the sum of its parts, mathematically. But the _meaning_ of the whole lives in the relationships between parts, not in the parts themselves.

Music theory has always known this at the level of notes. A chord isn't three independent pitches — it's the _relationship_ between them that defines its quality. A melody isn't a sequence of independent frequencies — it's the contour, the intervals, the rhythmic grouping. No musician would analyze a piece by examining each note in isolation.

What these papers show is that the same principle operates at a much lower level — not at the level of notes, but at the level of the spectral components _within_ a single note, _within_ a single moment. Coherence isn't just a high-level musical concept. It's a physical property of sound that propagates all the way down to the individual bins of a Fourier transform.

The coherence imperative, then, is this: any system that processes, generates, or analyzes sound must respect the relationships between time-frequency components, or it will produce results that sound wrong in ways that are easy to hear but hard to diagnose. The grid of the spectrogram is a useful fiction. Sound doesn't live in the cells. It lives in the connections.

---

_Connects to: [The Ghost in the Spectrum](the-ghost-in-the-spectrum.md) (phase as invisible architecture), [The Uncertainty of Sound](the-uncertainty-of-sound.md) (time-frequency tradeoffs), [The Measurement Wall](the-measurement-wall.md) (limits of objective metrics), [The Polyphony Problem](the-polyphony-problem.md) (separating sources)_
