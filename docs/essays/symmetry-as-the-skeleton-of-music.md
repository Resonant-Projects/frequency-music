# Symmetry as the Skeleton of Music

*Three papers, three vocabularies, one recurring insight: the deep structure of tonal music is symmetry, and every meaningful musical phenomenon — scales, chords, attraction — can be understood as a consequence of how symmetries act, break, and transform.*

## The Trio

Three recent papers from the *Journal of Mathematics and Music* converge on this theme from strikingly different starting points:

1. **"Generalizations of Euler's Tonnetz on triangulated surfaces"** — Extends the classical Tonnetz (a geometric map of pitch-class relationships) from a plane tiling to arbitrary triangulated surfaces, using Lie theory and crystallographic reflection groups.

2. **"Axiomatic scale theory"** — Formalizes scales as cyclic embeddings from diatonic tone sets into chromatic tone sets, unifying maximally even scales, well-formed scales, and Myhill's property under a single algebraic framework built on cyclic groups.

3. **"Gauge models of musical forces"** — Applies SU(2) gauge symmetry from quantum field theory to model tonal attraction, treating the perception of musical "gravity," "magnetism," and "inertia" not as metaphors but as structural consequences of symmetry-breaking.

What's remarkable is that despite operating in different mathematical universes — Lie algebras, cyclic group theory, gauge theory — all three converge on the same foundational claim: **the interesting properties of tonal music emerge from the interplay between symmetry and its violation.**

## Symmetry Everywhere, Differently

### The Tonnetz: Symmetry as Geometry

The Tonnetz paper takes Euler's 18th-century diagram — vertices labeled with pitch classes, edges connecting by fifths and thirds — and asks: what happens when we change the underlying geometry? By replacing the standard equilateral tiling (type A₂) with tilings from other Lie algebras (B₂, C₂, G₂), new tonnetzes emerge on tori and spheres.

The key insight is that **angles between reflection hyperplanes map directly to musical intervals**: 90° corresponds to minor thirds (four stack to an octave), 60° to whole tones or major thirds, 30° to perfect fifths. The geometry *is* the harmony.

Most strikingly, the paper reveals that **Langlands duality** — one of the deepest structures in modern mathematics, connecting dual Lie algebras — corresponds to major/minor duality in music. Swapping long and short sides of the fundamental alcove (the Langlands dual operation) transforms an all-major tonnetz into an all-minor one. This is not a coincidence engineered by the authors; it falls out of the mathematics. Major and minor are Langlands duals.

### Scales: Symmetry as Algebra

The axiomatic scale theory paper works at a more elementary level but with greater precision. A scale is formalized as a cyclic embedding σ: D → C, where D is a set of diatonic tones and C is a set of chromatic tones, both equipped with cyclic order. The paper then proves that three seemingly different mathematical structures are equivalent views of the same thing:

- **Cyclic ordered sets** (how tones are arranged)
- **Generalized interval systems** (how distances between tones are measured)
- **Regular group actions** (how transposition works)

