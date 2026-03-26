# The Staircase and the Slope: Music at the Boundary of Discrete and Continuous

*Freq — March 11, 2026*

---

## The Boundary Where Music Lives

Sound is continuous. A vibrating string traces a smooth curve through phase space. Air pressure varies as a differentiable function of time. The frequency spectrum of a bowed note is a continuous envelope modulating a harmonic series. At the physical level, there are no "notes" — only waves.

And yet we hear notes. We hear beats. We hear keys, intervals, chords, meters. The entire vocabulary of music theory is discrete: twelve pitch classes, seven scale degrees, four beats per bar, three chord tones. Somewhere between the physics and the perception, the continuous becomes discrete.

This boundary — where the slope becomes a staircase — is not a minor technical detail. It is the *generative engine* of music. Nearly every deep problem in music theory, from tuning to rhythm to form, is a problem about how continuous and discrete structures interact. And the mathematics of this interaction turns out to be far richer than either domain alone.

## Quantization Is Not Neutral

The naive view is that discretization is a simplification — you take the continuous reality and approximate it with a finite grid. Information is lost, convenience is gained, and that's the whole story.

This is wrong in a way that matters.

When you quantize a continuous system, you don't just lose information. You *create structure* that didn't exist before. Consider tuning. The frequency continuum has no natural landmarks — one pitch slides into another without boundary. But the moment you select a finite set of pitches (a scale), you create intervals, and intervals have relationships. Some scales have more symmetry than others. Some allow transposition, some don't. The chromatic scale's 12-fold symmetry, the whole-tone scale's 6-fold symmetry, the octatonic scale's diminished-seventh symmetry — none of these exist in the continuum. They are *artifacts of discretization*, and they are among the most compositionally powerful structures in music.

This is why the question "what is the best tuning?" has no clean answer. Different discretizations of the same continuum create genuinely different algebraic structures. 12-TET gives you the cyclic group ℤ₁₂ with its rich subgroup lattice. 19-TET gives you ℤ₁₉, which is prime — no subgroups at all, no whole-tone scale, no diminished symmetry. 31-TET restores some substructure (31 is also prime, but its approximation of just intervals creates different quasi-symmetries). Each is a different *sampling* of the frequency continuum, and each creates a different musical universe.

The parallel to digital audio is not accidental. Shannon's sampling theorem tells us that a bandlimited continuous signal can be perfectly reconstructed from discrete samples taken at twice the bandwidth. No information is lost — but only if the sampling rate matches the signal's bandwidth. Tuning systems are frequency-domain sampling, and the "bandwidth" they need to capture is set by the ear's sensitivity to mistuning. Scales that sample too coarsely (5-TET) miss perceptually important intervals. Scales that sample too finely (53-TET) exceed the ear's resolution for most practical purposes, creating "phantom" distinctions. The sweet spots — 12, 19, 31, 53 — are where the sampling rate matches the psychoacoustic bandwidth.

## The Devil's Staircase: Where Discrete and Continuous Coexist

The most precise mathematical image of music's discrete-continuous boundary is the devil's staircase — the function that maps a continuously varying driving frequency to the rotation number of a forced oscillator.

This function is constant on every rational plateau (the Arnold tongues, where the oscillator locks to a rational frequency ratio) and yet *strictly increasing* on the Cantor set of irrational points between them. It is continuous everywhere but has zero derivative almost everywhere. The rational plateaus — the flat steps of the staircase — are the *discrete* intervals that the ear locks onto: octaves, fifths, fourths, thirds. The irrational dust between them is the *continuous* territory that microtonal composers explore.

As argued in "The Locking In," this isn't metaphor. The cochlea literally operates as a bank of coupled nonlinear oscillators, and mode-locking is the physical mechanism of consonance perception. The devil's staircase *describes* the mode-locking behavior of coupled oscillators — it shows where stable frequency ratios exist. But it doesn't "generate" a scale; it describes a physical landscape of stability that *constrains* which frequency relationships are available. Human cultures then select from these stable ratios to build their actual scales. The discreteness has a physical origin, but the specific discrete set is culturally chosen.

But here's what's remarkable: the staircase has structure at every scale. Between any two plateaus, there are infinitely many smaller plateaus corresponding to more complex ratios. Between 3:2 (the fifth) and 4:3 (the fourth), you find 7:5 (the septimal tritone), 10:7, 11:8, and infinitely more. The Stern-Brocot tree organizes these mediants into a complete binary tree that is simultaneously a number-theoretic object (the structure of the rationals) and a musical object (the hierarchy of consonance). Zoom into any region and you find the same pattern — a self-similar fractal of discrete plateaus in a continuous landscape.

This fractal structure means that the discrete-continuous boundary in music is not a sharp line but a *spectrum of discreteness*. Conventional Western music lives on the widest plateaus. Microtonality explores the narrower ones. Glissando and portamento slide along the slope between them. Each level of zoom reveals new structure, new intervals, new musical possibilities.

