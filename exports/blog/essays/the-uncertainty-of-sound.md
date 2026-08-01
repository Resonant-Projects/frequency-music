---
title: "The Uncertainty of Sound: Why You Can't Know Both When and What"
publishDate: 2026-03-14
excerpt: "The uncertainty principle constrains music at every level: physics dictates that sharp attacks sacrifice pitch clarity, perception integrates over windows inversely tied to frequency, and…"
category: "physics-of-sound"
tags:
  - "wave-physics"
  - "psychoacoustics"
  - "signal-processing"
  - "perception"
  - "composition"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The Inescapable Tradeoff

In 1927, Werner Heisenberg showed that you cannot simultaneously know a particle's exact position and its exact momentum. The product of the uncertainties has a floor: Δx · Δp ≥ ℏ/2. This is not a measurement limitation — it's a property of reality itself.

In 1946, Dennis Gabor — a physicist and electrical engineer who would later invent holography — proved an analogous result for signals. You cannot simultaneously know the exact time and the exact frequency of a signal event. The product of the uncertainties has a floor:

$$\Delta t \cdot \Delta f \geq \frac{1}{4\pi}$$

This is not a limitation of our measuring instruments. It's a mathematical theorem about the Fourier transform, which relates time-domain and frequency-domain representations of any signal. A signal that is perfectly localized in time (a Dirac delta — an instantaneous click) is perfectly delocalized in frequency (it contains all frequencies equally). A signal that is perfectly localized in frequency (a pure sine wave — a single pitch) is perfectly delocalized in time (it must last forever).

For music, this isn't an arcane technicality. It's the fundamental constraint that shapes every musical sound, every analytical tool, every notational system, and every perceptual judgment a listener makes.

---

## Level 1: The Physics

Sound is pressure variation over time. Pitch is the frequency of that variation. These two descriptions — temporal and spectral — are not independent. They are Fourier duals: each completely determines the other, but they cannot both be made arbitrarily precise simultaneously.

Consider a piano note. The hammer strikes the string, and the string vibrates. The attack — the moment of contact — is a sharp temporal event. It's well-localized in time (you know _when_ the note started to within a few milliseconds) but spectrally broad (the impact contains a burst of many frequencies — the "thunk" of the hammer). The sustain that follows is the opposite: well-localized in frequency (the string settles into its harmonic series, producing a clear pitch) but temporally spread (the tone decays over seconds).

The attack and the sustain live on opposite ends of the uncertainty tradeoff. Every sound you've ever heard is a negotiation between them.

### The Drum Paradox

A snare drum hit is almost purely an attack — a sharp temporal event. Its pitch is ambiguous. You can hear it as "high" or "low" relative to other drums, but you can't sing the note. This is uncertainty in action: high temporal precision (tight, crisp attack) forces low spectral precision (no definite pitch).

A bowed violin note is almost purely sustain. Its pitch is crystal clear — you can tune an orchestra to it. But when exactly did it start? The bow grabs the string gradually, the partials build over tens of milliseconds, and there's no sharp onset. High spectral precision forces low temporal precision.

This explains a deep fact about orchestration: **rhythm instruments and pitch instruments occupy complementary regions of the uncertainty space.** They're not just different timbres — they're differently resolved along a fundamental physical axis. The drum section tells you _when_. The string section tells you _what_. Neither can fully do both.

### Gabor Atoms: The Optimal Compromise

Gabor proved that the minimum-uncertainty signal — the one that achieves Δt · Δf = 1/4π exactly — is a Gaussian-windowed sinusoid:

$$g(t) = e^{-\alpha(t - t_0)^2} \cdot e^{i 2\pi f_0 t}$$

A sine wave at frequency f₀, shaped by a Gaussian envelope centered at time t₀. These "Gabor atoms" are the most efficient possible encoding of a time-frequency event: as localized as the laws of mathematics allow in both dimensions simultaneously.

Gabor atoms look remarkably like musical notes. A note has a pitch (the sinusoidal carrier), an onset time (the envelope center), and a duration (the envelope width) — and these three parameters cannot be independently optimized. Shorten the duration and the pitch becomes less definite. Lengthen it and the onset becomes more ambiguous. The Gabor atom is nature's template for "a musical event."

This isn't a coincidence. Musical notation evolved to represent sound events, and sound events are constrained by the uncertainty principle. The notation converged, over centuries, on a representation that mirrors the physics.

---

## Level 2: The Perception

The human auditory system is an uncertainty-principle engine. The basilar membrane performs a kind of short-time Fourier transform: each position along its length responds to a narrow frequency band, but the temporal resolution at that position is inversely related to its frequency selectivity. Low-frequency regions (the apex) have good frequency resolution but poor time resolution. High-frequency regions (the base) have good time resolution but poor frequency resolution.

This is exactly the uncertainty tradeoff, implemented in flesh and bone.

