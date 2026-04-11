---
title: "The Locking In: Mode-Locking and the Physics of Musical Affinity"
publishDate: 2026-03-10
excerpt: "Mode-locking explains how coupled oscillators snap into simple frequency ratios—from Huygens' pendulum clocks to cochlear consonance to groove. The physics beneath music's deepest structures."
category: "interdisciplinary"
tags:
  - "resonance"
  - "wave-physics"
  - "mathematical-music-theory"
  - "rhythm"
  - "tuning-systems"
  - "psychoacoustics"
author: "Keith Elliott"
byline: "Freq"
---

## The Pendulum Clock Mystery

In 1665, Christiaan Huygens — sick in bed, staring at the wall — noticed something that would take 350 years to fully explain. Two pendulum clocks, mounted on the same wooden beam, had synchronized their swings. Not approximately. _Exactly_, in anti-phase — one swinging left as the other swung right.

He separated them. They drifted apart. He put them back. They synchronized again.

Huygens called it "an odd kind of sympathy." We now call it **mode-locking**: the tendency of coupled oscillators to snap into frequency ratios that are simple rational numbers. And this phenomenon — not abstract number theory, not cultural convention, not learned association — is the physical foundation of consonance, groove, metric entrainment, and possibly tonal attraction itself.

## What Mode-Locking Actually Is

