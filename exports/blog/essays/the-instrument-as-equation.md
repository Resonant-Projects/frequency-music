---
title: "The Instrument as Equation: Boundary Conditions and the Shape of Music"
publishDate: 2026-03-12
excerpt: "Every musical instrument solves a specific differential equation with particular boundary conditions, generating unique eigenfrequencies that determine its timbre and shape the musical systems built around it."
category: "physics-of-sound"
tags:
  - "wave-physics"
  - "acoustics"
  - "mathematical-music-theory"
  - "tuning-systems"
  - "temperament"
  - "resonance"
author: "Keith Elliott"
byline: "Freq"
---

## The Physicist's Instrument

Pick up a guitar string. Pluck it. What you hear is the solution to a partial differential equation:

$$\frac{\partial^2 y}{\partial t^2} = c^2 \frac{\partial^2 y}{\partial x^2}$$

where _y(x, t)_ is the displacement of the string at position _x_ and time _t_, and _c = √(T/μ)_ is the wave speed determined by tension _T_ and linear mass density _μ_. The string is fixed at both ends: _y(0, t) = y(L, t) = 0_. These boundary conditions — two points where the string can't move — are the most important two facts about a guitar string, musically speaking.

Why? Because the boundary conditions determine the _eigenvalues_: the allowed frequencies of vibration. For the ideal string, these are:

$$f_n = n \cdot \frac{c}{2L} = n \cdot f_1$$

Integer multiples of the fundamental. The harmonic series. The most consequential sequence of numbers in music.

This isn't a model or approximation of what a string does. It's what a string _literally does_. The physics demands it: any vibration that doesn't have nodes at both endpoints gets killed by the boundary conditions. Only standing waves with wavelengths λ = 2L/n survive. The integer multiples are a theorem, not an empirical observation.

And from this single mathematical fact — that strings produce integer-ratio overtones — flows essentially the entire edifice of Western tonal harmony.

## The Hierarchy of Vibrating Bodies

Here's the key insight: different physical systems solve different equations with different boundary conditions, producing different overtone series. And the character of those overtone series determines what kind of music the instrument can participate in.

### The String (1D, order 2, fixed-fixed)

The ideal string solves the wave equation in one dimension with both ends fixed. Overtones: exact integer multiples of the fundamental (1, 2, 3, 4, 5, ...). This is the harmonic series — the mathematical foundation of consonance.

Because the partials are harmonically related, two strings tuned to a simple frequency ratio (say 3:2, a perfect fifth) produce overtones that overlap extensively. The third partial of the lower string matches the second partial of the upper string. This physical alignment is what we perceive as consonance. The entire system of just intonation — and by extension, the temperaments that approximate it — is a consequence of strings having integer-ratio partials.

"The Prime Dimensions" showed that each prime number defines an independent dimension of harmonic space. But _why_ do primes matter for harmony? Because string partials are integers, and the fundamental theorem of arithmetic says every integer has a unique prime factorization. If strings produced irrational-ratio partials, prime factorization would be irrelevant to music, and the entire lattice structure of just intonation would dissolve.

### The Air Column (1D, order 2, varied boundaries)

A tube of air solves the same wave equation as a string, but with different boundary conditions. An **open-open tube** (flute, organ flue pipe) has pressure nodes at both ends — mathematically equivalent to the string. Result: all harmonics, 1, 2, 3, 4, 5, ...

A **closed-open tube** (clarinet, stopped organ pipe) has a pressure antinode at the closed end and a node at the open end. This antisymmetric boundary condition eliminates all even harmonics. Result: odd harmonics only — 1, 3, 5, 7, 9, ...

This is why clarinets sound fundamentally different from flutes, even in the same register playing the same note. It's not a matter of material or craftsmanship (though those matter too). It's a mathematical consequence of one end being closed. The clarinet's missing even harmonics give it that distinctive hollow, woody quality — a timbral signature written into the boundary conditions.

The brass instruments add another twist: the mouthpiece and bell create a non-uniform tube whose effective boundary conditions vary with frequency. The result is a series that starts nearly harmonic and becomes progressively more harmonic as the mode number increases — the opposite of what happens with string stiffness (see below). This is why brass instruments can play natural harmonics so effectively: the overtone series of a brass tube, despite its complex geometry, converges beautifully onto the integer series.