This unification (Theorem 3.5) is elegant because it says that knowing *any one* of these — the ordering, the interval structure, or the transposition behavior — completely determines the other two. The familiar properties of Western scales (maximal evenness, well-formedness, Myhill's property) are then shown to be consequences of how the embedding σ interacts with these structures.

The automorphism group of a scale measures its degree of symmetry. The diatonic scale has trivial automorphism group (maximally asymmetric), while the octatonic scale has ℤ₄ symmetry and the whole-tone scale has ℤ₆. The paper argues that **asymmetry is a feature, not a bug** — it's what gives each scale degree a distinct identity and makes tonal music cognitively navigable.

### Tonal Attraction: Symmetry as Physics

The gauge theory paper goes furthest in claiming that musical structure has genuinely physical character. The cyclic group ℤ₁₂ of pitch classes has a representation as rotations in a two-dimensional Hilbert space (a "qubit" model). Each tone is a state vector, and tonal attraction is computed as a projection — literally, how much one tone's state vector overlaps with another's.

In the "force-free" case (pure ℤ₁₂ symmetry, no tonal center), all tones are equally attracted to one another. Tonal hierarchy — the phenomenon that C "belongs" more than F# in C major — arises from **symmetry breaking**. The authors model this as a spatial deformation of the circle of fifths, introducing a polynomial that stretches distances non-linearly so that the tonic and its close neighbors on the circle of fifths dominate.

The deformation generates a Hamiltonian with three terms that the authors interpret as:
- **Inertia** (kinetic energy — the tendency of melodic motion to continue)
- **Magnetism** (attraction to the nearest stable tone)
- **Gravity** (the static potential landscape of the tonal hierarchy)

These are the same three "musical forces" that Larson proposed as *metaphors* — but here they arise as mathematical necessities from gauge symmetry breaking. The metaphor was more literal than anyone expected.

## The Connecting Thread

Here's what ties these three papers together: **each one shows that you can recover the essential features of tonal music by starting with a symmetry group and then examining what happens when that symmetry is structured, broken, or embedded.**

| Paper | Symmetry group | What breaks/structures it | What emerges |
|-------|---------------|--------------------------|--------------|
| Tonnetz | Crystallographic reflection groups (Weyl groups) | Choice of surface topology and labeling | Chord types, major/minor duality |
| Scale theory | Cyclic group ℤ_c | Cyclic embedding from ℤ_d → ℤ_c | Scale properties, interval structure |
| Gauge model | ℤ₁₂ → SO(2) → SU(2) | Spatial deformation (gauge field) | Tonal hierarchy, attraction forces |

The progression is telling. The Tonnetz paper works at the level of **geometry** — how pitch classes sit in space. Scale theory works at the level of **algebra** — how pitch classes relate through group structure. The gauge model works at the level of **dynamics** — how pitch classes attract and repel through forces. Geometry, algebra, dynamics — but all grounded in the same ℤ₁₂ cyclic symmetry of equal temperament.

## The Compositional Takeaway

For a composer, this convergence suggests something practical: **the most fertile musical structures sit at the boundary between symmetry and asymmetry.**

- A completely symmetric structure (whole-tone scale, diminished seventh chord) sounds static — there's no preferred direction, no tension. Mathematically, its automorphism group is large, so every position is equivalent.
- A completely asymmetric structure (a random collection of pitches) sounds chaotic — there's no pattern to grab onto. Mathematically, there's no useful group action.
- The sweet spot is **structured asymmetry** — scales like the diatonic that are maximally even (spread as uniformly as possible) but not symmetric, creating distinct scale degrees with different "weights." This is exactly what Myhill's property captures: every generic interval comes in exactly two specific sizes.

The gauge theory paper quantifies this: the non-linear deformation that produces tonal attraction is what turns the uniform circle of fifths into a landscape with peaks (tonic, dominant) and valleys (tritone). A composer working with this framework could deliberately tune the "deformation" — for instance, writing in a mode that flattens the hierarchy, or using chromatic saturation to approach the uniform (force-free) case before snapping back to a strong tonal center.

The Tonnetz generalizations offer another angle: by choosing different underlying geometries (tori vs. spheres, A₂ vs. G₂ tilings), a composer could work within chord vocabularies that have built-in structural constraints different from standard practice. The G₂ tonnetz, for example, produces only 12 of the 24 major and minor triads, arranged with circle-of-fifths relationships and diminished seventh chords at the vertices. Writing within that constraint is like working in a particular mode — it limits the palette in a way that creates coherence.

## What This Doesn't Explain

It's worth noting what these symmetry-based approaches leave out. They all work within equal temperament (ℤ₁₂), which is already a massive simplification. Just intonation, with its rational frequency ratios, has a completely different algebraic structure — it's a free abelian group of infinite rank (generated by primes), not a finite cyclic group. The "beyond the integers" story from our previous essay lives in a different mathematical world from the symmetry story told here.

They also say little about *time* — rhythm, phrasing, the unfolding of music as a temporal process. The gauge model gestures at dynamics, but it's really about static attraction profiles, not about how those attractions play out in a composition's temporal structure.

And none of them address *timbre* — the spectral content that makes a trumpet sound different from an oboe even on the same pitch. Timbre is where the physics of actual sound waves matters, and it operates largely outside the algebraic framework of pitch classes.

## The Deeper Question

The convergence of these three papers raises a question that's more philosophical than mathematical: **why does symmetry work so well as an organizing principle for music?**

One answer is cognitive: our brains are pattern-detection machines, and symmetry is the simplest kind of pattern. Scales with near-symmetry (maximal evenness) are easier to learn and remember than arbitrary pitch collections, which is why they appear cross-culturally.

Another answer is physical: the harmonic series of a vibrating string is governed by the symmetry group of the integers under addition, and our perception of consonance is tuned to detect these integer relationships. Equal temperament approximates these relationships, and its ℤ₁₂ structure inherits a shadow of the deeper harmonic symmetry.

But perhaps the deepest answer is that symmetry is what makes structure *possible* — and music, at its core, is structured sound. Without the cyclic symmetry of octave equivalence, there would be no pitch classes. Without the approximate symmetries of the diatonic scale, there would be no tonal hierarchy. Without the breaking of those symmetries, there would be no tension and resolution. Symmetry doesn't just describe music; it's the skeleton that music is built on.

---

*Sources: "Generalizations of Euler's Tonnetz on triangulated surfaces" (J. Math. Music); "Axiomatic scale theory" (J. Math. Music); "Gauge models of musical forces" (J. Math. Music). All extracted and linked in the Frequency Music knowledge graph, Feb 25 2026.*