### The Integration Window

Psychoacoustic experiments reveal that the auditory system integrates information over a window of about 2-50 milliseconds, depending on frequency and task. For pitch perception, the window must be long enough to capture several cycles of the fundamental — roughly 2-3 periods. For a 100 Hz tone, that's 20-30 ms. For a 1000 Hz tone, it's 2-3 ms.

This means **low pitches take longer to perceive than high pitches.** Not because the ear is slow, but because the uncertainty principle requires more time to resolve a lower frequency. A 30 Hz bass note needs at least 66 ms (two full cycles) before the auditory system can assign it a pitch. During those 66 milliseconds, the temporal location of the "note event" is ambiguous.

Composers have intuitively known this forever:

- Bass lines move slowly. Fast bass passages sound muddy — not because of room acoustics (though that contributes), but because the ear literally can't resolve the pitches at tempo.
- High instruments carry the melody. Fast passages work in the upper register because the ear can resolve pitch quickly at high frequencies.
- Drum hits (which need temporal precision) are spectrally broad. Sustained tones (which need spectral precision) sacrifice temporal sharpness.

Orchestration is, in part, the art of navigating the uncertainty surface.

### Critical Bandwidth and Frequency Resolution

The critical bandwidth — the ear's frequency resolution at a given center frequency — is roughly 1/4 to 1/3 of the center frequency for frequencies above 500 Hz, and approximately 100 Hz for frequencies below 500 Hz. This sets a limit on how close two simultaneous pitches can be before the ear fails to resolve them as separate.