### The Membrane (2D, order 2, circular boundary)

Strike a drum. Now you're solving the two-dimensional wave equation in polar coordinates:

$$\frac{\partial^2 z}{\partial t^2} = c^2 \left(\frac{\partial^2 z}{\partial r^2} + \frac{1}{r}\frac{\partial z}{\partial r} + \frac{1}{r^2}\frac{\partial^2 z}{\partial \theta^2}\right)$$

with z = 0 on the circular boundary. The solutions are Bessel functions J*m(k*{mn}r)·cos(mθ), and the allowed frequencies are proportional to the zeros of Bessel functions: j*{01}, j*{11}, j*{21}, j*{02}, j\_{31}, ...

The first few frequency ratios are approximately:

| Mode  | Ratio to fundamental |
| ----- | -------------------- |
| (0,1) | 1.000                |
| (1,1) | 1.593                |
| (2,1) | 2.136                |
| (0,2) | 2.296                |
| (3,1) | 2.653                |
| (1,2) | 2.917                |

None of these are integers. None are even close to simple ratios. The membrane's partials are **inharmonic** — not because the drum is poorly made, but because the two-dimensional wave equation with circular boundary conditions has Bessel-function solutions, and zeros of Bessel functions don't form integer sequences.

This is why drums are traditionally classified as "unpitched." It's not that they lack overtones — they have rich, complex spectra. It's that those overtones don't line up with the harmonic series, so the ear can't extract a clear pitch. The same physical object that, as a one-dimensional string, would produce pure harmony, becomes in two dimensions a source of beautiful noise. **Dimensionality changes the equation, the equation changes the spectrum, the spectrum changes the music.**

Timpani partially escape this by using a specific mode (the 1,1 mode) as the dominant partial, and the kettle shape reinforces certain modes over others — essentially engineering the boundary conditions to approach harmonicity. The tabla goes further: the loaded drumhead (a paste called _syahi_ applied to the center) modifies the effective boundary condition to make several modes nearly harmonic, enabling the pitched, melodic drumming central to Indian classical music. The tabla is literally an exercise in boundary-condition engineering for harmonic optimization.

### The Bar (1D, order 4, free-free)

A xylophone bar, a tuning fork, or a marimba key doesn't solve the wave equation at all. It solves the **Euler-Bernoulli beam equation** — a fourth-order PDE:

$$\frac{\partial^2 y}{\partial t^2} = -\frac{EI}{\rho A}\frac{\partial^4 y}{\partial x^4}$$

where _E_ is Young's modulus, _I_ is the area moment of inertia, _ρ_ is density, and _A_ is cross-sectional area. The fourth spatial derivative (compared to the string's second derivative) changes everything. The allowed frequencies for a uniform free-free bar are:

$$f_n \propto (n + \tfrac{1}{2})^2 \quad \text{for } n = 1, 2, 3, \ldots$$

The first few ratios: 1 : 2.76 : 5.40 : 8.93 : ...

These are dramatically inharmonic — the second partial is nearly three times the fundamental instead of twice. This is why a plain metal bar struck with a hammer sounds like a clang, not a note. The partials fight each other rather than reinforcing a single pitch.

Instrument builders fight back by _sculpting the boundary conditions_. Marimba bars have an arch cut from the underside, thinning the bar at the center. This lowers the fundamental without affecting the higher modes as much, bringing the partial ratios closer to something the ear can parse. The craft of marimba building is, from a mathematical standpoint, the craft of reshaping eigenmodes through geometry.

### The Plate and the Bell (2D, order 4)

Bells and cymbals combine the worst of both worlds: two-dimensional geometry _and_ fourth-order bending dynamics. The result is a spectrum of extraordinary complexity — dozens of prominent partials at seemingly random frequency ratios. Bell-founding is one of the oldest precision crafts in human civilization, and it amounts to this: adjusting the bell's profile (the curve from lip to shoulder) to bring the five principal partials into acceptable relationships. The target ratios — called the strike note, hum, tierce, quint, and nominal — aren't harmonic, but they're close enough to culturally learned templates that the ear accepts them as a "note."

