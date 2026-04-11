---
title: "The Euclidean Beat: Why the World's Rhythms Are Solutions to a 2,300-Year-Old Algorithm"
publishDate: 2026-03-11
excerpt: "The Euclidean algorithm generates the world's most widespread rhythmic patterns across cultures—the same mathematical principle that organizes consonant intervals and scales reveals why humans everywhere converge on maximally even distributions of beats."
category: "mathematics"
tags:
  - "rhythm"
  - "mathematical-music-theory"
  - "group-theory"
  - "tuning-systems"
  - "geometry"
  - "number-theory"
author: "Keith Elliott"
byline: "Freq"
---

## 1. An Algorithm Older Than Music Notation

In 300 BCE, Euclid described an algorithm for finding the greatest common divisor of two integers. You probably learned it in a number theory course: to find GCD(a, b), repeatedly replace the larger number with the remainder of dividing the larger by the smaller, until one of them hits zero. The last nonzero remainder is the GCD.

In 2005, Godfried Toussaint published a paper that changed how we think about rhythm. He showed that when you apply Bjorklund's algorithm — a procedure developed at Los Alamos for distributing neutron pulses as evenly as possible in a timing cycle — the output is identical to applying the Euclidean algorithm. And the rhythms it generates are, with uncanny precision, the rhythmic patterns found in musical traditions across the globe.

The claim is startling: **the world's most widespread rhythmic patterns are solutions to the problem of distributing k onsets as evenly as possible among n time slots.** Not approximately. Exactly.

## 2. The Algorithm in Musical Terms

Here's how it works. You want to place _k_ onsets in a cycle of _n_ positions. Write _k_ ones and (_n_ − _k_) zeros:

```
E(5, 13): [1] [1] [1] [1] [1] [0] [0] [0] [0] [0] [0] [0] [0]
```

Now apply the Euclidean algorithm: pair each remaining zero-group with a one-group, appending zeros to ones. Repeat until you can't pair evenly. The result:

```
[1 0 0] [1 0 0] [1 0] [1 0] [1 0]  →  rearranged as cycle:
[1 0 0 1 0 1 0 0 1 0 1 0 0]
```

In musical notation, with `x` for onset and `.` for rest:

```
x . . x . x . . x . x . .
```

This is a well-known rhythm in West African and Afro-Cuban music. In fact, it's a standard pattern in the _bembé_ family. Toussaint catalogued the following:

| E(k, n)  | Pattern                           | Tradition                          |
| -------- | --------------------------------- | ---------------------------------- |
| E(2, 5)  | `x . x . .`                       | Khafif-e-ramal (Persian)           |
| E(3, 7)  | `x . x . x . .`                   | Ruchenitza (Bulgarian)             |
| E(3, 8)  | `x . . x . . x .`                 | Tresillo (Cuban)                   |
| E(4, 9)  | `x . x . x . x . .`               | Aksak (Turkish)                    |
| E(5, 8)  | `x . x x . x x .`                 | Cinquillo (Cuban)                  |
| E(5, 12) | `x . . x . x . . x . x .`         | Bembé (West African)               |
| E(7, 12) | `x . x x . x . x x . x .`         | West African bell                  |
| E(7, 16) | `x . . x . x . x . . x . x . x .` | Samba                              |
| E(5, 16) | `x . . x . . x . . x . . x . . .` | Bossa nova                         |
| E(9, 16) | `x . x x . x . x . x x . x . x .` | Rhythm necklace in Aka pygmy music |

When quantized to an even grid, these patterns are exact matches to ethnomusicological transcriptions — though of course, a master percussionist's performance includes micro-timing deviations (swing, feel) that the algorithm deliberately does not model.

## 3. Why Maximal Evenness?

The obvious question: why should _so many independent_ human musical cultures, developed across continents and millennia, converge on the same mathematical property — maximal evenness? (Not all did — gamelan and Native American powwow drumming follow different organizing principles — but the convergence among those that did demands explanation.)

Several interlocking explanations:

**Perceptual balance.** A maximally even distribution of onsets creates the most uniform distribution of inter-onset intervals (IOIs). This means no single gap is dramatically longer or shorter than the others, producing a pattern that feels rhythmically "balanced" even when asymmetric. The ear tolerates — and enjoys — patterns where the longest gap is at most one unit longer than the shortest.

**Danceability.** Maximally even rhythms are optimally entrained. Because the onsets are as evenly spaced as possible, a dancer's body can predict the _approximate_ timing of the next onset even without memorizing the pattern. This is the rhythmic equivalent of a melody that's mostly stepwise — predictable enough to follow, with just enough irregularity to be interesting.

**Structural uniqueness.** For given _k_ and _n_, the Euclidean rhythm is unique (up to rotation). There's only one way to distribute onsets maximally evenly. This means that if multiple independent cultures converge on "balanced asymmetry" as a rhythmic ideal, they'll converge on the _same patterns_. The math forces it.

**Motor constraints.** Human bodies are periodic systems with preferred oscillation frequencies. The biomechanical cost of executing a rhythmic pattern is minimized when the pattern approximates uniform spacing — the same criterion as maximal evenness. We play these rhythms because they're the ones our bodies can sustain.

## 4. Christoffel Words and the Geometry of Rhythm

The connection goes deeper than an algorithm. Maximally even rhythms are **Christoffel words** — objects from combinatorics on words that have been studied since the 19th century.

A Christoffel word of slope _k_/_n_ (with GCD(_k_, _n_) = 1) is a binary word that describes the closest lattice path below the line _y_ = (_k_/_n_)_x_ from (0, 0) to (_n_, _k_). Each horizontal step is a 0 (rest); each vertical step is a 1 (onset). The path hugs the line as closely as possible from below — which is exactly the geometric meaning of distributing _k_ ones as evenly as possible in _n_ positions.

This connects Euclidean rhythms to:

- **Bresenham's line algorithm** (1965): the classic computer graphics algorithm for rasterizing lines on a pixel grid. Drawing a line of slope _k_/_n_ on a grid IS generating the Euclidean rhythm E(_k_, _n_). The screen is a timeline; the pixels are onsets.

- **Continued fractions:** The Euclidean algorithm on _k_ and _n_ computes the continued fraction expansion of _k_/_n_. The partial quotients of the continued fraction tell you the hierarchical grouping structure of the rhythm. E(5, 13) has the expansion 5/13 = [0; 2, 1, 1, 2], which encodes the nesting of long and short groups.

- **The Stern-Brocot tree:** Rational numbers _k_/_n_ in lowest terms sit on the Stern-Brocot tree, and adjacent fractions on the tree correspond to rhythms that differ by a single onset swap. This gives a natural topology on the space of Euclidean rhythms — you can continuously morph between them via mediants.

This is the same Stern-Brocot tree that generates the hierarchy of just intervals in ["The Prime Dimensions"](/docs/essays/the-prime-dimensions.md) and organizes the Arnold tongues in ["The Locking In"](/docs/essays/the-locking-in.md). The same tree that governs which pitch ratios are consonant also governs which rhythmic distributions are maximally even. **The mathematics of harmonic consonance and rhythmic balance is the same mathematics.**

## 5. The Duality Between Pitch and Rhythm

This structural identity isn't a coincidence. It arises from a deep duality:

| Pitch domain                                | Rhythm domain                               |
| ------------------------------------------- | ------------------------------------------- |
| Frequency ratio _p_/_q_                     | Onset density _k_/_n_                       |
| Octave equivalence (mod 2)                  | Cyclic time (mod _n_)                       |
| Just interval                               | Euclidean rhythm                            |
| Tempered interval                           | Quantized rhythm                            |
| Comma (small interval ≈ unison)             | Beat displacement (small offset ≈ downbeat) |
| Consonance (simple ratio)                   | Balance (even distribution)                 |
| Stern-Brocot tree of intervals              | Stern-Brocot tree of rhythms                |
| Scale = selection of pitches from chromatic | Rhythm = selection of onsets from grid      |

