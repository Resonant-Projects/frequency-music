# The Three Means: How Ancient Mathematics Built the Language of Harmony

*On the arithmetic, geometric, and harmonic means — and why music was the original motivation for studying them.*

---

## The Forgotten Origin Story

Most musicians know the harmonic series. Fewer know that the very word *harmonic* — as a mathematical term — comes from music theory. The three classical means (arithmetic, geometric, harmonic) weren't abstract mathematical constructs that happened to apply to music. They were *born* from the study of musical intervals.

When Archytas of Tarentum classified the three means around 400 BCE, he was solving a music problem: how do you divide a musical interval into two parts? The answer depends on *which kind of division* you choose — and each mean gives a different one, with a different sonic character.

## The Three Divisions of the Octave

Take a vibrating string. Its full length produces some fundamental pitch. Half its length produces the octave. The question: where do you place the bridge to create an intermediate note?

### The Arithmetic Mean

The arithmetic mean of two lengths $a$ and $b$ is:

$$M_A = \frac{a + b}{2}$$

For a string of length 1 (fundamental) and length 1/2 (octave), the arithmetic mean is 3/4. A string of length 3/4 produces a note a **perfect fourth** above the fundamental — the frequency ratio is 4:3.

This divides the octave into a fourth (bottom) and a fifth (top): 1 → 4/3 → 2.

The arithmetic mean is *additive*. It splits the interval by finding the midpoint of the *physical* quantity (string length, wavelength). It biases toward the lower end of the frequency range — the fourth sits below the fifth.

### The Harmonic Mean

The harmonic mean of $a$ and $b$ is:

$$M_H = \frac{2ab}{a + b}$$

For lengths 1 and 1/2, this gives 2/3. A string of length 2/3 produces a note a **perfect fifth** above the fundamental — the frequency ratio is 3:2.

This divides the octave into a fifth (bottom) and a fourth (top): 1 → 3/2 → 2.

Notice the beautiful symmetry: the arithmetic mean puts the fourth below the fifth. The harmonic mean *inverts* this, putting the fifth below the fourth. They are mirror images.

The harmonic mean is the natural average for *rates* and *frequencies*. It's called "harmonic" precisely because of this musical application — the term was likely coined by Archytas himself, or possibly by the Pythagorean school before him.

### The Geometric Mean

The geometric mean of $a$ and $b$ is:

$$M_G = \sqrt{ab}$$

For lengths 1 and 1/2, this gives $1/\sqrt{2} \approx 0.707$. The corresponding frequency ratio is $\sqrt{2}:1$ — the **tritone**, which divides the octave into two exactly equal parts.

This is the mean that equal temperament is built on. The twelfth root of 2 — the equal-tempered semitone — is what you get when you apply the geometric mean recursively, splitting each interval into equal geometric parts. Equal temperament is, in a precise mathematical sense, the *geometrization* of the octave.

## The Inequality That Governs Harmony

There's a fundamental ordering among the three means:

$$M_H \leq M_G \leq M_A$$

with equality only when $a = b$. In musical terms: the harmonic mean always produces a *lower* intermediate note than the geometric mean, which in turn produces a lower note than the arithmetic mean.

This inequality has a profound musical consequence. Just intonation (built on arithmetic and harmonic means) places intervals at specific rational ratios. Equal temperament (built on the geometric mean) splits the difference. The tiny discrepancies between these placements — the commas and schismas that have obsessed tuning theorists for centuries — are direct consequences of the mean inequality.

## One Formula, Three Means

The Euser paper on sacred geometry and musical proportions highlights a striking fact: all three means can be generated from a single parametric formula. Given two values $a$ and $b$, the *power mean* (or generalized mean) of order $p$ is:

$$M_p = \left(\frac{a^p + b^p}{2}\right)^{1/p}$$

- $p = 1$: arithmetic mean
- $p \to 0$: geometric mean (in the limit)
- $p = -1$: harmonic mean

This unification isn't just elegant — it reveals that the three means are points on a continuum. Between the harmonic and arithmetic means lies a smooth landscape of possible interval divisions. Every tuning system implicitly chooses a position on this continuum.

## Composition Parameters

What does this mean for a composer?

**1. The mean determines the character of interval division.** When you subdivide a musical interval:
- Arithmetic division produces a *wider lower interval* (the fourth-below-fifth pattern). This has a grounded, stable quality.
- Harmonic division produces a *wider upper interval* (the fifth-below-fourth pattern). This has an open, soaring quality.
- Geometric division produces *equal* intervals. This has a symmetrical, ambiguous quality — the tritone's instability is a direct consequence.

**2. Chord voicing echoes the mean principle — loosely.** The arithmetic and harmonic means bisect the octave at the fifth and fourth respectively; a major triad's internal intervals (major third + minor third) don't map cleanly onto these bisections. But the *spirit* of the idea — that redistributing the same pitch content across different registers changes the character of a chord from "grounded" to "floating" — parallels the shift from arithmetic to harmonic division. Don't push this analogy further than it can bear.

**3. Microtonal tuning as mean selection.** A composer working with adaptive tuning or fretless instruments could *modulate between means* — shifting from just intonation (arithmetic/harmonic) toward equal temperament (geometric) and back. On a standard MIDI keyboard this isn't practical without custom pitch-bend scripting, but for electronic composers with microtonal DAW setups (like those using Scala files) or for fretless string players who do this intuitively through vibrato and expressive intonation, it's a concrete technique.

**4. Rhythm and the means.** The three means apply equally to temporal intervals. Dividing a measure arithmetically vs. harmonically vs. geometrically produces different rhythmic subdivisions — the arithmetic version giving evenly spaced beats, the harmonic version accelerating, and the geometric version producing logarithmic spacing (which is how we actually perceive rhythmic acceleration).

## The Deep Connection

The reason the three means matter isn't just that they're mathematically interesting. It's that they represent three fundamentally different *philosophies of division*:

- **Arithmetic:** divide the *thing itself* equally (the string, the time span)
- **Harmonic:** divide the *reciprocal* equally (the frequency, the rate)  
- **Geometric:** divide the *ratio* equally (the interval, the proportion)

These correspond to three ways of experiencing music. We hear pitch on a logarithmic (geometric) scale but experience physical resonance through integer ratios (arithmetic/harmonic). The tension between these modes of perception — equal-tempered convenience vs. just-intoned resonance — is the tension between the geometric mean and the arithmetic-harmonic pair.

The ancient Pythagoreans weren't naive when they called these the three kinds of proportion. They were identifying a real structural feature of how sound works — one that twenty-five centuries of music theory has never quite resolved, only elaborated.

---

*Sources: Euser, "Sacred Geometry and Musical Proportions" (Academia.edu); Archytas fragment in Porphyry's commentary on Ptolemy's Harmonics; Barker, "Greek Musical Writings II" (Cambridge, 1989). Cross-referenced with extractions on Pythagorean tuning, equal temperament group structure, and geometric series in rhythm.*
