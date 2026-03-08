# Counting the Cubes: Burnside's Lemma and the Enumeration of Musical Objects

*Why the number of "truly different" chords, scales, and rhythms is always smaller than you think*

---

A video about Sol LeWitt's sculpture *Incomplete Open Cubes* — 122 distinct ways to remove edges from a cube skeleton while keeping it connected — turns out to be a surprisingly direct path into one of music theory's deepest structural questions: **how many musically distinct objects are there?**

The mathematical hero of the story is Burnside's lemma (more properly Cauchy-Frobenius, but names stick). It answers a deceptively simple question: given a set of objects and a group of symmetries, how many *truly different* objects are there? Not how many can you write down, but how many remain once you've collapsed everything that's "the same up to symmetry"?

## The Sculptor's Problem

LeWitt wanted every possible way to keep at least 3 edges of a cube's 12-edge skeleton connected. Without symmetry, you'd need to enumerate all subsets — 2¹² = 4,096 possibilities before the connectivity filter. But a cube has 48 symmetries (rotations and reflections). Many apparently different incomplete cubes are really the same object seen from a different angle.

Burnside's lemma provides the counting formula: the number of distinct objects equals the average number of objects fixed by each symmetry operation. You don't enumerate and then deduplicate — you count fixed points of each group element and average. The answer for LeWitt's cubes: 386 structures, of which he selected the 122 connected ones with 3-11 edges.

This is exactly the same problem that appears, in different dress, throughout music theory.

## Pitch Class Sets: How Many Chords Are There?

Take the 12 notes of the chromatic scale. A "chord type" is a subset of these 12 pitch classes, considered up to transposition. Transposition is the action of ℤ₁₂ (the cyclic group of order 12) on the power set of {0, 1, ..., 11}.

Without symmetry: 2¹² = 4,096 subsets.

With transposition equivalence (Burnside): 352 distinct pitch class sets.

If you also quotient by inversion (the dihedral group D₁₂, order 24): 224 set classes.

These are Allen Forte's set classes — the foundation of post-tonal music theory. But the enumeration isn't just bookkeeping. The *distribution* of set classes by cardinality reveals structure:

| Cardinality | PC sets (mod transposition) | Set classes (mod T/I) |
|---|---|---|
| 0 | 1 | 1 |
| 1 | 1 | 1 |
| 2 | 6 | 6 |
| 3 | 19 | 12 |
| 4 | 43 | 29 |
| 5 | 66 | 38 |
| 6 | 80 | 50 |

The bulge at cardinality 6 is no accident — it reflects the combinatorial peak of "choose 6 from 12," tempered by the symmetry quotient. Hexachords are where the richest harmonic variety lives, which is why twelve-tone composers found them so fertile. The complement theorem (every hexachord's complement belongs to the same or a Z-related set class) is a direct consequence of this arithmetic.

## Rhythmic Necklaces: How Many Rhythms Are There?

The same mathematics applies to rhythm. Place *k* onsets into *n* evenly spaced time slots arranged in a circle. Rotational equivalence (starting the pattern at a different point) is again the action of ℤₙ.

Burnside gives us: the number of distinct rhythmic patterns (binary necklaces) with *k* onsets in *n* slots.

For the 16-slot grid of common 4/4 time:
- Total binary patterns: 2¹⁶ = 65,536
- Distinct necklaces: 4,116
- With 4 onsets (sparse, skeletal patterns): 286 rotationally distinct rhythms

Godfried Toussaint's *Euclidean rhythms* are a special case: among those 286 four-onset patterns in 16 slots, the Euclidean distribution E(4,16) produces the maximally even spacing. These are the rhythms that appear independently across musical cultures — the same way certain cube structures feel more "natural" than others.

The connection to LeWitt goes deeper. Just as he was interested in connectivity (the incomplete cube must be a single connected structure), musicians implicitly impose constraints beyond mere subset selection. A useful rhythm needs to be parseable by the body — it needs a kind of perceptual "connectivity."

## Scales as Necklaces

A scale is a pitch necklace: a selection of notes from the chromatic circle, up to rotation (transposition). The 7-note scales in 12-tone equal temperament yield 66 distinct necklaces. Among these:

- The diatonic collection (and its modes — all one necklace)
- The melodic minor ascending (and its modes — the "jazz minor" family)
- The harmonic minor (and its modes)
- The Hungarian minor, the double harmonic, the enigmatic...

Each is a single necklace that generates 7 (or fewer, for symmetric scales) modal rotations. The total landscape of 66 heptatonic necklaces is exhaustive — there is no undiscovered 7-note scale in 12-TET. You can enumerate them all. The question for composers isn't "what scales exist?" but "which of these 66 objects produces the intervallic profile I want?"

Some necklaces have internal symmetry (the whole-tone scale has 12-fold symmetry, the diminished scale has 4-fold). These symmetric scales are the fixed points of non-trivial group elements in Burnside's counting — they're the ones that get overcounted if you don't use the lemma correctly, and they're also the ones that sound "symmetrical" to the ear. Messiaen catalogued them as his *modes of limited transposition*. The mathematics predicted exactly how many such modes exist at each cardinality.

## From Enumeration to Navigation

Here's where the cube metaphor becomes most illuminating. LeWitt didn't just want a *count* — he wanted to *see all of them*, arrayed together, to understand the space of possibility. His installation is a kind of atlas.

Music theory has been building the same kind of atlas. The Tonnetz maps triadic relationships. The OPTIC spaces (Callender, Quinn, Tymoczko) map chord spaces as orbifolds. Rhythmic necklace lattices map temporal patterns. In every case, the first step is Burnside: figure out how many distinct objects you're dealing with. The second step is topology: figure out how they connect to each other.

And the experience of discovery mirrors LeWitt's own. In the 3Blue1Brown video, the narrator describes the moment of epiphany — when the pattern-counting method clicks and you suddenly see *why* the answer must be what it is. Every music theorist who has worked through the necklace enumeration knows that same moment: the transition from "I can list them all" to "I understand *why there are this many*."

## The Deeper Pattern

What unites cubes and chords is the relationship between raw combinatorial abundance and perceptual parsimony. 4,096 subsets of the chromatic scale; 352 transposition classes; 224 set classes. 65,536 binary rhythms in a 16-slot grid; 4,116 necklaces. At every level, symmetry compresses the space dramatically.

This compression isn't just mathematical convenience — it reflects something about perception. We hear transposed melodies as "the same melody." We hear rotated rhythms as "the same groove" (at least in many cultural contexts). The symmetry groups we divide by aren't arbitrary; they're the symmetries of the perceptual spaces we inhabit.

The cube has 48 symmetries because physical space has those rotational and reflective isometries. The chromatic scale has 12 transpositions (and 12 inversions) because of octave equivalence and the perceptual equivalence of interval patterns. In both cases, the group isn't chosen for mathematical convenience — it emerges from the structure of the medium.

Sol LeWitt understood this intuitively. His incomplete cubes aren't exercises in combinatorics — they're an exploration of what it means for structures to be "the same" and "different." Every composer navigating the space of possible chords, scales, and rhythms is doing the same exploration, whether or not they know Burnside's name.

---

*The tools for counting distinct musical objects have been known since Pólya's enumeration theorem (1937), but the connection to compositional practice remains underexplored. Burnside's lemma doesn't tell you which of the 224 set classes sounds good — but it tells you exactly how large the space of possibility is, which is the first step toward navigating it wisely.*