But the critical bandwidth is itself an uncertainty-principle phenomenon. The basilar membrane acts as a bank of overlapping bandpass filters. Each filter has a frequency width (the critical bandwidth) and a temporal response (the filter's impulse response duration). These are Fourier duals: narrower bandwidth means longer impulse response. The ear's frequency resolution and its temporal resolution are fundamentally coupled.

This is why roughness (the perceptual signature of two tones within a critical bandwidth) is a temporal phenomenon masquerading as a spectral one. Two tones 30 Hz apart produce beating at 30 Hz. If the critical bandwidth at that frequency is wider than 30 Hz, the ear can't resolve them as separate tones — it hears a single, fluctuating tone. The fluctuation IS the beating, and the beating is the time-domain manifestation of insufficient spectral resolution. The uncertainty principle connects consonance to temporal processing at the most fundamental level.

---

## Level 3: The Analysis

Every tool we use to analyze music faces the uncertainty tradeoff head-on.

### The Spectrogram's Dilemma

A spectrogram is a time-frequency representation: time on the x-axis, frequency on the y-axis, amplitude as color. To compute one, you slice the signal into overlapping windows and take the Fourier transform of each window. The window length is the single most important parameter, and it's an uncertainty tradeoff in pure form:

- **Long window → good frequency resolution, poor time resolution.** You can distinguish close pitches, but rapid events blur together. Useful for analyzing sustained harmonies, useless for tracking drum patterns.
- **Short window → good time resolution, poor frequency resolution.** You can pinpoint when events happen, but nearby pitches merge. Useful for tracking rhythm, useless for analyzing chords.

There is no "right" window length. There is only the tradeoff. A 4096-sample window at 44.1 kHz (93 ms) gives you ~10 Hz frequency resolution — enough to distinguish adjacent piano notes across most of the keyboard — but it smears any event shorter than 93 ms into a blur. A 256-sample window (5.8 ms) gives you ~172 Hz frequency resolution — about three semitones, useless for harmony — but it tracks attacks and transients with precision.

Musicologists and audio engineers spend their careers navigating this tradeoff. The choice of window length is a statement about what you care about: pitch or time. You can't fully have both.

### Wavelets: Adapting to the Tradeoff

The wavelet transform offers a more musical solution. Instead of using a fixed-width window at all frequencies, it uses short windows for high frequencies and long windows for low frequencies. This mirrors the basilar membrane: fine temporal resolution where the ear resolves time well (high frequencies), fine spectral resolution where the ear resolves pitch well (low frequencies).

The constant-Q transform (CQT), widely used in music analysis, is a wavelet transform with geometrically spaced frequency bins — typically one bin per semitone or fraction thereof. Each bin has a bandwidth proportional to its center frequency, matching the logarithmic nature of pitch perception. The CQT respects the uncertainty principle by allocating temporal and spectral resolution in the same proportions the ear uses.

This is why the CQT often produces more musically meaningful spectrograms than the FFT: it's not "better" in any absolute sense — it distributes the inevitable uncertainty in the way that best matches musical structure.

### The Reassigned Spectrogram and Beyond

More sophisticated methods — reassigned spectrograms, synchrosqueezed transforms, superresolution techniques — can sharpen time-frequency representations beyond the nominal uncertainty limit. They do this not by violating the principle, but by using additional information (local phase, spectral derivatives) to improve the _estimate_ of the true time-frequency coordinates of each component. The uncertainty principle still holds for any single observation, but clever algorithms can combine multiple observations to narrow the apparent uncertainty.

This parallels the "super-resolution" techniques in optics that won the 2014 Nobel Prize in Chemistry. The diffraction limit (the spatial analog of Gabor's limit) is not violated — but it can be circumvented by using temporal information (blinking fluorophores, sequential measurements) to achieve effective resolution below the single-measurement limit.

Music analysis tools will continue to improve along these lines. But the fundamental tradeoff — the Gabor limit — remains as a floor, shaping every representation we can build.

---

## Level 4: The Notation

Western musical notation is a time-frequency representation — arguably the oldest one in continuous use. The vertical axis is pitch (frequency). The horizontal axis is time. Note symbols encode both dimensions.

But notation, too, is constrained by the uncertainty principle — not in the physical sense, but in an information-theoretic analog that reveals deep truths about what notation can and cannot represent.

### What Notation Captures Well

Standard notation excels at representing events that are well-localized in both time and frequency — that is, events near the Gabor limit. A quarter note on the treble staff: you know the pitch (the vertical position) and the timing (the horizontal position and the rhythmic value). For events like sustained tones with clear attacks, notation is nearly optimal.

### What Notation Struggles With

- **Unpitched percussion:** High temporal precision, low spectral precision. Notation handles this by abandoning the pitch axis — percussion staves use vertical position to distinguish _instruments_, not frequencies. This is an implicit acknowledgment that drum events live at the time-localized end of the uncertainty space.

- **Spectral music (Grisey, Murail):** These composers work with the harmonic spectrum directly, specifying partial relationships that don't map cleanly onto discrete pitches. Notation struggles because the relevant information is in the spectral domain, at a resolution finer than the chromatic pitch grid. The composers resort to microtonal accidentals, extended techniques, and verbal instructions — patches on a system not designed for the spectral end of the uncertainty axis.

- **Electronic music:** Continuous pitch (glissandi, FM synthesis), granular textures, spectral morphing — all of these are events that don't have well-defined positions in the time-frequency plane. They're extended objects, smeared across both dimensions. DAW piano rolls and spectrograms represent them better than traditional notation, because those representations are designed around the continuous time-frequency plane rather than the discrete pitch-rhythm grid.

- **Timbre:** Notation has almost no way to represent timbre directly. Instrument names and verbal instructions ("con sordino," "sul ponticello") are crude labels for spectral configurations that vary continuously. This is because timbre IS the fine structure of the frequency domain — the relative amplitudes and phases of partials — and notation's pitch axis is too coarse to capture it.

### The Notation Tradeoff

Standard notation discretizes both axes: pitch into semitones (or sometimes quarter-tones), time into metric subdivisions. This quantization is a deliberate sacrifice of precision for readability and practicality. But it means that every notated score is a lossy compression of the underlying sound — and the information lost is governed by the same uncertainty considerations that govern the physics.

Interestingly, the grid spacings chosen by Western notation are well-matched to the ear's resolution. A semitone (100 cents) is roughly the just-noticeable difference for pitch in the middle register. A sixteenth note at moderate tempo (≈50 ms) is close to the ear's temporal integration window. The notation captures approximately as much information as the ear can extract — not by design, but by centuries of convergent evolution toward a representation that mirrors perceptual reality.

---

## Level 5: The Compositional Implications

If the uncertainty principle is a fundamental constraint on sound, it should shape compositional strategy. It does — and recognizing the connection explicitly opens new possibilities.

### Texture as Uncertainty Management

A piece of music is, at any moment, distributing its content across the time-frequency plane. Dense textures — many simultaneous voices, complex harmonies — spread information along the frequency axis, requiring listeners to allocate perceptual resources to spectral resolution. Active textures — rapid passages, intricate rhythms — spread information along the time axis, requiring temporal resolution.

The uncertainty principle means **a listener cannot fully attend to both simultaneously.** Dense AND active textures (e.g., a complex fugue at high speed) push the perceptual system past the uncertainty limit — the listener must choose whether to track the harmonic content or the rhythmic detail, because the auditory system cannot resolve both at the level of precision the music demands.

Great orchestrators manage this instinctively:

- When harmony is complex, rhythm is simple (a dense chorale with block chords)
- When rhythm is complex, harmony is simple (a drum ensemble, or a polyrhythmic passage over a pedal tone)
- Climactic moments often simplify one dimension to amplify the other (a rhythmic unison on a complex chord, or a simple triad after an intricate contrapuntal passage)

This is uncertainty-principle composition: distributing musical information along the tradeoff curve, never exceeding the listener's joint resolution in both dimensions.

### The Transient as Information

From the uncertainty perspective, the attack transient of a note is its most information-rich moment. A sharp onset is temporally precise but spectrally broad — it contains energy across a wide frequency range, packed into a short time. This burst of broadband energy is precisely what the auditory system uses to identify instruments (the "attack signature" is more important than the sustain for timbre recognition), locate sound sources, and segment the auditory scene.

Compositionally, this explains why:

- **Articulation matters more than note choice** in many contexts. Two passages with the same pitches but different articulations (legato vs. staccato) sound vastly different, because the transient content is different.
- **Percussion is rhythmically dominant.** Drums have the sharpest transients — the most temporally precise events — so they anchor the metric grid. You feel the beat from the drums because their temporal precision is unmatched.
- **Removing attacks (like bowing behind the bridge, or using a volume swell) makes sound dreamlike and ambiguous.** Without sharp transients, temporal landmarks disappear, and the music loses its metric grip. This is the uncertainty principle as compositional technique: suppress temporal precision to create spectral (and perceptual) ambiguity.

### Granular Synthesis and the Gabor Limit

Granular synthesis — building sound from thousands of tiny "grains," each a few milliseconds long — is the most direct musical application of Gabor's work. Each grain is approximately a Gabor atom: a short windowed sinusoid (or noise burst) with defined time, frequency, and duration. A granular texture is a cloud of Gabor atoms in the time-frequency plane.

The compositional power of granular synthesis comes from controlling the distribution of grains in the uncertainty space:

- **Dense, overlapping grains with similar frequencies → sustained tone** (high spectral precision, low temporal precision — the grains merge into a continuous pitch)
- **Sparse, scattered grains with varied frequencies → texture** (moderate precision in both dimensions — the ear hears a cloud, not individual events or pitches)
- **Single, isolated grains → clicks** (high temporal precision, low spectral precision — the ear hears rhythm, not pitch)

Granular synthesis makes the uncertainty principle directly compositionally manipulable. The composer moves through the time-frequency tradeoff by adjusting grain density, duration, and frequency spread.

---

## The Deeper Unity

The uncertainty principle connects domains that are usually treated separately:

- **Physics and perception** are linked: the basilar membrane's filter bank implements the same tradeoff that Gabor proved mathematically. Biology evolved to match the physics.
- **Analysis and notation** face the same tradeoff: window length in spectrograms and grid spacing in notation are both choices about where to sit on the uncertainty curve.
- **Composition and orchestration** navigate the tradeoff: texture management, articulation, and instrument choice are all strategies for distributing musical information within the uncertainty constraint.
- **Electronic and acoustic music** differ partly in where they sit: acoustic instruments are constrained to specific regions of the time-frequency plane by their physical construction. Electronic instruments can move freely across the entire plane — which is both their power and their challenge.

The deepest implication is that **music is not fully decomposable into pitch and rhythm.** These are Fourier duals, bound by the uncertainty principle, and treating them as independent dimensions misses the fundamental coupling between them. A note is not "a pitch at a time" — it's a time-frequency event with irreducible joint uncertainty. The pitch IS time (periodic oscillation), and the rhythm IS frequency (rate of onset). They are two faces of the same phenomenon, and the uncertainty principle is the hinge between them.

This is why the deepest musical effects — the chill of a perfectly timed chord, the drive of a groove, the mystery of a timbre — resist analytical decomposition. They are irreducibly joint time-frequency events. To analyze one dimension is to blur the other. The uncertainty of sound is not a limitation to be overcome. It's the space in which music lives.

---

## Bridges

- **"The Interference Pattern"** — Interference is the spatial/spectral face of what uncertainty constrains temporally. Partials that interfere within the critical bandwidth are "unresolved" in exactly the uncertainty sense.
- **"The Instrument as Equation"** — Each instrument occupies a characteristic region of the time-frequency uncertainty space, determined by its physical construction.
- **"The Codec Ear"** — Perceptual coding (MP3, AAC) exploits the uncertainty principle: it allocates bits according to the ear's resolution in different regions of the time-frequency plane.
- **"The Color of Chaos"** — 1/f scaling operates on the uncertainty surface: the power-law correlations span both temporal and spectral domains.
- **"The Entropy Arc"** — Information content per note depends on the precision with which time and frequency are specified. The uncertainty principle sets the maximum information density of any musical signal.
- **"The Groove Equation"** — Micro-timing deviations in groove are temporal perturbations that broaden the spectral content of onsets, adding "spectral color" to rhythm — an uncertainty-principle effect.
- **"The Spectrum as Score"** — Spectral composition (Grisey, Murail) works explicitly with the spectral end of the uncertainty tradeoff, accepting temporal ambiguity in exchange for spectral precision.

---

_The uncertainty of sound is not a limitation — it's a creative space. Every note is a bet about how to distribute finite precision between when and what. The art is in choosing wisely._
