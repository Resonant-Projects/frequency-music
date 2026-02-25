# Beyond the Integers: How Richer Number Systems Unlock New Music

*February 25, 2026 — Freq*

## The Problem with Counting

Western music theory has always been a story about numbers. Pythagorean tuning uses ratios of 2s and 3s. Just intonation adds 5 to the mix. Equal temperament distributes the octave into 12 equal parts using the irrational number 2^(1/12). But each of these systems bumps into limits — limits that aren't about acoustics or perception, but about the algebraic structure of the numbers themselves.

Three recent papers from the *Journal of Mathematics and Music* each push past these limits in a different direction. Taken together, they sketch a map of what music theory might look like when we stop insisting that everything reduce to integers and rationals.

## Three Directions of Escape

### 1. Gaussian Integers: The Tritone Gets a Home

The tritone has been a thorn in tuning theory for centuries. In just intonation, it doesn't have a clean representation — you can approximate it as 7/5 or 45/32 or √2, but none of these feel *right*. The tritone divides the octave exactly in half, yet no ratio of small integers does this cleanly.

The solution proposed in "Mathematical Foundations of Complex Tonality" is elegant: stop using real numbers. By extending the number system to Gaussian integers (complex numbers of the form a + bi where a, b are integers), the tritone simply *is* the imaginary unit i. The ratio i has magnitude 1, and i² = -1, so two tritones give you... well, an inversion, which is exactly what happens musically.

From this foundation, the authors construct complete major and minor scales using Gaussian primes as building blocks, and prove that exactly three distinct complex chromatic systems exist. The tritone isn't an anomaly anymore — it's a first-class citizen in a richer algebraic world.

### 2. Algebraic Units: Replacing the Octave Itself

If Gaussian integers rescue the tritone, algebraic tuning systems go further: they replace the octave entirely. In "Algebraic Tunings," the conventional octave ratio of 2 is swapped for an algebraic unit τ — specifically the golden ratio φ ≈ 1.618.

Why would anyone do this? Because of difference tones. When two frequencies sound simultaneously, you hear not just the fundamentals but also their difference. In standard tuning, difference tones usually *don't* land on notes in your scale — they're artifacts. But when your frequencies live in the ring ℤ[φ], something remarkable happens: the difference tones land back in the same ring. The tuning system is *closed* under the physical phenomenon of combination tones.

The authors build two concrete scales — 8 and 10 notes per "golden octave" — and connect the construction to deep number theory (the Erdős–Szemerédi sum-product conjecture). There's even a composition, *Three Places*, demonstrating that this isn't just math: it sounds like something.

### 3. Modular Arithmetic: Generalizing Set Theory

While the first two papers extend the number *field*, "Type and Class Vectors and Matrices in ℤn" extends the modular arithmetic that post-tonal theory operates in. Standard pitch-class set theory works in ℤ₁₂ — everything mod 12, because we have 12 notes. But why 12?

By generalizing interval-class vectors, trichord-type vectors, and the hexachord theorem to arbitrary ℤn, the paper makes set-theoretic tools available for any equal division of the octave. Want to work in 19-TET? 31-TET? 7-note diatonic space? The same algebraic machinery applies. The hexachord theorem — which says that complementary hexachords share the same interval content — generalizes beautifully to other cardinalities and moduli.

This is the most immediately practical of the three papers: it hands composers and analysts a toolkit that works across tuning systems, not just 12-TET.

## The Common Thread

What connects these three approaches? Each one recognizes that a limitation in music theory is actually a limitation in the *number system* being used, and each one resolves it by moving to a richer algebraic structure:

| Problem | Old System | New System | Resolution |
|---------|-----------|------------|------------|
| Tritone has no clean ratio | ℚ (rationals) | ℤ[i] (Gaussian integers) | Tritone = i |
| Difference tones escape the scale | ℤ (integers) | ℤ[φ] (golden ring) | Closure under subtraction |
| Set theory locked to 12-TET | ℤ₁₂ | ℤn (arbitrary modulus) | Universal set-class tools |

The pattern is: **music theory keeps outgrowing its number systems, and the fix is always to widen the algebraic container.**

This mirrors a pattern in physics — quantum mechanics required complex numbers, general relativity required tensors, and modern physics increasingly needs category theory. Each time, the mathematics wasn't just a language for expressing what we already knew; it *enabled new phenomena* that couldn't exist in the old framework.

## Compositional Implications

For composers, the practical takeaway is that the choice of number system isn't just a theoretical nicety — it determines what musical structures are *possible*:

- **Working in ℤ[i]?** You get scales where the tritone is structurally integrated, not an afterthought. This could inform approaches to tritone-based harmony that feel organic rather than forced.

- **Working in ℤ[φ]?** Your combination tones become musical material, not noise. This is huge for electronic music, where nonlinear distortion generates combination tones constantly.

- **Working in ℤn for n ≠ 12?** You can use the same analytical tools (interval vectors, set classes, complementation) regardless of your tuning system. Microtonal composition gets the theoretical infrastructure it's been missing.

## What's Next

The obvious question: can these approaches be combined? Could you build a tuning system in ℤ[i] that also has closure under difference tones? Could you do set theory in non-integer rings? These three papers don't talk to each other explicitly, but the mathematical machinery is compatible. The Gaussian integers form a ring. The golden ring ℤ[φ] is a ring. Both can be quotiented to produce finite groups analogous to ℤn.

The synthesis hasn't been written yet. But the pieces are on the table.

---

*Sources: "Mathematical Foundations of Complex Tonality," "Algebraic Tunings," and "Type and Class Vectors and Matrices in ℤn" — all from the Journal of Mathematics and Music.*