The remarkable thing is that this works at all. Bell-founders developed their recipes empirically over centuries, but what they were doing, mathematically, was solving an inverse eigenvalue problem: given a desired set of frequencies, find the geometry that produces them. This is a hard problem in general (and ill-posed — see below), which explains why bell-founding remained an artisanal mystery for so long.

## Can You Hear the Shape of a Drum?

In 1966, Mark Kac asked a question that connects directly to this hierarchy: **"Can one hear the shape of a drum?"** If you know all the eigenfrequencies of a vibrating membrane, can you deduce its shape?

The answer, proved by Gordon, Webb, and Wolpert in 1992, is **no** — there exist pairs of different shapes that produce identical spectra. The eigenvalues don't uniquely determine the geometry. Musically, this means two differently shaped drums could sound identical in terms of their overtone content.

But the converse is deeply true: the shape determines the sound. Change the geometry, change the spectrum, change the music. This is the direction that matters for composers and instrument builders. The shape-to-spectrum map is surjective but not injective — many shapes can produce the same sound, but each shape produces exactly one sound.

This connects to "The Representation Gap": different physical systems can be _musically equivalent_ (same spectrum) while being _physically different_ (different geometry). The representation of sound in terms of eigenvalues is lossy — it discards geometric information. But it's _musically complete_, because the ear responds to spectra, not shapes.

## The Stiffness Correction: Why Pianos Aren't Quite Right

Real strings aren't ideal — they have bending stiffness. A real piano string solves not the pure wave equation but a modified equation that includes a fourth-order bending term:

$$\frac{\partial^2 y}{\partial t^2} = c^2 \frac{\partial^2 y}{\partial x^2} - \kappa^2 \frac{\partial^4 y}{\partial x^4}$$

where _κ_ depends on the string's stiffness. The effect is that partials are stretched sharp of the harmonic series:

$$f_n = n \cdot f_1 \cdot \sqrt{1 + Bn^2}$$

where _B_ is the inharmonicity coefficient. For thick, short bass strings, _B_ can be large enough that the upper partials are noticeably sharper than harmonic. For the lowest notes on a piano, the 10th partial might be 30-40 cents sharp of where an ideal harmonic series would put it.

This has profound consequences for piano tuning. Piano tuners tune **stretched octaves** — the octave above middle C is tuned a few cents wider than 2:1, because the ear judges octave purity by the alignment of partials, not by the mathematical ratio of fundamentals. If you tune a piano to exact 2:1 octaves, it sounds _flat_ in the upper register because the inharmonic partials of the lower note are sharper than the fundamentals of the upper note. The "correct" octave for a piano is the one where the partials align — and that's wider than 2:1.

This is why Pythagorean mathematics and piano tuning disagree, why electronic tuners have a "stretch" setting, and why a piano tuned by a skilled technician sounds better than one tuned by algorithm. The piano is a slightly inharmonic instrument, and its tuning must accommodate that inharmonicity. The boundary conditions are almost-but-not-quite those of an ideal string, and the "almost" reshapes the entire temperament.

"The Spectrum as Score" argued that pitch and timbre are the same phenomenon. Here's the physical proof: changing the string's stiffness (a physical property) changes both its timbre (brighter, more metallic upper partials) AND its optimal tuning (stretched octaves). You can't change one without changing the other, because they're both readings of the same eigenvalue spectrum.

## Instruments as Cultural Attractors

Here's the anthropological turn. Different civilizations independently discovered and optimized different vibrating bodies, and the overtone series of those bodies shaped the musical systems that grew around them.

**Strings and tubes** produce harmonic spectra → Western and many other traditions developed **harmonic music**: counterpoint, functional harmony, the system of consonance and dissonance that "The Locking In" explains through mode-locking of coupled harmonic oscillators.

**Metallophones with inharmonic spectra** (gamelan) → Javanese and Balinese traditions developed tunings (sléndro, pélog) that **match the inharmonic partials**, just as Sethares predicted. The "dissonance" of gamelan intervals in Western ears isn't dissonance at all — it's consonance for inharmonic timbres. The tuning and the instrument co-evolved, each adapted to the other.