In both domains, the fundamental problem is the same: **distribute discrete events as evenly as possible within a periodic cycle.** A scale distributes pitch classes in the octave; a rhythm distributes onsets in a measure. The Euclidean algorithm solves both problems.

This is the "Staircase and the Slope" from our [earlier essay](/docs/essays/the-staircase-and-the-slope.md) applied to time: the continuous slope is the ideal isochronous pulse, the staircase is the quantized rhythmic grid, and the Euclidean rhythm is the optimal staircase approximation.

The implications are compositional:

- A "just" rhythm is one whose onset density is a simple rational number (like 3/8 or 5/12). It has inherent structural clarity, like a just interval has inherent acoustic clarity.
- A "tempered" rhythm is one that distributes onsets at an irrational density (approximated on a grid). This is what happens when you quantize a freely-played pattern.
- "Rhythmic commas" are the gaps between where an onset would ideally fall (on the slope) and where the grid forces it (on the staircase). Swing is systematic comma management.

## 6. Necklaces, Bracelets, and Counting Distinct Rhythms

How many truly distinct Euclidean rhythms are there? This depends on what "distinct" means — the same question we confronted in ["Counting the Cubes"](/docs/essays/counting-the-cubes.md).

A rhythmic pattern of length _n_ is a binary string. Two patterns are "the same rhythm" if one is a cyclic rotation of the other — starting the pattern on a different beat doesn't change its identity. The equivalence classes under rotation are called **necklaces**. Two patterns are "the same shape" if one is a rotation _or reversal_ of the other — playing the pattern backwards doesn't change its shape. The equivalence classes under rotation and reflection are called **bracelets**.

Burnside's lemma gives us the count. The number of binary necklaces of length _n_ with _k_ ones is:

$$N(n, k) = \frac{1}{n} \sum_{d | \gcd(n,k)} \phi(d) \binom{n/d}{k/d}$$

For _n_ = 12 (the standard 12/8 timeline) with _k_ = 5 onsets, there are N(12, 5) = **12** distinct necklaces. Of these, exactly **one** is the Euclidean rhythm E(5, 12) — the bembé pattern. Out of all possible ways to place 5 onsets in 12 positions, the maximally even one is the most culturally widespread.

For _n_ = 16 (the standard 4/4 sixteenth-note grid):

- _k_ = 4: 120 necklaces. E(4, 16) = `x . . . x . . . x . . . x . . .` — the "four-on-the-floor" kick.
- _k_ = 5: 336 necklaces. E(5, 16) is one. Bossa nova chose it.
- _k_ = 7: 1,716 necklaces. E(7, 16) is one. Samba chose it.

The cultural convergence becomes statistically remarkable when you realize how many alternatives exist.

## 7. Maximally Even Sets in Pitch: Scales as Euclidean Rhythms

The pitch-rhythm duality means that maximally even pitch sets are _also_ Euclidean rhythms, just interpreted in pitch space rather than time.

The **major scale** is E(7, 12): seven notes distributed as evenly as possible in 12 chromatic positions. Its interval pattern — 2 2 1 2 2 2 1 — is exactly the binary string generated by Bjorklund's algorithm with _k_ = 7, _n_ = 12. The **pentatonic scale** is E(5, 12). The **whole-tone scale** is E(6, 12) — perfectly even, which is why it has no tension or resolution. The **diminished scale** is E(8, 12).

This observation, due to Clough and Douthett (1991), means that the world's most common scales and the world's most common rhythms are _the same mathematical objects in different domains_. The major scale is to the chromatic as the bembé bell pattern is to the 12/8 grid.

The implications cascade:

- **Modes are rotations.** The seven modes of the major scale are the seven rotations of E(7, 12), just as starting the bembé pattern on different beats gives different feels with the same underlying structure.
- **Scale brightness = rotational position.** Lydian (brightest) and Locrian (darkest) are opposite rotations of the same necklace, just as different rotations of a rhythmic necklace feel more or less "forward-leaning."
- **Rare intervals = rhythmic syncopation.** The tritone in the major scale (appearing only once) corresponds to a maximally isolated onset in the rhythmic reading — the syncopated note.

