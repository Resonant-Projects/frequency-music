# The Cost of Moving

_Essay #86 — April 2, 2026_

_On optimal transport as the hidden geometry of voice leading, tuning, and everything in between._

---

## The Question From Last Time

Essay #85 ended with a provocation: if sound encodes geometry, and the space of possible sounds is isomorphic to the space of possible resonant geometries, what does it mean to compose in the space of geometries rather than the space of pitches?

The answer, it turns out, has been sitting in mathematics for over two hundred years, quietly waiting for music theory to notice.

---

## Monge's Problem

In 1781, Gaspard Monge posed a question: given a pile of sand and a hole to fill, what is the cheapest way to move the sand? "Cheapest" meaning the minimum total distance traveled by all the grains. This is the _optimal transport_ problem — finding the mapping between two distributions that minimizes the total cost of rearrangement.

Monge's problem was about dirt. But the mathematical framework it spawned — refined by Kantorovich in the 1940s, given geometric structure by Brenier, Villani, and others — turns out to describe something far more general: the minimum-cost transformation of any distribution into any other.

Including distributions of sound.

---

## Voice Leading Is Optimal Transport

Dmitri Tymoczko's geometric model of music places chords as points in continuous space, where the distance between two chords is the cost of the smoothest voice leading between them. Moving from C major to F major means reassigning each note in one chord to a note in the other, minimizing the total motion.

This is Monge's problem. The "sand" is the distribution of pitch energy in the first chord. The "hole" is the distribution in the second. The "cheapest mapping" is the most efficient voice leading. The total cost is what Tymoczko calls the _size_ of the voice leading.

This isn't a metaphor. The mathematical structures are identical. Voice leading in n-note chords lives in the same quotient spaces (orbifolds formed by permutation symmetries) that arise naturally in optimal transport theory when the source and target have equal mass and the cost function is Euclidean distance. The OPTIC symmetries that Tymoczko identifies — octave equivalence, permutation, transposition, inversion, cardinality — are precisely the symmetries that reduce the transport problem's search space.

A composer choosing a voice leading is solving an optimization problem, usually unconsciously, usually approximately. The Western common-practice preference for smooth voice leading is a preference for _cheap transport_ — small total cost, many grains moving short distances rather than few grains moving far.

---

## The Speech Connection

A recent paper, POTSA, applies optimal transport to a seemingly unrelated problem: aligning speech representations across languages for translation. The system takes speech in Hindi and speech in English and finds the minimum-cost mapping between their neural representations — the cheapest way to "move" one language's sound-meaning space onto another's.

The mathematical machinery is the same. Token-level OT constraints ensure that aligned representations preserve semantic content while minimizing transformation cost. A "Bias Compensation" module handles the fact that different languages don't occupy the same regions of representation space — just as different keys don't occupy the same regions of pitch space.

Read through the lens of the essay arc, POTSA is doing voice leading between languages. The "chords" are distributions of meaning across acoustic features. The "voice leading" is the minimum-cost alignment that preserves what matters (semantics, structure) while allowing what doesn't matter (surface phonetics, spectral detail) to change.

This is not a coincidence. It's a consequence of the fact that optimal transport is the natural metric on the space of distributions — _any_ distributions. Wherever you have two configurations of some quantity and need to measure how different they are, or how to most efficiently transform one into the other, you arrive at optimal transport.

---

## Scales as Transport Equilibria

The connection deepens when you consider tuning systems.

A recent extraction references a novel characterization of Maximally Even (ME) sets — the class of pitch collections (including the diatonic scale, the pentatonic scale, and the chromatic scale itself) that are as evenly distributed around the octave as the arithmetic allows. ME sets are the foundation of scale theory, from Clough-Douthett's original definition to more recent algebraic and Fourier-based characterizations.

Here's the transport interpretation: a maximally even set is the configuration that minimizes the optimal transport cost from the uniform distribution on the circle. It is the _cheapest approximation_ of "all pitches equally" using only n pitches. The diatonic scale is the best 7-note approximation of the chromatic continuum, in the precise sense that no other 7-note set has lower transport cost to uniformity.

This reframes a century of scale theory. Why do ME sets sound "balanced"? Why do they support the richest harmonic functions? Because they are _transport equilibria_ — the configurations from which reaching any other configuration costs the least on average. A maximally even scale is a scale that minimizes the expected cost of future voice leadings. It is poised for movement.

Equal temperament, in this light, is the limiting case: the tuning system where transport cost to uniformity is literally zero. It is the only tuning where the scale _is_ the uniform distribution, discretized. The slight roughness that musicians hear in equal temperament compared to just intonation is the sound of zero transport cost — the sound of a scale with nowhere to go because it's already everywhere.