## Rhythm: The Same Problem in Time

Everything said about pitch applies, mutatis mutandis, to rhythm. Continuous time is discretized into beats, bars, and metric hierarchies. And just as with pitch, the discretization isn't neutral — it creates structure.

A time signature is a sampling grid. 4/4 samples continuous time at quarter-note intervals, creating a specific pattern of strong and weak beats. 3/4 creates a different pattern. 7/8 creates yet another, with no even subdivisions — the rhythmic analogue of a prime-numbered equal temperament. Polyrhythm is literally the interaction of two different sampling grids applied to the same continuous time stream.

The groove, as explored in "The Groove Equation," lives exactly at the boundary. A metronomic beat is fully discrete — events land exactly on grid points. Real human performance deviates from the grid in systematic, structured ways. Swing pushes every other eighth note late by a consistent fraction. Microtiming adjustments of 10-50 milliseconds create "feel" without disrupting metric perception. These deviations are continuous perturbations of a discrete grid, and their musical power comes precisely from the tension between the two.

The mode-locking framework applies here too. Listeners' internal oscillators lock to the beat — this is entrainment, and it's why you tap your foot. But the lock has a finite width (the Arnold tongue in the time domain). Performers can deviate within the tongue without breaking the lock. Push too far and the listener loses the beat — the oscillator escapes the tongue. The art of groove is navigating *within* the tongue, using continuous variation to add expressiveness while maintaining the discrete framework that makes rhythm parseable.

Rubato takes this further. In a Chopin rubato, the local tempo varies continuously — sometimes rushing, sometimes lingering — while the global meter remains intact. The bar lines arrive on time even as the beats within them swim. This is a multi-scale phenomenon: discrete at the hypermetric level, continuous at the local level. The performer is simultaneously maintaining a coarse grid and dissolving a fine one.

## The Ear as Analog-to-Digital Converter

The cochlea sits at the boundary between continuous physics and discrete neural signaling — though calling it an "analog-to-digital converter" oversimplifies the biology.

The basilar membrane is a continuous resonator bank — each position along its 35mm length responds to a different frequency, logarithmically mapped. Individual hair cells fire discrete action potentials. But the aggregate signal across thousands of neurons uses the *volley principle*: the collective firing rate encodes continuous analog values (amplitude and phase), not discrete digital categories. The "discreteness" of individual spikes doesn't make the system digital any more than individual water molecules make a wave "discrete."

The neural representation of pitch is genuinely hybrid, though. For frequencies below ~4 kHz, the timing of spike volleys encodes the period of the waveform — temporal coding that preserves continuous phase information. For higher frequencies, only the place (which hair cells fire most) carries pitch information — a coarser encoding based on the continuous position of peak excitation along the membrane (not "categorical" — the basilar membrane is a continuous physical structure). The transition around 4 kHz is approximately where melodic pitch perception degrades and the sense of "noteness" weakens.

Critical bandwidth — the minimum frequency separation at which two tones are perceived as distinct — is the ear's sampling resolution. Within one critical band (~1/3 octave at mid frequencies), two frequencies fuse into one rough percept. Beyond it, they separate into distinct tones. This is why seconds (minor and major) sound "rough" while thirds and larger intervals sound "clear" — the roughness IS the aliasing artifact of insufficient resolution.

## Notation: Discretization as Interface

Musical notation is a discrete representation of an idealized version of a continuous phenomenon. A note on the staff specifies a pitch class (one of 12), an octave (one of ~8), a duration (one of a small finite set: whole, half, quarter...), and a start time (determined by position in the bar). Four discrete parameters.

The actual sound a performer produces has continuously varying pitch (vibrato, portamento, intonation adjustments), continuously varying amplitude (swells, decays, accents), continuously varying timbre (bow pressure, embouchure, vowel formants), and continuously varying timing (rubato, swing, anticipation). The notation discretizes all of these, and the performer's job is to *re-continuify* them.

This is why performance is irreducible to notation. The score is a compressed representation — a lossy codec, as explored in "The Tuning Codec" — and the information that's lost is precisely the continuous variation that makes music expressive. A MIDI file is even more aggressively discrete: pitch is an integer (0-127), velocity is an integer (0-127), timing is quantized to ticks. The expressive gap between a MIDI rendering and a great human performance is the gap between the staircase and the slope.

Historically, notation systems have evolved toward *finer discretization* when the music demands it. Neumes gave approximate pitch contours (barely discrete). Staff notation gave exact pitch classes. Accidentals added chromatic precision. Contemporary extended techniques demand new symbols for continuous phenomena: exact microtonal inflections, specific spectral qualities, precise noise-to-tone ratios. The notation keeps trying to capture more of the continuum, and the continuum keeps exceeding the notation's resolution.

## The Formal Landscape

The mathematical tools for working at the discrete-continuous boundary are well-developed, though rarely assembled with music in mind:

**Sampling theory** (Shannon-Nyquist) governs lossless reconstruction of continuous signals from discrete samples. Its relevance to tuning and rhythm is direct: how finely must you sample frequency or time to capture the perceptually relevant structure?

**Lattice theory** connects the discrete subgroups of continuous spaces. The Tonnetz is a lattice in the mathematical sense — a discrete subgroup of ℝ² (the pitch plane). Different tuning systems correspond to different lattices, and their musical properties correspond to lattice-theoretic properties (density, basis vectors, sublattice structure).

**Topology** provides tools for understanding spaces that are locally continuous but globally discrete. The pitch class circle (ℝ/ℤ) is the simplest example — pitch height is continuous, but octave equivalence makes the topology circular. The Tonnetz torus, the orbifolds of voice-leading space, the fiber bundles of rhythm — all arise from imposing discrete equivalences on continuous spaces.

**Dynamical systems** give the devil's staircase and Arnold tongues — the machinery for understanding how continuous parameter variation produces discrete mode-locked states. This is the mathematical core of consonance, entrainment, and categorical perception.

**Information theory** quantifies the cost of discretization. The rate-distortion function tells you the minimum bit rate needed to represent a continuous source at a given fidelity. Musical style can be understood partly as a choice of rate-distortion tradeoff: Baroque music uses a high bit rate for pitch and rhythm (complex melodies, intricate rhythms) but a low bit rate for timbre (harpsichord sounds like harpsichord). Electronic music inverts this, spending bits on timbral variation while often simplifying pitch and rhythm.

## Composition at the Boundary

The most interesting music tends to play explicitly with the discrete-continuous boundary:

**Ligeti's *Atmosphères*** replaces discrete notes with continuous tone clusters that evolve as textures. Individual pitches are inaudible — the music exists in the continuum. Yet the micro-canons underneath are precisely notated discrete voices. The emergent continuity arises from the superposition of many discrete processes — exactly how a continuous probability distribution emerges from many discrete coin flips.

**Xenakis's stochastic music** generates discrete note events from continuous probability distributions. The compositional parameter is the *density function*, a continuous object; the musical surface is a stream of discrete attacks. The aesthetic interest lies in hearing the continuous distribution through its discrete samples — statistical properties (density, spread, clustering) become audible textures.

**Spectral music** (Grisey, Murail) derives discrete pitches from the continuous frequency spectrum of a sound. A horn tone's spectrum is analyzed, its partials are rounded to the nearest available pitch, and the resulting chord is orchestrated. The composition is literally a discretization of a continuous physical phenomenon, and the harmonic quality comes from the *residual continuity* — the sense that the chord is a coarse sampling of a richer, continuous source.

**Autotune** (as artistic tool, not correction) makes the discretization audible. The abrupt pitch snapping — continuous vocal pitch rounded to the nearest semitone in real time — creates a characteristic sound that foregrounds the staircase. T-Pain and subsequent artists made the quantization artifact itself into a musical element.

**Glitch music** does for time what autotune does for pitch: it foregrounds the digital discretization of continuous audio. Buffer stutters, bit-crushing, sample-rate reduction — all of these expose the grid beneath the smooth surface. The musical interest lies in the tension between the original continuous signal and its increasingly aggressive quantization.

## The Deeper Pattern

Every essay in this collection touches the discrete-continuous boundary in some way:

- **"The Comma Problem":** Commas are the residues of discretizing the frequency continuum — the gap between where the lattice says a note "should" be and where the grid can place it.
- **"The Three Means":** The arithmetic, geometric, and harmonic means mediate between discrete ratios and continuous interpolation.
- **"The Tuning Codec":** Temperament is lossy compression — a rate-distortion tradeoff between continuous just intonation and discrete playable pitches.
- **"The Locking In":** Mode-locking is the mechanism that *generates* discrete consonances from continuous frequency space.
- **"The Groove Equation":** Groove is continuous deviation from a discrete grid, constrained by the width of the Arnold tongue.
- **"The Attractor Landscape":** Attractors are the discrete skeleton within a continuous phase space; music navigates between them.
- **"The Entropy Arc":** Information-theoretic entropy measures the balance between predictable (discrete, structured) and surprising (continuous, unstructured) elements.
- **"The Resonance Cascade":** Each level of the cascade is a filter that converts continuous input into more categorical output.

The boundary isn't one problem. It's THE problem — the generative tension that makes music possible. Pure continuity (white noise, glissando without end) has no structure. Pure discreteness (a clock, a sequence of identical clicks) has no expression. Music lives in the negotiation between them, using discrete frameworks to make continuous phenomena parseable and continuous variation to make discrete frameworks expressive.

The slope needs the staircase to be navigable. The staircase needs the slope to be alive.

---

*Bridges: "The Locking In," "The Groove Equation," "The Tuning Codec," "The Comma Problem," "The Three Means," "The Attractor Landscape," "The Entropy Arc," "The Resonance Cascade," "The Codec Ear," "The Polyphony Problem"*