## 8. Well-Formedness and Myhill's Property

The theoretical framework crystallized by Carey and Clampitt (1989) gives us a precise vocabulary. A scale (or rhythm) is **well-formed** if it can be generated by repeatedly stacking a single interval and reducing modulo the period. The major scale is well-formed: stack fifths (C-G-D-A-E-B-F#, then reduce mod 12) and you get the diatonic collection.

Every well-formed scale has **Myhill's property**: each generic interval class (second, third, fourth, etc.) comes in exactly two specific sizes that differ by one chromatic step. In the major scale, seconds are either major (2 semitones) or minor (1 semitone). Thirds are either major (4) or minor (3). And so on.

Translated to rhythm: a well-formed rhythm has exactly two inter-onset interval sizes that differ by one time unit. The tresillo E(3, 8) = `x . . x . . x .` has IOIs of 3 and 2. The bembé E(5, 12) has IOIs of 3 and 2. The cinquillo E(5, 8) has IOIs of 2 and 1. Always two sizes, always differing by one.

This is why these rhythms feel "natural" — they have exactly enough asymmetry to be interesting, but not so much that they feel arbitrary. Two interval sizes means the ear can parse the structure with a binary vocabulary (long/short), which is the minimum complexity beyond the trivial (isochronous) case.

## 9. Deep Rhythms and Shadow Patterns

Toussaint introduced the concept of **deep rhythms**: patterns where every possible inter-onset interval (modulo the cycle length) appears a unique number of times. The diatonic scale E(7, 12) is deep in pitch space — the interval vector ⟨2, 5, 4, 3, 6, 1⟩ has all distinct entries (well, almost — the full theory requires slight refinement). Deep patterns have maximum intervallic diversity, meaning every transposition produces a distinct overlap count.

The **shadow** of a rhythm is its complement: the pattern of rests. The shadow of E(_k_, _n_) is E(_n_ − _k_, _n_). The shadow of the bembé (5 onsets, 7 rests in a 12-cycle) is a 7-onset pattern — the African bell pattern E(7, 12). The shadow of the tresillo (3, 8) is the cinquillo (5, 8). Onset patterns and rest patterns are Euclidean duals.

This duality means that **silence has the same structure as sound** in Euclidean rhythms. The rests aren't formless negative space; they're a complementary Euclidean rhythm with its own maximal evenness. Compositionally, this suggests treating the "space between beats" as a positive structural element — which is exactly what traditions like Afro-Cuban percussion do, with interlocking parts that fill each other's gaps.

## 10. Phylogenetic Trees of Rhythm

One of Toussaint's most provocative contributions is using geometric measures of rhythmic similarity to build phylogenetic trees of musical traditions — the same methodology biologists use to trace evolutionary relationships between species.

Using the **swap distance** (minimum number of onset-position swaps to transform one rhythm into another) or the **edit distance** (minimum insertions/deletions), you can quantify how "far apart" two rhythmic patterns are. Applied to a corpus of traditional rhythms from Africa, Cuba, Brazil, the Middle East, and the Balkans, these distances produce clustering that tracks known historical diffusion paths.

The tresillo (E(3, 8)) sits at the center of many tradition clusters — it's the rhythmic cognate of the perfect fifth, the simplest non-trivial asymmetric Euclidean rhythm. The bembé and its rotations form a tight cluster. Brazilian samba patterns cluster near but distinctly from Cuban patterns, reflecting their shared West African ancestry but distinct post-diaspora evolution.

This is rhythm as a formal language with a grammar, a vocabulary, and a phylogenetic history — amenable to the same mathematical tools we apply to DNA sequences or spoken languages.

## 11. Compositional Tools

For the working musician, the Euclidean framework provides a generative engine:

**Start with E(_k_, _n_).** Choose an onset density that matches the energy level you want. Sparse (_k_/_n_ < 1/3) for ambient or spacious textures. Moderate (1/3 to 1/2) for groove. Dense (> 1/2) for driving or frantic energy.

**Rotate for feel.** Each rotation of the necklace has a different relationship to the downbeat. Some rotations feel "on the beat" (onset aligns with position 1); others feel syncopated. This is the rhythmic analogue of choosing a mode.

**Layer Euclidean rhythms at coprime densities.** E(3, 8) layered with E(5, 8) produces a polyrhythmic texture where the two patterns share exactly one onset position and have maximally interlocking onsets/rests. Coprime densities guarantee maximum independence — connecting back to ["The Lonely Runner"](/docs/essays/the-lonely-runner.md).

**Morph via the Stern-Brocot tree.** To smoothly transform between two rhythmic feels, find their densities on the Stern-Brocot tree and traverse through the mediants. Each mediant rhythm is itself Euclidean and maximally even, so the transformation passes through natural-sounding intermediate patterns.

**Apply the pitch-rhythm duality.** Take a scale you love and read it as a rhythm. The Dorian mode (E(7, 12) starting on the second onset) has a specific rhythmic interpretation in 12/8 that inherits the Dorian scale's characteristic symmetry. Or go the other way: take a rhythmic pattern you love and read it as a pitch set.

## 12. The Deep Unity

What emerges from all of this is a picture of remarkable mathematical unity. The Euclidean algorithm — one of the oldest in mathematics — generates:

- The hierarchy of just intervals (via continued fractions of frequency ratios)
- The structure of consonance (via Arnold tongues organized by the Stern-Brocot tree)
- The world's rhythmic patterns (via Bjorklund's maximally even distribution)
- The world's scales (via Clough and Douthett's maximally even pitch sets)
- The hierarchy of commas (via convergents of continued fractions)
- The geometry of voice leading (via lattice paths in pitch-class space)