---

## The Wasserstein Metric and Musical Distance

The optimal transport cost between two distributions has a name: the _Wasserstein distance_ (or Earth Mover's Distance). It gives the space of probability distributions the structure of a metric space — a space with a well-defined notion of distance.

Applied to music, this means:

- The Wasserstein distance between two chords is the cost of the smoothest voice leading between them.
- The Wasserstein distance between two scales is the cost of the most efficient retuning.
- The Wasserstein distance between two timbres (as spectral distributions) is the cost of the most gradual spectral morphing.
- The Wasserstein distance between two rhythmic patterns (as distributions of event density over time) is the cost of the smoothest metric modulation.

All of these are the _same metric_, applied to different musical domains. This is why voice leading "feels like" spectral morphing, why metric modulation "feels like" retuning. They are the same mathematical operation on different musical spaces.

---

## The Geometry Has a Shape

The Wasserstein metric gives the space of musical configurations a geometry. Not a metaphorical geometry — an actual Riemannian manifold with curvature, geodesics, and all the apparatus of differential geometry.

In this geometry:

- **Geodesics** are the smoothest possible transformations — the ideal voice leadings, the most gradual timbral transitions, the cleanest metric modulations. They are what a composer reaches for when they want a transformation to sound "natural."

- **Curvature** reflects the cost of deviation from straightness. High curvature means that nearby configurations require sharply different transformations to reach the same target — a compositional landscape of sudden decisions. Low curvature means smooth, predictable transformational space.

- **Volume** reflects how many distinct configurations exist in a region. Dense regions of configuration space offer many compositional choices; sparse regions offer few. The fact that the diatonic scale sits in a dense region of 7-note configuration space — many neighboring scales, many voice-leading possibilities — is the geometric reason for its dominance in Western music.

The shape of this manifold is not arbitrary. It's constrained by the same physics that essays #82-85 explored: the resonance properties of physical systems, the information in decay, the geometric encoding of sound. The Wasserstein manifold of musical configurations is the mathematical space that essay #85 asked about — the space of resonant geometries, now equipped with a metric.

---

## Composition as Transport Planning

If voice leading is optimal transport, then a composition is a _transport plan_ — a sequence of optimal (or deliberately suboptimal) redistributions of musical energy.

This reframing suggests three compositional strategies:

### 1. Geodesic Composition

Follow the shortest paths. Minimize transport cost at every step. This produces the smoothest possible music — Palestrina counterpoint, late Romantic voice leading, ambient drone music. The listener perceives effortlessness because the geometry is being respected. Every transformation follows the manifold's natural contours.

### 2. Curvature Exploitation

Seek regions of high curvature where small moves in configuration space produce disproportionate perceptual effects. This is the strategy of modernist harmony — the Tristan chord works because it sits at a point of high curvature in the Wasserstein manifold, where the geodesics to tonic resolution and to further chromaticism diverge sharply. The listener perceives tension because the geometry demands a choice.

### 3. Transport Discontinuity

Violate the optimal transport solution deliberately. Jump to a distant configuration without the intermediate steps. This is the strategy of montage, of abrupt modulation, of the cut in electronic music. The listener perceives surprise because the expected geodesic has been abandoned. The "cost" of the discontinuity is felt as musical energy.

Every piece of music, from Machaut to Merzbow, can be described as a path through the Wasserstein manifold of musical configurations, choosing at each moment whether to follow, exploit, or violate the geometry's preferred directions.

---

## The Thread

This essay answers the question posed at the end of #85:

- **#82:** Structure survives transformation.
- **#83:** Our measurements see surface, not structure.
- **#84:** Decay reveals structure over time.
- **#85:** The revealed structure is geometric — sound encodes the shape of its source.
- **#86:** The space of geometric shapes has a natural metric — optimal transport — and that metric _is_ voice leading, retuning, spectral morphing, and metric modulation, unified.

The arc has moved from _what persists_ to _what connects_. The Wasserstein metric provides the connective tissue: the measure of how far apart any two musical states are, and the prescription for the cheapest way to move between them.

The next question is inevitable: if the geometry has a shape, does it have _dynamics_? What forces push musical configurations along geodesics, and what determines when they jump?

---

_The pile of sand doesn't care whether it's filling a hole in a Paris quarry or the space between two chords. The math is the same. The cheapest path is the smoothest voice leading, the most even scale, the most gradual morph. Composition is choosing when to pay the minimum — and when to spend everything._