Take two oscillators. Each has a natural frequency — the frequency it would oscillate at if left alone. Now couple them: let each one exert a small force on the other. (In Huygens' case, the coupling was vibrations transmitted through the wooden beam.)

If their natural frequencies are close, something remarkable happens. Instead of oscillating independently at two slightly different frequencies, they lock into a single shared frequency. The system sacrifices the individual freedom of each oscillator to gain the collective stability of synchronization.

But "close" isn't the only condition. Mode-locking occurs not just at 1:1, but at any sufficiently simple rational ratio. Two oscillators whose natural frequencies are near 2:1 will lock into exactly 2:1. Near 3:2, they'll lock into 3:2. The phenomenon creates what physicists call **Arnold tongues** — wedge-shaped regions in parameter space where the system locks into each ratio.

The geometry of Arnold tongues is the key insight. Each tongue has a width proportional to the coupling strength and the _simplicity of the ratio_. The 1:1 tongue is widest. The 2:1 tongue is next. Then 3:2. Then 4:3. The ordering follows the **Stern-Brocot tree** — a complete binary tree of all positive rationals, ordered by a quantity called the _Farey index_ (the sum of numerator and denominator).

The Stern-Brocot tree is also, not coincidentally, the structure that organizes musical intervals by consonance.

## The Cochlea as a Mode-Locking Device

Your inner ear is not a Fourier analyzer. This is the first thing that needs correcting in most accounts of pitch perception.

The cochlea is a bank of approximately 3,500 coupled resonators — the outer hair cells — each tuned to a slightly different frequency. "Coupled" is the critical word. These resonators are not independent. They interact through the basilar membrane and through active mechanical feedback (the outer hair cells are _motors_, not just sensors). The system is nonlinear, active, and coupled.

When a pure tone enters the cochlea, it doesn't just excite the resonator tuned to that frequency. It drives the surrounding resonators, which interact with each other, and the system settles into a collective response pattern. For a harmonic complex tone (like a voice or a bowed string), the partials drive multiple regions of the cochlea simultaneously, and the coupled responses of these regions create a pattern that is exquisitely sensitive to the frequency ratios between partials.

Here's the critical point: when two tones are in a simple frequency ratio, the cochlear responses **mode-lock**. The coupled resonators settle into a stable, low-energy collective oscillation pattern. When the ratio is complex, the responses compete, the pattern is unstable, the system dissipates more energy maintaining coherence. This dissipation is perceived as **roughness** — the gritty, unsettled quality of a mistuned interval.

Consonance, in this view, is not about "matching harmonics" (the standard textbook account). It's about mode-locking in a coupled nonlinear system. The harmonics-matching story is a linearized approximation that gets the ranking mostly right but misses the mechanism entirely.

This explains several things the standard account struggles with:

1. **Why consonance is categorical, not continuous.** Mode-locking is a threshold phenomenon — the system is either locked or it isn't. Small detunings within the Arnold tongue are tolerated; cross the boundary and the quality changes abruptly. This matches the perceptual evidence: a major third sounds "in tune" over a range of about 20 cents, then rather suddenly stops.

2. **Why simple ratios with louder partials are more consonant.** Wider Arnold tongues (simpler ratios) tolerate more detuning. This is why octaves and fifths are almost universally perceived as consonant, while major thirds are culturally variable — the 5:4 tongue is narrower, so it's easier to fall outside it.

3. **Why inharmonic timbres change consonance judgments.** Sethares's work on tuning-timbre relationships becomes obvious: the Arnold tongue structure is determined by the _actual_ frequency ratios present in the signal, not by abstract pitch relationships. Stretch the partials (as in a piano or a metalophone) and the tongue structure stretches with them. Gamelan scales aren't "out of tune" — they're matched to the mode-locking structure of gamelan timbres.

## The Farey Sequence and the Devil's Staircase

If you plot the rotation number of a driven oscillator (the actual frequency ratio of the output) against the natural frequency ratio of the drive, you get a **devil's staircase** — a function that is constant on every Arnold tongue (the flat steps) and rises only in the gaps between them (the Cantor-set-like complement).

The devil's staircase is self-similar. Zoom in on any gap between two steps and you find smaller steps filling it, at ratios that are the **mediants** of the surrounding ratios. The mediant of $a/b$ and $c/d$ is $(a+c)/(b+d)$, which is exactly how the Stern-Brocot tree grows.

Now consider what this means for tuning. Start with the octave (2:1) and the unison (1:1). Their mediant is 3:2 — the perfect fifth. The mediants of 1:1 with 3:2 and 3:2 with 2:1 give 4:3 (perfect fourth) and 5:3 (major sixth). Continue and you generate exactly the intervals of just intonation, in order of decreasing consonance.

**The Stern-Brocot tree provides the substrate from which scales are selected** — but the tree itself organizes _all_ positive rational numbers, not just musically useful ones. Calling it "the scale-generating algorithm" overstates the case: a culture still chooses which branches to follow and which to ignore. The tree explains why simple ratios (the widest Arnold tongues) are preferentially available, but the 12-note chromatic scale, the pentatonic, and the diatonic scale emerge only after additional filtering by octave equivalence and specific branch-path selection. The physics constrains; the culture chooses.

This reframes the entire project of ["The Comma Problem"](/docs/essays/the-comma-problem.md). The commas aren't arbitrary mismatches between mathematical ideals — they're the _gaps between Arnold tongues_. The Pythagorean comma is the gap between the 3:2 tongue (iterated 12 times) and the 2:1 tongue (iterated 7 times). Temperament is the art of distributing these gaps so the system can traverse them without falling out of lock.

## Entrainment: Mode-Locking in Time

Everything above applies to frequency ratios in the pitch domain. Now rotate the lens 90 degrees: the same physics governs rhythm.

A human body is a collection of coupled oscillators. The heartbeat. Respiratory rhythm. Gait cycle. Neural oscillations at alpha, beta, gamma frequencies. When a musical rhythm enters through the ears, it couples to these internal oscillators — not metaphorically, but physically, through neural entrainment.

**Mode-locking in the time domain IS groove.**

In ["Finding One"](/docs/essays/finding-one.md), we explored how the perception of metric downbeats involves active frame construction — the listener imposes a grid on the signal. Mode-locking explains _why_ some grids are more natural than others. The listener's internal oscillators lock to the external rhythm at the simplest available ratio. A 4/4 groove locks easily because 4:1 and 2:1 are wide Arnold tongues. 7/8 is harder because 7:4 is a narrower tongue — it requires stronger coupling (louder, clearer rhythmic cues) to achieve lock.

This connects directly to ["The Groove Equation"](/docs/essays/the-groove-equation.md). The "swing" in a groove — the systematic deviation from metronomic timing — can be understood as the _shape of the limit cycle_ within the Arnold tongue. A perfectly metronomic beat sits at the center of the tongue. Adding swing moves the operating point toward the tongue's edge, increasing the dynamical tension without breaking the lock. Too much swing and you cross the boundary — the groove falls apart, the listener loses the beat.

The microtiming deviations that make a groove feel "human" are fluctuations within the Arnold tongue. A drum machine sits at the fixed point. A great drummer surfs the boundary.

## Tonal Attraction as Gradient in the Arnold Landscape

["The Attractor Landscape"](/docs/essays/the-attractor-landscape.md) proposed that tonal music behaves as a dynamical system with the tonic as a fixed-point attractor. Mode-locking provides the physical mechanism.

Consider the relationship between a sounding pitch and the tonic. When they're in a simple frequency ratio (octave, fifth, fourth), the combined waveform mode-locks into a stable pattern. The system is in an Arnold tongue. When the relationship is complex (tritone, minor second), the system is between tongues — oscillating, unstable, seeking resolution.

The dominant-to-tonic resolution (3:2 → 1:1) is the system sliding from one Arnold tongue into a wider, more stable one. The leading tone's pull toward the tonic is the gradient of the Arnold tongue boundary — the system is just outside the 1:1 tongue and the dynamics pull it in. This isn't metaphor. If you model the cochlear response to a drone on the tonic with a varying second pitch, the transition from beating (outside the tongue) to lock (inside) is perceptually continuous and maps precisely to the experience of "resolution."

The **tritone** (45:32 or √2:1 in 12-TET) sits in the narrowest possible region of Arnold tongue space — it's the ratio that is _maximally far_ from every simple rational. This is why it's the least stable interval, the one that demands resolution in every tonal system that uses it. It's not cultural convention. It's the physics of coupled oscillators.

## The Hierarchy of Locks

Putting it all together, we can describe a hierarchy of mode-locking phenomena in music:

| Timescale       | Oscillators                       | Mode-Locking Phenomenon         |
| --------------- | --------------------------------- | ------------------------------- |
| Microseconds    | Cochlear hair cells               | Pitch fusion, timbre perception |
| Milliseconds    | Neural phase-locking              | Consonance/dissonance           |
| Seconds         | Neural oscillators + motor system | Beat perception, groove         |
| Seconds–minutes | Metric expectation + memory       | Hypermeter, phrase structure    |
| Minutes         | Formal expectations               | Large-scale tension/resolution  |

At every level, the same mathematics applies. The Arnold tongue structure is scale-invariant — it looks the same whether you're analyzing cochlear mechanics or metric entrainment. The Stern-Brocot tree organizes both pitch intervals and rhythmic subdivisions. The devil's staircase appears in both frequency-domain (consonance ranking) and time-domain (preferred meters) phenomena.

This is the deep reason why music _exists_ as a distinct category of human experience. It's not that we culturally invented a set of frequency ratios and rhythmic patterns that we call "musical." It's that the physics of coupled oscillators creates a landscape with natural landmarks — the Arnold tongues — and music is the human practice of navigating that landscape. The tongues are given by physics. The paths through them are culture.

## The Codec Connection

In ["The Tuning Codec"](/docs/essays/the-tuning-codec.md), we argued that temperament is lossy compression — mapping an infinite lattice of just ratios onto a finite codebook. Mode-locking theory tells us _what the compression is optimizing for_.

A good codebook (tuning system) places its codewords (notes) near the centers of Arnold tongues. This maximizes the range of couplings (timbres, registers, dynamics) over which the system will lock. 12-TET puts every note within ~14 cents of a 5-limit just ratio, which is well within the tongue width for most timbres at most couplings. The codebook is "good" not by some arbitrary measure of interval purity, but because it keeps the system in lock across a wide range of musical contexts.

This also explains why 12 is special. The number of Arnold tongues wider than some threshold, within the octave, is approximately 12 for coupling strengths typical of Western instruments. Different timbres (different coupling) give different numbers — which is why other cultures, with different instruments, converged on different numbers of scale degrees. The Javanese _slendro_ (5 tones) and _pelog_ (7 tones) correspond to the tongue count for metalophone timbres. The Arabic 24-quarter-tone system reflects the narrower tongues accessible with the sustained, rich harmonics of the oud and ney.

## What This Means for Composition

### 1. Consonance Is Dynamic, Not Static

Because Arnold tongue width depends on coupling strength, and coupling strength depends on amplitude, register, and timbre, the consonance of an interval is not fixed. A soft, high-register major third in pure tones is barely within its tongue — subtle and fragile. The same interval at full volume with rich harmonics is deep in the tongue — locked, stable, immovable. Orchestration is, among other things, the art of controlling coupling strength.

### 2. Microtonality Is Tongue Exploration

Microtonal composition can be understood as deliberately operating in the narrow tongues and the gaps between them. Xenakis's glissandi sweep across tongue boundaries. La Monte Young's sustained drones sit inside tongues that standard temperament doesn't visit. Ben Johnston's just-intonation string quartets lock into tongues that 12-TET can't reach.

### 3. Groove Design Is Tongue Surfing

The best grooves don't sit at the center of the rhythmic Arnold tongue. They approach the boundary, creating a dynamic tension between lock and drift. This suggests a compositional technique: start at the center (establish the groove), then gradually increase the deviation (push toward the tongue edge), then snap back (return to center for resolution). The rhythmic analog of tension and release.

### 4. Timbre-Tuning Co-Design

If the Arnold tongue structure depends on the spectrum of the oscillators, then the choice of instrument timbres and the choice of tuning are not independent decisions. They should be co-designed. Sethares made this point theoretically; mode-locking theory provides the quantitative framework. Given a timbre, you can compute the optimal tuning. Given a tuning, you can design timbres that lock most cleanly.

---

## The Sympathy

Huygens' "odd kind of sympathy" turns out to be the thread that connects consonance to groove to tonality to temperament. It's all mode-locking — coupled oscillators finding rational ratios, from the cochlea to the concert hall. The mathematics is the same at every scale. The Stern-Brocot tree organizes the landscape. The Arnold tongues are the terrain. And music is the path.

The deepest bridges in this research project — between ["The Comma Problem"](/docs/essays/the-comma-problem.md) and ["The Groove Equation"](/docs/essays/the-groove-equation.md), between ["Finding One"](/docs/essays/finding-one.md) and ["The Attractor Landscape"](/docs/essays/the-attractor-landscape.md), between ["The Tuning Codec"](/docs/essays/the-tuning-codec.md) and ["The Entropy Arc"](/docs/essays/the-entropy-arc.md) — all run through this single physical phenomenon. The sympathy of oscillators. The locking in.

---

_Connects to: [The Comma Problem](/docs/essays/the-comma-problem.md), [The Three Means](/docs/essays/the-three-means.md), [The Tuning Codec](/docs/essays/the-tuning-codec.md), [Finding One](/docs/essays/finding-one.md), [The Groove Equation](/docs/essays/the-groove-equation.md), [The Attractor Landscape](/docs/essays/the-attractor-landscape.md), [The Entropy Arc](/docs/essays/the-entropy-arc.md)_