Pitch, rhythm, consonance, scale structure, and voice leading are all, at bottom, the same problem: **how to distribute discrete events as evenly as possible in a periodic space.** The Euclidean algorithm is the universal solver.

This isn't reductionism — knowing that the bembé is E(5, 12) doesn't explain why it makes people dance. But it explains why cultures worldwide converge on the same patterns, why certain scales and rhythms feel "natural," and why the same mathematical structures recur everywhere we look in music. The music isn't in the math. But the math is why _this_ music, and not some other, is what humans make.

---

## References

- Toussaint, G. T. (2005). "The Euclidean algorithm generates traditional musical rhythms." _Proceedings of BRIDGES_.
- Toussaint, G. T. (2013). _The Geometry of Musical Rhythm_. CRC Press.
- Bjorklund, E. (2003). "The theory of rep-rate pattern generation in the SNS timing system." SNS-NOTE-CISS-01.
- Clough, J. & Douthett, J. (1991). "Maximally even sets." _Journal of Music Theory_, 35(1-2), 93-173.
- Carey, N. & Clampitt, D. (1989). "Aspects of well-formed scales." _Music Theory Spectrum_, 11(2), 187-206.
- Demaine, E. D. et al. (2009). "The distance geometry of music." _Computational Geometry_, 42(5), 429-454.
- Amiot, E. (2007). "David Lewin and maximally even sets." _Journal of Mathematics and Music_, 1(3), 157-172.

---

_This essay connects to ["The Prime Dimensions"](/docs/essays/the-prime-dimensions.md) (Stern-Brocot tree), ["The Locking In"](/docs/essays/the-locking-in.md) (Arnold tongues), ["The Staircase and the Slope"](/docs/essays/the-staircase-and-the-slope.md) (discrete/continuous duality), ["Counting the Cubes"](/docs/essays/counting-the-cubes.md) (Burnside counting), ["The Lonely Runner"](/docs/essays/the-lonely-runner.md) (coprime independence), ["The Groove Equation"](/docs/essays/the-groove-equation.md) (asymmetric meter), and ["Finding One"](/docs/essays/finding-one.md) (metric framing)._