**Loaded membranes** (tabla) → Indian classical music developed a **rhythmic system of extraordinary sophistication** (tala) partly enabled by the tabla's quasi-harmonic spectrum, which allows drums to carry melodic information and participate in pitch-based musical structures that would be impossible with Western drums.

**Bells with engineered partials** → European change-ringing developed as a **combinatorial art** — permutation groups on bells — rather than a harmonic one, because bells don't blend harmonically the way strings do. The music that bells afford is mathematical in a different way: group theory rather than frequency ratios.

Each instrument-culture pair is an **attractor** in the sense of "The Attractor Landscape": the physics of the vibrating body constrains the space of musical possibilities, and the culture converges onto the region of that space where the physics is most cooperative. The string attracts harmony. The membrane attracts rhythm. The bell attracts combinatorics. The instrument doesn't determine the music — but it powerfully constrains the basin of attraction within which the music evolves.

## Physical Modeling: The Equation Becomes the Instrument

The ultimate confirmation that instruments ARE equations is physical modeling synthesis. When Julius O. Smith and others developed techniques for real-time synthesis by numerically solving the wave equation (and its relatives), they proved that the equation is sufficient: solve it correctly, and you get a convincing instrument.

The Karplus-Strong algorithm (1983) is the simplest case: a delay line with a lowpass filter simulates a plucked string by implementing the wave equation's solution directly. The delay line length sets the pitch (the fundamental eigenvalue), and the filter models the frequency-dependent energy loss at the boundary. It sounds like a plucked string because it IS a plucked string, mathematically.

Digital waveguide synthesis extends this to tubes (clarinet, flute models), bowed strings (Smith's celebrated violin model), and coupled systems (piano models with string-soundboard interaction). In each case, the "instrument" is a numerical solver for a specific PDE with specific boundary conditions. The craft of physical modeling is identical to the craft of instrument building — you're adjusting boundary conditions and coupling parameters to shape the eigenvalues, except with code instead of wood.

This closes a beautiful loop: instrument builders spent centuries empirically solving boundary-value problems to shape spectra. Physicists spent centuries analyzing those instruments to derive the equations. Synthesizer designers now solve those same equations in real-time, producing sounds that are, in the deepest sense, the same objects — solutions to the same differential equations with the same boundary conditions, realized in silicon instead of spruce.

## The Meta-Pattern

Across every instrument in this essay, the same pattern recurs:

1. **A physical system** (string, tube, membrane, bar, bell) is described by **a differential equation** (wave equation, beam equation, plate equation).
2. **Boundary conditions** (fixed, free, open, closed, loaded, shaped) constrain the solutions.
3. The allowed solutions are **eigenmodes** with specific **eigenfrequencies**.
4. The set of eigenfrequencies IS the **timbre** — the tonal identity of the instrument.
5. The timbre determines what **tuning systems and musical structures** are natural for the instrument.
6. The tuning systems and musical structures shape the **musical culture** that grows around the instrument.

The chain from equation to culture is not a metaphor. It's a causal sequence, each step physically or perceptually determined by the previous one. Change the equation (swap a string for a membrane), and you change the culture (from harmony to rhythm).

This is "The Staircase and the Slope" in physical form: the continuous physics of vibration, discretized by boundary conditions into a finite set of eigenvalues, then further discretized by cultural practice into scales, tunings, and compositional rules. The staircase is already present in the physics — the instrument quantizes the continuum before any human convention enters the picture.

And this is perhaps the deepest lesson: **music is not imposed on physics. Music is what physics sounds like when you listen to the eigenvalues.**

---

_Bridges: "The Spectrum as Score" (pitch-timbre unity as eigenvalue spectrum), "The Prime Dimensions" (why primes matter — because strings produce integers), "The Locking In" (mode-locking requires harmonic partials), "The Staircase and the Slope" (boundary conditions as physical quantization), "The Attractor Landscape" (instruments as cultural attractors), "The Resonance Cascade" (multi-scale resonance hierarchy), "The Representation Gap" (Kac's question — spectra don't determine geometry), "The Three Means" (just intonation presupposes harmonic spectra), "The Tuning Codec" (temperament as eigenvalue compression)_
